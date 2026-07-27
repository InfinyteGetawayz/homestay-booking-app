import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveApiBase } from './apiBase.js';

test('uses a configured API base when provided', () => {
  assert.equal(resolveApiBase({ VITE_API_BASE: 'https://api.example.com' }), 'https://api.example.com/api');
});

test('ignores the Vite base URL for API calls and keeps /api', () => {
  assert.equal(resolveApiBase({ BASE_URL: '/app/' }), '/api');
});

test('uses an explicit API base when provided', () => {
  assert.equal(resolveApiBase({ VITE_API_BASE: 'https://api.example.com' }), 'https://api.example.com/api');
});

test('defaults to /api when no base is configured', () => {
  assert.equal(resolveApiBase({}), '/api');
});
