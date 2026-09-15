import type { AppBranding } from '@hakimi/shared';

export const branding = {
  appName: 'Hakimi / ሀኪሜ',
  tagline: 'Connecting Patients with Trusted Healthcare',
  message: 'Synthetic appointment scheduling demo for reviewers.',
} satisfies AppBranding;

export const demoBoundaryMessages = [
  'Synthetic data only',
  'Portfolio demonstration',
  'Not connected to a production healthcare service',
] as const;

export const demoDisclaimer =
  'All displayed people, facilities, appointments, and reminders are fictional. Scheduling happens only in this browser session and is not persisted to the Hakimi API or any database.';

export const demoConfirmation =
  'This appointment exists only in the current demo session. No API request was sent and no database record was created.';
