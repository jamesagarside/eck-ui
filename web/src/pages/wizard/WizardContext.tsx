// Wizard Context for state management
import { createContext, useContext, useReducer } from 'react';
import type { ReactNode } from 'react';
import type {
  WizardState,
  ElasticsearchConfig,
  KibanaConfig,
  ApmConfig,
  FleetConfig,
  BeatsConfig,
} from './types';
import {
  DEFAULT_ELASTICSEARCH_CONFIG,
  DEFAULT_KIBANA_CONFIG,
  DEFAULT_APM_CONFIG,
  DEFAULT_FLEET_CONFIG,
  DEFAULT_BEATS_CONFIG,
  PRESET_CONFIGS,
} from './types';

type WizardAction =
  | { type: 'SET_STEP'; step: number }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'UPDATE_ELASTICSEARCH'; config: Partial<ElasticsearchConfig> }
  | { type: 'SET_ELASTICSEARCH_PRESET'; preset: ElasticsearchConfig['preset'] }
  | { type: 'UPDATE_KIBANA'; config: Partial<KibanaConfig> | null }
  | { type: 'TOGGLE_KIBANA'; enabled: boolean }
  | { type: 'UPDATE_APM'; config: Partial<ApmConfig> | null }
  | { type: 'TOGGLE_APM'; enabled: boolean }
  | { type: 'UPDATE_FLEET'; config: Partial<FleetConfig> | null }
  | { type: 'TOGGLE_FLEET'; enabled: boolean }
  | { type: 'UPDATE_BEATS'; config: Partial<BeatsConfig> | null }
  | { type: 'TOGGLE_BEATS'; enabled: boolean }
  | { type: 'RESET' };

const initialState: WizardState = {
  currentStep: 0,
  elasticsearch: { ...DEFAULT_ELASTICSEARCH_CONFIG },
  kibana: { ...DEFAULT_KIBANA_CONFIG },
  apm: null,
  fleet: null,
  beats: null,
};

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, currentStep: action.step };
    case 'NEXT_STEP':
      return { ...state, currentStep: Math.min(state.currentStep + 1, 3) };
    case 'PREV_STEP':
      return { ...state, currentStep: Math.max(state.currentStep - 1, 0) };
    case 'UPDATE_ELASTICSEARCH':
      return {
        ...state,
        elasticsearch: { ...state.elasticsearch, ...action.config },
      };
    case 'SET_ELASTICSEARCH_PRESET': {
      const presetConfig = PRESET_CONFIGS[action.preset];
      return {
        ...state,
        elasticsearch: {
          ...state.elasticsearch,
          preset: action.preset,
          ...presetConfig,
        },
      };
    }
    case 'TOGGLE_KIBANA':
      return {
        ...state,
        kibana: action.enabled ? { ...DEFAULT_KIBANA_CONFIG } : null,
      };
    case 'UPDATE_KIBANA':
      if (!state.kibana || !action.config) return state;
      return {
        ...state,
        kibana: { ...state.kibana, ...action.config },
      };
    case 'TOGGLE_APM':
      return {
        ...state,
        apm: action.enabled ? { ...DEFAULT_APM_CONFIG } : null,
      };
    case 'UPDATE_APM':
      if (!state.apm || !action.config) return state;
      return {
        ...state,
        apm: { ...state.apm, ...action.config },
      };
    case 'TOGGLE_FLEET':
      return {
        ...state,
        fleet: action.enabled ? { ...DEFAULT_FLEET_CONFIG } : null,
      };
    case 'UPDATE_FLEET':
      if (!state.fleet || !action.config) return state;
      return {
        ...state,
        fleet: { ...state.fleet, ...action.config },
      };
    case 'TOGGLE_BEATS':
      return {
        ...state,
        beats: action.enabled ? { ...DEFAULT_BEATS_CONFIG } : null,
      };
    case 'UPDATE_BEATS':
      if (!state.beats || !action.config) return state;
      return {
        ...state,
        beats: { ...state.beats, ...action.config },
      };
    case 'RESET':
      return { ...initialState };
    default:
      return state;
  }
}

interface WizardContextValue {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
  // Convenience methods
  nextStep: () => void;
  prevStep: () => void;
  setStep: (step: number) => void;
  updateElasticsearch: (config: Partial<ElasticsearchConfig>) => void;
  setElasticsearchPreset: (preset: ElasticsearchConfig['preset']) => void;
  toggleKibana: (enabled: boolean) => void;
  updateKibana: (config: Partial<KibanaConfig>) => void;
  toggleApm: (enabled: boolean) => void;
  updateApm: (config: Partial<ApmConfig>) => void;
  toggleFleet: (enabled: boolean) => void;
  updateFleet: (config: Partial<FleetConfig>) => void;
  toggleBeats: (enabled: boolean) => void;
  updateBeats: (config: Partial<BeatsConfig>) => void;
  reset: () => void;
}

const WizardContext = createContext<WizardContextValue | null>(null);

export function WizardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(wizardReducer, initialState);

  const value: WizardContextValue = {
    state,
    dispatch,
    nextStep: () => dispatch({ type: 'NEXT_STEP' }),
    prevStep: () => dispatch({ type: 'PREV_STEP' }),
    setStep: (step) => dispatch({ type: 'SET_STEP', step }),
    updateElasticsearch: (config) => dispatch({ type: 'UPDATE_ELASTICSEARCH', config }),
    setElasticsearchPreset: (preset) => dispatch({ type: 'SET_ELASTICSEARCH_PRESET', preset }),
    toggleKibana: (enabled) => dispatch({ type: 'TOGGLE_KIBANA', enabled }),
    updateKibana: (config) => dispatch({ type: 'UPDATE_KIBANA', config }),
    toggleApm: (enabled) => dispatch({ type: 'TOGGLE_APM', enabled }),
    updateApm: (config) => dispatch({ type: 'UPDATE_APM', config }),
    toggleFleet: (enabled) => dispatch({ type: 'TOGGLE_FLEET', enabled }),
    updateFleet: (config) => dispatch({ type: 'UPDATE_FLEET', config }),
    toggleBeats: (enabled) => dispatch({ type: 'TOGGLE_BEATS', enabled }),
    updateBeats: (config) => dispatch({ type: 'UPDATE_BEATS', config }),
    reset: () => dispatch({ type: 'RESET' }),
  };

  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>;
}

export function useWizard(): WizardContextValue {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizard must be used within a WizardProvider');
  }
  return context;
}
