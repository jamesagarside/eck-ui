// Package main is the entry point for the ECK UI server.
package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/jamesagarside/eck-ui/pkg/audit"
	"github.com/jamesagarside/eck-ui/pkg/config"
	"github.com/jamesagarside/eck-ui/pkg/handlers"
	"github.com/jamesagarside/eck-ui/pkg/k8s"
	eckMiddleware "github.com/jamesagarside/eck-ui/pkg/middleware"
	"github.com/jamesagarside/eck-ui/pkg/resources"
)

// Version information set at build time
var (
	Version   = "dev"
	GitCommit = "unknown"
	BuildDate = "unknown"
)

func main() {
	// Initialize logger
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	// Log version information
	slog.Info("starting ECK UI",
		"version", Version,
		"commit", GitCommit,
		"buildDate", BuildDate,
	)

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load configuration", "error", err)
		os.Exit(1)
	}

	// Initialize OpenTelemetry audit logging
	ctx := context.Background()
	auditLogger, err := audit.Initialize(ctx)
	if err != nil {
		slog.Warn("failed to initialize audit logging", "error", err)
		// Continue without audit logging - not a fatal error
	}
	defer func() {
		if auditLogger != nil {
			shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			_ = auditLogger.Shutdown(shutdownCtx)
		}
	}()

	// Initialize Kubernetes client
	k8sClient, err := k8s.NewClient()
	if err != nil {
		slog.Warn("failed to initialize kubernetes client", "error", err)
		// Continue - client will be initialized lazily when needed
	} else {
		slog.Info("kubernetes client initialized", "in_cluster", k8s.InCluster())
	}
	_ = k8sClient // Used by handlers

	// Create router
	r := chi.NewRouter()

	// Global middleware
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(eckMiddleware.SecurityHeaders)  // Security headers for all responses
	r.Use(eckMiddleware.RequestLogger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))

	// Health endpoints (no size limit needed)
	r.Get("/healthz", handlers.Healthz)
	r.Get("/readyz", handlers.Readyz)

	// API routes
	r.Route("/api", func(r chi.Router) {
		r.Use(eckMiddleware.CORS(cfg.AllowedOrigins))
		r.Use(eckMiddleware.RateLimit(cfg.RateLimit))
		r.Use(eckMiddleware.RequestSizeLimit(1 << 20)) // 1MB limit for API requests
		r.Use(eckMiddleware.InputSanitizer)            // Basic input validation

		// OpenAPI spec
		r.Get("/openapi.json", handlers.ServeOpenAPISpec)

		// API v1 routes
		r.Route("/v1", func(r chi.Router) {
			r.Use(eckMiddleware.Auth(cfg))

			// Organizations
			r.Route("/orgs", func(r chi.Router) {
				r.Get("/", handlers.ListOrganizations)
				r.Get("/{org}", handlers.GetOrganization)

				// Resources within organization
				r.Route("/{org}", func(r chi.Router) {
					r.Use(eckMiddleware.OrgAccess)

					// Register all ECK resource handlers dynamically
					if err := resources.RegisterAllRoutes(r); err != nil {
						slog.Error("failed to register resource routes", "error", err)
					}
				})
			})
		})
	})

	// Static file server for frontend (SPA fallback)
	handlers.SetupStaticServer(r)

	// Create HTTP server
	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Port),
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in goroutine
	go func() {
		slog.Info("starting server", "port", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("shutting down server...")

	// Graceful shutdown with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		slog.Error("server forced to shutdown", "error", err)
	}

	slog.Info("server stopped")
}
