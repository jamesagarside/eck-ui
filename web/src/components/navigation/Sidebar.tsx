import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiListGroup,
  EuiListGroupItem,
  EuiHorizontalRule,
  EuiText,
  EuiToolTip,
} from '@elastic/eui';
import { useLocation, useNavigate } from 'react-router-dom';

interface SidebarProps {
  collapsed: boolean;
}

interface NavItem {
  label: string;
  icon: string;
  path: string;
  badge?: number;
}

const resourceTypes: NavItem[] = [
  { label: 'Elasticsearch', icon: 'logoElasticsearch', path: '/elasticsearch' },
  { label: 'Kibana', icon: 'logoKibana', path: '/kibana' },
  { label: 'APM Server', icon: 'apmApp', path: '/apm' },
  { label: 'Fleet Server', icon: 'logoObservability', path: '/fleet' },
  { label: 'Elastic Agent', icon: 'package', path: '/agent' },
  { label: 'Beats', icon: 'logoBeats', path: '/beats' },
  { label: 'Logstash', icon: 'logoLogstash', path: '/logstash' },
  { label: 'Enterprise Search', icon: 'logoEnterpriseSearch', path: '/enterprise-search' },
  { label: 'Elastic Maps', icon: 'logoMaps', path: '/maps' },
];

const managementItems: NavItem[] = [
  { label: 'Organizations', icon: 'users', path: '/organizations' },
  { label: 'Audit Logs', icon: 'document', path: '/audit' },
  { label: 'Settings', icon: 'gear', path: '/settings' },
];

export function Sidebar({ collapsed }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => location.pathname.startsWith(path);

  const renderNavItem = (item: NavItem) => {
    const button = (
      <EuiListGroupItem
        key={item.path}
        iconType={item.icon}
        label={collapsed ? '' : item.label}
        isActive={isActive(item.path)}
        onClick={() => navigate(item.path)}
        size="s"
        style={{
          paddingLeft: collapsed ? 12 : 16,
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}
      />
    );

    if (collapsed) {
      return (
        <EuiToolTip key={item.path} content={item.label} position="right">
          {button}
        </EuiToolTip>
      );
    }

    return button;
  };

  return (
    <EuiFlexGroup
      direction="column"
      gutterSize="none"
      style={{ height: '100%', padding: collapsed ? '8px 4px' : '8px' }}
    >
      <EuiFlexItem grow={false}>
        {!collapsed && (
          <EuiText size="xs" color="subdued" style={{ padding: '8px 16px' }}>
            <strong>DEPLOYMENTS</strong>
          </EuiText>
        )}
        <EuiListGroup flush gutterSize="none">
          {resourceTypes.map(renderNavItem)}
        </EuiListGroup>
      </EuiFlexItem>

      <EuiFlexItem grow={false}>
        <EuiHorizontalRule margin="s" />
      </EuiFlexItem>

      <EuiFlexItem grow={false}>
        {!collapsed && (
          <EuiText size="xs" color="subdued" style={{ padding: '8px 16px' }}>
            <strong>MANAGEMENT</strong>
          </EuiText>
        )}
        <EuiListGroup flush gutterSize="none">
          {managementItems.map(renderNavItem)}
        </EuiListGroup>
      </EuiFlexItem>

      <EuiFlexItem grow />

      {/* Version info at bottom */}
      {!collapsed && (
        <EuiFlexItem grow={false}>
          <EuiText size="xs" color="subdued" textAlign="center" style={{ padding: 16 }}>
            ECK UI v0.1.0
          </EuiText>
        </EuiFlexItem>
      )}
    </EuiFlexGroup>
  );
}
