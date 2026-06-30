import fc from 'fast-check';

import { AuthService, AuthError, InMemoryUserRepository, Role } from './index';
import { pbtParams, tag } from '../testing/pbt';

const SECRET = 'property-test-secret';

/** Build a service whose clock reads from a mutable reference. */
function buildService(nowRef: { ms: number }, accessTtlSeconds: number) {
  const repo = new InMemoryUserRepository();
  repo.register('u-1', 'user@fleet.test', 'pw correct', Role.Dispatcher);
  const auth = new AuthService(repo, {
    secret: SECRET,
    accessTtlSeconds,
    now: () => nowRef.ms,
  });
  return { repo, auth };
}

describe(tag(8, 'Expired tokens are rejected until re-authentication'), () => {
  it('valid before expiry, rejected at/after expiry, restored by re-auth', async () => {
    await fc.assert(
      fc.asyncProperty(
        // base login time, in whole seconds (avoids floor() rounding noise)
        fc.integer({ min: 1_000_000_000, max: 2_000_000_000 }),
        // access-token lifetime in seconds
        fc.integer({ min: 1, max: 86_400 }),
        // how far past expiry the clock advances before re-checking
        fc.integer({ min: 0, max: 1_000_000 }),
        async (baseSeconds, ttlSeconds, overshootSeconds) => {
          const nowRef = { ms: baseSeconds * 1000 };
          const { auth } = buildService(nowRef, ttlSeconds);

          const login = await auth.login('user@fleet.test', 'pw correct');
          const expSeconds = baseSeconds + ttlSeconds;

          // Just before expiry: the token still verifies.
          nowRef.ms = expSeconds * 1000 - 1;
          expect(() => auth.verifyToken(login.token)).not.toThrow();

          nowRef.ms = expSeconds * 1000 + overshootSeconds * 1000;
          expect(() => auth.verifyToken(login.token)).toThrow(AuthError);

          // The expired token stays rejected on repeated use.
          expect(() => auth.verifyToken(login.token)).toThrow(AuthError);

          // Re-authentication issues a fresh token that verifies at "now".
          const reLogin = await auth.login('user@fleet.test', 'pw correct');
          const claims = auth.verifyToken(reLogin.token);
          expect(claims.role).toBe(Role.Dispatcher);
          expect(claims.type).toBe('access');
        },
      ),
      pbtParams(),
    );
  });
});
