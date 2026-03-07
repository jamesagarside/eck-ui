package main

import (
	"context"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gorilla/mux"
	"github.com/jamesagarside/eck-ui/pkg/audit"
	"github.com/jamesagarside/eck-ui/pkg/auth"
	"github.com/jamesagarside/eck-ui/pkg/config"
	"github.com/jamesagarside/eck-ui/pkg/errors"
	"github.com/jamesagarside/eck-ui/pkg/handlers"
	"github.com/jamesagarside/eck-ui/pkg/handlers/static"
	"github.com/jamesagarside/eck-ui/pkg/k8s"
	"github.com/jamesagarside/eck-ui/pkg/middleware"
	"github.com/jamesagarside/eck-ui/pkg/organization"
	"github.com/jamesagarside/eck-ui/pkg/resources"
)

// staticFiles returns the embedded frontend assets or a fallback for development.
func staticFS() fs.FS {
	return static.FS()
}

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load configuration", "error", err)
		os.Exit(1)
	}

	// Configure structured logging
	logLevel := new(slog.LevelVar)
	switch cfg.LogLevel {
	case "debug":
		logLevel.Set(slog.LevelDebug)
	case "warn":
		logLevel.Set(slog.LevelWarn)
	case "error":
		logLevel.Set(slog.LevelError)
	default:
		logLevel.Set(slog.LevelInfo)
	}
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: logLevel}))
	slog.SetDefault(logger)

	// Initialize Kubernetes client
	k8sClient, err := k8s.NewClient(cfg.KubeConfig)
	if err != nil {
		slog.Error("failed to initialize kubernetes client", "error", err)
		os.Exit(1)
	}

	// Initialize audit logger
	auditLogger, err := audit.NewLogger(cfg.OTelEndpoint)
	if err != nil {
		slog.Error("failed to initialize audit logger", "error", err)
		os.Exit(1)
	}

	// Initialize auth service
	authService := auth.NewService(k8sClient, cfg.SessionSecret, cfg.TokenCacheTTL)

	// Initialize organization store
	orgStore := organization.NewStore()
	if err := orgStore.LoadFromConfigMaps(context.Background(), k8sClient.Clientset, "default"); err != nil {
		slog.Warn("failed to load organizations from configmaps", "error", err)
	}

	// Initialize CRD registry for dynamic resource discovery
	crdRegistry := k8s.NewCRDRegistry(k8sClient)

	// Install the CRD registry for GVR and type info resolution
	k8s.SetDefaultRegistry(crdRegistry)
	resources.SetCRDRegistry(crdRegistry)

	// Initialize resource handler
	resourceHandler := resources.NewHandler(k8sClient)

	// Set up router
	r := mux.NewRouter()

	// Health endpoints (unauthenticated)
	r.HandleFunc("/healthz", handlers.HealthzHandler).Methods("GET")
	r.HandleFunc("/readyz", handlers.ReadyzHandler(k8sClient)).Methods("GET")

	// Auth endpoints
	r.HandleFunc("/api/v1/auth/login", handlers.LoginHandler(authService, orgStore)).Methods("POST")
	r.HandleFunc("/api/v1/auth/session", handlers.LogoutHandler(authService)).Methods("DELETE")
	r.HandleFunc("/api/v1/auth/session", handlers.SessionHandler(authService, orgStore)).Methods("GET")

	// OpenAPI spec
	r.HandleFunc("/api/v1/openapi.yaml", handlers.OpenAPIYAMLHandler).Methods("GET")
	r.HandleFunc("/api/v1/openapi.json", handlers.OpenAPIJSONHandler).Methods("GET")

	// API routes (authenticated)
	api := r.PathPrefix("/api/v1").Subrouter()
	api.Use(middleware.Auth(authService))
	api.Use(middleware.RBAC())
	api.Use(audit.Middleware(auditLogger, cfg.AuditReadRequests))

	// Versions endpoints: list, update, and sync from Elastic artifacts API.
	// The versions ConfigMap lives in the same namespace as the eck-ui deployment.
	versionsNS := os.Getenv("POD_NAMESPACE")
	if versionsNS == "" {
		versionsNS = "default"
	}
	api.HandleFunc("/versions", handlers.VersionsHandler(k8sClient, versionsNS)).Methods("GET")
	api.HandleFunc("/versions", handlers.VersionsUpdateHandler(k8sClient, versionsNS)).Methods("PUT")
	api.HandleFunc("/versions/sync", handlers.VersionsSyncHandler(k8sClient, versionsNS)).Methods("POST")

	// Resource types discovery endpoint
	api.HandleFunc("/resource-types", handlers.ResourceTypesHandler(crdRegistry)).Methods("GET")

	// Deployment intent endpoints (backend-assembled K8s resources)
	api.HandleFunc("/deployments/{namespace}", handlers.DeploymentCreateHandler(k8sClient, crdRegistry)).Methods("POST")
	api.HandleFunc("/deployments/{namespace}/{name}", handlers.DeploymentUpdateHandler(k8sClient, crdRegistry)).Methods("PUT")
	api.HandleFunc("/deployments/{namespace}/{name}", handlers.DeploymentDeleteHandler(k8sClient, crdRegistry)).Methods("DELETE")

	// Resource CRUD endpoints for all ECK resource types
	resourceTypes := []string{
		"elasticsearch", "kibana", "apmserver", "beat", "agent",
		"logstash", "enterprisesearch", "elasticmapsserver",
		"elasticsearchautoscaler", "stackconfigpolicy",
	}
	for _, rt := range resourceTypes {
		api.HandleFunc("/"+rt, resourceHandler.List(rt)).Methods("GET")
		api.HandleFunc("/"+rt+"/{namespace}/{name}", resourceHandler.Get(rt)).Methods("GET")
		api.HandleFunc("/"+rt+"/{namespace}", resourceHandler.Create(rt)).Methods("POST")
		api.HandleFunc("/"+rt+"/{namespace}/{name}", resourceHandler.Update(rt)).Methods("PUT")
		api.HandleFunc("/"+rt+"/{namespace}/{name}", resourceHandler.Delete(rt)).Methods("DELETE")
	}

	// Events and watch endpoints
	api.HandleFunc("/events/{namespace}", resourceHandler.Events()).Methods("GET")
	api.HandleFunc("/watch/{type}", resourceHandler.Watch()).Methods("GET")

	// SPA static file serving with fallback to index.html
	spaHandler := handlers.NewSPAHandler(staticFS(), "")
	r.PathPrefix("/").Handler(spaHandler)

	// Global middleware
	handler := middleware.RequestID(
		middleware.Logger(
			middleware.Recovery(
				middleware.CORS(r),
			),
		),
	)

	srv := &http.Server{
		Addr:         cfg.ListenAddr,
		Handler:      handler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Graceful shutdown
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh

		slog.Info("shutting down server")
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		if err := srv.Shutdown(ctx); err != nil {
			slog.Error("server shutdown error", "error", err)
		}

		if err := auditLogger.Shutdown(ctx); err != nil {
			slog.Error("audit logger shutdown error", "error", err)
		}
	}()

	slog.Info("starting eck-ui server", "addr", cfg.ListenAddr)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		slog.Error("server error", "error", err)
		os.Exit(1)
	}

	_ = errors.ErrNotFound // ensure errors package is used
}
