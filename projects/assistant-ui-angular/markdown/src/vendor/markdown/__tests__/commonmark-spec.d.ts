// Ported from packages/markdown/src/__tests__/commonmark-spec.d.ts @ 7d74276
// Copyright (c) 2026 AgentbaseAI Inc. MIT License; see NOTICE.
declare module "commonmark-spec" {
  const spec: {
    tests: Array<{
      markdown: string;
      html: string;
      section: string;
      number: number;
    }>;
  };
  export = spec;
}
