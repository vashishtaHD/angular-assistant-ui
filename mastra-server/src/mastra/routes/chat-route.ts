import { registerApiRoute } from '@mastra/core/server';
import { handleChatStream } from '@mastra/ai-sdk';
import { toAISdkMessages } from '@mastra/ai-sdk/ui';
import { createUIMessageStreamResponse, jsonSchema } from 'ai';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import { groupAssistantRuns, reconcileThread } from '../reconcile';

const RESOURCE_ID_KEY = 'mastra__resourceId';
const TOOL_NAME = /^[a-zA-Z0-9_-]{1,64}$/;
const MAX_FRONTEND_TOOLS = 64;

const part = z.looseObject({ type: z.string() });

/**
 * The only fields the chat route reads. Zod strips every other key, so an agent option such as
 * `system`, `instructions`, `toolsets`, `requireToolApproval`, `maxSteps` or `hooks` never
 * reaches the agent call. `memory.resource` is stripped too: identity comes from the server.
 */
export const chatBodySchema = z.object({
  messages: z.array(
    z.looseObject({
      id: z.string().min(1),
      role: z.enum(['user', 'assistant']),
      parts: z.array(part),
    }),
  ),
  messageIds: z.array(z.string()).optional(),
  memory: z.object({ thread: z.string().min(1) }),
  trigger: z.enum(['submit-message', 'regenerate-message']).optional(),
  messageId: z.string().optional(),
  resumeData: z.record(z.string(), z.unknown()).optional(),
  runId: z.string().optional(),
  tools: z
    .record(
      z.string(),
      z.looseObject({
        description: z.string().optional(),
        parameters: z.record(z.string(), z.unknown()),
      }),
    )
    .optional(),
});

export type ChatBody = z.infer<typeof chatBodySchema>;

/** Maps frontend tool JSON schemas to Mastra `clientTools` (tools without `execute`). */
export function toClientTools(
  tools: NonNullable<ChatBody['tools']> | undefined,
  reserved: ReadonlySet<string> = new Set(),
) {
  const clientTools: Record<
    string,
    { description?: string; inputSchema: ReturnType<typeof jsonSchema> }
  > = {};
  for (const [name, tool] of Object.entries(tools ?? {}).slice(0, MAX_FRONTEND_TOOLS)) {
    // A frontend tool must never shadow a server tool (that would bypass requireApproval).
    if (!TOOL_NAME.test(name) || reserved.has(name)) continue;
    clientTools[name] = {
      ...(tool.description !== undefined && { description: tool.description }),
      inputSchema: jsonSchema(tool.parameters as Parameters<typeof jsonSchema>[0]),
    };
  }
  return clientTools;
}

/** Merges runs of consecutive assistant UI messages into one message keyed by the first id. */
export function mergeAssistantRuns<T extends { id: string; role: string; parts: unknown[] }>(
  messages: T[],
): T[] {
  return groupAssistantRuns(messages).map((group) => ({
    ...group[0],
    parts: group.flatMap((message) => message.parts),
  }));
}

export interface ChatRouteOptions {
  /** Path of the POST route. Default `/chat/:agentId`. */
  path?: string;
  /** Largest accepted POST body in bytes. Larger bodies get 413. Default 10 MiB. */
  maxBodyBytes?: number;
}

type MemoryLike = {
  getThreadById(args: { threadId: string }): Promise<{ resourceId?: string } | null>;
  recall(args: Record<string, unknown>): Promise<{ messages: any[] }>;
  deleteMessages(ids: string[]): Promise<void>;
};

/**
 * Builds the chat routes:
 * - `POST <path>` streams one chat turn after reconciling the stored thread with the active branch
 * - `GET <path>/threads/:threadId/messages` returns the thread as v7 UI messages
 *
 * Both require authentication and use the server-derived resource id.
 */
export function createChatRoutes(options: ChatRouteOptions = {}) {
  const path = options.path ?? '/chat/:agentId';

  const post = registerApiRoute(path, {
    method: 'POST',
    requiresAuth: true,
    middleware: bodyLimit({
      maxSize: options.maxBodyBytes ?? 10 * 1024 * 1024,
      onError: (c) => c.json({ error: 'Request body too large' }, 413),
    }),
    handler: async (c) => {
      const mastra = c.get('mastra');
      const requestContext = c.get('requestContext');
      const resourceId = requestContext.get(RESOURCE_ID_KEY) as string | undefined;
      if (!resourceId) return c.json({ error: 'Unauthenticated' }, 401);

      let raw: unknown;
      try {
        raw = await c.req.json();
      } catch {
        return c.json({ error: 'Body must be JSON' }, 400);
      }
      const parsed = chatBodySchema.safeParse(raw);
      if (!parsed.success) {
        return c.json(
          { error: 'Invalid request body', issues: parsed.error.issues.map((i) => i.message) },
          400,
        );
      }
      const body = parsed.data;
      if (body.resumeData && !body.runId)
        return c.json({ error: 'runId is required with resumeData' }, 400);

      const agentId = c.req.param('agentId') ?? '';
      let agent;
      try {
        agent = mastra.getAgentById(agentId);
      } catch {
        return c.json({ error: `Agent ${agentId} not found` }, 404);
      }

      const memory = (await agent.getMemory()) as unknown as MemoryLike | undefined;
      const threadId = body.memory.thread;
      if (memory) {
        const thread = await memory.getThreadById({ threadId });
        if (thread?.resourceId && thread.resourceId !== resourceId) {
          return c.json({ error: 'Access denied: thread belongs to a different user' }, 403);
        }
        // Resubmits (tool results, approvals, resume) never change the branch.
        const last = body.messages[body.messages.length - 1];
        const isResubmit = Boolean(body.resumeData) || last?.role === 'assistant';
        if (body.messageIds && thread && !isResubmit) {
          await reconcileThread({
            memory: memory as never,
            threadId,
            resourceId,
            activeIds: body.messageIds,
          });
        }
      }

      const serverTools = new Set(Object.keys(await agent.listTools({ requestContext })));
      const clientTools = toClientTools(body.tools, serverTools);

      const stream = await handleChatStream({
        mastra,
        agentId,
        version: 'v7',
        params: {
          messages: body.messages as never,
          memory: { thread: threadId, resource: resourceId },
          requestContext,
          abortSignal: c.req.raw.signal,
          ...(body.trigger && { trigger: body.trigger }),
          ...(body.runId && { runId: body.runId }),
          ...(body.resumeData && { resumeData: body.resumeData }),
          ...(Object.keys(clientTools).length > 0 && { clientTools: clientTools as never }),
        },
        onError: () => 'The model request failed.',
      });
      return createUIMessageStreamResponse({ stream });
    },
  });

  const history = registerApiRoute(`${path}/threads/:threadId/messages`, {
    method: 'GET',
    requiresAuth: true,
    handler: async (c) => {
      const mastra = c.get('mastra');
      const requestContext = c.get('requestContext');
      const resourceId = requestContext.get(RESOURCE_ID_KEY) as string | undefined;
      if (!resourceId) return c.json({ error: 'Unauthenticated' }, 401);
      const agentId = c.req.param('agentId') ?? '';
      let agent;
      try {
        agent = mastra.getAgentById(agentId);
      } catch {
        return c.json({ error: `Agent ${agentId} not found` }, 404);
      }
      const memory = (await agent.getMemory()) as unknown as MemoryLike | undefined;
      const threadId = c.req.param('threadId') ?? '';
      const thread = await memory?.getThreadById({ threadId });
      if (!memory || !thread) return c.json({ error: 'Thread not found' }, 404);
      if (thread.resourceId && thread.resourceId !== resourceId) {
        return c.json({ error: 'Access denied: thread belongs to a different user' }, 403);
      }
      const { messages } = await memory.recall({
        threadId,
        resourceId,
        perPage: false,
        orderBy: { field: 'createdAt', direction: 'ASC' },
      });
      const ui = mergeAssistantRuns(toAISdkMessages(messages, { version: 'v7' }) as never[]);
      return c.json({ messages: ui, total: ui.length });
    },
  });

  return [post, history];
}
