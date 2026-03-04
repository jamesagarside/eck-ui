# Stage 1: Build frontend
FROM node:20-alpine AS web-build

WORKDIR /app/web

COPY web/package.json web/package-lock.json ./
RUN npm ci --legacy-peer-deps

COPY web/ ./
RUN npm run build

# Stage 2: Build backend
FROM golang:1.23-alpine AS go-build

RUN apk add --no-cache git ca-certificates

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
COPY --from=web-build /app/web/dist ./pkg/handlers/static/dist

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /eck-ui ./cmd/server

# Stage 3: Runtime
FROM gcr.io/distroless/static-debian12

COPY --from=go-build /eck-ui /eck-ui

EXPOSE 8080

ENTRYPOINT ["/eck-ui"]
