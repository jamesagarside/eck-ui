import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from './context/AppProvider';
import { OrganizationProvider } from './context/OrganizationContext';
import { UserPreferencesProvider } from './context/UserPreferencesContext';
import { AppShell } from './components/layout/AppShell';

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

// Placeholder pages (will be replaced with actual implementations)
function DashboardPage() {
  return (
    <div>
      <h1>Dashboard</h1>
      <p>Welcome to ECK UI</p>
    </div>
  );
}

function ElasticsearchListPage() {
  return (
    <div>
      <h1>Elasticsearch Clusters</h1>
      <p>List of Elasticsearch clusters</p>
    </div>
  );
}

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
                  <Route path="/elasticsearch" element={<ElasticsearchListPage />} />
                  <Route path="/elasticsearch/:name" element={<PlaceholderPage title="Elasticsearch Detail" />} />
                  <Route path="/kibana" element={<PlaceholderPage title="Kibana" />} />
                  <Route path="/apm" element={<PlaceholderPage title="APM Server" />} />
                  <Route path="/fleet" element={<PlaceholderPage title="Fleet Server" />} />
                  <Route path="/agent" element={<PlaceholderPage title="Elastic Agent" />} />
                  <Route path="/beats" element={<PlaceholderPage title="Beats" />} />
                  <Route path="/logstash" element={<PlaceholderPage title="Logstash" />} />
                  <Route path="/enterprise-search" element={<PlaceholderPage title="Enterprise Search" />} />
                  <Route path="/maps" element={<PlaceholderPage title="Elastic Maps" />} />
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
