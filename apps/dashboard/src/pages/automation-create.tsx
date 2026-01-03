import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, PenSquare, MessageSquare, Search, X, Image as ImageIcon, Video } from 'lucide-react'

const API_BASE = import.meta.env.PROD
  ? 'https://social-agent-api.jiangyurong609.workers.dev'
  : '/api'

type AutomationType = 'scheduled_post' | 'auto_engage' | 'content_discovery'

const typeOptions = [
  {
    type: 'auto_engage' as AutomationType,
    icon: MessageSquare,
    title: 'Auto Engage',
    description: 'Search for posts by keywords and automatically like/comment'
  },
  {
    type: 'scheduled_post' as AutomationType,
    icon: PenSquare,
    title: 'Scheduled Post',
    description: 'Create and publish posts on a schedule (requires approval)'
  },
  {
    type: 'content_discovery' as AutomationType,
    icon: Search,
    title: 'Content Discovery',
    description: 'Search for trending content and optionally interact'
  }
]

export default function AutomationCreate() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1: Type selection
  const [type, setType] = useState<AutomationType | null>(null)

  // Common fields
  const [name, setName] = useState('')
  const [cronExpression, setCronExpression] = useState('0 9 * * *')

  // Auto-engage fields
  const [keywords, setKeywords] = useState('')
  const [doLike, setDoLike] = useState(true)
  const [doComment, setDoComment] = useState(true)
  const [commentMode, setCommentMode] = useState<'template' | 'ai' | 'both'>('template')
  const [commentTemplates, setCommentTemplates] = useState(
    '很棒的分享！\n学到了，谢谢分享\n说得太好了\n收藏了，感谢'
  )
  const [maxPostsPerRun, setMaxPostsPerRun] = useState(5)
  const [maxCommentsPerDay, setMaxCommentsPerDay] = useState(20)

  // Scheduled post fields
  const [postTitle, setPostTitle] = useState('')
  const [postContent, setPostContent] = useState('')
  const [postTags, setPostTags] = useState('')
  const [postImages, setPostImages] = useState<string[]>([])
  const [postType, setPostType] = useState<'image' | 'video'>('image')
  const [videoUrl, setVideoUrl] = useState('')

  // AI generation fields for scheduled posts
  const [contentMode, setContentMode] = useState<'static' | 'ai_topic' | 'ai_prompt'>('static')
  const [aiTopics, setAiTopics] = useState('')
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiTone, setAiTone] = useState<'casual' | 'professional' | 'friendly' | 'informative'>('friendly')
  const [aiLength, setAiLength] = useState<'short' | 'medium' | 'long'>('medium')
  const [aiEmojis, setAiEmojis] = useState(true)
  const [autoGenerateTags, setAutoGenerateTags] = useState(true)

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files) return
    Array.from(files).forEach(file => {
      const reader = new FileReader()
      reader.onload = (event) => {
        if (event.target?.result) {
          setPostImages(prev => [...prev, event.target!.result as string])
        }
      }
      reader.readAsDataURL(file)
    })
  }

  function removeImage(index: number) {
    setPostImages(postImages.filter((_, i) => i !== index))
  }

  async function handleSubmit() {
    if (!type || !name) return
    setLoading(true)
    setError(null)

    let config: any = {
      type,
      schedule: { cronExpression }
    }

    if (type === 'auto_engage') {
      config = {
        ...config,
        searchKeywords: keywords.split('\n').map(k => k.trim()).filter(Boolean),
        actions: {
          like: doLike,
          comment: doComment,
          commentMode,
          commentTemplates: commentTemplates.split('\n').map(t => t.trim()).filter(Boolean)
        },
        limits: {
          maxPostsPerRun,
          maxCommentsPerDay,
          maxLikesPerDay: 50
        }
      }
    } else if (type === 'scheduled_post') {
      if (contentMode === 'static') {
        config = {
          ...config,
          postType, // 'image' or 'video'
          template: {
            title: postTitle,
            content: postContent,
            tags: postTags.split(',').map(t => t.trim()).filter(Boolean),
            images: postType === 'image' ? postImages : undefined,
            videoUrl: postType === 'video' ? videoUrl : undefined
          },
          requiresApproval: true
        }
      } else {
        config = {
          ...config,
          aiGeneration: {
            mode: contentMode,
            topics: contentMode === 'ai_topic'
              ? aiTopics.split('\n').map(t => t.trim()).filter(Boolean)
              : undefined,
            customPrompt: contentMode === 'ai_prompt' ? aiPrompt : undefined,
            style: {
              tone: aiTone,
              length: aiLength,
              includeEmojis: aiEmojis
            },
            autoGenerateTags,
            maxTags: 5
          },
          requiresApproval: true
        }
      }
    } else if (type === 'content_discovery') {
      config = {
        ...config,
        keywords: keywords.split('\n').map(k => k.trim()).filter(Boolean),
        sortBy: 'popularity_descending',
        autoInteract: doLike || doComment,
        interactConfig: {
          like: doLike,
          comment: doComment,
          commentTemplates: commentTemplates.split('\n').map(t => t.trim()).filter(Boolean)
        },
        limits: { maxPostsPerRun }
      }
    }

    try {
      const resp = await fetch(`${API_BASE}/automations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          type,
          config
        })
      })
      const data = await resp.json()
      if (data.ok) {
        navigate('/automations')
      } else {
        setError(data.error || 'Failed to create automation')
      }
    } catch (err) {
      setError('Failed to create automation')
    }
    setLoading(false)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => step > 1 ? setStep(step - 1) : navigate('/automations')}
        className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft size={20} />
        Back
      </button>

      <h2 className="text-2xl font-bold text-gray-900 mb-6">Create Automation</h2>

      {/* Step 1: Choose type */}
      {step === 1 && (
        <div className="space-y-4">
          <p className="text-gray-600 mb-4">What kind of automation do you want to create?</p>
          {typeOptions.map((option) => {
            const Icon = option.icon
            return (
              <button
                key={option.type}
                onClick={() => {
                  setType(option.type)
                  setStep(2)
                }}
                className={`w-full p-4 border rounded-xl text-left hover:border-xhs-red hover:bg-red-50 transition-colors ${
                  type === option.type ? 'border-xhs-red bg-red-50' : 'border-gray-200'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gray-100 rounded-lg">
                    <Icon className="text-gray-600" size={24} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{option.title}</h3>
                    <p className="text-sm text-gray-500">{option.description}</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Step 2: Configure */}
      {step === 2 && type && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Automation Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My automation"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-xhs-red focus:border-transparent outline-none"
              />
            </div>

            {/* Schedule */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Schedule (Cron Expression)
              </label>
              <select
                value={cronExpression}
                onChange={(e) => setCronExpression(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-xhs-red focus:border-transparent outline-none"
              >
                <option value="*/30 * * * *">Every 30 minutes</option>
                <option value="0 * * * *">Every hour</option>
                <option value="0 */2 * * *">Every 2 hours</option>
                <option value="0 9 * * *">Daily at 9 AM</option>
                <option value="0 9,18 * * *">Twice daily (9 AM, 6 PM)</option>
                <option value="0 9 * * 1-5">Weekdays at 9 AM</option>
              </select>
            </div>

            {/* Type-specific fields */}
            {(type === 'auto_engage' || type === 'content_discovery') && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Search Keywords (one per line)
                  </label>
                  <textarea
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    placeholder="AI\n人工智能\n机器学习"
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-xhs-red focus:border-transparent outline-none resize-none"
                  />
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={doLike}
                      onChange={(e) => setDoLike(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">Like posts</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={doComment}
                      onChange={(e) => setDoComment(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">Comment on posts</span>
                  </label>
                </div>

                {doComment && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Comment Mode
                      </label>
                      <select
                        value={commentMode}
                        onChange={(e) => setCommentMode(e.target.value as any)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="template">Template (random from list)</option>
                        <option value="ai">AI Generated</option>
                        <option value="both">Mix of both</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Comment Templates (one per line)
                      </label>
                      <textarea
                        value={commentTemplates}
                        onChange={(e) => setCommentTemplates(e.target.value)}
                        rows={4}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg resize-none"
                      />
                    </div>
                  </>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max posts per run
                    </label>
                    <input
                      type="number"
                      value={maxPostsPerRun}
                      onChange={(e) => setMaxPostsPerRun(parseInt(e.target.value, 10))}
                      min={1}
                      max={20}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max comments per day
                    </label>
                    <input
                      type="number"
                      value={maxCommentsPerDay}
                      onChange={(e) => setMaxCommentsPerDay(parseInt(e.target.value, 10))}
                      min={1}
                      max={100}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              </>
            )}

            {type === 'scheduled_post' && (
              <>
                {/* Content Mode Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Content Source
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setContentMode('static')}
                      className={`p-3 border rounded-lg text-sm ${
                        contentMode === 'static'
                          ? 'border-xhs-red bg-red-50 text-xhs-red'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <div className="font-medium">Static</div>
                      <div className="text-xs text-gray-500">Write content yourself</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setContentMode('ai_topic')}
                      className={`p-3 border rounded-lg text-sm ${
                        contentMode === 'ai_topic'
                          ? 'border-xhs-red bg-red-50 text-xhs-red'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <div className="font-medium">AI Topics</div>
                      <div className="text-xs text-gray-500">Generate from topics</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setContentMode('ai_prompt')}
                      className={`p-3 border rounded-lg text-sm ${
                        contentMode === 'ai_prompt'
                          ? 'border-xhs-red bg-red-50 text-xhs-red'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <div className="font-medium">AI Prompt</div>
                      <div className="text-xs text-gray-500">Custom prompt</div>
                    </button>
                  </div>
                </div>

                {/* Static mode fields */}
                {contentMode === 'static' && (
                  <>
                    {/* Post Type Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Post Type
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setPostType('image')}
                          className={`p-3 border rounded-lg text-sm flex items-center justify-center gap-2 ${
                            postType === 'image'
                              ? 'border-xhs-red bg-red-50 text-xhs-red'
                              : 'border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          <ImageIcon size={18} />
                          <span>Image Post</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPostType('video')}
                          className={`p-3 border rounded-lg text-sm flex items-center justify-center gap-2 ${
                            postType === 'video'
                              ? 'border-xhs-red bg-red-50 text-xhs-red'
                              : 'border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          <Video size={18} />
                          <span>Video Post</span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Post Title
                      </label>
                      <input
                        type="text"
                        value={postTitle}
                        onChange={(e) => setPostTitle(e.target.value)}
                        placeholder="My awesome post"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Post Content
                      </label>
                      <textarea
                        value={postContent}
                        onChange={(e) => setPostContent(e.target.value)}
                        placeholder="Write your post content here..."
                        rows={5}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg resize-none"
                      />
                    </div>

                    {/* Image Upload (for image posts) */}
                    {postType === 'image' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Images (required, up to 9)
                        </label>
                        <div className="flex flex-wrap gap-3">
                          {postImages.map((img, i) => (
                            <div key={i} className="relative w-20 h-20">
                              <img
                                src={img}
                                alt=""
                                className="w-full h-full object-cover rounded-lg"
                              />
                              <button
                                type="button"
                                onClick={() => removeImage(i)}
                                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                          {postImages.length < 9 && (
                            <label className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-xhs-red hover:bg-red-50 transition-colors">
                              <ImageIcon className="text-gray-400" size={20} />
                              <span className="text-xs text-gray-400 mt-1">Add</span>
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={handleImageUpload}
                                className="hidden"
                              />
                            </label>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-gray-500">{postImages.length}/9 images</p>
                      </div>
                    )}

                    {/* Video URL (for video posts) */}
                    {postType === 'video' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Video URL
                        </label>
                        <input
                          type="text"
                          value={videoUrl}
                          onChange={(e) => setVideoUrl(e.target.value)}
                          placeholder="https://example.com/video.mp4"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Enter a direct URL to the video file (MP4 recommended)
                        </p>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tags (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={postTags}
                        onChange={(e) => setPostTags(e.target.value)}
                        placeholder="tag1, tag2, tag3"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                  </>
                )}

                {/* AI Topic mode fields */}
                {contentMode === 'ai_topic' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Topics (one per line)
                      </label>
                      <textarea
                        value={aiTopics}
                        onChange={(e) => setAiTopics(e.target.value)}
                        placeholder="AI and productivity&#10;Remote work tips&#10;Tech trends 2025"
                        rows={4}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg resize-none"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Each run will randomly pick one topic and generate content about it.
                      </p>
                    </div>
                  </>
                )}

                {/* AI Prompt mode fields */}
                {contentMode === 'ai_prompt' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Custom Prompt
                      </label>
                      <textarea
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder="Write a post about the benefits of morning routines, including 3 actionable tips that readers can implement immediately..."
                        rows={5}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg resize-none"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Be specific about the topic, tone, and what you want included.
                      </p>
                    </div>
                  </>
                )}

                {/* AI Style options (for both AI modes) */}
                {(contentMode === 'ai_topic' || contentMode === 'ai_prompt') && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Tone
                        </label>
                        <select
                          value={aiTone}
                          onChange={(e) => setAiTone(e.target.value as any)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        >
                          <option value="casual">Casual</option>
                          <option value="friendly">Friendly</option>
                          <option value="professional">Professional</option>
                          <option value="informative">Informative</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Length
                        </label>
                        <select
                          value={aiLength}
                          onChange={(e) => setAiLength(e.target.value as any)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        >
                          <option value="short">Short (~100 chars)</option>
                          <option value="medium">Medium (~300 chars)</option>
                          <option value="long">Long (~500 chars)</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={aiEmojis}
                          onChange={(e) => setAiEmojis(e.target.checked)}
                          className="rounded"
                        />
                        <span className="text-sm">Include emojis</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={autoGenerateTags}
                          onChange={(e) => setAutoGenerateTags(e.target.checked)}
                          className="rounded"
                        />
                        <span className="text-sm">Auto-generate tags</span>
                      </label>
                    </div>
                  </>
                )}

                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-700">
                    {contentMode === 'static'
                      ? 'Scheduled posts require approval before publishing. You\'ll be notified when it\'s time to review.'
                      : 'AI-generated posts will appear in "Pending Posts" for your review before publishing.'}
                  </p>
                </div>
              </>
            )}

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading || !name}
              className="w-full py-3 bg-xhs-red text-white rounded-lg hover:bg-xhs-pink transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Loader2 className="animate-spin" size={20} /> Creating...</>
              ) : (
                'Create Automation'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
