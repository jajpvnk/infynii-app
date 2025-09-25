FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS build
COPY . /usr/src/app
WORKDIR /usr/src/app
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run -r build
RUN pnpm --legacy --filter=infynii-hono-api --prod deploy /prod/hono-api

FROM base AS hono-api
COPY --from=build /prod/hono-api /prod/hono-api
WORKDIR /prod/hono-api
EXPOSE 8787
CMD [ "pnpm", "dev" ]