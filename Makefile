.PHONY: build dev test lint docker-build clean generate web-build web-dev go-dev help

APP_NAME := eck-ui
VERSION := $(shell cat VERSION 2>/dev/null || echo "0.0.0")
DOCKER_TAG := $(APP_NAME):$(VERSION)

## help: Print this help message
help:
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@sed -n 's/^## //p' $(MAKEFILE_LIST) | column -t -s ':'

## build: Build the Go binary
build: web-build
	go build -ldflags="-s -w -X main.version=$(VERSION)" -o bin/$(APP_NAME) ./cmd/server

## dev: Run frontend and backend dev servers concurrently
dev:
	@echo "Starting backend and frontend dev servers..."
	@trap 'kill 0' EXIT; \
		$(MAKE) go-dev & \
		$(MAKE) web-dev & \
		wait

## test: Run all tests (Go and frontend)
test:
	go test -race -cover ./...
	cd web && npm test -- --run

## lint: Run linters for Go and frontend
lint:
	golangci-lint run ./...
	cd web && npm run lint

## docker-build: Build Docker image
docker-build:
	docker build -t $(DOCKER_TAG) -t $(APP_NAME):latest .

## clean: Remove build artifacts
clean:
	rm -rf bin/
	rm -rf web/dist
	rm -rf coverage/

## generate: Generate code from OpenAPI spec (placeholder)
generate:
	@echo "OpenAPI code generation - configure as needed"
	@echo "Example: oapi-codegen -package api api/openapi.yaml > pkg/api/generated.go"

## web-build: Build frontend assets
web-build:
	cd web && npm run build

## web-dev: Start frontend dev server
web-dev:
	cd web && npm run dev

## go-dev: Start Go backend server
go-dev:
	go run ./cmd/server
