import React from 'react';

export interface LandingPageProps {
  onEnter: () => void;
  githubUrl?: string;
  heroSrc?: string;
}

const FEATURES = [
  {
    title: 'Live fleet tracking',
    body: 'Vehicles stream onto a real map as status-coloured, heading-aware markers with a rolling 60-minute path trace.',
    icon: '📍',
  },
  {
    title: 'Geo-fencing',
    body: 'Server-side zone containment fires Enter/Exit events the moment a driver reaches a warehouse or delivery area.',
    icon: '⬡',
  },
  {
    title: 'Route optimization',
    body: 'An OR-Tools microservice solves multi-stop routes, clusters co-located drops, and falls back gracefully.',
    icon: '⚡',
  },
  {
    title: 'Real-time streaming',
    body: 'Room-keyed WebSocket fan-out with auto-reconnect keeps every dispatcher, driver, and customer in sync.',
    icon: '⇄',
  },
];

const STACK = ['Go', 'Node · NestJS', 'Python · OR-Tools', 'React · TypeScript', 'Flutter', 'PostGIS', 'Redis', 'MapLibre'];

/** Marketing landing page shown before entering the dispatch console. */
export function LandingPage({
  onEnter,
  githubUrl = 'https://github.com/shahriar-ahmed-seam/Fleet-Command-Center',
  heroSrc = '/hero.png',
}: LandingPageProps): React.ReactElement {
  return (
    <div style={{ background: 'var(--color-bg)', color: 'var(--color-text)', minHeight: '100vh' }}>
      {/* Hero */}
      <section style={{ position: 'relative', minHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        <img
          src={heroSrc}
          alt=""
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(15,20,25,0.72) 0%, rgba(15,20,25,0.55) 38%, rgba(15,20,25,0.96) 100%)',
          }}
        />

        {/* Nav */}
        <nav
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-5) clamp(20px, 6vw, 80px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Logo />
            <span style={{ fontWeight: 700, fontSize: 'var(--font-size-lg)', letterSpacing: 0.2 }}>
              Fleet Command Center
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <a href={githubUrl} target="_blank" rel="noreferrer" style={ghostLink}>
              GitHub
            </a>
            <button type="button" onClick={onEnter} style={primaryBtn}>
              Launch dashboard
            </button>
          </div>
        </nav>

        {/* Hero copy */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '0 clamp(20px, 6vw, 80px)',
            maxWidth: 920,
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              alignSelf: 'flex-start',
              padding: '6px 14px',
              borderRadius: 'var(--radius-pill)',
              background: 'color-mix(in srgb, var(--color-accent) 18%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-accent) 40%, transparent)',
              color: 'var(--color-accent)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              letterSpacing: 0.4,
            }}
          >
            ◈ Real-time logistics platform
          </span>
          <h1
            style={{
              fontSize: 'clamp(2.4rem, 5.5vw, 4.2rem)',
              lineHeight: 1.05,
              fontWeight: 700,
              margin: 'var(--space-4) 0 var(--space-3)',
              letterSpacing: -1,
            }}
          >
            Command your fleet
            <br />
            in real time.
          </h1>
          <p
            style={{
              fontSize: 'clamp(1rem, 1.6vw, 1.25rem)',
              color: 'var(--color-text-muted)',
              maxWidth: 640,
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            Track vehicles live, trigger zone events with geo-fencing, optimize multi-stop routes,
            and keep drivers and customers in sync — on a map that actually moves.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-5)', flexWrap: 'wrap' }}>
            <button type="button" onClick={onEnter} style={{ ...primaryBtn, padding: '14px 28px', fontSize: 'var(--font-size-base)' }}>
              Launch live demo →
            </button>
            <a href={githubUrl} target="_blank" rel="noreferrer" style={{ ...outlineBtn, padding: '14px 28px', fontSize: 'var(--font-size-base)' }}>
              View source
            </a>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'var(--space-4)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-success)', boxShadow: '0 0 0 3px color-mix(in srgb, var(--color-success) 25%, transparent)' }} />
            Demo runs on an in-browser fleet simulation — no backend required.
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: 'clamp(48px, 8vw, 96px) clamp(20px, 6vw, 80px)' }}>
        <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', fontWeight: 700, margin: '0 0 var(--space-2)' }}>
          Everything dispatch needs
        </h2>
        <p style={{ color: 'var(--color-text-muted)', maxWidth: 620, margin: '0 0 var(--space-6)', lineHeight: 1.6 }}>
          A single operations console over a high-throughput backend built for thousands of location
          pings per second.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
          {FEATURES.map((f) => (
            <div
              key={f.title}
              style={{
                padding: 'var(--space-5)',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-card)',
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: 'var(--radius-control)',
                  background: 'color-mix(in srgb, var(--color-primary) 16%, transparent)',
                  fontSize: 22,
                  marginBottom: 'var(--space-3)',
                }}
              >
                {f.icon}
              </div>
              <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, margin: '0 0 6px' }}>{f.title}</h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', lineHeight: 1.6, margin: 0 }}>
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Stack strip */}
      <section style={{ padding: '0 clamp(20px, 6vw, 80px) clamp(48px, 8vw, 96px)' }}>
        <div
          style={{
            padding: 'var(--space-5)',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-card)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginRight: 8 }}>
            Built with
          </span>
          {STACK.map((s) => (
            <span
              key={s}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-pill)',
                background: 'var(--color-surface-alt)',
                border: '1px solid var(--color-border)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 500,
              }}
            >
              {s}
            </span>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid var(--color-border)',
          padding: 'var(--space-5) clamp(20px, 6vw, 80px)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-3)',
          color: 'var(--color-text-muted)',
          fontSize: 'var(--font-size-sm)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Logo size={24} />
          <span>Fleet Command Center</span>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
          <a href={githubUrl} target="_blank" rel="noreferrer" style={ghostLink}>GitHub</a>
          <button type="button" onClick={onEnter} style={{ ...ghostLink, background: 'none', border: 'none', cursor: 'pointer' }}>
            Open dashboard
          </button>
        </div>
      </footer>
    </div>
  );
}

function Logo({ size = 34 }: { size?: number }): React.ReactElement {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        display: 'grid',
        placeItems: 'center',
        borderRadius: 'var(--radius-control)',
        background: 'var(--color-primary)',
        color: 'var(--color-bg)',
        fontWeight: 800,
        fontSize: size * 0.55,
      }}
    >
      F
    </span>
  );
}

const primaryBtn: React.CSSProperties = {
  padding: '10px 18px',
  borderRadius: 'var(--radius-control)',
  background: 'var(--color-primary)',
  color: 'var(--color-bg)',
  border: 'none',
  fontWeight: 600,
  fontSize: 'var(--font-size-sm)',
  cursor: 'pointer',
};

const outlineBtn: React.CSSProperties = {
  padding: '10px 18px',
  borderRadius: 'var(--radius-control)',
  background: 'color-mix(in srgb, var(--color-surface) 60%, transparent)',
  color: 'var(--color-text)',
  border: '1px solid var(--color-border)',
  fontWeight: 600,
  fontSize: 'var(--font-size-sm)',
  cursor: 'pointer',
  textDecoration: 'none',
  backdropFilter: 'blur(4px)',
};

const ghostLink: React.CSSProperties = {
  color: 'var(--color-text)',
  textDecoration: 'none',
  fontSize: 'var(--font-size-sm)',
  fontWeight: 500,
};
