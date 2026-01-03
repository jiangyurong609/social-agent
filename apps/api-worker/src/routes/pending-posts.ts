import { ApiWorkerEnv } from "../config";
import { PendingPost, PendingPostStatus } from "@social-agent/schemas";

/**
 * Pending Posts API routes - approval queue for AI-generated posts
 */
export async function handlePendingPosts(
  request: Request,
  url: URL,
  env: ApiWorkerEnv
): Promise<Response | null> {
  const path = url.pathname;

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() });
  }

  // List pending posts
  if (request.method === "GET" && path === "/pending-posts") {
    const userId = url.searchParams.get("userId") || "default";
    const workspaceId = url.searchParams.get("workspaceId") || "default";
    const status = url.searchParams.get("status") || "pending";
    const limit = parseInt(url.searchParams.get("limit") || "20", 10);

    try {
      const { results } = await env.D1!.prepare(`
        SELECT * FROM pending_posts
        WHERE user_id = ? AND workspace_id = ? AND status = ?
        ORDER BY generated_at DESC
        LIMIT ?
      `).bind(userId, workspaceId, status, limit).all();

      const posts = (results || []).map(rowToPendingPost);
      return jsonWithCors({ ok: true, posts });
    } catch (err) {
      return jsonWithCors({ ok: false, error: String(err) }, 500);
    }
  }

  // Get single pending post
  if (request.method === "GET" && path.match(/^\/pending-posts\/[^/]+$/)) {
    const id = path.split("/")[2];
    try {
      const { results } = await env.D1!.prepare(
        "SELECT * FROM pending_posts WHERE id = ?"
      ).bind(id).all();

      if (!results || results.length === 0) {
        return jsonWithCors({ ok: false, error: "Not found" }, 404);
      }

      return jsonWithCors({ ok: true, post: rowToPendingPost(results[0]) });
    } catch (err) {
      return jsonWithCors({ ok: false, error: String(err) }, 500);
    }
  }

  // Approve and publish post
  if (request.method === "POST" && path.match(/^\/pending-posts\/[^/]+\/approve$/)) {
    const id = path.split("/")[2];
    try {
      const body = await request.json() as {
        title?: string;
        content?: string;
        tags?: string[];
        images?: string[];
      };

      // Get the pending post
      const { results } = await env.D1!.prepare(
        "SELECT * FROM pending_posts WHERE id = ?"
      ).bind(id).all();

      if (!results || results.length === 0) {
        return jsonWithCors({ ok: false, error: "Not found" }, 404);
      }

      const post = rowToPendingPost(results[0]);

      if (post.status !== "pending") {
        return jsonWithCors({ ok: false, error: `Post already ${post.status}` }, 400);
      }

      // Apply edits if provided
      const finalTitle = body.title || post.title;
      const finalContent = body.content || post.content;
      const finalTags = body.tags || post.tags;
      const finalImages = body.images || post.images;

      // Update status to approved
      await env.D1!.prepare(`
        UPDATE pending_posts
        SET status = 'approved',
            title = ?,
            content = ?,
            tags = ?,
            images = ?,
            reviewed_at = datetime('now')
        WHERE id = ?
      `).bind(
        finalTitle,
        finalContent,
        JSON.stringify(finalTags),
        JSON.stringify(finalImages),
        id
      ).run();

      // Publish to XHS via xiaohongshu-mcp
      let publishResult: Record<string, unknown> = {};
      let publishSuccess = false;

      if (env.XHS_MCP_BASE) {
        try {
          const publishResp = await fetch(`${env.XHS_MCP_BASE}/api/v1/publish`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: finalTitle,
              content: finalContent,
              images: finalImages,
              tags: finalTags
            })
          });

          publishResult = await publishResp.json() as Record<string, unknown>;
          publishSuccess = publishResp.ok && (publishResult.success === true);

          if (publishSuccess) {
            // Update to published status
            await env.D1!.prepare(`
              UPDATE pending_posts
              SET status = 'published',
                  published_at = datetime('now'),
                  publish_result = ?
              WHERE id = ?
            `).bind(JSON.stringify(publishResult), id).run();
          } else {
            // Mark as failed
            await env.D1!.prepare(`
              UPDATE pending_posts
              SET status = 'failed',
                  publish_result = ?
              WHERE id = ?
            `).bind(JSON.stringify(publishResult), id).run();
          }
        } catch (publishErr) {
          publishResult = { error: String(publishErr) };
          await env.D1!.prepare(`
            UPDATE pending_posts
            SET status = 'failed',
                publish_result = ?
            WHERE id = ?
          `).bind(JSON.stringify(publishResult), id).run();
        }
      } else {
        // No XHS_MCP_BASE configured - just mark as approved
        publishResult = { message: "XHS_MCP_BASE not configured, post approved but not published" };
      }

      return jsonWithCors({
        ok: true,
        published: publishSuccess,
        publishResult
      });
    } catch (err) {
      return jsonWithCors({ ok: false, error: String(err) }, 500);
    }
  }

  // Reject post
  if (request.method === "POST" && path.match(/^\/pending-posts\/[^/]+\/reject$/)) {
    const id = path.split("/")[2];
    try {
      const body = await request.json() as { reason?: string };

      // Check post exists and is pending
      const { results } = await env.D1!.prepare(
        "SELECT status FROM pending_posts WHERE id = ?"
      ).bind(id).all();

      if (!results || results.length === 0) {
        return jsonWithCors({ ok: false, error: "Not found" }, 404);
      }

      const status = (results[0] as any).status;
      if (status !== "pending") {
        return jsonWithCors({ ok: false, error: `Post already ${status}` }, 400);
      }

      await env.D1!.prepare(`
        UPDATE pending_posts
        SET status = 'rejected',
            rejection_reason = ?,
            reviewed_at = datetime('now')
        WHERE id = ?
      `).bind(body.reason || null, id).run();

      return jsonWithCors({ ok: true });
    } catch (err) {
      return jsonWithCors({ ok: false, error: String(err) }, 500);
    }
  }

  // Delete post (for cleanup)
  if (request.method === "DELETE" && path.match(/^\/pending-posts\/[^/]+$/)) {
    const id = path.split("/")[2];
    try {
      await env.D1!.prepare("DELETE FROM pending_posts WHERE id = ?").bind(id).run();
      return jsonWithCors({ ok: true });
    } catch (err) {
      return jsonWithCors({ ok: false, error: String(err) }, 500);
    }
  }

  // Regenerate post content (trigger new AI generation)
  if (request.method === "POST" && path.match(/^\/pending-posts\/[^/]+\/regenerate$/)) {
    const id = path.split("/")[2];
    try {
      // Get the pending post and its automation config
      const { results } = await env.D1!.prepare(`
        SELECT pp.*, a.config as automation_config
        FROM pending_posts pp
        JOIN automations a ON pp.automation_id = a.id
        WHERE pp.id = ?
      `).bind(id).all();

      if (!results || results.length === 0) {
        return jsonWithCors({ ok: false, error: "Not found" }, 404);
      }

      const row = results[0] as any;
      if (row.status !== "pending") {
        return jsonWithCors({ ok: false, error: `Post already ${row.status}` }, 400);
      }

      // Mark for regeneration - the scheduler will pick it up
      // For now, just return a message that regeneration needs to be triggered manually
      return jsonWithCors({
        ok: true,
        message: "Regeneration requires triggering the automation again. Use the automation run endpoint."
      });
    } catch (err) {
      return jsonWithCors({ ok: false, error: String(err) }, 500);
    }
  }

  // Get stats for pending posts
  if (request.method === "GET" && path === "/pending-posts/stats") {
    const userId = url.searchParams.get("userId") || "default";
    const workspaceId = url.searchParams.get("workspaceId") || "default";

    try {
      const { results } = await env.D1!.prepare(`
        SELECT status, COUNT(*) as count
        FROM pending_posts
        WHERE user_id = ? AND workspace_id = ?
        GROUP BY status
      `).bind(userId, workspaceId).all();

      const stats: Record<string, number> = {
        pending: 0,
        approved: 0,
        rejected: 0,
        published: 0,
        failed: 0
      };

      for (const row of results || []) {
        const r = row as { status: string; count: number };
        stats[r.status] = r.count;
      }

      return jsonWithCors({ ok: true, stats });
    } catch (err) {
      return jsonWithCors({ ok: false, error: String(err) }, 500);
    }
  }

  return null;
}

function rowToPendingPost(row: any): PendingPost {
  return {
    id: row.id,
    automationId: row.automation_id,
    userId: row.user_id,
    workspaceId: row.workspace_id,
    title: row.title,
    content: row.content,
    images: row.images ? JSON.parse(row.images) : [],
    tags: row.tags ? JSON.parse(row.tags) : [],
    generationMode: row.generation_mode,
    generationPrompt: row.generation_prompt,
    generationModel: row.generation_model,
    status: row.status as PendingPostStatus,
    rejectionReason: row.rejection_reason,
    generatedAt: row.generated_at,
    reviewedAt: row.reviewed_at,
    publishedAt: row.published_at,
    publishResult: row.publish_result ? JSON.parse(row.publish_result) : null
  };
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
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
