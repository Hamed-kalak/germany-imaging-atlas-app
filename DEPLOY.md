# Deploying the Imaging Atlas on the server VM

One container: nginx serving a directory of static files. No database, no
backend, no writable volume, no outbound network. Losing the container costs
nothing but the minute it takes to run this again.

The image has been built and run with Docker Desktop (1.0.2 in October 2026, the
version archived at https://doi.org/10.5281/zenodo.23563278; 1.1.0 adds the phone
layout). It is designed to fail loudly rather than produce a broken image: the
data stamp is checked before the bundle is built, and `nginx -t` runs inside the
image build, so a bad config breaks the build instead of crash-looping on the
server.

**Deploying from the standalone repository** (`Hamed-kalak/germany-imaging-atlas-app`):
the data is already stamped there (`public/build.json`), so skip section 0 and
start at section 1. Section 0 runs in the authors' research repository, which
holds the manuscript tables the gates compare against.

---

## 0 · Before you build: stamp the data

The two data gates read the Article's appendix tables from `research/`, which
is deliberately **not** in the Docker build context — a public web image should
not carry the manuscript. So the gates run here, in the repository, and leave a
stamp the image build can check.

```bash
cd deployment/imaging-atlas-germany
npm ci
npm run stamp
```

This runs all three gates — parity (624 codes against appendix table S1),
integrity (printed numbers, table S0, rubrics, suppressed cells) and render
(every panel, including a 624-diagnosis pool, for crashes, NaN and time) — and
writes `public/build.json` only if all three pass. That file records the data's
SHA-256, the row count, the commit and the verdicts, and is served at
`/build.json` by the running container.

`docker build` re-hashes the data and refuses if it does not match. There is no
way to ship a dataset that never passed the gates without deliberately faking
the stamp.

---

## 0b · If the server cannot pull the base images

A locked-down VM answers `docker compose up --build` with

    failed to load metadata for docker.io/library/nginx:1.27-alpine

which means the daemon cannot reach Docker Hub — not that anything here is
wrong. Three ways out, cheapest first.

**Do not build at all — this is the one to reach for.** `run-offline.sh` starts
the atlas by mounting the prebuilt `site/` into an nginx image the machine
already has. `docker run` against a local image contacts no registry, so it
works with the network entirely closed:

```bash
bash run-offline.sh
```

It checks the daemon, confirms the nginx it picked is really local, relabels
the mounts if SELinux is enforcing, runs `nginx -t` against that image before
starting anything, and waits for `/healthz` to answer.

**Use what the machine already has.** Both compose files take the base images
as build arguments:

```bash
docker images | grep -iE 'nginx|node'
NGINX_IMAGE=nginx:alpine NODE_IMAGE=node:20-alpine docker compose up -d --build
```

The node build checks its own version and stops with a sentence if the cached
tag is older than the 20.19 Vite 7 requires.

**Skip node entirely.** `Dockerfile.prebuilt` serves a site built beforehand,
so the only image needed is nginx:

```bash
NGINX_IMAGE=nginx:alpine docker compose -f docker-compose.prebuilt.yml up -d --build
```

The deployment bundle ships that prebuilt site as `site/`, already compressed
and hash-checked against the stamp.

**Check it is not just a proxy.** The daemon is a service; it does not inherit
the shell's proxy settings.

```bash
docker pull nginx:alpine
cat /etc/docker/daemon.json 2>/dev/null
systemctl show docker --property=Environment
```

And if a build fails with "failed to load metadata" for an image that IS on the
machine, that is BuildKit asking the registry about a tag it already has.
`DOCKER_BUILDKIT=0` in front of the command falls back to the classic builder,
which uses the local image.

## 1 · Get the code onto the VM

**If the VM can reach npm and Docker Hub** (simplest — build there):

```bash
# on the VM
git clone <this repo> icd_dashbord          # or pull, if it is already there
cd icd_dashbord/deployment/imaging-atlas-germany
```

`public/build.json` must be committed for this to work — it is, and it is
what the build verifies against.

**If the VM has no internet** — build here, ship the image:

```bash
# on the development machine
docker build -t imaging-atlas:1.1.0 .
docker save imaging-atlas:1.1.0 | gzip > imaging-atlas-1.1.0.tar.gz   # ~60 MB

# copy it across, then on the VM
gunzip -c imaging-atlas-1.1.0.tar.gz | docker load
```

With this route, copy `docker-compose.yml` to the VM as well and delete its
`build:` block, so compose uses the loaded image rather than trying to build.

---

## 2 · Remove the dashboard that is there now

Find it first. Do not guess the name.

```bash
docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
```

You are looking for the old container — most likely `icd-looker`, on port 8501.

**Keep a way back before you delete anything.** The old image is the rollback:

```bash
docker commit <old-container> icd-looker:rollback-$(date +%Y%m%d)   # if it was never tagged
docker images | grep -i icd                                        # confirm a tag exists
```

Then stop and remove it:

```bash
docker stop <old-container>
docker rm   <old-container>
```

If it was started by its own compose file, use that instead, from its own
directory:

```bash
docker compose down
```

Confirm the port is free — this must print nothing:

```bash
ss -ltnp | grep ':8501'
```

---

## 3 · Start the new one

```bash
cd icd_dashbord/deployment/imaging-atlas-germany
docker compose up -d --build
docker compose ps
```

The build takes a few minutes, most of it `npm ci` and the 18 MB dataset being
compressed. Watch it if you like:

```bash
docker compose logs -f
```

**Port.** 8501, on every interface of the VM. Change it without editing the
file:

```bash
ATLAS_PORT=8090 docker compose up -d
```

To keep it local to the VM instead — reachable only from the machine itself and
from anything proxying on it — prefix the port with `127.0.0.1:` in the
`ports:` line. Nothing authenticates in front of this container, so anywhere it
is reachable, it is readable.

---

## 4 · Verify, in order

```bash
# 1 · the container is healthy (not just running)
docker inspect --format '{{.State.Health.Status}}' imaging-atlas     # → healthy

# 2 · the server answers
curl -s http://127.0.0.1:8501/healthz                                # → ok

# 3 · which build is it, and did its data pass the gates
curl -s http://127.0.0.1:8501/build.json

# 4 · the page loads
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8501/      # → 200

# 5 · the dataset is served pre-compressed, not re-zipped per request
curl -sI -H 'Accept-Encoding: gzip' http://127.0.0.1:8501/assets/realData-*.json \
  | grep -i 'content-encoding\|content-length'                       # → gzip, ~3.5 MB

# 6 · a missing asset 404s instead of returning the page
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8501/assets/nope.json  # → 404

# 7 · security headers are present
curl -sI http://127.0.0.1:8501/ | grep -i 'content-security-policy\|x-content-type'
```

Check 6 matters more than it looks. With the usual catch-all SPA fallback, a
data file that failed to deploy answers `200` with the page's own HTML, and the
app then reports a JSON parse error that points nowhere. Here it 404s, and the
app says so in words.

Then open it in a browser and confirm: the treemap draws, a chapter opens, and
the About / Cite panel shows the source line.

---

## 5 · If it does not start

```bash
docker compose logs --tail 50
```

- **`nginx: [emerg] unknown directive`** — cannot happen through a successful
  build (`nginx -t` runs inside it). If you see it, the image was built
  elsewhere or by hand.
- **Permission or read-only errors from nginx** — the container runs with
  `read_only: true` and tmpfs mounts for `/var/cache/nginx`, `/var/run` and
  `/tmp`. If the base image ever needs to write somewhere else, comment out the
  `read_only:` line, restart, and open an issue noting the path it wanted. This
  is the one setting here that has not been exercised on a real daemon.
- **Port already in use** — something of the old deployment survived. Go back
  to step 2 and check `docker ps -a`, not just `docker ps`.

**Rollback** is the old image:

```bash
docker compose down
docker run -d --name icd-looker -p 8501:80 --restart unless-stopped icd-looker:rollback-YYYYMMDD
```

---

## 6 · Updating later

```bash
git pull
npm run stamp            # gates run again; no stamp, no image
docker compose up -d --build
```

Browsers pick the new build up immediately: `index.html` is served
`no-cache`, and every asset under `/assets/` is content-hashed and cached for a
year, so the new page names new files.

---

## 6b · GitHub Pages (interim public URL)

While there is no institutional host, the atlas is served from the public repo
`Hamed-kalak/germany-imaging-atlas` at
https://hamed-kalak.github.io/germany-imaging-atlas/, behind the permanent
address https://w3id.org/germany-imaging-atlas/ (perma-id/w3id.org,
`ids/germany-imaging-atlas/.htaccess`). Cite the w3id address; when the host
changes, repoint it there and nothing printed breaks. That repo holds the built
site only, never this source tree.

```bash
npm run stamp          # the three gates, as in section 0
npm run build:pages    # verify-stamp, then a build under /germany-imaging-atlas/ into dist-pages/
# copy dist-pages/ into a clone of the Pages repo (keep its README.md and .nojekyll), commit, push
```

`build:pages` passes `--base`, so `vite.config.ts` and the Docker build are
unchanged. From Git Bash, run `vite preview` with `MSYS_NO_PATHCONV=1`, or the
base path is rewritten into a Windows path.

## 7 · Two things to know before this becomes a public URL

**It must live at the root of a host or a port, not under a path.** The bundle
references `/assets/…` absolutely. Serving it at `https://server/atlas/` gives
a blank page and 404s in the console. If a subpath is unavoidable, set
`base: '/atlas/'` in `vite.config.ts`, rebuild, and keep the trailing slash.

**TLS and access control are the reverse proxy's job**, not this container's.
A minimal nginx site on the VM in front of it:

```nginx
location / {
    proxy_pass http://127.0.0.1:8501;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

And a reminder that belongs with the deployment rather than the code: the
Article's Data sharing statement needs a **publicly resolvable permanent
address**, and the Research Data Centre must be sent that same URL. An internal
hospital-network address satisfies neither. This container is the right thing
to run for internal review; it is not yet the thing the manuscript cites.
