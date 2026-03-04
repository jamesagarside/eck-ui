import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  specToNodeSetConfigs,
  type NodeSetConfig,
} from '../../components/elasticsearch/NodeSetEditor';
import { useResource, useUpdateResource } from '../../hooks/useResources';
import { DetailSkeleton } from '../../components/common/Skeletons';
import type { Elasticsearch } from '../../types/resources';

interface FormErrors {
  version?: string;
  nodeSets?: string;
}

interface EditFormProps {
  resource: Elasticsearch;
  namespace: string;
  name: string;
}

function EditForm({ resource, namespace, name }: EditFormProps) {
  const navigate = useNavigate();
  const updateMutation = useUpdateResource('elasticsearch');

  const [version, setVersion] = useState(resource.spec.version);
  const [nodeSets, setNodeSets] = useState<NodeSetConfig[]>(
    () => specToNodeSetConfigs(resource.spec.nodeSets),
  );
  const [errors, setErrors] = useState<FormErrors>({});

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
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

    const updated = {
      ...resource,
      spec: {
        ...resource.spec,
        version,
        nodeSets: nodeSetConfigsToSpec(nodeSets),
      },
    };

    await updateMutation.mutateAsync({
      namespace,
      name,
      resource: updated,
    });
    navigate(`/elasticsearch/${namespace}/${name}`);
  };

  return (
    <>
      <EuiPageHeader
        pageTitle={`Edit ${resource.metadata.name}`}
        iconType="logoElasticsearch"
        description={`Namespace: ${resource.metadata.namespace}`}
      />
      <EuiSpacer size="l" />

      {updateMutation.isError && (
        <>
          <EuiCallOut
            title="Failed to update cluster"
            color="danger"
            iconType="error"
          >
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
            <EuiFieldText
              value={resource.metadata.name}
              disabled
              aria-label="Cluster name (read-only)"
            />
          </EuiFormRow>

          <EuiFormRow label="Namespace">
            <EuiFieldText
              value={resource.metadata.namespace}
              disabled
              aria-label="Namespace (read-only)"
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
            <EuiButtonEmpty
              onClick={() =>
                navigate(`/elasticsearch/${namespace}/${name}`)
              }
            >
              Cancel
            </EuiButtonEmpty>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiButton
              type="submit"
              fill
              isLoading={updateMutation.isPending}
            >
              Save Changes
            </EuiButton>
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiForm>
    </>
  );
}

export function ElasticsearchEditPage() {
  const { namespace, name } = useParams<{
    namespace: string;
    name: string;
  }>();

  const {
    data: resource,
    isLoading,
    error: loadError,
  } = useResource<Elasticsearch>('elasticsearch', namespace || '', name || '');

  if (isLoading) return <DetailSkeleton />;

  if (loadError || !resource) {
    return (
      <EuiCallOut
        title="Failed to load Elasticsearch cluster"
        color="danger"
        iconType="error"
      >
        {loadError?.message || 'Resource not found'}
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
