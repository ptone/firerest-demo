FROM node:lts-alpine AS builder

# install dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --dev
COPY . .
RUN npm run build

FROM gcr.io/ptone-misc/sparge
COPY --from=builder /app/public/ /public
