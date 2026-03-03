// Package k8s provides Kubernetes client initialization and utilities.
package k8s

import (
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"sync"

	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

// Client wraps Kubernetes client interfaces.
type Client struct {
	// Clientset provides typed access to Kubernetes resources.
	Clientset kubernetes.Interface
	// Dynamic provides untyped access to arbitrary Kubernetes resources (CRDs).
	Dynamic dynamic.Interface
	// Config is the underlying REST config.
	Config *rest.Config
}

var (
	instance *Client
	once     sync.Once
	initErr  error
)

// NewClient creates a new Kubernetes client.
// It tries in-cluster config first, then falls back to kubeconfig.
func NewClient() (*Client, error) {
	once.Do(func() {
		instance, initErr = initClient()
	})
	return instance, initErr
}

// GetClient returns the singleton client instance.
// Panics if client was not initialized.
func GetClient() *Client {
	if instance == nil {
		panic("k8s client not initialized - call NewClient() first")
	}
	return instance
}

func initClient() (*Client, error) {
	config, err := getConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to get kubernetes config: %w", err)
	}

	// Create typed clientset
	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create kubernetes clientset: %w", err)
	}

	// Create dynamic client for CRDs
	dynamicClient, err := dynamic.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create dynamic client: %w", err)
	}

	slog.Info("initialized kubernetes client")

	return &Client{
		Clientset: clientset,
		Dynamic:   dynamicClient,
		Config:    config,
	}, nil
}

func getConfig() (*rest.Config, error) {
	// Try in-cluster config first
	config, err := rest.InClusterConfig()
	if err == nil {
		slog.Info("using in-cluster kubernetes config")
		return config, nil
	}

	slog.Debug("in-cluster config failed, trying kubeconfig", "error", err)

	// Fall back to kubeconfig
	kubeconfig := os.Getenv("KUBECONFIG")
	if kubeconfig == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return nil, fmt.Errorf("failed to get home directory: %w", err)
		}
		kubeconfig = filepath.Join(home, ".kube", "config")
	}

	config, err = clientcmd.BuildConfigFromFlags("", kubeconfig)
	if err != nil {
		return nil, fmt.Errorf("failed to build config from kubeconfig: %w", err)
	}

	slog.Info("using kubeconfig", "path", kubeconfig)
	return config, nil
}

// InCluster returns true if running inside a Kubernetes cluster.
func InCluster() bool {
	_, err := rest.InClusterConfig()
	return err == nil
}
