import { describe, expect, it } from 'vitest';
import { createAuthConfig, createHs256Verifier, resolveAuthMode, DEV_USER_ID } from './auth';
import { createMastra } from './index';
import { JWT_SECRET, signJwt } from '../testing/harness';

describe('resolveAuthMode', () => {
  it('requires an explicit mode', () => {
    expect(() => resolveAuthMode({})).toThrow(/MASTRA_AUTH_MODE/);
    expect(() => resolveAuthMode({ MASTRA_AUTH_MODE: 'none' })).toThrow(/MASTRA_AUTH_MODE/);
  });

  it('refuses dev mode without MASTRA_DEV_AUTH=1', () => {
    expect(() => resolveAuthMode({ MASTRA_AUTH_MODE: 'dev' })).toThrow(/MASTRA_DEV_AUTH=1/);
    expect(resolveAuthMode({ MASTRA_AUTH_MODE: 'dev', MASTRA_DEV_AUTH: '1' })).toBe('dev');
  });

  it('createMastra fails closed on a bad auth environment', () => {
    expect(() => createMastra({ env: { MASTRA_DB_URL: ':memory:' } })).toThrow(/MASTRA_AUTH_MODE/);
  });
});

describe('dev auth', () => {
  it('maps every token to the fixed dev user', async () => {
    const config = createAuthConfig({ env: { MASTRA_AUTH_MODE: 'dev', MASTRA_DEV_AUTH: '1' } });
    const user = await config.authenticateToken!('anything', {} as never);
    expect(config.mapUserToResourceId!(user)).toBe(DEV_USER_ID);
  });
});

describe('HS256 verifier', () => {
  const verify = createHs256Verifier(JWT_SECRET);

  it('accepts a valid token and exposes sub as the user id', async () => {
    expect(await verify(signJwt({ sub: 'alice' }))).toEqual({ id: 'alice' });
  });

  it('rejects a wrong signature, alg none, expired, not-yet-valid and sub-less tokens', async () => {
    expect(await verify(signJwt({ sub: 'alice' }, 'other-secret'))).toBeNull();
    const none = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from('{"sub":"a"}').toString('base64url')}.`;
    expect(await verify(none)).toBeNull();
    expect(await verify(signJwt({ sub: 'a', exp: Math.floor(Date.now() / 1000) - 10 }))).toBeNull();
    expect(
      await verify(signJwt({ sub: 'a', nbf: Math.floor(Date.now() / 1000) + 100 })),
    ).toBeNull();
    expect(await verify(signJwt({ name: 'no sub' }))).toBeNull();
    expect(await verify('not-a-jwt')).toBeNull();
  });

  it('jwt mode accepts a custom verifyToken hook', async () => {
    const config = createAuthConfig({
      env: { MASTRA_AUTH_MODE: 'jwt' },
      verifyToken: (token) => (token === 'good' ? { id: 'u9' } : null),
    });
    const user = await config.authenticateToken!('good', {} as never);
    expect(config.mapUserToResourceId!(user)).toBe('u9');
  });
});
