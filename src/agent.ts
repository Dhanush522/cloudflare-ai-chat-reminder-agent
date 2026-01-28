import { Agent } from "agents";

/**
 * Type describing the shape of the agent’s state.  Each agent instance
 * maintains its own conversation history.  Additional fields can be
 * added as needed (e.g. for reminders, counters, etc.).
 */
interface AgentState {
  history: { role: "user" | "assistant"; content: string }[];
}

/**
 * Environment bindings available to the agent.  Wrangler will populate
 * `OPENAI_API_KEY` from your `.dev.vars` file and `ReminderAgent` will
 * be bound to the Durable Object namespace via wrangler.toml.
 */
interface Env {
  OPENAI_API_KEY: string;
}

/**
 * ReminderAgent implements a basic chat agent with reminder scheduling.
 * It supports two types of requests:
 *
 * - Chat messages – body must contain a `message` string.  The agent
 *   forwards the conversation history to the OpenAI Chat API and
 *   streams back the assistant’s reply.  The history is stored in
 *   durable state so subsequent calls build upon previous messages.
 *
 * - Reminder requests – body must contain an `action` field equal to
 *   "remind", a `message` describing what to remind, and an optional
 *   `delay` in seconds.  The agent schedules a one‑off task via
 *   `this.schedule()` and returns the scheduled task identifier.
 */
export default class ReminderAgent extends Agent<Env, AgentState> {
  // Initialise state for new agent instances
  initialState: AgentState = {
    history: [],
  };

  /**
   * Handle HTTP requests directed at this agent.  The request body
   * should be JSON with at least an `id` to identify the agent instance.
   */
  async onRequest(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }
    let data: any;
    try {
      data = await request.json();
    } catch (err) {
      return new Response("Invalid JSON body", { status: 400 });
    }
    const { action, message, delay } = data;
    // Handle reminder action
    if (action === "remind") {
      if (typeof message !== "string" || message.trim() === "") {
        return new Response("Missing reminder message", { status: 400 });
      }
      const secs = typeof delay === "number" && delay > 0 ? delay : 60;
      const scheduleId = await this.scheduleReminder(message, secs);
      return new Response(
        JSON.stringify({ scheduledId: scheduleId }),
        { headers: { "Content-Type": "application/json" } },
      );
    }
    // Handle chat
    if (typeof message !== "string" || message.trim() === "") {
      return new Response("Missing message", { status: 400 });
    }
    try {
      const reply = await this.generateResponse(message);
      return new Response(
        JSON.stringify({ response: reply }),
        { headers: { "Content-Type": "application/json" } },
      );
    } catch (error) {
      console.error("Error generating response", error);
      return new Response("Internal error", { status: 500 });
    }
  }

  /**
   * Generate a chat response using the OpenAI Chat API.  The
   * conversation history is sent as context, and the returned assistant
   * message is appended to state.  If the OpenAI request fails the
   * error is propagated to the caller.
   */
  private async generateResponse(userMsg: string): Promise<string> {
    // Append the user message to history
    const history = this.state.history ?? [];
    history.push({ role: "user", content: userMsg });

    // Build the payload for OpenAI chat completion
    const payload = {
      model: "gpt-4o",
      messages: history.map((m) => ({ role: m.role, content: m.content })),
      stream: false,
    };

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`OpenAI API error: ${res.status}`);
    }
    const json: any = await res.json();
    const assistantMsg: string = json?.choices?.[0]?.message?.content ?? "";
    // Append assistant response to history and persist state
    history.push({ role: "assistant", content: assistantMsg });
    this.setState({ ...this.state, history });
    return assistantMsg;
  }

  /**
   * Schedule a one‑off reminder.  The delay is specified in seconds.
   * Returns the identifier of the scheduled task.
   */
  private async scheduleReminder(message: string, delayInSeconds: number): Promise<string> {
    const when = new Date(Date.now() + delayInSeconds * 1000);
    const schedule = await this.schedule(when, "sendReminder", { message });
    return schedule.id;
  }

  /**
   * Callback invoked by the scheduler when a reminder fires.  In this
   * example we append a reminder message to the chat history.  In a real
   * application you might notify the user via email, SMS, or push.
   */
  async sendReminder({ message }: { message: string }) {
    console.log(`Reminder triggered: ${message}`);
    const history = this.state.history ?? [];
    history.push({ role: "assistant", content: `⏰ Reminder: ${message}` });
    this.setState({ ...this.state, history });
  }
}
