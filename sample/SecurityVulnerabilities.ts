// Sample file with critical security vulnerabilities
import express from 'express';
import { exec } from 'child_process';

const app = express();

// Vulnerability 1: Command Injection
export function executeCommand(userInput: string) {
  exec(`ls ${userInput}`, (error, stdout, stderr) => {
    console.log(stdout);
  });
}

// Vulnerability 2: SQL Injection
export function getUserData(userId: string, db: any) {
  const query = `SELECT * FROM users WHERE id = '${userId}'`;
  return db.query(query);
}

// Vulnerability 3: Hardcoded credentials
const API_KEY = 'sk-1234567890abcdef';
const DATABASE_PASSWORD = 'admin123';

export function connectToAPI() {
  return fetch('https://api.example.com/data', {
    headers: { 'Authorization': `Bearer ${API_KEY}` }
  });
}

// Vulnerability 4: Insecure random number generation
export function generateToken() {
  return Math.random().toString(36).substring(2);
}

// Vulnerability 5: XSS vulnerability
export function renderUserContent(content: string) {
  document.getElementById('user-content')!.innerHTML = content;
}