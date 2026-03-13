import { EuiFlexGroup, EuiFlexItem } from '@elastic/eui';
import { DeploymentCard } from './DeploymentCard';
import type { Deployment } from '../../types/deployment';

interface DeploymentCardGridProps {
  deployments: Deployment[];
}

export function DeploymentCardGrid({ deployments }: DeploymentCardGridProps) {
  return (
    <EuiFlexGroup wrap gutterSize="l">
      {deployments.map((d) => (
        <EuiFlexItem key={`${d.namespace}/${d.name}`} grow={false} style={{ minWidth: 320, maxWidth: 400 }}>
          <DeploymentCard deployment={d} />
        </EuiFlexItem>
      ))}
    </EuiFlexGroup>
  );
}
