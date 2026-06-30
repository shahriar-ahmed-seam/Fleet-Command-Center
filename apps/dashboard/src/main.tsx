import React from 'react';
import { createRoot } from 'react-dom/client';

import './theme/globals.css';
import { BrandProvider } from './brand';
import { ToastProvider } from './components';
import { AppShell } from './shell';
import type { Role } from './auth/rbac';

const env =
  (import.meta as { env?: Record<string, string> }).env ?? {};

// Role and streaming endpoint are supplied via build-time env in a real
// deployment; sensible defaults keep the standalone demo functional.
const role = (env.VITE_ROLE as Role) ?? 'Administrator';
const streamingUrl = env.VITE_STREAMING_URL ?? 'ws://localhost:4000/stream';

function App(): React.ReactElement {
  return (
    <BrandProvider paletteUrl="/palette.json">
      <ToastProvider>
        <AppShell role={role} streamingUrl={streamingUrl} />
      </ToastProvider>
    </BrandProvider>
  );
}

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<App />);
}
