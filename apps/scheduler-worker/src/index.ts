import { SchedulerEnv } from "./config";
import { runCron } from "./cron";

export default {
  // HTTP handler for health checks
  async fetch(request: Request, env: SchedulerEnv): Promise<Response> {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === "/health") {
      return Response.json({ ok: true, service: "scheduler-worker" });
    }

    // Manual trigger for testing
    if (url.pathname === "/trigger" && request.method === "POST") {
      try {
        const result = await runCron(env);
        return Response.json({ ok: true, result });
      } catch (error) {
        return Response.json({
          ok: false,
          error: error instanceof Error ? error.message : "Unknown error"
        }, { status: 500 });
      }
    }

    return Response.json({ ok: true, service: "scheduler-worker" });
  },

  // Cron trigger handler
  async scheduled(event: ScheduledEvent, env: SchedulerEnv, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runCron(env));
  }
};
