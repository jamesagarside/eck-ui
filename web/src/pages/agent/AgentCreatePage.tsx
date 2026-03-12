import { useNavigate } from 'react-router-dom';
import {
  EuiPageHeader, EuiSpacer, EuiForm, EuiFormRow, EuiFieldText, EuiFieldNumber,
  EuiButton, EuiButtonEmpty, EuiButtonGroup, EuiFlexGroup, EuiFlexItem,
  EuiPanel, EuiTitle, EuiSelect,
} from '@elastic/eui';
import { useCreateResource } from '../../hooks/useResources';
import { useVersions } from '../../hooks/useVersions';
import { VersionSelect } from '../../components/form/VersionSelect';
import { ComponentConfigurator, defaultComponentFormState } from '../../components/deployment/ComponentConfigurator';
import type { ComponentFormState } from '../../components/deployment/ComponentConfigurator';
import { useNamespaceFleetServers } from '../../hooks/useNamespaceFleetServers';
import { formStateToAgentSpec } from '../../utils/agentFormMapping';
import type { AgentMode, WorkloadType } from '../../utils/agentFormMapping';
import { useToast } from '../../context/ToastContext';
import { useResourceForm } from '../../hooks/useResourceForm';
import { UnsavedChangesPrompt } from '../../hooks/useUnsavedChanges';
import { validateK8sName, validateRequired } from '../../utils/validators';

const modeOptions = [
  { id: 'standalone', label: 'Standalone' },
  { id: 'fleet-connected', label: 'Fleet-connected' },
];

const workloadOptions = [
  { id: 'daemonSet', label: 'DaemonSet' },
  { id: 'deployment', label: 'Deployment' },
];

interface AgentFormValues {
  name: string;
  namespace: string;
  version: string;
  mode: AgentMode;
  workloadType: WorkloadType;
  replicas: number;
  fleetServerRef: string;
  kibanaRef: string;
  formState: ComponentFormState;
}

function validateAgentForm(values: AgentFormValues): Partial<Record<keyof AgentFormValues, string>> {
  const errors: Partial<Record<keyof AgentFormValues, string>> = {};
  const nameError = validateK8sName(values.name);
  if (nameError) errors.name = nameError;
  const nsError = validateRequired(values.namespace, 'Namespace');
  if (nsError) errors.namespace = nsError;
  const versionError = validateRequired(values.version, 'Version');
  if (versionError) errors.version = versionError;
  if (values.mode === 'fleet-connected' && !values.fleetServerRef) {
    errors.fleetServerRef = 'Required for Fleet-connected mode';
  }
  return errors;
}

export function AgentCreatePage() {
  const navigate = useNavigate();
  const createMutation = useCreateResource('agent');
  const { addToast } = useToast();
  const { defaultVersion } = useVersions();

  const form = useResourceForm<AgentFormValues>({
    initialValues: {
      name: '',
      namespace: 'default',
      version: defaultVersion,
      mode: 'standalone',
      workloadType: 'daemonSet',
      replicas: 1,
      fleetServerRef: '',
      kibanaRef: '',
      formState: defaultComponentFormState(),
    },
    validate: validateAgentForm,
    onSubmit: async (values) => {
      const stateWithReplicas: ComponentFormState = {
        ...(values.formState as ComponentFormState),
        count: values.workloadType === 'deployment' ? values.replicas : 1,
      };

      const agentSpec = formStateToAgentSpec(stateWithReplicas, values.mode, values.workloadType);

      const resource: Record<string, unknown> = {
        apiVersion: 'agent.k8s.elastic.co/v1alpha1',
        kind: 'Agent',
        metadata: { name: values.name, namespace: values.namespace },
        spec: {
          version: values.version,
          ...agentSpec,
        },
      };

      if (values.mode === 'fleet-connected') {
        const spec = resource.spec as Record<string, unknown>;
        spec.fleetServerRef = { name: values.fleetServerRef };
        if (values.kibanaRef) {
          spec.kibanaRef = { name: values.kibanaRef };
        }
      }

      try {
        await createMutation.mutateAsync(resource);
        addToast({ title: `Elastic Agent '${values.name}' created successfully`, color: 'success' });
        navigate('/agent');
      } catch (err) {
        addToast({ title: 'Failed to create Elastic Agent', color: 'danger', text: err instanceof Error ? err.message : 'An unexpected error occurred' });
      }
    },
  });

  const { fleetServers } = useNamespaceFleetServers(form.values.namespace);

  const handleFormStateChange = (updates: Partial<ComponentFormState>) => {
    const current = form.values.formState as ComponentFormState;
    form.setFieldValue('formState', { ...current, ...updates });
  };

  return (
    <>
      <UnsavedChangesPrompt isDirty={form.isDirty} />
      <EuiPageHeader pageTitle="Create Elastic Agent" iconType="logoSecurity" />
      <EuiSpacer size="l" />
      <EuiForm component="form" onSubmit={form.handleSubmit}>
        <EuiPanel>
          <EuiTitle size="xs"><h3>General</h3></EuiTitle>
          <EuiSpacer size="m" />
          <EuiFormRow label="Name" isInvalid={form.fields.name.isInvalid} error={form.fields.name.error}>
            <EuiFieldText
              value={form.fields.name.value as string}
              onChange={(e) => form.fields.name.onChange(e.target.value)}
              onBlur={form.fields.name.onBlur}
              isInvalid={form.fields.name.isInvalid}
              placeholder="my-agent"
            />
          </EuiFormRow>
          <EuiFormRow label="Namespace" isInvalid={form.fields.namespace.isInvalid} error={form.fields.namespace.error}>
            <EuiFieldText
              value={form.fields.namespace.value as string}
              onChange={(e) => form.fields.namespace.onChange(e.target.value)}
              onBlur={form.fields.namespace.onBlur}
              isInvalid={form.fields.namespace.isInvalid}
            />
          </EuiFormRow>
          <EuiFormRow label="Version" isInvalid={form.fields.version.isInvalid} error={form.fields.version.error}>
            <VersionSelect
              value={form.fields.version.value as string}
              onChange={(v) => form.fields.version.onChange(v)}
              isInvalid={form.fields.version.isInvalid}
            />
          </EuiFormRow>
        </EuiPanel>

        <EuiSpacer size="l" />

        <EuiPanel>
          <EuiFlexGroup alignItems="center" justifyContent="spaceBetween">
            <EuiFlexItem grow={false}>
              <EuiTitle size="xs"><h3>Agent Mode</h3></EuiTitle>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiButtonEmpty
                iconType="plusInCircle"
                size="s"
                onClick={() => navigate('/fleet-server/create')}
              >
                Create Fleet Server instead
              </EuiButtonEmpty>
            </EuiFlexItem>
          </EuiFlexGroup>
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
              <EuiFormRow
                label="Fleet Server Reference"
                isInvalid={form.fields.fleetServerRef.isInvalid}
                error={form.fields.fleetServerRef.error}
              >
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
                  isInvalid={form.fields.fleetServerRef.isInvalid}
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
            <EuiButtonEmpty onClick={() => navigate('/agent')}>Cancel</EuiButtonEmpty>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiButton type="submit" fill isLoading={form.isSubmitting}>
              Create Agent
            </EuiButton>
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiForm>
    </>
  );
}
