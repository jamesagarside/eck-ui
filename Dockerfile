# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/web

# Copy package files
COPY web/package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY web/ ./

# Build frontend
RUN npm run build

# Stage 2: Build backend
FROM golang:1.23-alpine AS backend-builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git ca-certificates

# Copy go modules files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY cmd/ ./cmd/
COPY pkg/ ./pkg/

# Copy frontend build to static directory for embedding
COPY --from=frontend-builder /app/web/dist ./pkg/handlers/static/

# Build the binary
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-w -s" \
    -o /app/eck-ui \
    ./cmd/server

# Stage 3: Final image
FROM alpine:3.19

WORKDIR /app

# Install ca-certificates for HTTPS
RUN apk --no-cache add ca-certificates tzdata

# Create non-root user
RUN addgroup -g 1000 eck-ui && \
    adduser -u 1000 -G eck-ui -s /bin/sh -D eck-ui

# Copy binary from builder
COPY --from=backend-builder /app/eck-ui /app/eck-ui

# Set ownership
RUN chown -R eck-ui:eck-ui /app

# Switch to non-root user
USER eck-ui

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/healthz || exit 1

# Run the binary
ENTRYPOINT ["/app/eck-ui"]
