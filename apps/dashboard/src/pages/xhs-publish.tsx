import { useState } from 'react'
import { Upload, X, Loader2, CheckCircle, Image as ImageIcon, Video } from 'lucide-react'
import { publishXhsPost, publishXhsVideo } from '../api/client'

export default function XhsPublish() {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [postType, setPostType] = useState<'image' | 'video'>('image')
  const [videoUrl, setVideoUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleAddTag(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault()
      if (!tags.includes(tagInput.trim())) {
        setTags([...tags, tagInput.trim()])
      }
      setTagInput('')
    }
  }

  function removeTag(tag: string) {
    setTags(tags.filter(t => t !== tag))
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files) return

    Array.from(files).forEach(file => {
      const reader = new FileReader()
      reader.onload = (event) => {
        if (event.target?.result) {
          setImages(prev => [...prev, event.target!.result as string])
        }
      }
      reader.readAsDataURL(file)
    })
  }

  function removeImage(index: number) {
    setImages(images.filter((_, i) => i !== index))
  }

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !content.trim()) return

    // Validate based on post type
    if (postType === 'image' && images.length === 0) {
      setError('Please add at least one image')
      return
    }
    if (postType === 'video' && !videoUrl.trim()) {
      setError('Please enter a video URL')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(false)

    let result
    if (postType === 'video') {
      result = await publishXhsVideo({
        title: title.trim(),
        content: content.trim(),
        videoUrl: videoUrl.trim(),
        tags: tags.length > 0 ? tags : undefined,
      })
    } else {
      result = await publishXhsPost({
        title: title.trim(),
        content: content.trim(),
        images: images,
        tags: tags.length > 0 ? tags : undefined,
      })
    }

    if (result.success) {
      setSuccess(true)
      setTitle('')
      setContent('')
      setTags([])
      setImages([])
      setVideoUrl('')
    } else {
      setError(result.message || result.error || 'Failed to publish post')
    }
    setLoading(false)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Create Post</h2>

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
          <CheckCircle className="text-green-500" size={20} />
          <span className="text-green-700">Post published successfully!</span>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handlePublish} className="bg-white rounded-xl border border-gray-200 p-6">
        {/* Post Type Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Post Type
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPostType('image')}
              className={`p-4 border rounded-lg flex items-center justify-center gap-2 transition-colors ${
                postType === 'image'
                  ? 'border-xhs-red bg-red-50 text-xhs-red'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <ImageIcon size={20} />
              <span className="font-medium">Image Post</span>
            </button>
            <button
              type="button"
              onClick={() => setPostType('video')}
              className={`p-4 border rounded-lg flex items-center justify-center gap-2 transition-colors ${
                postType === 'video'
                  ? 'border-xhs-red bg-red-50 text-xhs-red'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <Video size={20} />
              <span className="font-medium">Video Post</span>
            </button>
          </div>
        </div>

        {/* Title */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Give your post a catchy title..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-xhs-red focus:border-transparent outline-none"
            maxLength={100}
          />
          <p className="mt-1 text-xs text-gray-500 text-right">{title.length}/100</p>
        </div>

        {/* Content */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Content
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your post content here..."
            rows={6}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-xhs-red focus:border-transparent outline-none resize-none"
            maxLength={1000}
          />
          <p className="mt-1 text-xs text-gray-500 text-right">{content.length}/1000</p>
        </div>

        {/* Images (for image posts) */}
        {postType === 'image' && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Images <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-3">
              {images.map((img, i) => (
                <div key={i} className="relative w-24 h-24">
                  <img
                    src={img}
                    alt=""
                    className="w-full h-full object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              {images.length < 9 && (
                <label className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-xhs-red hover:bg-red-50 transition-colors">
                  <ImageIcon className="text-gray-400" size={24} />
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
            <p className="mt-2 text-xs text-gray-500">{images.length}/9 images (at least 1 required)</p>
          </div>
        )}

        {/* Video URL (for video posts) */}
        {postType === 'video' && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Video URL <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://example.com/video.mp4"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-xhs-red focus:border-transparent outline-none"
            />
            <p className="mt-1 text-xs text-gray-500">
              Enter a direct URL to the video file (MP4 recommended). The video will be downloaded and uploaded to Xiaohongshu.
            </p>
          </div>
        )}

        {/* Tags */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tags
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-xhs-red rounded-full text-sm"
              >
                #{tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="hover:text-red-700"
                >
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleAddTag}
            placeholder="Type a tag and press Enter..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-xhs-red focus:border-transparent outline-none"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || !title.trim() || !content.trim()}
          className="w-full py-3 bg-xhs-red text-white rounded-lg hover:bg-xhs-pink transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              Publishing...
            </>
          ) : (
            <>
              <Upload size={20} />
              Publish Post
            </>
          )}
        </button>
      </form>

      <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-yellow-800 mb-1">Note</h4>
        <p className="text-sm text-yellow-700">
          Publishing requires approval. Make sure you're logged in to Xiaohongshu before posting.
        </p>
      </div>
    </div>
  )
}
