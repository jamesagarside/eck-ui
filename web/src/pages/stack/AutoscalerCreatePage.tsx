import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EuiPageHeader,
  EuiSpacer,
  EuiForm,
  EuiFormRow,
  EuiFieldText,
  EuiFieldNumber,
  EuiButton,
  EuiButtonEmpty,
  EuiButtonIcon,
  EuiFlexGroup,
  EuiFlexItem,
  EuiCallOut,
  EuiPanel,
  EuiTitle,
  EuiComboBox,
  type EuiComboBoxOptionOption,
} from '@elastic/eui';
import { useCreateResource } from '../../hooks/useResources';

const AVAILABLE_ROLES: EuiComboBoxOptionOption[] = [
  { label: 'master' },
  { label: 'data' },
  { label: 'data_content' },
  { label: 'data_hot' },
  { label: 'data_warm' },
  { label: 'data_cold' },
  { label: 'data_frozen' },
  { label: 'ingest' },
  { label: 'ml' },
  { label: 'transform' },
];

interface AutoscalingPolicy {
  name: string;
  roles: string[];
  nodeCountMin: number;
  nodeCountMax: number;
  memoryMin: string;
  memoryMax: string;
  storageMin: string;
  storageMax: string;
}

function emptyPolicy(): AutoscalingPolicy {
  return {
    name: '',
    roles: ['data'],
    nodeCountMin: 1,
    nodeCountMax: 5,
    memoryMin: '2Gi',
    memoryMax: '8Gi',
    storageMin: '10Gi',
    storageMax: '100Gi',
  };
}

export function AutoscalerCreatePage() {
  const navigate = useNavigate();
  const createMutation = useCreateResource('elasticsearchautoscaler');
  const [name, setName] = useState('');
  const [namespace, setNamespace] = useState('default');
  const [esRefName, setEsRefName] = useState('');
  const [esRefNamespace, setEsRefNamespace] = useState('');
  const [pollingPeriod, setPollingPeriod] = useState('60s');
  const [policies, setPolicies] = useState<AutoscalingPolicy[]>([emptyPolicy()]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Required';
    else if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(name))
      e.name = 'Invalid Kubernetes name';
    if (!namespace.trim()) e.namespace = 'Required';
    if (!esRefName.trim()) e.esRefName = 'Required';
    if (policies.length === 0) e.policies = 'At least one policy is required';
    for (const p of policies) {
      if (!p.name.trim()) {
        e.policies = 'All policies must have a name';
        break;
      }
      if (p.roles.length === 0) {
        e.policies = 'All policies must have at least one role';
        break;
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const updatePolicy = (index: number, updates: Partial<AutoscalingPolicy>) => {
    const updated = policies.map((p, i) =>
      i === index ? { ...p, ...updates } : p,
    );
    setPolicies(updated);
  };

  const addPolicy = () => {
    setPolicies([...policies, emptyPolicy()]);
  };

  const removePolicy = (index: number) => {
    if (policies.length <= 1) return;
    setPolicies(policies.filter((_, i) => i !== index));
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;

    const resource = {
      apiVersion: 'autoscaling.k8s.elastic.co/v1alpha1',
      kind: 'ElasticsearchAutoscaler',
      metadata: { name, namespace },
      spec: {
        elasticsearchRef: {
          name: esRefName,
          ...(esRefNamespace ? { namespace: esRefNamespace } : {}),
        },
        pollingPeriod,
        policies: policies.map((p) => ({
          name: p.name,
          roles: p.roles,
          resources: {
            nodeCount: { min: p.nodeCountMin, max: p.nodeCountMax },
            memory: { min: p.memoryMin, max: p.memoryMax },
            storage: { min: p.storageMin, max: p.storageMax },
          },
        })),
      },
    };

    await createMutation.mutateAsync(resource);
    navigate('/elasticsearchautoscaler');
  };

  return (
    <>
      <EuiPageHeader pageTitle="Create Elasticsearch Autoscaler" iconType="scale" />
      <EuiSpacer size="l" />
      {createMutation.isError && (
        <>
          <EuiCallOut title="Failed to create autoscaler" color="danger" iconType="error">
            {createMutation.error?.message}
          </EuiCallOut>
          <EuiSpacer size="m" />
        </>
      )}
      <EuiForm component="form" onSubmit={handleSubmit}>
        {/* General Settings */}
        <EuiPanel>
          <EuiTitle size="xs">
            <h3>General</h3>
          </EuiTitle>
          <EuiSpacer size="m" />
          <EuiFormRow label="Name" isInvalid={!!errors.name} error={errors.name}>
            <EuiFieldText
              value={name}
              onChange={(e) => setName(e.target.value)}
              isInvalid={!!errors.name}
              placeholder="my-autoscaler"
              aria-label="Autoscaler name"
            />
          </EuiFormRow>
          <EuiFormRow label="Namespace" isInvalid={!!errors.namespace} error={errors.namespace}>
            <EuiFieldText
              value={namespace}
              onChange={(e) => setNamespace(e.target.value)}
              isInvalid={!!errors.namespace}
              aria-label="Namespace"
            />
          </EuiFormRow>
        </EuiPanel>

        <EuiSpacer size="l" />

        {/* Target Elasticsearch */}
        <EuiPanel>
          <EuiTitle size="xs">
            <h3>Target Elasticsearch Cluster</h3>
          </EuiTitle>
          <EuiSpacer size="m" />
          <EuiFlexGroup>
            <EuiFlexItem>
              <EuiFormRow
                label="Elasticsearch Cluster Name"
                isInvalid={!!errors.esRefName}
                error={errors.esRefName}
              >
                <EuiFieldText
                  value={esRefName}
                  onChange={(e) => setEsRefName(e.target.value)}
                  isInvalid={!!errors.esRefName}
                  placeholder="my-elasticsearch"
                  aria-label="Target Elasticsearch cluster name"
                />
              </EuiFormRow>
            </EuiFlexItem>
            <EuiFlexItem>
              <EuiFormRow label="Namespace (optional)">
                <EuiFieldText
                  value={esRefNamespace}
                  onChange={(e) => setEsRefNamespace(e.target.value)}
                  placeholder="Same as autoscaler"
                  aria-label="Target Elasticsearch namespace"
                />
              </EuiFormRow>
            </EuiFlexItem>
          </EuiFlexGroup>
          <EuiFormRow label="Polling Period" helpText="How often to check for autoscaling needs (e.g. 30s, 1m, 5m)">
            <EuiFieldText
              value={pollingPeriod}
              onChange={(e) => setPollingPeriod(e.target.value)}
              placeholder="60s"
              aria-label="Polling period"
            />
          </EuiFormRow>
        </EuiPanel>

        <EuiSpacer size="l" />

        {/* Autoscaling Policies */}
        <EuiPanel>
          <EuiTitle size="xs">
            <h3>Autoscaling Policies</h3>
          </EuiTitle>
          <EuiSpacer size="m" />
          {errors.policies && (
            <>
              <EuiCallOut title={errors.policies} color="danger" iconType="error" size="s" />
              <EuiSpacer size="m" />
            </>
          )}

          {policies.map((policy, index) => (
            <EuiPanel key={index} paddingSize="m" hasBorder style={{ marginBottom: 16 }}>
              <EuiFlexGroup justifyContent="spaceBetween" alignItems="center">
                <EuiFlexItem grow={false}>
                  <EuiTitle size="xxs">
                    <h4>Policy {index + 1}</h4>
                  </EuiTitle>
                </EuiFlexItem>
                {policies.length > 1 && (
                  <EuiFlexItem grow={false}>
                    <EuiButtonIcon
                      iconType="trash"
                      color="danger"
                      onClick={() => removePolicy(index)}
                      aria-label={`Remove policy ${index + 1}`}
                    />
                  </EuiFlexItem>
                )}
              </EuiFlexGroup>
              <EuiSpacer size="m" />

              <EuiFormRow label="Policy Name">
                <EuiFieldText
                  value={policy.name}
                  onChange={(e) => updatePolicy(index, { name: e.target.value })}
                  placeholder="data-tier"
                  aria-label="Policy name"
                />
              </EuiFormRow>

              <EuiFormRow label="Roles" fullWidth>
                <EuiComboBox
                  options={AVAILABLE_ROLES}
                  selectedOptions={policy.roles.map((r) => ({ label: r }))}
                  onChange={(selected) =>
                    updatePolicy(index, {
                      roles: selected.map((s) => s.label),
                    })
                  }
                  isClearable
                  fullWidth
                  aria-label="Policy roles"
                />
              </EuiFormRow>

              <EuiSpacer size="m" />

              <EuiTitle size="xxxs">
                <h5>Node Count Range</h5>
              </EuiTitle>
              <EuiSpacer size="s" />
              <EuiFlexGroup>
                <EuiFlexItem>
                  <EuiFormRow label="Minimum Nodes">
                    <EuiFieldNumber
                      value={policy.nodeCountMin}
                      onChange={(e) =>
                        updatePolicy(index, {
                          nodeCountMin: parseInt(e.target.value, 10) || 1,
                        })
                      }
                      min={0}
                      aria-label="Minimum node count"
                    />
                  </EuiFormRow>
                </EuiFlexItem>
                <EuiFlexItem>
                  <EuiFormRow label="Maximum Nodes">
                    <EuiFieldNumber
                      value={policy.nodeCountMax}
                      onChange={(e) =>
                        updatePolicy(index, {
                          nodeCountMax: parseInt(e.target.value, 10) || 1,
                        })
                      }
                      min={1}
                      aria-label="Maximum node count"
                    />
                  </EuiFormRow>
                </EuiFlexItem>
              </EuiFlexGroup>

              <EuiSpacer size="m" />

              <EuiTitle size="xxxs">
                <h5>Memory Range</h5>
              </EuiTitle>
              <EuiSpacer size="s" />
              <EuiFlexGroup>
                <EuiFlexItem>
                  <EuiFormRow label="Minimum Memory">
                    <EuiFieldText
                      value={policy.memoryMin}
                      onChange={(e) => updatePolicy(index, { memoryMin: e.target.value })}
                      placeholder="2Gi"
                      aria-label="Minimum memory"
                    />
                  </EuiFormRow>
                </EuiFlexItem>
                <EuiFlexItem>
                  <EuiFormRow label="Maximum Memory">
                    <EuiFieldText
                      value={policy.memoryMax}
                      onChange={(e) => updatePolicy(index, { memoryMax: e.target.value })}
                      placeholder="8Gi"
                      aria-label="Maximum memory"
                    />
                  </EuiFormRow>
                </EuiFlexItem>
              </EuiFlexGroup>

              <EuiSpacer size="m" />

              <EuiTitle size="xxxs">
                <h5>Storage Range</h5>
              </EuiTitle>
              <EuiSpacer size="s" />
              <EuiFlexGroup>
                <EuiFlexItem>
                  <EuiFormRow label="Minimum Storage">
                    <EuiFieldText
                      value={policy.storageMin}
                      onChange={(e) => updatePolicy(index, { storageMin: e.target.value })}
                      placeholder="10Gi"
                      aria-label="Minimum storage"
                    />
                  </EuiFormRow>
                </EuiFlexItem>
                <EuiFlexItem>
                  <EuiFormRow label="Maximum Storage">
                    <EuiFieldText
                      value={policy.storageMax}
                      onChange={(e) => updatePolicy(index, { storageMax: e.target.value })}
                      placeholder="100Gi"
                      aria-label="Maximum storage"
                    />
                  </EuiFormRow>
                </EuiFlexItem>
              </EuiFlexGroup>
            </EuiPanel>
          ))}

          <EuiButton iconType="plusInCircle" onClick={addPolicy} size="s">
            Add Policy
          </EuiButton>
        </EuiPanel>

        <EuiSpacer size="l" />
        <EuiFlexGroup justifyContent="flexEnd">
          <EuiFlexItem grow={false}>
            <EuiButtonEmpty onClick={() => navigate('/elasticsearchautoscaler')}>
              Cancel
            </EuiButtonEmpty>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiButton type="submit" fill isLoading={createMutation.isPending}>
              Create Autoscaler
            </EuiButton>
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiForm>
    </>
  );
}
