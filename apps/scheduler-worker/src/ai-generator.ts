/**
 * AI Content Generator for Xiaohongshu Posts
 * Uses Google Gemini API to generate post titles, content, and tags
 */

import { AIGenerationConfig } from "@social-agent/schemas";

export interface GenerationResult {
  title: string;
  content: string;
  tags: string[];
}

interface GenerationOptions {
  mode: 'topic' | 'prompt';
  topics?: string[];
  customPrompt?: string;
  style?: {
    tone?: string;
    length?: string;
    includeEmojis?: boolean;
  };
  autoGenerateTags?: boolean;
  maxTags?: number;
}

const LENGTH_GUIDE: Record<string, { chars: string; range: string }> = {
  short: { chars: '100-150', range: '100-150' },
  medium: { chars: '200-350', range: '200-350' },
  long: { chars: '400-600', range: '400-600' }
};

/**
 * Generate post content using Gemini API
 */
export async function generateContent(
  apiKey: string,
  options: GenerationOptions
): Promise<GenerationResult> {
  const systemPrompt = buildSystemPrompt(options);
  const userPrompt = buildUserPrompt(options);

  // Call Gemini API
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: `${systemPrompt}\n\n${userPrompt}` }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 1024
        }
      })
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const data = await response.json() as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
    error?: { message?: string };
  };

  if (data.error) {
    throw new Error(`Gemini API error: ${data.error.message}`);
  }

  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textContent) {
    throw new Error('No text content in Gemini response');
  }

  return parseGeneratedContent(textContent, options);
}

/**
 * Generate content from AIGenerationConfig
 */
export async function generateFromConfig(
  apiKey: string,
  config: AIGenerationConfig
): Promise<GenerationResult> {
  return generateContent(apiKey, {
    mode: config.mode === 'ai_topic' ? 'topic' : 'prompt',
    topics: config.topics,
    customPrompt: config.customPrompt,
    style: config.style,
    autoGenerateTags: config.autoGenerateTags,
    maxTags: config.maxTags
  });
}

function buildSystemPrompt(options: GenerationOptions): string {
  const length = options.style?.length || 'medium';
  const guide = LENGTH_GUIDE[length] || LENGTH_GUIDE.medium;
  const tone = options.style?.tone || 'friendly';
  const emojiGuide = options.style?.includeEmojis
    ? 'Include relevant emojis to make the content more engaging'
    : 'Minimal emoji usage, only where appropriate';

  return `You are a professional Xiaohongshu (Little Red Book / 小红书) content creator.
Create engaging Chinese content suitable for the platform.

Content Guidelines:
- Title: Catchy, 10-20 characters, use hooks or curiosity gaps
- Content: ${guide.chars} characters
- Tone: ${tone}
- ${emojiGuide}
- Format content with line breaks for readability (use \\n)
- End with a call-to-action or question to drive engagement
- Make it relatable and shareable
- Use natural, conversational Chinese

IMPORTANT: Return your response in this exact JSON format only, no other text:
{
  "title": "your catchy title here",
  "content": "your post content here\\n\\nWith line breaks",
  "tags": ["标签1", "标签2", "标签3"]
}`;
}

function buildUserPrompt(options: GenerationOptions): string {
  if (options.mode === 'prompt' && options.customPrompt) {
    return `Create a Xiaohongshu post based on this prompt:

${options.customPrompt}

Generate ${options.maxTags || 5} relevant Chinese hashtags.`;
  }

  if (options.mode === 'topic' && options.topics?.length) {
    const topic = options.topics[Math.floor(Math.random() * options.topics.length)];
    return `Create a Xiaohongshu post about: ${topic}

Generate ${options.maxTags || 5} relevant Chinese hashtags that are popular on Xiaohongshu.`;
  }

  throw new Error('Invalid generation options: must provide either customPrompt or topics');
}

function parseGeneratedContent(text: string, options: GenerationOptions): GenerationResult {
  // Extract JSON from response (handle potential markdown code blocks)
  let jsonStr = text.trim();

  // Remove markdown code block if present
  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.slice(7);
  } else if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.slice(3);
  }
  if (jsonStr.endsWith('```')) {
    jsonStr = jsonStr.slice(0, -3);
  }
  jsonStr = jsonStr.trim();

  // Find JSON object
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse AI response: no JSON object found');
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      title?: string;
      content?: string;
      tags?: string[];
    };

    if (!parsed.title || !parsed.content) {
      throw new Error('Missing required fields in AI response');
    }

    return {
      title: parsed.title.slice(0, 40), // Limit title length
      content: parsed.content,
      tags: (parsed.tags || []).slice(0, options.maxTags || 5)
    };
  } catch (parseError) {
    throw new Error(`Failed to parse AI response: ${parseError}`);
  }
}
