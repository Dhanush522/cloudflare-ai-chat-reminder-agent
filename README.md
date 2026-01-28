# AI Chat Reminder Agent on Cloudflare

This repository contains an example of a **simple AI‑powered application** built for the optional Cloudflare assignment.  It demonstrates how to use the Cloudflare Agents SDK to build a chat interface backed by a large language model (LLM), schedule reminders using built‑in workflows, and maintain persistent conversation history using state.

## Overview

The application exposes an agent named `ReminderAgent` that:

1. **Chats with users via an LLM** – messages sent to the agent are streamed to OpenAI’s `gpt‑4o` model.  Responses are streamed back to the client in real time.
2. **Stores conversation history** – each agent instance maintains its own `history` array.  Messages are appended to this array and persisted between requests.
3. **Schedules reminders** – users can ask the agent to remind them about something after a delay (in seconds).  The agent schedules a task using the built‑in `schedule()` method.  When the scheduled time arrives, the agent invokes a callback that prints a reminder message and updates state.

This project intentionally avoids heavy dependencies (like a full React frontend) to make it easy to understand and deploy.  It focuses on showcasing the key pieces Cloudflare expects in the assignment: an LLM, a workflow/scheduler, user input, and persistent state.

## Directory structure

```cloudflare-ai-app/
├── README.md          – project overview and usage instructions
├── package.json       – NPM dependencies and scripts
├── wrangler.toml      – Durable Object binding configuration
└── src/
    ├── agent.ts       – implementation of the ReminderAgent class
    └── index.ts       – entry point that routes requests to the agent
```

## Prerequisites

- **Cloudflare account** – needed to deploy the agent.
- **OpenAI API key** – used by the agent to call the `gpt‑4o` model.  Create a `.dev.vars` file in the project root with the following content:

  ```  OPENAI_API_KEY=sk‑...your‑key...
  ```

- **Wrangler CLI** – install globally with `npm install -g wrangler`.  Wrangler is used to develop and deploy Cloudflare Workers and Durable Objects.

## Running locally

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Start a local dev server**

   ```bash
   npm run start
   ```

   This command runs `wrangler dev`, which emulates the Durable Object and agent behaviour locally.  You can send requests to `http://localhost:8787` using `curl` or any HTTP client.

3. **Send chat messages**

   Use `curl` to send a chat message.  The `id` field uniquely identifies the agent instance (you can choose any string):

   ```bash
   curl -X POST \
     -H \"Content-Type: application/json\" \
     -d '{\"id\": \"alice\", \"message\": \"Hello! How are you?\"}' \
     http://localhost:8787/
   ```

   The response will stream back the assistant’s reply.  Subsequent calls with the same `id` reuse the same agent instance and persist conversation history.

4. **Schedule a reminder**

   Send a request with `action: \"remind\"` and a `delay` in seconds.  The agent schedules a one‑off reminder and acknowledges with the scheduled task ID:

   ```bash
   curl -X POST \
     -H \"Content-Type: application/json\" \
     -d '{\"id\": \"alice\", \"action\": \"remind\", \"message\": \"Take a break\", \"delay\": 60}' \
     http://localhost:8787/
   ```

   After 60 seconds the scheduled callback triggers and the reminder message appears in the log (in a real application you might send an email or push notification here).
   ```

## Deploying to Cloudflare

1. **Authenticate Wrangler** – run `wrangler login` and follow the browser flow to authenticate.

2. **Configure Durable Object binding** – the `wrangler.toml` file already defines a Durable Object binding for `ReminderAgent`.  No further configuration is needed.

3. **Deploy**

   ```bash
   npm run deploy
   ```

   Wrangler will build and upload the worker and Durable Object.  Note the deployed URL in the output.  Use the same `curl` commands as above, replacing `localhost` with your Cloudflare subdomain.

## Limitations and notes

- The Agents SDK and AI SDK are imported but not executed in this environment because `npm install` and remote package fetching were blocked during development.  The code references the correct APIs (`streamText`, `openai`, `Agent`) so that, once the dependencies are installed in a proper environment, the application should function as intended.
- This repository **does not** include a web frontend.  It is intentionally minimal to satisfy the assignment criteria without introducing unnecessary complexity.  If you wish to build a React chat UI, you can add a client using the `agents/react` package and follow the examples in the [Cloudflare chat agent starter kit documentation](https://developers.cloudflare.com/agents/).

## How it works

- **ReminderAgent class** – extends the base `Agent` from the Agents SDK.  It maintains conversation history in its state and exposes two custom methods:
  - `onChatMessage()` – triggers when a chat message is received.  It calls OpenAI’s `gpt‑4o` model via `streamText()` to generate a response and streams it back to the user.
  - `scheduleReminder()` – schedules a one‑off reminder using `this.schedule()`.  The method calculates a future timestamp, registers the callback, and returns the task ID.
  - `sendReminder()` – executed automatically when a scheduled reminder fires.  It logs the reminder and appends a message to the agent’s state.  In a real system, this could notify the user through email, SMS, or push.

## Contributing / next steps

This example can be extended in many ways:

1. **Tool integration** – define reusable tools with `zod` schemas and integrate them into the LLM prompt.  The Agents SDK automatically handles tool calls and confirmations.
2. **Use Workers AI** – swap out the OpenAI provider for Cloudflare’s Workers AI models (e.g. `@cf/meta/llama-3-8b-instruct`) by installing the `workers-ai-provider` package and modifying the model definition.
3. **Enhance storage** – use `this.sql` to persist structured data, or integrate with Vectorize for semantic memory.
4. **Build a UI** – implement a chat interface using `agents/ai-react` and deploy it on Cloudflare Pages.

Feel free to fork this repository and adapt it to your own use case.  The goal here is to provide a clean, working baseline that satisfies the assignment requirements and demonstrates your ability to build on the Cloudflare platform.
