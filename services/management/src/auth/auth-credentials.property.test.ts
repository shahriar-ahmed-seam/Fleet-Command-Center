import fc from 'fast-check';

import { AuthService, AuthError, InMemoryUserRepository, Role } from './index';
import { pbtParams, tag } from '../testing/pbt';

const SECRET = 'property-test-secret';
const NOW_MS = 1_700_000_000_000;

function buildService() {
  const repo = new InMemoryUserRepository();
  const auth = new AuthService(repo, { secret: SECRET, now: () => NOW_MS });
  return { repo, auth };
}

/** A non-empty credential string, including non-ASCII content. */
const nonEmpty = fc.oneof(
  fc.string({ minLength: 1 }).filter((s) => s.length > 0),
  fc.constantFrom('correct horse', '日本語パス', 'Ångström', 'πάσσword🔑'),
);

const roleArb = fc.constantFrom(
  Role.Administrator,
  Role.Dispatcher,
  Role.Driver,
  Role.Customer,
);

const userArb = fc.record({
  id: fc.uuid(),
  // Emails are looked up case-insensitively; keep them simple + unique-able.
  email: fc.string({ minLength: 1 }).map((s) => `user+${s.replace(/[^\w]/g, '')}@fleet.test`),
  password: nonEmpty,
  role: roleArb,
});

describe(tag(7, 'Valid credentials authenticate; invalid fail indistinguishably'), () => {
  it('issues a role-bearing token for correct credentials', async () => {
    await fc.assert(
      fc.asyncProperty(userArb, async (u) => {
        const { repo, auth } = buildService();
        repo.register(u.id, u.email, u.password, u.role);

        const result = await auth.login(u.email, u.password);

        // Token carries the user's role and subject.
        expect(result.role).toBe(u.role);
        const claims = auth.verifyToken(result.token);
        expect(claims.sub).toBe(u.id);
        expect(claims.role).toBe(u.role);
        expect(claims.type).toBe('access');
      }),
      pbtParams(),
    );
  });

  it('rejects wrong-password and unknown-user identically', async () => {
    await fc.assert(
      fc.asyncProperty(
        userArb,
        nonEmpty,
        fc.string({ minLength: 1 }),
        async (u, wrongPassword, unknownSuffix) => {
          // Constrain the inputs so the "invalid" attempts are genuinely invalid.
          fc.pre(wrongPassword !== u.password);
          const unknownEmail = `ghost+${unknownSuffix.replace(/[^\w]/g, '')}-x@fleet.test`;
          fc.pre(unknownEmail.toLowerCase() !== u.email.toLowerCase());

          const { repo, auth } = buildService();
          repo.register(u.id, u.email, u.password, u.role);

          const capture = async (
            email: string,
            pw: string,
          ): Promise<AuthError> => {
            try {
              await auth.login(email, pw);
              throw new Error('expected login to reject');
            } catch (e) {
              return e as AuthError;
            }
          };

          const wrongPw = await capture(u.email, wrongPassword);
          const unknownUser = await capture(unknownEmail, wrongPassword);

          // Both failures are AuthErrors with identical envelope + status, so a
          // caller cannot distinguish a bad password from a missing account.
          expect(wrongPw).toBeInstanceOf(AuthError);
          expect(unknownUser).toBeInstanceOf(AuthError);
          expect(wrongPw.envelope).toEqual(unknownUser.envelope);
          expect(wrongPw.httpStatus).toBe(unknownUser.httpStatus);
          expect(wrongPw.message).toBe(unknownUser.message);
        },
      ),
      pbtParams(),
    );
  });
});
