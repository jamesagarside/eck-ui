import {
  EuiPageHeader,
  EuiSpacer,
  EuiStepsHorizontal,
} from '@elastic/eui';
import type { EuiStepHorizontalProps } from '@elastic/eui/src/components/steps/step_horizontal';
import { WizardProvider, useWizard } from './WizardContext';
import { ElasticsearchStep } from './ElasticsearchStep';
import { KibanaStep } from './KibanaStep';
import { IntegrationsStep } from './IntegrationsStep';
import { ReviewStep } from './ReviewStep';

function WizardContent() {
  const { state, setStep } = useWizard();
  const { currentStep } = state;

  const stepLabels = ['Elasticsearch', 'Kibana', 'Integrations', 'Review'];

  const steps: EuiStepHorizontalProps[] = stepLabels.map((title, index) => ({
    title,
    status:
      index < currentStep
        ? 'complete'
        : index === currentStep
          ? 'current'
          : 'incomplete',
    onClick: () => setStep(index),
  }));

  const stepComponents = [
    <ElasticsearchStep key="es" />,
    <KibanaStep key="kb" />,
    <IntegrationsStep key="int" />,
    <ReviewStep key="review" />,
  ];

  return (
    <>
      <EuiPageHeader
        pageTitle="Stack Deployment Wizard"
        description="Deploy a complete Elastic Stack with guided configuration"
      />
      <EuiSpacer size="l" />
      <EuiStepsHorizontal steps={steps} />
      <EuiSpacer size="xl" />
      {stepComponents[currentStep]}
    </>
  );
}

export function WizardPage() {
  return (
    <WizardProvider>
      <WizardContent />
    </WizardProvider>
  );
}
