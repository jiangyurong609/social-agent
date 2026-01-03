/**
 * Workflow builders for different automation types
 */

interface WorkflowContext {
  automationId: string;
  runId: string;
  userId: string;
  workspaceId: string;
  xhsMcpBase: string;
}

interface Workflow {
  id: string;
  version: string;
  nodes: WorkflowNode[];
  edges: never[];
  metadata?: Record<string, unknown>;
}

interface WorkflowNode {
  id: string;
  type: string;
  inputs?: Record<string, unknown>;
}

/**
 * Build workflow based on automation config type
 */
export function buildWorkflowForAutomation(config: any, ctx: WorkflowContext): Workflow {
  switch (config.type) {
    case "scheduled_post":
      return buildScheduledPostWorkflow(config, ctx);
    case "auto_engage":
      return buildAutoEngageWorkflow(config, ctx);
    case "content_discovery":
      return buildContentDiscoveryWorkflow(config, ctx);
    default:
      throw new Error(`Unknown automation type: ${config.type}`);
  }
}

/**
 * Scheduled Post Workflow
 * 1. Draft post from template
 * 2. Require approval (if enabled)
 * 3. Publish to Xiaohongshu
 */
function buildScheduledPostWorkflow(config: any, ctx: WorkflowContext): Workflow {
  const nodes: WorkflowNode[] = [
    {
      id: "draft",
      type: "draft_post",
      inputs: {
        title: config.template.title,
        content: config.template.content,
        images: config.template.images || [],
        tags: config.template.tags || []
      }
    },
    {
      id: "approve",
      type: "approve_content",
      inputs: {}
    },
    {
      id: "publish",
      type: "xhs_publish",
      inputs: {
        baseUrl: ctx.xhsMcpBase
      }
    }
  ];

  return {
    id: `scheduled_post_${ctx.runId}`,
    version: "1.0",
    nodes,
    edges: [],
    metadata: {
      automationId: ctx.automationId,
      type: "scheduled_post"
    }
  };
}

/**
 * Auto-Engage Workflow
 * 1. Search for posts by keywords
 * 2. Filter to top N posts
 * 3. For each post: like and/or comment
 */
function buildAutoEngageWorkflow(config: any, ctx: WorkflowContext): Workflow {
  // Rotate through keywords
  const keywordIndex = Date.now() % config.searchKeywords.length;
  const keyword = config.searchKeywords[keywordIndex];

  const nodes: WorkflowNode[] = [
    {
      id: "search",
      type: "xhs_search",
      inputs: {
        keyword,
        sortBy: "time_descending",
        baseUrl: ctx.xhsMcpBase
      }
    },
    {
      id: "filter",
      type: "filter_feeds",
      inputs: {
        maxPosts: config.limits?.maxPostsPerRun || 5,
        minLikes: config.filters?.minLikes,
        maxLikes: config.filters?.maxLikes,
        skipAuthors: config.filters?.skipAuthors
      }
    },
    {
      id: "engage",
      type: "batch_engage",
      inputs: {
        like: config.actions?.like ?? true,
        comment: config.actions?.comment ?? true,
        commentMode: config.actions?.commentMode || "template",
        commentTemplates: config.actions?.commentTemplates || [
          "很棒的分享！",
          "学到了，谢谢分享",
          "说得太好了",
          "收藏了，感谢",
          "很有帮助的内容"
        ],
        aiPrompt: config.actions?.aiPrompt,
        baseUrl: ctx.xhsMcpBase,
        userId: ctx.userId,
        workspaceId: ctx.workspaceId
      }
    }
  ];

  return {
    id: `auto_engage_${ctx.runId}`,
    version: "1.0",
    nodes,
    edges: [],
    metadata: {
      automationId: ctx.automationId,
      type: "auto_engage",
      keyword
    }
  };
}

/**
 * Content Discovery Workflow
 * 1. Search for trending content
 * 2. Optionally interact with discovered posts
 */
function buildContentDiscoveryWorkflow(config: any, ctx: WorkflowContext): Workflow {
  // Rotate through keywords
  const keywordIndex = Date.now() % config.keywords.length;
  const keyword = config.keywords[keywordIndex];

  const nodes: WorkflowNode[] = [
    {
      id: "search",
      type: "xhs_search",
      inputs: {
        keyword,
        sortBy: config.sortBy || "popularity_descending",
        baseUrl: ctx.xhsMcpBase
      }
    },
    {
      id: "filter",
      type: "filter_feeds",
      inputs: {
        maxPosts: config.limits?.maxPostsPerRun || 10
      }
    }
  ];

  // Add interaction nodes if enabled
  if (config.autoInteract) {
    nodes.push({
      id: "engage",
      type: "batch_engage",
      inputs: {
        like: config.interactConfig?.like ?? true,
        comment: config.interactConfig?.comment ?? false,
        commentTemplates: config.interactConfig?.commentTemplates || [],
        baseUrl: ctx.xhsMcpBase,
        userId: ctx.userId,
        workspaceId: ctx.workspaceId
      }
    });
  }

  return {
    id: `content_discovery_${ctx.runId}`,
    version: "1.0",
    nodes,
    edges: [],
    metadata: {
      automationId: ctx.automationId,
      type: "content_discovery",
      keyword
    }
  };
}
