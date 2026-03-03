import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import type { ReactNode } from 'react';

// Organization types
export interface Organization {
  id: string;
  name: string;
  namespace: string;
  role: 'admin' | 'editor' | 'viewer';
  createdAt: string;
}

interface OrganizationContextValue {
  organizations: Organization[];
  currentOrganization: Organization | null;
  setCurrentOrganization: (org: Organization) => void;
  isLoading: boolean;
  error: string | null;
  refreshOrganizations: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextValue | undefined>(undefined);

// Local storage key for persisting selected org
const SELECTED_ORG_KEY = 'eck-ui-selected-org';

interface OrganizationProviderProps {
  children: ReactNode;
}

export function OrganizationProvider({ children }: OrganizationProviderProps) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrganization, setCurrentOrgState] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch organizations from API
  const refreshOrganizations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/v1/orgs');
      if (!response.ok) {
        throw new Error(`Failed to fetch organizations: ${response.statusText}`);
      }
      
      const data = await response.json();
      const orgs: Organization[] = data.organizations || [];
      setOrganizations(orgs);
      
      // Restore previously selected org or default to first
      const storedOrgId = localStorage.getItem(SELECTED_ORG_KEY);
      const storedOrg = orgs.find((o) => o.id === storedOrgId);
      
      if (storedOrg) {
        setCurrentOrgState(storedOrg);
      } else if (orgs.length > 0) {
        setCurrentOrgState(orgs[0]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('Failed to fetch organizations:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Set current organization with persistence
  const setCurrentOrganization = useCallback((org: Organization) => {
    setCurrentOrgState(org);
    localStorage.setItem(SELECTED_ORG_KEY, org.id);
  }, []);

  // Load organizations on mount
  useEffect(() => {
    refreshOrganizations();
  }, [refreshOrganizations]);

  const value = useMemo(() => ({
    organizations,
    currentOrganization,
    setCurrentOrganization,
    isLoading,
    error,
    refreshOrganizations,
  }), [organizations, currentOrganization, setCurrentOrganization, isLoading, error, refreshOrganizations]);

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within OrganizationProvider');
  }
  return context;
}

// Helper hook for namespace from current org
export function useNamespace() {
  const { currentOrganization } = useOrganization();
  return currentOrganization?.namespace ?? null;
}
