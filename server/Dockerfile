FROM node:22-slim

RUN apt-get update && apt-get install -y openssl ca-certificates

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install
RUN npx prisma generate

COPY . .

EXPOSE 3001
CMD ["node", "server.js"]