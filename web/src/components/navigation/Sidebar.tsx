import { createElement } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { EuiSideNav, EuiIcon, type EuiSideNavItemType } from '@elastic/eui';
import { useAuthStore } from '../../stores/authStore';

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
  const user = useAuthStore((s) => s.user);

  // Check admin access (matches backend deriveRole logic)
  const isAdmin = user?.groups?.some(
    (g) => g.includes('admin') || g.includes('system:serviceaccounts'),
  ) ?? !user?.groups?.length;

  const navItems: EuiSideNavItemType<object>[] = [
    {
      id: 'dashboard',
      name: 'Dashboard',
      onClick: () => navigate('/'),
      isSelected: currentPath === '/',
      items: [],
    },
    createItem('Deployments', '/deployments', currentPath, navigate, 'layers'),
    {
      id: 'resources',
      name: 'Resources',
      items: [
        createItem('Elasticsearch', '/elasticsearch', currentPath, navigate),
        createItem('Kibana', '/kibana', currentPath, navigate),
        createItem('Fleet Server', '/fleet-server', currentPath, navigate),
        createItem('Elastic Agent', '/agent', currentPath, navigate),
        createItem('APM Server', '/apm', currentPath, navigate),
        createItem('Beats', '/beats', currentPath, navigate),
        createItem('Logstash', '/logstash', currentPath, navigate),
        createItem(
          'Enterprise Search',
          '/enterprise-search',
          currentPath,
          navigate,
        ),
        createItem('Elastic Maps', '/maps', currentPath, navigate),
      ],
    },
    {
      id: 'stack',
      name: 'Stack Management',
      items: [
        createItem('Config Policies', '/stackconfigpolicy', currentPath, navigate),
        createItem('Autoscalers', '/elasticsearchautoscaler', currentPath, navigate),
      ],
    },
  ];

  if (isAdmin) {
    navItems.push({
      id: 'admin',
      name: 'Administration',
      items: [
        createItem('Versions', '/admin/versions', currentPath, navigate),
        createItem('Templates', '/admin/templates', currentPath, navigate),
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
