# Deployment

The demo is a static Angular build that talks to a separate Mastra server. Deploy
them independently. The server's contract (auth modes and custom verifiers, memory,
branch persistence, attachments, approvals and ask-user) is described in
[mastra.md](mastra.md); theming the styled kit is in [styling.md](styling.md).

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

The demo reads its runtime config from `/config.json` at startup, so one build fits every
environment. Serve a different file per environment:

```json
{ "mastraUrl": "https://api.example.com", "agentId": "chatAgent", "authToken": "" }
```

| Key | Development default | Meaning |
| --- | --- | --- |
| `mastraUrl` | `http://localhost:4111` | The Mastra server origin (and optional path prefix), used for the chat, history and thread routes |
| `agentId` | `chatAgent` | The agent to chat with; its chat route is `<mastraUrl>/chat/<agentId>` |
| `authToken` | (none) | Optional bearer token sent as `Authorization: Bearer <token>` for the server's `jwt` mode. Leave it empty in `dev` mode, where no header is sent. `config.json` is public, so use it only for a shared test token; a real app gets a per-user token from its sign-in and provides `MASTRA_AUTH` itself ([mastra.md](mastra.md#auth-modes)). |

The file is validated at startup: `mastraUrl` must be an absolute `http(s)` URL, `agentId` a
name of letters, digits, `-` or `_`, and `authToken` a string. A production build requires
`mastraUrl` and `agentId`; only a development build (`ng serve`) lets keys the file leaves out
keep their defaults. These keys replace the phase 1 `mastraChatUrl` (a full chat URL).

The file is fetched from the absolute path `/config.json` with `cache: 'no-cache'`. If
you deploy under a `<base href>` sub-path (for example `/app/`), serve the file at the
host root as well, or change the loader (`load(url)` in
`projects/demo/src/app/runtime-config.ts`) to resolve against the base href. An invalid
file, or in a production build a missing one, stops the app before it renders: the page
lists every problem and the console logs the `RuntimeConfigError`. A development build with
no file logs a warning and uses the localhost defaults.

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
multimodal for the model to see attachments. File parts must be inline `data:` URLs: the
route answers 400 for a remote file URL, which the model pipeline would otherwise download
from inside your network (see "Attachments and size limits" in [mastra.md](mastra.md)).

## Branches and the stored log

Mastra memory is a linear log. The server stores only the branch that was last sent: on
each send the frontend lists the active branch's message ids, and the server deletes the
stored messages that are not on it. Other branches live in the browser for the session only.
Reopening a thread restores the last branch that was sent, not the last one viewed.

## Exposed routes

Authenticated callers can reach only the routes the app uses; every other path, including
Mastra's stock `/api/agents/*` execution endpoints, tool execution, workflows and raw
message writes, answers 403. The allowed set is `POST /chat/:agentId`,
`GET /chat/:agentId/threads/:threadId/messages`, `GET|POST /api/memory/threads` and
`GET|PATCH|DELETE /api/memory/threads/:threadId`. To expose more, extend `isAllowedRoute`
in `mastra-server/src/mastra/auth.ts` and add a test.

Message ids sent by the client are stored under an id scoped to the user and thread, so one
user cannot overwrite another user's messages by reusing an id. The client still sees its own ids.
