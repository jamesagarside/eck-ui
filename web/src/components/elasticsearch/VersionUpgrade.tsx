import { useState, useCallback } from 'react';
import {
  EuiButton,
  EuiConfirmModal,
  EuiFieldNumber,
  EuiFlexGroup,
  EuiFlexItem,
  EuiFormRow,
  EuiHealth,
  EuiPanel,
  EuiSelect,
  EuiSpacer,
  EuiSteps,
  EuiText,
  EuiTitle,
  type EuiStepProps,
} from '@elastic/eui';
import { useUpdateResource, useResource } from '../../hooks/useResources';
import { useVersions } from '../../hooks/useVersions';
import type { Elasticsearch } from '../../types/resources';

type UpgradeStatus = 'idle' | 'confirming' | 'upgrading' | 'complete' | 'error';

interface VersionUpgradeProps {
  currentVersion: string;
  resourceName: string;
  namespace: string;
}

export function VersionUpgrade({
  currentVersion,
  resourceName,
  namespace,
}: VersionUpgradeProps) {
  const [targetVersion, setTargetVersion] = useState('');
  const [maxSurge, setMaxSurge] = useState(1);
  const [maxUnavailable, setMaxUnavailable] = useState(1);
  const [status, setStatus] = useState<UpgradeStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const updateMutation = useUpdateResource('elasticsearch');
  const { data: resource } = useResource<Elasticsearch>(
    'elasticsearch',
    namespace,
    resourceName,
  );
  const { versions, isLoading: versionsLoading } = useVersions();

  const availableUpgrades = (versions.length > 0
    ? versions.map((v) => ({ value: v.value, text: v.label }))
    : [{ value: '8.17.0', text: '8.17.0' }]
  ).filter((v) => v.value !== currentVersion);

  const isUpgradeValid = targetVersion !== '' && targetVersion !== currentVersion;

  const handleStartUpgrade = useCallback(() => {
    if (!isUpgradeValid) return;
    setStatus('confirming');
  }, [isUpgradeValid]);

  const handleConfirmUpgrade = useCallback(async () => {
    if (!resource) return;

    setStatus('upgrading');
    setErrorMessage('');

    try {
      const updated = {
        ...resource,
        spec: {
          ...resource.spec,
          version: targetVersion,
          updateStrategy: {
            changeBudget: {
              maxSurge,
              maxUnavailable,
            },
          },
        },
      };

      await updateMutation.mutateAsync({
        namespace,
        name: resourceName,
        resource: updated,
      });

      setStatus('complete');
    } catch (err) {
      setStatus('error');
      setErrorMessage(
        err instanceof Error ? err.message : 'Upgrade failed',
      );
    }
  }, [
    resource,
    targetVersion,
    maxSurge,
    maxUnavailable,
    namespace,
    resourceName,
    updateMutation,
  ]);

  const handleCancelConfirmation = useCallback(() => {
    setStatus('idle');
  }, []);

  const handleReset = useCallback(() => {
    setStatus('idle');
    setTargetVersion('');
    setErrorMessage('');
  }, []);

  const steps: EuiStepProps[] = [
    {
      title: 'Select target version',
      status: status === 'idle' ? 'current' : 'complete',
      children: (
        <EuiFormRow
          label="Target version"
          helpText={`Current version: ${currentVersion}`}
        >
          <EuiSelect
            options={[
              { value: '', text: 'Select a version...' },
              ...availableUpgrades,
            ]}
            value={targetVersion}
            onChange={(e) => setTargetVersion(e.target.value)}
            disabled={status !== 'idle'}
            isLoading={versionsLoading}
            aria-label="Select target Elasticsearch version"
          />
        </EuiFormRow>
      ),
    },
    {
      title: 'Configure change budget',
      status: status === 'idle' ? (targetVersion ? 'current' : 'incomplete') : 'complete',
      children: (
        <EuiFlexGroup gutterSize="m">
          <EuiFlexItem>
            <EuiFormRow
              label="Max surge"
              helpText="Maximum number of new pods that can be created above desired count"
            >
              <EuiFieldNumber
                value={maxSurge}
                onChange={(e) => setMaxSurge(parseInt(e.target.value, 10) || 0)}
                min={0}
                max={10}
                disabled={status !== 'idle'}
                aria-label="Maximum surge during upgrade"
              />
            </EuiFormRow>
          </EuiFlexItem>
          <EuiFlexItem>
            <EuiFormRow
              label="Max unavailable"
              helpText="Maximum number of pods that can be unavailable during upgrade"
            >
              <EuiFieldNumber
                value={maxUnavailable}
                onChange={(e) =>
                  setMaxUnavailable(parseInt(e.target.value, 10) || 0)
                }
                min={0}
                max={10}
                disabled={status !== 'idle'}
                aria-label="Maximum unavailable pods during upgrade"
              />
            </EuiFormRow>
          </EuiFlexItem>
        </EuiFlexGroup>
      ),
    },
    {
      title: 'Review and confirm',
      status:
        status === 'complete'
          ? 'complete'
          : status === 'upgrading'
            ? 'loading'
            : status === 'error'
              ? 'danger'
              : 'incomplete',
      children: (
        <>
          {status === 'complete' && (
            <>
              <EuiHealth color="success">
                Upgrade to {targetVersion} initiated. The cluster is applying
                changes.
              </EuiHealth>
              <EuiSpacer size="m" />
              <EuiButton size="s" onClick={handleReset}>
                Start another upgrade
              </EuiButton>
            </>
          )}
          {status === 'upgrading' && (
            <EuiHealth color="warning">
              Upgrading to {targetVersion}...
            </EuiHealth>
          )}
          {status === 'error' && (
            <>
              <EuiHealth color="danger">
                Upgrade failed: {errorMessage}
              </EuiHealth>
              <EuiSpacer size="m" />
              <EuiButton size="s" color="danger" onClick={handleReset}>
                Try again
              </EuiButton>
            </>
          )}
          {status === 'idle' && (
            <EuiText size="s" color="subdued">
              {isUpgradeValid
                ? `Ready to upgrade from ${currentVersion} to ${targetVersion}`
                : 'Select a target version to begin'}
            </EuiText>
          )}
        </>
      ),
    },
  ];

  return (
    <>
      <EuiPanel paddingSize="l">
        <EuiTitle size="xs">
          <h3>Version Upgrade</h3>
        </EuiTitle>
        <EuiSpacer size="m" />
        <EuiSteps steps={steps} />
        <EuiSpacer size="m" />
        <EuiFlexGroup justifyContent="flexEnd">
          <EuiFlexItem grow={false}>
            <EuiButton
              fill
              onClick={handleStartUpgrade}
              disabled={!isUpgradeValid || status !== 'idle'}
              isLoading={status === 'upgrading'}
              iconType="sortUp"
            >
              Upgrade
            </EuiButton>
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiPanel>

      {status === 'confirming' && (
        <EuiConfirmModal
          title="Confirm version upgrade"
          onCancel={handleCancelConfirmation}
          onConfirm={handleConfirmUpgrade}
          cancelButtonText="Cancel"
          confirmButtonText="Confirm upgrade"
          buttonColor="primary"
          isLoading={updateMutation.isPending}
        >
          <p>
            This will upgrade Elasticsearch cluster{' '}
            <strong>{resourceName}</strong> in namespace{' '}
            <strong>{namespace}</strong> from version{' '}
            <strong>{currentVersion}</strong> to{' '}
            <strong>{targetVersion}</strong>.
          </p>
          <p>
            Change budget: maxSurge={maxSurge}, maxUnavailable={maxUnavailable}
          </p>
          <p>
            The cluster will undergo a rolling restart. Ensure you have
            adequate resources and backups before proceeding.
          </p>
        </EuiConfirmModal>
      )}
    </>
  );
}
