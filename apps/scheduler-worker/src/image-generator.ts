/**
 * Image Generator for Xiaohongshu Posts
 * Supports uploaded images, text screenshots, external APIs, and Unsplash
 */

import { ImageGenerationConfig } from "@social-agent/schemas";

export interface ImageGenerationResult {
  images: string[];  // URLs or base64
  metadata?: Record<string, unknown>;
}

export interface TextScreenshotOptions {
  title: string;
  content: string;
  backgroundColor?: string;
  textColor?: string;
  fontFamily?: string;
  includeTitle?: boolean;
}

export interface ExternalApiOptions {
  provider: 'nano_banana' | 'custom';
  apiEndpoint?: string;
  apiKey: string;
  prompt: string;
}

export interface UnsplashOptions {
  accessKey: string;
  searchQuery: string;
  count?: number;
  orientation?: 'landscape' | 'portrait' | 'squarish';
}

/**
 * Generate images based on ImageGenerationConfig
 */
export async function generateImages(
  config: ImageGenerationConfig,
  context: { title: string; content: string; tags?: string[]; apiKey?: string; unsplashKey?: string }
): Promise<ImageGenerationResult> {
  switch (config.mode) {
    case 'uploaded':
      return handleUploadedImages(config);

    case 'text_screenshot':
      return generateTextScreenshot({
        title: context.title,
        content: context.content,
        ...config.textScreenshot
      });

    case 'external_api':
      if (!config.externalApi) {
        throw new Error('External API config required for external_api mode');
      }
      if (!context.apiKey) {
        throw new Error('API key required for external API image generation');
      }
      return generateViaExternalApi({
        ...config.externalApi,
        apiKey: context.apiKey,
        prompt: config.externalApi.prompt || `Illustration for Xiaohongshu post: ${context.title}`
      });

    case 'unsplash':
      if (!context.unsplashKey) {
        throw new Error('Unsplash access key required for unsplash mode');
      }
      return generateViaUnsplash({
        accessKey: context.unsplashKey,
        searchQuery: config.unsplash?.searchQuery ||
          context.tags?.join(' ') ||
          context.title,
        count: config.unsplash?.count || 3,
        orientation: config.unsplash?.orientation || 'portrait'
      });

    default:
      throw new Error(`Unsupported image generation mode: ${config.mode}`);
  }
}

/**
 * Handle uploaded images - just validate and pass through
 */
function handleUploadedImages(config: ImageGenerationConfig): ImageGenerationResult {
  const images = config.uploadedImages || [];

  if (images.length === 0) {
    throw new Error('No images provided for uploaded mode');
  }

  // Validate images are URLs or base64
  const validImages = images.filter(img =>
    img.startsWith('http') ||
    img.startsWith('https') ||
    img.startsWith('data:image')
  );

  if (validImages.length === 0) {
    throw new Error('No valid image URLs or base64 data provided');
  }

  return {
    images: validImages,
    metadata: { mode: 'uploaded', count: validImages.length }
  };
}

/**
 * Generate a text-based screenshot image in Xiaohongshu notebook style.
 * This creates an image with text overlay - useful for quote/tip style posts.
 *
 * NOTE: This requires an external service to render HTML to image.
 * For MVP, we'll use a placeholder or skip this functionality.
 */
export async function generateTextScreenshot(
  options: TextScreenshotOptions
): Promise<ImageGenerationResult> {
  // TODO: Integrate with image rendering service
  // Options:
  // 1. Use a serverless function with Puppeteer/Playwright
  // 2. Use a service like html2canvas or screenshot.api
  // 3. Use a headless browser service

  // For now, throw an error indicating this is not yet implemented
  throw new Error(
    'Text screenshot generation is not yet implemented. ' +
    'Please use uploaded images or external API mode instead.'
  );

  // Future implementation would look like:
  // const html = generateNoteTemplate(options);
  // const imageUrl = await renderHtmlToImage(html);
  // return { images: [imageUrl], metadata: { mode: 'text_screenshot' } };
}

/**
 * Generate image via external API (e.g., Nano Banana, DALL-E, etc.)
 */
export async function generateViaExternalApi(
  options: ExternalApiOptions
): Promise<ImageGenerationResult> {
  if (options.provider === 'nano_banana') {
    return generateViaNanoBanana(options);
  }

  if (options.provider === 'custom' && options.apiEndpoint) {
    return generateViaCustomApi(options);
  }

  throw new Error(`Unsupported image provider: ${options.provider}`);
}

/**
 * Generate image via Nano Banana API
 */
async function generateViaNanoBanana(
  options: ExternalApiOptions
): Promise<ImageGenerationResult> {
  // Nano Banana API integration
  // Note: API documentation should be consulted for exact endpoint/parameters
  const endpoint = options.apiEndpoint || 'https://api.nanobanana.com/v1/generate';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${options.apiKey}`
    },
    body: JSON.stringify({
      prompt: options.prompt,
      width: 1080,
      height: 1440,  // 3:4 aspect ratio for Xiaohongshu
      style: 'illustration'  // or appropriate style parameter
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Nano Banana API error: ${response.status} - ${error}`);
  }

  const result = await response.json() as {
    image_url?: string;
    url?: string;
    data?: { url?: string };
  };

  const imageUrl = result.image_url || result.url || result.data?.url;
  if (!imageUrl) {
    throw new Error('No image URL in Nano Banana response');
  }

  return {
    images: [imageUrl],
    metadata: {
      provider: 'nano_banana',
      prompt: options.prompt
    }
  };
}

/**
 * Generate image via custom API endpoint
 */
async function generateViaCustomApi(
  options: ExternalApiOptions
): Promise<ImageGenerationResult> {
  if (!options.apiEndpoint) {
    throw new Error('API endpoint required for custom provider');
  }

  const response = await fetch(options.apiEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${options.apiKey}`
    },
    body: JSON.stringify({
      prompt: options.prompt
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Custom API error: ${response.status} - ${error}`);
  }

  const result = await response.json() as {
    images?: string[];
    image?: string;
    url?: string;
  };

  const images = result.images ||
    (result.image ? [result.image] : null) ||
    (result.url ? [result.url] : null);

  if (!images || images.length === 0) {
    throw new Error('No images in custom API response');
  }

  return {
    images,
    metadata: { provider: 'custom' }
  };
}

// Utility function for future text screenshot implementation
function generateNoteTemplate(options: TextScreenshotOptions): string {
  const {
    title,
    content,
    backgroundColor = '#FFF5E6',
    textColor = '#333333',
    fontFamily = 'PingFang SC, sans-serif',
    includeTitle = true
  } = options;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: ${fontFamily};
    }
    .container {
      width: 1080px;
      min-height: 1440px;
      background: ${backgroundColor};
      padding: 80px;
      box-sizing: border-box;
    }
    .title {
      font-size: 56px;
      font-weight: bold;
      color: ${textColor};
      margin-bottom: 40px;
      line-height: 1.4;
    }
    .content {
      font-size: 36px;
      line-height: 1.8;
      color: ${textColor};
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <div class="container">
    ${includeTitle ? `<div class="title">${escapeHtml(title)}</div>` : ''}
    <div class="content">${escapeHtml(content)}</div>
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\n/g, '<br>');
}

/**
 * Fetch images from Unsplash API based on search query
 * Returns high-quality, royalty-free images suitable for Xiaohongshu posts
 */
export async function generateViaUnsplash(
  options: UnsplashOptions
): Promise<ImageGenerationResult> {
  const { accessKey, searchQuery, count = 3, orientation = 'portrait' } = options;

  // Clean up search query - extract Chinese keywords or use as-is
  const cleanQuery = cleanSearchQuery(searchQuery);

  const url = new URL('https://api.unsplash.com/search/photos');
  url.searchParams.set('query', cleanQuery);
  url.searchParams.set('per_page', String(Math.min(count, 9))); // Max 9 for XHS
  url.searchParams.set('orientation', orientation);
  url.searchParams.set('order_by', 'relevant');

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Client-ID ${accessKey}`,
      'Accept-Version': 'v1'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Unsplash API error: ${response.status} - ${error}`);
  }

  const data = await response.json() as {
    results: Array<{
      id: string;
      urls: {
        raw: string;
        full: string;
        regular: string;
        small: string;
        thumb: string;
      };
      alt_description: string | null;
      user: {
        name: string;
        username: string;
      };
    }>;
    total: number;
  };

  if (!data.results || data.results.length === 0) {
    // Try a fallback search with English translation or generic terms
    return fallbackUnsplashSearch(accessKey, cleanQuery, count, orientation);
  }

  // Use 'regular' size (1080px wide) which is good for Xiaohongshu
  const images = data.results.map(photo => photo.urls.regular);

  return {
    images,
    metadata: {
      provider: 'unsplash',
      query: cleanQuery,
      count: images.length,
      photos: data.results.map(p => ({
        id: p.id,
        photographer: p.user.name,
        alt: p.alt_description
      }))
    }
  };
}

/**
 * Clean up search query for Unsplash
 * - Extract keywords from Chinese text
 * - Remove emojis and special characters
 */
function cleanSearchQuery(query: string): string {
  // Remove emojis
  const noEmoji = query.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');

  // Remove common Chinese filler words and punctuation
  const cleaned = noEmoji
    .replace(/[！？。，、：；""''【】《》]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // If query is too long, take first 50 chars
  if (cleaned.length > 50) {
    return cleaned.slice(0, 50);
  }

  return cleaned || 'lifestyle aesthetic';
}

/**
 * Fallback search if primary query returns no results
 */
async function fallbackUnsplashSearch(
  accessKey: string,
  originalQuery: string,
  count: number,
  orientation: string
): Promise<ImageGenerationResult> {
  // Try generic lifestyle/aesthetic terms as fallback
  const fallbackQueries = [
    'aesthetic lifestyle',
    'minimalist',
    'cozy aesthetic',
    'pastel colors',
    'flat lay'
  ];

  const fallbackQuery = fallbackQueries[Math.floor(Math.random() * fallbackQueries.length)];

  const url = new URL('https://api.unsplash.com/search/photos');
  url.searchParams.set('query', fallbackQuery);
  url.searchParams.set('per_page', String(Math.min(count, 9)));
  url.searchParams.set('orientation', orientation);

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Client-ID ${accessKey}`,
      'Accept-Version': 'v1'
    }
  });

  if (!response.ok) {
    throw new Error(`Unsplash fallback search failed: ${response.status}`);
  }

  const data = await response.json() as {
    results: Array<{
      id: string;
      urls: { regular: string };
      user: { name: string };
    }>;
  };

  if (!data.results || data.results.length === 0) {
    throw new Error('No images found on Unsplash for query or fallback');
  }

  const images = data.results.map(photo => photo.urls.regular);

  return {
    images,
    metadata: {
      provider: 'unsplash',
      query: fallbackQuery,
      originalQuery,
      fallback: true,
      count: images.length
    }
  };
}
