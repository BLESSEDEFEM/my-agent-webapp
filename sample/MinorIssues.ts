// Sample file with minor issues and best practice violations

// Issue 1: Missing JSDoc documentation
export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'user' | 'guest';
}

// Issue 2: Inconsistent error handling
export async function fetchUserData(userId: number): Promise<User | null> {
  try {
    const response = await fetch(`/api/users/${userId}`);
    return await response.json();
  } catch (error) {
    console.error(error); // Should use proper logging
    return null;
  }
}

// Issue 3: Missing input validation
export function calculateAge(birthYear: number): number {
  const currentYear = new Date().getFullYear();
  return currentYear - birthYear;
}

// Issue 4: Type could be more specific
export function processUserData(data: any) {
  return {
    id: data.id,
    displayName: `${data.firstName} ${data.lastName}`,
    isActive: data.status === 'active'
  };
}

// Issue 5: Missing null checks
export function getUserEmail(user: User) {
  return user.email.toLowerCase().trim();
}

// Issue 6: Async function not awaited properly
export function saveMultipleUsers(users: User[]) {
  users.forEach(user => {
    saveUser(user); // Missing await
  });
}

async function saveUser(user: User) {
  await fetch('/api/users', {
    method: 'POST',
    body: JSON.stringify(user)
  });
}

// Good practice: Proper type definition
export type UserRole = 'admin' | 'user' | 'guest';

// Good practice: Clear function signature
export function hasAdminAccess(user: User): boolean {
  return user.role === 'admin';
}