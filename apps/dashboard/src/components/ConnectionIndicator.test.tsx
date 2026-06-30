// @vitest-environment jsdom

import { test, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ConnectionIndicator } from './ConnectionIndicator';

afterEach(cleanup);

test('shows the live state', () => {
  render(<ConnectionIndicator state="connected" />);
  expect(screen.getByRole('status').getAttribute('aria-label')).toBe(
    'Connection: Live',
  );
  expect(screen.getByText('Live')).not.toBeNull();
});

test('shows reconnecting when the socket is retrying', () => {
  render(<ConnectionIndicator state="reconnecting" />);
  expect(screen.getByText('Reconnecting')).not.toBeNull();
});

test('shows offline when disconnected', () => {
  render(<ConnectionIndicator state="offline" />);
  expect(screen.getByText('Offline')).not.toBeNull();
});
