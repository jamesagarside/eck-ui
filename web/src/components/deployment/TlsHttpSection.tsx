import { useCallback, useMemo } from 'react';
import {
  EuiFieldText,
  EuiFormRow,
  EuiSelect,
  EuiSpacer,
} from '@elastic/eui';
import type { HttpIntent } from '../../hooks/useDeploymentMutations';

interface TlsHttpSectionProps {
  http: HttpIntent;
  onChange: (http: HttpIntent) => void;
  readOnly?: boolean;
}

type TlsMode = 'self-signed' | 'disabled' | 'custom';

const TLS_OPTIONS = [
  { value: 'self-signed', text: 'Self-signed (default)' },
  { value: 'disabled', text: 'Disabled' },
  { value: 'custom', text: 'Custom certificate' },
];

const SERVICE_TYPE_OPTIONS = [
  { value: 'ClusterIP', text: 'ClusterIP (default)' },
  { value: 'LoadBalancer', text: 'LoadBalancer' },
  { value: 'NodePort', text: 'NodePort' },
];

function getTlsMode(http: HttpIntent): TlsMode {
  if (http.tls?.disabled) return 'disabled';
  if (http.tls?.secretName) return 'custom';
  return 'self-signed';
}

function getSecretName(http: HttpIntent): string {
  return http.tls?.secretName ?? '';
}

export function TlsHttpSection({
  http,
  onChange,
  readOnly = false,
}: TlsHttpSectionProps) {
  const tlsMode = useMemo(() => getTlsMode(http), [http]);
  const secretName = useMemo(() => getSecretName(http), [http]);

  const handleTlsModeChange = useCallback(
    (mode: TlsMode) => {
      switch (mode) {
        case 'self-signed':
          onChange({ ...http, tls: undefined });
          break;
        case 'disabled':
          onChange({ ...http, tls: { disabled: true } });
          break;
        case 'custom':
          onChange({ ...http, tls: { secretName: '' } });
          break;
      }
    },
    [http, onChange],
  );

  const handleSecretNameChange = useCallback(
    (name: string) => {
      onChange({ ...http, tls: { secretName: name } });
    },
    [http, onChange],
  );

  const handleServiceTypeChange = useCallback(
    (serviceType: string) => {
      onChange({
        ...http,
        serviceType:
          serviceType === 'ClusterIP'
            ? undefined
            : (serviceType as HttpIntent['serviceType']),
      });
    },
    [http, onChange],
  );

  return (
    <div>
      <EuiFormRow label="TLS Mode" fullWidth>
        <EuiSelect
          options={TLS_OPTIONS}
          value={tlsMode}
          onChange={(e) => handleTlsModeChange(e.target.value as TlsMode)}
          disabled={readOnly}
          aria-label="TLS mode"
          fullWidth
        />
      </EuiFormRow>

      {tlsMode === 'custom' && (
        <>
          <EuiSpacer size="s" />
          <EuiFormRow label="TLS Secret Name" fullWidth>
            <EuiFieldText
              value={secretName}
              onChange={(e) => handleSecretNameChange(e.target.value)}
              placeholder="my-tls-secret"
              readOnly={readOnly}
              aria-label="TLS secret name"
              fullWidth
            />
          </EuiFormRow>
        </>
      )}

      <EuiSpacer size="m" />

      <EuiFormRow label="Service Type" fullWidth>
        <EuiSelect
          options={SERVICE_TYPE_OPTIONS}
          value={http.serviceType ?? 'ClusterIP'}
          onChange={(e) => handleServiceTypeChange(e.target.value)}
          disabled={readOnly}
          aria-label="Service type"
          fullWidth
        />
      </EuiFormRow>
    </div>
  );
}
