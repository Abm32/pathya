# PharmCAT image (java + python + preprocessor + reference data) with Node 22 on top. Single container, no docker-in-docker.
FROM pgkb/pharmcat:latest AS base
USER root
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates poppler-utils \
 && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs \
 && npm i -g pnpm@9 && rm -rf /var/lib/apt/lists/*

FROM base AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM base AS run
WORKDIR /app
ENV NODE_ENV=production PHARMCAT_RUNNER=local PHARMCAT_HOME=/pharmcat DATA_DIR=/data PORT=3000
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/fixtures ./fixtures
VOLUME ["/data"]
EXPOSE 3000
CMD ["node", "server.js"]
