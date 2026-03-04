package k8s

import (
	"context"
	"fmt"
	"time"

	"k8s.io/client-go/discovery"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

// Client wraps the Kubernetes API clients needed by the application.
type Client struct {
	// Clientset provides typed access to the Kubernetes API.
	Clientset kubernetes.Interface

	// Dynamic provides unstructured access to any Kubernetes resource.
	Dynamic dynamic.Interface

	// Discovery provides API discovery and server version information.
	Discovery discovery.DiscoveryInterface
}

// NewClient creates a new Client by first attempting in-cluster configuration
// and falling back to the kubeconfig file path if provided.
func NewClient(kubeconfigPath string) (*Client, error) {
	cfg, err := buildConfig(kubeconfigPath)
	if err != nil {
		return nil, fmt.Errorf("building kubernetes config: %w", err)
	}

	clientset, err := kubernetes.NewForConfig(cfg)
	if err != nil {
		return nil, fmt.Errorf("creating kubernetes clientset: %w", err)
	}

	dynamicClient, err := dynamic.NewForConfig(cfg)
	if err != nil {
		return nil, fmt.Errorf("creating dynamic client: %w", err)
	}

	return &Client{
		Clientset: clientset,
		Dynamic:   dynamicClient,
		Discovery: clientset.Discovery(),
	}, nil
}

// buildConfig attempts in-cluster config first, then falls back to kubeconfig.
func buildConfig(kubeconfigPath string) (*rest.Config, error) {
	// Try in-cluster config first.
	cfg, err := rest.InClusterConfig()
	if err == nil {
		return cfg, nil
	}

	// Fall back to kubeconfig.
	if kubeconfigPath == "" {
		return nil, fmt.Errorf(
			"not running in cluster and no KUBECONFIG provided: %w", err,
		)
	}

	cfg, err = clientcmd.BuildConfigFromFlags("", kubeconfigPath)
	if err != nil {
		return nil, fmt.Errorf("building config from kubeconfig %q: %w", kubeconfigPath, err)
	}

	return cfg, nil
}

// CheckHealth verifies connectivity to the Kubernetes API server by fetching
// the server version. It returns an error if the API server is unreachable.
func (c *Client) CheckHealth() error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Use a simple REST request to verify connectivity.
	_, err := c.Discovery.RESTClient().Get().AbsPath("/healthz").DoRaw(ctx)
	if err != nil {
		return fmt.Errorf("kubernetes API health check failed: %w", err)
	}
	return nil
}
