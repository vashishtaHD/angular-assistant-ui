# Mastra

`mastra-server/` is the reference [Mastra](https://mastra.ai) server for the
`angular-assistant-ui/mastra` entry: one agent with memory, served through two whitelisting chat
routes and Mastra's memory thread routes. This page covers the server's setup and the contract the
Angular entry relies on. Hosting, CORS and secrets are in [deployment.md](deployment.md).

## Server setup

Node `>=22.13`. From the repository root:

```bash
cp mastra-server/.env.example mastra-server/.env   # gitignored; fill in a provider key
npm run dev -w mastra-server                       # mastra dev on http://localhost:4111
npm test -w mastra-server                          # route, auth, reconcile and security tests
```

| Variable | Default | Meaning |
| --- | --- | --- |
| `MASTRA_MODEL` | `openai/gpt-6-luna` | Model router string, `provider/model` (for example `openrouter/<vendor>/<model>`) |
| `OPENAI_API_KEY`, `OPENROUTER_API_KEY` | | The provider key matching `MASTRA_MODEL` |
| `MASTRA_AUTH_MODE` | (required) | `dev` or `jwt`; the server refuses to start without it |
| `MASTRA_DEV_AUTH` | | Must be `1` for `dev` mode |
| `MASTRA_JWT_SECRET` | | HS256 secret for the example `jwt` verifier |
| `FRONTEND_ORIGIN` | `http://localhost:4200` | The one CORS origin (credentials, `Authorization` and `Content-Type` headers) |
| `MASTRA_DB_URL` | `file:./mastra.db` | LibSQL storage for threads and messages |
| `MASTRA_MAX_BODY_BYTES` | `10485760` (10 MiB) | Largest chat request body; larger bodies get 413 |

The agent (`mastra-server/src/mastra/agents/chat-agent.ts`) is registered as `chatAgent` and has three
tools: `getWeather` (runs on the server), `bookMeeting` (`requireApproval: true`) and `askUser` (no
`execute`: the frontend answers it). `createMastra({ env, model, verifyToken })` in
`mastra-server/src/mastra/index.ts` builds the instance; tests pass a mock model and an environment.

## Wiring the Angular app

```ts
import { AuiConfig, AuiProviderDirective } from 'angular-assistant-ui';
import {
  MASTRA_AUTH,
  MastraThreads,
  createMastraTransport,
  mastraThreadListAdapter,
} from 'angular-assistant-ui/mastra';
import { AuiThreadComponent, AuiThreadListComponent } from 'angular-assistant-ui/ui';

const api = 'http://localhost:4111';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [AuiProviderDirective, AuiThreadListComponent, AuiThreadComponent],
  template: `<div [auiProvider]="config" class="chat">
    <aui-thread-list />
    <aui-thread />
  </div>`,
})
export class ChatComponent {
  // A field initializer is an injection context, so both factories find MASTRA_AUTH.
  protected readonly config = AuiConfig({
    threads: MastraThreads({
      adapter: mastraThreadListAdapter({ baseUrl: api, agentId: 'chatAgent' }),
      transport: () => createMastraTransport({ api, agentId: 'chatAgent' }),
    }),
  });
}
```

Use the same server URL string for `baseUrl` and `api`: the client's record of the ids the server
stores is keyed by it. `MastraThreads` needs the optional peers `ai`, `@ai-sdk/react`,
`@assistant-ui/ai-sdk` (pinned to `0.0.18`, which `mastra/src/vendor/` is vendored from),
`assistant-stream` and `react`.

## Auth modes

The server derives the user from the request; that user id is the Mastra memory resource id for every
thread and message. A `resourceId` sent in a body or query string is ignored.

| Mode | Settings | Behaviour |
| --- | --- | --- |
| `dev` | `MASTRA_AUTH_MODE=dev`, `MASTRA_DEV_AUTH=1` | Every request is the fixed user `dev-user`; no token needed (a middleware adds a placeholder bearer token). Local development only. |
| `jwt` | `MASTRA_AUTH_MODE=jwt`, `MASTRA_JWT_SECRET` | Requests need `Authorization: Bearer <token>`. The example verifier accepts HS256 tokens with a valid signature and a non-empty `sub` (the user id), and honours `exp` and `nbf`. Anything else is 401. |

**Plugging in your own verifier.** In `jwt` mode, pass `verifyToken` to `createMastra`. It receives the
bearer token and returns `{ id }` for a valid token or `null` (sync or async), and it replaces the HS256
example entirely (JWKS, an identity provider's introspection endpoint, a session lookup). For example,
crowsnest plugs in its own JWT verifier this way:

```ts
import { createMastra } from './mastra';

export const mastra = createMastra({
  verifyToken: async (token) => {
    const claims = await verifyWithYourIdentityProvider(token); // your code; null when invalid
    return claims ? { id: claims.sub } : null;
  },
});
```

**Sending the token from Angular.** Provide `MASTRA_AUTH`. `getHeaders()` runs per request (chat,
history and thread list), so it can return a fresh token; `credentials` sets the `fetch` credentials mode
for cookie-based auth across origins.

```ts
providers: [
  {
    provide: MASTRA_AUTH,
    useFactory: () => {
      const session = inject(SessionService);
      return { getHeaders: async () => ({ Authorization: `Bearer ${await session.token()}` }) };
    },
  },
];
```

`createMastraTransport` and `mastraThreadListAdapter` also take an explicit `auth` option. Never put
provider keys or signing secrets in the Angular app; it is public.

## Exposed routes

Authorization is default deny. An authenticated caller reaches only:

| Route | Use |
| --- | --- |
| `POST /chat/:agentId` | One chat turn (streamed AI SDK v7 UI message stream) |
| `GET /chat/:agentId/threads/:threadId/messages` | Thread history as v7 UI messages |
| `GET`, `POST /api/memory/threads` | List and create threads (`agentId` query) |
| `GET`, `PATCH`, `DELETE /api/memory/threads/:threadId` | Read, rename, archive (metadata) and delete a thread |

Everything else, including Mastra's stock `/api/agents/*` execution endpoints, tool execution, workflows
and raw message writes, answers 403. A thread owned by another user answers 403 on both chat routes. To
expose more, extend `isAllowedRoute` in `mastra-server/src/mastra/auth.ts` and add a test.

The chat route reads only `messages`, `messageIds`, `memory.thread`, `trigger`, `messageId`,
`resumeData`, `runId` and `tools`; every other key (`system`, `instructions`, `toolsets`, `maxSteps`,
`requireToolApproval`, `memory.resource`, …) is stripped before the agent call.

## Memory

- Storage is LibSQL (`MASTRA_DB_URL`); mount a volume for the default `file:` database or use a remote
  libSQL URL.
- The agent's memory keeps the last 20 messages in context and generates a title for each new thread.
  The thread list adapter polls the thread for that title (every 1000 ms for up to 15 s; set
  `titlePolling`) and pages threads 20 at a time (`pageSize`).
- Archiving is a metadata flag on the thread (`PATCH`), so archived threads stay in memory.
- History comes only from the chat history route, which merges a run of consecutive assistant messages
  (Mastra stores an approved tool call's continuation separately) into one message under the first id.

## Message ids

Message ids are global rows in Mastra storage. The server stores each client (user) message under an id
scoped to the user and thread (`m.<resource>.<thread>.<id>`, each part base64url encoded) and maps it
back on the history route, so the client always sees its own ids and one user cannot overwrite another
user's message by reusing an id. Assistant ids sent back on resubmits must belong to the same user and
thread, or the request gets 409.

## Branches

Mastra memory is a linear log, and the server persists only the branch that was last sent:

- Each normal send carries `messageIds`, the whole active branch. The server keeps the longest stored
  prefix that matches it (a run of assistant messages counts as one unit) and deletes the stored messages
  after it, so editing a message or regenerating replaces the stored tail. The client sends only the
  messages after that prefix.
- Switching branches with the branch picker changes nothing on the server; it takes effect on the next
  send. Other branches live in the browser for the session only, and reopening a thread restores the
  last branch that was sent, not the last one viewed.
- Resubmits (an approval answer, a tool result or `resumeData`) never reconcile, so an approval answered
  on an old branch after an edit was sent is appended to the stored branch.
- When the client does not know what the server stores (the history load failed or has not finished),
  it omits `messageIds` and sends the whole branch; the server then deletes nothing. The record is per
  page; `clearMastraStoredIds()` resets it (for example on sign-out).

## Attachments and size limits

- By default each thread uses the AI SDK runtime's data-URL attachment adapter: files travel as base64
  data URLs inside the JSON chat body, about 33% larger than the file (a 2 MB image needs about 2.7 MB).
- The chat route rejects bodies over `MASTRA_MAX_BODY_BYTES` (default 10 MiB) with 413. The whole
  request counts, including earlier messages the client resends, so keep a margin. Put any proxy limit
  (for example nginx `client_max_body_size`) at or above this value.
- To avoid large bodies, pass `attachments` to `mastraThreadListAdapter` with an adapter that uploads
  to your storage and sends `https` URLs instead.
- The model must be multimodal to see image attachments.
- In the styled kit, `aui-thread` renders the composer's attachment tiles and the add-attachment button
  by default (the `ComposerAttachments` and `ComposerAddAttachment` slots of `AUI_THREAD_COMPONENTS`)
  and a sent message's attachments (`UserMessageAttachments`).

## Approvals

`bookMeeting` has `requireApproval: true`. The model's call ends the run with an approval request; the
styled tool fallback (`aui-tool-fallback`, the default `ToolFallback` of `aui-thread`) shows its
approval card with Approve and Deny (and an optional reason), and once answered, a receipt. Answering
calls the part's `respondToToolApproval`, and `MastraThreads` resubmits automatically when every approval
of the last step is answered (`mastraSendAutomaticallyWhen`, unless you pass `sendAutomaticallyWhen`).
The resubmit carries only the assistant message with the answer; the server resumes the tool and streams
the rest of the turn.

A frontend tool can never take a server tool's name: the server drops such a tool (and any name outside
`[A-Za-z0-9_-]{1,64}`, and every tool after the first 64), so a client cannot bypass `requireApproval`.

## Ask-user

`askUser` (`{ question, options?, multiple? }`) has no `execute`, so the run ends with the call pending.
The tool fallback renders `aui-tool-fallback-ask-user` for it: the question, the options as radio
buttons or checkboxes (`multiple`) and a free-text answer. Submitting adds the tool result, and
`mastraSendAutomaticallyWhen` resubmits once every client tool call of the last step has a result. A
custom UI registered with `registerToolUI('askUser', …)` can answer through the part's `addResult`
instead.
