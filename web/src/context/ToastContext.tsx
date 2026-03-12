import { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { EuiGlobalToastList } from '@elastic/eui';
import type { Toast } from '@elastic/eui/src/components/toast/global_toast_list';

interface ToastOptions {
  title: string;
  color?: 'success' | 'warning' | 'danger' | 'primary';
  text?: ReactNode;
  toastLifeTimeMs?: number;
}

interface ToastContextValue {
  addToast: (options: ToastOptions) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idCounter = useRef(0);

  const addToast = useCallback((options: ToastOptions) => {
    const id = `toast-${++idCounter.current}`;
    const toast: Toast = {
      id,
      title: options.title,
      color: options.color || 'success',
      text: options.text ? <>{options.text}</> : undefined,
      toastLifeTimeMs: options.toastLifeTimeMs ?? (options.color === 'danger' ? undefined : 5000),
    };
    setToasts((prev) => [...prev, toast]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissToast = useCallback((toast: Toast) => {
    setToasts((prev) => prev.filter((t) => t.id !== toast.id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <EuiGlobalToastList
        toasts={toasts}
        dismissToast={dismissToast}
        toastLifeTimeMs={5000}
      />
    </ToastContext.Provider>
  );
}
