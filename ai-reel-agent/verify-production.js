#!/usr/bin/env node

/**
 * Production Pre-Flight Verification Script
 * Checks all configurations before deployment
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('\n🔍 PRODUCTION PRE-FLIGHT VERIFICATION\n');
console.log('═'.repeat(60));

// Load environment variables
dotenv.config();

let issueCount = 0;
let warningCount = 0;

function logSuccess(message) {
  console.log(`✅ ${message}`);
}

function logWarning(message) {
  console.log(`⚠️  ${message}`);
  warningCount++;
}

function logError(message) {
  console.log(`❌ ${message}`);
  issueCount++;
}

// 1. Check Environment Variables
console.log('\n1️⃣  ENVIRONMENT VARIABLES\n');

const requiredVars = [
  'GOOGLE_GEMINI_API_KEY',
  'HEYGEN_API_KEY',
  'INSTAGRAM_ACCESS_TOKEN',
  'INSTAGRAM_BUSINESS_ACCOUNT_ID',
  'WEBHOOK_SECRET',
  'PORT',
  'NODE_ENV',
  'DATABASE_PATH',
];

requiredVars.forEach(varName => {
  const value = process.env[varName];
  
  if (!value) {
    logError(`Missing: ${varName}`);
    return;
  }
  
  if (varName === 'INSTAGRAM_BUSINESS_ACCOUNT_ID' && isNaN(parseInt(value))) {
    logError(`${varName} must be numeric, got: "${value}"`);
    return;
  }
  
  const displayValue = value.length > 20 
    ? value.substring(0, 10) + '...' + value.substring(value.length - 10)
    : value;
  
  logSuccess(`${varName}: ${displayValue}`);
});

// 2. Check Files
console.log('\n2️⃣  PROJECT FILES\n');

const requiredFiles = [
  'package.json',
  'src/server.js',
  '.gitignore',
  '.env',
  'src/database/schema.sql',
  'src/routes/webhook.js',
  'src/routes/dashboard.js',
];

requiredFiles.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    logSuccess(`Found: ${file}`);
  } else {
    logError(`Missing: ${file}`);
  }
});

// 3. Check .gitignore
console.log('\n3️⃣  SECURITY - .gitignore RULES\n');

const gitignorePath = path.join(__dirname, '.gitignore');
if (fs.existsSync(gitignorePath)) {
  const gitignore = fs.readFileSync(gitignorePath, 'utf8');
  
  const criticalPatterns = ['.env', '*.sqlite', 'node_modules/', 'database.sqlite'];
  
  criticalPatterns.forEach(pattern => {
    if (gitignore.includes(pattern)) {
      logSuccess(`${pattern} is in .gitignore`);
    } else {
      logError(`${pattern} is NOT in .gitignore (security risk)`);
    }
  });
} else {
  logError('.gitignore file not found');
}

// 4. Check package.json
console.log('\n4️⃣  PACKAGE.JSON\n');

const packageJsonPath = path.join(__dirname, 'package.json');
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  if (packageJson.scripts && packageJson.scripts.start) {
    logSuccess(`Start script defined: ${packageJson.scripts.start}`);
  } else {
    logError('No start script in package.json');
  }
  
  if (packageJson.engines && packageJson.engines.node) {
    logSuccess(`Node engine requirement: ${packageJson.engines.node}`);
  }
  
  const deps = Object.keys(packageJson.dependencies || {});
  const criticalDeps = ['express', 'sqlite3', 'dotenv', 'axios'];
  
  criticalDeps.forEach(dep => {
    if (deps.includes(dep)) {
      logSuccess(`Critical dependency installed: ${dep}`);
    } else {
      logError(`Missing critical dependency: ${dep}`);
    }
  });
} else {
  logError('package.json not found');
}

// 5. Check database
console.log('\n5️⃣  DATABASE\n');

const dbPath = process.env.DATABASE_PATH || './database.sqlite';
if (fs.existsSync(dbPath)) {
  const stats = fs.statSync(dbPath);
  const sizeKB = (stats.size / 1024).toFixed(2);
  logSuccess(`Database exists: ${dbPath} (${sizeKB} KB)`);
} else {
  logWarning(`Database not initialized yet: ${dbPath} (will be created on first run)`);
}

// 6. Check API Key Patterns
console.log('\n6️⃣  API KEY VALIDATION\n');

// Gemini key should start with AIza
if (process.env.GOOGLE_GEMINI_API_KEY?.startsWith('AIza')) {
  logSuccess('Google Gemini key format looks correct');
} else if (process.env.GOOGLE_GEMINI_API_KEY) {
  logWarning('Google Gemini key format unexpected');
}

// HeyGen key should start with sk_
if (process.env.HEYGEN_API_KEY?.startsWith('sk_')) {
  logSuccess('HeyGen key format looks correct');
} else if (process.env.HEYGEN_API_KEY) {
  logWarning('HeyGen key format unexpected');
}

// Instagram token should be long (EA prefix)
if (process.env.INSTAGRAM_ACCESS_TOKEN?.startsWith('EA')) {
  logSuccess('Instagram Access Token format looks correct');
} else if (process.env.INSTAGRAM_ACCESS_TOKEN) {
  logWarning('Instagram Access Token format unexpected');
}

// 7. Node/npm versions
console.log('\n7️⃣  RUNTIME VERSIONS\n');

const nodeVersion = process.version;
const nodeVersionNum = parseInt(nodeVersion.split('.')[0].substring(1));

if (nodeVersionNum >= 18) {
  logSuccess(`Node.js ${nodeVersion} (required: >=18)`);
} else {
  logError(`Node.js ${nodeVersion} is too old (required: >=18)`);
}

// 8. Production readiness checklist
console.log('\n8️⃣  PRODUCTION READINESS\n');

const checks = [
  {
    name: 'All required env vars present',
    pass: requiredVars.every(v => process.env[v]),
  },
  {
    name: 'Instagram Business Account ID is numeric',
    pass: !isNaN(parseInt(process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || '')),
  },
  {
    name: 'NODE_ENV is set to production',
    pass: process.env.NODE_ENV === 'production',
  },
  {
    name: 'Package.json has start script',
    pass: fs.existsSync(packageJsonPath) && 
          JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')).scripts.start,
  },
  {
    name: '.gitignore excludes .env',
    pass: fs.existsSync(gitignorePath) && 
          fs.readFileSync(gitignorePath, 'utf8').includes('.env'),
  },
];

checks.forEach(check => {
  if (check.pass) {
    logSuccess(check.name);
  } else {
    logWarning(check.name);
  }
});

// Summary
console.log('\n' + '═'.repeat(60));
console.log('\n📊 VERIFICATION SUMMARY\n');

if (issueCount === 0 && warningCount === 0) {
  console.log('🎉 ALL CHECKS PASSED - READY FOR PRODUCTION DEPLOYMENT\n');
} else if (issueCount === 0) {
  console.log(`⚠️  ${warningCount} Warning(s) - Review before deploying\n`);
} else {
  console.log(`❌ ${issueCount} Critical Issue(s) - CANNOT DEPLOY\n`);
  console.log('Please fix all critical issues before deployment.\n');
  process.exit(1);
}

console.log('═'.repeat(60) + '\n');

process.exit(issueCount > 0 ? 1 : 0);
