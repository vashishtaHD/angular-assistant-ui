import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/** Demo tool that needs the user's approval before it runs. */
export const bookMeeting = createTool({
  id: 'bookMeeting',
  description: 'Book a meeting. The user must approve the booking before it happens.',
  inputSchema: z.object({
    title: z.string().describe('Meeting title'),
    when: z.string().describe('When the meeting happens, e.g. "tomorrow 3pm"'),
  }),
  outputSchema: z.object({ confirmed: z.literal(true), title: z.string(), when: z.string() }),
  requireApproval: true,
  execute: async ({ title, when }) => ({ confirmed: true as const, title, when }),
});
