import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from './context/AppProvider';
import { OrganizationProvider } from './context/OrganizationContext';
import { UserPreferencesProvider } from './context/UserPreferencesContext';
import { AppShell } from './components/layout/AppShell';

// Elasticsearch pages
import { ElasticsearchListPage } from './pages/elasticsearch/ElasticsearchListPage';
import { ElasticsearchDetailPage } from './pages/elasticsearch/ElasticsearchDetailPage';
import { ElasticsearchCreatePage } from './pages/elasticsearch/ElasticsearchCreatePage';
import { ElasticsearchEditPage } from './pages/elasticsearch/ElasticsearchEditPage';

// Kibana pages
import { KibanaListPage, KibanaDetailPage, KibanaCreatePage, KibanaEditPage } from './pages/kibana';

// APM pages
import { ApmListPage, ApmDetailPage, ApmCreatePage, ApmEditPage } from './pages/apm';

// Agent pages
import { AgentListPage, AgentDetailPage, AgentCreatePage, AgentEditPage } from './pages/agent';

// Beat pages
import { BeatListPage, BeatDetailPage, BeatCreatePage, BeatEditPage } from './pages/beats';

// Logstash pages
import { LogstashListPage, LogstashDetailPage, LogstashCreatePage, LogstashEditPage } from './pages/logstash';

// Enterprise Search pages
import { EnterpriseSearchListPage, EnterpriseSearchDetailPage, EnterpriseSearchCreatePage, EnterpriseSearchEditPage } from './pages/enterprise-search';

// Elastic Maps Server pages
import { MapsListPage, MapsDetailPage, MapsCreatePage, MapsEditPage } from './pages/maps';

// Dashboard and Wizard pages
import { DashboardPage } from './pages/dashboard';
import { WizardPage } from './pages/wizard';

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // 30 seconds
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div>
      <h1>{title}</h1>
      <p>Coming soon...</p>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <OrganizationProvider>
          <UserPreferencesProvider>
            <BrowserRouter>
              <AppShell>
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  {/* Elasticsearch routes */}
                  <Route path="/elasticsearch" element={<ElasticsearchListPage />} />
                  <Route path="/elasticsearch/create" element={<ElasticsearchCreatePage />} />
                  <Route path="/elasticsearch/:namespace/:name" element={<ElasticsearchDetailPage />} />
                  <Route path="/elasticsearch/:namespace/:name/edit" element={<ElasticsearchEditPage />} />
                  {/* Kibana routes */}
                  <Route path="/kibana" element={<KibanaListPage />} />
                  <Route path="/kibana/create" element={<KibanaCreatePage />} />
                  <Route path="/kibana/:namespace/:name" element={<KibanaDetailPage />} />
                  <Route path="/kibana/:namespace/:name/edit" element={<KibanaEditPage />} />
                  {/* APM Server routes */}
                  <Route path="/apm" element={<ApmListPage />} />
                  <Route path="/apm/create" element={<ApmCreatePage />} />
                  <Route path="/apm/:namespace/:name" element={<ApmDetailPage />} />
                  <Route path="/apm/:namespace/:name/edit" element={<ApmEditPage />} />
                  {/* Elastic Agent routes (includes Fleet Server as mode=fleet) */}
                  <Route path="/agent" element={<AgentListPage />} />
                  <Route path="/agent/create" element={<AgentCreatePage />} />
                  <Route path="/agent/:namespace/:name" element={<AgentDetailPage />} />
                  <Route path="/agent/:namespace/:name/edit" element={<AgentEditPage />} />
                  {/* Other resource routes */}
                  <Route path="/fleet" element={<Navigate to="/agent?mode=fleet" replace />} />
                  {/* Beat routes */}
                  <Route path="/beats" element={<BeatListPage />} />
                  <Route path="/beats/create" element={<BeatCreatePage />} />
                  <Route path="/beats/:namespace/:name" element={<BeatDetailPage />} />
                  <Route path="/beats/:namespace/:name/edit" element={<BeatEditPage />} />
                  {/* Logstash routes */}
                  <Route path="/logstash" element={<LogstashListPage />} />
                  <Route path="/logstash/create" element={<LogstashCreatePage />} />
                  <Route path="/logstash/:namespace/:name" element={<LogstashDetailPage />} />
                  <Route path="/logstash/:namespace/:name/edit" element={<LogstashEditPage />} />
                  {/* Enterprise Search routes */}
                  <Route path="/enterprise-search" element={<EnterpriseSearchListPage />} />
                  <Route path="/enterprise-search/create" element={<EnterpriseSearchCreatePage />} />
                  <Route path="/enterprise-search/:namespace/:name" element={<EnterpriseSearchDetailPage />} />
                  <Route path="/enterprise-search/:namespace/:name/edit" element={<EnterpriseSearchEditPage />} />
                  {/* Elastic Maps Server routes */}
                  <Route path="/maps" element={<MapsListPage />} />
                  <Route path="/maps/create" element={<MapsCreatePage />} />
                  <Route path="/maps/:namespace/:name" element={<MapsDetailPage />} />
                  <Route path="/maps/:namespace/:name/edit" element={<MapsEditPage />} />
                  {/* Wizard route */}
                  <Route path="/wizard" element={<WizardPage />} />
                  {/* Placeholder routes */}
                  <Route path="/organizations" element={<PlaceholderPage title="Organizations" />} />
                  <Route path="/audit" element={<PlaceholderPage title="Audit Logs" />} />
                  <Route path="/settings" element={<PlaceholderPage title="Settings" />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </AppShell>
            </BrowserRouter>
          </UserPreferencesProvider>
        </OrganizationProvider>
      </AppProvider>
    </QueryClientProvider>
  );
}

export default App;
