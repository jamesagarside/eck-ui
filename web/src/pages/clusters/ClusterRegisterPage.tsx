import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EuiPageHeader,
  EuiSpacer,
  EuiStepsHorizontal,
  EuiPanel,
  EuiForm,
  EuiFormRow,
  EuiFieldText,
  EuiTextArea,
  EuiRadioGroup,
  EuiComboBox,
  EuiButton,
  EuiButtonEmpty,
  EuiFlexGroup,
  EuiFlexItem,
  EuiDescriptionList,
  EuiCallOut,
  EuiText,
  type EuiComboBoxOptionOption,
} from '@elastic/eui';
import { useCreateCluster } from '../../hooks/useClusters';
import type { CreateClusterRequest } from '../../types/clusters';

type CredentialType = 'token' | 'kubeconfig';

interface FormState {
  name: string;
  displayName: string;
  apiServerURL: string;
  caBundle: string;
  credentialType: CredentialType;
  credentialValue: string;
  allowedGroups: EuiComboBoxOptionOption[];
}

const INITIAL_STATE: FormState = {
  name: '',
  displayName: '',
  apiServerURL: '',
  caBundle: '',
  credentialType: 'token',
  credentialValue: '',
  allowedGroups: [],
};

const CREDENTIAL_OPTIONS = [
  { id: 'token', label: 'Bearer Token' },
  { id: 'kubeconfig', label: 'Kubeconfig' },
];

const STEP_COUNT = 4;

function ConnectionStep({
  form,
  onChange,
  errors,
}: {
  form: FormState;
  onChange: (patch: Partial<FormState>) => void;
  errors: Record<string, string>;
}) {
  return (
    <EuiForm>
      <EuiFormRow
        label="Cluster Name"
        helpText="A unique identifier for this cluster (lowercase, no spaces)"
        isInvalid={Boolean(errors.name)}
        error={errors.name}
      >
        <EuiFieldText
          value={form.name}
          onChange={(e) => onChange({ name: e.target.value })}
          isInvalid={Boolean(errors.name)}
          aria-label="Cluster name"
        />
      </EuiFormRow>

      <EuiFormRow label="Display Name" helpText="Optional friendly name">
        <EuiFieldText
          value={form.displayName}
          onChange={(e) => onChange({ displayName: e.target.value })}
          aria-label="Display name"
        />
      </EuiFormRow>

      <EuiFormRow
        label="API Server URL"
        helpText="The Kubernetes API server endpoint (e.g. https://10.0.0.1:6443)"
        isInvalid={Boolean(errors.apiServerURL)}
        error={errors.apiServerURL}
      >
        <EuiFieldText
          value={form.apiServerURL}
          onChange={(e) => onChange({ apiServerURL: e.target.value })}
          isInvalid={Boolean(errors.apiServerURL)}
          aria-label="API server URL"
        />
      </EuiFormRow>

      <EuiFormRow
        label="CA Bundle"
        helpText="Optional PEM-encoded certificate authority bundle for the API server"
      >
        <EuiTextArea
          value={form.caBundle}
          onChange={(e) => onChange({ caBundle: e.target.value })}
          rows={6}
          aria-label="CA bundle"
        />
      </EuiFormRow>
    </EuiForm>
  );
}

function CredentialsStep({
  form,
  onChange,
  errors,
}: {
  form: FormState;
  onChange: (patch: Partial<FormState>) => void;
  errors: Record<string, string>;
}) {
  return (
    <EuiForm>
      <EuiFormRow label="Credential Type">
        <EuiRadioGroup
          options={CREDENTIAL_OPTIONS}
          idSelected={form.credentialType}
          onChange={(id) => onChange({ credentialType: id as CredentialType })}
        />
      </EuiFormRow>

      <EuiFormRow
        label={
          form.credentialType === 'token'
            ? 'Bearer Token'
            : 'Kubeconfig Content'
        }
        helpText={
          form.credentialType === 'token'
            ? 'A service account token with cluster-level read access'
            : 'Full kubeconfig YAML content'
        }
        isInvalid={Boolean(errors.credentialValue)}
        error={errors.credentialValue}
      >
        <EuiTextArea
          value={form.credentialValue}
          onChange={(e) => onChange({ credentialValue: e.target.value })}
          rows={8}
          isInvalid={Boolean(errors.credentialValue)}
          aria-label="Credential value"
        />
      </EuiFormRow>
    </EuiForm>
  );
}

function AccessControlStep({
  form,
  onChange,
}: {
  form: FormState;
  onChange: (patch: Partial<FormState>) => void;
}) {
  const onCreateOption = (searchValue: string) => {
    const normalizedValue = searchValue.trim().toLowerCase();
    if (!normalizedValue) return;
    const newOption: EuiComboBoxOptionOption = { label: normalizedValue };
    onChange({ allowedGroups: [...form.allowedGroups, newOption] });
  };

  return (
    <EuiForm>
      <EuiFormRow
        label="Allowed Groups"
        helpText="Restrict which user groups can view this cluster. Leave empty to allow all authenticated users."
      >
        <EuiComboBox
          selectedOptions={form.allowedGroups}
          onChange={(selected) => onChange({ allowedGroups: selected })}
          onCreateOption={onCreateOption}
          placeholder="Type a group name and press Enter"
          aria-label="Allowed groups"
        />
      </EuiFormRow>

      <EuiSpacer />

      <EuiText size="s" color="subdued">
        <p>
          Groups are matched against the Kubernetes groups in the
          user&apos;s authentication token. Users with the{' '}
          <strong>platform-admin</strong> role always have access to all
          clusters regardless of group restrictions.
        </p>
      </EuiText>
    </EuiForm>
  );
}

function ReviewStep({ form }: { form: FormState }) {
  const listItems = [
    { title: 'Cluster Name', description: form.name },
    { title: 'Display Name', description: form.displayName || '(none)' },
    { title: 'API Server URL', description: form.apiServerURL },
    {
      title: 'CA Bundle',
      description: form.caBundle ? 'Provided' : 'Not provided',
    },
    { title: 'Credential Type', description: form.credentialType },
    {
      title: 'Credential',
      description: form.credentialValue ? 'Provided' : 'Not provided',
    },
    {
      title: 'Allowed Groups',
      description:
        form.allowedGroups.length > 0
          ? form.allowedGroups.map((g) => g.label).join(', ')
          : 'All users',
    },
  ];

  return <EuiDescriptionList listItems={listItems} type="column" />;
}

function validateStep(step: number, form: FormState): Record<string, string> {
  const errors: Record<string, string> = {};

  if (step === 0) {
    if (!form.name.trim()) {
      errors.name = 'Cluster name is required';
    } else if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(form.name)) {
      errors.name =
        'Must be lowercase alphanumeric with optional hyphens, cannot start or end with a hyphen';
    }
    if (!form.apiServerURL.trim()) {
      errors.apiServerURL = 'API server URL is required';
    } else if (
      !form.apiServerURL.startsWith('https://') &&
      !form.apiServerURL.startsWith('http://')
    ) {
      errors.apiServerURL = 'Must be a valid URL starting with https:// or http://';
    }
  }

  if (step === 1) {
    if (!form.credentialValue.trim()) {
      errors.credentialValue = 'Credential value is required';
    }
  }

  return errors;
}

export function ClusterRegisterPage() {
  const navigate = useNavigate();
  const createCluster = useCreateCluster();
  const [currentStep, setCurrentStep] = useState(0);
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const onChange = (patch: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setErrors({});
  };

  const canGoNext = () => {
    const stepErrors = validateStep(currentStep, form);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (canGoNext() && currentStep < STEP_COUNT - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setErrors({});
    }
  };

  const handleSubmit = () => {
    const request: CreateClusterRequest = {
      name: form.name.trim(),
      apiServerURL: form.apiServerURL.trim(),
      credentialType: form.credentialType,
      credentialValue: form.credentialValue.trim(),
    };

    if (form.displayName.trim()) {
      request.displayName = form.displayName.trim();
    }
    if (form.caBundle.trim()) {
      request.caBundle = form.caBundle.trim();
    }
    if (form.allowedGroups.length > 0) {
      request.allowedGroups = form.allowedGroups.map((g) => g.label);
    }

    createCluster.mutate(request, {
      onSuccess: () => navigate('/clusters'),
    });
  };

  const steps = [
    {
      title: 'Connection',
      status: currentStep > 0 ? ('complete' as const) : undefined,
      onClick: () => {
        if (currentStep > 0) setCurrentStep(0);
      },
    },
    {
      title: 'Credentials',
      status: currentStep > 1 ? ('complete' as const) : undefined,
      onClick: () => {
        if (currentStep > 1) setCurrentStep(1);
      },
    },
    {
      title: 'Access Control',
      status: currentStep > 2 ? ('complete' as const) : undefined,
      onClick: () => {
        if (currentStep > 2) setCurrentStep(2);
      },
    },
    {
      title: 'Review',
      onClick: () => {},
    },
  ];

  const stepContent = [
    <ConnectionStep
      key="connection"
      form={form}
      onChange={onChange}
      errors={errors}
    />,
    <CredentialsStep
      key="credentials"
      form={form}
      onChange={onChange}
      errors={errors}
    />,
    <AccessControlStep key="access" form={form} onChange={onChange} />,
    <ReviewStep key="review" form={form} />,
  ];

  const isLastStep = currentStep === STEP_COUNT - 1;

  return (
    <>
      <EuiPageHeader
        pageTitle="Register Cluster"
        description="Connect a workload Kubernetes cluster to manage its ECK resources."
      />
      <EuiSpacer size="l" />

      <EuiStepsHorizontal steps={steps} />
      <EuiSpacer size="l" />

      <EuiPanel paddingSize="l" hasBorder>
        {createCluster.isError && (
          <>
            <EuiCallOut
              title="Registration failed"
              color="danger"
              iconType="alert"
              role="alert"
            >
              {(createCluster.error as Error).message}
            </EuiCallOut>
            <EuiSpacer />
          </>
        )}

        {stepContent[currentStep]}

        <EuiSpacer size="xl" />

        <EuiFlexGroup justifyContent="spaceBetween">
          <EuiFlexItem grow={false}>
            <EuiFlexGroup gutterSize="s">
              <EuiFlexItem grow={false}>
                <EuiButtonEmpty onClick={() => navigate('/clusters')}>
                  Cancel
                </EuiButtonEmpty>
              </EuiFlexItem>
              {currentStep > 0 && (
                <EuiFlexItem grow={false}>
                  <EuiButtonEmpty onClick={handleBack} iconType="arrowLeft">
                    Back
                  </EuiButtonEmpty>
                </EuiFlexItem>
              )}
            </EuiFlexGroup>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            {isLastStep ? (
              <EuiButton
                fill
                onClick={handleSubmit}
                isLoading={createCluster.isPending}
                iconType="check"
              >
                Register Cluster
              </EuiButton>
            ) : (
              <EuiButton fill onClick={handleNext} iconType="arrowRight" iconSide="right">
                Next
              </EuiButton>
            )}
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiPanel>
    </>
  );
}
