import { Agent } from '@mastra/core/agent';
import { getWeather } from '../tools/get-weather';

export const chatAgent = new Agent({
  id: 'chat-agent',
  name: 'Chat Agent',
  instructions:
    'You are a concise, helpful assistant. Use the getWeather tool whenever the user asks about the weather in a city.',
  model: process.env.MASTRA_MODEL || 'openai/gpt-6-luna',
  tools: { getWeather },
});
