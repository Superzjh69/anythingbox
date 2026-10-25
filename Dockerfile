# ── 构建阶段 ──────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── 运行阶段 ──────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATA_DIR=/app/.data

RUN addgroup -S anythingbox && adduser -S anythingbox -G anythingbox

COPY --from=builder /app/package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./

RUN mkdir -p /app/.data && chown -R anythingbox:anythingbox /app/.data
USER anythingbox

EXPOSE 3000
VOLUME ["/app/.data"]

CMD ["npm", "run", "start"]
