package clusters

import (
	"context"
	"encoding/base64"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

// LoadCredentials reads the credential Secret referenced by the ECKUICluster and
// returns a rest.Config for connecting to the workload cluster. It supports two
// Secret formats: a "token" key (bearer token) or a "kubeconfig" key (full kubeconfig YAML).
// When both are present, "token" takes precedence.
func LoadCredentials(ctx context.Context, clientset kubernetes.Interface, cluster *ECKUICluster) (*rest.Config, error) {
	ref := cluster.Spec.CredentialSecretRef
	if ref.Name == "" || ref.Namespace == "" {
		return nil, fmt.Errorf("credentialSecretRef must specify both name and namespace")
	}

	secret, err := clientset.CoreV1().Secrets(ref.Namespace).Get(ctx, ref.Name, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("reading credential secret %s/%s: %w", ref.Namespace, ref.Name, err)
	}

	// Prefer token-based authentication.
	if token, ok := secret.Data["token"]; ok && len(token) > 0 {
		return buildTokenConfig(cluster, string(token))
	}

	// Fall back to kubeconfig-based authentication.
	if kubeconfig, ok := secret.Data["kubeconfig"]; ok && len(kubeconfig) > 0 {
		return buildKubeconfigConfig(kubeconfig)
	}

	return nil, fmt.Errorf("credential secret %s/%s must contain a 'token' or 'kubeconfig' key", ref.Namespace, ref.Name)
}

// buildTokenConfig constructs a rest.Config using bearer token authentication
// with the API server URL and CA bundle from the ECKUICluster CR.
func buildTokenConfig(cluster *ECKUICluster, token string) (*rest.Config, error) {
	cfg := &rest.Config{
		Host:        cluster.Spec.APIServerURL,
		BearerToken: token,
	}

	if cluster.Spec.CABundle != "" {
		caData, err := base64.StdEncoding.DecodeString(cluster.Spec.CABundle)
		if err != nil {
			return nil, fmt.Errorf("decoding caBundle: %w", err)
		}
		cfg.TLSClientConfig = rest.TLSClientConfig{
			CAData: caData,
		}
	}

	return cfg, nil
}

// buildKubeconfigConfig constructs a rest.Config by parsing a kubeconfig YAML.
func buildKubeconfigConfig(kubeconfig []byte) (*rest.Config, error) {
	cfg, err := clientcmd.RESTConfigFromKubeConfig(kubeconfig)
	if err != nil {
		return nil, fmt.Errorf("parsing kubeconfig from secret: %w", err)
	}
	return cfg, nil
}
