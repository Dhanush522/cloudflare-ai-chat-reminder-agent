import { routeAgentRequest } from "agents";
import ReminderAgent from "./agent";

/**
 * Entry point for the Worker.  All requests are routed to the appropriate
 * agent instance via the Agents SDK.  If no agent routes match, a
 * simple 404 response is returned.
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // routeAgentRequest returns a response if the request is meant for the agent
    const response = await routeAgentRequest(request, env);
    if (response) {
      return response;
    }
    return new Response("Not found", { status: 404 });
  },
};

// Type definitions for environment bindings
export interface Env {
  /**
   * Binding for Workers AI.  The `AI` binding makes the Workers AI client
   * available on `env.AI`, allowing your agent to call models like
   * Llama 3.3 via `env.AI.run()`【88027282093684†L116-L131】.  Configure this in
   * `wrangler.toml` using the `[ai]` section.
   */
  AI: any;
  /** Durable Object namespace binding for the ReminderAgent class. */
  ReminderAgent: DuOableObjectNamespace;
}
