# Phase 2 research: Angular assistant-ui + Mastra (thread list, attachments, approval/HITL, history)

Legend: [V] verified in source/docs (path:line given); [I] inference, needs a spike/test.
Abbreviations:
- UP  = a local checkout of upstream assistant-ui at 7d74276 (the repository root)
- WT  = the root of this repository's working tree
- NM  = WT/node_modules
- MAI = NM/@mastra/ai-sdk/dist (v1.12.0)
- MSV = NM/@mastra/server/dist (v1.83.0)
- MCD = NM/@mastra/core/dist (v1.83.0)

Installed (WT/package.json): @assistant-ui/ai-sdk 0.0.18, core 0.3.36, store 0.3.23, tap 0.9.26, ai 7.0.173, react ^19.3.1.
mastra-server/package.json: @mastra/ai-sdk ^1.12.0, @mastra/core ^1.83.0. NOT installed: @mastra/memory, @mastra/libsql, @mastra/client-js (NM/@mastra has only ai-sdk, core, deployer, loggers, schema-compat, server).
Current server: mastra-server/src/mastra/index.ts has no `storage`; chat-agent.ts has no `memory`. [V]

## 0. Cross-cutting findings (read first)

0.1 @assistant-ui/ai-sdk@0.0.18 is React code (hooks, `Chat` from @ai-sdk/react) that also exposes tap "resource" entries for non-React hosts. Its index (NM/@assistant-ui/ai-sdk/dist/index.d.ts = UP/packages/ai-sdk/src/index.ts:1-33) exports `AISDKChat`, `AISDKThreads`, `AssistantChatTransport`, `useAISDKRuntime`, `useChatRuntime`, `frontendTools`, `useAISDKError`. `packages/react-ai-sdk` is only a re-export shim (UP/packages/react-ai-sdk/src/index.ts). So everything below exists in 0.0.18; nothing is "react-ai-sdk only". [V]

0.2 THE BIGGEST GAP: `AISDKThreads` (UP/packages/ai-sdk/src/runtime/AISDKThreads.ts:32-65) only takes `cloud?: AssistantCloud` (+ scopeId, threadId, onThreadIdChange). Its remote list is hard-wired to `useCloudThreadListAdapter({cloud, scopeId, sdk})` (:207-211); there is NO `adapter` option. Without `cloud` it is `InMemoryThreadList` (:248-257): multi-thread but nothing persisted. `createChat`/`useChatThread`/`AISDKChatThread` are not exported, and the package `exports` map only has "." (NM/@assistant-ui/ai-sdk/package.json), so no deep imports. [V]
Options for a Mastra-backed list:
- A (recommended): vendor/copy AISDKThreads.ts + useChatThread.ts (MIT) into the Angular lib as its own `MastraThreads` resource, replacing `useCloudThreadListAdapter` with a custom `RemoteThreadListAdapter` (see 1a). Needs `RemoteThreadList` from `@assistant-ui/core/store` (UP/packages/core/src/store/index.ts:99-101; core exports map has ./store and ./store/internal) and `ThreadClient` from `@assistant-ui/core/store/internal`. [V exports exist; I that the copy compiles against installed 0.3.x]
- B: duck-type an `AssistantCloud` whose `threads.*`, `runs.stream`, `messages.*` hit Mastra (cloud adapter calls: UP/packages/core/src/react/runtimes/cloud/createCloudThreadListAdapter.ts:217-330 plus history/attachment adapters). Hacky, large surface. Not recommended.
- C: ask upstream for an `adapter` option on AISDKThreads. Upstream docs say custom DB goes through RemoteThreadListRuntime (UP/apps/docs/content/docs/runtimes/concepts/threads.mdx; ai-sdk/v7.mdx "Adapter support": threadList = cloud or RemoteThreadListRuntime).

0.3 Mastra's chatRoute does NOT do thread/resource plumbing unless `resumable: true`. It spreads the whole JSON body into `agent.stream(messages, options)` (MAI/index.js:12098 `const { messages, resumeData, runId, requestContext, trigger, ...rest } = params`; :12118-12125 `baseOptions = {...defaultOptionsRest, ...restOptions, ...}`). So `memory: { thread, resource }` in the POST body works [V]. The body fields AssistantChatTransport adds (`id`, `trigger`, `messageId`, `metadata`, `tools`, `system`, `config`, `callSettings`; UP/packages/ai-sdk/src/transport/AssistantChatTransport.ts:78-107) also land in the options object. `system`, `instructions`, `toolsets`, `clientTools`, `maxSteps`, `requireToolApproval`, `hooks` are valid AgentExecutionOptions (MCD/agent/agent.types.d.ts:534-536, 619-621, 673) and client values override `defaultOptions`. => a client can override system prompt / tool policy. SECURITY RISK [V mechanics, I exploitability]: front the route with a custom handler (`registerApiRoute` + `handleChatStream`) that whitelists body fields.

0.4 Frontend-tool schemas are not consumed by Mastra [I, mostly V]: AssistantChatTransport sends `tools: toToolsJSONSchema(...)` (AssistantChatTransport.ts:85); Mastra has no named `tools` execution option (only `toolsets` / `clientTools`; MCD/evented-execution-4C5qBV8d.js:48849 destructure). Upstream's convention is `frontendTools(body.tools)` (UP/apps/docs/content/docs/runtimes/ai-sdk/v7.mdx "Frontend tools and system messages"; exported ai-sdk/src/index.ts:12; NM/assistant-stream/dist/ai-sdk/frontendTools.d.ts:5). On Mastra: declare "ask the user" tools server-side with no `execute` (documented: MCD/docs/references/docs-agents-tools.md:308-330), or in a custom route map `clientTools: frontendTools(body.tools)` (I: ToolsInput should accept an AI SDK ToolSet; spike).

## (a) Thread list: new / switch / rename / archive / unarchive / delete / load more

### 1a. Upstream mechanism
- `RemoteThreadListAdapter` (UP/packages/core/src/runtimes/remote-thread-list/types.ts:47-120):
  - `list(params?: {after?: string}): Promise<{threads: RemoteThreadMetadata[]; nextCursor?: string}>`
  - `rename(remoteId, newTitle)`, `updateCustom?(remoteId, custom|undefined)`, `archive(remoteId)`, `unarchive?(remoteId)` (optional; if omitted, archived threads open as archived and explicit unarchive rejects), `delete(remoteId)`
  - `initialize(threadId, options?: {custom?}): Promise<{remoteId; externalId?}>`
  - `generateTitle(remoteId, messages: readonly ThreadMessage[]): Promise<AssistantStream>` (called after first message settles, and again after the first run if still untitled; must not complete before the write lands)
  - `fetch(threadId): Promise<RemoteThreadMetadata>`
  - `unstable_useAdapters?(): {modelContext?, history?, attachments?, feedback?}`: a React hook called once per mounted thread body (types.ts:102-119). This is how per-thread history/attachments get injected.
  - `RemoteThreadMetadata = {status: "regular"|"archived"; remoteId; externalId?; title?; lastMessageAt?: Date; custom?}` (types.ts:22-29).
- Store entry: `RemoteThreadList({adapter, thread, threadId?, onThreadIdChange?, backgroundThreads?})` (UP/packages/core/src/react/client/RemoteThreadList.ts:86-124). The `thread` factory must be keyed `withKey(id, ...)` or history will not reload per switch (RemoteThreadList.ts:92-96; docs threads.mdx "Persisting messages"). `aui.threads.loadMore()` / `hasMore` use `nextCursor`; `aui.threads.reload()` after async auth (threads.mdx).
- AI SDK wiring: `AISDKThreads({cloud})` uses `backgroundThreads: true`, per-thread `Chat`, transport cloned per thread via `AssistantChatTransport.__internal_clone` (AISDKThreads.ts:83-105, 239-257). The transport sends body `id = (await threadListItem.initialize()).remoteId` (AssistantChatTransport.ts:72-76,81). So body.id == remoteId returned by `adapter.initialize`.
- Mastra-specific upstream: none. The Mastra docs are "an integration guide, not a runtime adapter"; multi-thread = AssistantCloud or custom thread list (UP/apps/docs/content/docs/integrations/frameworks/mastra/overview.mdx:12-26); separate-server.mdx only shows `AssistantChatTransport({api})` + CORS. No memory/thread code upstream. [V]

### 2a. Mastra side
Memory-thread HTTP routes exist on the Mastra server when the agent has `memory` (or storage fallback) (MSV/memory-CGlo-6_V.js):
- list: GET /memory/threads?agentId=&resourceId=&page=&perPage=&orderBy[field]=&orderBy[direction]=&metadata=<json> (:657-780; query schema memory-CCEjoCF6.js:150-185). Default perPage 100. Response `{threads,total,page,perPage,hasMore}`; thread = `{id,title?,resourceId,createdAt,updatedAt,metadata?}` (memory-CCEjoCF6.js:122-132, 376). orderBy field createdAt|updatedAt (https://mastra.ai/reference/memory/listThreads). metadata filter = exact-match AND.
- get: GET /memory/threads/:threadId?agentId=&resourceId= (:785)
- create: POST /memory/threads `{resourceId, title?, metadata?, threadId?}` (:1162; body schema memory-CCEjoCF6.js createThreadBodySchema). Optional: threads are auto-created by `agent.stream` with `memory.thread` (MAI/docs/references/docs-memory-message-history.md "Note").
- rename/update: PATCH /memory/threads/:threadId `{title?, metadata?, resourceId?}` (:1236-1315). `metadata` REPLACES the whole object (:1295-1300: `metadata !== undefined ? withServerOwnedThreadMetadata(metadata, thread.metadata) : thread.metadata`), so archive must send `{...existing, archived:true}`.
- delete: DELETE /memory/threads/:threadId?agentId=&resourceId= (:1319).
- messages: GET /memory/threads/:threadId/messages (:876-990).
All `requiresAuth: true`. There is NO built-in archive concept: model it as thread `metadata.archived` [I]. Server-side filtering by `metadata={"archived":true}` only matches threads that have the key; stream-created threads have no metadata unless passed as `memory.thread: {id, metadata}` (AgentMemoryOption, MCD/agent/types.d.ts:958-966). Simplest: set metadata in `initialize`, or list all for the resource and split client-side.
Client option: `@mastra/client-js` `listMemoryThreads({resourceId, agentId?})`, `createMemoryThread({title,metadata,resourceId,agentId})`, `getMemoryThread({threadId,agentId})` -> `.update({title,metadata,resourceId})`, `.delete()`, `.listMessages({page,perPage,orderBy,filter})` (https://mastra.ai/reference/client-js/memory). Plain fetch against the routes is equivalent and avoids a dependency.
Thread/resource passing for chat: body `memory: {thread: <remoteId>, resource: <userId>}` (MAI/docs/references/integrations-agentic-ui-ai-sdk-ui.md "Using Mastra Memory"); `thread` may be `{id,title,metadata}`. Server-side reserved request-context keys win over the body: `resourceId = requestContext.get("mastra__resourceId") || memory.resource` (MCD/evented-execution-4C5qBV8d.js:48876, 37281; MSV/utils-Dv1D6ob-.js:156-158). Memory routes: `getEffectiveResourceId` (utils:156), 403 on mismatch (`validateThreadOwnership` utils:207-209). NOTE: threads with no resourceId are accessible to all (utils:205-206).
Titles: `new Memory({options:{generateTitle: true | {model, instructions, emitEvent}}})`; async after the response; `emitEvent:true` emits a transient `data-thread-title` chunk `{threadId,title}` before `finish` but delays finish (docs-memory-message-history.md "Thread title generation").
Storage/memory install: `@mastra/memory`, `@mastra/libsql`; `new Mastra({storage: new LibSQLStore({id, url:'file:./mastra.db'})})`; agent `memory: new Memory({options:{lastMessages:N, generateTitle:true}})` (docs-memory-message-history.md "Getting started"). Versions are not pinned in this repo; pick ones matching core 1.83 [I].

### 3a. Recommended wiring
Server: storage + Memory (above). Frontend: `MastraThreads` (vendored from AISDKThreads) with `RemoteThreadList({adapter: mastraThreadListAdapter, backgroundThreads: true, thread, threadId, onThreadIdChange})`. Adapter:
- list({after}): GET /memory/threads?perPage=20&page=<after as page number>&orderBy[field]=updatedAt&orderBy[direction]=DESC (resourceId omitted when server auth supplies it); `nextCursor = hasMore ? String(page+1) : undefined`; `status = metadata.archived ? "archived":"regular"`, `lastMessageAt = updatedAt`. Caveat: the cloud adapter runs two queries (active + archived) with a composite cursor (createCloudThreadListAdapter.ts:217-247); a single mixed list is simpler but archived rows consume pages.
- initialize(localId, {custom}): `POST /memory/threads {threadId: localId, resourceId, metadata:{archived:false, ...custom}}`, return `{remoteId: localId}` (or skip creating and let the first stream create it, but then rename/archive before the first send would 404).
- rename / archive / unarchive / updateCustom: PATCH (archive merges metadata first). delete: DELETE. fetch(id): GET /memory/threads/:id.
- generateTitle: `createAssistantStream` that polls GET /memory/threads/:id until `title` appears (timeout ~15 s), then `controller.appendText(title)`; alternative is consuming `data-thread-title` via `onData` (I).
Identity: see 3d.

### 4a. Gaps/risks
- No `adapter` option in AISDKThreads (0.2): must vendor.
- `unstable_useAdapters` is a React hook (deprecated-experimental tag, types.ts:117). Called by RemoteThreadList inside `AdaptedRemoteThread` (RemoteThreadList.ts:504-509). Phase 1 already runs `useChat` through the React shim, so likely fine, but spike it [I].
- Archive is a convention, not a Mastra feature; PATCH replaces metadata (race with other metadata writers).
- Title generation is async on the Mastra side; adapter must poll.

## (b) Attachments (images and files from the composer reaching the model)

### 1b. Upstream
- `AttachmentAdapter` (UP/packages/core/src/adapters/attachment.ts:9-20): `accept: string; add({file}): Promise<PendingAttachment>|AsyncGenerator<PendingAttachment>; remove(att); send(att,{signal}): Promise<CompleteAttachment>`. Helpers `SimpleImageAttachmentAdapter` (:22), `SimpleTextAttachmentAdapter` (:139), `CompositeAttachmentAdapter` (:282).
- The AI SDK runtime already defaults `adapters.attachments = vercelAttachmentAdapter` (accept "*", `send` returns `content:[{type:"file", mimeType, filename, data: dataURL}]`) (UP/packages/ai-sdk/src/adapters/vercelAttachmentAdapter.ts:5-36; wired in useAISDKRuntime.ts near the end: `adapters: { attachments: vercelAttachmentAdapter, ...contextAdapters, ...adapters }`). Override via `adapters: {attachments}` (docs runtimes/ai-sdk/v7.mdx "Attachments").
- `toCreateMessage` turns image/file content parts and `message.attachments[].content` into UI `file` parts `{type:"file", url, mediaType, filename}`; inline bytes become data URLs (UP/packages/ai-sdk/src/converters/toCreateMessage.ts:21-77). Reload converts file parts back to attachments (converters/convertMessage.ts:~781-810).
- In 0.0.18 (AISDKChat takes `adapters` through ChatThreadOptions, useChatThread.ts:36-37). Not Mastra-specific.

### 2b. Mastra side
- chatRoute passes the UIMessages (including `file` parts) to `agent.stream`; Mastra converts AI SDK UI messages to model messages [I; Mastra accepts UIMessage[] per ai-sdk-ui.md]. Model support is provider-dependent. Files a provider rejects (anything not image/PDF/text) are stripped and replaced by a placeholder by the default `UnsupportedFileHandler` error-processor, one retry (MCD/docs/references/reference-processors-unsupported-file-handler.md lines 7-35). Optional `FileUploadProcessor` + Workspace sandbox gives the model a sandbox path instead (reference-processors-file-upload-processor.md).
- Stored messages keep the file part (same docs), so memory rows include data URLs [V per docs, "stored messages keep their files"].
- Request size: base64 inflates ~33% and rides in the JSON body, including on tool-result/approval resubmits. Body-size limit of Mastra/Hono not checked [I].

### 3b. Wiring
MVP: default vercel adapter (images/PDF/text), multimodal model on the agent (`MASTRA_MODEL`, chat-agent.ts:11). Server change: none. Larger files: custom AttachmentAdapter uploading to host storage and returning `file` parts with https `url` (toCreateMessage passes non-data URLs through; `sourceType:"id"` is passed as opaque id, toCreateMessage.ts:63-71). Angular side needs composer attachment primitives (not in the lib; docs/porting.md lists composer attachment items as planned/absent) [I].

### 4b. Risks
- Data URLs stored in Mastra DB (bloat); strip/upload server-side.
- Unsupported types are silently placeholdered: user sees nothing wrong, model ignores the file.
- Angular lib lacks attachment primitives (porting work).

## (c) Tool approval / HITL and "ask the user" tools

### 1c. Upstream (in 0.0.18, React-based)
- Server-gated approval (AI SDK v7 `approval-requested`): the runtime exposes `approval` on the tool part and `respondToApproval({approved, reason?, optionId?, text?, answers?})` to the renderer (UP/apps/docs/content/docs/tools/tool-ui.mdx:508-660; runtimes/ai-sdk/v7.mdx "Server-side tool approval"). Core type `RespondToToolApprovalOptions {approvalId, approved, optionId?, text?, answers?, reason?}` (UP/packages/core/src/runtime/interfaces/thread-runtime-core.ts:75-85); thread API `addToolResult` (:206), `resumeToolCall({toolCallId, payload})` (:207; type :63-66), `respondToToolApproval` (:220).
- Default path: `chatHelpers.addToolApprovalResponse({id: approvalId, approved, reason})` (UP/packages/ai-sdk/src/runtime/useAISDKRuntime.ts:964-974). The client must set `sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses` (from `ai`) (v7.mdx). It is a pass-through ChatInit option (useChatThread.ts:150, 197-198; default false), so `AISDKChat({transport, sendAutomaticallyWhen})` works.
- Host-owned channel: `onRespondToToolApproval(response, {toolCallId, toolName, respondViaAISDK})` (useAISDKRuntime.ts:165-180; v7.mdx "onRespondToToolApproval") and `onResumeToolCall` (:158-163). Rich approval UI (options/questions) travels in `approvalDescriptor` on the `tool-approval-request` chunk (convertMessage.ts:312-345).
- Human/client tools: tool with `execute` in browser, or `type:"human"` with `addResult` -> `onAddToolResult` -> `chatHelpers.addToolOutput({tool, toolCallId, output})` (useAISDKRuntime.ts:1325-1430). Then `sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls` resends (UP/apps/docs/content/docs/tools/backend.mdx:152-160). `cancelPendingToolCallsOnSend` default true (useAISDKRuntime.ts, adapter options).
- Upstream has NO Mastra-specific handling: grep for `tool-call-suspended|tool-call-approval|mastra` in ai-sdk, core, react-ai-sdk src is empty. Mastra's `data-tool-call-*` parts render as plain data parts. [V]

### 2c. Mastra side
- Approval: `createTool({requireApproval: true})` or `agent.stream(..., {requireToolApproval: true | fn})` (MCD/docs/references/docs-agents-human-in-the-loop.md:19-110). Needs a storage provider (snapshots), else "snapshot not found" (same doc :44-46). Decline takes `reason` (:72-84).
- AI SDK v6/v7 native flow in @mastra/ai-sdk 1.12: stream emits `{type:"tool-approval-request", approvalId:"<runId>::<toolCallId>", toolCallId}` plus a `data-tool-call-approval` part `{runId, toolCallId, toolName, args, resumeSchema}` (MAI/index.js:10363-10381). On the next POST, if the last message is an assistant message with tool parts in state `approval-responded`, `extractV6NativeApprovals` splits `approval.id` at "::" and calls `agent.resumeStream({approved, reason?}, {runId, toolCallId})` per target and streams the continuation (index.js:11888-11960; dispatch at 12135-12152). v5 does not do this; `version:"v6"|"v7"` only. Our route is `version:"v7"` (mastra-server/src/mastra/index.ts:11). [V]
- Mastra's own resume channel: body `{resumeData, runId}` -> `agent.resumeStream(resumeData, ...)`; throws if resumeData without runId (index.js:12098-12100, 12156). Tool `suspend()` -> `data-tool-call-suspended {runId, toolCallId, toolName, suspendPayload, resumeSchema}` (index.js:10148-10160). Doc recipe: `prepareSendMessagesRequest` + `sendMessage(..., {body:{resume:{runId,resumeData}}})` (integrations-agentic-ui-ai-sdk-ui.md "Resuming a suspended tool"). Built-in `askUserTool` (`@mastra/core/tools`) suspends with `{question, options?, selectionMode?}` and resumes with string or string[] (MCD/docs/references/reference-tools-ask-user-tool.md). `autoResumeSuspendedTools` resumes from message history on the next user message (human-in-the-loop.md:457).
- Client tool (no `execute`): run ends with finishReason `tool-calls`, part is `input-available`; client adds output, resends; server layers the new tool result over stored history (ai-sdk-ui.md "Client tools with useChat()"; docs-agents-tools.md:308-330). Sub-agents cannot run client tools.
- With memory, Mastra reloads stored history and de-dupes echoed messages by id (ai-sdk-ui.md "Using Mastra Memory").

### 3c. Wiring
1. Approval: mark tools `requireApproval:true`; client `AISDKChat({transport, sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses})`; Angular `registerToolUI` components need `approval` + `respondToApproval` props [I: check the lib's ToolUIComponent props]. `approval.id` is `<runId>::<toolCallId>` and flows unchanged through `addToolApprovalResponse`. Combining with client tools needs one predicate (single slot; UP/apps/docs/content/docs/tools/openui.mdx:92): approvals OR tool-calls [I: confirm the tool-calls predicate does not misfire on server-executed/approved tools].
2. "Ask the user" tool where the frontend supplies the result. Option 1 (pure AI SDK, lower risk): server tool with `inputSchema` and no `execute`; UI `addResult` -> `addToolOutput` -> auto resend. The resend must carry memory thread+resource and the last assistant message. Option 2 (Mastra-native): `askUserTool` / `suspend()`; render `data-tool-call-suspended` with a custom data-part UI and resume via `prepareSendMessagesRequest` body `{runId, resumeData}` or `onResumeToolCall`.
3. Transport `prepareSendMessagesRequest`: the user callback receives `optionsEx` (id=remoteId, messages, trigger, body incl. tools/system; AssistantChatTransport.ts:78-90) and its returned `body` REPLACES the default (:99), so re-add `tools`/`system` if wanted. Send only the last message for normal submits; for approval/tool-result resubmits send the last assistant message. Always include `memory:{thread:id, resource?}`.

### 4c. Gaps/risks
- No upstream Mastra HITL code: suspend/askUser flow must be built; rich approvalDescriptor UI requires a server that emits it (Mastra does not).
- Approval answers are stored on the history side only via a history adapter (`__aui_toolApprovalResponses`, v7.mdx). Mastra stores `approval` metadata on the tool call (human-in-the-loop.md:72-74), but whether the history API returns `approval-responded` parts the UI understands is unverified [I].
- Regenerate/edit/branch: Mastra memory is a linear log. `trigger:"regenerate-message"` only drops the last assistant message from model input (MAI/index.js:12104-12109), the stored one remains. Hide edit/reload/branch UI or accept divergence [I].
- Resumable chat (process-local) if long approvals/reloads matter (ai-sdk-ui.md "Resume a chat stream").

## (d) Message history loading when switching threads

### 1d. Upstream
- `ThreadHistoryAdapter` (UP/packages/core/src/adapters/thread-history.ts:82-130): for the AI SDK path the top-level `load/append` are unused; it needs `withFormat(fmt)` returning `GenericThreadHistoryAdapter<TMessage>` (`load(): Promise<{headId?, messages: MessageFormatItem[]}>`, `append`, `update?`, `delete?`; :49-80) (v7.mdx "Persisting chat history" callout). Format adapter: `aiSDKV6FormatAdapter` from `assistant-cloud/ai-sdk` (UP/packages/ai-sdk/src/adapters/aiSDKFormatAdapter.ts:1-4). Loaded by `useExternalHistory` from `adapters?.history ?? contextAdapters?.history` (useAISDKRuntime.ts:884-886). Per-thread injection = `unstable_useAdapters` returning `{history}` (threads.mdx "Persisting messages"); thread factory must be `withKey`.
- One-shot alternative: `messageRepository` (branch-aware UIMessage tree seeded once when useChat is empty) (useAISDKRuntime.ts adapter options; v7.mdx "messageRepository").
- Assistant-ui calls `history.append` after each run. With Mastra the server already persists via memory, so the adapter should be read-only (`append/update/delete` no-ops) to avoid double writes [I].

### 2d. Mastra side
- GET /memory/threads/:threadId/messages?resourceId=&page=&perPage=&orderBy[field]=createdAt&orderBy[direction]=ASC (MSV/memory-CCEjoCF6.js:204-220; default page size 40). Response `{messages (MastraDBMessage[]), uiMessages (AI SDK UI messages | null), total, page, perPage, hasMore}` (memory-CCEjoCF6.js:376-383; handler returns `memory.recall` result plus `uiMessages`, memory-CGlo-6_V.js:~940-960). Recall default order is DESC (reference-memory-recall.md "orderBy"), so request ASC. Reminder signals hidden by default.
- Which AI SDK version shape `uiMessages` uses (v5 vs v7 part names, approval fields) is not documented on this endpoint [I]. `toAISdkMessages(messages, {version:'v7'})` from `@mastra/ai-sdk/ui` exists (reference-ai-sdk-to-ai-sdk-messages.md) and preserves error parts; safest is fetching `messages` and converting with 'v7', either in a small custom server route or client-side.
- Authorization: 403 if thread.resourceId != effective resource (utils:207-209); otherwise no ACL ("memory system doesn't enforce access control", docs-memory-message-history.md "Querying").

### 3d. Wiring + identity
History adapter in `unstable_useAdapters` (per thread): `withFormat(fmt)` -> `load`: `remoteId = aui.threadListItem.getState().remoteId`; if none return `{messages:[]}`; fetch messages ASC (paged); convert to v7 UIMessages; chain `parentId` to the previous message (Mastra is linear) and set `headId` to the last; `append/update/delete` no-ops. Verify the `load` contract returns `MessageFormatRepository` (thread-history.ts:32-35) so `fmt.decode` can be bypassed [I].
Identity (production consumer has its own auth):
- Best: server-side. `server.auth` provider validating the host's token plus `mapUserToResourceId(user)`, which sets `mastra__resourceId` in the request context for every route, chatRoute and /memory/* alike (MSV/helpers-B56oH6qp.js:442-448; Mastra warns when missing: MSV/server-adapter-BywLWVKp.js:1318-1321). The frontend never supplies resourceId: transport `headers: () => ({Authorization: 'Bearer ' + token})` and `credentials` (AssistantChatTransport accepts HttpChatTransportInitOptions; separate-server.mdx "Notes"), and the memory adapter uses the same header source. Angular: an injection token (e.g. MASTRA_AUTH with `getHeaders()`) supplied by the host app. CORS config (mastra-server/src/mastra/index.ts:7-10) needs to allow the Authorization header [I].
- Dev / no auth: client supplies `memory.resource` and `?resourceId=` from a host-provided token. Spoofable: any caller can read any resource's threads (Mastra's own warning, server-adapter-BywLWVKp.js:1321).
- Resumable chatRoute refuses body resource ids; they must come from middleware (MAI/index.js:12289-12291).

### 4d. Risks
- `uiMessages` shape uncertainty (2d).
- Large histories: paginate (page size 40) or `perPage:false`; history loads once per thread.
- Reload fidelity of `input-available` / `approval-requested` tool states untested.
- Reload during an in-flight run needs `resumable:true` (chatRoute returns [post, reconnect] routes: GET `<path>/:chatId/stream`) and the transport `resumable` option (AssistantChatTransport.ts:33,64-69); optional for phase 2.

## 5. Recommended end-to-end wiring (summary)

Server (mastra-server):
1. Install `@mastra/memory` + `@mastra/libsql`; `storage: new LibSQLStore(...)` on Mastra; `memory: new Memory({options:{lastMessages:20, generateTitle:true}})` on chatAgent. Gated tools `requireApproval:true`; a no-`execute` ask-user tool (or `askUserTool`).
2. `server.auth` provider + `mapUserToResourceId` (production); CORS allow Authorization.
3. Replace bare `chatRoute` with a custom `registerApiRoute` calling `handleChatStream({version:'v7', params: <whitelisted body>, defaultOptions})`, optionally mapping `tools -> clientTools`; optionally a small route returning v7 UIMessages for history.
Frontend (Angular lib + demo):
4. `MastraThreads` resource (vendored AISDKThreads + `mastraThreadListAdapter`; history via `unstable_useAdapters`).
5. `new AssistantChatTransport({api, headers, credentials, prepareSendMessagesRequest})` returning `{body:{messages:[last], memory:{thread:id, resource?}, ...}}`.
6. Combined `sendAutomaticallyWhen`; default vercel attachment adapter; Angular tool UI props `approval/respondToApproval/addResult`; port thread-list and composer-attachment primitives.

## 6. Biggest risks (ranked)
1. AISDKThreads cannot take a custom RemoteThreadListAdapter (only `cloud`): vendor/fork unexported internals against unstable core APIs.
2. Mastra memory is a linear server-owned log while assistant-ui is branch/edit-based: last-message-only sends, edit/reload mismatch, unverified history `uiMessages` shape.
3. chatRoute spreads the client body into agent options (system/tools override) and frontend `tools` are ignored: needs a whitelisting custom route.
4. Resource identity is client-trusted unless `mapUserToResourceId` is configured.
5. No upstream Mastra HITL support; only the native v6/v7 `tool-approval-request` flow works out of the box.

## 7. Spikes to do first
- React hooks inside `unstable_useAdapters` under the Angular + React-shim host.
- POST with `memory`, last-message-only, and an `approval-responded` resubmit against the real route (the "::" approval id with memory enabled).
- Real payload of GET /memory/threads/:id/messages (`uiMessages` vs `messages`, v7 shapes, tool/approval/file parts).
- `clientTools: frontendTools(tools)` accepted by Mastra.
- Request body size limit with base64 attachments.
