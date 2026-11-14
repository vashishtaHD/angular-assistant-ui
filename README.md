<img src="assets/icon.svg" width="64" height="64" alt="">

# angular-assistant-ui

Created in [T3 Code](https://t3.codes).

## Run the demo

1. Copy `mastra-server/.env.example` to `mastra-server/.env` and set a provider key
   (and `MASTRA_MODEL` if you do not use the default).
2. `npm run dev` builds the library, then starts the Mastra server
   (`http://localhost:4111`) and the Angular demo (`http://localhost:4200`) together.
   Alternatively, after `npm run build:lib`, run `npm run dev -w mastra-server` and
   `npm start` in two terminals.

The demo reads the chat endpoint from `projects/demo/public/config.json`
(`mastraChatUrl`, default `http://localhost:4111/chat/chatAgent`) at startup.
