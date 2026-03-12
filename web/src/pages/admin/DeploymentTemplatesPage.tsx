import { useState } from 'react';
import {
  EuiPageHeader,
  EuiSpacer,
  EuiFlexGroup,
  EuiFlexItem,
  EuiCard,
  EuiCallOut,
  EuiFlyout,
  EuiFlyoutHeader,
  EuiFlyoutBody,
  EuiTitle,
  EuiCodeBlock,
  EuiBadge,
  EuiLoadingSpinner,
  EuiText,
  EuiEmptyPrompt,
} from '@elastic/eui';
import { useTemplates, type DeploymentTemplate } from '../../hooks/useTemplates';

export function DeploymentTemplatesPage() {
  const { templates, source, isLoading } = useTemplates();
  const [selectedTemplate, setSelectedTemplate] =
    useState<DeploymentTemplate | null>(null);

  const isBuiltIn = source === 'built-in';

  if (isLoading) {
    return (
      <>
        <EuiPageHeader pageTitle="Deployment Templates" iconType="layers" />
        <EuiSpacer size="l" />
        <EuiLoadingSpinner size="xl" />
      </>
    );
  }

  return (
    <>
      <EuiPageHeader
        pageTitle="Deployment Templates"
        iconType="layers"
        description={
          source ? (
            <>
              Source: <EuiBadge color={isBuiltIn ? 'hollow' : 'primary'}>{source}</EuiBadge>
            </>
          ) : undefined
        }
      />

      <EuiSpacer size="l" />

      {isBuiltIn && (
        <>
          <EuiCallOut
            title="Built-in templates are read-only"
            iconType="iInCircle"
            color="primary"
            size="s"
          >
            <p>
              These templates are compiled into the application. To customize
              templates, create a ConfigMap with your template definitions.
            </p>
          </EuiCallOut>
          <EuiSpacer size="l" />
        </>
      )}

      {templates.length === 0 ? (
        <EuiEmptyPrompt
          iconType="layers"
          title={<h2>No templates found</h2>}
          body={
            <p>
              No deployment templates are currently configured. Templates define
              pre-built configurations for common deployment patterns.
            </p>
          }
        />
      ) : (
        <EuiFlexGroup gutterSize="l" wrap>
          {templates.map((template) => (
            <EuiFlexItem
              key={template.name}
              grow={false}
              style={{ minWidth: 280, maxWidth: 360 }}
            >
              <EuiCard
                icon={
                  <EuiText size="m">
                    <span role="img" aria-label={template.label}>
                      {template.icon || 'logoElastic'}
                    </span>
                  </EuiText>
                }
                title={template.label || template.name}
                description={template.description || 'No description'}
                onClick={() => setSelectedTemplate(template)}
                footer={
                  !isBuiltIn ? (
                    <EuiBadge color="hollow">Editable</EuiBadge>
                  ) : undefined
                }
              />
            </EuiFlexItem>
          ))}
        </EuiFlexGroup>
      )}

      {selectedTemplate && (
        <EuiFlyout
          onClose={() => setSelectedTemplate(null)}
          size="m"
          ownFocus
          aria-labelledby="templateDetailFlyoutTitle"
        >
          <EuiFlyoutHeader hasBorder>
            <EuiTitle size="m">
              <h2 id="templateDetailFlyoutTitle">
                {selectedTemplate.label || selectedTemplate.name}
              </h2>
            </EuiTitle>
            <EuiSpacer size="s" />
            <EuiText size="s" color="subdued">
              <p>{selectedTemplate.description}</p>
            </EuiText>
          </EuiFlyoutHeader>

          <EuiFlyoutBody>
            <EuiTitle size="xs">
              <h3>Template Intent</h3>
            </EuiTitle>
            <EuiSpacer size="s" />
            <EuiCodeBlock
              language="json"
              isCopyable
              overflowHeight={500}
              fontSize="s"
            >
              {JSON.stringify(selectedTemplate.intent, null, 2)}
            </EuiCodeBlock>
          </EuiFlyoutBody>
        </EuiFlyout>
      )}
    </>
  );
}
