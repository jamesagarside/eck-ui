package clusters

import (
	"testing"
)

func TestStaleCache_SetAndGet(t *testing.T) {
	cache := NewStaleCache()

	cache.Set("cluster-1", "/api/v1/elasticsearch", []byte(`{"items":[]}`))

	resp, ok := cache.Get("cluster-1", "/api/v1/elasticsearch")
	if !ok {
		t.Fatal("expected cache hit")
	}
	if string(resp.Data) != `{"items":[]}` {
		t.Errorf("unexpected data: %s", resp.Data)
	}
	if resp.ClusterID != "cluster-1" {
		t.Errorf("expected clusterID 'cluster-1', got %q", resp.ClusterID)
	}
	if resp.Path != "/api/v1/elasticsearch" {
		t.Errorf("expected path '/api/v1/elasticsearch', got %q", resp.Path)
	}
	if resp.CachedAt.IsZero() {
		t.Error("expected non-zero CachedAt")
	}
}

func TestStaleCache_Miss(t *testing.T) {
	cache := NewStaleCache()

	_, ok := cache.Get("nonexistent", "/foo")
	if ok {
		t.Error("expected cache miss")
	}
}

func TestStaleCache_DifferentPaths(t *testing.T) {
	cache := NewStaleCache()

	cache.Set("c1", "/path-a", []byte("a"))
	cache.Set("c1", "/path-b", []byte("b"))

	respA, ok := cache.Get("c1", "/path-a")
	if !ok || string(respA.Data) != "a" {
		t.Error("expected to get data for path-a")
	}

	respB, ok := cache.Get("c1", "/path-b")
	if !ok || string(respB.Data) != "b" {
		t.Error("expected to get data for path-b")
	}
}

func TestStaleCache_DifferentClusters(t *testing.T) {
	cache := NewStaleCache()

	cache.Set("c1", "/path", []byte("cluster-1-data"))
	cache.Set("c2", "/path", []byte("cluster-2-data"))

	resp1, ok := cache.Get("c1", "/path")
	if !ok || string(resp1.Data) != "cluster-1-data" {
		t.Error("expected cluster-1 data")
	}

	resp2, ok := cache.Get("c2", "/path")
	if !ok || string(resp2.Data) != "cluster-2-data" {
		t.Error("expected cluster-2 data")
	}
}

func TestStaleCache_ClearCluster(t *testing.T) {
	cache := NewStaleCache()

	cache.Set("c1", "/a", []byte("1"))
	cache.Set("c1", "/b", []byte("2"))
	cache.Set("c2", "/a", []byte("3"))

	cache.ClearCluster("c1")

	if _, ok := cache.Get("c1", "/a"); ok {
		t.Error("expected c1/a to be cleared")
	}
	if _, ok := cache.Get("c1", "/b"); ok {
		t.Error("expected c1/b to be cleared")
	}
	if _, ok := cache.Get("c2", "/a"); !ok {
		t.Error("expected c2/a to remain")
	}
}

func TestStaleCache_Overwrite(t *testing.T) {
	cache := NewStaleCache()

	cache.Set("c1", "/path", []byte("old"))
	cache.Set("c1", "/path", []byte("new"))

	resp, ok := cache.Get("c1", "/path")
	if !ok || string(resp.Data) != "new" {
		t.Error("expected overwritten data")
	}
}
