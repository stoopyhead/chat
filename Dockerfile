# Optional: containerized version of the local demo.
# No credentials, kubeconfig, or secrets are needed or read at build/run time —
# the app only serves mock data.

FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src

ENV PORT=3978
EXPOSE 3978

CMD ["node", "src/server.js"]
