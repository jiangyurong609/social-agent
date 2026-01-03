import { registerBuiltinNodes } from "@social-agent/workflow-core";
import { RunDo } from "./durable/run_do";
import { OrchestratorEnv } from "./config";

registerBuiltinNodes();

export default {
  async fetch(request: Request, env: OrchestratorEnv): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/run") {
      const body = await request.json() as any;
      const runId = body?.runId ?? crypto.randomUUID?.() ?? `run_${Date.now()}`;
      const id = env.RUN_DO.idFromName(runId);
      const stub = env.RUN_DO.get(id);
      return stub.fetch(new Request(new URL("/start", request.url).toString(), { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }));
    }

    if (url.pathname.startsWith("/run/")) {
      const runId = url.pathname.split("/")[2];
      const id = env.RUN_DO.idFromName(runId);
      const stub = env.RUN_DO.get(id);
      if (request.method === "POST" && url.pathname.endsWith("/approve")) {
        const body = await request.json() as any;
        return stub.fetch(new Request(new URL("/approve", request.url).toString(), { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }));
      }
      if (request.method === "POST" && url.pathname.endsWith("/action-result")) {
        const body = await request.json() as any;
        return stub.fetch(new Request(new URL("/action-result", request.url).toString(), { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }));
      }
      return stub.fetch(new URL("/state", request.url).toString());
    }

    return new Response(JSON.stringify({ ok: true, service: "orchestrator-worker" }), {
      headers: { "content-type": "application/json" }
    });
  }
};

export { RunDo };
