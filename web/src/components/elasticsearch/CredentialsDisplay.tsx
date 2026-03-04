import { useState, useCallback } from 'react';
import {
  EuiButton,
  EuiCopy,
  EuiDescriptionList,
  EuiFlexGroup,
  EuiFlexItem,
  EuiPanel,
  EuiSpacer,
  EuiText,
  EuiTitle,
  EuiToolTip,
} from '@elastic/eui';
import { SecretField } from '../common/SecretField';
import apiClient from '../../api/client';

interface CredentialsDisplayProps {
  clusterName: string;
  namespace: string;
}

interface SecretData {
  elastic: string;
}

export function CredentialsDisplay({
  clusterName,
  namespace,
}: CredentialsDisplayProps) {
  const [secret, setSecret] = useState<SecretData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const secretName = `${clusterName}-es-elastic-user`;
  const internalServiceUrl = `https://${clusterName}-es-http.${namespace}.svc:9200`;
  const externalServiceUrl = `https://${clusterName}-es-http.${namespace}:9200`;

  const connectionString = secret
    ? `https://elastic:${secret.elastic}@${clusterName}-es-http.${namespace}.svc:9200`
    : '';

  const fetchSecret = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<SecretData>(
        `/resources/secrets/${namespace}/${secretName}`,
      );
      setSecret(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to retrieve credentials',
      );
    } finally {
      setIsLoading(false);
    }
  }, [namespace, secretName]);

  const serviceItems = [
    {
      title: 'Internal service URL',
      description: (
        <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
          <EuiFlexItem grow={false}>
            <EuiText size="s">
              <code>{internalServiceUrl}</code>
            </EuiText>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiCopy textToCopy={internalServiceUrl}>
              {(copy) => (
                <EuiToolTip content="Copy to clipboard">
                  <EuiButton
                    iconType="copy"
                    size="s"
                    onClick={copy}
                    aria-label="Copy internal service URL"
                  >
                    Copy
                  </EuiButton>
                </EuiToolTip>
              )}
            </EuiCopy>
          </EuiFlexItem>
        </EuiFlexGroup>
      ),
    },
    {
      title: 'External service URL',
      description: (
        <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
          <EuiFlexItem grow={false}>
            <EuiText size="s">
              <code>{externalServiceUrl}</code>
            </EuiText>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiCopy textToCopy={externalServiceUrl}>
              {(copy) => (
                <EuiToolTip content="Copy to clipboard">
                  <EuiButton
                    iconType="copy"
                    size="s"
                    onClick={copy}
                    aria-label="Copy external service URL"
                  >
                    Copy
                  </EuiButton>
                </EuiToolTip>
              )}
            </EuiCopy>
          </EuiFlexItem>
        </EuiFlexGroup>
      ),
    },
  ];

  return (
    <EuiPanel paddingSize="l">
      <EuiTitle size="xs">
        <h3>Credentials</h3>
      </EuiTitle>
      <EuiSpacer size="m" />

      <EuiTitle size="xxs">
        <h4>Service URLs</h4>
      </EuiTitle>
      <EuiSpacer size="s" />
      <EuiDescriptionList
        type="column"
        listItems={serviceItems}
        compressed
      />

      <EuiSpacer size="l" />

      <EuiTitle size="xxs">
        <h4>Elastic User Password</h4>
      </EuiTitle>
      <EuiSpacer size="s" />
      <EuiText size="xs" color="subdued">
        Secret: <code>{secretName}</code>
      </EuiText>
      <EuiSpacer size="s" />

      {!secret && !error && (
        <EuiButton
          size="s"
          iconType="lock"
          onClick={fetchSecret}
          isLoading={isLoading}
        >
          Reveal credentials
        </EuiButton>
      )}

      {error && (
        <>
          <EuiText size="s" color="danger">
            {error}
          </EuiText>
          <EuiSpacer size="s" />
          <EuiButton size="s" onClick={fetchSecret} isLoading={isLoading}>
            Retry
          </EuiButton>
        </>
      )}

      {secret && (
        <>
          <SecretField value={secret.elastic} />
          <EuiSpacer size="m" />
          <EuiTitle size="xxs">
            <h4>Connection String</h4>
          </EuiTitle>
          <EuiSpacer size="s" />
          <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
            <EuiFlexItem>
              <SecretField value={connectionString} />
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiCopy textToCopy={connectionString}>
                {(copy) => (
                  <EuiToolTip content="Copy connection string">
                    <EuiButton
                      iconType="copy"
                      size="s"
                      onClick={copy}
                      aria-label="Copy connection string to clipboard"
                    >
                      Copy
                    </EuiButton>
                  </EuiToolTip>
                )}
              </EuiCopy>
            </EuiFlexItem>
          </EuiFlexGroup>
        </>
      )}
    </EuiPanel>
  );
}
