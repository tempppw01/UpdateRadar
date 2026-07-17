FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json ./
COPY src ./src
COPY public ./public
COPY data/sources.json ./data/sources.json

EXPOSE 8787

CMD ["node", "src/server.js"]
