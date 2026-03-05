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
  EuiTextArea,
} from '@elastic/eui';
import { useResource, useUpdateResource } from '../../hooks/useResources';
import { DetailSkeleton } from '../../components/common/Skeletons';
import type { BaseResource, ResourceStatus } from '../../types/resources';

interface StackConfigPolicy extends BaseResource {
  kind: 'StackConfigPolicy';
  spec: {
    resourceSelector?: Record<string, unknown>;
    elasticsearch?: Record<string, unknown>;
    kibana?: Record<string, unknown>;
  };
  status?: ResourceStatus;
}

interface EditFormProps {
  resource: StackConfigPolicy;
  namespace: string;
  name: string;
}

function EditForm({ resource, namespace, name }: EditFormProps) {
  const navigate = useNavigate();
  const updateMutation = useUpdateResource('stackconfigpolicy');
  const rawSpec =
    resource.metadata.annotations?.['eck-ui/raw-spec'] ||
    JSON.stringify(resource.spec, null, 2);
  const [specYaml, setSpecYaml] = useState(rawSpec);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateMutation.mutateAsync({
      namespace,
      name,
      resource: {
        ...resource,
        metadata: {
          ...resource.metadata,
          annotations: {
            ...resource.metadata.annotations,
            'eck-ui/raw-spec': specYaml,
          },
        },
      },
    });
    navigate(`/stackconfigpolicy/${namespace}/${name}`);
  };

  return (
    <>
      <EuiPageHeader
        pageTitle={`Edit ${resource.metadata.name}`}
        iconType="controlsHorizontal"
        description={`Namespace: ${resource.metadata.namespace}`}
      />
      <EuiSpacer size="l" />
      {updateMutation.isError && (
        <>
          <EuiCallOut title="Failed to update policy" color="danger" iconType="error">
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
            <h3>Policy Specification</h3>
          </EuiTitle>
          <EuiSpacer size="m" />
          <EuiFormRow label="Spec (YAML)" fullWidth>
            <EuiTextArea
              value={specYaml}
              onChange={(e) => setSpecYaml(e.target.value)}
              fullWidth
              rows={16}
              style={{ fontFamily: 'monospace', fontSize: '14px' }}
              aria-label="Policy specification editor"
            />
          </EuiFormRow>
        </EuiPanel>

        <EuiSpacer size="l" />
        <EuiFlexGroup justifyContent="flexEnd">
          <EuiFlexItem grow={false}>
            <EuiButtonEmpty
              onClick={() => navigate(`/stackconfigpolicy/${namespace}/${name}`)}
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

export function StackConfigPolicyEditPage() {
  const { namespace, name } = useParams<{ namespace: string; name: string }>();
  const {
    data: resource,
    isLoading,
    error: loadError,
  } = useResource<StackConfigPolicy>('stackconfigpolicy', namespace || '', name || '');

  if (isLoading) return <DetailSkeleton />;
  if (loadError || !resource) {
    return (
      <EuiCallOut title="Failed to load Stack Config Policy" color="danger" iconType="error">
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
