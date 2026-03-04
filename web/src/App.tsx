import { Routes, Route } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { AuthGuard } from './components/auth/AuthGuard';
import { LoginPage } from './pages/login/LoginPage';
import { DashboardPage } from './pages/dashboard';
import { ElasticsearchListPage } from './pages/elasticsearch/ElasticsearchListPage';
import { ElasticsearchDetailPage } from './pages/elasticsearch/ElasticsearchDetailPage';
import { ElasticsearchCreatePage } from './pages/elasticsearch/ElasticsearchCreatePage';
import { ElasticsearchEditPage } from './pages/elasticsearch/ElasticsearchEditPage';
import { KibanaListPage, KibanaDetailPage, KibanaCreatePage, KibanaEditPage } from './pages/kibana';
import { ApmListPage, ApmDetailPage, ApmCreatePage, ApmEditPage } from './pages/apm';
import { BeatListPage, BeatDetailPage, BeatCreatePage, BeatEditPage } from './pages/beats';
import { AgentListPage, AgentDetailPage, AgentCreatePage, AgentEditPage } from './pages/agent';
import { LogstashListPage, LogstashDetailPage, LogstashCreatePage, LogstashEditPage } from './pages/logstash';
import { EnterpriseSearchListPage, EnterpriseSearchDetailPage, EnterpriseSearchCreatePage, EnterpriseSearchEditPage } from './pages/enterprise-search';
import { MapsListPage, MapsDetailPage, MapsCreatePage, MapsEditPage } from './pages/maps';
import { WizardPage } from './pages/wizard';
import {
  StackConfigPolicyListPage,
  StackConfigPolicyCreatePage,
  AutoscalerListPage,
  AutoscalerCreatePage,
} from './pages/stack';
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

          {/* Elasticsearch */}
          <Route path="/elasticsearch" element={<ElasticsearchListPage />} />
          <Route path="/elasticsearch/create" element={<ElasticsearchCreatePage />} />
          <Route path="/elasticsearch/:namespace/:name" element={<ElasticsearchDetailPage />} />
          <Route path="/elasticsearch/:namespace/:name/edit" element={<ElasticsearchEditPage />} />

          {/* Kibana */}
          <Route path="/kibana" element={<KibanaListPage />} />
          <Route path="/kibana/create" element={<KibanaCreatePage />} />
          <Route path="/kibana/:namespace/:name" element={<KibanaDetailPage />} />
          <Route path="/kibana/:namespace/:name/edit" element={<KibanaEditPage />} />

          {/* APM */}
          <Route path="/apm" element={<ApmListPage />} />
          <Route path="/apm/create" element={<ApmCreatePage />} />
          <Route path="/apm/:namespace/:name" element={<ApmDetailPage />} />
          <Route path="/apm/:namespace/:name/edit" element={<ApmEditPage />} />

          {/* Beats */}
          <Route path="/beats" element={<BeatListPage />} />
          <Route path="/beats/create" element={<BeatCreatePage />} />
          <Route path="/beats/:namespace/:name" element={<BeatDetailPage />} />
          <Route path="/beats/:namespace/:name/edit" element={<BeatEditPage />} />

          {/* Agent */}
          <Route path="/agent" element={<AgentListPage />} />
          <Route path="/agent/create" element={<AgentCreatePage />} />
          <Route path="/agent/:namespace/:name" element={<AgentDetailPage />} />
          <Route path="/agent/:namespace/:name/edit" element={<AgentEditPage />} />

          {/* Logstash */}
          <Route path="/logstash" element={<LogstashListPage />} />
          <Route path="/logstash/create" element={<LogstashCreatePage />} />
          <Route path="/logstash/:namespace/:name" element={<LogstashDetailPage />} />
          <Route path="/logstash/:namespace/:name/edit" element={<LogstashEditPage />} />

          {/* Enterprise Search */}
          <Route path="/enterprise-search" element={<EnterpriseSearchListPage />} />
          <Route path="/enterprise-search/create" element={<EnterpriseSearchCreatePage />} />
          <Route path="/enterprise-search/:namespace/:name" element={<EnterpriseSearchDetailPage />} />
          <Route path="/enterprise-search/:namespace/:name/edit" element={<EnterpriseSearchEditPage />} />

          {/* Elastic Maps */}
          <Route path="/maps" element={<MapsListPage />} />
          <Route path="/maps/create" element={<MapsCreatePage />} />
          <Route path="/maps/:namespace/:name" element={<MapsDetailPage />} />
          <Route path="/maps/:namespace/:name/edit" element={<MapsEditPage />} />

          {/* Stack Config Policies */}
          <Route path="/stackconfigpolicy" element={<StackConfigPolicyListPage />} />
          <Route path="/stackconfigpolicy/create" element={<StackConfigPolicyCreatePage />} />

          {/* Elasticsearch Autoscalers */}
          <Route path="/elasticsearchautoscaler" element={<AutoscalerListPage />} />
          <Route path="/elasticsearchautoscaler/create" element={<AutoscalerCreatePage />} />

          {/* Stack Wizard */}
          <Route path="/wizard" element={<WizardPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
