export type VerifiedSessionClaims = {
  sessionId: string;
  hasPasswordMethod: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseAdminEmails(value: string | undefined) {
  if (value === undefined || !value.trim()) return [];
  const emails = value.split(',').map((email) => email.trim().toLowerCase()).filter(Boolean);
  if (emails.length === 0) return [];
  return emails.length > 0 && emails.every((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    ? [...new Set(emails)]
    : null;
}

export function getVerifiedSessionClaims(
  authorization: string,
  verifiedUserId: string,
): VerifiedSessionClaims | null {
  const token = authorization.slice('Bearer '.length);
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const encodedPayload = parts[1].replaceAll('-', '+').replaceAll('_', '/');
    const payload = atob(encodedPayload.padEnd(Math.ceil(encodedPayload.length / 4) * 4, '='));
    const claims: unknown = JSON.parse(new TextDecoder().decode(
      Uint8Array.from(payload, (character) => character.charCodeAt(0)),
    ));
    if (!isRecord(claims)
        || claims.sub !== verifiedUserId
        || typeof claims.session_id !== 'string'
        || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(claims.session_id)) {
      return null;
    }
    const methods = Array.isArray(claims.amr) ? claims.amr : [];
    return {
      sessionId: claims.session_id,
      hasPasswordMethod: methods.some((method) => isRecord(method) && method.method === 'password'),
    };
  } catch {
    return null;
  }
}

export async function hashAdminCode(sessionId: string, code: string, pepper: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pepper),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${sessionId}:${code}`));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
