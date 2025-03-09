import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from 'wasp/client/operations'
import {
  getTikTokAuthUrl,
  getCurrentUserTikTokAccount,
  getTikTokPostsByUser,
  disconnectTikTokAccount,
  createTikTokPost
} from 'wasp/client/operations'
import { useAuth } from 'wasp/client/auth'
import { getAllFilesByUser } from 'wasp/client/operations'
import type { TikTokPost, TikTokAccount, File } from 'wasp/entities'

const TikTokIntegrationPage = () => {
  const { data: user } = useAuth()
  const { data: tikTokAccount, isLoading: isLoadingAccount, refetch: refetchAccount } = useQuery(getCurrentUserTikTokAccount)
  const { data: tikTokPosts = [], isLoading: isLoadingPosts, refetch: refetchPosts } = useQuery(getTikTokPostsByUser)
  const { data: files = [], isLoading: isLoadingFiles } = useQuery(getAllFilesByUser)

  const [selectedFileId, setSelectedFileId] = useState('')
  const [caption, setCaption] = useState('')
  const [isPosting, setIsPosting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Get the filtered video files
  const videoFiles = Array.isArray(files)
    ? files.filter((file: any) => file.type.startsWith('video/'))
    : []

  // Check if user has a connected account
  const hasTikTokAccount = tikTokAccount && typeof tikTokAccount === 'object'

  // Handler for connecting TikTok account
  const handleConnectTikTok = async () => {
    try {
      const result = await getTikTokAuthUrl({})
      // Redirect to TikTok authorization page
      if (result && typeof result === 'object' && 'authUrl' in result) {
        window.location.href = result.authUrl as string
      } else {
        throw new Error('Invalid response from TikTok auth URL generator')
      }
    } catch (error: unknown) {
      setError('Failed to generate TikTok authorization URL')
      console.error('Failed to generate TikTok authorization URL:', error)
    }
  }

  // Handler for disconnecting TikTok account
  const handleDisconnectTikTok = async () => {
    try {
      await disconnectTikTokAccount({})
      setSuccess('TikTok account disconnected successfully')
      await refetchAccount()
    } catch (error: unknown) {
      setError('Failed to disconnect TikTok account')
      console.error('Failed to disconnect TikTok account:', error)
    }
  }

  // Handler for posting to TikTok
  const handlePostToTikTok = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedFileId) {
      setError('Please select a video file')
      return
    }

    if (!caption) {
      setError('Please enter a caption')
      return
    }

    setIsPosting(true)
    setError('')
    setSuccess('')

    try {
      const result = await createTikTokPost({ fileId: selectedFileId, caption })
      if (result && typeof result === 'object' && 'tikTokPostUrl' in result) {
        setSuccess(`Video posted to TikTok successfully! View it at: ${result.tikTokPostUrl as string}`)
        setSelectedFileId('')
        setCaption('')
        await refetchPosts()
      } else {
        throw new Error('Invalid response from TikTok post creation')
      }
    } catch (error: unknown) {
      setError(`Failed to post to TikTok: ${error instanceof Error ? error.message : 'Unknown error'}`)
      console.error('Failed to post to TikTok:', error)
    } finally {
      setIsPosting(false)
    }
  }

  // Render TikTok account info section
  const renderTikTokAccountInfo = () => {
    if (tikTokAccount && typeof tikTokAccount === 'object') {
      const profilePicture = 'profilePictureUrl' in tikTokAccount ? 
                            (tikTokAccount.profilePictureUrl as string) : null
      const displayName = 'displayName' in tikTokAccount ? 
                         (tikTokAccount.displayName as string) : null
      const username = 'username' in tikTokAccount ? 
                      (tikTokAccount.username as string) : 'tiktokuser'
      
      return (
        <div>
          <div className="flex items-center mb-4">
            {profilePicture && (
              <img 
                src={profilePicture}
                alt={username || 'TikTok Profile'}
                className="w-12 h-12 rounded-full mr-4" 
              />
            )}
            <div>
              <p className="font-semibold">{displayName || username || 'TikTok User'}</p>
              <p className="text-gray-600">@{username}</p>
            </div>
          </div>
          <button
            onClick={handleDisconnectTikTok}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Disconnect TikTok Account
          </button>
        </div>
      )
    }
    
    return (
      <div>
        <p className="mb-4">Connect your TikTok account to post videos directly from this application.</p>
        <button
          onClick={handleConnectTikTok}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Connect TikTok Account
        </button>
      </div>
    )
  }

  // Render post form section
  const renderPostForm = () => {
    if (!hasTikTokAccount) return null
    
    return (
      <div className="mb-8 p-6 border rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Post to TikTok</h2>
        
        <form onSubmit={handlePostToTikTok} className="space-y-4">
          <div>
            <label className="block mb-2 font-medium">Select Video</label>
            {isLoadingFiles ? (
              <p>Loading video files...</p>
            ) : videoFiles.length > 0 ? (
              <select
                value={selectedFileId}
                onChange={(e) => setSelectedFileId(e.target.value)}
                className="w-full px-3 py-2 border rounded"
                required
              >
                <option value="">Select a video...</option>
                {videoFiles.map((file: any) => (
                  <option key={file.id} value={file.id}>
                    {file.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="mb-4">
                <p>No video files found. Please upload a video first.</p>
                <Link to="/file-upload" className="text-blue-600 hover:underline">
                  Go to File Upload
                </Link>
              </div>
            )}
          </div>
          
          <div>
            <label className="block mb-2 font-medium">Caption</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full px-3 py-2 border rounded"
              rows={3}
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={isPosting || !selectedFileId}
            className={`px-4 py-2 text-white rounded ${
              isPosting || !selectedFileId
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isPosting ? 'Posting...' : 'Post to TikTok'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">TikTok Integration</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}

      <div className="mb-8 p-6 border rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold mb-4">TikTok Account</h2>
        
        {isLoadingAccount ? (
          <p>Loading account information...</p>
        ) : renderTikTokAccountInfo()}
      </div>

      {renderPostForm()}

      <div className="p-6 border rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold mb-4">TikTok Post History</h2>
        
        {isLoadingPosts ? (
          <p>Loading post history...</p>
        ) : tikTokPosts && Array.isArray(tikTokPosts) && tikTokPosts.length > 0 ? (
          <div className="divide-y">
            {tikTokPosts.map((post: any) => (
              <div key={post.id} className="py-4">
                <p className="font-medium mb-1">Caption: {post.caption}</p>
                <p className="text-sm text-gray-600 mb-2">
                  Posted on: {new Date(post.createdAt).toLocaleString()}
                </p>
                <p className="text-sm text-gray-600 mb-2">
                  Status: <span className={
                    post.status === 'published' ? 'text-green-600' : 
                    post.status === 'pending' ? 'text-yellow-600' : 'text-red-600'
                  }>
                    {post.status}
                  </span>
                </p>
                {post.tikTokPostUrl && (
                  <a 
                    href={post.tikTokPostUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    View on TikTok
                  </a>
                )}
                {post.errorMessage && (
                  <p className="text-sm text-red-600 mt-2">
                    Error: {post.errorMessage}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p>No TikTok posts yet. Start posting to see your history here.</p>
        )}
      </div>
    </div>
  )
}

export default TikTokIntegrationPage 