import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { connectTikTokAccount } from 'wasp/client/operations'

const TikTokCallbackPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState('')
  const [isProcessing, setIsProcessing] = useState(true)

  useEffect(() => {
    // Extract code and state from URL parameters
    const params = new URLSearchParams(location.search)
    const code = params.get('code')
    const state = params.get('state')
    const errorDescription = params.get('error_description')

    const handleCallback = async () => {
      if (errorDescription) {
        setError(`Authentication failed: ${errorDescription}`)
        setIsProcessing(false)
        return
      }

      if (!code) {
        setError('No authorization code received from TikTok')
        setIsProcessing(false)
        return
      }

      if (!state) {
        setError('No state parameter received from TikTok')
        setIsProcessing(false)
        return
      }

      try {
        // Connect the TikTok account with the authorization code and state (which contains the code verifier)
        await connectTikTokAccount({ code, state })
        
        // Redirect to the TikTok integration page
        navigate('/tiktok', { 
          state: { success: 'TikTok account connected successfully!' } 
        })
      } catch (error: unknown) {
        setError(`Failed to connect TikTok account: ${error instanceof Error ? error.message : 'Unknown error'}`)
        setIsProcessing(false)
      }
    }

    handleCallback()
  }, [location, navigate])

  return (
    <div className="max-w-md mx-auto mt-12 p-6 border rounded-lg shadow-sm">
      <h1 className="text-2xl font-bold mb-6">Connecting TikTok Account</h1>
      
      {isProcessing ? (
        <div className="text-center">
          <p className="mb-4">Processing TikTok authentication...</p>
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
        </div>
      ) : error ? (
        <div>
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
          <button
            onClick={() => navigate('/tiktok')}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to TikTok Integration
          </button>
        </div>
      ) : null}
    </div>
  )
}

export default TikTokCallbackPage 