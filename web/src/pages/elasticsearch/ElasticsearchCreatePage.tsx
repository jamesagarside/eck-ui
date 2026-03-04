import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EuiPageHeader,
  EuiSpacer,
  EuiForm,
  EuiFormRow,
  EuiFieldText,
  EuiButton,
  EuiButtonEmpty,
  EuiFlexGroup,
  EuiFlexItem,
  EuiCallOut,
  EuiPanel,
  EuiTitle,
} from '@elastic/eui';
import {
  NodeSetEditor,
  nodeSetConfigsToSpec,
  type NodeSetConfig,
} from '../../components/elasticsearch/NodeSetEditor';
import { useCreateResource } from '../../hooks/useResources';

interface FormErrors {
  name?: string;
  namespace?: string;
  version?: string;
  nodeSets?: string;
}

export function ElasticsearchCreatePage() {
  const navigate = useNavigate();
  const createMutation = useCreateResource('elasticsearch');

  const [name, setName] = useState('');
  const [namespace, setNamespace] = useState('default');
  const [version, setVersion] = useState('8.17.0');
  const [nodeSets, setNodeSets] = useState<NodeSetConfig[]>([
    {
      name: 'default',
      count: 1,
      roles: ['master', 'data', 'ingest'],
      memoryRequest: '2Gi',
      cpuRequest: '1',
      memoryLimit: '2Gi',
      cpuLimit: '1',
      storageSize: '10Gi',
      storageClass: '',
    },
  ]);
  const [errors, setErrors] = useState<FormErrors>({});

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!name.trim()) newErrors.name = 'Name is required';
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(name)) {
      newErrors.name =
        'Must be a valid Kubernetes name (lowercase alphanumeric and hyphens)';
    }
    if (!namespace.trim()) newErrors.namespace = 'Namespace is required';
    if (!version.trim()) newErrors.version = 'Version is required';
    if (nodeSets.length === 0) {
      newErrors.nodeSets = 'At least one NodeSet is required';
    }
    for (const ns of nodeSets) {
      if (!ns.name.trim()) {
        newErrors.nodeSets = 'All NodeSets must have a name';
        break;
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const resource = {
      apiVersion: 'elasticsearch.k8s.elastic.co/v1',
      kind: 'Elasticsearch',
      metadata: { name, namespace },
      spec: {
        version,
        nodeSets: nodeSetConfigsToSpec(nodeSets),
      },
    };

    await createMutation.mutateAsync(resource);
    navigate('/elasticsearch');
  };

  return (
    <>
      <EuiPageHeader
        pageTitle="Create Elasticsearch Cluster"
        iconType="logoElasticsearch"
      />
      <EuiSpacer size="l" />

      {createMutation.isError && (
        <>
          <EuiCallOut
            title="Failed to create cluster"
            color="danger"
            iconType="error"
          >
            {createMutation.error?.message}
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

          <EuiFormRow
            label="Name"
            isInvalid={!!errors.name}
            error={errors.name}
          >
            <EuiFieldText
              value={name}
              onChange={(e) => setName(e.target.value)}
              isInvalid={!!errors.name}
              placeholder="my-elasticsearch"
              aria-label="Cluster name"
            />
          </EuiFormRow>

          <EuiFormRow
            label="Namespace"
            isInvalid={!!errors.namespace}
            error={errors.namespace}
          >
            <EuiFieldText
              value={namespace}
              onChange={(e) => setNamespace(e.target.value)}
              isInvalid={!!errors.namespace}
              aria-label="Namespace"
            />
          </EuiFormRow>

          <EuiFormRow
            label="Version"
            isInvalid={!!errors.version}
            error={errors.version}
          >
            <EuiFieldText
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              isInvalid={!!errors.version}
              placeholder="8.17.0"
              aria-label="Elasticsearch version"
            />
          </EuiFormRow>
        </EuiPanel>

        <EuiSpacer size="l" />

        <EuiPanel>
          <EuiTitle size="xs">
            <h3>NodeSets</h3>
          </EuiTitle>
          <EuiSpacer size="m" />
          {errors.nodeSets && (
            <>
              <EuiCallOut
                title={errors.nodeSets}
                color="danger"
                iconType="error"
                size="s"
              />
              <EuiSpacer size="m" />
            </>
          )}
          <NodeSetEditor nodeSets={nodeSets} onChange={setNodeSets} />
        </EuiPanel>

        <EuiSpacer size="l" />

        <EuiFlexGroup justifyContent="flexEnd">
          <EuiFlexItem grow={false}>
            <EuiButtonEmpty onClick={() => navigate('/elasticsearch')}>
              Cancel
            </EuiButtonEmpty>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiButton
              type="submit"
              fill
              isLoading={createMutation.isPending}
            >
              Create Cluster
            </EuiButton>
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiForm>
    </>
  );
}
