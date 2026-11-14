import { Injector, runInInjectionContext } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { MASTRA_AUTH, resolveMastraAuth, type MastraAuth } from './auth.token';

describe('resolveMastraAuth', () => {
  const auth: MastraAuth = { getHeaders: () => ({ Authorization: 'Bearer x' }) };

  it('prefers the explicit auth', () => {
    expect(resolveMastraAuth(auth)).toBe(auth);
  });

  it('reads MASTRA_AUTH in an injection context', () => {
    const injector = Injector.create({ providers: [{ provide: MASTRA_AUTH, useValue: auth }] });
    expect(runInInjectionContext(injector, () => resolveMastraAuth(undefined))).toBe(auth);
  });

  it('returns undefined outside an injection context or without a provider', () => {
    expect(resolveMastraAuth(undefined)).toBeUndefined();
    expect(
      runInInjectionContext(Injector.create({ providers: [] }), () => resolveMastraAuth(undefined)),
    ).toBeUndefined();
  });

  it('does not swallow an error thrown by the MASTRA_AUTH provider', () => {
    const injector = Injector.create({
      providers: [
        {
          provide: MASTRA_AUTH,
          useFactory: () => {
            throw new Error('auth provider failed');
          },
        },
      ],
    });
    expect(() => runInInjectionContext(injector, () => resolveMastraAuth(undefined))).toThrow(
      'auth provider failed',
    );
  });
});
