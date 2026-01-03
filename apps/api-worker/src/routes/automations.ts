import { ApiWorkerEnv } from "../config";
import { Automation, AutomationConfig, AutomationRun, calculateNextRun } from "@social-agent/schemas";

/**
 * Automation API routes - CRUD for automations
 */
export async function handleAutomations(
  request: Request,
  url: URL,
  env: ApiWorkerEnv
): Promise<Response | null> {
  const path = url.pathname;

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() });
  }

  // List automations
  if (request.method === "GET" && path === "/automations") {
    const userId = url.searchParams.get("userId") || "default";
    const workspaceId = url.searchParams.get("workspaceId") || "default";

    try {
      const { results } = await env.D1!.prepare(`
        SELECT * FROM automations
        WHERE user_id = ? AND workspace_id = ?
        ORDER BY created_at DESC
      `).bind(userId, workspaceId).all();

      const automations = (results || []).map(rowToAutomation);
      return jsonWithCors({ ok: true, automations });
    } catch (err) {
      return jsonWithCors({ ok: false, error: String(err) }, 500);
    }
  }

  // Create automation
  if (request.method === "POST" && path === "/automations") {
    try {
      const body = await request.json() as {
        userId?: string;
        workspaceId?: string;
        name: string;
        type: string;
        config: AutomationConfig;
      };

      if (!body.name || !body.type || !body.config) {
        return jsonWithCors({ ok: false, error: "Missing required fields" }, 400);
      }

      const id = `auto_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const userId = body.userId || "default";
      const workspaceId = body.workspaceId || "default";
      const cronExpression = body.config.schedule?.cronExpression || "0 9 * * *";
      const nextRunAt = calculateNextRun(cronExpression).toISOString();

      await env.D1!.prepare(`
        INSERT INTO automations (
          id, user_id, workspace_id, name, type, config,
          cron_expression, status, next_run_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, datetime('now'), datetime('now'))
      `).bind(
        id,
        userId,
        workspaceId,
        body.name,
        body.type,
        JSON.stringify(body.config),
        cronExpression,
        nextRunAt
      ).run();

      return jsonWithCors({ ok: true, id, nextRunAt });
    } catch (err) {
      return jsonWithCors({ ok: false, error: String(err) }, 500);
    }
  }

  // Get single automation
  if (request.method === "GET" && path.match(/^\/automations\/[^/]+$/)) {
    const id = path.split("/")[2];
    try {
      const { results } = await env.D1!.prepare(
        "SELECT * FROM automations WHERE id = ?"
      ).bind(id).all();

      if (!results || results.length === 0) {
        return jsonWithCors({ ok: false, error: "Not found" }, 404);
      }

      return jsonWithCors({ ok: true, automation: rowToAutomation(results[0]) });
    } catch (err) {
      return jsonWithCors({ ok: false, error: String(err) }, 500);
    }
  }

  // Update automation
  if (request.method === "PUT" && path.match(/^\/automations\/[^/]+$/)) {
    const id = path.split("/")[2];
    try {
      const body = await request.json() as {
        name?: string;
        config?: AutomationConfig;
        status?: string;
      };

      const updates: string[] = ["updated_at = datetime('now')"];
      const values: any[] = [];

      if (body.name) {
        updates.push("name = ?");
        values.push(body.name);
      }
      if (body.config) {
        updates.push("config = ?");
        values.push(JSON.stringify(body.config));
        if (body.config.schedule?.cronExpression) {
          updates.push("cron_expression = ?");
          values.push(body.config.schedule.cronExpression);
          updates.push("next_run_at = ?");
          values.push(calculateNextRun(body.config.schedule.cronExpression).toISOString());
        }
      }
      if (body.status) {
        updates.push("status = ?");
        values.push(body.status);
      }

      values.push(id);

      await env.D1!.prepare(`
        UPDATE automations SET ${updates.join(", ")} WHERE id = ?
      `).bind(...values).run();

      return jsonWithCors({ ok: true });
    } catch (err) {
      return jsonWithCors({ ok: false, error: String(err) }, 500);
    }
  }

  // Delete automation
  if (request.method === "DELETE" && path.match(/^\/automations\/[^/]+$/)) {
    const id = path.split("/")[2];
    try {
      await env.D1!.prepare("DELETE FROM automations WHERE id = ?").bind(id).run();
      return jsonWithCors({ ok: true });
    } catch (err) {
      return jsonWithCors({ ok: false, error: String(err) }, 500);
    }
  }

  // Pause automation
  if (request.method === "POST" && path.match(/^\/automations\/[^/]+\/pause$/)) {
    const id = path.split("/")[2];
    try {
      await env.D1!.prepare(`
        UPDATE automations SET status = 'paused', updated_at = datetime('now') WHERE id = ?
      `).bind(id).run();
      return jsonWithCors({ ok: true });
    } catch (err) {
      return jsonWithCors({ ok: false, error: String(err) }, 500);
    }
  }

  // Resume automation
  if (request.method === "POST" && path.match(/^\/automations\/[^/]+\/resume$/)) {
    const id = path.split("/")[2];
    try {
      const { results } = await env.D1!.prepare(
        "SELECT cron_expression FROM automations WHERE id = ?"
      ).bind(id).all<{ cron_expression: string }>();

      const cronExpression = results?.[0]?.cron_expression || "0 9 * * *";
      const nextRunAt = calculateNextRun(cronExpression as string).toISOString();

      await env.D1!.prepare(`
        UPDATE automations
        SET status = 'active', next_run_at = ?, updated_at = datetime('now')
        WHERE id = ?
      `).bind(nextRunAt, id).run();

      return jsonWithCors({ ok: true, nextRunAt });
    } catch (err) {
      return jsonWithCors({ ok: false, error: String(err) }, 500);
    }
  }

  // Trigger manual run
  if (request.method === "POST" && path.match(/^\/automations\/[^/]+\/run$/)) {
    const id = path.split("/")[2];
    try {
      // Update next_run_at to now to trigger on next cron cycle
      await env.D1!.prepare(`
        UPDATE automations
        SET next_run_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).bind(id).run();

      return jsonWithCors({ ok: true, message: "Automation will run on next scheduler cycle" });
    } catch (err) {
      return jsonWithCors({ ok: false, error: String(err) }, 500);
    }
  }

  // Get run history
  if (request.method === "GET" && path.match(/^\/automations\/[^/]+\/history$/)) {
    const id = path.split("/")[2];
    const limit = parseInt(url.searchParams.get("limit") || "10", 10);

    try {
      const { results } = await env.D1!.prepare(`
        SELECT * FROM automation_runs
        WHERE automation_id = ?
        ORDER BY started_at DESC
        LIMIT ?
      `).bind(id, limit).all();

      const runs = (results || []).map((row: any) => ({
        id: row.id,
        automationId: row.automation_id,
        status: row.status,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        actionsCount: row.actions_count,
        error: row.error,
        result: row.result ? JSON.parse(row.result) : null
      }));

      return jsonWithCors({ ok: true, runs });
    } catch (err) {
      return jsonWithCors({ ok: false, error: String(err) }, 500);
    }
  }

  return null;
}

function rowToAutomation(row: any): Automation {
  return {
    id: row.id,
    userId: row.user_id,
    workspaceId: row.workspace_id,
    name: row.name,
    type: row.type,
    config: JSON.parse(row.config),
    cronExpression: row.cron_expression,
    status: row.status,
    lastRunAt: row.last_run_at,
    nextRunAt: row.next_run_at,
    runCount: row.run_count || 0,
    errorCount: row.error_count || 0,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

function jsonWithCors(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
      ...corsHeaders()
    }
  });
}
