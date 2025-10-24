/**
 * User authentication and authorization module
 * Demonstrates best practices in TypeScript development
 */

import { z } from 'zod';

/**
 * User role enumeration for type-safe role management
 */
export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  GUEST = 'guest'
}

/**
 * User entity interface with complete type definitions
 */
export interface User {
  readonly id: number;
  name: string;
  email: string;
  role: UserRole;
  createdAt: Date;
  lastLogin?: Date;
}

/**
 * Configuration constants for user management
 */
const USER_CONFIG = {
  MIN_NAME_LENGTH: 2,
  MAX_NAME_LENGTH: 100,
  PASSWORD_MIN_LENGTH: 8,
  TOKEN_EXPIRY_HOURS: 24
} as const;

/**
 * Zod schema for user data validation
 */
const UserSchema = z.object({
  id: z.number().positive(),
  name: z.string().min(USER_CONFIG.MIN_NAME_LENGTH).max(USER_CONFIG.MAX_NAME_LENGTH),
  email: z.string().email(),
  role: z.nativeEnum(UserRole),
  createdAt: z.date(),
  lastLogin: z.date().optional()
});

/**
 * Custom error class for user-related operations
 */
export class UserError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'UserError';
  }
}

/**
 * Validates user data against schema
 * @param data - User data to validate
 * @returns Validated user object
 * @throws {UserError} When validation fails
 */
export function validateUser(data: unknown): User {
  try {
    return UserSchema.parse(data);
  } catch (error) {
    throw new UserError(
      'Invalid user data',
      'VALIDATION_ERROR',
      400
    );
  }
}

/**
 * Checks if user has admin privileges
 * @param user - User to check
 * @returns True if user is admin
 */
export function isAdmin(user: User): boolean {
  return user.role === UserRole.ADMIN;
}

/**
 * Formats user display name consistently
 * @param user - User object
 * @returns Formatted display name
 */
export function formatDisplayName(user: User): string {
  return user.name.trim();
}

/**
 * Calculates user account age in days
 * @param user - User object
 * @returns Number of days since account creation
 */
export function getAccountAge(user: User): number {
  const now = new Date();
  const diffMs = now.getTime() - user.createdAt.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Type guard to check if user is authenticated
 * @param user - User object or null
 * @returns Type predicate indicating if user is authenticated
 */
export function isAuthenticated(user: User | null): user is User {
  return user !== null && user.id > 0;
}

/**
 * Sanitizes email for safe storage and display
 * @param email - Email address to sanitize
 * @returns Sanitized email in lowercase
 */
export function sanitizeEmail(email: string): string {
  return email.trim().toLowerCase();
}