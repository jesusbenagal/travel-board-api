import { randomBytes } from 'crypto';

export function generateSlug(length = 16): string {
  const bytes = randomBytes(length);

  return bytes.toString('base64url');
}
