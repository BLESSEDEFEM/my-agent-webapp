// Sample file with code smells and maintainability issues

// Issue 1: God class - too many responsibilities
export class UserManager {
  private users: any[] = [];
  
  // Authentication
  login(email: string, password: string) {
    const user = this.users.find(u => u.email === email);
    if (user && user.password === password) {
      return { token: 'abc123', user };
    }
    return null;
  }
  
  // Database operations
  saveToDatabase(user: any) {
    // database logic
    this.users.push(user);
  }
  
  // Email operations
  sendWelcomeEmail(email: string) {
    console.log(`Sending email to ${email}`);
  }
  
  // Payment processing
  processPayment(userId: number, amount: number) {
    console.log(`Processing payment of ${amount}`);
  }
  
  // Analytics
  trackUserActivity(userId: number, action: string) {
    console.log(`User ${userId} performed ${action}`);
  }
}

// Issue 2: Magic numbers
export function calculateDiscount(price: number, customerType: string) {
  if (customerType === 'premium') {
    return price * 0.2;
  } else if (customerType === 'regular') {
    return price * 0.1;
  } else if (customerType === 'new') {
    return price * 0.05;
  }
  return 0;
}

// Issue 3: Long parameter list
export function createUser(
  firstName: string,
  lastName: string,
  email: string,
  password: string,
  age: number,
  address: string,
  city: string,
  country: string,
  zipCode: string,
  phone: string
) {
  return { firstName, lastName, email, password, age, address, city, country, zipCode, phone };
}

// Issue 4: Deeply nested conditionals
export function validateOrder(order: any) {
  if (order) {
    if (order.items) {
      if (order.items.length > 0) {
        if (order.customer) {
          if (order.customer.address) {
            if (order.customer.address.zipCode) {
              return true;
            }
          }
        }
      }
    }
  }
  return false;
}

// Issue 5: Duplicate code
export function formatUserName(user: any) {
  return user.firstName + ' ' + user.lastName;
}

export function formatCustomerName(customer: any) {
  return customer.firstName + ' ' + customer.lastName;
}

export function formatEmployeeName(employee: any) {
  return employee.firstName + ' ' + employee.lastName;
}

// Issue 6: Unclear variable names
export function calc(a: number, b: number, c: number) {
  const x = a * b;
  const y = x + c;
  const z = y / 2;
  return z;
}