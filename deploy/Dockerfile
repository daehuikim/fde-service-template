FROM node:22.17.1-alpine AS build
WORKDIR /app
RUN npm install -g pnpm@11.25.0
COPY . .
RUN pnpm install --frozen-lockfile && pnpm build
FROM node:22.17.1-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 APP_MODE=live
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
