package clusters

import (
	"context"

	"k8s.io/client-go/dynamic"
)

type contextKey string

const (
	clusterClientKey contextKey = "clusterClient"
	clusterIDKey     contextKey = "clusterID"
	staleDataKey     contextKey = "staleData"
)

// WithClient injects a dynamic client into the request context.
func WithClient(ctx context.Context, client dynamic.Interface) context.Context {
	return context.WithValue(ctx, clusterClientKey, client)
}

// ClientFromContext retrieves the injected cluster client from context.
func ClientFromContext(ctx context.Context) (dynamic.Interface, bool) {
	client, ok := ctx.Value(clusterClientKey).(dynamic.Interface)
	return client, ok
}

// WithClusterID injects the cluster ID into the request context.
func WithClusterID(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, clusterIDKey, id)
}

// ClusterIDFromContext retrieves the cluster ID from context.
func ClusterIDFromContext(ctx context.Context) string {
	id, _ := ctx.Value(clusterIDKey).(string)
	return id
}

// StaleInfo holds information about stale data being served.
type StaleInfo struct {
	IsStale    bool
	StaleSince string
}

// WithStaleInfo injects stale data info into the request context.
func WithStaleInfo(ctx context.Context, info *StaleInfo) context.Context {
	return context.WithValue(ctx, staleDataKey, info)
}

// StaleInfoFromContext retrieves stale data info from context.
func StaleInfoFromContext(ctx context.Context) *StaleInfo {
	info, _ := ctx.Value(staleDataKey).(*StaleInfo)
	return info
}
