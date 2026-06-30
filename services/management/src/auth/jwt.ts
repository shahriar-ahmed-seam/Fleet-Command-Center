import { createHmac, timingSafeEqual } from 'node:crypto';

/** Standard registered + custom claims carried by a Fleet session token. */
export interface JwtClaims {
  /** Subject: the user id (access/refresh) or delivery id (tracking token). */
  sub: string;
  /** Issued-at, epoch seconds. */
  iat: number;
  /** Expiry, epoch seconds. Verification rejects tokens at/after this time. */
  exp: number;
  /** Token kind so an access token can't be used where a refresh token is. */
  type: 'access' | 'refresh' | 'tracking';
  /** Allow additional claims (role, scope, deliveryId, ...). */
  [claim: string]: unknown;
}

/** Raised when a token's signature, structure, or type is invalid. */
export class TokenInvalidError extends Error {
  constructor(message = 'token invalid') {
    super(message);
    this.name = 'TokenInvalidError';
  }
}


export class TokenExpiredError extends Error {
  constructor(message = 'token expired') {
    super(message);
    this.name = 'TokenExpiredError';
  }
}

const HEADER = { alg: 'HS256', typ: 'JWT' } as const;

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return Buffer.from(normalized, 'base64');
}

function sign(signingInput: string, secret: string): string {
  const mac = createHmac('sha256', secret).update(signingInput).digest();
  return base64UrlEncode(mac);
}

/**
 * Encode and sign a JWT for the given claims.
 */
export function signJwt(claims: JwtClaims, secret: string): string {
  const header = base64UrlEncode(JSON.stringify(HEADER));
  const payload = base64UrlEncode(JSON.stringify(claims));
  const signingInput = `${header}.${payload}`;
  return `${signingInput}.${sign(signingInput, secret)}`;
}


export function verifyJwt(
  token: string,
  secret: string,
  nowMs: number,
): JwtClaims {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new TokenInvalidError('malformed token');
  }
  const [header, payload, signature] = parts;
  const expected = sign(`${header}.${payload}`, secret);

  const actualBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (
    actualBuf.length !== expectedBuf.length ||
    !timingSafeEqual(actualBuf, expectedBuf)
  ) {
    throw new TokenInvalidError('signature mismatch');
  }

  let claims: JwtClaims;
  try {
    claims = JSON.parse(base64UrlDecode(payload).toString('utf8')) as JwtClaims;
  } catch {
    throw new TokenInvalidError('unparseable claims');
  }

  if (typeof claims.exp !== 'number') {
    throw new TokenInvalidError('missing exp');
  }
  if (nowMs >= claims.exp * 1000) {
    throw new TokenExpiredError();
  }
  return claims;
}
