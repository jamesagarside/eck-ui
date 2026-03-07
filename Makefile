.PHONY: build dev test lint docker-build clean generate web-build web-dev go-dev deploy serve help

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

HELM_RELEASE := eck-ui
HELM_NAMESPACE := default

## deploy: Build image and redeploy to local Kubernetes
deploy: docker-build
	helm upgrade --install $(HELM_RELEASE) deploy/helm/eck-ui \
		--namespace $(HELM_NAMESPACE) \
		--reset-then-reuse-values \
		--set image.repository=$(APP_NAME) \
		--set image.tag=latest \
		--set image.pullPolicy=Never \
		--set config.sessionSecret=$${SESSION_SECRET:-dev-secret-do-not-use-in-prod} \
		--set ingress.enabled=true
	kubectl rollout restart deployment/$(HELM_RELEASE) -n $(HELM_NAMESPACE)
	kubectl rollout status deployment/$(HELM_RELEASE) -n $(HELM_NAMESPACE) --timeout=120s

## serve: Deploy and port-forward to localhost:8090 (for Docker Desktop)
serve: deploy
	@echo ""
	@echo "eck-ui available at http://localhost:8090"
	@echo "Press Ctrl+C to stop"
	kubectl port-forward svc/$(HELM_RELEASE) 8090:8080 -n $(HELM_NAMESPACE)

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

## token: Generate a 2h admin login token for the UI
token:
	kubectl create token eck-ui-admin -n $(HELM_NAMESPACE) --duration=2h