import { createHash } from 'crypto';

export function createWeakEtag(obj: unknown): string {
  const json = JSON.stringify(obj);
  const hash = createHash('sha1').update(json).digest('hex');
  return `W/"${hash}"`;
}
