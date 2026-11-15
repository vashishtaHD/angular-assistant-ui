import type { Route } from '@angular/router';
import { MASTRA_AUTH } from 'angular-assistant-ui/mastra';
import { describe, expect, it } from 'vitest';
import { routes } from './app.routes';
import { ChatAppComponent } from './chat/chat-app.component';
import { ModalPageComponent } from './chat/modal-page.component';

const chatRoutes = async (): Promise<Route[]> => {
  const lazy = routes.find((r) => r.path === '');
  expect(lazy?.loadChildren).toBeDefined();
  return (await lazy!.loadChildren!()) as Route[];
};

describe('demo routes', () => {
  it('serves the full chat app at / and the assistant modal page at /modal', async () => {
    const [parent] = await chatRoutes();
    const child = (path: string) => parent!.children!.find((r) => r.path === path)?.component;
    expect(child('')).toBe(ChatAppComponent);
    expect(child('modal')).toBe(ModalPageComponent);
  });

  it('provides MASTRA_AUTH with the chat routes', async () => {
    const [parent] = await chatRoutes();
    const providers = (parent!.providers ?? []).flat(3) as { provide?: unknown }[];
    expect(providers.some((p) => p.provide === MASTRA_AUTH)).toBe(true);
  });

  it('redirects unknown paths to /', () => {
    expect(routes.find((r) => r.path === '**')?.redirectTo).toBe('');
  });
});
