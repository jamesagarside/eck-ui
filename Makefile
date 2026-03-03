# ECK UI Makefile
# Build, test, lint, and deploy targets

.PHONY: all build build-backend build-frontend test lint lint-go lint-web docker docker-build docker-push run dev clean help

# Variables
BINARY_NAME := eck-ui
IMAGE_NAME := ghcr.io/jamesagarside/eck-ui
VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
COMMIT := $(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILD_TIME := $(shell date -u +"%Y-%m-%dT%H:%M:%SZ")
LDFLAGS := -ldflags "-s -w -X main.Version=$(VERSION) -X main.Commit=$(COMMIT) -X main.BuildTime=$(BUILD_TIME)"

# Go settings
GOBIN := $(shell go env GOPATH)/bin
GOLANGCI_LINT_VERSION := v1.61.0

# Default target
all: lint test build

#
# Build targets
#

build: build-frontend build-backend ## Build frontend and backend

build-backend: ## Build Go backend binary
	@echo "==> Building backend..."
	CGO_ENABLED=0 go build $(LDFLAGS) -o bin/$(BINARY_NAME) ./cmd/server

build-frontend: ## Build React frontend
	@echo "==> Building frontend..."
	cd web && npm ci && npm run build

build-embedded: build-frontend embed-frontend build-backend ## Build with embedded frontend (single binary)

embed-frontend: ## Copy frontend build to static directory for embedding
	@echo "==> Embedding frontend assets..."
	rm -rf pkg/handlers/static/*
	cp -rf web/dist/* pkg/handlers/static/
	@echo "Frontend assets copied to pkg/handlers/static/"

#
# Test targets
#

test: test-backend test-frontend ## Run all tests

test-backend: ## Run Go backend tests
	@echo "==> Running backend tests..."
	go test -v -race -coverprofile=coverage.out ./...

test-frontend: ## Run frontend tests
	@echo "==> Running frontend tests..."
	cd web && npm test -- --run

test-e2e: ## Run end-to-end tests
	@echo "==> Running E2E tests..."
	cd web && npm run test:e2e

coverage: test-backend ## Generate test coverage report
	@echo "==> Generating coverage report..."
	go tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report generated: coverage.html"

#
# Lint targets
#

lint: lint-go lint-web ## Run all linters

lint-go: ## Run Go linter
	@echo "==> Running Go linter..."
	@if ! command -v golangci-lint &> /dev/null; then \
		echo "Installing golangci-lint..."; \
		go install github.com/golangci/golangci-lint/cmd/golangci-lint@$(GOLANGCI_LINT_VERSION); \
	fi
	golangci-lint run ./...

lint-web: ## Run frontend linters
	@echo "==> Running frontend linters..."
	cd web && npm run lint

lint-fix: ## Fix linting issues where possible
	@echo "==> Fixing lint issues..."
	golangci-lint run --fix ./...
	cd web && npm run lint:fix

fmt: ## Format code
	@echo "==> Formatting code..."
	go fmt ./...
	cd web && npm run format

#
# Docker targets
#

docker: docker-build ## Build Docker image (alias)

docker-build: ## Build Docker image
	@echo "==> Building Docker image..."
	docker build -t $(IMAGE_NAME):$(VERSION) -t $(IMAGE_NAME):latest .

docker-push: ## Push Docker image to registry
	@echo "==> Pushing Docker image..."
	docker push $(IMAGE_NAME):$(VERSION)
	docker push $(IMAGE_NAME):latest

docker-run: docker-build ## Build and run Docker container locally
	@echo "==> Running Docker container..."
	docker run --rm -p 8080:8080 \
		-e ECK_UI_PORT=8080 \
		$(IMAGE_NAME):latest

#
# Development targets
#

run: ## Run the backend server locally
	@echo "==> Running server..."
	go run ./cmd/server

dev: ## Start development servers (backend + frontend)
	@echo "==> Starting development servers..."
	@echo "Backend: http://localhost:8080"
	@echo "Frontend: http://localhost:5173"
	$(MAKE) -j2 dev-backend dev-frontend

dev-backend: ## Run backend with hot reload (requires air)
	@if ! command -v air &> /dev/null; then \
		echo "Installing air for hot reload..."; \
		go install github.com/air-verse/air@latest; \
	fi
	air

dev-frontend: ## Run frontend dev server
	cd web && npm run dev

#
# Kubernetes targets
#

deploy: ## Deploy to Kubernetes
	@echo "==> Deploying to Kubernetes..."
	kubectl apply -k deploy/kubernetes

undeploy: ## Remove from Kubernetes
	@echo "==> Removing from Kubernetes..."
	kubectl delete -k deploy/kubernetes

logs: ## View logs from deployed pod
	kubectl logs -n eck-ui -l app.kubernetes.io/name=eck-ui -f

#
# Code generation targets
#

generate: ## Run code generation
	@echo "==> Running code generation..."
	go generate ./...

openapi: ## Generate OpenAPI spec
	@echo "==> Generating OpenAPI spec..."
	@echo "OpenAPI generation not yet configured"

#
# Cleanup targets
#

clean: ## Clean build artifacts
	@echo "==> Cleaning..."
	rm -rf bin/
	rm -rf web/dist/
	rm -f coverage.out coverage.html

clean-all: clean ## Clean everything including dependencies
	@echo "==> Deep cleaning..."
	rm -rf web/node_modules/
	go clean -cache -modcache

#
# Help
#

help: ## Show this help message
	@echo "ECK UI - Available targets:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'
