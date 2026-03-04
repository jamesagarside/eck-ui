package audit

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"go.opentelemetry.io/otel/log"
	sdklog "go.opentelemetry.io/otel/sdk/log"
	"go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploggrpc"
)

// LogEntry represents a single audit log record capturing a user action.
type LogEntry struct {
	Timestamp    time.Time `json:"timestamp"`
	User         string    `json:"user"`
	UserGroups   []string  `json:"userGroups,omitempty"`
	Action       string    `json:"action"`
	ResourceType string    `json:"resourceType"`
	Namespace    string    `json:"namespace"`
	Name         string    `json:"name"`
	StatusCode   int       `json:"statusCode"`
	RequestID    string    `json:"requestId"`
	SourceIP     string    `json:"sourceIp"`
	UserAgent    string    `json:"userAgent"`
	Changes      []byte    `json:"changes,omitempty"`
}

// Logger sends audit log entries to an OpenTelemetry collector or stdout.
type Logger struct {
	provider *sdklog.LoggerProvider
	logger   log.Logger
	useStdout bool
}

// NewLogger creates an audit Logger. If endpoint is non-empty, it configures
// an OTLP gRPC exporter to send logs to the given collector. Otherwise, it
// falls back to structured stdout logging via slog.
func NewLogger(endpoint string) (*Logger, error) {
	if endpoint == "" {
		return &Logger{useStdout: true}, nil
	}

	ctx := context.Background()
	exporter, err := otlploggrpc.New(ctx,
		otlploggrpc.WithEndpoint(endpoint),
		otlploggrpc.WithInsecure(),
	)
	if err != nil {
		return nil, fmt.Errorf("creating OTLP log exporter: %w", err)
	}

	provider := sdklog.NewLoggerProvider(
		sdklog.WithProcessor(sdklog.NewBatchProcessor(exporter)),
	)

	logger := provider.Logger("eck-ui-audit")

	return &Logger{
		provider: provider,
		logger:   logger,
	}, nil
}

// Emit sends an audit log entry. When using OTLP, the entry is serialized
// as an OpenTelemetry log record. When using stdout, it is emitted via slog.
func (l *Logger) Emit(entry LogEntry) {
	if entry.Timestamp.IsZero() {
		entry.Timestamp = time.Now()
	}

	if l.useStdout {
		slog.Info("audit",
			"user", entry.User,
			"action", entry.Action,
			"resourceType", entry.ResourceType,
			"namespace", entry.Namespace,
			"name", entry.Name,
			"statusCode", entry.StatusCode,
			"requestId", entry.RequestID,
			"sourceIp", entry.SourceIP,
		)
		return
	}

	record := log.Record{}
	record.SetTimestamp(entry.Timestamp)
	record.SetSeverity(log.SeverityInfo)
	record.SetBody(log.StringValue(fmt.Sprintf("%s %s/%s/%s", entry.Action, entry.ResourceType, entry.Namespace, entry.Name)))
	record.AddAttributes(
		log.String("audit.user", entry.User),
		log.String("audit.action", entry.Action),
		log.String("audit.resourceType", entry.ResourceType),
		log.String("audit.namespace", entry.Namespace),
		log.String("audit.name", entry.Name),
		log.Int("audit.statusCode", entry.StatusCode),
		log.String("audit.requestId", entry.RequestID),
		log.String("audit.sourceIp", entry.SourceIP),
		log.String("audit.userAgent", entry.UserAgent),
	)

	l.logger.Emit(context.Background(), record)
}

// Shutdown flushes pending log records and shuts down the logger provider.
// It should be called during application shutdown.
func (l *Logger) Shutdown(ctx context.Context) error {
	if l.provider == nil {
		return nil
	}
	return l.provider.Shutdown(ctx)
}
