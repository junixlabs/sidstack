/**
 * Toast Utilities
 *
 * Global toast notifications using sonner.
 * Use these functions throughout the app for consistent notifications.
 */

import { toast } from "sonner";

// Success notifications
export function showSuccess(message: string, description?: string) {
  toast.success(message, { description });
}

// Error notifications
export function showError(message: string, description?: string) {
  toast.error(message, { description });
}

// Warning notifications
export function showWarning(message: string, description?: string) {
  toast.warning(message, { description });
}

// Info notifications
export function showInfo(message: string, description?: string) {
  toast.info(message, { description });
}

// Loading state with promise
export async function showLoading<T>(
  promise: Promise<T>,
  options: {
    loading: string;
    success: string | ((data: T) => string);
    error: string | ((error: Error) => string);
  }
): Promise<T> {
  toast.promise(promise, options);
  return promise;
}

// Custom notification with action
export function showWithAction(
  message: string,
  actionLabel: string,
  onAction: () => void,
  options?: { description?: string }
) {
  toast(message, {
    description: options?.description,
    action: {
      label: actionLabel,
      onClick: onAction,
    },
  });
}

// Dismiss all toasts
export function dismissAll() {
  toast.dismiss();
}

// Re-export toast for advanced usage
export { toast };
