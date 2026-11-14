import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * Asks the user a question. It has no `execute` on purpose: the run ends with the tool call
 * pending and the frontend supplies the result, then resubmits the conversation.
 */
export const askUser = createTool({
  id: 'askUser',
  description:
    'Ask the user a question and wait for the answer. Offer options when the answer is a choice.',
  inputSchema: z.object({
    question: z.string().describe('The question to show the user'),
    options: z.array(z.string()).optional().describe('Choices to offer'),
    multiple: z.boolean().optional().describe('Whether several options can be picked'),
  }),
});
