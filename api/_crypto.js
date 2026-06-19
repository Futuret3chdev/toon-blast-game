import crypto from 'crypto';

export function hmacSign(data, secret) {
  return crypto.createHmac('sha256', secret).update(data).digest('hex').slice(0, 16);
}

export function mintLoginToken(user, secret, ttlMs = 10 * 60 * 1000) {
  const payload = {
    id: user.id,
    username: user.username || '',
    first_name: user.first_name || '',
    last_name: user.last_name || '',
    exp: Date.now() + ttlMs
  };
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = hmacSign(b64, secret);
  return `${b64}.${sig}`;
}

export function verifyLoginToken(token, secret) {
  if (!token || !secret) return null;
  const [b64, sig] = token.split('.');
  if (!b64 || !sig || hmacSign(b64, secret) !== sig) return null;
  try {
    const data = JSON.parse(Buffer.from(b64, 'base64url').toString());
    if (!data?.id || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export function parseStartPayload(text) {
  if (!text || !text.startsWith('mtepop_')) return null;
  const rest = text.slice(7);
  const splitAt = rest.lastIndexOf('_');
  if (splitAt < 1) return null;
  return {
    code: rest.slice(0, splitAt),
    sig: rest.slice(splitAt + 1)
  };
}