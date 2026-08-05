import { runMigrationCommand } from './migrations/runner.js';

function isMigrationCommand(value: string): value is 'up' | 'down' | 'status' {
  return value === 'up' || value === 'down' || value === 'status';
}

async function main() {
  const command = process.argv[2];

  if (!command || !isMigrationCommand(command)) {
    console.error('Usage: npm run migrate -- <up|down|status>');
    process.exitCode = 1;
    return;
  }

  await runMigrationCommand(command);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
