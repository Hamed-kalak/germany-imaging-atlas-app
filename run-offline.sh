#!/usr/bin/env bash
#
# run-offline.sh — start the Imaging Atlas with no build and no registry.
#
# `docker build` asks the registry about its base image even when that image is
# already on the machine, which is why a locked-down VM answers with
# "failed to load metadata for docker.io/library/nginx:...". `docker run`
# against an image that is already present asks nobody anything.
#
# So this does not build. It takes an nginx image the machine already has,
# mounts the prebuilt site and the two config files into it, and starts it.
# Nothing is downloaded, nothing is compiled, and the container holds no copy
# of the site — it reads the one in this folder.
#
#   ./run-offline.sh                     # port 8501, first local nginx image
#   ATLAS_PORT=8080 ./run-offline.sh     # another port
#   NGINX_IMAGE=nginx:1.25 ./run-offline.sh
#
# To stop it:   docker rm -f imaging-atlas
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${ATLAS_PORT:-8501}"
NAME="${ATLAS_NAME:-imaging-atlas}"

die() { printf '\n  %s\n\n' "$*" >&2; exit 1; }

# Fetch a URL with whatever this machine has. A minimal server image may carry
# neither curl nor wget, and reporting "not healthy" because the CHECKER is
# missing would send someone debugging a container that is working fine.
HTTP=""
if command -v curl >/dev/null 2>&1; then HTTP=curl
elif command -v wget >/dev/null 2>&1; then HTTP=wget
fi
http_get() {
  case "$HTTP" in
    curl) curl -fsS "$1" 2>/dev/null ;;
    wget) wget -qO- "$1" 2>/dev/null ;;
    *)    return 2 ;;                    # no client here; the caller falls back
  esac
}

# ── 0 · is there a daemon at all ───────────────────────────────────────────
command -v docker >/dev/null 2>&1 || die "docker is not on PATH."
docker info >/dev/null 2>&1 || die "The Docker daemon is not reachable.
  Start it (systemctl start docker) or check that this user is in the docker group."

# ── 1 · the site has to be here ────────────────────────────────────────────
[ -f "$HERE/site/index.html" ] || die "site/index.html is missing. Copy the whole bundle folder, not just this script."
[ -f "$HERE/site/build.json" ] || die "site/build.json is missing — this is not a stamped bundle."
[ -f "$HERE/nginx.conf" ] || die "nginx.conf is missing."
[ -f "$HERE/nginx-security-headers.conf" ] || die "nginx-security-headers.conf is missing."

# ── 2 · an nginx image that is already on this machine ─────────────────────
IMAGE="${NGINX_IMAGE:-}"
if [ -z "$IMAGE" ]; then
  IMAGE="$(docker images --format '{{.Repository}}:{{.Tag}}' \
           | grep -E '^nginx:' | grep -v '<none>' | head -n1 || true)"
fi
[ -n "$IMAGE" ] || die "No nginx image on this machine, and none given.
  Run 'docker images' to see what is here, then pass one:
      NGINX_IMAGE=<repo:tag> ./run-offline.sh
  If there is genuinely no nginx image and no way to pull one, the image has to
  be built elsewhere and carried over — see START-HERE.md."

docker image inspect "$IMAGE" >/dev/null 2>&1 \
  || die "Image '$IMAGE' is not present locally, so starting it would need a pull.
  Pick one from 'docker images'."

echo "  image   $IMAGE (local, nothing will be pulled)"

# ── 3 · SELinux relabels, or the container cannot read the mounts ──────────
SUF=":ro"
if command -v getenforce >/dev/null 2>&1 && [ "$(getenforce 2>/dev/null)" = "Enforcing" ]; then
  SUF=":ro,Z"
  echo "  selinux enforcing — mounting with :Z"
fi

# ── 4 · check the config against THIS image before going anywhere ──────────
# An nginx built without ngx_http_gzip_static_module rejects `gzip_static on`
# and the container would restart-loop. Find out now, in a throwaway container.
if ! docker run --rm \
      -v "$HERE/nginx.conf:/etc/nginx/conf.d/default.conf${SUF}" \
      -v "$HERE/nginx-security-headers.conf:/etc/nginx/security-headers.conf${SUF}" \
      "$IMAGE" nginx -t >/tmp/atlas-nginx-t.log 2>&1; then
  cat /tmp/atlas-nginx-t.log >&2
  if grep -q 'gzip_static' /tmp/atlas-nginx-t.log; then
    die "This nginx has no gzip_static module.
  Delete the line 'gzip_static on;' from nginx.conf and run this again — the
  plain 'gzip on;' underneath still compresses, just per request rather than
  serving the .gz files already in site/."
  fi
  die "This nginx rejected the configuration — see above."
fi
echo "  config  accepted by this nginx"

# ── 5 · replace whatever was running under this name ───────────────────────
if docker ps -a --format '{{.Names}}' | grep -qx "$NAME"; then
  echo "  replacing the existing '$NAME' container"
  docker rm -f "$NAME" >/dev/null
fi

# ── 6 · run ────────────────────────────────────────────────────────────────
docker run -d \
  --name "$NAME" \
  --restart unless-stopped \
  --security-opt no-new-privileges:true \
  --log-opt max-size=10m --log-opt max-file=3 \
  -p "${PORT}:80" \
  -v "$HERE/site:/usr/share/nginx/html${SUF}" \
  -v "$HERE/nginx.conf:/etc/nginx/conf.d/default.conf${SUF}" \
  -v "$HERE/nginx-security-headers.conf:/etc/nginx/security-headers.conf${SUF}" \
  "$IMAGE" >/dev/null

# ── 7 · say whether it actually works ──────────────────────────
URL="http://127.0.0.1:${PORT}"
for _ in 1 2 3 4 5 6 7 8 9 10; do
  sleep 1
  if [ "$(docker inspect -f '{{.State.Running}}' "$NAME" 2>/dev/null)" != "true" ]; then
    echo; echo "  the container stopped. Its last words:"; echo
    docker logs --tail 30 "$NAME" 2>&1 | sed "s/^/    /"
    die "Not started."
  fi
  http_get "${URL}/healthz" >/dev/null 2>&1 && break
done

echo
if [ -z "$HTTP" ]; then
  # Neither curl nor wget on the host. Ask nginx from inside its own container:
  # that proves the server works, but says nothing about the published port.
  if docker exec "$NAME" wget -qO- http://127.0.0.1/healthz >/dev/null 2>&1; then
    echo "  RUNNING   the container answers /healthz from inside, on port ${PORT}."
    echo "            No curl or wget here, so the published port is unverified"
    echo "            from this shell — open it in a browser to be sure."
    echo
    echo "  stop it with:  docker rm -f ${NAME}"
  else
    echo "  The container is up but nginx did not answer inside it."
    echo "  Check:  docker logs ${NAME}"
    exit 1
  fi
elif http_get "${URL}/healthz" >/dev/null 2>&1; then
  STAMP="$(http_get "${URL}/build.json")"
  ROWS="$(echo "$STAMP" | grep '"rows"' | tr -dc '0-9')"
  SHA="$(echo "$STAMP" | grep sha256 | cut -d '"' -f 4 | cut -c 1-16)"
  echo "  RUNNING   http://$(hostname -f 2>/dev/null || hostname):${PORT}/"
  echo "  health    $(http_get "${URL}/healthz")"
  echo "  build     ${ROWS} diagnoses, data ${SHA}"
  echo
  echo "  stop it with:  docker rm -f ${NAME}"
else
  echo "  The container is running but /healthz did not answer on port ${PORT}."
  echo "  Check:  docker logs ${NAME}   and   ss -ltnp | grep ':${PORT}'"
  exit 1
fi
