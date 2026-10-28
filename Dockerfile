# Imaging Atlas — inpatient CT and MRI across 624 diagnoses in Germany
#
# Two stages: node builds the static site, nginx serves it. Nothing in the
# running container executes application code — it is HTML, JS and one large
# JSON file behind a web server.
#
#   docker build -t imaging-atlas:1.1.0 .
#
# The build REFUSES to proceed unless public/build.json matches the data file
# byte for byte. That stamp is written by `npm run stamp`, which only writes it
# after the parity, integrity and render gates pass in the repository. The two
# data gates read the Article's appendix tables from research/, which is not in
# this build context and must not be — so the stamp is how the manuscript's
# verdict travels into an image that cannot see the manuscript.

# BASE IMAGES ARE OVERRIDABLE. A server that cannot reach Docker Hub can only
# use what it already has cached, and a pinned tag it has never seen fails with
# "failed to load metadata for ...". Point these at whatever `docker images`
# shows, or at an internal mirror:
#
#   NGINX_IMAGE=nginx:alpine NODE_IMAGE=node:20-alpine docker compose up -d --build
#
# If there is no usable node image at all, use Dockerfile.prebuilt instead: it
# needs nginx only, and the site is built before it reaches the server.
ARG NODE_IMAGE=node:22-alpine
ARG NGINX_IMAGE=nginx:1.27-alpine

# ---------------------------------------------------------------- build stage
# Node 22 by default: Vite 7 requires 20.19+ or 22.12+, and `node:20-alpine`
# resolves to whatever 20.x is current — which may be older than 20.19. The
# build checks the version it actually got rather than trusting the tag.
FROM ${NODE_IMAGE} AS build
WORKDIR /app

# Fail here, with a sentence, rather than three minutes later inside a bundler
# stack trace. `node:20-alpine` resolves to whatever 20.x is current, which can
# be older than the 20.19 Vite 7 requires.
RUN node -e "const v=process.versions.node.split('.').map(Number); if (v[0]<20 || (v[0]===20 && v[1]<19) || v[0]===21) { console.error('Node '+process.versions.node+' is too old for Vite 7, which needs 20.19+ or 22.12+. Pass NODE_IMAGE=node:22-alpine, or use Dockerfile.prebuilt, which needs no node at all.'); process.exit(1); }"

# Dependencies first, so a source-only change does not re-resolve the tree.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# 1 · the data must be the data the gates passed on
RUN node scripts/verify-stamp.mjs

# 2 · typecheck and bundle (package.json build = tsc && vite build)
RUN npm run build

# 3 · pre-compress. The dataset is 18 MB and compresses to about 3.5 MB.
#     Compressing it once here, rather than on every request, is the difference
#     between a second of server CPU per visitor and none. nginx serves these
#     .gz files directly via gzip_static.
RUN find dist -type f \( -name '*.js' -o -name '*.css' -o -name '*.json' \
      -o -name '*.html' -o -name '*.svg' \) -size +1k \
      -exec gzip -9 -k {} \; \
    && echo "pre-compressed: $(find dist -name '*.gz' | wc -l) files"

# ---------------------------------------------------------------- serve stage
FROM ${NGINX_IMAGE} AS serve

# The stock default site would otherwise shadow ours.
RUN rm -f /etc/nginx/conf.d/default.conf

COPY nginx.conf /etc/nginx/conf.d/atlas.conf
COPY nginx-security-headers.conf /etc/nginx/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html

# Fail HERE, not on the server at three in the morning. `nginx -t` parses the
# whole configuration, so an unsupported directive (gzip_static, say, if the
# base image ever drops the module) breaks the build instead of putting the
# container into a restart loop.
RUN nginx -t

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
