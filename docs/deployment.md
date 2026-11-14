# Deployment

The demo is a static Angular build that talks to a separate Mastra server. Deploy
them independently.

## Hosting the Mastra server

```bash
npm run build -w mastra-server   # runs `mastra build`
```

`mastra build` writes a self-contained Node server to `mastra-server/.mastra/output`;
run it with `node` (Node 22.13 or newer, as Mastra 1.x requires) on any host that can run a long-lived process
(a container, a VM, or a Node PaaS). The chat route streams responses, so make sure the
platform's request timeout and any proxy response buffering do not cut streams short.

## Secrets

Provide `OPENAI_API_KEY` or `OPENROUTER_API_KEY` (matching `MASTRA_MODEL`) as
environment variables from your platform's secret store. `mastra-server/.env` is for
local development only and is gitignored. Never put provider keys in the Angular app
or in `config.json`: both are public.

## CORS: `FRONTEND_ORIGIN`

The server allows exactly one origin, `FRONTEND_ORIGIN` (default
`http://localhost:4200`), with credentials. In production set it to the origin that
serves the Angular app, for example `https://chat.example.com` (scheme and host, no
trailing slash or path).

## Per-environment `/config.json`

The demo reads `mastraChatUrl` from `/config.json` at startup, so one build fits every
environment. Serve a different file per environment:

```json
{ "mastraChatUrl": "https://api.example.com/chat/chatAgent" }
```

The file is fetched from the absolute path `/config.json` with `cache: 'no-cache'`. If
you deploy under a `<base href>` sub-path (for example `/app/`), serve the file at the
host root as well, or change the loader (`load(url)` in
`projects/demo/src/app/runtime-config.ts`) to resolve against the base href. If the file
is missing, the app logs a warning and falls back to the localhost default.

## Gating the chat route

The chat route is open by default. Before exposing it, add auth middleware to the
Mastra server (`server.middleware` in `mastra-server/src/mastra/index.ts`) that rejects
requests without valid credentials, for example by checking a bearer token or session
cookie.

Then forward credentials from Angular by providing your own `CHAT_TRANSPORT`, which the
demo's chat component uses instead of its default transport:

```ts
import { type ApplicationConfig, inject } from '@angular/core';
import { AssistantChatTransport } from '@assistant-ui/ai-sdk';
import { CHAT_TRANSPORT } from './chat/chat-transport.token';
import { MASTRA_CHAT_URL } from './runtime-config';

export const appConfig: ApplicationConfig = {
  providers: [
    // ...
    {
      provide: CHAT_TRANSPORT,
      useFactory: () => {
        const auth = inject(AuthService); // your own service
        return new AssistantChatTransport({
          api: inject(MASTRA_CHAT_URL),
          headers: () => ({ Authorization: `Bearer ${auth.token()}` }),
          credentials: 'include',
        });
      },
    },
  ],
};
```

`credentials: 'include'` sends cookies cross-origin, which works because the server
already sets `credentials: true` for `FRONTEND_ORIGIN`. Use `headers`, `credentials`, or
both depending on how your server authenticates.
