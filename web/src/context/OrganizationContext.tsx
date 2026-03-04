import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import { useAuthStore } from '../stores/authStore';

interface OrganizationContextValue {
  activeOrg: string | null;
  namespaces: string[];
  switchOrg: (orgName: string) => void;
}

const OrganizationContext = createContext<OrganizationContextValue | null>(
  null,
);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const activeOrg = useAuthStore((s) => s.activeOrg);
  const switchOrg = useAuthStore((s) => s.switchOrg);

  const value = useMemo(
    () => ({
      activeOrg: activeOrg?.name ?? null,
      namespaces: activeOrg?.namespaces ?? [],
      switchOrg,
    }),
    [activeOrg, switchOrg],
  );

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization(): OrganizationContextValue {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error(
      'useOrganization must be used within an OrganizationProvider',
    );
  }
  return context;
}
