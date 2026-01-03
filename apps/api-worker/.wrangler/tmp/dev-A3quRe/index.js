var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// .wrangler/tmp/bundle-PyUoNl/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// ../../packages/workflow-core/dist/runtime/registry.js
var registry = /* @__PURE__ */ new Map();
function registerNode(type, factory) {
  registry.set(type, factory);
}
__name(registerNode, "registerNode");
function createNode(type) {
  const factory = registry.get(type);
  if (!factory) {
    throw new Error(`Node type not registered: ${type}`);
  }
  return factory();
}
__name(createNode, "createNode");

// ../../packages/shared/dist/time.js
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
__name(nowIso, "nowIso");

// ../../packages/workflow-core/dist/runtime/engine.js
async function executeWorkflow(graph, initialInput, baseCtx) {
  const outputs = {};
  let lastOutput = initialInput;
  for (const nodeDef of graph.nodes) {
    const node = createNode(nodeDef.type);
    const ctx = { ...baseCtx, nodeId: nodeDef.id };
    ctx.trace({ t: "NodeStarted", runId: ctx.runId, nodeId: nodeDef.id, at: nowIso() });
    try {
      const result = await node.run(ctx, lastOutput);
      outputs[nodeDef.id] = result;
      lastOutput = result;
      ctx.trace({ t: "NodeCompleted", runId: ctx.runId, nodeId: nodeDef.id, at: nowIso() });
    } catch (error) {
      ctx.trace({
        t: "NodeCompleted",
        runId: ctx.runId,
        nodeId: nodeDef.id,
        at: nowIso(),
        outputRef: JSON.stringify({ error: error.message })
      });
      throw error;
    }
  }
  return { outputs };
}
__name(executeWorkflow, "executeWorkflow");

// ../../packages/workflow-core/dist/nodes/draft_post.js
var DraftPostNode = class {
  static {
    __name(this, "DraftPostNode");
  }
  type = "draft_post";
  async run(_ctx, input) {
    const topic = input?.topic ?? "update";
    const draft = `Draft: Sharing a quick ${topic} update.`;
    return { draft };
  }
};

// ../../packages/workflow-core/dist/nodes/approve_content.js
var NeedsApprovalError = class extends Error {
  static {
    __name(this, "NeedsApprovalError");
  }
  payload;
  constructor(payload) {
    super("Content requires approval");
    this.payload = payload;
  }
};
var ApproveContentNode = class {
  static {
    __name(this, "ApproveContentNode");
  }
  type = "approve_content";
  async run(_ctx, input) {
    if (!input?.draft) {
      return { approved: true, draft: "" };
    }
    throw new NeedsApprovalError(input);
  }
};

// ../../packages/workflow-core/dist/nodes/policy_gate.js
var PolicyGateNode = class {
  static {
    __name(this, "PolicyGateNode");
  }
  type = "policy_gate";
  async run(ctx, input) {
    ctx.logger.info("Policy gate pass-through", { nodeId: ctx.nodeId });
    return input;
  }
};

// ../../packages/workflow-core/dist/nodes/publish_batch.js
var PublishBatchNode = class {
  static {
    __name(this, "PublishBatchNode");
  }
  type = "publish_batch";
  async run(ctx, input = []) {
    const actions = Array.isArray(input) ? input : [input];
    ctx.logger.info("Publish batch -> dispatch", { count: actions.length });
    return { type: "action_request", actions };
  }
};

// ../../packages/workflow-core/dist/nodes/xhs_search.js
var XhsSearchNode = class {
  static {
    __name(this, "XhsSearchNode");
  }
  type = "xhs_search";
  async run(ctx, input) {
    ctx.logger.info("XHS search", { keyword: input.keyword });
    const action = {
      requestId: `${ctx.runId}_${ctx.nodeId}_${Date.now()}`,
      userId: "system",
      workspaceId: input.workspaceId || "default",
      platform: "xiaohongshu",
      action: "search_feeds",
      mode: "api",
      policyContext: { requiresApproval: false },
      traceContext: { runId: ctx.runId, nodeId: ctx.nodeId },
      payload: {
        keyword: input.keyword,
        page: input.page || 1,
        sortBy: input.sortBy || "general",
        noteType: input.noteType || "all",
        baseUrl: input.baseUrl
      }
    };
    return { type: "action_request", action };
  }
};

// ../../packages/workflow-core/dist/nodes/xhs_like.js
var XhsLikeNode = class {
  static {
    __name(this, "XhsLikeNode");
  }
  type = "xhs_like";
  async run(ctx, input) {
    ctx.logger.info("XHS like", { feedId: input.feedId, like: input.like !== false });
    const action = {
      requestId: `${ctx.runId}_${ctx.nodeId}_${Date.now()}`,
      userId: "system",
      workspaceId: input.workspaceId || "default",
      platform: "xiaohongshu",
      action: "like_post",
      mode: "api",
      policyContext: { requiresApproval: false },
      traceContext: { runId: ctx.runId, nodeId: ctx.nodeId },
      payload: {
        feedId: input.feedId,
        xsecToken: input.xsecToken,
        like: input.like !== false,
        baseUrl: input.baseUrl
      }
    };
    return { type: "action_request", action };
  }
};

// ../../packages/workflow-core/dist/nodes/xhs_comment.js
var XhsCommentNode = class {
  static {
    __name(this, "XhsCommentNode");
  }
  type = "xhs_comment";
  async run(ctx, input) {
    ctx.logger.info("XHS comment", { feedId: input.feedId });
    const action = {
      requestId: `${ctx.runId}_${ctx.nodeId}_${Date.now()}`,
      userId: "system",
      workspaceId: input.workspaceId || "default",
      platform: "xiaohongshu",
      action: "comment_post",
      mode: "api",
      policyContext: { requiresApproval: false },
      traceContext: { runId: ctx.runId, nodeId: ctx.nodeId },
      payload: {
        feedId: input.feedId,
        xsecToken: input.xsecToken,
        content: input.content,
        baseUrl: input.baseUrl
      }
    };
    return { type: "action_request", action };
  }
};

// ../../packages/workflow-core/dist/nodes/xhs_publish.js
var XhsPublishNode = class {
  static {
    __name(this, "XhsPublishNode");
  }
  type = "xhs_publish";
  async run(ctx, input) {
    ctx.logger.info("XHS publish", { title: input.title });
    const action = {
      requestId: `${ctx.runId}_${ctx.nodeId}_${Date.now()}`,
      userId: "system",
      workspaceId: input.workspaceId || "default",
      platform: "xiaohongshu",
      action: "publish_post",
      mode: "api",
      policyContext: { requiresApproval: true },
      traceContext: { runId: ctx.runId, nodeId: ctx.nodeId },
      payload: {
        title: input.title,
        content: input.content,
        images: input.images || [],
        tags: input.tags || [],
        baseUrl: input.baseUrl
      }
    };
    return { type: "action_request", action };
  }
};

// ../../packages/workflow-core/dist/nodes/xhs_get_detail.js
var XhsGetDetailNode = class {
  static {
    __name(this, "XhsGetDetailNode");
  }
  type = "xhs_get_detail";
  async run(ctx, input) {
    ctx.logger.info("XHS get detail", { feedId: input.feedId });
    const action = {
      requestId: `${ctx.runId}_${ctx.nodeId}_${Date.now()}`,
      userId: "system",
      workspaceId: input.workspaceId || "default",
      platform: "xiaohongshu",
      action: "get_feed_detail",
      mode: "api",
      policyContext: { requiresApproval: false },
      traceContext: { runId: ctx.runId, nodeId: ctx.nodeId },
      payload: {
        feedId: input.feedId,
        xsecToken: input.xsecToken,
        loadComments: input.loadComments !== false,
        commentsCount: input.commentsCount || 10,
        baseUrl: input.baseUrl
      }
    };
    return { type: "action_request", action };
  }
};

// ../../packages/workflow-core/dist/nodes/filter_feeds.js
var FilterFeedsNode = class {
  static {
    __name(this, "FilterFeedsNode");
  }
  type = "filter_feeds";
  async run(ctx, input) {
    ctx.logger.info("Filtering feeds", { maxPosts: input.maxPosts });
    let rawFeeds = [];
    if (input.raw?.data?.feeds) {
      rawFeeds = input.raw.data.feeds;
    } else if (input.feeds) {
      rawFeeds = input.feeds;
    }
    const normalizedFeeds = rawFeeds.filter((f) => f.id && (f.xsecToken || f.xsec_token)).map((f) => ({
      id: f.id,
      xsecToken: f.xsecToken || f.xsec_token,
      title: f.noteCard?.displayTitle || f.title || "",
      author: f.noteCard?.user?.nickname || f.author || "Unknown",
      authorId: f.noteCard?.user?.userId || f.userId || "",
      likes: parseInt(f.noteCard?.interactInfo?.likedCount || f.likedCount || f.likes || "0", 10)
    }));
    const total = normalizedFeeds.length;
    let filtered = normalizedFeeds.filter((feed) => {
      if (!feed.title)
        return false;
      if (input.minLikes !== void 0 && feed.likes < input.minLikes) {
        return false;
      }
      if (input.maxLikes !== void 0 && feed.likes > input.maxLikes) {
        return false;
      }
      if (input.skipAuthors && input.skipAuthors.includes(feed.authorId)) {
        return false;
      }
      return true;
    });
    const maxPosts = input.maxPosts || 5;
    filtered = filtered.slice(0, maxPosts);
    ctx.logger.info("Filtered feeds", { total, filtered: filtered.length });
    return {
      feeds: filtered,
      filtered: filtered.length,
      total
    };
  }
};

// ../../packages/workflow-core/dist/nodes/batch_engage.js
var BatchEngageNode = class {
  static {
    __name(this, "BatchEngageNode");
  }
  type = "batch_engage";
  async run(ctx, input) {
    const feeds = input.feeds || [];
    const actions = [];
    let likeActions = 0;
    let commentActions = 0;
    ctx.logger.info("Batch engage", {
      feedCount: feeds.length,
      like: input.like,
      comment: input.comment
    });
    for (let i = 0; i < feeds.length; i++) {
      const feed = feeds[i];
      const timestamp = Date.now() + i;
      if (input.like !== false) {
        actions.push({
          requestId: `${ctx.runId}_like_${feed.id}_${timestamp}`,
          userId: input.userId || "system",
          workspaceId: input.workspaceId || "default",
          platform: "xiaohongshu",
          action: "like_post",
          mode: "api",
          policyContext: { requiresApproval: false },
          traceContext: { runId: ctx.runId, nodeId: ctx.nodeId },
          payload: {
            feedId: feed.id,
            xsecToken: feed.xsecToken,
            like: true,
            baseUrl: input.baseUrl
          }
        });
        likeActions++;
      }
      if (input.comment !== false) {
        const comment = await this.generateComment(input, feed, ctx);
        if (comment) {
          actions.push({
            requestId: `${ctx.runId}_comment_${feed.id}_${timestamp}`,
            userId: input.userId || "system",
            workspaceId: input.workspaceId || "default",
            platform: "xiaohongshu",
            action: "comment_post",
            mode: "api",
            policyContext: { requiresApproval: false },
            traceContext: { runId: ctx.runId, nodeId: ctx.nodeId },
            payload: {
              feedId: feed.id,
              xsecToken: feed.xsecToken,
              content: comment,
              baseUrl: input.baseUrl
            }
          });
          commentActions++;
        }
      }
    }
    ctx.logger.info("Batch engage complete", {
      totalActions: actions.length,
      likeActions,
      commentActions
    });
    return {
      type: "action_batch",
      actions,
      summary: {
        totalFeeds: feeds.length,
        likeActions,
        commentActions
      }
    };
  }
  /**
   * Generate a comment based on the configured mode
   */
  async generateComment(input, feed, ctx) {
    const mode = input.commentMode || "template";
    const templates = input.commentTemplates || [];
    const defaultTemplates = [
      "\u5F88\u68D2\u7684\u5206\u4EAB\uFF01",
      "\u5B66\u5230\u4E86\uFF0C\u8C22\u8C22\u5206\u4EAB",
      "\u8BF4\u5F97\u592A\u597D\u4E86",
      "\u6536\u85CF\u4E86\uFF0C\u611F\u8C22",
      "\u5F88\u6709\u5E2E\u52A9\u7684\u5185\u5BB9",
      "\u8FD9\u4E2A\u5185\u5BB9\u5F88\u5B9E\u7528",
      "\u611F\u8C22\u535A\u4E3B\u5206\u4EAB",
      "\u5F88\u6709\u542F\u53D1"
    ];
    const allTemplates = templates.length > 0 ? templates : defaultTemplates;
    if (mode === "template") {
      return allTemplates[Math.floor(Math.random() * allTemplates.length)];
    }
    if (mode === "ai") {
      ctx.logger.info("AI comment generation not yet implemented, using template");
      return allTemplates[Math.floor(Math.random() * allTemplates.length)];
    }
    if (mode === "both") {
      if (Math.random() < 0.5) {
        return allTemplates[Math.floor(Math.random() * allTemplates.length)];
      } else {
        return allTemplates[Math.floor(Math.random() * allTemplates.length)];
      }
    }
    return null;
  }
};

// ../../packages/workflow-core/dist/register.js
function registerBuiltinNodes() {
  registerNode("draft_post", () => new DraftPostNode());
  registerNode("approve_content", () => new ApproveContentNode());
  registerNode("policy_gate", () => new PolicyGateNode());
  registerNode("publish_batch", () => new PublishBatchNode());
  registerNode("xhs_search", () => new XhsSearchNode());
  registerNode("xhs_like", () => new XhsLikeNode());
  registerNode("xhs_comment", () => new XhsCommentNode());
  registerNode("xhs_publish", () => new XhsPublishNode());
  registerNode("xhs_get_detail", () => new XhsGetDetailNode());
  registerNode("filter_feeds", () => new FilterFeedsNode());
  registerNode("batch_engage", () => new BatchEngageNode());
}
__name(registerBuiltinNodes, "registerBuiltinNodes");

// ../../packages/observability/dist/logger.js
function log(level, msg, meta) {
  const payload = meta ? `${msg} ${JSON.stringify(meta)}` : msg;
  switch (level) {
    case "debug":
    case "info":
      console.log(payload);
      break;
    case "warn":
      console.warn(payload);
      break;
    case "error":
      console.error(payload);
      break;
  }
}
__name(log, "log");
function createLogger(namespace) {
  const prefix = `[${namespace}]`;
  return {
    debug: /* @__PURE__ */ __name((msg, meta) => log("debug", `${prefix} ${msg}`, meta), "debug"),
    info: /* @__PURE__ */ __name((msg, meta) => log("info", `${prefix} ${msg}`, meta), "info"),
    warn: /* @__PURE__ */ __name((msg, meta) => log("warn", `${prefix} ${msg}`, meta), "warn"),
    error: /* @__PURE__ */ __name((msg, meta) => log("error", `${prefix} ${msg}`, meta), "error")
  };
}
__name(createLogger, "createLogger");

// src/db/d1.ts
async function saveRun(env, run) {
  if (!env.D1) return;
  const traceJson = JSON.stringify(run.trace ?? []);
  const outputsJson = run.outputs ? JSON.stringify(run.outputs) : null;
  const pendingJson = run.pendingApproval ? JSON.stringify(run.pendingApproval) : null;
  await env.D1.prepare(
    `INSERT OR REPLACE INTO runs (id, status, graph, input, outputs, trace, pending_approval, error, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM runs WHERE id = ?), datetime('now')))`
  ).bind(
    run.id,
    run.status,
    JSON.stringify(run.graph ?? {}),
    JSON.stringify(run.input ?? {}),
    outputsJson,
    traceJson,
    pendingJson,
    run.error ?? null,
    run.id
  ).run();
}
__name(saveRun, "saveRun");
async function getRun(env, runId) {
  if (!env.D1) return void 0;
  const row = await env.D1.prepare("SELECT * FROM runs WHERE id = ?").bind(runId).first();
  if (!row) return void 0;
  return {
    id: row.id,
    status: row.status,
    graph: JSON.parse(row.graph),
    input: JSON.parse(row.input),
    outputs: row.outputs ? JSON.parse(row.outputs) : void 0,
    trace: row.trace ? JSON.parse(row.trace) : [],
    pendingApproval: row.pending_approval ? JSON.parse(row.pending_approval) : void 0,
    error: row.error ?? void 0
  };
}
__name(getRun, "getRun");
async function savePendingAction(env, action) {
  if (!env.D1) return;
  await env.D1.prepare(
    `INSERT OR REPLACE INTO pending_actions (request_id, user_id, action_json, created_at)
     VALUES (?, ?, ?, COALESCE((SELECT created_at FROM pending_actions WHERE request_id = ?), datetime('now')))`
  ).bind(action.requestId, action.userId, JSON.stringify(action), action.requestId).run();
}
__name(savePendingAction, "savePendingAction");
async function popPendingAction(env, userId) {
  if (!env.D1) return void 0;
  const row = await env.D1.prepare("SELECT * FROM pending_actions WHERE user_id = ? LIMIT 1").bind(userId).first();
  if (!row) return void 0;
  await env.D1.prepare("DELETE FROM pending_actions WHERE request_id = ?").bind(row.request_id).run();
  return JSON.parse(row.action_json);
}
__name(popPendingAction, "popPendingAction");
async function getPendingAction(env, requestId) {
  if (!env.D1) return void 0;
  const row = await env.D1.prepare("SELECT * FROM pending_actions WHERE request_id = ?").bind(requestId).first();
  if (!row) return void 0;
  return JSON.parse(row.action_json);
}
__name(getPendingAction, "getPendingAction");
async function saveActionResult(env, record) {
  if (!env.D1) return;
  await env.D1.prepare(
    `INSERT OR REPLACE INTO action_results (request_id, result_json, created_at)
     VALUES (?, ?, COALESCE((SELECT created_at FROM action_results WHERE request_id = ?), datetime('now')))`
  ).bind(record.requestId, JSON.stringify(record.result), record.requestId).run();
}
__name(saveActionResult, "saveActionResult");
async function getActionResult(env, requestId) {
  if (!env.D1) return void 0;
  const row = await env.D1.prepare("SELECT * FROM action_results WHERE request_id = ?").bind(requestId).first();
  if (!row) return void 0;
  return { requestId: row.request_id, result: JSON.parse(row.result_json) };
}
__name(getActionResult, "getActionResult");

// ../../packages/adapters/dist/linkedin/capabilities.js
function linkedinCapabilities() {
  return {
    supportsApi: false,
    supportsCloudBrowser: true,
    supportsExtensionBrowser: true,
    actions: {
      publish_post: { modes: ["extension_browser", "cloud_browser"] },
      send_dm: { modes: ["extension_browser"] }
    }
  };
}
__name(linkedinCapabilities, "linkedinCapabilities");

// ../../packages/adapters/dist/linkedin/steps/send_dm.v1.json
var send_dm_v1_default = {
  platform: "linkedin",
  steps: [
    { type: "goto", url: "https://example.com" },
    { type: "waitFor", selector: "body" },
    { type: "type", selector: "body", text: "{{message}}" }
  ]
};

// ../../packages/adapters/dist/linkedin/steps/publish_post_text.v1.json
var publish_post_text_v1_default = {
  platform: "linkedin",
  steps: [
    { type: "goto", url: "https://example.com" },
    { type: "waitFor", selector: "body" },
    { type: "type", selector: "body", text: "{{text}}" }
  ]
};

// ../../packages/adapters/dist/linkedin/index.js
var linkedinAdapter = {
  platform: "linkedin",
  capabilities: linkedinCapabilities,
  async buildAction(req) {
    if (req.action === "send_dm") {
      return { extensionSteps: send_dm_v1_default };
    }
    if (req.action === "publish_post") {
      return { extensionSteps: publish_post_text_v1_default };
    }
    return {};
  }
};

// ../../packages/adapters/dist/x/capabilities.js
function xCapabilities() {
  return {
    supportsApi: false,
    supportsCloudBrowser: true,
    supportsExtensionBrowser: true,
    actions: {
      publish_post: { modes: ["cloud_browser", "extension_browser"] }
    }
  };
}
__name(xCapabilities, "xCapabilities");

// ../../packages/adapters/dist/x/steps/publish_post_text.v1.json
var publish_post_text_v1_default2 = {
  platform: "x",
  steps: [
    { type: "goto", url: "https://example.com" },
    { type: "waitFor", selector: "body" },
    { type: "type", selector: "body", text: "{{text}}" }
  ]
};

// ../../packages/adapters/dist/x/index.js
var xAdapter = {
  platform: "x",
  capabilities: xCapabilities,
  async buildAction(req) {
    if (req.action === "publish_post") {
      return { extensionSteps: publish_post_text_v1_default2 };
    }
    return {};
  }
};

// ../../packages/adapters/dist/xiaohongshu/capabilities.js
function xiaohongshuCapabilities() {
  return {
    // Xiaohongshu uses HTTP API via xiaohongshu-mcp server
    supportsApi: true,
    supportsCloudBrowser: false,
    supportsExtensionBrowser: false,
    actions: {
      publish_post: { modes: ["api"] },
      publish_video: { modes: ["api"] },
      like_post: { modes: ["api"] },
      comment_post: { modes: ["api"] },
      search_feeds: { modes: ["api"] },
      get_feed_detail: { modes: ["api"] },
      resolve_profile: { modes: ["api"] }
    }
  };
}
__name(xiaohongshuCapabilities, "xiaohongshuCapabilities");

// ../../packages/adapters/dist/xiaohongshu/index.js
var DEFAULT_baseUrl = "http://localhost:18060";
var xiaohongshuAdapter = {
  platform: "xiaohongshu",
  capabilities: xiaohongshuCapabilities,
  async buildAction(req) {
    const payload = req.payload;
    const baseUrl = payload.baseUrl || DEFAULT_baseUrl;
    switch (req.action) {
      case "publish_post":
        return {
          apiCall: {
            endpoint: `${baseUrl}/api/v1/publish`,
            method: "POST",
            body: {
              title: payload.title,
              content: payload.content,
              images: payload.images || [],
              tags: payload.tags || []
            }
          }
        };
      case "publish_video":
        return {
          apiCall: {
            endpoint: `${baseUrl}/api/v1/publish_video`,
            method: "POST",
            body: {
              title: payload.title,
              content: payload.content,
              video_path: payload.videoPath,
              tags: payload.tags || []
            }
          }
        };
      case "like_post":
        return {
          apiCall: {
            endpoint: `${baseUrl}/api/v1/feeds/like`,
            method: "POST",
            body: {
              feed_id: payload.feedId,
              xsec_token: payload.xsecToken,
              like: payload.like !== false
              // default to true
            }
          }
        };
      case "comment_post":
        return {
          apiCall: {
            endpoint: `${baseUrl}/api/v1/feeds/comment`,
            method: "POST",
            body: {
              feed_id: payload.feedId,
              xsec_token: payload.xsecToken,
              content: payload.content
            }
          }
        };
      case "search_feeds":
        return {
          apiCall: {
            endpoint: `${baseUrl}/api/v1/feeds/search`,
            method: "POST",
            body: {
              keyword: payload.keyword,
              page: payload.page || 1,
              sort_by: payload.sortBy || "general",
              // general, time_descending, popularity_descending
              note_type: payload.noteType || "all"
              // all, video, image
            }
          }
        };
      case "get_feed_detail":
        return {
          apiCall: {
            endpoint: `${baseUrl}/api/v1/feeds/detail`,
            method: "POST",
            body: {
              feed_id: payload.feedId,
              xsec_token: payload.xsecToken,
              load_comments: payload.loadComments !== false,
              comments_count: payload.commentsCount || 10
            }
          }
        };
      case "resolve_profile":
        return {
          apiCall: {
            endpoint: `${baseUrl}/api/v1/user/profile`,
            method: "POST",
            body: {
              user_id: payload.userId
            }
          }
        };
      default:
        return {};
    }
  }
};

// ../../packages/adapters/dist/registry.js
var adapters = {
  linkedin: linkedinAdapter,
  x: xAdapter,
  xiaohongshu: xiaohongshuAdapter
};
function getAdapter(platform) {
  const adapter = adapters[platform];
  if (!adapter) {
    throw new Error(`Adapter not found for platform ${platform}`);
  }
  return adapter;
}
__name(getAdapter, "getAdapter");

// ../../packages/executors/dist/errors.js
var ExecutorError = class extends Error {
  static {
    __name(this, "ExecutorError");
  }
  retriable;
  constructor(message, retriable = false) {
    super(message);
    this.retriable = retriable;
  }
};

// ../../packages/executors/dist/api_executor.js
async function executeViaApi(req) {
  const adapter = getAdapter(req.platform);
  const actionSpec = await adapter.buildAction(req);
  if (!actionSpec.apiCall) {
    throw new ExecutorError(`No API call spec for ${req.platform}/${req.action}`, false);
  }
  const { endpoint, method, body, headers } = actionSpec.apiCall;
  try {
    const response = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers
      },
      body: body ? JSON.stringify(body) : void 0
    });
    const responseData = await response.json();
    if (responseData.success === false) {
      return {
        ok: false,
        error: {
          type: "api_error",
          message: String(responseData.message || "API call failed"),
          retriable: response.status >= 500
        }
      };
    }
    const data = responseData.data;
    return {
      ok: true,
      platformPostId: data?.id,
      raw: responseData
    };
  } catch (err) {
    const isNetworkError = err instanceof TypeError && err.message.includes("fetch");
    throw new ExecutorError(
      `API call failed: ${err instanceof Error ? err.message : String(err)}`,
      isNetworkError
      // Network errors are retriable
    );
  }
}
__name(executeViaApi, "executeViaApi");
async function checkXiaohongshuStatus(baseUrl = "http://localhost:18060") {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3e4);
    const loginResp = await fetch(`${baseUrl}/api/v1/login/status`, {
      signal: controller.signal,
      headers: { "User-Agent": "social-agent/1.0" }
    });
    clearTimeout(timeoutId);
    if (!loginResp.ok) {
      return { available: false, loggedIn: false, message: `Server error: ${loginResp.status}` };
    }
    const loginData = await loginResp.json();
    const data = loginData.data;
    return {
      available: true,
      // Fix: API returns is_logged_in, not logged_in
      loggedIn: loginData.success === true && data?.is_logged_in === true,
      message: loginData.success ? "OK" : String(loginData.message || "Unknown status")
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { available: false, loggedIn: false, message: "Request timed out (30s)" };
    }
    return {
      available: false,
      loggedIn: false,
      message: `Connection failed: ${err instanceof Error ? err.message : String(err)}`
    };
  }
}
__name(checkXiaohongshuStatus, "checkXiaohongshuStatus");

// src/routes/xiaohongshu.ts
var defaultPolicyContext = { requiresApproval: false };
var defaultTraceContext = { runId: "api-direct", nodeId: "xhs-route" };
async function handleXiaohongshu(request, url, env) {
  const path = url.pathname;
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders()
    });
  }
  if (request.method === "GET" && path === "/xhs/login/qrcode") {
    const baseUrl = url.searchParams.get("baseUrl") || env.XHS_MCP_BASE;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12e4);
      const resp = await fetch(`${baseUrl}/api/v1/login/qrcode`, {
        signal: controller.signal,
        headers: { "User-Agent": "social-agent-api/1.0" }
      });
      clearTimeout(timeoutId);
      const text = await resp.text();
      try {
        const data = JSON.parse(text);
        return jsonWithCors(data);
      } catch {
        return jsonWithCors({
          success: false,
          message: `Invalid response from server: ${text.slice(0, 100)}`
        }, 500);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return jsonWithCors({
          success: false,
          message: "QR code request timed out. The server may be starting up, please try again."
        }, 504);
      }
      return jsonWithCors({
        success: false,
        message: `Failed to get QR code: ${err instanceof Error ? err.message : String(err)}`
      }, 500);
    }
  }
  if (request.method === "GET" && path === "/xhs/login/status") {
    const baseUrl = url.searchParams.get("baseUrl") || env.XHS_MCP_BASE;
    try {
      const resp = await fetch(`${baseUrl}/api/v1/login/status`, {
        headers: { "User-Agent": "social-agent-api/1.0" }
      });
      const text = await resp.text();
      try {
        const data = JSON.parse(text);
        return jsonWithCors(data);
      } catch {
        return jsonWithCors({
          success: false,
          message: `Invalid response from server: ${text.slice(0, 100)}`
        }, 500);
      }
    } catch (err) {
      return jsonWithCors({
        success: false,
        message: `Failed to check login status: ${err instanceof Error ? err.message : String(err)}`
      }, 500);
    }
  }
  if (request.method === "GET" && path === "/xhs/status") {
    const baseUrl = url.searchParams.get("baseUrl") || env.XHS_MCP_BASE;
    const status = await checkXiaohongshuStatus(baseUrl);
    return jsonWithCors(status);
  }
  if (request.method === "POST" && path === "/xhs/search") {
    const body = await request.json();
    const result = await executeViaApi({
      requestId: `xhs_search_${Date.now()}`,
      userId: "api",
      workspaceId: body.workspaceId || "default",
      platform: "xiaohongshu",
      action: "search_feeds",
      mode: "api",
      policyContext: defaultPolicyContext,
      traceContext: defaultTraceContext,
      payload: {
        keyword: body.keyword,
        page: body.page,
        sortBy: body.sortBy,
        noteType: body.noteType,
        baseUrl: body.baseUrl || env.XHS_MCP_BASE
      }
    });
    return jsonWithCors(result);
  }
  if (request.method === "POST" && path === "/xhs/detail") {
    const body = await request.json();
    const result = await executeViaApi({
      requestId: `xhs_detail_${Date.now()}`,
      userId: "api",
      workspaceId: body.workspaceId || "default",
      platform: "xiaohongshu",
      action: "get_feed_detail",
      mode: "api",
      policyContext: defaultPolicyContext,
      traceContext: defaultTraceContext,
      payload: {
        feedId: body.feedId,
        xsecToken: body.xsecToken,
        loadComments: body.loadComments,
        commentsCount: body.commentsCount,
        baseUrl: body.baseUrl || env.XHS_MCP_BASE
      }
    });
    return jsonWithCors(result);
  }
  if (request.method === "POST" && path === "/xhs/like") {
    const body = await request.json();
    const result = await executeViaApi({
      requestId: `xhs_like_${Date.now()}`,
      userId: "api",
      workspaceId: body.workspaceId || "default",
      platform: "xiaohongshu",
      action: "like_post",
      mode: "api",
      policyContext: defaultPolicyContext,
      traceContext: defaultTraceContext,
      payload: {
        feedId: body.feedId,
        xsecToken: body.xsecToken,
        like: body.like,
        baseUrl: body.baseUrl || env.XHS_MCP_BASE
      }
    });
    return jsonWithCors(result);
  }
  if (request.method === "POST" && path === "/xhs/comment") {
    const body = await request.json();
    const result = await executeViaApi({
      requestId: `xhs_comment_${Date.now()}`,
      userId: "api",
      workspaceId: body.workspaceId || "default",
      platform: "xiaohongshu",
      action: "comment_post",
      mode: "api",
      policyContext: defaultPolicyContext,
      traceContext: defaultTraceContext,
      payload: {
        feedId: body.feedId,
        xsecToken: body.xsecToken,
        content: body.content,
        baseUrl: body.baseUrl || env.XHS_MCP_BASE
      }
    });
    return jsonWithCors(result);
  }
  if (request.method === "POST" && path === "/xhs/publish") {
    const body = await request.json();
    const result = await executeViaApi({
      requestId: `xhs_publish_${Date.now()}`,
      userId: "api",
      workspaceId: body.workspaceId || "default",
      platform: "xiaohongshu",
      action: "publish_post",
      mode: "api",
      policyContext: { requiresApproval: true },
      traceContext: defaultTraceContext,
      payload: {
        title: body.title,
        content: body.content,
        images: body.images,
        tags: body.tags,
        baseUrl: body.baseUrl || env.XHS_MCP_BASE
      }
    });
    return jsonWithCors(result);
  }
  if (request.method === "POST" && path === "/xhs/publish-video") {
    const body = await request.json();
    const baseUrl = body.baseUrl || env.XHS_MCP_BASE;
    try {
      const resp = await fetch(`${baseUrl}/api/v1/publish_video`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "social-agent-api/1.0"
        },
        body: JSON.stringify({
          title: body.title,
          content: body.content,
          video: body.videoUrl || body.videoPath,
          // Support both URL and path
          tags: body.tags
        })
      });
      const data = await resp.json();
      return jsonWithCors({
        ok: data.success,
        raw: data
      });
    } catch (err) {
      return jsonWithCors({
        ok: false,
        error: `Failed to publish video: ${err instanceof Error ? err.message : String(err)}`
      }, 500);
    }
  }
  if (request.method === "POST" && path === "/xhs/profile") {
    const body = await request.json();
    const result = await executeViaApi({
      requestId: `xhs_profile_${Date.now()}`,
      userId: "api",
      workspaceId: body.workspaceId || "default",
      platform: "xiaohongshu",
      action: "resolve_profile",
      mode: "api",
      policyContext: defaultPolicyContext,
      traceContext: defaultTraceContext,
      payload: {
        userId: body.userId,
        baseUrl: body.baseUrl || env.XHS_MCP_BASE
      }
    });
    return jsonWithCors(result);
  }
  return null;
}
__name(handleXiaohongshu, "handleXiaohongshu");
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}
__name(corsHeaders, "corsHeaders");
function jsonWithCors(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
      ...corsHeaders()
    }
  });
}
__name(jsonWithCors, "jsonWithCors");

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/external.js
var external_exports = {};
__export(external_exports, {
  BRAND: () => BRAND,
  DIRTY: () => DIRTY,
  EMPTY_PATH: () => EMPTY_PATH,
  INVALID: () => INVALID,
  NEVER: () => NEVER,
  OK: () => OK,
  ParseStatus: () => ParseStatus,
  Schema: () => ZodType,
  ZodAny: () => ZodAny,
  ZodArray: () => ZodArray,
  ZodBigInt: () => ZodBigInt,
  ZodBoolean: () => ZodBoolean,
  ZodBranded: () => ZodBranded,
  ZodCatch: () => ZodCatch,
  ZodDate: () => ZodDate,
  ZodDefault: () => ZodDefault,
  ZodDiscriminatedUnion: () => ZodDiscriminatedUnion,
  ZodEffects: () => ZodEffects,
  ZodEnum: () => ZodEnum,
  ZodError: () => ZodError,
  ZodFirstPartyTypeKind: () => ZodFirstPartyTypeKind,
  ZodFunction: () => ZodFunction,
  ZodIntersection: () => ZodIntersection,
  ZodIssueCode: () => ZodIssueCode,
  ZodLazy: () => ZodLazy,
  ZodLiteral: () => ZodLiteral,
  ZodMap: () => ZodMap,
  ZodNaN: () => ZodNaN,
  ZodNativeEnum: () => ZodNativeEnum,
  ZodNever: () => ZodNever,
  ZodNull: () => ZodNull,
  ZodNullable: () => ZodNullable,
  ZodNumber: () => ZodNumber,
  ZodObject: () => ZodObject,
  ZodOptional: () => ZodOptional,
  ZodParsedType: () => ZodParsedType,
  ZodPipeline: () => ZodPipeline,
  ZodPromise: () => ZodPromise,
  ZodReadonly: () => ZodReadonly,
  ZodRecord: () => ZodRecord,
  ZodSchema: () => ZodType,
  ZodSet: () => ZodSet,
  ZodString: () => ZodString,
  ZodSymbol: () => ZodSymbol,
  ZodTransformer: () => ZodEffects,
  ZodTuple: () => ZodTuple,
  ZodType: () => ZodType,
  ZodUndefined: () => ZodUndefined,
  ZodUnion: () => ZodUnion,
  ZodUnknown: () => ZodUnknown,
  ZodVoid: () => ZodVoid,
  addIssueToContext: () => addIssueToContext,
  any: () => anyType,
  array: () => arrayType,
  bigint: () => bigIntType,
  boolean: () => booleanType,
  coerce: () => coerce,
  custom: () => custom,
  date: () => dateType,
  datetimeRegex: () => datetimeRegex,
  defaultErrorMap: () => en_default,
  discriminatedUnion: () => discriminatedUnionType,
  effect: () => effectsType,
  enum: () => enumType,
  function: () => functionType,
  getErrorMap: () => getErrorMap,
  getParsedType: () => getParsedType,
  instanceof: () => instanceOfType,
  intersection: () => intersectionType,
  isAborted: () => isAborted,
  isAsync: () => isAsync,
  isDirty: () => isDirty,
  isValid: () => isValid,
  late: () => late,
  lazy: () => lazyType,
  literal: () => literalType,
  makeIssue: () => makeIssue,
  map: () => mapType,
  nan: () => nanType,
  nativeEnum: () => nativeEnumType,
  never: () => neverType,
  null: () => nullType,
  nullable: () => nullableType,
  number: () => numberType,
  object: () => objectType,
  objectUtil: () => objectUtil,
  oboolean: () => oboolean,
  onumber: () => onumber,
  optional: () => optionalType,
  ostring: () => ostring,
  pipeline: () => pipelineType,
  preprocess: () => preprocessType,
  promise: () => promiseType,
  quotelessJson: () => quotelessJson,
  record: () => recordType,
  set: () => setType,
  setErrorMap: () => setErrorMap,
  strictObject: () => strictObjectType,
  string: () => stringType,
  symbol: () => symbolType,
  transformer: () => effectsType,
  tuple: () => tupleType,
  undefined: () => undefinedType,
  union: () => unionType,
  unknown: () => unknownType,
  util: () => util,
  void: () => voidType
});

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/util.js
var util;
(function(util2) {
  util2.assertEqual = (_) => {
  };
  function assertIs(_arg) {
  }
  __name(assertIs, "assertIs");
  util2.assertIs = assertIs;
  function assertNever(_x) {
    throw new Error();
  }
  __name(assertNever, "assertNever");
  util2.assertNever = assertNever;
  util2.arrayToEnum = (items) => {
    const obj = {};
    for (const item of items) {
      obj[item] = item;
    }
    return obj;
  };
  util2.getValidEnumValues = (obj) => {
    const validKeys = util2.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
    const filtered = {};
    for (const k of validKeys) {
      filtered[k] = obj[k];
    }
    return util2.objectValues(filtered);
  };
  util2.objectValues = (obj) => {
    return util2.objectKeys(obj).map(function(e) {
      return obj[e];
    });
  };
  util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
    const keys = [];
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        keys.push(key);
      }
    }
    return keys;
  };
  util2.find = (arr, checker) => {
    for (const item of arr) {
      if (checker(item))
        return item;
    }
    return void 0;
  };
  util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
  function joinValues(array, separator = " | ") {
    return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
  }
  __name(joinValues, "joinValues");
  util2.joinValues = joinValues;
  util2.jsonStringifyReplacer = (_, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  };
})(util || (util = {}));
var objectUtil;
(function(objectUtil2) {
  objectUtil2.mergeShapes = (first, second) => {
    return {
      ...first,
      ...second
      // second overwrites first
    };
  };
})(objectUtil || (objectUtil = {}));
var ZodParsedType = util.arrayToEnum([
  "string",
  "nan",
  "number",
  "integer",
  "float",
  "boolean",
  "date",
  "bigint",
  "symbol",
  "function",
  "undefined",
  "null",
  "array",
  "object",
  "unknown",
  "promise",
  "void",
  "never",
  "map",
  "set"
]);
var getParsedType = /* @__PURE__ */ __name((data) => {
  const t = typeof data;
  switch (t) {
    case "undefined":
      return ZodParsedType.undefined;
    case "string":
      return ZodParsedType.string;
    case "number":
      return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
    case "boolean":
      return ZodParsedType.boolean;
    case "function":
      return ZodParsedType.function;
    case "bigint":
      return ZodParsedType.bigint;
    case "symbol":
      return ZodParsedType.symbol;
    case "object":
      if (Array.isArray(data)) {
        return ZodParsedType.array;
      }
      if (data === null) {
        return ZodParsedType.null;
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return ZodParsedType.promise;
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return ZodParsedType.map;
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return ZodParsedType.set;
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return ZodParsedType.date;
      }
      return ZodParsedType.object;
    default:
      return ZodParsedType.unknown;
  }
}, "getParsedType");

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/ZodError.js
var ZodIssueCode = util.arrayToEnum([
  "invalid_type",
  "invalid_literal",
  "custom",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_enum_value",
  "unrecognized_keys",
  "invalid_arguments",
  "invalid_return_type",
  "invalid_date",
  "invalid_string",
  "too_small",
  "too_big",
  "invalid_intersection_types",
  "not_multiple_of",
  "not_finite"
]);
var quotelessJson = /* @__PURE__ */ __name((obj) => {
  const json2 = JSON.stringify(obj, null, 2);
  return json2.replace(/"([^"]+)":/g, "$1:");
}, "quotelessJson");
var ZodError = class _ZodError extends Error {
  static {
    __name(this, "ZodError");
  }
  get errors() {
    return this.issues;
  }
  constructor(issues) {
    super();
    this.issues = [];
    this.addIssue = (sub) => {
      this.issues = [...this.issues, sub];
    };
    this.addIssues = (subs = []) => {
      this.issues = [...this.issues, ...subs];
    };
    const actualProto = new.target.prototype;
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }
    this.name = "ZodError";
    this.issues = issues;
  }
  format(_mapper) {
    const mapper = _mapper || function(issue) {
      return issue.message;
    };
    const fieldErrors = { _errors: [] };
    const processError = /* @__PURE__ */ __name((error) => {
      for (const issue of error.issues) {
        if (issue.code === "invalid_union") {
          issue.unionErrors.map(processError);
        } else if (issue.code === "invalid_return_type") {
          processError(issue.returnTypeError);
        } else if (issue.code === "invalid_arguments") {
          processError(issue.argumentsError);
        } else if (issue.path.length === 0) {
          fieldErrors._errors.push(mapper(issue));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < issue.path.length) {
            const el = issue.path[i];
            const terminal = i === issue.path.length - 1;
            if (!terminal) {
              curr[el] = curr[el] || { _errors: [] };
            } else {
              curr[el] = curr[el] || { _errors: [] };
              curr[el]._errors.push(mapper(issue));
            }
            curr = curr[el];
            i++;
          }
        }
      }
    }, "processError");
    processError(this);
    return fieldErrors;
  }
  static assert(value) {
    if (!(value instanceof _ZodError)) {
      throw new Error(`Not a ZodError: ${value}`);
    }
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(mapper = (issue) => issue.message) {
    const fieldErrors = {};
    const formErrors = [];
    for (const sub of this.issues) {
      if (sub.path.length > 0) {
        const firstEl = sub.path[0];
        fieldErrors[firstEl] = fieldErrors[firstEl] || [];
        fieldErrors[firstEl].push(mapper(sub));
      } else {
        formErrors.push(mapper(sub));
      }
    }
    return { formErrors, fieldErrors };
  }
  get formErrors() {
    return this.flatten();
  }
};
ZodError.create = (issues) => {
  const error = new ZodError(issues);
  return error;
};

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/locales/en.js
var errorMap = /* @__PURE__ */ __name((issue, _ctx) => {
  let message;
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === ZodParsedType.undefined) {
        message = "Required";
      } else {
        message = `Expected ${issue.expected}, received ${issue.received}`;
      }
      break;
    case ZodIssueCode.invalid_literal:
      message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
      break;
    case ZodIssueCode.unrecognized_keys:
      message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
      break;
    case ZodIssueCode.invalid_union:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_union_discriminator:
      message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
      break;
    case ZodIssueCode.invalid_enum_value:
      message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
      break;
    case ZodIssueCode.invalid_arguments:
      message = `Invalid function arguments`;
      break;
    case ZodIssueCode.invalid_return_type:
      message = `Invalid function return type`;
      break;
    case ZodIssueCode.invalid_date:
      message = `Invalid date`;
      break;
    case ZodIssueCode.invalid_string:
      if (typeof issue.validation === "object") {
        if ("includes" in issue.validation) {
          message = `Invalid input: must include "${issue.validation.includes}"`;
          if (typeof issue.validation.position === "number") {
            message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
          }
        } else if ("startsWith" in issue.validation) {
          message = `Invalid input: must start with "${issue.validation.startsWith}"`;
        } else if ("endsWith" in issue.validation) {
          message = `Invalid input: must end with "${issue.validation.endsWith}"`;
        } else {
          util.assertNever(issue.validation);
        }
      } else if (issue.validation !== "regex") {
        message = `Invalid ${issue.validation}`;
      } else {
        message = "Invalid";
      }
      break;
    case ZodIssueCode.too_small:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "bigint")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.too_big:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "bigint")
        message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.custom:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_intersection_types:
      message = `Intersection results could not be merged`;
      break;
    case ZodIssueCode.not_multiple_of:
      message = `Number must be a multiple of ${issue.multipleOf}`;
      break;
    case ZodIssueCode.not_finite:
      message = "Number must be finite";
      break;
    default:
      message = _ctx.defaultError;
      util.assertNever(issue);
  }
  return { message };
}, "errorMap");
var en_default = errorMap;

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/errors.js
var overrideErrorMap = en_default;
function setErrorMap(map) {
  overrideErrorMap = map;
}
__name(setErrorMap, "setErrorMap");
function getErrorMap() {
  return overrideErrorMap;
}
__name(getErrorMap, "getErrorMap");

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/parseUtil.js
var makeIssue = /* @__PURE__ */ __name((params) => {
  const { data, path, errorMaps, issueData } = params;
  const fullPath = [...path, ...issueData.path || []];
  const fullIssue = {
    ...issueData,
    path: fullPath
  };
  if (issueData.message !== void 0) {
    return {
      ...issueData,
      path: fullPath,
      message: issueData.message
    };
  }
  let errorMessage = "";
  const maps = errorMaps.filter((m) => !!m).slice().reverse();
  for (const map of maps) {
    errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
  }
  return {
    ...issueData,
    path: fullPath,
    message: errorMessage
  };
}, "makeIssue");
var EMPTY_PATH = [];
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      // contextual error map is first priority
      ctx.schemaErrorMap,
      // then schema-bound map if available
      overrideMap,
      // then global override map
      overrideMap === en_default ? void 0 : en_default
      // then global default map
    ].filter((x) => !!x)
  });
  ctx.common.issues.push(issue);
}
__name(addIssueToContext, "addIssueToContext");
var ParseStatus = class _ParseStatus {
  static {
    __name(this, "ParseStatus");
  }
  constructor() {
    this.value = "valid";
  }
  dirty() {
    if (this.value === "valid")
      this.value = "dirty";
  }
  abort() {
    if (this.value !== "aborted")
      this.value = "aborted";
  }
  static mergeArray(status, results) {
    const arrayValue = [];
    for (const s of results) {
      if (s.status === "aborted")
        return INVALID;
      if (s.status === "dirty")
        status.dirty();
      arrayValue.push(s.value);
    }
    return { status: status.value, value: arrayValue };
  }
  static async mergeObjectAsync(status, pairs) {
    const syncPairs = [];
    for (const pair of pairs) {
      const key = await pair.key;
      const value = await pair.value;
      syncPairs.push({
        key,
        value
      });
    }
    return _ParseStatus.mergeObjectSync(status, syncPairs);
  }
  static mergeObjectSync(status, pairs) {
    const finalObject = {};
    for (const pair of pairs) {
      const { key, value } = pair;
      if (key.status === "aborted")
        return INVALID;
      if (value.status === "aborted")
        return INVALID;
      if (key.status === "dirty")
        status.dirty();
      if (value.status === "dirty")
        status.dirty();
      if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
        finalObject[key.value] = value.value;
      }
    }
    return { status: status.value, value: finalObject };
  }
};
var INVALID = Object.freeze({
  status: "aborted"
});
var DIRTY = /* @__PURE__ */ __name((value) => ({ status: "dirty", value }), "DIRTY");
var OK = /* @__PURE__ */ __name((value) => ({ status: "valid", value }), "OK");
var isAborted = /* @__PURE__ */ __name((x) => x.status === "aborted", "isAborted");
var isDirty = /* @__PURE__ */ __name((x) => x.status === "dirty", "isDirty");
var isValid = /* @__PURE__ */ __name((x) => x.status === "valid", "isValid");
var isAsync = /* @__PURE__ */ __name((x) => typeof Promise !== "undefined" && x instanceof Promise, "isAsync");

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/errorUtil.js
var errorUtil;
(function(errorUtil2) {
  errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
  errorUtil2.toString = (message) => typeof message === "string" ? message : message?.message;
})(errorUtil || (errorUtil = {}));

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/types.js
var ParseInputLazyPath = class {
  static {
    __name(this, "ParseInputLazyPath");
  }
  constructor(parent, value, path, key) {
    this._cachedPath = [];
    this.parent = parent;
    this.data = value;
    this._path = path;
    this._key = key;
  }
  get path() {
    if (!this._cachedPath.length) {
      if (Array.isArray(this._key)) {
        this._cachedPath.push(...this._path, ...this._key);
      } else {
        this._cachedPath.push(...this._path, this._key);
      }
    }
    return this._cachedPath;
  }
};
var handleResult = /* @__PURE__ */ __name((ctx, result) => {
  if (isValid(result)) {
    return { success: true, data: result.value };
  } else {
    if (!ctx.common.issues.length) {
      throw new Error("Validation failed but no issues detected.");
    }
    return {
      success: false,
      get error() {
        if (this._error)
          return this._error;
        const error = new ZodError(ctx.common.issues);
        this._error = error;
        return this._error;
      }
    };
  }
}, "handleResult");
function processCreateParams(params) {
  if (!params)
    return {};
  const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
  if (errorMap2 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap2)
    return { errorMap: errorMap2, description };
  const customMap = /* @__PURE__ */ __name((iss, ctx) => {
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message ?? ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: message ?? required_error ?? ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: message ?? invalid_type_error ?? ctx.defaultError };
  }, "customMap");
  return { errorMap: customMap, description };
}
__name(processCreateParams, "processCreateParams");
var ZodType = class {
  static {
    __name(this, "ZodType");
  }
  get description() {
    return this._def.description;
  }
  _getType(input) {
    return getParsedType(input.data);
  }
  _getOrReturnCtx(input, ctx) {
    return ctx || {
      common: input.parent.common,
      data: input.data,
      parsedType: getParsedType(input.data),
      schemaErrorMap: this._def.errorMap,
      path: input.path,
      parent: input.parent
    };
  }
  _processInputParams(input) {
    return {
      status: new ParseStatus(),
      ctx: {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      }
    };
  }
  _parseSync(input) {
    const result = this._parse(input);
    if (isAsync(result)) {
      throw new Error("Synchronous parse encountered promise.");
    }
    return result;
  }
  _parseAsync(input) {
    const result = this._parse(input);
    return Promise.resolve(result);
  }
  parse(data, params) {
    const result = this.safeParse(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  safeParse(data, params) {
    const ctx = {
      common: {
        issues: [],
        async: params?.async ?? false,
        contextualErrorMap: params?.errorMap
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const result = this._parseSync({ data, path: ctx.path, parent: ctx });
    return handleResult(ctx, result);
  }
  "~validate"(data) {
    const ctx = {
      common: {
        issues: [],
        async: !!this["~standard"].async
      },
      path: [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    if (!this["~standard"].async) {
      try {
        const result = this._parseSync({ data, path: [], parent: ctx });
        return isValid(result) ? {
          value: result.value
        } : {
          issues: ctx.common.issues
        };
      } catch (err) {
        if (err?.message?.toLowerCase()?.includes("encountered")) {
          this["~standard"].async = true;
        }
        ctx.common = {
          issues: [],
          async: true
        };
      }
    }
    return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result) ? {
      value: result.value
    } : {
      issues: ctx.common.issues
    });
  }
  async parseAsync(data, params) {
    const result = await this.safeParseAsync(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  async safeParseAsync(data, params) {
    const ctx = {
      common: {
        issues: [],
        contextualErrorMap: params?.errorMap,
        async: true
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
    const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
    return handleResult(ctx, result);
  }
  refine(check, message) {
    const getIssueProperties = /* @__PURE__ */ __name((val) => {
      if (typeof message === "string" || typeof message === "undefined") {
        return { message };
      } else if (typeof message === "function") {
        return message(val);
      } else {
        return message;
      }
    }, "getIssueProperties");
    return this._refinement((val, ctx) => {
      const result = check(val);
      const setError = /* @__PURE__ */ __name(() => ctx.addIssue({
        code: ZodIssueCode.custom,
        ...getIssueProperties(val)
      }), "setError");
      if (typeof Promise !== "undefined" && result instanceof Promise) {
        return result.then((data) => {
          if (!data) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      if (!result) {
        setError();
        return false;
      } else {
        return true;
      }
    });
  }
  refinement(check, refinementData) {
    return this._refinement((val, ctx) => {
      if (!check(val)) {
        ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
        return false;
      } else {
        return true;
      }
    });
  }
  _refinement(refinement) {
    return new ZodEffects({
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "refinement", refinement }
    });
  }
  superRefine(refinement) {
    return this._refinement(refinement);
  }
  constructor(def) {
    this.spa = this.safeParseAsync;
    this._def = def;
    this.parse = this.parse.bind(this);
    this.safeParse = this.safeParse.bind(this);
    this.parseAsync = this.parseAsync.bind(this);
    this.safeParseAsync = this.safeParseAsync.bind(this);
    this.spa = this.spa.bind(this);
    this.refine = this.refine.bind(this);
    this.refinement = this.refinement.bind(this);
    this.superRefine = this.superRefine.bind(this);
    this.optional = this.optional.bind(this);
    this.nullable = this.nullable.bind(this);
    this.nullish = this.nullish.bind(this);
    this.array = this.array.bind(this);
    this.promise = this.promise.bind(this);
    this.or = this.or.bind(this);
    this.and = this.and.bind(this);
    this.transform = this.transform.bind(this);
    this.brand = this.brand.bind(this);
    this.default = this.default.bind(this);
    this.catch = this.catch.bind(this);
    this.describe = this.describe.bind(this);
    this.pipe = this.pipe.bind(this);
    this.readonly = this.readonly.bind(this);
    this.isNullable = this.isNullable.bind(this);
    this.isOptional = this.isOptional.bind(this);
    this["~standard"] = {
      version: 1,
      vendor: "zod",
      validate: /* @__PURE__ */ __name((data) => this["~validate"](data), "validate")
    };
  }
  optional() {
    return ZodOptional.create(this, this._def);
  }
  nullable() {
    return ZodNullable.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return ZodArray.create(this);
  }
  promise() {
    return ZodPromise.create(this, this._def);
  }
  or(option) {
    return ZodUnion.create([this, option], this._def);
  }
  and(incoming) {
    return ZodIntersection.create(this, incoming, this._def);
  }
  transform(transform) {
    return new ZodEffects({
      ...processCreateParams(this._def),
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "transform", transform }
    });
  }
  default(def) {
    const defaultValueFunc = typeof def === "function" ? def : () => def;
    return new ZodDefault({
      ...processCreateParams(this._def),
      innerType: this,
      defaultValue: defaultValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodDefault
    });
  }
  brand() {
    return new ZodBranded({
      typeName: ZodFirstPartyTypeKind.ZodBranded,
      type: this,
      ...processCreateParams(this._def)
    });
  }
  catch(def) {
    const catchValueFunc = typeof def === "function" ? def : () => def;
    return new ZodCatch({
      ...processCreateParams(this._def),
      innerType: this,
      catchValue: catchValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodCatch
    });
  }
  describe(description) {
    const This = this.constructor;
    return new This({
      ...this._def,
      description
    });
  }
  pipe(target) {
    return ZodPipeline.create(this, target);
  }
  readonly() {
    return ZodReadonly.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
};
var cuidRegex = /^c[^\s-]{8,}$/i;
var cuid2Regex = /^[0-9a-z]+$/;
var ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
var uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
var nanoidRegex = /^[a-z0-9_-]{21}$/i;
var jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
var durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
var emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
var _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
var emojiRegex;
var ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
var ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
var ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
var base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
var dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
var dateRegex = new RegExp(`^${dateRegexSource}$`);
function timeRegexSource(args) {
  let secondsRegexSource = `[0-5]\\d`;
  if (args.precision) {
    secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
  } else if (args.precision == null) {
    secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
  }
  const secondsQuantifier = args.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
__name(timeRegexSource, "timeRegexSource");
function timeRegex(args) {
  return new RegExp(`^${timeRegexSource(args)}$`);
}
__name(timeRegex, "timeRegex");
function datetimeRegex(args) {
  let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
  const opts = [];
  opts.push(args.local ? `Z?` : `Z`);
  if (args.offset)
    opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
__name(datetimeRegex, "datetimeRegex");
function isValidIP(ip, version) {
  if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
__name(isValidIP, "isValidIP");
function isValidJWT(jwt, alg) {
  if (!jwtRegex.test(jwt))
    return false;
  try {
    const [header] = jwt.split(".");
    if (!header)
      return false;
    const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
    const decoded = JSON.parse(atob(base64));
    if (typeof decoded !== "object" || decoded === null)
      return false;
    if ("typ" in decoded && decoded?.typ !== "JWT")
      return false;
    if (!decoded.alg)
      return false;
    if (alg && decoded.alg !== alg)
      return false;
    return true;
  } catch {
    return false;
  }
}
__name(isValidJWT, "isValidJWT");
function isValidCidr(ip, version) {
  if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
    return true;
  }
  return false;
}
__name(isValidCidr, "isValidCidr");
var ZodString = class _ZodString extends ZodType {
  static {
    __name(this, "ZodString");
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = String(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.string) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.string,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.length < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.length > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "length") {
        const tooBig = input.data.length > check.value;
        const tooSmall = input.data.length < check.value;
        if (tooBig || tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          if (tooBig) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          } else if (tooSmall) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          }
          status.dirty();
        }
      } else if (check.kind === "email") {
        if (!emailRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "email",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "emoji") {
        if (!emojiRegex) {
          emojiRegex = new RegExp(_emojiRegex, "u");
        }
        if (!emojiRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "emoji",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "uuid") {
        if (!uuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "uuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "nanoid") {
        if (!nanoidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "nanoid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid") {
        if (!cuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid2") {
        if (!cuid2Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid2",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ulid") {
        if (!ulidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ulid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "url") {
        try {
          new URL(input.data);
        } catch {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "regex") {
        check.regex.lastIndex = 0;
        const testResult = check.regex.test(input.data);
        if (!testResult) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "regex",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "trim") {
        input.data = input.data.trim();
      } else if (check.kind === "includes") {
        if (!input.data.includes(check.value, check.position)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { includes: check.value, position: check.position },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "toLowerCase") {
        input.data = input.data.toLowerCase();
      } else if (check.kind === "toUpperCase") {
        input.data = input.data.toUpperCase();
      } else if (check.kind === "startsWith") {
        if (!input.data.startsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { startsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "endsWith") {
        if (!input.data.endsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { endsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "datetime") {
        const regex = datetimeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "datetime",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "date") {
        const regex = dateRegex;
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "date",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "time") {
        const regex = timeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "time",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "duration") {
        if (!durationRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "duration",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ip") {
        if (!isValidIP(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ip",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "jwt") {
        if (!isValidJWT(input.data, check.alg)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "jwt",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cidr") {
        if (!isValidCidr(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cidr",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64") {
        if (!base64Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64url") {
        if (!base64urlRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _regex(regex, validation, message) {
    return this.refinement((data) => regex.test(data), {
      validation,
      code: ZodIssueCode.invalid_string,
      ...errorUtil.errToObj(message)
    });
  }
  _addCheck(check) {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  email(message) {
    return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
  }
  url(message) {
    return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
  }
  emoji(message) {
    return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
  }
  uuid(message) {
    return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
  }
  nanoid(message) {
    return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
  }
  cuid(message) {
    return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
  }
  cuid2(message) {
    return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
  }
  ulid(message) {
    return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
  }
  base64(message) {
    return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
  }
  base64url(message) {
    return this._addCheck({
      kind: "base64url",
      ...errorUtil.errToObj(message)
    });
  }
  jwt(options) {
    return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
  }
  ip(options) {
    return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
  }
  cidr(options) {
    return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
  }
  datetime(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "datetime",
        precision: null,
        offset: false,
        local: false,
        message: options
      });
    }
    return this._addCheck({
      kind: "datetime",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      offset: options?.offset ?? false,
      local: options?.local ?? false,
      ...errorUtil.errToObj(options?.message)
    });
  }
  date(message) {
    return this._addCheck({ kind: "date", message });
  }
  time(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "time",
        precision: null,
        message: options
      });
    }
    return this._addCheck({
      kind: "time",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      ...errorUtil.errToObj(options?.message)
    });
  }
  duration(message) {
    return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
  }
  regex(regex, message) {
    return this._addCheck({
      kind: "regex",
      regex,
      ...errorUtil.errToObj(message)
    });
  }
  includes(value, options) {
    return this._addCheck({
      kind: "includes",
      value,
      position: options?.position,
      ...errorUtil.errToObj(options?.message)
    });
  }
  startsWith(value, message) {
    return this._addCheck({
      kind: "startsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  endsWith(value, message) {
    return this._addCheck({
      kind: "endsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  min(minLength, message) {
    return this._addCheck({
      kind: "min",
      value: minLength,
      ...errorUtil.errToObj(message)
    });
  }
  max(maxLength, message) {
    return this._addCheck({
      kind: "max",
      value: maxLength,
      ...errorUtil.errToObj(message)
    });
  }
  length(len, message) {
    return this._addCheck({
      kind: "length",
      value: len,
      ...errorUtil.errToObj(message)
    });
  }
  /**
   * Equivalent to `.min(1)`
   */
  nonempty(message) {
    return this.min(1, errorUtil.errToObj(message));
  }
  trim() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toUpperCase" }]
    });
  }
  get isDatetime() {
    return !!this._def.checks.find((ch) => ch.kind === "datetime");
  }
  get isDate() {
    return !!this._def.checks.find((ch) => ch.kind === "date");
  }
  get isTime() {
    return !!this._def.checks.find((ch) => ch.kind === "time");
  }
  get isDuration() {
    return !!this._def.checks.find((ch) => ch.kind === "duration");
  }
  get isEmail() {
    return !!this._def.checks.find((ch) => ch.kind === "email");
  }
  get isURL() {
    return !!this._def.checks.find((ch) => ch.kind === "url");
  }
  get isEmoji() {
    return !!this._def.checks.find((ch) => ch.kind === "emoji");
  }
  get isUUID() {
    return !!this._def.checks.find((ch) => ch.kind === "uuid");
  }
  get isNANOID() {
    return !!this._def.checks.find((ch) => ch.kind === "nanoid");
  }
  get isCUID() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid");
  }
  get isCUID2() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid2");
  }
  get isULID() {
    return !!this._def.checks.find((ch) => ch.kind === "ulid");
  }
  get isIP() {
    return !!this._def.checks.find((ch) => ch.kind === "ip");
  }
  get isCIDR() {
    return !!this._def.checks.find((ch) => ch.kind === "cidr");
  }
  get isBase64() {
    return !!this._def.checks.find((ch) => ch.kind === "base64");
  }
  get isBase64url() {
    return !!this._def.checks.find((ch) => ch.kind === "base64url");
  }
  get minLength() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxLength() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodString.create = (params) => {
  return new ZodString({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodString,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / 10 ** decCount;
}
__name(floatSafeRemainder, "floatSafeRemainder");
var ZodNumber = class _ZodNumber extends ZodType {
  static {
    __name(this, "ZodNumber");
  }
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
    this.step = this.multipleOf;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = Number(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.number) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.number,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "int") {
        if (!util.isInteger(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: "integer",
            received: "float",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (floatSafeRemainder(input.data, check.value) !== 0) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "finite") {
        if (!Number.isFinite(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_finite,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodNumber({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodNumber({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  int(message) {
    return this._addCheck({
      kind: "int",
      message: errorUtil.toString(message)
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  finite(message) {
    return this._addCheck({
      kind: "finite",
      message: errorUtil.toString(message)
    });
  }
  safe(message) {
    return this._addCheck({
      kind: "min",
      inclusive: true,
      value: Number.MIN_SAFE_INTEGER,
      message: errorUtil.toString(message)
    })._addCheck({
      kind: "max",
      inclusive: true,
      value: Number.MAX_SAFE_INTEGER,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
  get isInt() {
    return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
  }
  get isFinite() {
    let max = null;
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
        return true;
      } else if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      } else if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return Number.isFinite(min) && Number.isFinite(max);
  }
};
ZodNumber.create = (params) => {
  return new ZodNumber({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodNumber,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodBigInt = class _ZodBigInt extends ZodType {
  static {
    __name(this, "ZodBigInt");
  }
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
  }
  _parse(input) {
    if (this._def.coerce) {
      try {
        input.data = BigInt(input.data);
      } catch {
        return this._getInvalidInput(input);
      }
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.bigint) {
      return this._getInvalidInput(input);
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            type: "bigint",
            minimum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            type: "bigint",
            maximum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (input.data % check.value !== BigInt(0)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _getInvalidInput(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.bigint,
      received: ctx.parsedType
    });
    return INVALID;
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodBigInt({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodBigInt({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodBigInt.create = (params) => {
  return new ZodBigInt({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodBigInt,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
var ZodBoolean = class extends ZodType {
  static {
    __name(this, "ZodBoolean");
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = Boolean(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.boolean) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.boolean,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodBoolean.create = (params) => {
  return new ZodBoolean({
    typeName: ZodFirstPartyTypeKind.ZodBoolean,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodDate = class _ZodDate extends ZodType {
  static {
    __name(this, "ZodDate");
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = new Date(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.date) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.date,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    if (Number.isNaN(input.data.getTime())) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_date
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.getTime() < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            message: check.message,
            inclusive: true,
            exact: false,
            minimum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.getTime() > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            message: check.message,
            inclusive: true,
            exact: false,
            maximum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return {
      status: status.value,
      value: new Date(input.data.getTime())
    };
  }
  _addCheck(check) {
    return new _ZodDate({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  min(minDate, message) {
    return this._addCheck({
      kind: "min",
      value: minDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  max(maxDate, message) {
    return this._addCheck({
      kind: "max",
      value: maxDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  get minDate() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min != null ? new Date(min) : null;
  }
  get maxDate() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max != null ? new Date(max) : null;
  }
};
ZodDate.create = (params) => {
  return new ZodDate({
    checks: [],
    coerce: params?.coerce || false,
    typeName: ZodFirstPartyTypeKind.ZodDate,
    ...processCreateParams(params)
  });
};
var ZodSymbol = class extends ZodType {
  static {
    __name(this, "ZodSymbol");
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.symbol) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.symbol,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodSymbol.create = (params) => {
  return new ZodSymbol({
    typeName: ZodFirstPartyTypeKind.ZodSymbol,
    ...processCreateParams(params)
  });
};
var ZodUndefined = class extends ZodType {
  static {
    __name(this, "ZodUndefined");
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.undefined,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodUndefined.create = (params) => {
  return new ZodUndefined({
    typeName: ZodFirstPartyTypeKind.ZodUndefined,
    ...processCreateParams(params)
  });
};
var ZodNull = class extends ZodType {
  static {
    __name(this, "ZodNull");
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.null) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.null,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodNull.create = (params) => {
  return new ZodNull({
    typeName: ZodFirstPartyTypeKind.ZodNull,
    ...processCreateParams(params)
  });
};
var ZodAny = class extends ZodType {
  static {
    __name(this, "ZodAny");
  }
  constructor() {
    super(...arguments);
    this._any = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodAny.create = (params) => {
  return new ZodAny({
    typeName: ZodFirstPartyTypeKind.ZodAny,
    ...processCreateParams(params)
  });
};
var ZodUnknown = class extends ZodType {
  static {
    __name(this, "ZodUnknown");
  }
  constructor() {
    super(...arguments);
    this._unknown = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodUnknown.create = (params) => {
  return new ZodUnknown({
    typeName: ZodFirstPartyTypeKind.ZodUnknown,
    ...processCreateParams(params)
  });
};
var ZodNever = class extends ZodType {
  static {
    __name(this, "ZodNever");
  }
  _parse(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.never,
      received: ctx.parsedType
    });
    return INVALID;
  }
};
ZodNever.create = (params) => {
  return new ZodNever({
    typeName: ZodFirstPartyTypeKind.ZodNever,
    ...processCreateParams(params)
  });
};
var ZodVoid = class extends ZodType {
  static {
    __name(this, "ZodVoid");
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.void,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodVoid.create = (params) => {
  return new ZodVoid({
    typeName: ZodFirstPartyTypeKind.ZodVoid,
    ...processCreateParams(params)
  });
};
var ZodArray = class _ZodArray extends ZodType {
  static {
    __name(this, "ZodArray");
  }
  _parse(input) {
    const { ctx, status } = this._processInputParams(input);
    const def = this._def;
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (def.exactLength !== null) {
      const tooBig = ctx.data.length > def.exactLength.value;
      const tooSmall = ctx.data.length < def.exactLength.value;
      if (tooBig || tooSmall) {
        addIssueToContext(ctx, {
          code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
          minimum: tooSmall ? def.exactLength.value : void 0,
          maximum: tooBig ? def.exactLength.value : void 0,
          type: "array",
          inclusive: true,
          exact: true,
          message: def.exactLength.message
        });
        status.dirty();
      }
    }
    if (def.minLength !== null) {
      if (ctx.data.length < def.minLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.minLength.message
        });
        status.dirty();
      }
    }
    if (def.maxLength !== null) {
      if (ctx.data.length > def.maxLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.maxLength.message
        });
        status.dirty();
      }
    }
    if (ctx.common.async) {
      return Promise.all([...ctx.data].map((item, i) => {
        return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
      })).then((result2) => {
        return ParseStatus.mergeArray(status, result2);
      });
    }
    const result = [...ctx.data].map((item, i) => {
      return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
    });
    return ParseStatus.mergeArray(status, result);
  }
  get element() {
    return this._def.type;
  }
  min(minLength, message) {
    return new _ZodArray({
      ...this._def,
      minLength: { value: minLength, message: errorUtil.toString(message) }
    });
  }
  max(maxLength, message) {
    return new _ZodArray({
      ...this._def,
      maxLength: { value: maxLength, message: errorUtil.toString(message) }
    });
  }
  length(len, message) {
    return new _ZodArray({
      ...this._def,
      exactLength: { value: len, message: errorUtil.toString(message) }
    });
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodArray.create = (schema, params) => {
  return new ZodArray({
    type: schema,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: ZodFirstPartyTypeKind.ZodArray,
    ...processCreateParams(params)
  });
};
function deepPartialify(schema) {
  if (schema instanceof ZodObject) {
    const newShape = {};
    for (const key in schema.shape) {
      const fieldSchema = schema.shape[key];
      newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema._def,
      shape: /* @__PURE__ */ __name(() => newShape, "shape")
    });
  } else if (schema instanceof ZodArray) {
    return new ZodArray({
      ...schema._def,
      type: deepPartialify(schema.element)
    });
  } else if (schema instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodTuple) {
    return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
  } else {
    return schema;
  }
}
__name(deepPartialify, "deepPartialify");
var ZodObject = class _ZodObject extends ZodType {
  static {
    __name(this, "ZodObject");
  }
  constructor() {
    super(...arguments);
    this._cached = null;
    this.nonstrict = this.passthrough;
    this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null)
      return this._cached;
    const shape = this._def.shape();
    const keys = util.objectKeys(shape);
    this._cached = { shape, keys };
    return this._cached;
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.object) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const { status, ctx } = this._processInputParams(input);
    const { shape, keys: shapeKeys } = this._getCached();
    const extraKeys = [];
    if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
      for (const key in ctx.data) {
        if (!shapeKeys.includes(key)) {
          extraKeys.push(key);
        }
      }
    }
    const pairs = [];
    for (const key of shapeKeys) {
      const keyValidator = shape[key];
      const value = ctx.data[key];
      pairs.push({
        key: { status: "valid", value: key },
        value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (this._def.catchall instanceof ZodNever) {
      const unknownKeys = this._def.unknownKeys;
      if (unknownKeys === "passthrough") {
        for (const key of extraKeys) {
          pairs.push({
            key: { status: "valid", value: key },
            value: { status: "valid", value: ctx.data[key] }
          });
        }
      } else if (unknownKeys === "strict") {
        if (extraKeys.length > 0) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.unrecognized_keys,
            keys: extraKeys
          });
          status.dirty();
        }
      } else if (unknownKeys === "strip") {
      } else {
        throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
      }
    } else {
      const catchall = this._def.catchall;
      for (const key of extraKeys) {
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: catchall._parse(
            new ParseInputLazyPath(ctx, value, ctx.path, key)
            //, ctx.child(key), value, getParsedType(value)
          ),
          alwaysSet: key in ctx.data
        });
      }
    }
    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        const syncPairs = [];
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          syncPairs.push({
            key,
            value,
            alwaysSet: pair.alwaysSet
          });
        }
        return syncPairs;
      }).then((syncPairs) => {
        return ParseStatus.mergeObjectSync(status, syncPairs);
      });
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get shape() {
    return this._def.shape();
  }
  strict(message) {
    errorUtil.errToObj;
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strict",
      ...message !== void 0 ? {
        errorMap: /* @__PURE__ */ __name((issue, ctx) => {
          const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
          if (issue.code === "unrecognized_keys")
            return {
              message: errorUtil.errToObj(message).message ?? defaultError
            };
          return {
            message: defaultError
          };
        }, "errorMap")
      } : {}
    });
  }
  strip() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strip"
    });
  }
  passthrough() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "passthrough"
    });
  }
  // const AugmentFactory =
  //   <Def extends ZodObjectDef>(def: Def) =>
  //   <Augmentation extends ZodRawShape>(
  //     augmentation: Augmentation
  //   ): ZodObject<
  //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
  //     Def["unknownKeys"],
  //     Def["catchall"]
  //   > => {
  //     return new ZodObject({
  //       ...def,
  //       shape: () => ({
  //         ...def.shape(),
  //         ...augmentation,
  //       }),
  //     }) as any;
  //   };
  extend(augmentation) {
    return new _ZodObject({
      ...this._def,
      shape: /* @__PURE__ */ __name(() => ({
        ...this._def.shape(),
        ...augmentation
      }), "shape")
    });
  }
  /**
   * Prior to zod@1.0.12 there was a bug in the
   * inferred type of merged objects. Please
   * upgrade if you are experiencing issues.
   */
  merge(merging) {
    const merged = new _ZodObject({
      unknownKeys: merging._def.unknownKeys,
      catchall: merging._def.catchall,
      shape: /* @__PURE__ */ __name(() => ({
        ...this._def.shape(),
        ...merging._def.shape()
      }), "shape"),
      typeName: ZodFirstPartyTypeKind.ZodObject
    });
    return merged;
  }
  // merge<
  //   Incoming extends AnyZodObject,
  //   Augmentation extends Incoming["shape"],
  //   NewOutput extends {
  //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
  //       ? Augmentation[k]["_output"]
  //       : k extends keyof Output
  //       ? Output[k]
  //       : never;
  //   },
  //   NewInput extends {
  //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
  //       ? Augmentation[k]["_input"]
  //       : k extends keyof Input
  //       ? Input[k]
  //       : never;
  //   }
  // >(
  //   merging: Incoming
  // ): ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"],
  //   NewOutput,
  //   NewInput
  // > {
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  setKey(key, schema) {
    return this.augment({ [key]: schema });
  }
  // merge<Incoming extends AnyZodObject>(
  //   merging: Incoming
  // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
  // ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"]
  // > {
  //   // const mergedShape = objectUtil.mergeShapes(
  //   //   this._def.shape(),
  //   //   merging._def.shape()
  //   // );
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  catchall(index) {
    return new _ZodObject({
      ...this._def,
      catchall: index
    });
  }
  pick(mask) {
    const shape = {};
    for (const key of util.objectKeys(mask)) {
      if (mask[key] && this.shape[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: /* @__PURE__ */ __name(() => shape, "shape")
    });
  }
  omit(mask) {
    const shape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (!mask[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: /* @__PURE__ */ __name(() => shape, "shape")
    });
  }
  /**
   * @deprecated
   */
  deepPartial() {
    return deepPartialify(this);
  }
  partial(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      const fieldSchema = this.shape[key];
      if (mask && !mask[key]) {
        newShape[key] = fieldSchema;
      } else {
        newShape[key] = fieldSchema.optional();
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: /* @__PURE__ */ __name(() => newShape, "shape")
    });
  }
  required(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (mask && !mask[key]) {
        newShape[key] = this.shape[key];
      } else {
        const fieldSchema = this.shape[key];
        let newField = fieldSchema;
        while (newField instanceof ZodOptional) {
          newField = newField._def.innerType;
        }
        newShape[key] = newField;
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: /* @__PURE__ */ __name(() => newShape, "shape")
    });
  }
  keyof() {
    return createZodEnum(util.objectKeys(this.shape));
  }
};
ZodObject.create = (shape, params) => {
  return new ZodObject({
    shape: /* @__PURE__ */ __name(() => shape, "shape"),
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.strictCreate = (shape, params) => {
  return new ZodObject({
    shape: /* @__PURE__ */ __name(() => shape, "shape"),
    unknownKeys: "strict",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.lazycreate = (shape, params) => {
  return new ZodObject({
    shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
var ZodUnion = class extends ZodType {
  static {
    __name(this, "ZodUnion");
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const options = this._def.options;
    function handleResults(results) {
      for (const result of results) {
        if (result.result.status === "valid") {
          return result.result;
        }
      }
      for (const result of results) {
        if (result.result.status === "dirty") {
          ctx.common.issues.push(...result.ctx.common.issues);
          return result.result;
        }
      }
      const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
    __name(handleResults, "handleResults");
    if (ctx.common.async) {
      return Promise.all(options.map(async (option) => {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        return {
          result: await option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          }),
          ctx: childCtx
        };
      })).then(handleResults);
    } else {
      let dirty = void 0;
      const issues = [];
      for (const option of options) {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        const result = option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: childCtx
        });
        if (result.status === "valid") {
          return result;
        } else if (result.status === "dirty" && !dirty) {
          dirty = { result, ctx: childCtx };
        }
        if (childCtx.common.issues.length) {
          issues.push(childCtx.common.issues);
        }
      }
      if (dirty) {
        ctx.common.issues.push(...dirty.ctx.common.issues);
        return dirty.result;
      }
      const unionErrors = issues.map((issues2) => new ZodError(issues2));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
  }
  get options() {
    return this._def.options;
  }
};
ZodUnion.create = (types, params) => {
  return new ZodUnion({
    options: types,
    typeName: ZodFirstPartyTypeKind.ZodUnion,
    ...processCreateParams(params)
  });
};
var getDiscriminator = /* @__PURE__ */ __name((type) => {
  if (type instanceof ZodLazy) {
    return getDiscriminator(type.schema);
  } else if (type instanceof ZodEffects) {
    return getDiscriminator(type.innerType());
  } else if (type instanceof ZodLiteral) {
    return [type.value];
  } else if (type instanceof ZodEnum) {
    return type.options;
  } else if (type instanceof ZodNativeEnum) {
    return util.objectValues(type.enum);
  } else if (type instanceof ZodDefault) {
    return getDiscriminator(type._def.innerType);
  } else if (type instanceof ZodUndefined) {
    return [void 0];
  } else if (type instanceof ZodNull) {
    return [null];
  } else if (type instanceof ZodOptional) {
    return [void 0, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodNullable) {
    return [null, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodBranded) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodReadonly) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodCatch) {
    return getDiscriminator(type._def.innerType);
  } else {
    return [];
  }
}, "getDiscriminator");
var ZodDiscriminatedUnion = class _ZodDiscriminatedUnion extends ZodType {
  static {
    __name(this, "ZodDiscriminatedUnion");
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const discriminator = this.discriminator;
    const discriminatorValue = ctx.data[discriminator];
    const option = this.optionsMap.get(discriminatorValue);
    if (!option) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union_discriminator,
        options: Array.from(this.optionsMap.keys()),
        path: [discriminator]
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return option._parseAsync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    } else {
      return option._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    }
  }
  get discriminator() {
    return this._def.discriminator;
  }
  get options() {
    return this._def.options;
  }
  get optionsMap() {
    return this._def.optionsMap;
  }
  /**
   * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
   * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
   * have a different value for each object in the union.
   * @param discriminator the name of the discriminator property
   * @param types an array of object schemas
   * @param params
   */
  static create(discriminator, options, params) {
    const optionsMap = /* @__PURE__ */ new Map();
    for (const type of options) {
      const discriminatorValues = getDiscriminator(type.shape[discriminator]);
      if (!discriminatorValues.length) {
        throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
      }
      for (const value of discriminatorValues) {
        if (optionsMap.has(value)) {
          throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
        }
        optionsMap.set(value, type);
      }
    }
    return new _ZodDiscriminatedUnion({
      typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
      discriminator,
      options,
      optionsMap,
      ...processCreateParams(params)
    });
  }
};
function mergeValues(a, b) {
  const aType = getParsedType(a);
  const bType = getParsedType(b);
  if (a === b) {
    return { valid: true, data: a };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b);
    const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a.length !== b.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0; index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
    return { valid: true, data: a };
  } else {
    return { valid: false };
  }
}
__name(mergeValues, "mergeValues");
var ZodIntersection = class extends ZodType {
  static {
    __name(this, "ZodIntersection");
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const handleParsed = /* @__PURE__ */ __name((parsedLeft, parsedRight) => {
      if (isAborted(parsedLeft) || isAborted(parsedRight)) {
        return INVALID;
      }
      const merged = mergeValues(parsedLeft.value, parsedRight.value);
      if (!merged.valid) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_intersection_types
        });
        return INVALID;
      }
      if (isDirty(parsedLeft) || isDirty(parsedRight)) {
        status.dirty();
      }
      return { status: status.value, value: merged.data };
    }, "handleParsed");
    if (ctx.common.async) {
      return Promise.all([
        this._def.left._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }),
        this._def.right._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        })
      ]).then(([left, right]) => handleParsed(left, right));
    } else {
      return handleParsed(this._def.left._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }), this._def.right._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }));
    }
  }
};
ZodIntersection.create = (left, right, params) => {
  return new ZodIntersection({
    left,
    right,
    typeName: ZodFirstPartyTypeKind.ZodIntersection,
    ...processCreateParams(params)
  });
};
var ZodTuple = class _ZodTuple extends ZodType {
  static {
    __name(this, "ZodTuple");
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (ctx.data.length < this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_small,
        minimum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      return INVALID;
    }
    const rest = this._def.rest;
    if (!rest && ctx.data.length > this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_big,
        maximum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      status.dirty();
    }
    const items = [...ctx.data].map((item, itemIndex) => {
      const schema = this._def.items[itemIndex] || this._def.rest;
      if (!schema)
        return null;
      return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
    }).filter((x) => !!x);
    if (ctx.common.async) {
      return Promise.all(items).then((results) => {
        return ParseStatus.mergeArray(status, results);
      });
    } else {
      return ParseStatus.mergeArray(status, items);
    }
  }
  get items() {
    return this._def.items;
  }
  rest(rest) {
    return new _ZodTuple({
      ...this._def,
      rest
    });
  }
};
ZodTuple.create = (schemas, params) => {
  if (!Array.isArray(schemas)) {
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  }
  return new ZodTuple({
    items: schemas,
    typeName: ZodFirstPartyTypeKind.ZodTuple,
    rest: null,
    ...processCreateParams(params)
  });
};
var ZodRecord = class _ZodRecord extends ZodType {
  static {
    __name(this, "ZodRecord");
  }
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const pairs = [];
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    for (const key in ctx.data) {
      pairs.push({
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
        value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (ctx.common.async) {
      return ParseStatus.mergeObjectAsync(status, pairs);
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get element() {
    return this._def.valueType;
  }
  static create(first, second, third) {
    if (second instanceof ZodType) {
      return new _ZodRecord({
        keyType: first,
        valueType: second,
        typeName: ZodFirstPartyTypeKind.ZodRecord,
        ...processCreateParams(third)
      });
    }
    return new _ZodRecord({
      keyType: ZodString.create(),
      valueType: first,
      typeName: ZodFirstPartyTypeKind.ZodRecord,
      ...processCreateParams(second)
    });
  }
};
var ZodMap = class extends ZodType {
  static {
    __name(this, "ZodMap");
  }
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.map) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.map,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    const pairs = [...ctx.data.entries()].map(([key, value], index) => {
      return {
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
        value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
      };
    });
    if (ctx.common.async) {
      const finalMap = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      });
    } else {
      const finalMap = /* @__PURE__ */ new Map();
      for (const pair of pairs) {
        const key = pair.key;
        const value = pair.value;
        if (key.status === "aborted" || value.status === "aborted") {
          return INVALID;
        }
        if (key.status === "dirty" || value.status === "dirty") {
          status.dirty();
        }
        finalMap.set(key.value, value.value);
      }
      return { status: status.value, value: finalMap };
    }
  }
};
ZodMap.create = (keyType, valueType, params) => {
  return new ZodMap({
    valueType,
    keyType,
    typeName: ZodFirstPartyTypeKind.ZodMap,
    ...processCreateParams(params)
  });
};
var ZodSet = class _ZodSet extends ZodType {
  static {
    __name(this, "ZodSet");
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.set) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.set,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const def = this._def;
    if (def.minSize !== null) {
      if (ctx.data.size < def.minSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.minSize.message
        });
        status.dirty();
      }
    }
    if (def.maxSize !== null) {
      if (ctx.data.size > def.maxSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.maxSize.message
        });
        status.dirty();
      }
    }
    const valueType = this._def.valueType;
    function finalizeSet(elements2) {
      const parsedSet = /* @__PURE__ */ new Set();
      for (const element of elements2) {
        if (element.status === "aborted")
          return INVALID;
        if (element.status === "dirty")
          status.dirty();
        parsedSet.add(element.value);
      }
      return { status: status.value, value: parsedSet };
    }
    __name(finalizeSet, "finalizeSet");
    const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
    if (ctx.common.async) {
      return Promise.all(elements).then((elements2) => finalizeSet(elements2));
    } else {
      return finalizeSet(elements);
    }
  }
  min(minSize, message) {
    return new _ZodSet({
      ...this._def,
      minSize: { value: minSize, message: errorUtil.toString(message) }
    });
  }
  max(maxSize, message) {
    return new _ZodSet({
      ...this._def,
      maxSize: { value: maxSize, message: errorUtil.toString(message) }
    });
  }
  size(size, message) {
    return this.min(size, message).max(size, message);
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodSet.create = (valueType, params) => {
  return new ZodSet({
    valueType,
    minSize: null,
    maxSize: null,
    typeName: ZodFirstPartyTypeKind.ZodSet,
    ...processCreateParams(params)
  });
};
var ZodFunction = class _ZodFunction extends ZodType {
  static {
    __name(this, "ZodFunction");
  }
  constructor() {
    super(...arguments);
    this.validate = this.implement;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.function) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.function,
        received: ctx.parsedType
      });
      return INVALID;
    }
    function makeArgsIssue(args, error) {
      return makeIssue({
        data: args,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_arguments,
          argumentsError: error
        }
      });
    }
    __name(makeArgsIssue, "makeArgsIssue");
    function makeReturnsIssue(returns, error) {
      return makeIssue({
        data: returns,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_return_type,
          returnTypeError: error
        }
      });
    }
    __name(makeReturnsIssue, "makeReturnsIssue");
    const params = { errorMap: ctx.common.contextualErrorMap };
    const fn = ctx.data;
    if (this._def.returns instanceof ZodPromise) {
      const me = this;
      return OK(async function(...args) {
        const error = new ZodError([]);
        const parsedArgs = await me._def.args.parseAsync(args, params).catch((e) => {
          error.addIssue(makeArgsIssue(args, e));
          throw error;
        });
        const result = await Reflect.apply(fn, this, parsedArgs);
        const parsedReturns = await me._def.returns._def.type.parseAsync(result, params).catch((e) => {
          error.addIssue(makeReturnsIssue(result, e));
          throw error;
        });
        return parsedReturns;
      });
    } else {
      const me = this;
      return OK(function(...args) {
        const parsedArgs = me._def.args.safeParse(args, params);
        if (!parsedArgs.success) {
          throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
        }
        const result = Reflect.apply(fn, this, parsedArgs.data);
        const parsedReturns = me._def.returns.safeParse(result, params);
        if (!parsedReturns.success) {
          throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
        }
        return parsedReturns.data;
      });
    }
  }
  parameters() {
    return this._def.args;
  }
  returnType() {
    return this._def.returns;
  }
  args(...items) {
    return new _ZodFunction({
      ...this._def,
      args: ZodTuple.create(items).rest(ZodUnknown.create())
    });
  }
  returns(returnType) {
    return new _ZodFunction({
      ...this._def,
      returns: returnType
    });
  }
  implement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  strictImplement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  static create(args, returns, params) {
    return new _ZodFunction({
      args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
      returns: returns || ZodUnknown.create(),
      typeName: ZodFirstPartyTypeKind.ZodFunction,
      ...processCreateParams(params)
    });
  }
};
var ZodLazy = class extends ZodType {
  static {
    __name(this, "ZodLazy");
  }
  get schema() {
    return this._def.getter();
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const lazySchema = this._def.getter();
    return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
  }
};
ZodLazy.create = (getter, params) => {
  return new ZodLazy({
    getter,
    typeName: ZodFirstPartyTypeKind.ZodLazy,
    ...processCreateParams(params)
  });
};
var ZodLiteral = class extends ZodType {
  static {
    __name(this, "ZodLiteral");
  }
  _parse(input) {
    if (input.data !== this._def.value) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_literal,
        expected: this._def.value
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
  get value() {
    return this._def.value;
  }
};
ZodLiteral.create = (value, params) => {
  return new ZodLiteral({
    value,
    typeName: ZodFirstPartyTypeKind.ZodLiteral,
    ...processCreateParams(params)
  });
};
function createZodEnum(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
}
__name(createZodEnum, "createZodEnum");
var ZodEnum = class _ZodEnum extends ZodType {
  static {
    __name(this, "ZodEnum");
  }
  _parse(input) {
    if (typeof input.data !== "string") {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(this._def.values);
    }
    if (!this._cache.has(input.data)) {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Values() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  extract(values, newDef = this._def) {
    return _ZodEnum.create(values, {
      ...this._def,
      ...newDef
    });
  }
  exclude(values, newDef = this._def) {
    return _ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
      ...this._def,
      ...newDef
    });
  }
};
ZodEnum.create = createZodEnum;
var ZodNativeEnum = class extends ZodType {
  static {
    __name(this, "ZodNativeEnum");
  }
  _parse(input) {
    const nativeEnumValues = util.getValidEnumValues(this._def.values);
    const ctx = this._getOrReturnCtx(input);
    if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(util.getValidEnumValues(this._def.values));
    }
    if (!this._cache.has(input.data)) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get enum() {
    return this._def.values;
  }
};
ZodNativeEnum.create = (values, params) => {
  return new ZodNativeEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
    ...processCreateParams(params)
  });
};
var ZodPromise = class extends ZodType {
  static {
    __name(this, "ZodPromise");
  }
  unwrap() {
    return this._def.type;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.promise,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
    return OK(promisified.then((data) => {
      return this._def.type.parseAsync(data, {
        path: ctx.path,
        errorMap: ctx.common.contextualErrorMap
      });
    }));
  }
};
ZodPromise.create = (schema, params) => {
  return new ZodPromise({
    type: schema,
    typeName: ZodFirstPartyTypeKind.ZodPromise,
    ...processCreateParams(params)
  });
};
var ZodEffects = class extends ZodType {
  static {
    __name(this, "ZodEffects");
  }
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const effect = this._def.effect || null;
    const checkCtx = {
      addIssue: /* @__PURE__ */ __name((arg) => {
        addIssueToContext(ctx, arg);
        if (arg.fatal) {
          status.abort();
        } else {
          status.dirty();
        }
      }, "addIssue"),
      get path() {
        return ctx.path;
      }
    };
    checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
    if (effect.type === "preprocess") {
      const processed = effect.transform(ctx.data, checkCtx);
      if (ctx.common.async) {
        return Promise.resolve(processed).then(async (processed2) => {
          if (status.value === "aborted")
            return INVALID;
          const result = await this._def.schema._parseAsync({
            data: processed2,
            path: ctx.path,
            parent: ctx
          });
          if (result.status === "aborted")
            return INVALID;
          if (result.status === "dirty")
            return DIRTY(result.value);
          if (status.value === "dirty")
            return DIRTY(result.value);
          return result;
        });
      } else {
        if (status.value === "aborted")
          return INVALID;
        const result = this._def.schema._parseSync({
          data: processed,
          path: ctx.path,
          parent: ctx
        });
        if (result.status === "aborted")
          return INVALID;
        if (result.status === "dirty")
          return DIRTY(result.value);
        if (status.value === "dirty")
          return DIRTY(result.value);
        return result;
      }
    }
    if (effect.type === "refinement") {
      const executeRefinement = /* @__PURE__ */ __name((acc) => {
        const result = effect.refinement(acc, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(result);
        }
        if (result instanceof Promise) {
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        }
        return acc;
      }, "executeRefinement");
      if (ctx.common.async === false) {
        const inner = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inner.status === "aborted")
          return INVALID;
        if (inner.status === "dirty")
          status.dirty();
        executeRefinement(inner.value);
        return { status: status.value, value: inner.value };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status.dirty();
          return executeRefinement(inner.value).then(() => {
            return { status: status.value, value: inner.value };
          });
        });
      }
    }
    if (effect.type === "transform") {
      if (ctx.common.async === false) {
        const base = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (!isValid(base))
          return INVALID;
        const result = effect.transform(base.value, checkCtx);
        if (result instanceof Promise) {
          throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
        }
        return { status: status.value, value: result };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
          if (!isValid(base))
            return INVALID;
          return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
            status: status.value,
            value: result
          }));
        });
      }
    }
    util.assertNever(effect);
  }
};
ZodEffects.create = (schema, effect, params) => {
  return new ZodEffects({
    schema,
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    effect,
    ...processCreateParams(params)
  });
};
ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
  return new ZodEffects({
    schema,
    effect: { type: "preprocess", transform: preprocess },
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    ...processCreateParams(params)
  });
};
var ZodOptional = class extends ZodType {
  static {
    __name(this, "ZodOptional");
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.undefined) {
      return OK(void 0);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodOptional.create = (type, params) => {
  return new ZodOptional({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodOptional,
    ...processCreateParams(params)
  });
};
var ZodNullable = class extends ZodType {
  static {
    __name(this, "ZodNullable");
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.null) {
      return OK(null);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodNullable.create = (type, params) => {
  return new ZodNullable({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodNullable,
    ...processCreateParams(params)
  });
};
var ZodDefault = class extends ZodType {
  static {
    __name(this, "ZodDefault");
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    let data = ctx.data;
    if (ctx.parsedType === ZodParsedType.undefined) {
      data = this._def.defaultValue();
    }
    return this._def.innerType._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
};
ZodDefault.create = (type, params) => {
  return new ZodDefault({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodDefault,
    defaultValue: typeof params.default === "function" ? params.default : () => params.default,
    ...processCreateParams(params)
  });
};
var ZodCatch = class extends ZodType {
  static {
    __name(this, "ZodCatch");
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const newCtx = {
      ...ctx,
      common: {
        ...ctx.common,
        issues: []
      }
    };
    const result = this._def.innerType._parse({
      data: newCtx.data,
      path: newCtx.path,
      parent: {
        ...newCtx
      }
    });
    if (isAsync(result)) {
      return result.then((result2) => {
        return {
          status: "valid",
          value: result2.status === "valid" ? result2.value : this._def.catchValue({
            get error() {
              return new ZodError(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      });
    } else {
      return {
        status: "valid",
        value: result.status === "valid" ? result.value : this._def.catchValue({
          get error() {
            return new ZodError(newCtx.common.issues);
          },
          input: newCtx.data
        })
      };
    }
  }
  removeCatch() {
    return this._def.innerType;
  }
};
ZodCatch.create = (type, params) => {
  return new ZodCatch({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodCatch,
    catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
    ...processCreateParams(params)
  });
};
var ZodNaN = class extends ZodType {
  static {
    __name(this, "ZodNaN");
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.nan) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.nan,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
};
ZodNaN.create = (params) => {
  return new ZodNaN({
    typeName: ZodFirstPartyTypeKind.ZodNaN,
    ...processCreateParams(params)
  });
};
var BRAND = Symbol("zod_brand");
var ZodBranded = class extends ZodType {
  static {
    __name(this, "ZodBranded");
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const data = ctx.data;
    return this._def.type._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  unwrap() {
    return this._def.type;
  }
};
var ZodPipeline = class _ZodPipeline extends ZodType {
  static {
    __name(this, "ZodPipeline");
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.common.async) {
      const handleAsync = /* @__PURE__ */ __name(async () => {
        const inResult = await this._def.in._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID;
        if (inResult.status === "dirty") {
          status.dirty();
          return DIRTY(inResult.value);
        } else {
          return this._def.out._parseAsync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      }, "handleAsync");
      return handleAsync();
    } else {
      const inResult = this._def.in._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
      if (inResult.status === "aborted")
        return INVALID;
      if (inResult.status === "dirty") {
        status.dirty();
        return {
          status: "dirty",
          value: inResult.value
        };
      } else {
        return this._def.out._parseSync({
          data: inResult.value,
          path: ctx.path,
          parent: ctx
        });
      }
    }
  }
  static create(a, b) {
    return new _ZodPipeline({
      in: a,
      out: b,
      typeName: ZodFirstPartyTypeKind.ZodPipeline
    });
  }
};
var ZodReadonly = class extends ZodType {
  static {
    __name(this, "ZodReadonly");
  }
  _parse(input) {
    const result = this._def.innerType._parse(input);
    const freeze = /* @__PURE__ */ __name((data) => {
      if (isValid(data)) {
        data.value = Object.freeze(data.value);
      }
      return data;
    }, "freeze");
    return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodReadonly.create = (type, params) => {
  return new ZodReadonly({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodReadonly,
    ...processCreateParams(params)
  });
};
function cleanParams(params, data) {
  const p = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
  const p2 = typeof p === "string" ? { message: p } : p;
  return p2;
}
__name(cleanParams, "cleanParams");
function custom(check, _params = {}, fatal) {
  if (check)
    return ZodAny.create().superRefine((data, ctx) => {
      const r = check(data);
      if (r instanceof Promise) {
        return r.then((r2) => {
          if (!r2) {
            const params = cleanParams(_params, data);
            const _fatal = params.fatal ?? fatal ?? true;
            ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
          }
        });
      }
      if (!r) {
        const params = cleanParams(_params, data);
        const _fatal = params.fatal ?? fatal ?? true;
        ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
      }
      return;
    });
  return ZodAny.create();
}
__name(custom, "custom");
var late = {
  object: ZodObject.lazycreate
};
var ZodFirstPartyTypeKind;
(function(ZodFirstPartyTypeKind2) {
  ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
  ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
  ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
  ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
  ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
  ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
  ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
  ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
  ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
  ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
  ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
  ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
  ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
  ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
  ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
  ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
  ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
  ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
  ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
  ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
  ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
  ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
  ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
  ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
  ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
  ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
  ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
  ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
  ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
  ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
  ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
  ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
  ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
  ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
  ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
  ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
var instanceOfType = /* @__PURE__ */ __name((cls, params = {
  message: `Input not instance of ${cls.name}`
}) => custom((data) => data instanceof cls, params), "instanceOfType");
var stringType = ZodString.create;
var numberType = ZodNumber.create;
var nanType = ZodNaN.create;
var bigIntType = ZodBigInt.create;
var booleanType = ZodBoolean.create;
var dateType = ZodDate.create;
var symbolType = ZodSymbol.create;
var undefinedType = ZodUndefined.create;
var nullType = ZodNull.create;
var anyType = ZodAny.create;
var unknownType = ZodUnknown.create;
var neverType = ZodNever.create;
var voidType = ZodVoid.create;
var arrayType = ZodArray.create;
var objectType = ZodObject.create;
var strictObjectType = ZodObject.strictCreate;
var unionType = ZodUnion.create;
var discriminatedUnionType = ZodDiscriminatedUnion.create;
var intersectionType = ZodIntersection.create;
var tupleType = ZodTuple.create;
var recordType = ZodRecord.create;
var mapType = ZodMap.create;
var setType = ZodSet.create;
var functionType = ZodFunction.create;
var lazyType = ZodLazy.create;
var literalType = ZodLiteral.create;
var enumType = ZodEnum.create;
var nativeEnumType = ZodNativeEnum.create;
var promiseType = ZodPromise.create;
var effectsType = ZodEffects.create;
var optionalType = ZodOptional.create;
var nullableType = ZodNullable.create;
var preprocessType = ZodEffects.createWithPreprocess;
var pipelineType = ZodPipeline.create;
var ostring = /* @__PURE__ */ __name(() => stringType().optional(), "ostring");
var onumber = /* @__PURE__ */ __name(() => numberType().optional(), "onumber");
var oboolean = /* @__PURE__ */ __name(() => booleanType().optional(), "oboolean");
var coerce = {
  string: /* @__PURE__ */ __name((arg) => ZodString.create({ ...arg, coerce: true }), "string"),
  number: /* @__PURE__ */ __name((arg) => ZodNumber.create({ ...arg, coerce: true }), "number"),
  boolean: /* @__PURE__ */ __name((arg) => ZodBoolean.create({
    ...arg,
    coerce: true
  }), "boolean"),
  bigint: /* @__PURE__ */ __name((arg) => ZodBigInt.create({ ...arg, coerce: true }), "bigint"),
  date: /* @__PURE__ */ __name((arg) => ZodDate.create({ ...arg, coerce: true }), "date")
};
var NEVER = INVALID;

// ../../packages/schemas/dist/platform.js
var Platform = external_exports.enum([
  "facebook",
  "instagram",
  "tiktok",
  "x",
  "xiaohongshu",
  "linkedin"
]);
var ExecutionMode = external_exports.enum(["api", "cloud_browser", "extension_browser"]);
var Action = external_exports.enum([
  "publish_post",
  "publish_video",
  "schedule_post",
  "send_dm",
  "upload_media",
  "resolve_profile",
  "like_post",
  "comment_post",
  "search_feeds",
  "get_feed_detail"
]);
var Capability = external_exports.object({
  supportsApi: external_exports.boolean().default(false),
  supportsCloudBrowser: external_exports.boolean().default(false),
  supportsExtensionBrowser: external_exports.boolean().default(false),
  actions: external_exports.record(external_exports.string(), external_exports.object({ modes: external_exports.array(ExecutionMode) })).default({})
});

// ../../packages/schemas/dist/action.js
var TraceContextSchema = external_exports.object({
  runId: external_exports.string(),
  nodeId: external_exports.string()
});
var PolicyContextSchema = external_exports.object({
  requiresApproval: external_exports.boolean().default(false),
  maxPostsPerDay: external_exports.number().int().optional(),
  dmSafetyLevel: external_exports.enum(["high", "standard"]).optional()
});
var ActionRequestSchema = external_exports.object({
  requestId: external_exports.string(),
  userId: external_exports.string(),
  workspaceId: external_exports.string(),
  platform: Platform,
  action: Action,
  mode: ExecutionMode,
  payload: external_exports.unknown(),
  policyContext: PolicyContextSchema.default({ requiresApproval: false }),
  traceContext: TraceContextSchema
});
var EvidenceSchema = external_exports.object({
  url: external_exports.string().url().optional(),
  screenshotArtifactId: external_exports.string().optional()
});
var ActionErrorSchema = external_exports.object({
  type: external_exports.string().optional(),
  message: external_exports.string().optional(),
  retriable: external_exports.boolean().optional()
});
var ActionResultSchema = external_exports.object({
  ok: external_exports.boolean(),
  platformPostId: external_exports.string().optional(),
  platformMessageId: external_exports.string().optional(),
  evidence: EvidenceSchema.optional(),
  error: ActionErrorSchema.optional(),
  raw: external_exports.record(external_exports.string(), external_exports.unknown()).optional()
});

// ../../packages/schemas/dist/workflow.js
var WorkflowRunStatus = external_exports.enum([
  "pending",
  "running",
  "waiting_approval",
  "waiting_extension",
  "completed",
  "failed"
]);
var NodeRunStatus = external_exports.enum([
  "pending",
  "running",
  "waiting",
  "completed",
  "failed"
]);
var NodeSchema = external_exports.object({
  id: external_exports.string(),
  type: external_exports.string(),
  inputs: external_exports.record(external_exports.string(), external_exports.unknown()).optional(),
  retryPolicy: external_exports.object({ attempts: external_exports.number().int().default(1), delayMs: external_exports.number().int().default(0) }).optional(),
  timeoutMs: external_exports.number().int().optional()
});
var EdgeSchema = external_exports.object({
  from: external_exports.string(),
  to: external_exports.string(),
  condition: external_exports.string().optional()
});
var WorkflowSchema = external_exports.object({
  id: external_exports.string(),
  version: external_exports.string(),
  nodes: external_exports.array(NodeSchema),
  edges: external_exports.array(EdgeSchema).default([]),
  metadata: external_exports.record(external_exports.string(), external_exports.unknown()).optional()
});

// ../../packages/schemas/dist/trace.js
var TraceEventSchema = external_exports.union([
  external_exports.object({ t: external_exports.literal("RunStarted"), runId: external_exports.string(), at: external_exports.string() }),
  external_exports.object({ t: external_exports.literal("NodeStarted"), runId: external_exports.string(), nodeId: external_exports.string(), at: external_exports.string(), inputRef: external_exports.string().optional() }),
  external_exports.object({ t: external_exports.literal("NodeCompleted"), runId: external_exports.string(), nodeId: external_exports.string(), at: external_exports.string(), outputRef: external_exports.string().optional() }),
  external_exports.object({ t: external_exports.literal("ActionRequested"), runId: external_exports.string(), nodeId: external_exports.string(), requestId: external_exports.string(), platform: external_exports.string(), action: external_exports.string(), mode: external_exports.string(), at: external_exports.string() }),
  external_exports.object({ t: external_exports.literal("ActionResultReceived"), runId: external_exports.string(), requestId: external_exports.string(), ok: external_exports.boolean(), at: external_exports.string(), error: external_exports.unknown().optional() })
]);

// ../../packages/schemas/dist/policy.js
var QuotaRuleSchema = external_exports.object({
  action: Action,
  limitPerDay: external_exports.number().int().positive(),
  cooldownSec: external_exports.number().int().nonnegative().default(0)
});
var PolicySchema = external_exports.object({
  requiresApproval: external_exports.boolean().default(false),
  quotas: external_exports.array(QuotaRuleSchema).default([]),
  blockedWords: external_exports.array(external_exports.string()).default([])
});

// ../../packages/schemas/dist/automation.js
function calculateNextRun(cronExpression, fromDate = /* @__PURE__ */ new Date()) {
  const parts = cronExpression.split(" ");
  if (parts.length !== 5) {
    throw new Error("Invalid cron expression");
  }
  const [minute, hour] = parts;
  const next = new Date(fromDate);
  if (minute !== "*") {
    next.setMinutes(parseInt(minute, 10));
  }
  if (hour !== "*") {
    next.setHours(parseInt(hour, 10));
  }
  if (next <= fromDate) {
    next.setDate(next.getDate() + 1);
  }
  next.setSeconds(0);
  next.setMilliseconds(0);
  return next;
}
__name(calculateNextRun, "calculateNextRun");

// src/routes/automations.ts
async function handleAutomations(request, url, env) {
  const path = url.pathname;
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders2() });
  }
  if (request.method === "GET" && path === "/automations") {
    const userId = url.searchParams.get("userId") || "default";
    const workspaceId = url.searchParams.get("workspaceId") || "default";
    try {
      const { results } = await env.D1.prepare(`
        SELECT * FROM automations
        WHERE user_id = ? AND workspace_id = ?
        ORDER BY created_at DESC
      `).bind(userId, workspaceId).all();
      const automations = (results || []).map(rowToAutomation);
      return jsonWithCors2({ ok: true, automations });
    } catch (err) {
      return jsonWithCors2({ ok: false, error: String(err) }, 500);
    }
  }
  if (request.method === "POST" && path === "/automations") {
    try {
      const body = await request.json();
      if (!body.name || !body.type || !body.config) {
        return jsonWithCors2({ ok: false, error: "Missing required fields" }, 400);
      }
      const id = `auto_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const userId = body.userId || "default";
      const workspaceId = body.workspaceId || "default";
      const cronExpression = body.config.schedule?.cronExpression || "0 9 * * *";
      const nextRunAt = calculateNextRun(cronExpression).toISOString();
      await env.D1.prepare(`
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
      return jsonWithCors2({ ok: true, id, nextRunAt });
    } catch (err) {
      return jsonWithCors2({ ok: false, error: String(err) }, 500);
    }
  }
  if (request.method === "GET" && path.match(/^\/automations\/[^/]+$/)) {
    const id = path.split("/")[2];
    try {
      const { results } = await env.D1.prepare(
        "SELECT * FROM automations WHERE id = ?"
      ).bind(id).all();
      if (!results || results.length === 0) {
        return jsonWithCors2({ ok: false, error: "Not found" }, 404);
      }
      return jsonWithCors2({ ok: true, automation: rowToAutomation(results[0]) });
    } catch (err) {
      return jsonWithCors2({ ok: false, error: String(err) }, 500);
    }
  }
  if (request.method === "PUT" && path.match(/^\/automations\/[^/]+$/)) {
    const id = path.split("/")[2];
    try {
      const body = await request.json();
      const updates = ["updated_at = datetime('now')"];
      const values = [];
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
      await env.D1.prepare(`
        UPDATE automations SET ${updates.join(", ")} WHERE id = ?
      `).bind(...values).run();
      return jsonWithCors2({ ok: true });
    } catch (err) {
      return jsonWithCors2({ ok: false, error: String(err) }, 500);
    }
  }
  if (request.method === "DELETE" && path.match(/^\/automations\/[^/]+$/)) {
    const id = path.split("/")[2];
    try {
      await env.D1.prepare("DELETE FROM automations WHERE id = ?").bind(id).run();
      return jsonWithCors2({ ok: true });
    } catch (err) {
      return jsonWithCors2({ ok: false, error: String(err) }, 500);
    }
  }
  if (request.method === "POST" && path.match(/^\/automations\/[^/]+\/pause$/)) {
    const id = path.split("/")[2];
    try {
      await env.D1.prepare(`
        UPDATE automations SET status = 'paused', updated_at = datetime('now') WHERE id = ?
      `).bind(id).run();
      return jsonWithCors2({ ok: true });
    } catch (err) {
      return jsonWithCors2({ ok: false, error: String(err) }, 500);
    }
  }
  if (request.method === "POST" && path.match(/^\/automations\/[^/]+\/resume$/)) {
    const id = path.split("/")[2];
    try {
      const { results } = await env.D1.prepare(
        "SELECT cron_expression FROM automations WHERE id = ?"
      ).bind(id).all();
      const cronExpression = results?.[0]?.cron_expression || "0 9 * * *";
      const nextRunAt = calculateNextRun(cronExpression).toISOString();
      await env.D1.prepare(`
        UPDATE automations
        SET status = 'active', next_run_at = ?, updated_at = datetime('now')
        WHERE id = ?
      `).bind(nextRunAt, id).run();
      return jsonWithCors2({ ok: true, nextRunAt });
    } catch (err) {
      return jsonWithCors2({ ok: false, error: String(err) }, 500);
    }
  }
  if (request.method === "POST" && path.match(/^\/automations\/[^/]+\/run$/)) {
    const id = path.split("/")[2];
    try {
      await env.D1.prepare(`
        UPDATE automations
        SET next_run_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).bind(id).run();
      return jsonWithCors2({ ok: true, message: "Automation will run on next scheduler cycle" });
    } catch (err) {
      return jsonWithCors2({ ok: false, error: String(err) }, 500);
    }
  }
  if (request.method === "GET" && path.match(/^\/automations\/[^/]+\/history$/)) {
    const id = path.split("/")[2];
    const limit = parseInt(url.searchParams.get("limit") || "10", 10);
    try {
      const { results } = await env.D1.prepare(`
        SELECT * FROM automation_runs
        WHERE automation_id = ?
        ORDER BY started_at DESC
        LIMIT ?
      `).bind(id, limit).all();
      const runs = (results || []).map((row) => ({
        id: row.id,
        automationId: row.automation_id,
        status: row.status,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        actionsCount: row.actions_count,
        error: row.error,
        result: row.result ? JSON.parse(row.result) : null
      }));
      return jsonWithCors2({ ok: true, runs });
    } catch (err) {
      return jsonWithCors2({ ok: false, error: String(err) }, 500);
    }
  }
  return null;
}
__name(handleAutomations, "handleAutomations");
function rowToAutomation(row) {
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
__name(rowToAutomation, "rowToAutomation");
function corsHeaders2() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}
__name(corsHeaders2, "corsHeaders");
function jsonWithCors2(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
      ...corsHeaders2()
    }
  });
}
__name(jsonWithCors2, "jsonWithCors");

// src/routes/pending-posts.ts
async function handlePendingPosts(request, url, env) {
  const path = url.pathname;
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders3() });
  }
  if (request.method === "GET" && path === "/pending-posts") {
    const userId = url.searchParams.get("userId") || "default";
    const workspaceId = url.searchParams.get("workspaceId") || "default";
    const status = url.searchParams.get("status") || "pending";
    const limit = parseInt(url.searchParams.get("limit") || "20", 10);
    try {
      const { results } = await env.D1.prepare(`
        SELECT * FROM pending_posts
        WHERE user_id = ? AND workspace_id = ? AND status = ?
        ORDER BY generated_at DESC
        LIMIT ?
      `).bind(userId, workspaceId, status, limit).all();
      const posts = (results || []).map(rowToPendingPost);
      return jsonWithCors3({ ok: true, posts });
    } catch (err) {
      return jsonWithCors3({ ok: false, error: String(err) }, 500);
    }
  }
  if (request.method === "GET" && path.match(/^\/pending-posts\/[^/]+$/)) {
    const id = path.split("/")[2];
    try {
      const { results } = await env.D1.prepare(
        "SELECT * FROM pending_posts WHERE id = ?"
      ).bind(id).all();
      if (!results || results.length === 0) {
        return jsonWithCors3({ ok: false, error: "Not found" }, 404);
      }
      return jsonWithCors3({ ok: true, post: rowToPendingPost(results[0]) });
    } catch (err) {
      return jsonWithCors3({ ok: false, error: String(err) }, 500);
    }
  }
  if (request.method === "POST" && path.match(/^\/pending-posts\/[^/]+\/approve$/)) {
    const id = path.split("/")[2];
    try {
      const body = await request.json();
      const { results } = await env.D1.prepare(
        "SELECT * FROM pending_posts WHERE id = ?"
      ).bind(id).all();
      if (!results || results.length === 0) {
        return jsonWithCors3({ ok: false, error: "Not found" }, 404);
      }
      const post = rowToPendingPost(results[0]);
      if (post.status !== "pending") {
        return jsonWithCors3({ ok: false, error: `Post already ${post.status}` }, 400);
      }
      const finalTitle = body.title || post.title;
      const finalContent = body.content || post.content;
      const finalTags = body.tags || post.tags;
      const finalImages = body.images || post.images;
      await env.D1.prepare(`
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
      let publishResult = {};
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
          publishResult = await publishResp.json();
          publishSuccess = publishResp.ok && publishResult.success === true;
          if (publishSuccess) {
            await env.D1.prepare(`
              UPDATE pending_posts
              SET status = 'published',
                  published_at = datetime('now'),
                  publish_result = ?
              WHERE id = ?
            `).bind(JSON.stringify(publishResult), id).run();
          } else {
            await env.D1.prepare(`
              UPDATE pending_posts
              SET status = 'failed',
                  publish_result = ?
              WHERE id = ?
            `).bind(JSON.stringify(publishResult), id).run();
          }
        } catch (publishErr) {
          publishResult = { error: String(publishErr) };
          await env.D1.prepare(`
            UPDATE pending_posts
            SET status = 'failed',
                publish_result = ?
            WHERE id = ?
          `).bind(JSON.stringify(publishResult), id).run();
        }
      } else {
        publishResult = { message: "XHS_MCP_BASE not configured, post approved but not published" };
      }
      return jsonWithCors3({
        ok: true,
        published: publishSuccess,
        publishResult
      });
    } catch (err) {
      return jsonWithCors3({ ok: false, error: String(err) }, 500);
    }
  }
  if (request.method === "POST" && path.match(/^\/pending-posts\/[^/]+\/reject$/)) {
    const id = path.split("/")[2];
    try {
      const body = await request.json();
      const { results } = await env.D1.prepare(
        "SELECT status FROM pending_posts WHERE id = ?"
      ).bind(id).all();
      if (!results || results.length === 0) {
        return jsonWithCors3({ ok: false, error: "Not found" }, 404);
      }
      const status = results[0].status;
      if (status !== "pending") {
        return jsonWithCors3({ ok: false, error: `Post already ${status}` }, 400);
      }
      await env.D1.prepare(`
        UPDATE pending_posts
        SET status = 'rejected',
            rejection_reason = ?,
            reviewed_at = datetime('now')
        WHERE id = ?
      `).bind(body.reason || null, id).run();
      return jsonWithCors3({ ok: true });
    } catch (err) {
      return jsonWithCors3({ ok: false, error: String(err) }, 500);
    }
  }
  if (request.method === "DELETE" && path.match(/^\/pending-posts\/[^/]+$/)) {
    const id = path.split("/")[2];
    try {
      await env.D1.prepare("DELETE FROM pending_posts WHERE id = ?").bind(id).run();
      return jsonWithCors3({ ok: true });
    } catch (err) {
      return jsonWithCors3({ ok: false, error: String(err) }, 500);
    }
  }
  if (request.method === "POST" && path.match(/^\/pending-posts\/[^/]+\/regenerate$/)) {
    const id = path.split("/")[2];
    try {
      const { results } = await env.D1.prepare(`
        SELECT pp.*, a.config as automation_config
        FROM pending_posts pp
        JOIN automations a ON pp.automation_id = a.id
        WHERE pp.id = ?
      `).bind(id).all();
      if (!results || results.length === 0) {
        return jsonWithCors3({ ok: false, error: "Not found" }, 404);
      }
      const row = results[0];
      if (row.status !== "pending") {
        return jsonWithCors3({ ok: false, error: `Post already ${row.status}` }, 400);
      }
      return jsonWithCors3({
        ok: true,
        message: "Regeneration requires triggering the automation again. Use the automation run endpoint."
      });
    } catch (err) {
      return jsonWithCors3({ ok: false, error: String(err) }, 500);
    }
  }
  if (request.method === "GET" && path === "/pending-posts/stats") {
    const userId = url.searchParams.get("userId") || "default";
    const workspaceId = url.searchParams.get("workspaceId") || "default";
    try {
      const { results } = await env.D1.prepare(`
        SELECT status, COUNT(*) as count
        FROM pending_posts
        WHERE user_id = ? AND workspace_id = ?
        GROUP BY status
      `).bind(userId, workspaceId).all();
      const stats = {
        pending: 0,
        approved: 0,
        rejected: 0,
        published: 0,
        failed: 0
      };
      for (const row of results || []) {
        const r = row;
        stats[r.status] = r.count;
      }
      return jsonWithCors3({ ok: true, stats });
    } catch (err) {
      return jsonWithCors3({ ok: false, error: String(err) }, 500);
    }
  }
  return null;
}
__name(handlePendingPosts, "handlePendingPosts");
function rowToPendingPost(row) {
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
    status: row.status,
    rejectionReason: row.rejection_reason,
    generatedAt: row.generated_at,
    reviewedAt: row.reviewed_at,
    publishedAt: row.published_at,
    publishResult: row.publish_result ? JSON.parse(row.publish_result) : null
  };
}
__name(rowToPendingPost, "rowToPendingPost");
function corsHeaders3() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}
__name(corsHeaders3, "corsHeaders");
function jsonWithCors3(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
      ...corsHeaders3()
    }
  });
}
__name(jsonWithCors3, "jsonWithCors");

// src/index.ts
registerBuiltinNodes();
var logger = createLogger("api-worker");
var runsMemory = /* @__PURE__ */ new Map();
var pendingActionsMemory = /* @__PURE__ */ new Map();
var actionResultsMemory = /* @__PURE__ */ new Map();
var src_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/xhs/")) {
      try {
        const xhsResponse = await handleXiaohongshu(request, url, env);
        if (xhsResponse) return xhsResponse;
      } catch (err) {
        logger.error("XHS route error", { err: String(err) });
        return json({ ok: false, error: "xhs_error", message: String(err) }, 500);
      }
    }
    if (url.pathname.startsWith("/automations")) {
      try {
        const automationsResponse = await handleAutomations(request, url, env);
        if (automationsResponse) return automationsResponse;
      } catch (err) {
        logger.error("Automations route error", { err: String(err) });
        return json({ ok: false, error: "automations_error", message: String(err) }, 500);
      }
    }
    if (url.pathname.startsWith("/pending-posts")) {
      try {
        const pendingPostsResponse = await handlePendingPosts(request, url, env);
        if (pendingPostsResponse) return pendingPostsResponse;
      } catch (err) {
        logger.error("Pending posts route error", { err: String(err) });
        return json({ ok: false, error: "pending_posts_error", message: String(err) }, 500);
      }
    }
    if (request.method === "POST" && url.pathname === "/runs") {
      try {
        const body = await request.json();
        if (!body?.graph) {
          return json({ ok: false, error: "missing_graph" }, 400);
        }
        const runId = body.runId ?? `run_${Date.now()}`;
        const traceEvents = [];
        const record = {
          id: runId,
          status: "running",
          graph: body.graph,
          input: body.input ?? {},
          trace: traceEvents
        };
        runsMemory.set(runId, record);
        await saveRun(env, record);
        try {
          const result = await executeWorkflow(body.graph, body.input ?? {}, {
            runId,
            logger,
            artifacts: void 0,
            trace: /* @__PURE__ */ __name((event) => {
              traceEvents.push({ ...event, at: event.at ?? nowIso() });
            }, "trace")
          });
          record.status = "completed";
          record.outputs = result.outputs;
          await saveRun(env, record);
          return json({ ok: true, runId, status: record.status, outputs: result.outputs, trace: traceEvents });
        } catch (err) {
          if (err instanceof NeedsApprovalError) {
            record.status = "waiting_approval";
            record.pendingApproval = err.payload;
            await saveRun(env, record);
            return json({ ok: true, runId, status: record.status, pendingApproval: err.payload, trace: traceEvents });
          }
          record.status = "failed";
          record.error = String(err);
          logger.error("run failed", { err: String(err) });
          await saveRun(env, record);
          return json({ ok: false, runId, error: "execution_failed", message: String(err), trace: traceEvents }, 500);
        }
      } catch (err) {
        logger.error("run failed", { err: String(err) });
        return json({ ok: false, error: "execution_failed", message: String(err) }, 500);
      }
    }
    if (request.method === "GET" && url.pathname.startsWith("/runs/")) {
      const runId = url.pathname.split("/")[2];
      const record = await getRun(env, runId) ?? runsMemory.get(runId);
      if (!record) return json({ ok: false, error: "not_found" }, 404);
      return json({ ok: true, run: record });
    }
    if (request.method === "POST" && url.pathname === "/approvals") {
      try {
        const body = await request.json();
        const runId = body?.runId;
        const approved = Boolean(body?.approved);
        if (!runId) return json({ ok: false, error: "missing_runId" }, 400);
        const record = await getRun(env, runId) ?? runsMemory.get(runId);
        if (!record) return json({ ok: false, error: "not_found" }, 404);
        if (record.status !== "waiting_approval") {
          return json({ ok: false, error: "not_waiting" }, 400);
        }
        if (!approved) {
          record.status = "failed";
          record.error = "rejected";
          await saveRun(env, record);
          return json({ ok: true, runId, status: record.status });
        }
        record.status = "completed";
        record.outputs = { approvedPayload: record.pendingApproval };
        record.trace.push({ t: "NodeCompleted", runId, nodeId: "approve_content", at: nowIso(), outputRef: "approved" });
        await saveRun(env, record);
        return json({ ok: true, runId, status: record.status, outputs: record.outputs });
      } catch (err) {
        return json({ ok: false, error: "approval_failed", message: String(err) }, 500);
      }
    }
    if (request.method === "POST" && url.pathname === "/actions") {
      try {
        const body = await request.json();
        const action = body;
        if (!action?.requestId || !action?.userId) {
          return json({ ok: false, error: "missing_fields" }, 400);
        }
        pendingActionsMemory.set(action.requestId, action);
        await savePendingAction(env, { ...action });
        return json({ ok: true, requestId: action.requestId });
      } catch (err) {
        return json({ ok: false, error: "action_create_failed", message: String(err) }, 500);
      }
    }
    if (request.method === "GET" && url.pathname === "/extension/poll") {
      const userId = url.searchParams.get("userId");
      if (!userId) return json({ ok: false, error: "missing_user" }, 400);
      const dbAction = await popPendingAction(env, userId);
      const memoryAction = Array.from(pendingActionsMemory.values()).find((a) => a.userId === userId);
      const chosen = dbAction ?? memoryAction;
      if (!chosen) return json({ ok: true, pending: false });
      if (memoryAction && memoryAction.requestId === chosen.requestId) pendingActionsMemory.delete(chosen.requestId);
      return json({ ok: true, pending: true, action: chosen });
    }
    if (request.method === "POST" && url.pathname === "/extension/result") {
      try {
        const body = await request.json();
        const requestId = body?.requestId;
        const result = body?.result;
        if (!requestId || !result) return json({ ok: false, error: "missing_fields" }, 400);
        const pendingAction = await getPendingAction(env, requestId) ?? pendingActionsMemory.get(requestId);
        pendingActionsMemory.delete(requestId);
        actionResultsMemory.set(requestId, result);
        await saveActionResult(env, { requestId, result });
        const runId = pendingAction?.traceContext?.runId ?? body?.runId;
        if (env.ORCHESTRATOR_BASE && runId) {
          await fetch(`${env.ORCHESTRATOR_BASE}/run/${encodeURIComponent(runId)}/action-result`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId, ok: result.ok })
          });
        }
        return json({ ok: true, requestId });
      } catch (err) {
        return json({ ok: false, error: "result_failed", message: String(err) }, 500);
      }
    }
    if (request.method === "GET" && url.pathname.startsWith("/actions/")) {
      const requestId = url.pathname.split("/")[2];
      const stored = await getActionResult(env, requestId) ?? (actionResultsMemory.has(requestId) ? { requestId, result: actionResultsMemory.get(requestId) } : void 0);
      if (!stored) return json({ ok: false, error: "not_found" }, 404);
      return json({ ok: true, result: stored.result });
    }
    return json({ ok: true, service: "api-worker" }, 200);
  }
};
function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" }
  });
}
__name(json, "json");

// ../../../../../../opt/homebrew/lib/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../../../opt/homebrew/lib/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-PyUoNl/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// ../../../../../../opt/homebrew/lib/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-PyUoNl/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
