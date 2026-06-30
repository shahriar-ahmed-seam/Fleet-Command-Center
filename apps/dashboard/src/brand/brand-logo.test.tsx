// @vitest-environment jsdom

import { test, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { BrandProvider } from './BrandProvider';
import { BrandLogo } from './BrandLogo';

afterEach(cleanup);

test('renders the operator logo image when a logoUrl is provided', () => {
  render(
    <BrandProvider assets={{ logoUrl: 'https://cdn.example.com/logo.svg' }}>
      <BrandLogo alt="Acme Logistics" />
    </BrandProvider>,
  );
  const img = screen.getByTestId('brand-logo-image') as HTMLImageElement;
  expect(img.getAttribute('src')).toBe('https://cdn.example.com/logo.svg');
  expect(img.getAttribute('alt')).toBe('Acme Logistics');
});

test('renders the wordmark placeholder when no logo asset is provided', () => {
  render(
    <BrandProvider assets={{ wordmark: 'Acme Logistics' }}>
      <BrandLogo />
    </BrandProvider>,
  );
  const placeholder = screen.getByTestId('brand-logo-placeholder');
  expect(placeholder.getAttribute('aria-label')).toBe('Acme Logistics');
});
