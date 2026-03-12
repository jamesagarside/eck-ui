import {
  EuiPageHeader,
  EuiSpacer,
  EuiDescriptionList,
  EuiBasicTable,
  EuiCallOut,
  EuiPanel,
  EuiTitle,
  EuiSkeletonText,
  type EuiBasicTableColumn,
  type EuiDescriptionListProps,
} from '@elastic/eui';
import { useSystemInfo } from '../../hooks/useSystemInfo';

interface CrdRow {
  name: string;
  apiVersion: string;
}

export function SystemInfoPage() {
  const { data, isLoading, error } = useSystemInfo();

  if (isLoading) {
    return (
      <>
        <EuiPageHeader pageTitle="System Information" iconType="gear" />
        <EuiSpacer size="l" />
        <EuiPanel>
          <EuiSkeletonText lines={6} />
        </EuiPanel>
      </>
    );
  }

  if (error) {
    return (
      <>
        <EuiPageHeader pageTitle="System Information" iconType="gear" />
        <EuiSpacer size="l" />
        <EuiCallOut title="Failed to load system information" color="danger" iconType="error">
          <p>{error instanceof Error ? error.message : 'An unexpected error occurred'}</p>
        </EuiCallOut>
      </>
    );
  }

  const infoItems: EuiDescriptionListProps['listItems'] = [
    {
      title: 'UI Version',
      description: data?.uiVersion || 'Unknown',
    },
    {
      title: 'Kubernetes Version',
      description: data?.k8sVersion || 'Unknown',
    },
    {
      title: 'ECK Operator Version',
      description: data?.operatorVersion || 'Not detected',
    },
  ];

  const crdItems: CrdRow[] = Object.entries(data?.crdVersions ?? {}).map(
    ([name, apiVersion]) => ({ name, apiVersion }),
  );

  const crdColumns: EuiBasicTableColumn<CrdRow>[] = [
    {
      field: 'name',
      name: 'CRD Name',
      sortable: true,
    },
    {
      field: 'apiVersion',
      name: 'API Version',
      width: '200px',
    },
  ];

  return (
    <>
      <EuiPageHeader pageTitle="System Information" iconType="gear" />

      <EuiSpacer size="l" />

      {!data?.operatorVersion && (
        <>
          <EuiCallOut
            title="ECK Operator not detected"
            color="warning"
            iconType="warning"
            size="s"
          >
            <p>
              The ECK operator version could not be determined. Ensure the
              operator is installed and running in the cluster.
            </p>
          </EuiCallOut>
          <EuiSpacer size="l" />
        </>
      )}

      <EuiPanel>
        <EuiDescriptionList
          type="column"
          listItems={infoItems}
          compressed
        />
      </EuiPanel>

      <EuiSpacer size="xl" />

      <EuiTitle size="s">
        <h3>CRD Versions</h3>
      </EuiTitle>

      <EuiSpacer size="m" />

      {crdItems.length > 0 ? (
        <EuiBasicTable<CrdRow>
          items={crdItems}
          columns={crdColumns}
          rowHeader="name"
          tableCaption="Custom Resource Definition versions"
        />
      ) : (
        <EuiCallOut
          title="No CRD versions available"
          color="primary"
          iconType="iInCircle"
          size="s"
        />
      )}
    </>
  );
}
