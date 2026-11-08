# kitr.dev: build the monorepo's packages and the site, then serve the static output with nginx.
# Build context is the repo root:  docker build -f site/Dockerfile .
FROM node:22-alpine AS build
WORKDIR /repo
# No TTY in a build: pnpm must not stop to ask before replacing node_modules.
ENV CI=true
RUN corepack enable
# Fetch the store from the lockfile alone, so this layer is reused until the lockfile changes
# and a source-only commit does not re-download every dependency. The root package.json
# comes too: it pins pnpm (packageManager) and holds pnpm.overrides, which the lockfile records.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm fetch
COPY . .
RUN pnpm install --offline --frozen-lockfile
RUN pnpm build && pnpm -C site build

FROM nginx:1.27-alpine
COPY site/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/site/dist/client /usr/share/nginx/html
EXPOSE 80
