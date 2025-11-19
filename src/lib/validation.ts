export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function validateStreamName(name: string): void {
  if (!name || name.trim().length === 0) {
    throw new ValidationError('Stream name is required');
  }

  if (name.length < 3) {
    throw new ValidationError('Stream name must be at least 3 characters');
  }

  if (name.length > 50) {
    throw new ValidationError('Stream name must be less than 50 characters');
  }

  if (!/^[a-z0-9-_]+$/i.test(name)) {
    throw new ValidationError('Stream name can only contain letters, numbers, hyphens, and underscores');
  }

  if (name.startsWith('-') || name.endsWith('-')) {
    throw new ValidationError('Stream name cannot start or end with a hyphen');
  }
}

export function validateEmail(email: string): void {
  if (!email || email.trim().length === 0) {
    throw new ValidationError('Email is required');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ValidationError('Please enter a valid email address');
  }
}

export function validatePassword(password: string): void {
  if (!password || password.length === 0) {
    throw new ValidationError('Password is required');
  }

  if (password.length < 6) {
    throw new ValidationError('Password must be at least 6 characters');
  }

  if (password.length > 128) {
    throw new ValidationError('Password must be less than 128 characters');
  }
}

export function validateTitle(title: string): void {
  if (title && title.length > 200) {
    throw new ValidationError('Title must be less than 200 characters');
  }
}

export function sanitizeInput(input: string): string {
  return input.trim().replace(/[<>]/g, '');
}
