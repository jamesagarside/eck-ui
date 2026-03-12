import React from 'react';
import { useBlocker } from 'react-router-dom';
import {
  EuiConfirmModal,
} from '@elastic/eui';

/**
 * Hook that blocks navigation when the form has unsaved changes.
 * Returns the blocker object for use with UnsavedChangesPrompt.
 */
export function useUnsavedChanges(isDirty: boolean) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname,
  );

  return blocker;
}

interface UnsavedChangesPromptProps {
  isDirty: boolean;
}

/**
 * Renders a confirmation modal when the user attempts to navigate
 * away from a page with unsaved form changes.
 */
export function UnsavedChangesPrompt({ isDirty }: UnsavedChangesPromptProps) {
  const blocker = useUnsavedChanges(isDirty);

  if (blocker.state !== 'blocked') {
    return null;
  }

  return React.createElement(EuiConfirmModal, {
    title: 'Unsaved changes',
    onCancel: () => blocker.reset?.(),
    onConfirm: () => blocker.proceed?.(),
    cancelButtonText: 'Stay on page',
    confirmButtonText: 'Leave page',
    buttonColor: 'danger',
    defaultFocusedButton: 'cancel',
    children: React.createElement(
      'p',
      null,
      'You have unsaved changes. Are you sure you want to leave this page? Your changes will be lost.',
    ),
  });
}
