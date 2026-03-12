import { useState } from 'react';
import {
  EuiPageHeader,
  EuiSpacer,
  EuiBasicTable,
  EuiBadge,
  EuiButton,
  EuiFlexGroup,
  EuiFlexItem,
  EuiStat,
  EuiPanel,
  EuiFlyout,
  EuiFlyoutHeader,
  EuiFlyoutBody,
  EuiFlyoutFooter,
  EuiTitle,
  EuiFormRow,
  EuiFieldText,
  EuiTextArea,
  EuiCallOut,
  EuiButtonEmpty,
  EuiLoadingSpinner,
  type EuiBasicTableColumn,
} from '@elastic/eui';
import {
  useVersions,
  useUpdateVersions,
  useSyncVersions,
} from '../../hooks/useVersions';

interface VersionRow {
  value: string;
  label: string;
}

export function VersionManagementPage() {
  const { versions, defaultVersion, operatorVersion, source, isLoading } =
    useVersions();
  const updateMutation = useUpdateVersions();
  const syncMutation = useSyncVersions();

  const [isFlyoutOpen, setIsFlyoutOpen] = useState(false);
  const [editDefaultVersion, setEditDefaultVersion] = useState('');
  const [editVersionList, setEditVersionList] = useState('');
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSync = () => {
    setSyncSuccess(false);
    syncMutation.mutate(undefined, {
      onSuccess: () => setSyncSuccess(true),
    });
  };

  const openEditFlyout = () => {
    setEditDefaultVersion(defaultVersion);
    setEditVersionList(versions.map((v) => v.value).join('\n'));
    setSaveSuccess(false);
    setIsFlyoutOpen(true);
  };

  const handleSave = () => {
    const versionLines = editVersionList
      .split(/[\n,]/)
      .map((v) => v.trim())
      .filter(Boolean);

    updateMutation.mutate(
      { defaultVersion: editDefaultVersion, versions: versionLines },
      {
        onSuccess: () => {
          setSaveSuccess(true);
          setTimeout(() => setIsFlyoutOpen(false), 1000);
        },
      },
    );
  };

  const columns: EuiBasicTableColumn<VersionRow>[] = [
    {
      field: 'value',
      name: 'Version',
      sortable: true,
    },
    {
      field: 'label',
      name: 'Label',
    },
    {
      field: 'value',
      name: 'Default',
      width: '120px',
      render: (value: string) =>
        value === defaultVersion ? (
          <EuiBadge color="primary">Default</EuiBadge>
        ) : null,
    },
  ];

  if (isLoading) {
    return (
      <>
        <EuiPageHeader pageTitle="Version Management" iconType="package" />
        <EuiSpacer size="l" />
        <EuiLoadingSpinner size="xl" />
      </>
    );
  }

  return (
    <>
      <EuiPageHeader
        pageTitle="Version Management"
        iconType="package"
        rightSideItems={[
          <EuiButton
            key="edit"
            onClick={openEditFlyout}
            iconType="pencil"
          >
            Edit Versions
          </EuiButton>,
          <EuiButton
            key="sync"
            onClick={handleSync}
            isLoading={syncMutation.isPending}
            iconType="refresh"
            color="primary"
            fill
          >
            Sync from Elastic
          </EuiButton>,
        ]}
      />

      <EuiSpacer size="l" />

      {syncSuccess && (
        <>
          <EuiCallOut
            title="Versions synced from Elastic"
            color="success"
            iconType="check"
            size="s"
          />
          <EuiSpacer size="m" />
        </>
      )}

      {syncMutation.isError && (
        <>
          <EuiCallOut
            title="Sync failed"
            color="danger"
            iconType="error"
            size="s"
          >
            <p>
              {syncMutation.error instanceof Error
                ? syncMutation.error.message
                : 'An unexpected error occurred'}
            </p>
          </EuiCallOut>
          <EuiSpacer size="m" />
        </>
      )}

      <EuiFlexGroup gutterSize="l">
        <EuiFlexItem>
          <EuiPanel>
            <EuiStat title={source || 'unknown'} description="Source" titleSize="s" />
          </EuiPanel>
        </EuiFlexItem>
        <EuiFlexItem>
          <EuiPanel>
            <EuiStat
              title={defaultVersion}
              description="Default Version"
              titleSize="s"
              titleColor="primary"
            />
          </EuiPanel>
        </EuiFlexItem>
        <EuiFlexItem>
          <EuiPanel>
            <EuiStat
              title={operatorVersion || 'N/A'}
              description="Operator Version"
              titleSize="s"
            />
          </EuiPanel>
        </EuiFlexItem>
        <EuiFlexItem>
          <EuiPanel>
            <EuiStat
              title={String(versions.length)}
              description="Total Versions"
              titleSize="s"
            />
          </EuiPanel>
        </EuiFlexItem>
      </EuiFlexGroup>

      <EuiSpacer size="l" />

      <EuiBasicTable<VersionRow>
        items={versions}
        columns={columns}
        rowHeader="value"
        tableCaption="Elastic Stack versions"
      />

      {isFlyoutOpen && (
        <EuiFlyout
          onClose={() => setIsFlyoutOpen(false)}
          size="s"
          ownFocus
          aria-labelledby="editVersionsFlyoutTitle"
        >
          <EuiFlyoutHeader hasBorder>
            <EuiTitle size="m">
              <h2 id="editVersionsFlyoutTitle">Edit Versions</h2>
            </EuiTitle>
          </EuiFlyoutHeader>

          <EuiFlyoutBody>
            {saveSuccess && (
              <>
                <EuiCallOut
                  title="Versions updated"
                  color="success"
                  iconType="check"
                  size="s"
                />
                <EuiSpacer size="m" />
              </>
            )}

            {updateMutation.isError && (
              <>
                <EuiCallOut
                  title="Save failed"
                  color="danger"
                  iconType="error"
                  size="s"
                >
                  <p>
                    {updateMutation.error instanceof Error
                      ? updateMutation.error.message
                      : 'An unexpected error occurred'}
                  </p>
                </EuiCallOut>
                <EuiSpacer size="m" />
              </>
            )}

            <EuiFormRow label="Default Version">
              <EuiFieldText
                value={editDefaultVersion}
                onChange={(e) => setEditDefaultVersion(e.target.value)}
                placeholder="e.g. 8.17.0"
              />
            </EuiFormRow>

            <EuiSpacer size="m" />

            <EuiFormRow
              label="Versions"
              helpText="One version per line"
            >
              <EuiTextArea
                value={editVersionList}
                onChange={(e) => setEditVersionList(e.target.value)}
                rows={12}
                placeholder="8.17.0&#10;8.16.1&#10;8.15.3"
              />
            </EuiFormRow>
          </EuiFlyoutBody>

          <EuiFlyoutFooter>
            <EuiFlexGroup justifyContent="spaceBetween">
              <EuiFlexItem grow={false}>
                <EuiButtonEmpty onClick={() => setIsFlyoutOpen(false)}>
                  Cancel
                </EuiButtonEmpty>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiButton
                  onClick={handleSave}
                  isLoading={updateMutation.isPending}
                  fill
                >
                  Save
                </EuiButton>
              </EuiFlexItem>
            </EuiFlexGroup>
          </EuiFlyoutFooter>
        </EuiFlyout>
      )}
    </>
  );
}
