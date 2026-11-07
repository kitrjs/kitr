# kitr.dev: build the monorepo's packages and the site, then serve the static output with nginx.
# Build context is the repo root:  docker build -f site/Dockerfile .
FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build && pnpm -C site build

FROM nginx:1.27-alpine
COPY site/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/site/dist/client /usr/share/nginx/html
EXPOSE 80
