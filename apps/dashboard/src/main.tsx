import React from 'react';
import { createRoot } from 'react-dom/client';

import './theme/globals.css';
import { BrandProvider } from './brand';
import { ToastProvider } from './components';
import { AppShell } from './shell';
import { LandingPage } from './landing/LandingPage';
import type { Role } from './auth/rbac';

const env = (import.meta as { env?: Record<string, string> }).env ?? {};

const role = (env.VITE_ROLE as Role) ?? 'Administrator';
const streamingUrl = env.VITE_STREAMING_URL ?? '';
// Simulation mode is the default when no streaming backend is configured, so
// the hosted demo is fully alive without any services running.
const simulation = !streamingUrl;

const APP_ROUTES = ['map', 'deliveries', 'drivers', 'vehicles', 'zones', 'reports'];

function currentRouteIsApp(): boolean {
  const raw = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  return APP_ROUTES.includes(raw);
}

function Root(): React.ReactElement {
  const [inApp, setInApp] = React.useState(currentRouteIsApp);

  React.useEffect(() => {
    const onHash = () => setInApp(currentRouteIsApp());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const enter = () => {
    window.location.hash = '#/map';
  };
  const home = () => {
    window.location.hash = '#/home';
  };

  if (!inApp) {
    return <LandingPage onEnter={enter} />;
  }
  return (
    <AppShell
      role={role}
      streamingUrl={streamingUrl || undefined}
      simulation={simulation}
      onHome={home}
    />
  );
}

function App(): React.ReactElement {
  return (
    <BrandProvider paletteUrl="/palette.json">
      <ToastProvider>
        <Root />
      </ToastProvider>
    </BrandProvider>
  );
}

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<App />);
}
