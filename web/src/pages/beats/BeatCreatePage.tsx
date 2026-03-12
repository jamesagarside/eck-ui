import { useNavigate } from 'react-router-dom';
import {
  EuiPageHeader, EuiSpacer, EuiForm, EuiFormRow, EuiFieldText, EuiSelect,
  EuiButton, EuiButtonEmpty, EuiFlexGroup, EuiFlexItem, EuiPanel, EuiTitle,
} from '@elastic/eui';
import { useCreateResource } from '../../hooks/useResources';
import { useVersions } from '../../hooks/useVersions';
import { VersionSelect } from '../../components/form/VersionSelect';
import { useToast } from '../../context/ToastContext';
import { useResourceForm } from '../../hooks/useResourceForm';
import { UnsavedChangesPrompt } from '../../hooks/useUnsavedChanges';
import { validateK8sName, validateRequired } from '../../utils/validators';

const BEAT_TYPES = [
  { value: 'filebeat', text: 'Filebeat' },
  { value: 'metricbeat', text: 'Metricbeat' },
  { value: 'heartbeat', text: 'Heartbeat' },
  { value: 'auditbeat', text: 'Auditbeat' },
  { value: 'packetbeat', text: 'Packetbeat' },
];

interface BeatFormValues {
  name: string;
  namespace: string;
  version: string;
  beatType: string;
  elasticsearchRef: string;
}

function validateBeatForm(values: BeatFormValues): Partial<Record<keyof BeatFormValues, string>> {
  const errors: Partial<Record<keyof BeatFormValues, string>> = {};
  const nameError = validateK8sName(values.name);
  if (nameError) errors.name = nameError;
  const nsError = validateRequired(values.namespace, 'Namespace');
  if (nsError) errors.namespace = nsError;
  const versionError = validateRequired(values.version, 'Version');
  if (versionError) errors.version = versionError;
  const esRefError = validateRequired(values.elasticsearchRef, 'Elasticsearch reference');
  if (esRefError) errors.elasticsearchRef = esRefError;
  return errors;
}

export function BeatCreatePage() {
  const navigate = useNavigate();
  const createMutation = useCreateResource('beat');
  const { addToast } = useToast();
  const { defaultVersion } = useVersions();

  const form = useResourceForm<BeatFormValues>({
    initialValues: {
      name: '',
      namespace: 'default',
      version: defaultVersion,
      beatType: 'filebeat',
      elasticsearchRef: '',
    },
    validate: validateBeatForm,
    onSubmit: async (values) => {
      const resource = {
        apiVersion: 'beat.k8s.elastic.co/v1beta1',
        kind: 'Beat',
        metadata: { name: values.name, namespace: values.namespace },
        spec: {
          type: values.beatType,
          version: values.version,
          elasticsearchRef: { name: values.elasticsearchRef },
          daemonSet: {},
        },
      };
      try {
        await createMutation.mutateAsync(resource);
        addToast({ title: `Beat '${values.name}' created successfully`, color: 'success' });
        navigate('/beats');
      } catch (err) {
        addToast({ title: 'Failed to create Beat', color: 'danger', text: err instanceof Error ? err.message : 'An unexpected error occurred' });
      }
    },
  });

  return (
    <>
      <UnsavedChangesPrompt isDirty={form.isDirty} />
      <EuiPageHeader pageTitle="Create Beat" iconType="logoBeats" />
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
              placeholder="my-beat"
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
          <EuiFormRow label="Type">
            <EuiSelect
              options={BEAT_TYPES}
              value={form.fields.beatType.value as string}
              onChange={(e) => form.fields.beatType.onChange(e.target.value)}
            />
          </EuiFormRow>
          <EuiFormRow label="Version" isInvalid={form.fields.version.isInvalid} error={form.fields.version.error}>
            <VersionSelect
              value={form.fields.version.value as string}
              onChange={(v) => form.fields.version.onChange(v)}
              isInvalid={form.fields.version.isInvalid}
            />
          </EuiFormRow>
          <EuiFormRow label="Elasticsearch Reference" isInvalid={form.fields.elasticsearchRef.isInvalid} error={form.fields.elasticsearchRef.error}>
            <EuiFieldText
              value={form.fields.elasticsearchRef.value as string}
              onChange={(e) => form.fields.elasticsearchRef.onChange(e.target.value)}
              onBlur={form.fields.elasticsearchRef.onBlur}
              isInvalid={form.fields.elasticsearchRef.isInvalid}
              placeholder="my-elasticsearch"
            />
          </EuiFormRow>
        </EuiPanel>
        <EuiSpacer size="l" />
        <EuiFlexGroup justifyContent="flexEnd">
          <EuiFlexItem grow={false}>
            <EuiButtonEmpty onClick={() => navigate('/beats')}>Cancel</EuiButtonEmpty>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiButton type="submit" fill isLoading={form.isSubmitting}>Create Beat</EuiButton>
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiForm>
    </>
  );
}
