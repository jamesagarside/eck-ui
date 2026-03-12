import { useNavigate } from 'react-router-dom';
import {
  EuiPageHeader, EuiSpacer, EuiForm, EuiFormRow, EuiFieldText, EuiFieldNumber,
  EuiButton, EuiButtonEmpty, EuiFlexGroup, EuiFlexItem, EuiPanel, EuiTitle,
} from '@elastic/eui';
import { useCreateResource } from '../../hooks/useResources';
import { useVersions } from '../../hooks/useVersions';
import { VersionSelect } from '../../components/form/VersionSelect';
import { useToast } from '../../context/ToastContext';
import { useResourceForm } from '../../hooks/useResourceForm';
import { UnsavedChangesPrompt } from '../../hooks/useUnsavedChanges';
import { validateK8sName, validateRequired } from '../../utils/validators';

interface LogstashFormValues {
  name: string;
  namespace: string;
  version: string;
  count: number;
  esRef: string;
}

function validateLogstashForm(values: LogstashFormValues): Partial<Record<keyof LogstashFormValues, string>> {
  const errors: Partial<Record<keyof LogstashFormValues, string>> = {};
  const nameError = validateK8sName(values.name);
  if (nameError) errors.name = nameError;
  const nsError = validateRequired(values.namespace, 'Namespace');
  if (nsError) errors.namespace = nsError;
  const versionError = validateRequired(values.version, 'Version');
  if (versionError) errors.version = versionError;
  return errors;
}

export function LogstashCreatePage() {
  const navigate = useNavigate();
  const createMutation = useCreateResource('logstash');
  const { addToast } = useToast();
  const { defaultVersion } = useVersions();

  const form = useResourceForm<LogstashFormValues>({
    initialValues: {
      name: '',
      namespace: 'default',
      version: defaultVersion,
      count: 1,
      esRef: '',
    },
    validate: validateLogstashForm,
    onSubmit: async (values) => {
      try {
        await createMutation.mutateAsync({
          apiVersion: 'logstash.k8s.elastic.co/v1alpha1',
          kind: 'Logstash',
          metadata: { name: values.name, namespace: values.namespace },
          spec: {
            version: values.version,
            count: values.count,
            ...(values.esRef ? { elasticsearchRefs: [{ name: values.esRef }] } : {}),
          },
        });
        addToast({ title: `Logstash '${values.name}' created successfully`, color: 'success' });
        navigate('/logstash');
      } catch (err) {
        addToast({ title: 'Failed to create Logstash', color: 'danger', text: err instanceof Error ? err.message : 'An unexpected error occurred' });
      }
    },
  });

  return (
    <>
      <UnsavedChangesPrompt isDirty={form.isDirty} />
      <EuiPageHeader pageTitle="Create Logstash" iconType="logoLogstash" />
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
              placeholder="my-logstash"
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
          <EuiFormRow label="Count">
            <EuiFieldNumber
              value={form.fields.count.value as number}
              onChange={(e) => form.fields.count.onChange(parseInt(e.target.value, 10) || 1)}
              min={1}
            />
          </EuiFormRow>
          <EuiFormRow label="Elasticsearch Reference (optional)">
            <EuiFieldText
              value={form.fields.esRef.value as string}
              onChange={(e) => form.fields.esRef.onChange(e.target.value)}
              placeholder="my-elasticsearch"
            />
          </EuiFormRow>
        </EuiPanel>
        <EuiSpacer size="l" />
        <EuiFlexGroup justifyContent="flexEnd">
          <EuiFlexItem grow={false}>
            <EuiButtonEmpty onClick={() => navigate('/logstash')}>Cancel</EuiButtonEmpty>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiButton type="submit" fill isLoading={form.isSubmitting}>Create Logstash</EuiButton>
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiForm>
    </>
  );
}
