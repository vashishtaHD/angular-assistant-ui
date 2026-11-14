const PREFIX = 'm';

const enc = (value: string) => Buffer.from(value, 'utf8').toString('base64url');
const dec = (value: string) => Buffer.from(value, 'base64url').toString('utf8');

/**
 * Message ids are global rows in Mastra storage, so a client-chosen id could address another user's
 * row. Client (user) message ids are therefore stored under an id that is unique per resource and
 * thread: `m.<resource>.<thread>.<id>`, each part base64url encoded (no `.` inside, so it is
 * reversible and cannot be forged to collide with another scope).
 */
export function scopeMessageId(resourceId: string, threadId: string, clientId: string): string {
  return [PREFIX, enc(resourceId), enc(threadId), enc(clientId)].join('.');
}

/** Returns the client's id for a stored id; ids not scoped to this resource and thread pass through. */
export function unscopeMessageId(resourceId: string, threadId: string, storedId: string): string {
  const parts = storedId.split('.');
  if (parts.length !== 4 || parts[0] !== PREFIX) return storedId;
  try {
    if (dec(parts[1]) === resourceId && dec(parts[2]) === threadId) return dec(parts[3]);
  } catch {
    // fall through
  }
  return storedId;
}
