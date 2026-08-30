# Place this file at the root of the Encrypz repo (next to Encrypz.slnx)
# Build:  docker build -f Encrypz.UI.Dockerfile --build-arg VITE_API_URL=https://api.yourdomain.com/api -t encrypz-ui .

FROM node:20-alpine AS build
WORKDIR /app

COPY Encrypz.UI/package.json Encrypz.UI/package-lock.json ./
RUN npm ci

COPY Encrypz.UI/ ./

ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

FROM nginx:alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.frontend.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
