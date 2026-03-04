// Stack Deployment Wizard Page
import {
  EuiPageTemplate,
  EuiPageHeader,
  EuiStepsHorizontal,
  EuiButton,
  EuiButtonEmpty,
  EuiSpacer,
  EuiFlexGroup,
  EuiFlexItem,
} from '@elastic/eui';
import { useNavigate } from 'react-router-dom';
import { WizardProvider, useWizard } from './WizardContext';
import { ElasticsearchStep } from './ElasticsearchStep';
import { KibanaStep } from './KibanaStep';
import { IntegrationsStep } from './IntegrationsStep';
import { ReviewStep } from './ReviewStep';
import { WIZARD_STEPS } from './types';

function WizardContent() {
  const navigate = useNavigate();
  const { state, nextStep, prevStep, setStep, reset } = useWizard();
  const { currentStep } = state;

  const steps = WIZARD_STEPS.map((step, index) => ({
    title: step.title,
    status:
      index < currentStep
        ? ('complete' as const)
        : index === currentStep
          ? ('current' as const)
          : ('incomplete' as const),
    onClick: () => setStep(index),
  }));

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <ElasticsearchStep />;
      case 1:
        return <KibanaStep />;
      case 2:
        return <IntegrationsStep />;
      case 3:
        return <ReviewStep />;
      default:
        return <ElasticsearchStep />;
    }
  };

  const handleCancel = () => {
    reset();
    navigate('/');
  };

  return (
    <EuiPageTemplate>
      <EuiPageHeader
        pageTitle="Deploy Elastic Stack"
        description="Configure and deploy a complete Elastic Stack with all components"
        rightSideItems={[
          <EuiButtonEmpty key="cancel" onClick={handleCancel}>
            Cancel
          </EuiButtonEmpty>,
        ]}
      />

      <EuiPageTemplate.Section>
        <EuiStepsHorizontal steps={steps} />

        <EuiSpacer size="xl" />

        {renderStep()}

        <EuiSpacer size="xl" />

        {currentStep < 3 && (
          <EuiFlexGroup justifyContent="spaceBetween">
            <EuiFlexItem grow={false}>
              <EuiButtonEmpty onClick={prevStep} disabled={currentStep === 0} iconType="arrowLeft">
                Previous
              </EuiButtonEmpty>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiButton fill onClick={nextStep} iconType="arrowRight" iconSide="right">
                {currentStep === 2 ? 'Review' : 'Next'}
              </EuiButton>
            </EuiFlexItem>
          </EuiFlexGroup>
        )}
      </EuiPageTemplate.Section>
    </EuiPageTemplate>
  );
}

export function WizardPage() {
  return (
    <WizardProvider>
      <WizardContent />
    </WizardProvider>
  );
}
