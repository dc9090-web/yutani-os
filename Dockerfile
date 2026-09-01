# EVE app image. One image serves the web app (`npm run start`) and the worker (`npm run worker`).
FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# The VM has ~3.3 GB RAM: cap the build heap so `next build` doesn't get OOM-killed.
RUN NODE_OPTIONS=--max-old-space-size=2048 npm run build
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "run", "start"]
