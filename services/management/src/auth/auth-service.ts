import { ErrorCode, makeError, type ErrorEnvelope } from '@fleet/contracts';

import { Role } from './roles';
import { hashPassword, verifyPassword } from './passwords';
import {
  signJwt,
  verifyJwt,
  TokenExpiredError,
  TokenInvalidError,
  type JwtClaims,
} from './jwt';

/** A persisted user credential record. */
export interface UserRecord {
  id: string;
  email: string;
  role: Role;
  /** scrypt-encoded password hash (see passwords.ts). */
  passwordHash: string;
}

/** Lookup abstraction over the credential store (DB-backed in production). */
export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
}

/** Carried by an auth failure so callers can surface the error envelope. */
export class AuthError extends Error {
  constructor(
    public readonly envelope: ErrorEnvelope,
    public readonly httpStatus: number,
  ) {
    super(envelope.error);
    this.name = 'AuthError';
  }
}


export interface LoginResult {
  token: string;
  refreshToken: string;
  role: Role;
  /** ISO-8601 access-token expiry. */
  expiresAt: string;
}


export interface RefreshResult {
  token: string;
  expiresAt: string;
}


export interface TrackingScope {
  deliveryId: string;
  scope: string;
}

export interface AuthConfig {
  secret: string;
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
  trackingTtlSeconds: number;
  /** Current time in milliseconds; injectable for tests. */
  now: () => number;
}

const DEFAULTS = {
  accessTtlSeconds: 15 * 60, // 15 minutes
  refreshTtlSeconds: 7 * 24 * 60 * 60, // 7 days
  trackingTtlSeconds: 24 * 60 * 60, // 24 hours
} as const;

// A fixed bcrypt-shaped dummy hash used for timing equalization when the user
// is unknown. It will never verify against any password.
const DUMMY_HASH = hashPassword('::unmatchable-sentinel::');

export class AuthService {
  private readonly cfg: Required<AuthConfig>;

  constructor(
    private readonly users: UserRepository,
    config: { secret: string } & Partial<AuthConfig>,
  ) {
    this.cfg = {
      secret: config.secret,
      accessTtlSeconds: config.accessTtlSeconds ?? DEFAULTS.accessTtlSeconds,
      refreshTtlSeconds: config.refreshTtlSeconds ?? DEFAULTS.refreshTtlSeconds,
      trackingTtlSeconds:
        config.trackingTtlSeconds ?? DEFAULTS.trackingTtlSeconds,
      now: config.now ?? (() => Date.now()),
    };
  }

  private nowSeconds(): number {
    return Math.floor(this.cfg.now() / 1000);
  }

  private issue(
    sub: string,
    type: JwtClaims['type'],
    ttlSeconds: number,
    extra: Record<string, unknown> = {},
  ): { token: string; expSeconds: number } {
    const iat = this.nowSeconds();
    const exp = iat + ttlSeconds;
    const token = signJwt({ sub, iat, exp, type, ...extra }, this.cfg.secret);
    return { token, expSeconds: exp };
  }

  
  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.users.findByEmail(email);
    // Always run a verification so timing does not leak user existence.
    const ok = verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);

    if (!user || !ok) {
      throw new AuthError(makeError(ErrorCode.AuthenticationFailed), 401);
    }

    const access = this.issue(user.id, 'access', this.cfg.accessTtlSeconds, {
      role: user.role,
    });
    const refresh = this.issue(user.id, 'refresh', this.cfg.refreshTtlSeconds, {
      role: user.role,
    });

    return {
      token: access.token,
      refreshToken: refresh.token,
      role: user.role,
      expiresAt: new Date(access.expSeconds * 1000).toISOString(),
    };
  }

  
  async refresh(refreshToken: string): Promise<RefreshResult> {
    const claims = this.verifyToken(refreshToken);
    if (claims.type !== 'refresh') {
      throw new AuthError(makeError(ErrorCode.AuthenticationFailed), 401);
    }
    const access = this.issue(claims.sub, 'access', this.cfg.accessTtlSeconds, {
      role: claims.role,
    });
    return {
      token: access.token,
      expiresAt: new Date(access.expSeconds * 1000).toISOString(),
    };
  }

  
  verifyToken(token: string): JwtClaims {
    try {
      return verifyJwt(token, this.cfg.secret, this.cfg.now());
    } catch (err) {
      if (err instanceof TokenExpiredError) {
        throw new AuthError(makeError(ErrorCode.AuthenticationFailed, []), 401);
      }
      if (err instanceof TokenInvalidError) {
        throw new AuthError(makeError(ErrorCode.AuthenticationFailed, []), 401);
      }
      throw err;
    }
  }

  
  issueTrackingToken(deliveryId: string): string {
    const { token } = this.issue(
      deliveryId,
      'tracking',
      this.cfg.trackingTtlSeconds,
      { role: Role.Customer, scope: `delivery:${deliveryId}` },
    );
    return token;
  }

  
  resolveTrackingToken(token: string): TrackingScope {
    const claims = this.verifyToken(token);
    if (claims.type !== 'tracking' || typeof claims.scope !== 'string') {
      throw new AuthError(makeError(ErrorCode.AuthorizationDenied, []), 403);
    }
    return { deliveryId: claims.sub, scope: claims.scope };
  }
}

/** In-memory {@link UserRepository} for tests and local bootstrapping. */
export class InMemoryUserRepository implements UserRepository {
  private readonly byEmail = new Map<string, UserRecord>();

  /** Register a user, hashing the plaintext password. Returns the record. */
  register(
    id: string,
    email: string,
    password: string,
    role: Role,
  ): UserRecord {
    const record: UserRecord = {
      id,
      email,
      role,
      passwordHash: hashPassword(password),
    };
    this.byEmail.set(email.toLowerCase(), record);
    return record;
  }

  findByEmail(email: string): Promise<UserRecord | null> {
    return Promise.resolve(this.byEmail.get(email.toLowerCase()) ?? null);
  }
}
