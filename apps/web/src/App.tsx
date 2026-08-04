import type { AppBranding } from '@hakimi/shared';

const branding: AppBranding = {
  appName: 'Hakimi / ሀኪሜ',
  tagline: 'Connecting Patients with Trusted Healthcare',
  message: 'The platform foundation is ready.',
};

export default function App() {
  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Healthcare appointment platform</p>
        <h1>{branding.appName}</h1>
        <h2>{branding.tagline}</h2>
        <p className="message">{branding.message}</p>
        <div className="status-card">
          <span className="status-dot" />
          <span>
            Monorepo foundation initialized for Ethiopia-first product work.
          </span>
        </div>
      </section>
    </main>
  );
}
