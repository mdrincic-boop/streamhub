import { PostgrestError } from '@supabase/supabase-js';

export class AppError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function handleSupabaseError(error: PostgrestError): AppError {
  const errorMap: Record<string, string> = {
    '23505': 'A record with this information already exists',
    '23503': 'Referenced record does not exist',
    '42501': 'You do not have permission to perform this action',
    'PGRST116': 'No data found',
  };

  const message = errorMap[error.code] || error.message || 'An unexpected error occurred';

  return new AppError(message, error.code, 400);
}

export function handleAuthError(error: any): AppError {
  const errorMessages: Record<string, string> = {
    'Invalid login credentials': 'Invalid email or password',
    'Email not confirmed': 'Please verify your email address',
    'User already registered': 'An account with this email already exists',
    'Password should be at least 6 characters': 'Password must be at least 6 characters long',
  };

  const message = errorMessages[error.message] || error.message || 'Authentication failed';

  return new AppError(message, error.code, 401);
}

export function logError(error: Error | AppError, context?: string) {
  if (import.meta.env.DEV) {
    console.error(`[${context || 'Error'}]:`, error);
  }
}

export function showErrorToast(error: Error | AppError) {
  const message = error instanceof AppError ? error.message : 'An unexpected error occurred';
  alert(message);
}
