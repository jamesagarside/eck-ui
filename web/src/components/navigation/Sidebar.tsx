import { createElement } from 'react';
import { useLocation, useNavigate, useMatch } from 'react-router-dom';
import { EuiSideNav, EuiIcon, type EuiSideNavItemType } from '@elastic/eui';
import { useUserRole, hasMinRole } from '../../hooks/useUserRole';
import { useClusterStore } from '../../stores/clusterStore';

function createItem(
  name: string,
  path: string,
  currentPath: string,
  navigate: (path: string) => void,
  icon?: string,
): EuiSideNavItemType<object> {
  return {
    id: path,
    name,
    isSelected: currentPath === path || currentPath.startsWith(`${path}/`),
    onClick: () => navigate(path),
    icon: icon ? createElement(EuiIcon, { type: icon, size: 's' }) : undefined,
  };
}

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const role = useUserRole();
  const { isMultiCluster } = useClusterStore();
  const clusterMatch = useMatch('/clusters/:clusterId/*');
  const clusterId = clusterMatch?.params.clusterId;

  // When browsing a specific cluster, scope resource paths under that cluster
  const pathPrefix = clusterId ? `/clusters/${clusterId}` : '';

  if (!hasMinRole(role, 'platform-viewer')) {
    const viewerNav: EuiSideNavItemType<object>[] = [
      createItem('My Deployments', '/deployments', currentPath, navigate, 'layers'),
      createItem('Settings', '/settings', currentPath, navigate, 'gear'),
    ];

    return (
      <EuiSideNav
        aria-label="Main navigation"
        items={viewerNav}
        mobileTitle="Navigation"
      />
    );
  }

  const navItems: EuiSideNavItemType<object>[] = [
    {
      id: 'dashboard',
      name: 'Dashboard',
      onClick: () => navigate('/'),
      isSelected: currentPath === '/',
      items: [],
    },
    createItem('Deployments', `${pathPrefix}/deployments`, currentPath, navigate, 'layers'),
    {
      id: 'resources',
      name: 'Resources',
      items: [
        createItem('Elasticsearch', `${pathPrefix}/elasticsearch`, currentPath, navigate),
        createItem('Kibana', `${pathPrefix}/kibana`, currentPath, navigate),
        createItem('Fleet Server', `${pathPrefix}/fleet-server`, currentPath, navigate),
        createItem('Elastic Agent', `${pathPrefix}/agent`, currentPath, navigate),
        createItem('APM Server', `${pathPrefix}/apm`, currentPath, navigate),
        createItem('Beats', `${pathPrefix}/beats`, currentPath, navigate),
        createItem('Logstash', `${pathPrefix}/logstash`, currentPath, navigate),
        createItem(
          'Enterprise Search',
          `${pathPrefix}/enterprise-search`,
          currentPath,
          navigate,
        ),
        createItem('Elastic Maps', `${pathPrefix}/maps`, currentPath, navigate),
      ],
    },
    {
      id: 'stack',
      name: 'Stack Management',
      items: [
        createItem('Config Policies', `${pathPrefix}/stackconfigpolicy`, currentPath, navigate),
        createItem('Autoscalers', `${pathPrefix}/elasticsearchautoscaler`, currentPath, navigate),
      ],
    },
  ];

  if (isMultiCluster) {
    navItems.splice(1, 0, createItem('Clusters', '/clusters', currentPath, navigate, 'cluster'));
  }

  if (hasMinRole(role, 'platform-admin')) {
    navItems.push({
      id: 'admin',
      name: 'Administration',
      items: [
        createItem('Versions', '/admin/versions', currentPath, navigate),
        createItem('Templates', '/admin/templates', currentPath, navigate),
        createItem('Role Bindings', '/admin/roles', currentPath, navigate),
        createItem('System Info', '/admin/system', currentPath, navigate),
      ],
    });
  }

  return (
    <EuiSideNav
      aria-label="Main navigation"
      items={navItems}
      mobileTitle="Navigation"
    />
  );
}
