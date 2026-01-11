// Define an interface for environment checks
export interface Environment {
  isProduction(): boolean;
  isDevelopment(): boolean;
  isTest(): boolean;
}

// Check if running in production environment
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

// Check if running in development environment
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

// Check if running in test environment
export function isTest(): boolean {
  return process.env.NODE_ENV === 'test';
}

