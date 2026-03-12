import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  EuiPageHeader, EuiSpacer, EuiForm, EuiFormRow, EuiFieldText, EuiFieldNumber,
  EuiButton, EuiButtonEmpty, EuiButtonGroup, EuiFlexGroup, EuiFlexItem,
  EuiCallOut, EuiPanel, EuiTitle, EuiSelect,
} from '@elastic/eui';
import { useResource, useUpdateResource } from '../../hooks/useResources';
import { DetailSkeleton } from '../../components/common/Skeletons';
import { VersionSelect } from '../../components/form/VersionSelect';
import { ComponentConfigurator } from '../../components/deployment/ComponentConfigurator';
import type { ComponentFormState } from '../../components/deployment/ComponentConfigurator';
import { useNamespaceFleetServers } from '../../hooks/useNamespaceFleetServers';
import { agentCRToFormState, formStateToAgentSpec, getAgentMode, getWorkloadType } from '../../utils/agentFormMapping';
import type { AgentMode, WorkloadType } from '../../utils/agentFormMapping';
import { useToast } from '../../context/ToastContext';
import { useResourceForm } from '../../hooks/useResourceForm';
import { UnsavedChangesPrompt } from '../../hooks/useUnsavedChanges';
import type { Agent } from '../../types/resources';

const modeOptions = [
  { id: 'standalone', label: 'Standalone' },
  { id: 'fleet-connected', label: 'Fleet-connected' },
];

const workloadOptions = [
  { id: 'daemonSet', label: 'DaemonSet' },
  { id: 'deployment', label: 'Deployment' },
];

interface AgentEditFormValues {
  version: string;
  mode: AgentMode;
  workloadType: WorkloadType;
  replicas: number;
  fleetServerRef: string;
  kibanaRef: string;
  formState: ComponentFormState;
}

interface EditFormProps {
  resource: Agent;
  namespace: string;
  name: string;
}

function EditForm({ resource, namespace, name }: EditFormProps) {
  const navigate = useNavigate();
  const updateMutation = useUpdateResource('agent');
  const { addToast } = useToast();

  const initialMode = getAgentMode(resource);
  const initialWorkload = getWorkloadType(resource);
  const initialFormState = agentCRToFormState(resource);

  // Redirect fleet-server agents to the fleet-server edit page
  useEffect(() => {
    if (initialMode === 'fleet-server') {
      navigate(`/fleet-server/${namespace}/${name}/edit`, { replace: true });
    }
  }, [initialMode, namespace, name, navigate]);

  const form = useResourceForm<AgentEditFormValues>({
    initialValues: {
      version: resource.spec.version,
      mode: initialMode === 'fleet-server' ? 'standalone' : initialMode,
      workloadType: initialWorkload,
      replicas: resource.spec.deployment?.replicas ?? 1,
      fleetServerRef: resource.spec.fleetServerRef?.name || '',
      kibanaRef: resource.spec.kibanaRef?.name || '',
      formState: initialFormState,
    },
    onSubmit: async (values) => {
      const stateWithReplicas: ComponentFormState = {
        ...(values.formState as ComponentFormState),
        count: values.workloadType === 'deployment' ? values.replicas : 1,
      };

      const agentSpec = formStateToAgentSpec(stateWithReplicas, values.mode as AgentMode, values.workloadType as WorkloadType);

      const updatedResource: Record<string, unknown> = {
        ...resource,
        spec: {
          version: values.version,
          ...agentSpec,
        },
      };

      if (values.mode === 'fleet-connected') {
        const spec = updatedResource.spec as Record<string, unknown>;
        spec.fleetServerRef = { name: values.fleetServerRef };
        if (values.kibanaRef) {
          spec.kibanaRef = { name: values.kibanaRef };
        }
      }

      try {
        await updateMutation.mutateAsync({
          namespace,
          name,
          resource: updatedResource,
        });
        addToast({ title: `Agent '${name}' updated`, color: 'success' });
        navigate(`/agent/${namespace}/${name}`);
      } catch (err) {
        addToast({ title: 'Failed to update Agent', color: 'danger', text: err instanceof Error ? err.message : 'An unexpected error occurred' });
      }
    },
  });

  const { fleetServers } = useNamespaceFleetServers(namespace);

  const handleFormStateChange = (updates: Partial<ComponentFormState>) => {
    const current = form.values.formState as ComponentFormState;
    form.setFieldValue('formState', { ...current, ...updates });
  };

  if (initialMode === 'fleet-server') {
    return null;
  }

  return (
    <>
      <UnsavedChangesPrompt isDirty={form.isDirty} />
      <EuiPageHeader
        pageTitle={`Edit ${resource.metadata.name}`}
        iconType="logoSecurity"
        description={`Namespace: ${resource.metadata.namespace}`}
      />
      <EuiSpacer size="l" />
      <EuiForm component="form" onSubmit={form.handleSubmit}>
        <EuiPanel>
          <EuiTitle size="xs"><h3>General</h3></EuiTitle>
          <EuiSpacer size="m" />
          <EuiFormRow label="Name">
            <EuiFieldText value={resource.metadata.name} disabled />
          </EuiFormRow>
          <EuiFormRow label="Namespace">
            <EuiFieldText value={resource.metadata.namespace} disabled />
          </EuiFormRow>
          <EuiFormRow label="Version">
            <VersionSelect
              value={form.fields.version.value as string}
              onChange={(v) => form.fields.version.onChange(v)}
              currentVersion={resource.spec.version}
            />
          </EuiFormRow>
        </EuiPanel>

        <EuiSpacer size="l" />

        <EuiPanel>
          <EuiTitle size="xs"><h3>Agent Mode</h3></EuiTitle>
          <EuiSpacer size="m" />
          <EuiFormRow label="Mode">
            <EuiButtonGroup
              legend="Agent mode"
              options={modeOptions}
              idSelected={form.values.mode}
              onChange={(id) => form.setFieldValue('mode', id)}
            />
          </EuiFormRow>

          {form.values.mode === 'fleet-connected' && (
            <>
              <EuiSpacer size="m" />
              <EuiFormRow label="Fleet Server Reference">
                <EuiSelect
                  options={[
                    { value: '', text: 'Select a Fleet Server...' },
                    ...fleetServers.map((fs) => ({
                      value: fs.metadata.name,
                      text: fs.metadata.name,
                    })),
                  ]}
                  value={form.fields.fleetServerRef.value as string}
                  onChange={(e) => form.fields.fleetServerRef.onChange(e.target.value)}
                />
              </EuiFormRow>
              <EuiFormRow label="Kibana Reference (optional)">
                <EuiFieldText
                  value={form.fields.kibanaRef.value as string}
                  onChange={(e) => form.fields.kibanaRef.onChange(e.target.value)}
                  placeholder="my-kibana"
                />
              </EuiFormRow>
            </>
          )}
        </EuiPanel>

        <EuiSpacer size="l" />

        <EuiPanel>
          <EuiTitle size="xs"><h3>Workload</h3></EuiTitle>
          <EuiSpacer size="m" />
          <EuiFormRow label="Workload type">
            <EuiButtonGroup
              legend="Workload type"
              options={workloadOptions}
              idSelected={form.values.workloadType}
              onChange={(id) => form.setFieldValue('workloadType', id)}
            />
          </EuiFormRow>
          {form.values.workloadType === 'deployment' && (
            <EuiFormRow label="Replicas">
              <EuiFieldNumber
                value={form.fields.replicas.value as number}
                onChange={(e) => form.fields.replicas.onChange(parseInt(e.target.value, 10) || 1)}
                min={1}
                max={100}
              />
            </EuiFormRow>
          )}
        </EuiPanel>

        <EuiSpacer size="l" />

        <EuiPanel>
          <EuiTitle size="xs"><h3>Advanced Configuration</h3></EuiTitle>
          <EuiSpacer size="m" />
          <ComponentConfigurator
            type="agent"
            state={form.values.formState as ComponentFormState}
            onChange={handleFormStateChange}
            specFields={[]}
            esClusters={[]}
          />
        </EuiPanel>

        <EuiSpacer size="l" />
        <EuiFlexGroup justifyContent="flexEnd">
          <EuiFlexItem grow={false}>
            <EuiButtonEmpty onClick={() => navigate(`/agent/${namespace}/${name}`)}>
              Cancel
            </EuiButtonEmpty>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiButton type="submit" fill isLoading={form.isSubmitting}>
              Save Changes
            </EuiButton>
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiForm>
    </>
  );
}

export function AgentEditPage() {
  const { namespace, name } = useParams<{ namespace: string; name: string }>();
  const { data: resource, isLoading, error: loadError } = useResource<Agent>(
    'agent',
    namespace || '',
    name || '',
  );

  if (isLoading) return <DetailSkeleton />;
  if (loadError || !resource) {
    return (
      <EuiCallOut title="Failed to load" color="danger" iconType="error">
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
