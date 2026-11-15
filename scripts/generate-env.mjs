#!/usr/bin/env node
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

/**
 * Generates a 64-character SHA-256 hex hash from cryptographically random bytes.
 */
export function generateHashedSecret() {
  return createHash('sha256').update(randomBytes(32)).digest('hex');
}

/**
 * Builds .env content from .env.example template using a random SHA-256 hash
 * for every password/secret key and filling POSTGRESS_USERNAME from user input.
 */
export function buildEnvFromTemplate(template, { username }) {
  const cleanUsername = (username ?? '').trim();
  if (!cleanUsername) {
    throw new Error('Username wajib diisi untuk mengisi POSTGRESS_USERNAME.');
  }

  return template
    .split(/\r?\n/)
    .map((line) => {
      const match = line.match(/^(#\s*)?([A-Z0-9_]+)=(.*)$/);
      if (!match) return line;
      const [, prefix = '', key] = match;

      if (key === 'POSTGRESS_USERNAME' || key === 'POSTGRES_USERNAME') {
        return `${prefix}${key}=${cleanUsername}`;
      }
      if (/(SECRET|PASSWORD)/i.test(key)) {
        return `${prefix}${key}=${generateHashedSecret()}`;
      }
      return line;
    })
    .join('\n');
}

function parseArgs(argv) {
  const opts = {
    username: '',
    outputPath: resolve(process.cwd(), '.env'),
    templatePath: resolve(process.cwd(), '.env.example'),
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if ((arg === '--username' || arg === '-u') && argv[i + 1]) {
      opts.username = argv[++i];
    } else if (arg.startsWith('--username=')) {
      opts.username = arg.slice('--username='.length);
    } else if ((arg === '--output' || arg === '-o') && argv[i + 1]) {
      opts.outputPath = resolve(process.cwd(), argv[++i]);
    } else if (arg.startsWith('--output=')) {
      opts.outputPath = resolve(process.cwd(), arg.slice('--output='.length));
    } else if (arg === '--template' && argv[i + 1]) {
      opts.templatePath = resolve(process.cwd(), argv[++i]);
    } else if (!arg.startsWith('-') && !opts.username) {
      opts.username = arg;
    }
  }

  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  let username = opts.username.trim();

  if (!username) {
    const rl = createInterface({ input, output });
    try {
      username = (
        await rl.question('Masukkan username database (POSTGRESS_USERNAME): ')
      ).trim();
    } finally {
      rl.close();
    }
  }

  if (!username) {
    console.error(
      'Error: Username tidak boleh kosong. Contoh: pnpm env:generate <username>',
    );
    process.exit(1);
  }

  const template = readFileSync(opts.templatePath, 'utf8');
  const content = buildEnvFromTemplate(template, { username });
  writeFileSync(opts.outputPath, content, 'utf8');

  console.log(`Berhasil men-generate file konfigurasi: ${opts.outputPath}`);
  console.log(`- POSTGRESS_USERNAME: ${username}`);
  console.log(
    '- JWT_SECRET_KEY & POSTGRESS_PASSWORD: [generated random SHA-256 hash]',
  );
}

const isMain =
  process.argv[1] &&
  resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);

if (isMain) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
