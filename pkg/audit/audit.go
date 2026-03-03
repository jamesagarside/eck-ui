// Package audit provides OpenTelemetry-based audit logging for the ECK UI.
package audit

import (
	"context"
	"log/slog"
	"os"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/exporters/stdout/stdouttrace"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
	"go.opentelemetry.io/otel/trace"
)

const (
	// ServiceName is the name of the service for telemetry.
	ServiceName = "eck-ui"
	// ServiceVersion is the version of the service.
	ServiceVersion = "0.1.0"
)

// EventType represents the type of audit event.
type EventType string

const (
	EventTypeCreate EventType = "create"
	EventTypeRead   EventType = "read"
	EventTypeUpdate EventType = "update"
	EventTypeDelete EventType = "delete"
	EventTypeList   EventType = "list"
	EventTypeLogin  EventType = "login"
	EventTypeLogout EventType = "logout"
)

// Logger provides audit logging functionality.
type Logger struct {
	tracer   trace.Tracer
	provider *sdktrace.TracerProvider
}

var defaultLogger *Logger

// Initialize sets up OpenTelemetry tracing for audit logging.
func Initialize(ctx context.Context) (*Logger, error) {
	// Create resource with service information
	res, err := resource.Merge(
		resource.Default(),
		resource.NewWithAttributes(
			semconv.SchemaURL,
			semconv.ServiceName(ServiceName),
			semconv.ServiceVersion(ServiceVersion),
		),
	)
	if err != nil {
		return nil, err
	}

	// Create exporter based on configuration
	var exporter sdktrace.SpanExporter

	otlpEndpoint := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
	if otlpEndpoint != "" {
		// Use OTLP gRPC exporter for production
		exporter, err = otlptracegrpc.New(ctx,
			otlptracegrpc.WithInsecure(),
			otlptracegrpc.WithEndpoint(otlpEndpoint),
		)
		if err != nil {
			slog.Warn("failed to create OTLP exporter, falling back to stdout", "error", err)
		}
	}

	// Fall back to stdout exporter for development
	if exporter == nil {
		exporter, err = stdouttrace.New(
			stdouttrace.WithPrettyPrint(),
		)
		if err != nil {
			return nil, err
		}
	}

	// Create trace provider
	provider := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(res),
		sdktrace.WithSampler(sdktrace.AlwaysSample()),
	)

	// Set global trace provider
	otel.SetTracerProvider(provider)

	logger := &Logger{
		tracer:   provider.Tracer(ServiceName),
		provider: provider,
	}

	defaultLogger = logger
	slog.Info("initialized audit logging with OpenTelemetry")

	return logger, nil
}

// Shutdown gracefully shuts down the audit logger.
func (l *Logger) Shutdown(ctx context.Context) error {
	return l.provider.Shutdown(ctx)
}

// Event represents an audit event.
type Event struct {
	// Type is the type of action performed.
	Type EventType
	// User is the identity of the user performing the action.
	User string
	// Organization is the organization context.
	Organization string
	// ResourceType is the type of resource being acted upon.
	ResourceType string
	// ResourceName is the name of the resource.
	ResourceName string
	// Namespace is the Kubernetes namespace.
	Namespace string
	// RequestID is the correlation ID for the request.
	RequestID string
	// Success indicates whether the operation succeeded.
	Success bool
	// ErrorMessage contains error details if the operation failed.
	ErrorMessage string
	// Metadata contains additional context.
	Metadata map[string]string
}

// Log records an audit event.
func (l *Logger) Log(ctx context.Context, event Event) {
	_, span := l.tracer.Start(ctx, "audit."+string(event.Type),
		trace.WithAttributes(
			attribute.String("audit.type", string(event.Type)),
			attribute.String("audit.user", event.User),
			attribute.String("audit.organization", event.Organization),
			attribute.String("audit.resource_type", event.ResourceType),
			attribute.String("audit.resource_name", event.ResourceName),
			attribute.String("audit.namespace", event.Namespace),
			attribute.String("audit.request_id", event.RequestID),
			attribute.Bool("audit.success", event.Success),
			attribute.String("audit.error", event.ErrorMessage),
			attribute.String("audit.timestamp", time.Now().UTC().Format(time.RFC3339)),
		),
	)
	defer span.End()

	// Add metadata as attributes
	for k, v := range event.Metadata {
		span.SetAttributes(attribute.String("audit.metadata."+k, v))
	}

	// Also log to slog for local visibility
	logAttrs := []any{
		"type", event.Type,
		"user", event.User,
		"org", event.Organization,
		"resource_type", event.ResourceType,
		"resource_name", event.ResourceName,
		"namespace", event.Namespace,
		"request_id", event.RequestID,
		"success", event.Success,
	}
	if event.ErrorMessage != "" {
		logAttrs = append(logAttrs, "error", event.ErrorMessage)
	}

	slog.Info("audit", logAttrs...)
}

// Log records an audit event using the default logger.
func Log(ctx context.Context, event Event) {
	if defaultLogger == nil {
		// Fall back to slog if not initialized
		slog.Info("audit (otel not initialized)",
			"type", event.Type,
			"user", event.User,
			"org", event.Organization,
			"resource_type", event.ResourceType,
			"resource_name", event.ResourceName,
		)
		return
	}
	defaultLogger.Log(ctx, event)
}

// LogCreate records a resource creation audit event.
func LogCreate(ctx context.Context, user, org, resourceType, resourceName, namespace, requestID string, success bool, errMsg string) {
	Log(ctx, Event{
		Type:         EventTypeCreate,
		User:         user,
		Organization: org,
		ResourceType: resourceType,
		ResourceName: resourceName,
		Namespace:    namespace,
		RequestID:    requestID,
		Success:      success,
		ErrorMessage: errMsg,
	})
}

// LogRead records a resource read audit event.
func LogRead(ctx context.Context, user, org, resourceType, resourceName, namespace, requestID string, success bool, errMsg string) {
	Log(ctx, Event{
		Type:         EventTypeRead,
		User:         user,
		Organization: org,
		ResourceType: resourceType,
		ResourceName: resourceName,
		Namespace:    namespace,
		RequestID:    requestID,
		Success:      success,
		ErrorMessage: errMsg,
	})
}

// LogUpdate records a resource update audit event.
func LogUpdate(ctx context.Context, user, org, resourceType, resourceName, namespace, requestID string, success bool, errMsg string) {
	Log(ctx, Event{
		Type:         EventTypeUpdate,
		User:         user,
		Organization: org,
		ResourceType: resourceType,
		ResourceName: resourceName,
		Namespace:    namespace,
		RequestID:    requestID,
		Success:      success,
		ErrorMessage: errMsg,
	})
}

// LogDelete records a resource deletion audit event.
func LogDelete(ctx context.Context, user, org, resourceType, resourceName, namespace, requestID string, success bool, errMsg string) {
	Log(ctx, Event{
		Type:         EventTypeDelete,
		User:         user,
		Organization: org,
		ResourceType: resourceType,
		ResourceName: resourceName,
		Namespace:    namespace,
		RequestID:    requestID,
		Success:      success,
		ErrorMessage: errMsg,
	})
}

// LogList records a resource list audit event.
func LogList(ctx context.Context, user, org, resourceType, namespace, requestID string, success bool, errMsg string) {
	Log(ctx, Event{
		Type:         EventTypeList,
		User:         user,
		Organization: org,
		ResourceType: resourceType,
		Namespace:    namespace,
		RequestID:    requestID,
		Success:      success,
		ErrorMessage: errMsg,
	})
}

// LogLogin records a login audit event.
func LogLogin(ctx context.Context, user, requestID string, success bool, errMsg string) {
	Log(ctx, Event{
		Type:         EventTypeLogin,
		User:         user,
		RequestID:    requestID,
		Success:      success,
		ErrorMessage: errMsg,
	})
}

// LogLogout records a logout audit event.
func LogLogout(ctx context.Context, user, requestID string) {
	Log(ctx, Event{
		Type:      EventTypeLogout,
		User:      user,
		RequestID: requestID,
		Success:   true,
	})
}

// GetDefault returns the default audit logger.
func GetDefault() *Logger {
	return defaultLogger
}
