const API_BASE = import.meta.env.PROD
  ? 'https://social-agent-api.jiangyurong609.workers.dev'
  : '/api';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

async function request<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const resp = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
    return await resp.json();
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

// XHS Login APIs
export async function getXhsLoginQrcode() {
  return request<{ timeout: string; is_logged_in: boolean; img: string }>('/xhs/login/qrcode');
}

export async function getXhsLoginStatus() {
  return request<{ is_logged_in: boolean; username: string }>('/xhs/login/status');
}

export async function getXhsStatus() {
  const resp = await fetch(`${API_BASE}/xhs/status`);
  const data = await resp.json();
  // Handle {available, loggedIn, message} format
  return {
    success: true,
    data: {
      ok: data.available,
      loggedIn: data.loggedIn,
      message: data.message
    }
  };
}

// Feed interface matching API response
interface RawFeed {
  id: string;
  xsecToken: string;
  modelType: string;
  noteCard: {
    type: string;
    displayTitle: string;
    user: {
      userId: string;
      nickname: string;
      avatar: string;
    };
    interactInfo: {
      liked: boolean;
      likedCount: string;
      commentCount: string;
      collectedCount: string;
    };
    cover: {
      urlDefault: string;
      urlPre: string;
    };
  };
}

export interface Feed {
  id: string;
  xsec_token: string;
  title: string;
  cover?: string;
  author: string;
  likes: number;
}

// XHS Feed APIs
export async function searchXhsFeeds(params: {
  keyword: string;
  page?: number;
  sortBy?: string;
  noteType?: string;
}): Promise<ApiResponse<{ feeds: Feed[]; hasMore: boolean }>> {
  try {
    const resp = await fetch(`${API_BASE}/xhs/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const result = await resp.json();

    // Handle {ok, raw: {success, data: {feeds}}} format
    if (result.ok && result.raw?.data?.feeds) {
      const rawFeeds: RawFeed[] = result.raw.data.feeds;
      const feeds: Feed[] = rawFeeds
        .filter(f => f.modelType === 'note' && f.noteCard?.displayTitle)
        .map(f => ({
          id: f.id,
          xsec_token: f.xsecToken,
          title: f.noteCard.displayTitle,
          cover: f.noteCard.cover?.urlDefault || f.noteCard.cover?.urlPre,
          author: f.noteCard.user?.nickname || 'Unknown',
          likes: parseInt(f.noteCard.interactInfo?.likedCount || '0', 10),
        }));

      return {
        success: true,
        data: { feeds, hasMore: feeds.length >= 20 }
      };
    }

    return {
      success: false,
      error: result.raw?.message || result.message || 'Search failed'
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

export async function getXhsFeedDetail(params: {
  feedId: string;
  xsecToken: string;
  loadComments?: boolean;
  commentsCount?: number;
}) {
  try {
    const resp = await fetch(`${API_BASE}/xhs/detail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const result = await resp.json();

    // Handle {ok, raw: {success, data}} format
    if (result.ok && result.raw?.data) {
      const d = result.raw.data;
      return {
        success: true,
        data: {
          id: d.id || params.feedId,
          title: d.title || '',
          content: d.desc || d.content || '',
          images: d.imageList?.map((img: { url: string }) => img.url) || [],
          author: {
            id: d.user?.userId || '',
            name: d.user?.nickname || 'Unknown',
            avatar: d.user?.avatar || '',
          },
          likes: parseInt(d.interactInfo?.likedCount || '0', 10),
          comments: parseInt(d.interactInfo?.commentCount || '0', 10),
          collects: parseInt(d.interactInfo?.collectedCount || '0', 10),
        }
      };
    }

    return {
      success: false,
      error: result.raw?.message || 'Failed to get detail'
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

export async function likeXhsFeed(params: {
  feedId: string;
  xsecToken: string;
  like: boolean;
}) {
  return request<{ success: boolean }>('/xhs/like', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function commentXhsFeed(params: {
  feedId: string;
  xsecToken: string;
  content: string;
}) {
  return request<{ success: boolean; commentId: string }>('/xhs/comment', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function publishXhsPost(params: {
  title: string;
  content: string;
  images?: string[];
  tags?: string[];
}) {
  return request<{ success: boolean; noteId: string }>('/xhs/publish', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function publishXhsVideo(params: {
  title: string;
  content: string;
  videoUrl: string;
  tags?: string[];
}) {
  return request<{ success: boolean; noteId: string }>('/xhs/publish-video', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function getXhsProfile(userId: string) {
  return request<{
    id: string;
    name: string;
    avatar: string;
    followers: number;
    following: number;
    notes: number;
  }>('/xhs/profile', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}
