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

## Identity and auth modes

The server derives the user from the request and uses it as the memory resource id.
A `resourceId` in a body or query string is ignored. `MASTRA_AUTH_MODE` is required;
the server refuses to start without it.

| Mode  | Settings                                              | Behaviour                                                                                  |
| ----- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `dev` | `MASTRA_AUTH_MODE=dev` and `MASTRA_DEV_AUTH=1`        | Every request is the fixed user `dev-user`. No token needed. Never use outside local development. |
| `jwt` | `MASTRA_AUTH_MODE=jwt` and `MASTRA_JWT_SECRET=<long random value>` | Requests need `Authorization: Bearer <HS256 JWT>`. The `sub` claim is the user id; `exp` and `nbf` are honoured. Missing or invalid tokens get 401. |

`jwt` mode is the example verifier. To plug in your own identity provider, pass a
`verifyToken(token)` hook to `createMastra({ verifyToken })` in
`mastra-server/src/mastra/index.ts`. It returns `{ id }` for a valid token and `null`
otherwise. The `id` becomes the resource id for every thread and message.

Forward the token from Angular with a `headers` function returning an `Authorization: Bearer <token>`
header on the chat transport and on the memory and history requests. The server allows the
`Authorization` and `Content-Type` headers from `FRONTEND_ORIGIN`.

## Storage

Threads and messages are stored in LibSQL. Set `MASTRA_DB_URL` to a `file:` path (default
`file:./mastra.db`, so mount a volume to keep it) or to a remote libSQL/Turso URL. Tests
use `:memory:`.

## Request size

The chat route accepts bodies up to `MASTRA_MAX_BODY_BYTES` (default 10 MiB) and answers
413 above that. Image attachments travel as base64 data URLs in the JSON body, about 33%
larger than the file, so a 2 MB image needs about 2.7 MB. Put any reverse proxy limit
(for example nginx `client_max_body_size`) at or above this value. The image model must be
multimodal for the model to see attachments.

## Branches and the stored log

Mastra memory is a linear log. The server stores only the branch that was last sent: on
each send the frontend lists the active branch's message ids, and the server deletes the
stored messages that are not on it. Other branches live in the browser for the session only.
Reopening a thread restores the last branch that was sent, not the last one viewed.
