import { useNavigate } from 'react-router-dom';
import {
  EuiPageHeader,
  EuiButton,
  EuiFlexGroup,
  EuiFlexItem,
  EuiCard,
  EuiBadge,
  EuiText,
  EuiSpacer,
  EuiEmptyPrompt,
  EuiStat,
} from '@elastic/eui';
import { useClusters } from '../../hooks/useClusters';
import { useUserRole, hasMinRole } from '../../hooks/useUserRole';
import { ListSkeleton } from '../../components/common/Skeletons';
import { ErrorCallout } from '../../components/common/ErrorCallout';
import type { Cluster } from '../../types/clusters';

const PHASE_COLORS: Record<string, 'success' | 'danger' | 'warning' | 'default'> = {
  Connected: 'success',
  Disconnected: 'danger',
  Error: 'warning',
};

function ClusterCard({ cluster, onClick }: { cluster: Cluster; onClick: () => void }) {
  const totalResources = cluster.status.resourceCounts
    ? Object.values(cluster.status.resourceCounts).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <EuiCard
      title={cluster.displayName || cluster.name}
      description=""
      onClick={onClick}
      paddingSize="m"
      hasBorder
      footer={
        <EuiFlexGroup gutterSize="s" alignItems="center" wrap responsive={false}>
          <EuiFlexItem grow={false}>
            <EuiBadge color={PHASE_COLORS[cluster.status.phase] || 'default'}>
              {cluster.status.phase || 'Unknown'}
            </EuiBadge>
          </EuiFlexItem>
          {cluster.status.version && (
            <EuiFlexItem grow={false}>
              <EuiText size="xs" color="subdued">
                K8s {cluster.status.version}
              </EuiText>
            </EuiFlexItem>
          )}
          {cluster.status.eckVersion && (
            <EuiFlexItem grow={false}>
              <EuiText size="xs" color="subdued">
                ECK {cluster.status.eckVersion}
              </EuiText>
            </EuiFlexItem>
          )}
        </EuiFlexGroup>
      }
    >
      <EuiFlexGroup gutterSize="l" alignItems="center">
        <EuiFlexItem grow={false}>
          <EuiStat
            title={totalResources}
            description="Resources"
            titleSize="s"
            isLoading={false}
          />
        </EuiFlexItem>
        {cluster.status.lastHealthCheck && (
          <EuiFlexItem>
            <EuiText size="xs" color="subdued">
              Last check:{' '}
              {new Date(cluster.status.lastHealthCheck).toLocaleTimeString()}
            </EuiText>
          </EuiFlexItem>
        )}
      </EuiFlexGroup>
    </EuiCard>
  );
}

export function ClusterListPage() {
  const navigate = useNavigate();
  const role = useUserRole();
  const { data, isLoading, error, refetch } = useClusters();
  const clusters = data?.items || [];
  const isAdmin = hasMinRole(role, 'platform-admin');

  if (isLoading && !data) return <ListSkeleton />;

  return (
    <>
      <EuiPageHeader
        pageTitle="Clusters"
        rightSideItems={
          isAdmin
            ? [
                <EuiButton
                  key="register"
                  fill
                  iconType="plusInCircle"
                  onClick={() => navigate('/clusters/register')}
                >
                  Register Cluster
                </EuiButton>,
              ]
            : []
        }
      />
      <EuiSpacer size="l" />

      {error && (
        <>
          <ErrorCallout error={error} onRetry={refetch} />
          <EuiSpacer size="m" />
        </>
      )}

      {clusters.length === 0 ? (
        <EuiEmptyPrompt
          iconType="cluster"
          title={<h2>No clusters registered</h2>}
          body={
            <p>
              Register a workload cluster to manage ECK resources across
              multiple Kubernetes clusters.
            </p>
          }
          actions={
            isAdmin
              ? [
                  <EuiButton
                    key="register"
                    fill
                    iconType="plusInCircle"
                    onClick={() => navigate('/clusters/register')}
                  >
                    Register Cluster
                  </EuiButton>,
                ]
              : []
          }
        />
      ) : (
        <EuiFlexGroup wrap gutterSize="l">
          {clusters.map((cluster) => (
            <EuiFlexItem
              key={cluster.name}
              style={{ minWidth: 300, maxWidth: 400 }}
            >
              <ClusterCard
                cluster={cluster}
                onClick={() => navigate(`/clusters/${cluster.name}`)}
              />
            </EuiFlexItem>
          ))}
        </EuiFlexGroup>
      )}
    </>
  );
}
