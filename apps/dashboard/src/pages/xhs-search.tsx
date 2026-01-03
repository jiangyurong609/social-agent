import { useState } from 'react'
import { Search, Heart, MessageSquare, Loader2, Image as ImageIcon } from 'lucide-react'
import { searchXhsFeeds, getXhsFeedDetail, likeXhsFeed, commentXhsFeed } from '../api/client'

interface Feed {
  id: string;
  xsec_token: string;
  title: string;
  cover?: string;
  author: string;
  likes: number;
}

interface FeedDetail {
  id: string;
  title: string;
  content: string;
  images: string[];
  author: { id: string; name: string; avatar: string };
  likes: number;
  comments: number;
  collects: number;
}

function FeedImage({ src, className }: { src?: string; className: string }) {
  const [error, setError] = useState(false)

  if (!src || error) {
    return (
      <div className={`${className} bg-gray-100 flex items-center justify-center`}>
        <ImageIcon className="text-gray-300" size={32} />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt=""
      className={className}
      onError={() => setError(true)}
      referrerPolicy="no-referrer"
    />
  )
}

export default function XhsSearch() {
  const [keyword, setKeyword] = useState('')
  const [feeds, setFeeds] = useState<Feed[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedFeed, setSelectedFeed] = useState<FeedDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!keyword.trim()) return

    setLoading(true)
    setError(null)
    setFeeds([])
    setSelectedFeed(null)

    const result = await searchXhsFeeds({ keyword: keyword.trim() })

    if (result.success && result.data) {
      setFeeds(result.data.feeds || [])
    } else {
      setError(result.message || result.error || 'Search failed')
    }
    setLoading(false)
  }

  async function handleViewDetail(feed: Feed) {
    setDetailLoading(true)
    setSelectedFeed(null)

    const result = await getXhsFeedDetail({
      feedId: feed.id,
      xsecToken: feed.xsec_token,
      loadComments: true,
      commentsCount: 10,
    })

    if (result.success && result.data) {
      setSelectedFeed(result.data)
    }
    setDetailLoading(false)
  }

  async function handleLike(feed: Feed) {
    setActionLoading(`like-${feed.id}`)
    await likeXhsFeed({
      feedId: feed.id,
      xsecToken: feed.xsec_token,
      like: true,
    })
    setActionLoading(null)
  }

  async function handleComment() {
    if (!selectedFeed || !commentText.trim()) return

    setActionLoading('comment')
    const feed = feeds.find(f => f.id === selectedFeed.id)
    if (feed) {
      await commentXhsFeed({
        feedId: feed.id,
        xsecToken: feed.xsec_token,
        content: commentText.trim(),
      })
      setCommentText('')
    }
    setActionLoading(null)
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Search Xiaohongshu</h2>

      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Search for posts, topics, or keywords..."
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-xhs-red focus:border-transparent outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-xhs-red text-white rounded-lg hover:bg-xhs-pink transition-colors font-medium disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Search'}
          </button>
        </div>
      </form>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Search Results */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {feeds.length > 0 ? `${feeds.length} Results` : 'Search Results'}
          </h3>

          {feeds.length === 0 && !loading && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
              {keyword ? 'No results found' : 'Enter a keyword to search'}
            </div>
          )}

          <div className="space-y-4">
            {feeds.map((feed) => (
              <div
                key={feed.id}
                className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleViewDetail(feed)}
              >
                <div className="flex gap-4">
                  <FeedImage
                    src={feed.cover}
                    className="w-24 h-24 object-cover rounded-lg flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 truncate">{feed.title}</h4>
                    <p className="text-sm text-gray-500 mt-1">by {feed.author}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleLike(feed)
                        }}
                        disabled={actionLoading === `like-${feed.id}`}
                        className="flex items-center gap-1 text-sm text-gray-500 hover:text-xhs-red"
                      >
                        {actionLoading === `like-${feed.id}` ? (
                          <Loader2 className="animate-spin" size={16} />
                        ) : (
                          <Heart size={16} />
                        )}
                        {feed.likes}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Feed Detail */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Feed Detail</h3>

          {detailLoading && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <Loader2 className="animate-spin text-xhs-red mx-auto" size={32} />
            </div>
          )}

          {!detailLoading && !selectedFeed && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
              Click on a post to view details
            </div>
          )}

          {selectedFeed && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <FeedImage
                src={selectedFeed.images?.[0]}
                className="w-full h-64 object-cover"
              />
              <div className="p-4">
                <h4 className="text-lg font-semibold text-gray-900 mb-2">
                  {selectedFeed.title}
                </h4>
                <p className="text-gray-600 text-sm mb-4 whitespace-pre-wrap">
                  {selectedFeed.content}
                </p>

                <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                  <span className="flex items-center gap-1">
                    <Heart size={16} /> {selectedFeed.likes}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare size={16} /> {selectedFeed.comments}
                  </span>
                </div>

                <div className="border-t pt-4">
                  <h5 className="font-medium text-gray-900 mb-2">Add Comment</h5>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Write a comment..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-xhs-red"
                    />
                    <button
                      onClick={handleComment}
                      disabled={actionLoading === 'comment' || !commentText.trim()}
                      className="px-4 py-2 bg-xhs-red text-white rounded-lg text-sm hover:bg-xhs-pink disabled:opacity-50"
                    >
                      {actionLoading === 'comment' ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : (
                        'Send'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
