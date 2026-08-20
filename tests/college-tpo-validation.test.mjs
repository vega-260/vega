import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Email and phone validators conform to production standards', () => {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9]+([.-][a-zA-Z0-9]+)*\.[a-zA-Z]{2,}$/;
  const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{6,15}$/;
  const collegeCodeRegex = /^[A-Z0-9_-]{2,30}$/;

  // Invalid email test cases (like Bug ID-003: gmail@.com, gmail.com, etc.)
  assert.equal(emailRegex.test('gmail@.com'), false, 'gmail@.com must be invalid');
  assert.equal(emailRegex.test('gmail.com'), false, 'gmail.com must be invalid');
  assert.equal(emailRegex.test('user@'), false, 'user@ must be invalid');
  assert.equal(emailRegex.test('user@domain'), false, 'user@domain must be invalid');
  assert.equal(emailRegex.test('@domain.com'), false, '@domain.com must be invalid');
  assert.equal(emailRegex.test('user@domain..com'), false, 'user@domain..com must be invalid');

  // Valid email test cases
  assert.equal(emailRegex.test('contact@wit.edu.in'), true, 'contact@wit.edu.in must be valid');
  assert.equal(emailRegex.test('tpo.head@university.ac.in'), true, 'tpo.head@university.ac.in must be valid');
  assert.equal(emailRegex.test('admin@college.org'), true, 'admin@college.org must be valid');

  // Phone validation test cases
  assert.equal(phoneRegex.test('+91-9876543210'), true);
  assert.equal(phoneRegex.test('9876543210'), true);
  assert.equal(phoneRegex.test('123'), false, 'Too short phone number');

  // College code validation test cases
  assert.equal(collegeCodeRegex.test('WIT-SOLAPUR'), true);
  assert.equal(collegeCodeRegex.test('COEP_PUNE'), true);
  assert.equal(collegeCodeRegex.test('A'), false, 'Too short code');
});

test('Backend college and TPO routes have input validation and sanitization', () => {
  const routesFile = path.resolve('server/features/admin/collegeTpoRoutes.ts');
  const code = fs.readFileSync(routesFile, 'utf8');

  // Verifies college registration validation
  assert.match(code, /EMAIL_REGEX/, 'collegeTpoRoutes must define EMAIL_REGEX');
  assert.match(code, /PHONE_REGEX/, 'collegeTpoRoutes must define PHONE_REGEX');
  assert.match(code, /URL_REGEX/, 'collegeTpoRoutes must define URL_REGEX');
  assert.match(code, /COLLEGE_CODE_REGEX/, 'collegeTpoRoutes must define COLLEGE_CODE_REGEX');

  // Check 400 Bad Request error returns instead of 500 for invalid inputs
  assert.match(code, /status\(400\)/, 'Routes must return 400 for validation errors');
  assert.match(code, /College\/Institute name is required/i, 'Requires college name');
  assert.match(code, /College code must be/i, 'Validates college code');
  assert.match(code, /Please enter a valid official email/i, 'Validates official email');
  assert.match(code, /status\(201\)/, 'Returns 201 Created on successful college registration');
});

test('Frontend CollegeModal and TpoModal components exist and include inline validation', () => {
  const collegeModalPath = path.resolve('src/components/admin/CollegeModal.tsx');
  const tpoModalPath = path.resolve('src/components/admin/TpoModal.tsx');
  const validatorsPath = path.resolve('src/utils/validators.ts');

  assert.equal(fs.existsSync(collegeModalPath), true, 'CollegeModal component exists');
  assert.equal(fs.existsSync(tpoModalPath), true, 'TpoModal component exists');
  assert.equal(fs.existsSync(validatorsPath), true, 'Validators utility exists');

  const collegeModalCode = fs.readFileSync(collegeModalPath, 'utf8');
  assert.match(collegeModalCode, /validateField/, 'CollegeModal has validateField inline validation');
  assert.match(collegeModalCode, /isValidEmail/, 'CollegeModal uses isValidEmail');
  assert.match(collegeModalCode, /role="alert"/, 'CollegeModal contains accessible inline error alerts');

  const tpoModalCode = fs.readFileSync(tpoModalPath, 'utf8');
  assert.match(tpoModalCode, /validateField/, 'TpoModal has validateField inline validation');
  assert.match(tpoModalCode, /isValidEmail/, 'TpoModal uses isValidEmail');
  assert.match(tpoModalCode, /role="alert"/, 'TpoModal contains accessible inline error alerts');
});
