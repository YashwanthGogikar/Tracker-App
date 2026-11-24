import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => cleanup());

let n = 0;
/** Unique IndexedDB name per test so tests never share data. */
export function freshDbName(): string {
  return `test-db-${Date.now()}-${n++}`;
}

// jsdom does not implement scrolling.
window.scrollTo = () => {};
