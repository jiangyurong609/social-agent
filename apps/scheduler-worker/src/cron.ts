import { SchedulerEnv } from "./config";
import { generateFromConfig } from "./ai-generator";
import { generateImages } from "./image-generator";
import { ScheduledPostConfig } from "@social-agent/schemas";

interface AutomationRow {
  id: string;
  user_id: string;
  workspace_id: string;
  name: string;
  type: string;
  config: string;
  cron_expression: string | null;
  status: string;
  last_run_at: string | null;
  next_run_at: string | null;
  run_count: number;
  error_count: number;
}

interface CronResult {
  processed: number;
  succeeded: number;
  failed: number;
  errors: string[];
}

interface XhsFeed {
  id: string;
  xsec_token: string;
  note_card?: {
    title?: string;
    user?: { nickname?: string };
    interact_info?: { liked_count?: string };
  };
}

/**
 * Main cron handler - runs every 5 minutes
 * Queries due automations and executes them directly via XHS API
 */
export async function runCron(env: SchedulerEnv): Promise<CronResult> {
  const now = new Date().toISOString();
  const result: CronResult = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: []
  };

  try {
    // Query automations that are due to run
    const { results } = await env.D1.prepare(`
      SELECT * FROM automations
      WHERE status = 'active'
        AND next_run_at IS NOT NULL
        AND next_run_at <= ?
      ORDER BY next_run_at ASC
      LIMIT 10
    `).bind(now).all<AutomationRow>();

    if (!results || results.length === 0) {
      return result;
    }

    for (const automation of results) {
      result.processed++;

      try {
        await executeAutomationDirect(env, automation);
        result.succeeded++;

        // Update last_run_at and calculate next_run_at
        const nextRun = calculateNextRun(automation.cron_expression || "0 * * * *");
        await env.D1.prepare(`
          UPDATE automations
          SET last_run_at = ?,
              next_run_at = ?,
              run_count = run_count + 1,
              updated_at = ?
          WHERE id = ?
        `).bind(now, nextRun.toISOString(), now, automation.id).run();

      } catch (error) {
        result.failed++;
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        result.errors.push(`${automation.id}: ${errorMsg}`);

        // Update error count
        await env.D1.prepare(`
          UPDATE automations
          SET error_count = error_count + 1,
              last_error = ?,
              updated_at = ?
          WHERE id = ?
        `).bind(errorMsg, now, automation.id).run();
      }
    }

  } catch (error) {
    result.errors.push(`Query error: ${error instanceof Error ? error.message : "Unknown"}`);
  }

  return result;
}

/**
 * Execute automation directly by calling XHS API routes
 * Bypasses workflow system for reliability
 */
async function executeAutomationDirect(env: SchedulerEnv, automation: AutomationRow): Promise<void> {
  const config = JSON.parse(automation.config);
  const runId = `run_${automation.id}_${Date.now()}`;

  // Create a run record
  await env.D1.prepare(`
    INSERT INTO automation_runs (id, automation_id, status, started_at)
    VALUES (?, ?, 'running', datetime('now'))
  `).bind(runId, automation.id).run();

  let actionsCount = 0;
  let runResult: Record<string, unknown> = {};

  try {
    if (automation.type === "auto_engage") {
      const engageResult = await executeAutoEngage(env, config, automation.user_id);
      actionsCount = engageResult.actionsCount;
      runResult = engageResult;
    } else if (automation.type === "content_discovery") {
      const discoveryResult = await executeContentDiscovery(env, config);
      actionsCount = discoveryResult.postsFound;
      runResult = discoveryResult;
    } else if (automation.type === "scheduled_post") {
      const postResult = await executeScheduledPost(env, config as ScheduledPostConfig, automation);
      actionsCount = postResult.postsGenerated;
      runResult = postResult;
    }

    // Update run status to completed
    await env.D1.prepare(`
      UPDATE automation_runs
      SET status = 'completed', completed_at = datetime('now'), actions_count = ?, result = ?
      WHERE id = ?
    `).bind(actionsCount, JSON.stringify(runResult), runId).run();

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    await env.D1.prepare(`
      UPDATE automation_runs
      SET status = 'failed', completed_at = datetime('now'), error = ?
      WHERE id = ?
    `).bind(errorMsg, runId).run();

    throw error;
  }
}

/**
 * Execute auto-engage automation:
 * 1. Search for posts by keyword
 * 2. Like and/or comment on each post
 */
async function executeAutoEngage(
  env: SchedulerEnv,
  config: any,
  userId: string
): Promise<{ actionsCount: number; postsEngaged: number; likesCount: number; commentsCount: number }> {
  // Check daily usage limits
  const usage = await getDailyUsage(env, userId);
  const limits = config.limits || {};

  if (usage.commentsCount >= (limits.maxCommentsPerDay || 20)) {
    throw new Error("Daily comment limit reached");
  }
  if (usage.likesCount >= (limits.maxLikesPerDay || 50)) {
    throw new Error("Daily like limit reached");
  }

  // Pick a keyword to search
  const keywords = config.searchKeywords || [];
  if (keywords.length === 0) {
    throw new Error("No search keywords configured");
  }
  const keyword = keywords[Math.floor(Math.random() * keywords.length)];

  // Search for posts - call xiaohongshu-mcp directly
  const searchResp = await fetch(`${env.XHS_MCP_BASE}/api/v1/feeds/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      keyword,
      page: 1,
      sort_by: "time_descending",
      note_type: "all"
    })
  });

  if (!searchResp.ok) {
    throw new Error(`Search failed: ${searchResp.status}`);
  }

  const searchResult = await searchResp.json() as { success: boolean; data?: { feeds: Array<any> }; message?: string };
  if (!searchResult.success || !searchResult.data?.feeds) {
    throw new Error(searchResult.message || "Search returned no results");
  }

  const feeds = searchResult.data.feeds;
  const maxPosts = Math.min(limits.maxPostsPerRun || 5, feeds.length);
  const doLike = config.actions?.like ?? true;
  const doComment = config.actions?.comment ?? true;
  const commentTemplates = config.actions?.commentTemplates || [
    "很棒的分享！",
    "学到了，谢谢分享",
    "说得太好了"
  ];

  let likesCount = 0;
  let commentsCount = 0;
  let postsEngaged = 0;

  // Engage with posts
  for (let i = 0; i < maxPosts; i++) {
    const feed = feeds[i];
    const feedId = feed.id;
    const xsecToken = feed.xsecToken;  // API returns xsecToken, not xsec_token

    if (!feedId || !xsecToken) continue;

    // Random delay between actions (2-5 seconds)
    if (i > 0) {
      await sleep(2000 + Math.random() * 3000);
    }

    try {
      // Note: Like API not available in xiaohongshu-mcp yet
      // TODO: Add like functionality when API is available
      if (doLike) {
        // Skip liking for now - API not implemented
        // likesCount would be incremented here
      }

      // Comment on post - call xiaohongshu-mcp directly
      if (doComment && usage.commentsCount + commentsCount < (limits.maxCommentsPerDay || 20)) {
        // Random delay before comment
        await sleep(1000 + Math.random() * 2000);

        // Get post title and author for AI comment generation
        const postTitle = feed.noteCard?.displayTitle || feed.noteCard?.title || "";
        const postAuthor = feed.noteCard?.user?.nickname || feed.noteCard?.user?.nickName || "";

        let comment: string;

        // Try AI generation if API key is available, otherwise use template
        if (env.GEMINI_API_KEY && postTitle) {
          try {
            comment = await generateAIComment(env.GEMINI_API_KEY, postTitle, postAuthor);
          } catch {
            // Fall back to template if AI fails
            comment = commentTemplates[Math.floor(Math.random() * commentTemplates.length)];
          }
        } else {
          comment = commentTemplates[Math.floor(Math.random() * commentTemplates.length)];
        }

        const commentResp = await fetch(`${env.XHS_MCP_BASE}/api/v1/feeds/comment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            feed_id: feedId,
            xsec_token: xsecToken,
            content: comment
          })
        });

        const commentResult = await commentResp.json() as { success: boolean };
        if (commentResult.success) {
          commentsCount++;
        }
      }

      postsEngaged++;
    } catch (err) {
      // Log but continue with other posts
      console.error(`Error engaging with post ${feedId}:`, err);
    }
  }

  // Update daily usage
  await updateDailyUsage(env, userId, likesCount, commentsCount, 0);

  return {
    actionsCount: likesCount + commentsCount,
    postsEngaged,
    likesCount,
    commentsCount
  };
}

/**
 * Execute content discovery automation:
 * Search for trending content (no engagement)
 */
async function executeContentDiscovery(
  env: SchedulerEnv,
  config: any
): Promise<{ postsFound: number; keyword: string }> {
  const keywords = config.keywords || [];
  if (keywords.length === 0) {
    throw new Error("No keywords configured");
  }

  const keyword = keywords[Math.floor(Math.random() * keywords.length)];
  const sortBy = config.sortBy || "popularity_descending";

  // Call xiaohongshu-mcp directly
  const searchResp = await fetch(`${env.XHS_MCP_BASE}/api/v1/feeds/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      keyword,
      page: 1,
      sort_by: sortBy,
      note_type: "all"
    })
  });

  if (!searchResp.ok) {
    throw new Error(`Search failed: ${searchResp.status}`);
  }

  const searchResult = await searchResp.json() as { success: boolean; data?: { feeds: Array<any> } };
  const postsFound = searchResult.data?.feeds?.length || 0;

  return { postsFound, keyword };
}

/**
 * Get daily usage for rate limiting
 */
async function getDailyUsage(env: SchedulerEnv, userId: string): Promise<{
  commentsCount: number;
  likesCount: number;
  postsCount: number;
}> {
  const today = new Date().toISOString().split("T")[0];

  const { results } = await env.D1.prepare(`
    SELECT comments_count, likes_count, posts_count
    FROM automation_usage
    WHERE user_id = ? AND date = ?
  `).bind(userId, today).all<{
    comments_count: number;
    likes_count: number;
    posts_count: number;
  }>();

  if (!results || results.length === 0) {
    return { commentsCount: 0, likesCount: 0, postsCount: 0 };
  }

  return {
    commentsCount: results[0].comments_count,
    likesCount: results[0].likes_count,
    postsCount: results[0].posts_count
  };
}

/**
 * Update daily usage counts
 */
async function updateDailyUsage(
  env: SchedulerEnv,
  userId: string,
  likes: number,
  comments: number,
  posts: number
): Promise<void> {
  const today = new Date().toISOString().split("T")[0];

  await env.D1.prepare(`
    INSERT INTO automation_usage (user_id, date, likes_count, comments_count, posts_count)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, date) DO UPDATE SET
      likes_count = likes_count + excluded.likes_count,
      comments_count = comments_count + excluded.comments_count,
      posts_count = posts_count + excluded.posts_count
  `).bind(userId, today, likes, comments, posts).run();
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate an AI-powered comment based on post content using Gemini
 */
async function generateAIComment(
  apiKey: string,
  postTitle: string,
  postAuthor: string
): Promise<string> {
  const prompt = `你是一个小红书用户，看到了一篇帖子，请写一条真诚、有趣的评论。

帖子标题: ${postTitle}
作者: ${postAuthor}

要求:
- 用中文写一条简短的评论（15-40个字）
- 语气自然、真诚，像朋友聊天一样
- 可以表达赞同、提问、分享相关经验或给予鼓励
- 不要用"很棒"、"不错"、"写得好"这样泛泛的评论
- 根据帖子标题内容写出相关的评论
- 可以适当使用1-2个emoji
- 不要用markdown格式

只返回评论内容，不要有任何其他文字。`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 100
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json() as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) {
      throw new Error("No text in Gemini response");
    }

    // Clean up the response - remove quotes if present
    return text.replace(/^["']|["']$/g, "").trim();
  } catch (error) {
    console.error("AI comment generation failed:", error);
    // Return null to fall back to template
    throw error;
  }
}

/**
 * Simple cron expression parser for next run calculation
 */
function calculateNextRun(cronExpression: string, fromDate: Date = new Date()): Date {
  const parts = cronExpression.split(" ");
  if (parts.length !== 5) {
    // Default to next hour if invalid
    const next = new Date(fromDate);
    next.setHours(next.getHours() + 1);
    next.setMinutes(0);
    next.setSeconds(0);
    return next;
  }

  const [minute, hour] = parts;
  const next = new Date(fromDate);

  // Handle */N patterns for minute
  if (minute.startsWith("*/")) {
    const interval = parseInt(minute.slice(2), 10);
    const nextMinute = Math.ceil((next.getMinutes() + 1) / interval) * interval;
    if (nextMinute >= 60) {
      next.setHours(next.getHours() + 1);
      next.setMinutes(0);
    } else {
      next.setMinutes(nextMinute);
    }
  } else if (minute !== "*") {
    next.setMinutes(parseInt(minute, 10));
  }

  // Set hour
  if (hour !== "*") {
    const targetHour = parseInt(hour, 10);
    const targetMinute = minute === "*" ? 0 : parseInt(minute, 10);
    if (next.getHours() > targetHour || (next.getHours() === targetHour && next.getMinutes() >= targetMinute)) {
      next.setDate(next.getDate() + 1);
    }
    next.setHours(targetHour);
  }

  // If still in the past, move forward
  if (next <= fromDate) {
    if (hour === "*" && minute.startsWith("*/")) {
      // Already handled
    } else if (hour === "*") {
      next.setHours(next.getHours() + 1);
    } else {
      next.setDate(next.getDate() + 1);
    }
  }

  next.setSeconds(0);
  next.setMilliseconds(0);

  return next;
}

/**
 * Execute scheduled post automation:
 * 1. Generate content via AI if configured, or use static template
 * 2. Generate/fetch images based on imageGeneration config
 * 3. Create pending_posts record for approval
 */
async function executeScheduledPost(
  env: SchedulerEnv,
  config: ScheduledPostConfig,
  automation: AutomationRow
): Promise<{ postsGenerated: number; pendingPostId: string; title: string }> {
  let title: string;
  let content: string;
  let tags: string[] = [];
  let images: string[] = [];
  let generationMode: 'static' | 'ai_topic' | 'ai_prompt' = 'static';
  let generationPrompt: string | null = null;

  // Step 1: Generate or use static content
  if (config.aiGeneration && (config.aiGeneration.mode === 'ai_topic' || config.aiGeneration.mode === 'ai_prompt')) {
    generationMode = config.aiGeneration.mode;

    if (!env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured for AI content generation');
    }

    const generated = await generateFromConfig(env.GEMINI_API_KEY, config.aiGeneration);

    title = generated.title;
    content = generated.content;
    tags = generated.tags;
    generationPrompt = config.aiGeneration.customPrompt ||
      `Topics: ${config.aiGeneration.topics?.join(', ')}`;

  } else if (config.template) {
    // Static template mode
    title = config.template.title;
    content = config.template.content;
    tags = config.template.tags || [];
    images = config.template.images || [];
  } else {
    throw new Error('No content source configured: need either aiGeneration or template');
  }

  // Step 2: Generate or use provided images
  if (config.imageGeneration) {
    try {
      const imgResult = await generateImages(config.imageGeneration, {
        title,
        content,
        tags,
        apiKey: env.NANO_BANANA_API_KEY,
        unsplashKey: env.UNSPLASH_ACCESS_KEY
      });
      images = imgResult.images;
    } catch (imgError) {
      // Log but don't fail - images are optional for some posts
      console.error('Image generation failed:', imgError);
      // Keep existing images or empty array
    }
  }

  // Step 2.5: Auto-fetch Unsplash images if AI generated content but no images
  if (images.length === 0 && generationMode !== 'static' && env.UNSPLASH_ACCESS_KEY) {
    try {
      console.log('Auto-fetching Unsplash images for AI-generated post...');
      const imgResult = await generateImages(
        { mode: 'unsplash', unsplash: { count: 3, orientation: 'portrait' } },
        {
          title,
          content,
          tags,
          unsplashKey: env.UNSPLASH_ACCESS_KEY
        }
      );
      images = imgResult.images;
      console.log(`Fetched ${images.length} images from Unsplash`);
    } catch (unsplashError) {
      console.error('Unsplash auto-fetch failed:', unsplashError);
      // Continue without images - user will need to add manually in approval
    }
  }

  // Step 3: Create pending post for approval
  const pendingId = `pending_${automation.id}_${Date.now()}`;

  await env.D1.prepare(`
    INSERT INTO pending_posts (
      id, automation_id, user_id, workspace_id,
      title, content, images, tags,
      generation_mode, generation_prompt, generation_model,
      status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `).bind(
    pendingId,
    automation.id,
    automation.user_id,
    automation.workspace_id,
    title,
    content,
    JSON.stringify(images),
    JSON.stringify(tags),
    generationMode,
    generationPrompt,
    generationMode !== 'static' ? 'gemini-2.0-flash-exp' : null
  ).run();

  return {
    postsGenerated: 1,
    pendingPostId: pendingId,
    title
  };
}
