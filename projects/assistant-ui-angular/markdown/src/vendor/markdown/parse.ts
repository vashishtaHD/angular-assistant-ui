// Ported from packages/markdown/src/parse.ts @ 7d74276
// Copyright (c) 2026 AgentbaseAI Inc. MIT License; see NOTICE.
import type { RootNode } from "./ast";
import { createMarkdownItTokenizer } from "./tokenizer/markdown-it";

export const markdownTokenizer = createMarkdownItTokenizer({
  extensions: true,
});

export const parseMarkdown = (source: string): RootNode => ({
  type: "root",
  children: markdownTokenizer.parse(source).blocks,
});
