import { ErrorCode } from '@fleet/contracts';

import {
  AuthService,
  AuthError,
  InMemoryUserRepository,
  Role,
} from './index';

const SECRET = 'test-secret-please-change';

function buildService(nowRef: { ms: number }) {
  const repo = new InMemoryUserRepository();
  repo.register('u-1', 'admin@fleet.test', 'correct horse', Role.Administrator);
  repo.register('u-2', 'driver@fleet.test', 'battery staple', Role.Driver);
  const auth = new AuthService(repo, {
    secret: SECRET,
    accessTtlSeconds: 900,
    refreshTtlSeconds: 3600,
    trackingTtlSeconds: 1800,
    now: () => nowRef.ms,
  });
  return { repo, auth };
}

describe('AuthService.login', () => {
  it('issues a role-bearing access token for valid credentials', async () => {
    const nowRef = { ms: 1_000_000_000_000 };
    const { auth } = buildService(nowRef);

    const result = await auth.login('admin@fleet.test', 'correct horse');

    expect(result.role).toBe(Role.Administrator);
    expect(result.token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
    const claims = auth.verifyToken(result.token);
    expect(claims.sub).toBe('u-1');
    expect(claims.role).toBe(Role.Administrator);
    expect(claims.type).toBe('access');
  });

  it('returns an identical generic error for wrong password and unknown user', async () => {
    const nowRef = { ms: 1_000_000_000_000 };
    const { auth } = buildService(nowRef);

    const capture = async (email: string, pw: string): Promise<AuthError> => {
      try {
        await auth.login(email, pw);
        throw new Error('expected login to reject');
      } catch (e) {
        return e as AuthError;
      }
    };

    const wrongPassword = await capture('admin@fleet.test', 'nope');
    const unknownUser = await capture('ghost@fleet.test', 'whatever');

    expect(wrongPassword).toBeInstanceOf(AuthError);
    expect(unknownUser).toBeInstanceOf(AuthError);
    expect(wrongPassword.envelope).toEqual(unknownUser.envelope);
    expect(wrongPassword.envelope.error).toBe(ErrorCode.AuthenticationFailed);
    expect(wrongPassword.httpStatus).toBe(401);
  });
});

describe('token expiry and refresh', () => {
  it('rejects an access token once it has expired', async () => {
    const nowRef = { ms: 1_000_000_000_000 };
    const { auth } = buildService(nowRef);
    const { token } = await auth.login('driver@fleet.test', 'battery staple');

    // Just before expiry: still valid.
    nowRef.ms += 899 * 1000;
    expect(() => auth.verifyToken(token)).not.toThrow();

    // At/after expiry: rejected, prompting re-authentication.
    nowRef.ms += 2 * 1000;
    expect(() => auth.verifyToken(token)).toThrow(AuthError);
  });

  it('refresh exchanges a valid refresh token for a fresh access token', async () => {
    const nowRef = { ms: 1_000_000_000_000 };
    const { auth } = buildService(nowRef);
    const login = await auth.login('driver@fleet.test', 'battery staple');

    nowRef.ms += 1000 * 1000; // access token now expired, refresh still valid
    expect(() => auth.verifyToken(login.token)).toThrow(AuthError);

    const refreshed = await auth.refresh(login.refreshToken);
    const claims = auth.verifyToken(refreshed.token);
    expect(claims.type).toBe('access');
    expect(claims.role).toBe(Role.Driver);
  });

  it('rejects using an access token where a refresh token is required', async () => {
    const nowRef = { ms: 1_000_000_000_000 };
    const { auth } = buildService(nowRef);
    const login = await auth.login('driver@fleet.test', 'battery staple');

    await expect(auth.refresh(login.token)).rejects.toBeInstanceOf(AuthError);
  });
});

describe('customer tracking-link capability tokens', () => {
  it('issues a token scoped to exactly one delivery', () => {
    const nowRef = { ms: 1_000_000_000_000 };
    const { auth } = buildService(nowRef);

    const token = auth.issueTrackingToken('delivery-123');
    const scope = auth.resolveTrackingToken(token);

    expect(scope.deliveryId).toBe('delivery-123');
    expect(scope.scope).toBe('delivery:delivery-123');
  });

  it('does not accept a regular access token as a tracking token', async () => {
    const nowRef = { ms: 1_000_000_000_000 };
    const { auth } = buildService(nowRef);
    const login = await auth.login('admin@fleet.test', 'correct horse');

    expect(() => auth.resolveTrackingToken(login.token)).toThrow(AuthError);
  });
});
