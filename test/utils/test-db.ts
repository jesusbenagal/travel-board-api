import { execSync } from 'node:child_process';

export function resetTestDb(): void {
  execSync('pnpm prisma migrate reset --force --skip-generate --skip-seed', {
    stdio: 'inherit',
    env: { ...process.env },
  });
}
