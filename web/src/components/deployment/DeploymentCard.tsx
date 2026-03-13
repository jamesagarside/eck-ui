import {
  EuiCard,
  EuiBadge,
  EuiFlexGroup,
  EuiFlexItem,
  EuiButton,
  EuiCopy,
  EuiToolTip,
} from '@elastic/eui';
import { useNavigate } from 'react-router-dom';
import { extractEndpoints } from '../../utils/endpointExtractor';
import type { Deployment } from '../../types/deployment';

const TYPE_LABELS: Record<string, string> = {
  elasticsearch: 'ES',
  kibana: 'KB',
  apm: 'APM',
  agent: 'Agent',
  logstash: 'LS',
  beat: 'Beat',
  'enterprise-search': 'EntS',
  maps: 'Maps',
};

const HEALTH_BADGE_COLOR: Record<string, 'accent' | 'warning' | 'subdued' | 'hollow'> = {
  green: 'accent',
  yellow: 'warning',
  red: 'subdued',
  unknown: 'hollow',
};

interface DeploymentCardProps {
  deployment: Deployment;
}

export function DeploymentCard({ deployment }: DeploymentCardProps) {
  const navigate = useNavigate();
  const endpoints = extractEndpoints(deployment);

  return (
    <EuiCard
      title={deployment.name}
      description={`${deployment.namespace} · v${deployment.version}`}
      onClick={() => navigate(`/deployments/${deployment.namespace}/${deployment.name}`)}
      betaBadgeProps={{
        label: deployment.health,
        color: HEALTH_BADGE_COLOR[deployment.health] || 'default',
      }}
      footer={
        <>
          <EuiFlexGroup gutterSize="xs" wrap responsive={false}>
            {deployment.components.map((c) => (
              <EuiFlexItem grow={false} key={c.type}>
                <EuiBadge color="hollow">{TYPE_LABELS[c.type] || c.type}</EuiBadge>
              </EuiFlexItem>
            ))}
          </EuiFlexGroup>
          {endpoints.length > 0 && (
            <EuiFlexGroup gutterSize="xs" wrap responsive={false} style={{ marginTop: 8 }}>
              {endpoints.map((ep) => (
                <EuiFlexItem grow={false} key={ep.type}>
                  {ep.action === 'link' ? (
                    <EuiButton
                      href={ep.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      iconType="popout"
                      size="s"
                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    >
                      {ep.label}
                    </EuiButton>
                  ) : (
                    <EuiToolTip content={ep.url}>
                      <EuiCopy textToCopy={ep.url}>
                        {(copy) => (
                          <EuiButton
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              copy();
                            }}
                            iconType="copyClipboard"
                            size="s"
                            color="text"
                          >
                            {ep.label}
                          </EuiButton>
                        )}
                      </EuiCopy>
                    </EuiToolTip>
                  )}
                </EuiFlexItem>
              ))}
            </EuiFlexGroup>
          )}
        </>
      }
    />
  );
}
