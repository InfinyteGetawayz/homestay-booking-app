import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveApiBase } from './apiBase.js';

test('uses a configured API base when provided', () => {
  assert.equal(resolveApiBase({ VITE_API_BASE: 'https://api.example.com' }), 'https://api.example.com/api');
});

test('builds an API path from the Vite base URL', () => {
  assert.equal(resolveApiBase({ BASE_URL: '/app/' }), '/app/api');
});

test('defaults to /api when no base is configured', () => {
  assert.equal(resolveApiBase({}), '/api');
});
