<img src="assets/icon.svg" width="64" height="64" alt="">

# angular-assistant-ui

Headless Angular (18.2 to 22) bindings for [assistant-ui](https://github.com/assistant-ui/assistant-ui),
ported from upstream's Vue binding over `@assistant-ui/core|store|tap`, plus a demo chat
app and a [Mastra](https://mastra.ai) server.

Created in [T3 Code](https://t3.codes).

## Layout

| Path                            | What                                                            |
| ------------------------------- | --------------------------------------------------------------- |
| `projects/assistant-ui-angular` | The library (`angular-assistant-ui`, plus the `/testing` entry) |
| `projects/demo`                 | Angular demo chat app (Tailwind)                                |
| `mastra-server`                 | Mastra server exposing the `chatAgent` at `/chat/:agentId`      |
| `docs/porting.md`               | Upstream parity table and porting guide                         |
| `docs/deployment.md`            | Hosting, CORS, runtime config, and gating the chat route        |

Library usage and API: [projects/assistant-ui-angular/README.md](projects/assistant-ui-angular/README.md).

## Setup

Node `>=22.13` (Mastra 1.x requires it; see `.nvmrc`). The Angular 22 compat app (`npm run compat -- ng22`) additionally needs Node `^22.22.3`, `^24.15.0` or `>=26`.

```bash
npm ci
```

## Run the demo

1. Copy `mastra-server/.env.example` to `mastra-server/.env` (gitignored) and set a
   provider key:
   - `MASTRA_MODEL=openai/gpt-6-luna` (the default when empty) with `OPENAI_API_KEY`, or
   - `MASTRA_MODEL=openrouter/<vendor>/<model>` with `OPENROUTER_API_KEY`, for example
     `openrouter/baidu/ernie-5.5-flash-preview:free`.
2. `npm run dev` builds the library, then starts the Mastra server
   (`http://localhost:4111`) and the Angular demo (`http://localhost:4200`) together.
   Alternatively, after `npm run build:lib`, run `npm run dev -w mastra-server` and
   `npm start` in two terminals.

Ask "What's the weather in Paris?" to see the `getWeather` tool call rendered by the
demo's weather card, followed by the streamed answer. This flow has been verified end to
end with Angular 18.2 and Zone.js, the Mastra `chatRoute` (v7) and an OpenRouter model.

The demo reads the chat endpoint from `projects/demo/public/config.json`
(`mastraChatUrl`, default `http://localhost:4111/chat/chatAgent`) at startup. Its
initial bundle is about 771 kB because `@assistant-ui/ai-sdk` brings in React and the AI
SDK; the build budgets are set accordingly.

## Scripts

| Script                     | Does                                                |
| -------------------------- | --------------------------------------------------- |
| `npm run dev`              | Build the library, run Mastra and the demo          |
| `npm start`                | Serve the demo only                                 |
| `npm test`                 | Library (zone and zoneless), demo, and Mastra tests |
| `npm run test:lib`         | Library tests (`test:lib:watch` for watch mode)     |
| `npm run test:demo`        | Demo tests (`test:demo:watch` for watch mode)       |
| `npm run lint`             | Angular ESLint                                      |
| `npm run build:lib`        | Build the library to `dist/assistant-ui-angular`    |
| `npm run build:demo`       | Build the demo                                      |
| `npm run typecheck:mastra` | Type-check the Mastra server                        |
| `npm run format`           | Prettier (`format:check` to verify)                 |

## Contributing and porting

New primitives are ported from upstream's Vue binding. Follow the checklist in
[docs/porting.md](docs/porting.md), keep library code to Angular 18.2 APIs, and make
tests pass in both change-detection modes. To deploy, see [docs/deployment.md](docs/deployment.md).

## License

MIT. See `LICENSE` and `NOTICE`.
