import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import { useResource, useUpdateResource } from '../../hooks/useResources';
import { DetailSkeleton } from '../../components/common/Skeletons';
import type { BaseResource, ResourceStatus } from '../../types/resources';

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

interface AutoscalingPolicyForm {
  name: string;
  roles: string[];
  nodeCountMin: number;
  nodeCountMax: number;
  memoryMin: string;
  memoryMax: string;
  storageMin: string;
  storageMax: string;
}

interface ElasticsearchAutoscaler extends BaseResource {
  kind: 'ElasticsearchAutoscaler';
  spec: {
    elasticsearchRef: { name: string; namespace?: string };
    pollingPeriod?: string;
    policies?: {
      name: string;
      roles: string[];
      resources?: {
        nodeCount?: { min: number; max: number };
        memory?: { min: string; max: string };
        storage?: { min: string; max: string };
      };
    }[];
  };
  status?: ResourceStatus;
}

function toFormPolicies(
  policies?: ElasticsearchAutoscaler['spec']['policies'],
): AutoscalingPolicyForm[] {
  if (!policies || policies.length === 0) {
    return [
      {
        name: '',
        roles: ['data'],
        nodeCountMin: 1,
        nodeCountMax: 5,
        memoryMin: '2Gi',
        memoryMax: '8Gi',
        storageMin: '10Gi',
        storageMax: '100Gi',
      },
    ];
  }
  return policies.map((p) => ({
    name: p.name,
    roles: p.roles,
    nodeCountMin: p.resources?.nodeCount?.min ?? 1,
    nodeCountMax: p.resources?.nodeCount?.max ?? 5,
    memoryMin: p.resources?.memory?.min ?? '2Gi',
    memoryMax: p.resources?.memory?.max ?? '8Gi',
    storageMin: p.resources?.storage?.min ?? '10Gi',
    storageMax: p.resources?.storage?.max ?? '100Gi',
  }));
}

interface EditFormProps {
  resource: ElasticsearchAutoscaler;
  namespace: string;
  name: string;
}

function EditForm({ resource, namespace, name }: EditFormProps) {
  const navigate = useNavigate();
  const updateMutation = useUpdateResource('elasticsearchautoscaler');
  const [esRefName, setEsRefName] = useState(resource.spec.elasticsearchRef.name);
  const [esRefNamespace, setEsRefNamespace] = useState(
    resource.spec.elasticsearchRef.namespace || '',
  );
  const [pollingPeriod, setPollingPeriod] = useState(resource.spec.pollingPeriod || '60s');
  const [policies, setPolicies] = useState<AutoscalingPolicyForm[]>(
    toFormPolicies(resource.spec.policies),
  );

  const updatePolicy = (index: number, updates: Partial<AutoscalingPolicyForm>) => {
    setPolicies(policies.map((p, i) => (i === index ? { ...p, ...updates } : p)));
  };

  const addPolicy = () => {
    setPolicies([
      ...policies,
      {
        name: '',
        roles: ['data'],
        nodeCountMin: 1,
        nodeCountMax: 5,
        memoryMin: '2Gi',
        memoryMax: '8Gi',
        storageMin: '10Gi',
        storageMax: '100Gi',
      },
    ]);
  };

  const removePolicy = (index: number) => {
    if (policies.length <= 1) return;
    setPolicies(policies.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateMutation.mutateAsync({
      namespace,
      name,
      resource: {
        ...resource,
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
      },
    });
    navigate(`/elasticsearchautoscaler/${namespace}/${name}`);
  };

  return (
    <>
      <EuiPageHeader
        pageTitle={`Edit ${resource.metadata.name}`}
        iconType="scale"
        description={`Namespace: ${resource.metadata.namespace}`}
      />
      <EuiSpacer size="l" />
      {updateMutation.isError && (
        <>
          <EuiCallOut title="Failed to update autoscaler" color="danger" iconType="error">
            {updateMutation.error?.message}
          </EuiCallOut>
          <EuiSpacer size="m" />
        </>
      )}
      <EuiForm component="form" onSubmit={handleSubmit}>
        <EuiPanel>
          <EuiTitle size="xs">
            <h3>General</h3>
          </EuiTitle>
          <EuiSpacer size="m" />
          <EuiFormRow label="Name">
            <EuiFieldText value={resource.metadata.name} disabled />
          </EuiFormRow>
          <EuiFormRow label="Namespace">
            <EuiFieldText value={resource.metadata.namespace} disabled />
          </EuiFormRow>
        </EuiPanel>

        <EuiSpacer size="l" />

        <EuiPanel>
          <EuiTitle size="xs">
            <h3>Target Elasticsearch Cluster</h3>
          </EuiTitle>
          <EuiSpacer size="m" />
          <EuiFlexGroup>
            <EuiFlexItem>
              <EuiFormRow label="Elasticsearch Cluster Name">
                <EuiFieldText
                  value={esRefName}
                  onChange={(e) => setEsRefName(e.target.value)}
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
          <EuiFormRow label="Polling Period">
            <EuiFieldText
              value={pollingPeriod}
              onChange={(e) => setPollingPeriod(e.target.value)}
              aria-label="Polling period"
            />
          </EuiFormRow>
        </EuiPanel>

        <EuiSpacer size="l" />

        <EuiPanel>
          <EuiTitle size="xs">
            <h3>Autoscaling Policies</h3>
          </EuiTitle>
          <EuiSpacer size="m" />
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
                  aria-label="Policy name"
                />
              </EuiFormRow>
              <EuiFormRow label="Roles" fullWidth>
                <EuiComboBox
                  options={AVAILABLE_ROLES}
                  selectedOptions={policy.roles.map((r) => ({ label: r }))}
                  onChange={(selected) =>
                    updatePolicy(index, { roles: selected.map((s) => s.label) })
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
                  <EuiFormRow label="Min">
                    <EuiFieldNumber
                      value={policy.nodeCountMin}
                      onChange={(e) =>
                        updatePolicy(index, { nodeCountMin: parseInt(e.target.value, 10) || 1 })
                      }
                      min={0}
                    />
                  </EuiFormRow>
                </EuiFlexItem>
                <EuiFlexItem>
                  <EuiFormRow label="Max">
                    <EuiFieldNumber
                      value={policy.nodeCountMax}
                      onChange={(e) =>
                        updatePolicy(index, { nodeCountMax: parseInt(e.target.value, 10) || 1 })
                      }
                      min={1}
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
                  <EuiFormRow label="Min">
                    <EuiFieldText
                      value={policy.memoryMin}
                      onChange={(e) => updatePolicy(index, { memoryMin: e.target.value })}
                    />
                  </EuiFormRow>
                </EuiFlexItem>
                <EuiFlexItem>
                  <EuiFormRow label="Max">
                    <EuiFieldText
                      value={policy.memoryMax}
                      onChange={(e) => updatePolicy(index, { memoryMax: e.target.value })}
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
                  <EuiFormRow label="Min">
                    <EuiFieldText
                      value={policy.storageMin}
                      onChange={(e) => updatePolicy(index, { storageMin: e.target.value })}
                    />
                  </EuiFormRow>
                </EuiFlexItem>
                <EuiFlexItem>
                  <EuiFormRow label="Max">
                    <EuiFieldText
                      value={policy.storageMax}
                      onChange={(e) => updatePolicy(index, { storageMax: e.target.value })}
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
            <EuiButtonEmpty
              onClick={() => navigate(`/elasticsearchautoscaler/${namespace}/${name}`)}
            >
              Cancel
            </EuiButtonEmpty>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiButton type="submit" fill isLoading={updateMutation.isPending}>
              Save Changes
            </EuiButton>
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiForm>
    </>
  );
}

export function AutoscalerEditPage() {
  const { namespace, name } = useParams<{ namespace: string; name: string }>();
  const {
    data: resource,
    isLoading,
    error: loadError,
  } = useResource<ElasticsearchAutoscaler>(
    'elasticsearchautoscaler',
    namespace || '',
    name || '',
  );

  if (isLoading) return <DetailSkeleton />;
  if (loadError || !resource) {
    return (
      <EuiCallOut title="Failed to load Autoscaler" color="danger" iconType="error">
        {loadError?.message || 'Not found'}
      </EuiCallOut>
    );
  }

  return (
    <EditForm
      key={resource.metadata.resourceVersion}
      resource={resource}
      namespace={namespace || ''}
      name={name || ''}
    />
  );
}
