/**
 * Automation configuration types for Xiaohongshu account management
 */

// Base schedule configuration
export interface ScheduleConfig {
  cronExpression: string;  // e.g., "0 9 * * *" for 9 AM daily
  timezone?: string;  // e.g., "Asia/Shanghai"
}

// Content generation mode for AI-powered posts
export type ContentGenerationMode = 'static' | 'ai_topic' | 'ai_prompt';

// Image generation mode
export type ImageGenerationMode = 'uploaded' | 'text_screenshot' | 'external_api' | 'unsplash';

// AI generation configuration for post content
export interface AIGenerationConfig {
  mode: ContentGenerationMode;
  topics?: string[];           // For ai_topic mode - keywords/topics to write about
  customPrompt?: string;       // For ai_prompt mode - custom prompt template
  style?: {
    tone?: 'casual' | 'professional' | 'friendly' | 'informative';
    length?: 'short' | 'medium' | 'long';  // ~100, ~300, ~500 chars
    includeEmojis?: boolean;
  };
  autoGenerateTags?: boolean;
  maxTags?: number;
}

// Image generation configuration
export interface ImageGenerationConfig {
  mode: ImageGenerationMode;
  uploadedImages?: string[];   // For uploaded mode - base64 or URLs
  textScreenshot?: {           // For text_screenshot mode - notebook style
    backgroundColor?: string;
    textColor?: string;
    fontFamily?: string;
    includeTitle?: boolean;
  };
  externalApi?: {              // For external_api mode (e.g., nano banana)
    provider: 'nano_banana' | 'custom';
    apiEndpoint?: string;
    prompt?: string;           // Image generation prompt
  };
  unsplash?: {                 // For unsplash mode - fetch from Unsplash
    searchQuery?: string;      // Custom search query (defaults to tags/title)
    count?: number;            // Number of images to fetch (1-9, default 3)
    orientation?: 'landscape' | 'portrait' | 'squarish';  // Image orientation
  };
}

// Scheduled Post Configuration (updated with AI support)
export interface ScheduledPostConfig {
  type: 'scheduled_post';
  // Static template (backwards compatible)
  template?: {
    title: string;
    content: string;
    images?: string[];  // Base64 or URLs
    tags?: string[];
  };
  // AI generation config (new)
  aiGeneration?: AIGenerationConfig;
  // Image generation config (new)
  imageGeneration?: ImageGenerationConfig;
  // Common fields
  schedule: ScheduleConfig;
  requiresApproval: true;  // Always requires approval
}

// Auto-Engage Configuration
export interface AutoEngageConfig {
  type: 'auto_engage';
  searchKeywords: string[];  // Keywords to search for
  actions: {
    like: boolean;
    comment: boolean;
    commentMode: 'template' | 'ai' | 'both';
    commentTemplates?: string[];  // Pre-defined comment templates
    aiPrompt?: string;  // Custom AI prompt for generating comments
  };
  filters?: {
    minLikes?: number;  // Only engage with posts having at least N likes
    maxLikes?: number;  // Skip very popular posts
    skipAuthors?: string[];  // Author IDs to skip
  };
  limits: {
    maxPostsPerRun: number;  // Max posts to engage with per run (e.g., 5)
    maxCommentsPerDay: number;  // Daily comment limit (e.g., 20)
    maxLikesPerDay: number;  // Daily like limit (e.g., 50)
  };
  schedule: ScheduleConfig;
}

// Content Discovery Configuration
export interface ContentDiscoveryConfig {
  type: 'content_discovery';
  keywords: string[];
  sortBy: 'general' | 'time_descending' | 'popularity_descending';
  autoInteract: boolean;  // Automatically like/comment on discovered content
  interactConfig?: {
    like: boolean;
    comment: boolean;
    commentTemplates?: string[];
  };
  limits: {
    maxPostsPerRun: number;
  };
  schedule: ScheduleConfig;
}

// Union type for all automation configs
export type AutomationConfig = ScheduledPostConfig | AutoEngageConfig | ContentDiscoveryConfig;

// Automation status
export type AutomationStatus = 'active' | 'paused' | 'disabled';

// Automation type
export type AutomationType = 'scheduled_post' | 'auto_engage' | 'content_discovery';

// Full automation record (as stored in DB)
export interface Automation {
  id: string;
  userId: string;
  workspaceId: string;
  name: string;
  type: AutomationType;
  config: AutomationConfig;
  cronExpression: string | null;
  status: AutomationStatus;
  lastRunAt: string | null;
  nextRunAt: string | null;
  runCount: number;
  errorCount: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

// Automation run record
export interface AutomationRun {
  id: string;
  automationId: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt: string | null;
  actionsCount: number;
  error: string | null;
  result: AutomationRunResult | null;
}

// Result summary for a run
export interface AutomationRunResult {
  postsFound?: number;
  postsEngaged?: number;
  likesCount?: number;
  commentsCount?: number;
  postsPublished?: number;
  errors?: string[];
}

// Daily usage for rate limiting
export interface AutomationUsage {
  userId: string;
  date: string;  // YYYY-MM-DD
  commentsCount: number;
  likesCount: number;
  postsCount: number;
}

// API request types
export interface CreateAutomationRequest {
  name: string;
  type: AutomationType;
  config: AutomationConfig;
}

export interface UpdateAutomationRequest {
  name?: string;
  config?: AutomationConfig;
  status?: AutomationStatus;
}

// Default AI prompt for comment generation
export const DEFAULT_AI_COMMENT_PROMPT = `Generate a short, friendly Chinese comment (10-30 characters) for this Xiaohongshu post.
Title: {title}
Content: {content}

Requirements:
- Keep it natural and conversational
- Be encouraging or show genuine interest
- Don't use emojis unless the post uses them
- Avoid generic responses like "很棒" or "不错"
- Make it relevant to the post content`;

// Default AI prompt for post generation
export const DEFAULT_AI_POST_PROMPT = `You are a professional Xiaohongshu (Little Red Book) content creator.
Create engaging Chinese content suitable for the platform.

Requirements:
- Title: Catchy, 10-20 characters, use hooks or curiosity gaps
- Content: {length} characters ({lengthGuide})
- Tone: {tone}
- {emojiGuide}
- Format content with line breaks for readability
- End with a call-to-action or question to drive engagement

Return your response in this exact JSON format:
{
  "title": "your title here",
  "content": "your content here",
  "tags": ["tag1", "tag2", "tag3"]
}`;

// Pending post status
export type PendingPostStatus = 'pending' | 'approved' | 'rejected' | 'published' | 'failed';

// Pending post record (for approval queue)
export interface PendingPost {
  id: string;
  automationId: string;
  userId: string;
  workspaceId: string;
  title: string;
  content: string;
  images: string[];
  tags: string[];
  generationMode: ContentGenerationMode;
  generationPrompt: string | null;
  generationModel: string | null;
  status: PendingPostStatus;
  rejectionReason: string | null;
  generatedAt: string;
  reviewedAt: string | null;
  publishedAt: string | null;
  publishResult: Record<string, unknown> | null;
}

// Helper to calculate next run time from cron expression
export function calculateNextRun(cronExpression: string, fromDate: Date = new Date()): Date {
  // Simple cron parser for common patterns
  // Format: minute hour dayOfMonth month dayOfWeek
  const parts = cronExpression.split(' ');
  if (parts.length !== 5) {
    throw new Error('Invalid cron expression');
  }

  const [minute, hour] = parts;
  const next = new Date(fromDate);

  // Set to next occurrence
  if (minute !== '*') {
    next.setMinutes(parseInt(minute, 10));
  }
  if (hour !== '*') {
    next.setHours(parseInt(hour, 10));
  }

  // If the time has passed today, move to tomorrow
  if (next <= fromDate) {
    next.setDate(next.getDate() + 1);
  }

  next.setSeconds(0);
  next.setMilliseconds(0);

  return next;
}
