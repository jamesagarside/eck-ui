import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { AuthGuard } from './components/auth/AuthGuard';
import { LoginPage } from './pages/login/LoginPage';
import { DashboardPage } from './pages/dashboard';
import { DeploymentListPage, DeploymentCreatePage, DeploymentDetailPage, DeploymentEditPage } from './pages/deployment';
import { ElasticsearchListPage } from './pages/elasticsearch/ElasticsearchListPage';
import { ElasticsearchDetailPage } from './pages/elasticsearch/ElasticsearchDetailPage';
import { ElasticsearchCreatePage } from './pages/elasticsearch/ElasticsearchCreatePage';
import { ElasticsearchEditPage } from './pages/elasticsearch/ElasticsearchEditPage';
import { KibanaListPage, KibanaDetailPage, KibanaCreatePage, KibanaEditPage } from './pages/kibana';
import { ApmListPage, ApmDetailPage, ApmCreatePage, ApmEditPage } from './pages/apm';
import { BeatListPage, BeatDetailPage, BeatCreatePage, BeatEditPage } from './pages/beats';
import { AgentListPage, AgentDetailPage, AgentCreatePage, AgentEditPage } from './pages/agent';
import { FleetServerListPage, FleetServerDetailPage, FleetServerCreatePage, FleetServerEditPage } from './pages/fleet-server';
import { LogstashListPage, LogstashDetailPage, LogstashCreatePage, LogstashEditPage } from './pages/logstash';
import { EnterpriseSearchListPage, EnterpriseSearchDetailPage, EnterpriseSearchCreatePage, EnterpriseSearchEditPage } from './pages/enterprise-search';
import { MapsListPage, MapsDetailPage, MapsCreatePage, MapsEditPage } from './pages/maps';
import {
  StackConfigPolicyListPage,
  StackConfigPolicyCreatePage,
  StackConfigPolicyDetailPage,
  StackConfigPolicyEditPage,
  AutoscalerListPage,
  AutoscalerCreatePage,
  AutoscalerDetailPage,
  AutoscalerEditPage,
} from './pages/stack';
import { VersionManagementPage, DeploymentTemplatesPage, SystemInfoPage, RoleManagementPage } from './pages/admin';
import { RoleGuard } from './components/auth/RoleGuard';
import './App.css';

function App() {
  return (
    <Routes>
      {/* Public route */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected routes */}
      <Route element={<AuthGuard />}>
        <Route element={<AppShell />}>
          {/* Dashboard */}
          <Route path="/" element={<DashboardPage />} />

          {/* Deployments */}
          <Route path="/deployments" element={<DeploymentListPage />} />
          <Route path="/deployments/create" element={<RoleGuard minRole="deployment-manager"><DeploymentCreatePage /></RoleGuard>} />
          <Route path="/deployments/:namespace/:name" element={<DeploymentDetailPage />} />
          <Route path="/deployments/:namespace/:name/edit" element={<RoleGuard minRole="deployment-manager"><DeploymentEditPage /></RoleGuard>} />

          {/* Elasticsearch */}
          <Route path="/elasticsearch" element={<RoleGuard minRole="platform-viewer"><ElasticsearchListPage /></RoleGuard>} />
          <Route path="/elasticsearch/create" element={<RoleGuard minRole="deployment-manager"><ElasticsearchCreatePage /></RoleGuard>} />
          <Route path="/elasticsearch/:namespace/:name" element={<RoleGuard minRole="platform-viewer"><ElasticsearchDetailPage /></RoleGuard>} />
          <Route path="/elasticsearch/:namespace/:name/edit" element={<RoleGuard minRole="deployment-manager"><ElasticsearchEditPage /></RoleGuard>} />

          {/* Kibana */}
          <Route path="/kibana" element={<RoleGuard minRole="platform-viewer"><KibanaListPage /></RoleGuard>} />
          <Route path="/kibana/create" element={<RoleGuard minRole="deployment-manager"><KibanaCreatePage /></RoleGuard>} />
          <Route path="/kibana/:namespace/:name" element={<RoleGuard minRole="platform-viewer"><KibanaDetailPage /></RoleGuard>} />
          <Route path="/kibana/:namespace/:name/edit" element={<RoleGuard minRole="deployment-manager"><KibanaEditPage /></RoleGuard>} />

          {/* APM */}
          <Route path="/apm" element={<RoleGuard minRole="platform-viewer"><ApmListPage /></RoleGuard>} />
          <Route path="/apm/create" element={<RoleGuard minRole="deployment-manager"><ApmCreatePage /></RoleGuard>} />
          <Route path="/apm/:namespace/:name" element={<RoleGuard minRole="platform-viewer"><ApmDetailPage /></RoleGuard>} />
          <Route path="/apm/:namespace/:name/edit" element={<RoleGuard minRole="deployment-manager"><ApmEditPage /></RoleGuard>} />

          {/* Beats */}
          <Route path="/beats" element={<RoleGuard minRole="platform-viewer"><BeatListPage /></RoleGuard>} />
          <Route path="/beats/create" element={<RoleGuard minRole="deployment-manager"><BeatCreatePage /></RoleGuard>} />
          <Route path="/beats/:namespace/:name" element={<RoleGuard minRole="platform-viewer"><BeatDetailPage /></RoleGuard>} />
          <Route path="/beats/:namespace/:name/edit" element={<RoleGuard minRole="deployment-manager"><BeatEditPage /></RoleGuard>} />

          {/* Fleet Server */}
          <Route path="/fleet-server" element={<RoleGuard minRole="platform-viewer"><FleetServerListPage /></RoleGuard>} />
          <Route path="/fleet-server/create" element={<RoleGuard minRole="deployment-manager"><FleetServerCreatePage /></RoleGuard>} />
          <Route path="/fleet-server/:namespace/:name" element={<RoleGuard minRole="platform-viewer"><FleetServerDetailPage /></RoleGuard>} />
          <Route path="/fleet-server/:namespace/:name/edit" element={<RoleGuard minRole="deployment-manager"><FleetServerEditPage /></RoleGuard>} />

          {/* Agent */}
          <Route path="/agent" element={<RoleGuard minRole="platform-viewer"><AgentListPage /></RoleGuard>} />
          <Route path="/agent/create" element={<RoleGuard minRole="deployment-manager"><AgentCreatePage /></RoleGuard>} />
          <Route path="/agent/:namespace/:name" element={<RoleGuard minRole="platform-viewer"><AgentDetailPage /></RoleGuard>} />
          <Route path="/agent/:namespace/:name/edit" element={<RoleGuard minRole="deployment-manager"><AgentEditPage /></RoleGuard>} />

          {/* Logstash */}
          <Route path="/logstash" element={<RoleGuard minRole="platform-viewer"><LogstashListPage /></RoleGuard>} />
          <Route path="/logstash/create" element={<RoleGuard minRole="deployment-manager"><LogstashCreatePage /></RoleGuard>} />
          <Route path="/logstash/:namespace/:name" element={<RoleGuard minRole="platform-viewer"><LogstashDetailPage /></RoleGuard>} />
          <Route path="/logstash/:namespace/:name/edit" element={<RoleGuard minRole="deployment-manager"><LogstashEditPage /></RoleGuard>} />

          {/* Enterprise Search */}
          <Route path="/enterprise-search" element={<RoleGuard minRole="platform-viewer"><EnterpriseSearchListPage /></RoleGuard>} />
          <Route path="/enterprise-search/create" element={<RoleGuard minRole="deployment-manager"><EnterpriseSearchCreatePage /></RoleGuard>} />
          <Route path="/enterprise-search/:namespace/:name" element={<RoleGuard minRole="platform-viewer"><EnterpriseSearchDetailPage /></RoleGuard>} />
          <Route path="/enterprise-search/:namespace/:name/edit" element={<RoleGuard minRole="deployment-manager"><EnterpriseSearchEditPage /></RoleGuard>} />

          {/* Elastic Maps */}
          <Route path="/maps" element={<RoleGuard minRole="platform-viewer"><MapsListPage /></RoleGuard>} />
          <Route path="/maps/create" element={<RoleGuard minRole="deployment-manager"><MapsCreatePage /></RoleGuard>} />
          <Route path="/maps/:namespace/:name" element={<RoleGuard minRole="platform-viewer"><MapsDetailPage /></RoleGuard>} />
          <Route path="/maps/:namespace/:name/edit" element={<RoleGuard minRole="deployment-manager"><MapsEditPage /></RoleGuard>} />

          {/* Stack Config Policies */}
          <Route path="/stackconfigpolicy" element={<RoleGuard minRole="platform-viewer"><StackConfigPolicyListPage /></RoleGuard>} />
          <Route path="/stackconfigpolicy/create" element={<RoleGuard minRole="deployment-manager"><StackConfigPolicyCreatePage /></RoleGuard>} />
          <Route path="/stackconfigpolicy/:namespace/:name" element={<RoleGuard minRole="platform-viewer"><StackConfigPolicyDetailPage /></RoleGuard>} />
          <Route path="/stackconfigpolicy/:namespace/:name/edit" element={<RoleGuard minRole="deployment-manager"><StackConfigPolicyEditPage /></RoleGuard>} />

          {/* Elasticsearch Autoscalers */}
          <Route path="/elasticsearchautoscaler" element={<RoleGuard minRole="platform-viewer"><AutoscalerListPage /></RoleGuard>} />
          <Route path="/elasticsearchautoscaler/create" element={<RoleGuard minRole="deployment-manager"><AutoscalerCreatePage /></RoleGuard>} />
          <Route path="/elasticsearchautoscaler/:namespace/:name" element={<RoleGuard minRole="platform-viewer"><AutoscalerDetailPage /></RoleGuard>} />
          <Route path="/elasticsearchautoscaler/:namespace/:name/edit" element={<RoleGuard minRole="deployment-manager"><AutoscalerEditPage /></RoleGuard>} />

          {/* Admin */}
          <Route path="/admin/versions" element={<RoleGuard minRole="platform-admin"><VersionManagementPage /></RoleGuard>} />
          <Route path="/admin/templates" element={<RoleGuard minRole="platform-admin"><DeploymentTemplatesPage /></RoleGuard>} />
          <Route path="/admin/system" element={<RoleGuard minRole="platform-admin"><SystemInfoPage /></RoleGuard>} />
          <Route path="/admin/roles" element={<RoleGuard minRole="platform-admin"><RoleManagementPage /></RoleGuard>} />

          {/* Wizard redirect */}
          <Route path="/wizard" element={<Navigate to="/deployments/create" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
