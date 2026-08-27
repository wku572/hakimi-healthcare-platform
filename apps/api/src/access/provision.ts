import { fstatSync } from 'node:fs';
import { createPostgresPool } from '../database.js';
import { loadEnvironment } from '../env.js';
import {
  createStructuredLogger,
  OBSERVABILITY_EVENT_CODES,
} from '../observability/logger.js';
import {
  createProvisioningService,
  provisioningCommandSchema,
} from './provisioning.js';

const MAX_INPUT_BYTES = 32 * 1024;

async function readInteractiveInput() {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    throw new Error('INTERACTIVE_INPUT_REQUIRED');
  }

  process.stderr.write('Provisioning input: ');
  process.stdin.setRawMode(true);
  process.stdin.resume();

  return new Promise<string>((resolve, reject) => {
    let input = '';

    function finish() {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.off('data', onData);
      process.stderr.write('\n');
    }

    function onData(chunk: Buffer) {
      for (const byte of chunk) {
        if (byte === 3) {
          finish();
          reject(new Error('INPUT_CANCELLED'));
          return;
        }

        if (byte === 13 || byte === 10) {
          finish();
          resolve(input);
          return;
        }

        if (byte === 8 || byte === 127) {
          input = input.slice(0, -1);
          continue;
        }

        input += String.fromCharCode(byte);
        if (Buffer.byteLength(input, 'utf8') > MAX_INPUT_BYTES) {
          finish();
          reject(new Error('INPUT_TOO_LARGE'));
          return;
        }
      }
    }

    process.stdin.on('data', onData);
  });
}

async function readRestrictedFileInput() {
  const metadata = fstatSync(0);

  if (!metadata.isFile() || process.platform === 'win32') {
    throw new Error('RESTRICTED_FILE_INPUT_REQUIRED');
  }

  if ((metadata.mode & 0o077) !== 0) {
    throw new Error('INSECURE_INPUT_PERMISSIONS');
  }

  const chunks: Buffer[] = [];
  let length = 0;

  for await (const chunk of process.stdin) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += buffer.length;
    if (length > MAX_INPUT_BYTES) {
      throw new Error('INPUT_TOO_LARGE');
    }
    chunks.push(buffer);
  }

  return Buffer.concat(chunks).toString('utf8');
}

async function main() {
  if (process.argv.length > 2) {
    throw new Error('COMMAND_LINE_VALUES_PROHIBITED');
  }

  const environment = loadEnvironment();
  const logger = createStructuredLogger({
    service: 'hakimi-api',
    level: environment.LOG_LEVEL,
  });
  const pool = createPostgresPool(environment.DATABASE_URL);

  try {
    const input = process.stdin.isTTY
      ? await readInteractiveInput()
      : await readRestrictedFileInput();
    const command = provisioningCommandSchema.parse(JSON.parse(input));
    const result = await createProvisioningService(pool)(command);
    logger.info(OBSERVABILITY_EVENT_CODES.accessProvisioningCompleted, {
      affectedCount: result.affectedCount,
    });
  } catch {
    logger.error(OBSERVABILITY_EVENT_CODES.accessProvisioningFailed, {
      affectedCount: 0,
    });
    process.exitCode = 1;
  } finally {
    await pool.end().catch(() => {
      process.exitCode = 1;
    });
  }
}

void main();
