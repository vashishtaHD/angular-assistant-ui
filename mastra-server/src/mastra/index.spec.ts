import { describe, expect, it } from "vitest";
import { mastra } from "./index";

describe("mastra instance", () => {
  it("registers chatAgent and the chat route", () => {
    expect(mastra.getAgent("chatAgent")).toBeDefined();
    const server = mastra.getServer();
    const paths = (server?.apiRoutes ?? []).map((r) => r.path);
    expect(paths).toContain("/chat/:agentId");
    expect(server?.cors).toMatchObject({
      origin: process.env.FRONTEND_ORIGIN || "http://localhost:4200",
    });
  });
});
