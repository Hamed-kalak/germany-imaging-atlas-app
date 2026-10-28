#!/usr/bin/env bash
#
# deploy.sh — load the prebuilt image and run it. One command, no internet, no
# build, no npm, no registry.
#
#   bash deploy.sh              # deploy; refuses if another container holds the port
#   bash deploy.sh --replace    # also retire whatever holds the port, tagging it first
#   ATLAS_PORT=8080 bash deploy.sh
#
# The image in imaging-atlas-1.1.0.tar.gz was built and run through its own
# checks before it was written to this drive: the data hash matched the stamp,
# tsc and the bundler ran clean, nginx accepted the configuration, every
# endpoint answered, and it was verified running read-only. Nothing here
# compiles or downloads anything.
#
# To stop it:   docker rm -f imaging-atlas
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGE="imaging-atlas:1.1.0"
TAR="$HERE/imaging-atlas-1.1.0.tar.gz"
NAME="${ATLAS_NAME:-imaging-atlas}"
PORT="${ATLAS_PORT:-8501}"
REPLACE=0
case "${1:-}" in
  --replace) REPLACE=1 ;;
  -h|--help) sed -n '2,18p' "$0" | sed 's/^#//'; exit 0 ;;
  "") ;;
  *) echo "unknown option: $1 (try --help)" >&2; exit 2 ;;
esac

die() { printf '\n  %s\n\n' "$*" >&2; exit 1; }
say() { printf '  %s\n' "$*"; }

# ── 1 · how do we talk to docker here ──────────────────────────────────────
# "Cannot connect to the Docker daemon" nearly always means this user is not in
# the docker group, not that the daemon is down. Find out rather than guess.
command -v docker >/dev/null 2>&1 || die "docker is not installed, or not on PATH."
D=""
if docker info >/dev/null 2>&1; then
  D="docker"
elif sudo -n docker info >/dev/null 2>&1; then
  D="sudo docker"
  say "using sudo (this user is not in the docker group)"
elif sudo docker info >/dev/null 2>&1; then
  D="sudo docker"
  say "using sudo"
else
  die "Cannot reach the Docker daemon, with or without sudo.
  Is it running?     sudo systemctl status docker
  Start it:          sudo systemctl start docker
  Or add yourself:   sudo usermod -aG docker \$USER   (then log out and back in)"
fi

# ── 2 · the image ──────────────────────────────────────────────────────────
# shellcheck disable=SC2086
if $D image inspect "$IMAGE" >/dev/null 2>&1; then
  say "image   $IMAGE already loaded"
else
  [ -f "$TAR" ] || die "$TAR is missing. Copy the whole folder, not just this script."
  say "loading $IMAGE from $(basename "$TAR") — about 30 seconds"
  gunzip -c "$TAR" | $D load >/dev/null
  $D image inspect "$IMAGE" >/dev/null 2>&1 || die "The image did not load. Run it by hand to see why:
  gunzip -c '$TAR' | ${D} load"
  say "image   loaded"
fi

# ── 3 · who has the port ───────────────────────────────────────────────────
HOLDER="$($D ps --format '{{.Names}} {{.Ports}}' | grep ":${PORT}->" | awk '{print $1}' | head -n1 || true)"
if [ -n "$HOLDER" ] && [ "$HOLDER" != "$NAME" ]; then
  if [ "$REPLACE" -eq 1 ]; then
    STAMP="$(date +%Y%m%d)"
    say "retiring '$HOLDER', which holds port ${PORT}"
    $D commit "$HOLDER" "retired-${HOLDER}:${STAMP}" >/dev/null 2>&1 \
      && say "saved it first as retired-${HOLDER}:${STAMP}" \
      || say "could not snapshot it (continuing — its original image is still on the machine)"
    $D rm -f "$HOLDER" >/dev/null
  else
    die "Port ${PORT} is held by the container '${HOLDER}'.
  To take it over, keeping a rollback image of it first:
      bash deploy.sh --replace
  Or leave it alone and use another port:
      ATLAS_PORT=8080 bash deploy.sh"
  fi
fi

# ── 4 · replace any previous run of ours ───────────────────────────────────
if $D ps -a --format '{{.Names}}' | grep -qx "$NAME"; then
  say "replacing the existing '$NAME'"
  $D rm -f "$NAME" >/dev/null
fi

# ── 5 · run ────────────────────────────────────────────────────────────────
$D run -d \
  --name "$NAME" \
  --restart unless-stopped \
  --read-only \
  --tmpfs /var/cache/nginx --tmpfs /var/run --tmpfs /tmp \
  --security-opt no-new-privileges:true \
  --log-opt max-size=10m --log-opt max-file=3 \
  -p "${PORT}:80" \
  "$IMAGE" >/dev/null
say "started"

# ── 6 · did it actually work ───────────────────────────────────────────────
HTTP=""
if command -v curl >/dev/null 2>&1; then HTTP=curl
elif command -v wget >/dev/null 2>&1; then HTTP=wget
fi
get() {
  case "$HTTP" in
    curl) curl -fsS "$1" 2>/dev/null ;;
    wget) wget -qO- "$1" 2>/dev/null ;;
    *)    return 2 ;;
  esac
}

URL="http://127.0.0.1:${PORT}"
for _ in 1 2 3 4 5 6 7 8 9 10; do
  sleep 1
  if [ "$($D inspect -f '{{.State.Running}}' "$NAME" 2>/dev/null)" != "true" ]; then
    echo; echo "  it stopped. Its last words:"; echo
    $D logs --tail 30 "$NAME" 2>&1 | sed "s/^/    /"
    die "Not running."
  fi
  get "${URL}/healthz" >/dev/null 2>&1 && break
done

echo
if [ -z "$HTTP" ]; then
  if $D exec "$NAME" wget -qO- http://127.0.0.1/healthz >/dev/null 2>&1; then
    say "RUNNING   nginx answers inside the container, published on port ${PORT}"
    say "          no curl or wget here, so open it in a browser to confirm the port"
  else
    say "The container is up but nginx did not answer inside it."
    say "Check:  ${D} logs ${NAME}"
    exit 1
  fi
elif get "${URL}/healthz" >/dev/null 2>&1; then
  S="$(get "${URL}/build.json")"
  ROWS="$(echo "$S" | grep '"rows"' | tr -dc '0-9')"
  SHA="$(echo "$S" | grep sha256 | cut -d '"' -f 4 | cut -c 1-16)"
  say "RUNNING   http://$(hostname -f 2>/dev/null || hostname):${PORT}/"
  say "health    $(get "${URL}/healthz")"
  say "data      ${ROWS} diagnoses, sha256 ${SHA}"
  echo
  say "stop it with:   ${D} rm -f ${NAME}"
  say "its logs:       ${D} logs -f ${NAME}"
else
  say "The container is running but nothing answered on port ${PORT}."
  say "Check:  ${D} logs ${NAME}    and    ss -ltnp | grep ':${PORT}'"
  exit 1
fi
