// Validator interface
export interface Validator {
  isNonEmptyString(value: unknown): value is string;
  isPositiveNumber(value: unknown): value is number;
  isValidUUID(value: unknown): value is string;
  isValidEmail(value: unknown): value is string;
  isInRange(value: number, min: number, max: number): boolean;
  validateRequiredFields<T extends Record<string, any>>(
    data: T,
    requiredFields: (keyof T)[]
  ): string[];
}

// Check if value is a non-empty string
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

// Check if value is a positive number
export function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && value > 0;
}

// Check if value is a valid UUID
export function isValidUUID(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

// Check if value is a valid email
export function isValidEmail(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

// Check if number is within specified range
export function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

// Validate required fields are present - returns array of missing field names
export function validateRequiredFields<T extends Record<string, any>>(
  data: T,
  requiredFields: (keyof T)[]
): string[] {
  const missingFields: string[] = [];
  
  for (const field of requiredFields) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      missingFields.push(String(field));
    }
  }
  
  return missingFields;
}
