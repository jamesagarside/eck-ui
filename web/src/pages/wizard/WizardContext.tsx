import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type {
  WizardState,
  WizardElasticsearchConfig,
  WizardKibanaConfig,
  WizardIntegrationsConfig,
} from './types';

interface WizardContextValue {
  state: WizardState;
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  updateElasticsearch: (config: Partial<WizardElasticsearchConfig>) => void;
  updateKibana: (config: Partial<WizardKibanaConfig>) => void;
  updateIntegrations: (config: Partial<WizardIntegrationsConfig>) => void;
  reset: () => void;
}

function createInitialState(): WizardState {
  return {
    currentStep: 0,
    elasticsearch: {
      name: '',
      namespace: 'default',
      version: '8.17.0',
      nodeSets: [
        {
          name: 'default',
          count: 1,
          roles: ['master', 'data', 'ingest'],
          memoryRequest: '2Gi',
          cpuRequest: '1',
          memoryLimit: '2Gi',
          cpuLimit: '1',
          storageSize: '10Gi',
          storageClass: '',
        },
      ],
    },
    kibana: {
      enabled: true,
      name: '',
      count: 1,
    },
    integrations: {
      apm: {
        enabled: false,
        name: '',
        count: 1,
      },
      fleet: {
        enabled: false,
        name: '',
      },
    },
  };
}

const WizardContext = createContext<WizardContextValue | null>(null);

export function WizardProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WizardState>(createInitialState);

  const setStep = useCallback((step: number) => {
    setState((s) => ({ ...s, currentStep: step }));
  }, []);

  const nextStep = useCallback(() => {
    setState((s) => ({ ...s, currentStep: Math.min(s.currentStep + 1, 3) }));
  }, []);

  const prevStep = useCallback(() => {
    setState((s) => ({ ...s, currentStep: Math.max(s.currentStep - 1, 0) }));
  }, []);

  const updateElasticsearch = useCallback(
    (config: Partial<WizardElasticsearchConfig>) => {
      setState((s) => ({
        ...s,
        elasticsearch: { ...s.elasticsearch, ...config },
      }));
    },
    [],
  );

  const updateKibana = useCallback(
    (config: Partial<WizardKibanaConfig>) => {
      setState((s) => ({
        ...s,
        kibana: { ...s.kibana, ...config },
      }));
    },
    [],
  );

  const updateIntegrations = useCallback(
    (config: Partial<WizardIntegrationsConfig>) => {
      setState((s) => ({
        ...s,
        integrations: { ...s.integrations, ...config },
      }));
    },
    [],
  );

  const reset = useCallback(() => {
    setState(createInitialState());
  }, []);

  const value = useMemo(
    () => ({
      state,
      setStep,
      nextStep,
      prevStep,
      updateElasticsearch,
      updateKibana,
      updateIntegrations,
      reset,
    }),
    [state, setStep, nextStep, prevStep, updateElasticsearch, updateKibana, updateIntegrations, reset],
  );

  return (
    <WizardContext.Provider value={value}>{children}</WizardContext.Provider>
  );
}

export function useWizard(): WizardContextValue {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizard must be used within a WizardProvider');
  }
  return context;
}
