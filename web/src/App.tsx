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
import { VersionManagementPage, DeploymentTemplatesPage, SystemInfoPage, AdminGuard } from './pages/admin';
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
          <Route path="/deployments/create" element={<DeploymentCreatePage />} />
          <Route path="/deployments/:namespace/:name" element={<DeploymentDetailPage />} />
          <Route path="/deployments/:namespace/:name/edit" element={<DeploymentEditPage />} />

          {/* Elasticsearch */}
          <Route path="/elasticsearch" element={<RoleGuard minRole="editor"><ElasticsearchListPage /></RoleGuard>} />
          <Route path="/elasticsearch/create" element={<RoleGuard minRole="editor"><ElasticsearchCreatePage /></RoleGuard>} />
          <Route path="/elasticsearch/:namespace/:name" element={<RoleGuard minRole="editor"><ElasticsearchDetailPage /></RoleGuard>} />
          <Route path="/elasticsearch/:namespace/:name/edit" element={<RoleGuard minRole="editor"><ElasticsearchEditPage /></RoleGuard>} />

          {/* Kibana */}
          <Route path="/kibana" element={<RoleGuard minRole="editor"><KibanaListPage /></RoleGuard>} />
          <Route path="/kibana/create" element={<RoleGuard minRole="editor"><KibanaCreatePage /></RoleGuard>} />
          <Route path="/kibana/:namespace/:name" element={<RoleGuard minRole="editor"><KibanaDetailPage /></RoleGuard>} />
          <Route path="/kibana/:namespace/:name/edit" element={<RoleGuard minRole="editor"><KibanaEditPage /></RoleGuard>} />

          {/* APM */}
          <Route path="/apm" element={<RoleGuard minRole="editor"><ApmListPage /></RoleGuard>} />
          <Route path="/apm/create" element={<RoleGuard minRole="editor"><ApmCreatePage /></RoleGuard>} />
          <Route path="/apm/:namespace/:name" element={<RoleGuard minRole="editor"><ApmDetailPage /></RoleGuard>} />
          <Route path="/apm/:namespace/:name/edit" element={<RoleGuard minRole="editor"><ApmEditPage /></RoleGuard>} />

          {/* Beats */}
          <Route path="/beats" element={<RoleGuard minRole="editor"><BeatListPage /></RoleGuard>} />
          <Route path="/beats/create" element={<RoleGuard minRole="editor"><BeatCreatePage /></RoleGuard>} />
          <Route path="/beats/:namespace/:name" element={<RoleGuard minRole="editor"><BeatDetailPage /></RoleGuard>} />
          <Route path="/beats/:namespace/:name/edit" element={<RoleGuard minRole="editor"><BeatEditPage /></RoleGuard>} />

          {/* Fleet Server */}
          <Route path="/fleet-server" element={<RoleGuard minRole="editor"><FleetServerListPage /></RoleGuard>} />
          <Route path="/fleet-server/create" element={<RoleGuard minRole="editor"><FleetServerCreatePage /></RoleGuard>} />
          <Route path="/fleet-server/:namespace/:name" element={<RoleGuard minRole="editor"><FleetServerDetailPage /></RoleGuard>} />
          <Route path="/fleet-server/:namespace/:name/edit" element={<RoleGuard minRole="editor"><FleetServerEditPage /></RoleGuard>} />

          {/* Agent */}
          <Route path="/agent" element={<RoleGuard minRole="editor"><AgentListPage /></RoleGuard>} />
          <Route path="/agent/create" element={<RoleGuard minRole="editor"><AgentCreatePage /></RoleGuard>} />
          <Route path="/agent/:namespace/:name" element={<RoleGuard minRole="editor"><AgentDetailPage /></RoleGuard>} />
          <Route path="/agent/:namespace/:name/edit" element={<RoleGuard minRole="editor"><AgentEditPage /></RoleGuard>} />

          {/* Logstash */}
          <Route path="/logstash" element={<RoleGuard minRole="editor"><LogstashListPage /></RoleGuard>} />
          <Route path="/logstash/create" element={<RoleGuard minRole="editor"><LogstashCreatePage /></RoleGuard>} />
          <Route path="/logstash/:namespace/:name" element={<RoleGuard minRole="editor"><LogstashDetailPage /></RoleGuard>} />
          <Route path="/logstash/:namespace/:name/edit" element={<RoleGuard minRole="editor"><LogstashEditPage /></RoleGuard>} />

          {/* Enterprise Search */}
          <Route path="/enterprise-search" element={<RoleGuard minRole="editor"><EnterpriseSearchListPage /></RoleGuard>} />
          <Route path="/enterprise-search/create" element={<RoleGuard minRole="editor"><EnterpriseSearchCreatePage /></RoleGuard>} />
          <Route path="/enterprise-search/:namespace/:name" element={<RoleGuard minRole="editor"><EnterpriseSearchDetailPage /></RoleGuard>} />
          <Route path="/enterprise-search/:namespace/:name/edit" element={<RoleGuard minRole="editor"><EnterpriseSearchEditPage /></RoleGuard>} />

          {/* Elastic Maps */}
          <Route path="/maps" element={<RoleGuard minRole="editor"><MapsListPage /></RoleGuard>} />
          <Route path="/maps/create" element={<RoleGuard minRole="editor"><MapsCreatePage /></RoleGuard>} />
          <Route path="/maps/:namespace/:name" element={<RoleGuard minRole="editor"><MapsDetailPage /></RoleGuard>} />
          <Route path="/maps/:namespace/:name/edit" element={<RoleGuard minRole="editor"><MapsEditPage /></RoleGuard>} />

          {/* Stack Config Policies */}
          <Route path="/stackconfigpolicy" element={<RoleGuard minRole="editor"><StackConfigPolicyListPage /></RoleGuard>} />
          <Route path="/stackconfigpolicy/create" element={<RoleGuard minRole="editor"><StackConfigPolicyCreatePage /></RoleGuard>} />
          <Route path="/stackconfigpolicy/:namespace/:name" element={<RoleGuard minRole="editor"><StackConfigPolicyDetailPage /></RoleGuard>} />
          <Route path="/stackconfigpolicy/:namespace/:name/edit" element={<RoleGuard minRole="editor"><StackConfigPolicyEditPage /></RoleGuard>} />

          {/* Elasticsearch Autoscalers */}
          <Route path="/elasticsearchautoscaler" element={<RoleGuard minRole="editor"><AutoscalerListPage /></RoleGuard>} />
          <Route path="/elasticsearchautoscaler/create" element={<RoleGuard minRole="editor"><AutoscalerCreatePage /></RoleGuard>} />
          <Route path="/elasticsearchautoscaler/:namespace/:name" element={<RoleGuard minRole="editor"><AutoscalerDetailPage /></RoleGuard>} />
          <Route path="/elasticsearchautoscaler/:namespace/:name/edit" element={<RoleGuard minRole="editor"><AutoscalerEditPage /></RoleGuard>} />

          {/* Admin */}
          <Route path="/admin/versions" element={<RoleGuard minRole="admin"><VersionManagementPage /></RoleGuard>} />
          <Route path="/admin/templates" element={<RoleGuard minRole="admin"><DeploymentTemplatesPage /></RoleGuard>} />
          <Route path="/admin/system" element={<RoleGuard minRole="admin"><SystemInfoPage /></RoleGuard>} />

          {/* Wizard redirect */}
          <Route path="/wizard" element={<Navigate to="/deployments/create" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
