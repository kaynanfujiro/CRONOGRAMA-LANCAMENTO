# ---------- 1) build do site (web/dist) ----------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci

COPY shared shared
COPY server server
COPY web web
RUN npm run build

# ---------- 2) imagem final: API + site na mesma porta ----------
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci --omit=dev && npm cache clean --force

COPY shared shared
COPY server/src server/src
COPY server/tsconfig.json server/
COPY --from=build /app/web/dist web/dist

# modelo de lead time salvo pela tela (monte um volume aqui)
RUN mkdir -p server/data
VOLUME ["/app/server/data"]

EXPOSE 3001
CMD ["npm", "start"]
