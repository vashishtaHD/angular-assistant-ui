// Original (no upstream counterpart): the demo chat agent of the Mastra server.
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { getWeather } from '../tools/get-weather';
import { bookMeeting } from '../tools/book-meeting';
import { askUser } from '../tools/ask-user';

/** Model accepted by the chat agent: a router string or an AI SDK language model. */
export type ChatAgentModel = ConstructorParameters<typeof Agent>[0]['model'];

/**
 * Builds the chat agent. The storage for its memory comes from the Mastra instance that
 * registers it. Tests pass a mock `model`.
 */
export function createChatAgent(options: { model?: ChatAgentModel } = {}) {
  return new Agent({
    id: 'chat-agent',
    name: 'Chat Agent',
    instructions: [
      'You are a concise, helpful assistant.',
      'Use the getWeather tool whenever the user asks about the weather in a city.',
      'Use the bookMeeting tool when the user wants to book a meeting. The user approves the booking before it happens.',
      'Use the askUser tool when you need the user to choose or clarify something before you continue. Pass options when the answer is a choice.',
    ].join(' '),
    model: options.model ?? (process.env.MASTRA_MODEL || 'openai/gpt-6-luna'),
    tools: { getWeather, bookMeeting, askUser },
    memory: new Memory({ options: { lastMessages: 20, generateTitle: true } }),
  });
}

export const chatAgent = createChatAgent();
