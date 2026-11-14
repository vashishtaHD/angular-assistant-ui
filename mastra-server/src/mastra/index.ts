import { Mastra } from "@mastra/core";
import { chatRoute } from "@mastra/ai-sdk";
import { chatAgent } from "./agents/chat-agent";

export const mastra = new Mastra({
  agents: { chatAgent },
  server: {
    cors: {
      origin: process.env.FRONTEND_ORIGIN || "http://localhost:4200",
      credentials: true,
    },
    apiRoutes: [chatRoute({ path: "/chat/:agentId", version: "v7" })],
  },
});
