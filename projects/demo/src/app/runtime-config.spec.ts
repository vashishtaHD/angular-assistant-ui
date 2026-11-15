// Original angular-assistant-ui demo code (no upstream counterpart; no code copied).
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_RUNTIME_CONFIG,
  RuntimeConfigError,
  RuntimeConfigStore,
  mastraAuthFromConfig,
  parseRuntimeConfig,
  renderStartupError,
} from './runtime-config';

const serve = (status: number, body: unknown) =>
  vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(JSON.stringify(body), { status }) as Response);

describe('parseRuntimeConfig', () => {
  it('accepts a complete config and trims the URL', () => {
    expect(
      parseRuntimeConfig(
        { mastraUrl: ' https://api.example.com/ ', agentId: 'chatAgent', authToken: 't' },
        { production: true },
      ),
    ).toEqual({ mastraUrl: 'https://api.example.com', agentId: 'chatAgent', authToken: 't' });
  });

  it('rejects wrong types and values with every problem named', () => {
    const attempt = (raw: unknown) => {
      try {
        parseRuntimeConfig(raw, { production: false });
        return [];
      } catch (error) {
        expect(error).toBeInstanceOf(RuntimeConfigError);
        return (error as RuntimeConfigError).problems;
      }
    };
    expect(attempt({ mastraUrl: null, agentId: 7, authToken: 123 })).toEqual([
      'mastraUrl must be an absolute http(s) URL',
      'agentId must be a non-empty string of letters, digits, "-" or "_"',
      'authToken must be a string',
    ]);
    expect(attempt({ mastraUrl: 'api.example.com' })).toEqual([
      'mastraUrl must be an absolute http(s) URL',
    ]);
    expect(attempt({ mastraUrl: 'javascript:alert(1)' })).toEqual([
      'mastraUrl must be an absolute http(s) URL',
    ]);
    expect(attempt({ agentId: '../admin' })).toHaveLength(1);
    expect(attempt([])).toEqual(['config.json must hold a JSON object']);
  });

  it('defaults missing keys in development only', () => {
    expect(parseRuntimeConfig({}, { production: false })).toEqual(DEFAULT_RUNTIME_CONFIG);
    expect(() => parseRuntimeConfig({ agentId: 'chatAgent' }, { production: true })).toThrow(
      /mastraUrl is required in a production build/,
    );
    expect(() =>
      parseRuntimeConfig({ mastraUrl: 'https://api.example.com' }, { production: true }),
    ).toThrow(/agentId is required in a production build/);
  });
});

describe('RuntimeConfigStore.load', () => {
  afterEach(() => vi.restoreAllMocks());

  const store = () => TestBed.inject(RuntimeConfigStore);

  it('loads and validates the file', async () => {
    serve(200, { mastraUrl: 'https://api.example.com', agentId: 'a1' });
    await store().load('/config.json', { production: true });
    expect(store().config).toEqual({ mastraUrl: 'https://api.example.com', agentId: 'a1' });
  });

  it('fails startup in production when the file is missing, instead of using localhost', async () => {
    serve(404, {});
    await expect(store().load('/config.json', { production: true })).rejects.toThrow(
      RuntimeConfigError,
    );
    expect(store().config).toBe(DEFAULT_RUNTIME_CONFIG);
  });

  it('fails startup when the file holds an invalid value, also in development', async () => {
    serve(200, { mastraUrl: 'http://localhost:4111', agentId: 'chatAgent', authToken: 123 });
    await expect(store().load('/config.json', { production: false })).rejects.toThrow(
      /authToken must be a string/,
    );
  });

  it('falls back to the defaults with a warning in development when the file is missing', async () => {
    serve(404, {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await store().load('/config.json', { production: false });
    expect(store().config).toEqual(DEFAULT_RUNTIME_CONFIG);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('startup error', () => {
  it('renders the problems as text in the page', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const doc = document.implementation.createHTMLDocument('x');
    renderStartupError(
      new RuntimeConfigError(['mastraUrl must be an absolute http(s) URL', '<b>x</b>']),
      doc,
    );
    expect(doc.body.querySelector('[role="alert"]')?.textContent).toContain(
      'mastraUrl must be an absolute http(s) URL',
    );
    expect(doc.body.querySelector('b')).toBeNull();
    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });

  it('mastraAuthFromConfig sends a trimmed bearer token, or nothing', () => {
    expect(
      mastraAuthFromConfig({ ...DEFAULT_RUNTIME_CONFIG, authToken: ' t ' }).getHeaders(),
    ).toEqual({ Authorization: 'Bearer t' });
    expect(mastraAuthFromConfig(DEFAULT_RUNTIME_CONFIG).getHeaders()).toEqual({});
  });
});
