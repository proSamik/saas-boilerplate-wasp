import { HttpError } from 'wasp/server'
import { 
  type GetTikTokAuthUrl, 
  type ConnectTikTokAccount, 
  type DisconnectTikTokAccount, 
  type CreateTikTokPost, 
  type GetCurrentUserTikTokAccount, 
  type GetTikTokPostsByUser 
} from 'wasp/server/operations'
import { TikTokAccount, TikTokPost, User } from 'wasp/entities'
import axios from 'axios'
import { v4 as uuidv4 } from 'uuid'
import * as crypto from 'crypto'

// Base URL for TikTok API
const TIKTOK_API_BASE_URL = 'https://open.tiktokapis.com/v2'
const TIKTOK_AUTH_URL = 'https://www.tiktok.com/v2/auth/authorize/'

// Your app's details
const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY
const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET
const REDIRECT_URI = process.env.TIKTOK_CALLBACK_URL || 'https://your-app.com/tiktok/callback'
const SCOPES = ['user.info.basic', 'video.upload', 'video.publish']

/**
 * Generates a code verifier and code challenge for PKCE OAuth flow
 * @returns {{ codeVerifier: string, codeChallenge: string }}
 */
function generatePKCE() {
  // Generate a random code verifier
  const codeVerifier = crypto.randomBytes(64).toString('base64url');
  
  // Create a code challenge by hashing the verifier with SHA-256
  const hashedVerifier = crypto.createHash('sha256').update(codeVerifier).digest();
  const codeChallenge = hashedVerifier.toString('base64url');
  
  return { codeVerifier, codeChallenge };
}

/**
 * Generates the TikTok OAuth authorization URL
 * Returns the URL that the user should be redirected to for TikTok authentication
 */
export const getTikTokAuthUrl: GetTikTokAuthUrl = async ({ user }) => {
  if (!CLIENT_KEY) {
    throw new HttpError(500, 'TikTok client key not configured')
  }

  // Generate state parameter to prevent CSRF
  const state = uuidv4()
  
  // Generate PKCE code verifier and challenge
  const { codeVerifier, codeChallenge } = generatePKCE()

  // Store state and code verifier in session/database for validation when the user returns
  // In a production environment, you'd need to store these securely and associate them with the user's session
  // This is a simplified example - in production, you should store these values
  // For this demo, we'll include the code verifier in the state parameter, but in production
  // you should not do this - instead store it securely in a session or database
  const fullState = JSON.stringify({ state, codeVerifier })

  // Generate the auth URL
  const authUrl = new URL(TIKTOK_AUTH_URL)
  authUrl.searchParams.append('client_key', CLIENT_KEY)
  authUrl.searchParams.append('response_type', 'code')
  authUrl.searchParams.append('scope', SCOPES.join(','))
  authUrl.searchParams.append('redirect_uri', REDIRECT_URI)
  authUrl.searchParams.append('state', fullState)
  authUrl.searchParams.append('code_challenge', codeChallenge)
  authUrl.searchParams.append('code_challenge_method', 'S256')

  return { authUrl: authUrl.toString(), state: fullState }
}

/**
 * Connects the user's TikTok account by exchanging the authorization code for access tokens
 * Stores the TikTok account credentials in the database
 */
export const connectTikTokAccount: ConnectTikTokAccount = async ({ code, state }, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized')
  }

  if (!CLIENT_KEY || !CLIENT_SECRET) {
    throw new HttpError(500, 'TikTok API credentials not configured')
  }

  try {
    // Parse the state to get the code verifier
    let codeVerifier = '';
    try {
      const parsedState = JSON.parse(state || '{}');
      codeVerifier = parsedState.codeVerifier || '';
    } catch (error) {
      throw new HttpError(400, 'Invalid state parameter')
    }

    if (!codeVerifier) {
      throw new HttpError(400, 'Missing code verifier')
    }

    // Exchange the authorization code for an access token
    const tokenResponse = await axios.post('https://open-api.tiktok.com/oauth/access_token/', null, {
      params: {
        client_key: CLIENT_KEY,
        client_secret: CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
        code_verifier: codeVerifier
      }
    })

    const { access_token, refresh_token, expires_in, open_id } = tokenResponse.data.data

    // Get user info from TikTok
    const userResponse = await axios.get(`${TIKTOK_API_BASE_URL}/user/info/`, {
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    })

    const { username, display_name, avatar_url } = userResponse.data.data.user

    // Calculate token expiration date
    const expiresAt = new Date()
    expiresAt.setSeconds(expiresAt.getSeconds() + expires_in)

    // Check if user already has a TikTok account connected
    const existingAccount = await context.entities.TikTokAccount.findFirst({
      where: { userId: context.user.id }
    })

    if (existingAccount) {
      // Update existing account
      await context.entities.TikTokAccount.update({
        where: { id: existingAccount.id },
        data: {
          accessToken: access_token,
          refreshToken: refresh_token,
          expiresAt,
          username,
          displayName: display_name,
          profilePictureUrl: avatar_url,
          openId: open_id
        }
      })
      
      return { success: true, accountId: existingAccount.id }
    } else {
      // Create new TikTok account
      const newAccount = await context.entities.TikTokAccount.create({
        data: {
          userId: context.user.id,
          accessToken: access_token,
          refreshToken: refresh_token,
          expiresAt,
          username,
          displayName: display_name,
          profilePictureUrl: avatar_url,
          openId: open_id
        }
      })
      
      return { success: true, accountId: newAccount.id }
    }
  } catch (error: unknown) {
    console.error('Failed to connect TikTok account:', error)
    throw new HttpError(500, 'Failed to connect TikTok account: ' + (error instanceof Error ? error.message : 'Unknown error'))
  }
}

/**
 * Disconnects the user's TikTok account
 * Removes the TikTok account credentials from the database
 */
export const disconnectTikTokAccount: DisconnectTikTokAccount = async (_, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized')
  }

  try {
    // Find the user's TikTok account
    const tikTokAccount = await context.entities.TikTokAccount.findFirst({
      where: { userId: context.user.id }
    })

    if (!tikTokAccount) {
      throw new HttpError(404, 'TikTok account not found')
    }

    // Delete the TikTok account
    await context.entities.TikTokAccount.delete({
      where: { id: tikTokAccount.id }
    })

    return { success: true }
  } catch (error) {
    console.error('Failed to disconnect TikTok account:', error)
    throw new HttpError(500, 'Failed to disconnect TikTok account')
  }
}

/**
 * Uploads a video to TikTok on behalf of the user
 * Uses the TikTok API to upload and publish the video
 */
export const createTikTokPost: CreateTikTokPost = async ({ fileId, caption }, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized')
  }

  try {
    // Find the user's TikTok account
    const tikTokAccount = await context.entities.TikTokAccount.findFirst({
      where: { userId: context.user.id }
    })

    if (!tikTokAccount) {
      throw new HttpError(404, 'TikTok account not connected. Please connect your TikTok account first.')
    }

    // Check if the token is expired and refresh if needed
    if (new Date(tikTokAccount.expiresAt) <= new Date()) {
      await refreshTikTokToken(tikTokAccount.id, context)
    }

    // Get the file from the database
    const file = await context.entities.File.findUnique({
      where: { id: fileId }
    })

    if (!file) {
      throw new HttpError(404, 'File not found')
    }

    // Create a record for the TikTok post with 'pending' status
    const tikTokPost = await context.entities.TikTokPost.create({
      data: {
        tikTokAccountId: tikTokAccount.id,
        videoKey: file.key,
        caption,
        status: 'pending'
      }
    })

    // Get the file content using the uploadUrl
    const fileResponse = await axios.get(file.uploadUrl, {
      responseType: 'arraybuffer'
    })
    const videoBuffer = fileResponse.data

    // Upload video to TikTok using their API
    // This is a simplified example - in production, you would need to implement
    // chunked uploads for larger files as per TikTok's documentation

    // Get the upload URL from TikTok
    const uploadResponse = await axios.post(`${TIKTOK_API_BASE_URL}/video/init/`, {
      source_info: {
        source: 'PULL_FROM_URL',
        video_url: file.uploadUrl
      }
    }, {
      headers: {
        'Authorization': `Bearer ${tikTokAccount.accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    const { upload_id } = uploadResponse.data.data

    // Publish the video on TikTok
    const publishResponse = await axios.post(`${TIKTOK_API_BASE_URL}/video/publish/`, {
      upload_id,
      text: caption,
      privacy_level: 'PUBLIC_TO_EVERYONE',
      disable_duet: false,
      disable_comment: false,
      disable_stitch: false
    }, {
      headers: {
        'Authorization': `Bearer ${tikTokAccount.accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    const { video_id, share_url } = publishResponse.data.data

    // Update the TikTok post with the post ID and URL
    await context.entities.TikTokPost.update({
      where: { id: tikTokPost.id },
      data: {
        tikTokPostId: video_id,
        tikTokPostUrl: share_url,
        status: 'published'
      }
    })

    return {
      success: true,
      postId: tikTokPost.id,
      tikTokPostId: video_id,
      tikTokPostUrl: share_url
    }
  } catch (error: unknown) {
    console.error('Failed to create TikTok post:', error)
    
    // Update the TikTok post with error status if it was created
    if (error && typeof error === 'object' && 'tikTokPostId' in error) {
      await context.entities.TikTokPost.update({
        where: { id: (error as { tikTokPostId: string }).tikTokPostId },
        data: {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Failed to create TikTok post'
        }
      })
    }
    
    throw new HttpError(500, 'Failed to create TikTok post: ' + (error instanceof Error ? error.message : 'Unknown error'))
  }
}

/**
 * Gets the current user's TikTok account
 * Returns the TikTok account details if the user has connected their account
 */
export const getCurrentUserTikTokAccount: GetCurrentUserTikTokAccount = async (_, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized')
  }

  try {
    const tikTokAccount = await context.entities.TikTokAccount.findFirst({
      where: { userId: context.user.id }
    })

    return tikTokAccount
  } catch (error) {
    console.error('Failed to get TikTok account:', error)
    throw new HttpError(500, 'Failed to get TikTok account')
  }
}

/**
 * Gets the TikTok posts created by the user
 * Returns a list of TikTok posts with their status and URLs
 */
export const getTikTokPostsByUser: GetTikTokPostsByUser = async (_, context) => {
  if (!context.user) {
    throw new HttpError(401, 'Not authorized')
  }

  try {
    const tikTokAccount = await context.entities.TikTokAccount.findFirst({
      where: { userId: context.user.id }
    })

    if (!tikTokAccount) {
      return []
    }

    const posts = await context.entities.TikTokPost.findMany({
      where: { tikTokAccountId: tikTokAccount.id },
      orderBy: { createdAt: 'desc' }
    })

    return posts
  } catch (error) {
    console.error('Failed to get TikTok posts:', error)
    throw new HttpError(500, 'Failed to get TikTok posts')
  }
}

/**
 * Helper function to refresh a TikTok access token
 * Uses the refresh token to get a new access token
 */
async function refreshTikTokToken(accountId: string, context: any) {
  try {
    // Get the TikTok account
    const tikTokAccount = await context.entities.TikTokAccount.findUnique({
      where: { id: accountId }
    })

    if (!tikTokAccount) {
      throw new Error('TikTok account not found')
    }

    // Refresh the token using TikTok API
    const refreshResponse = await axios.post('https://open-api.tiktok.com/oauth/refresh_token/', null, {
      params: {
        client_key: CLIENT_KEY,
        client_secret: CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: tikTokAccount.refreshToken
      }
    })

    const { access_token, refresh_token, expires_in } = refreshResponse.data.data

    // Calculate token expiration date
    const expiresAt = new Date()
    expiresAt.setSeconds(expiresAt.getSeconds() + expires_in)

    // Update the TikTok account with the new tokens
    await context.entities.TikTokAccount.update({
      where: { id: accountId },
      data: {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt
      }
    })

    return true
  } catch (error) {
    console.error('Failed to refresh TikTok token:', error)
    throw error
  }
} 