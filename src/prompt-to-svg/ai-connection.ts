import { HttpError } from 'wasp/server';
import fetch from 'node-fetch';

export const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Map of model IDs to their OpenRouter identifiers
export const MODEL_MAP = {
  deepseek: 'deepseek/deepseek-r1:free',
  claude: 'anthropic/claude-3.7-sonnet',
  openai: 'openai/gpt-4o-mini'
};

// OpenRouter API response type
export type OpenRouterResponse = {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
};

// OpenRouter API error response type
export type OpenRouterErrorResponse = {
  error?: {
    message: string;
  };
};

/**
 * Calls the OpenRouter API with the provided messages and parameters
 * @param systemPrompt The system prompt to send
 * @param userPrompt The user prompt to send
 * @param model The model ID to use
 * @returns The response from the API
 */
export async function callOpenRouterAPI(
  systemPrompt: string,
  userPrompt: string,
  model: string
): Promise<string> {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new HttpError(500, 'OpenRouter API key is not configured');
  }

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'SVG Generator',
      },
      body: JSON.stringify({
        model: MODEL_MAP[model as keyof typeof MODEL_MAP],
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        max_tokens: 4000,
        temperature: 0.5,
        top_p: 0.95,
        stream: false
      })
    });

    if (!response.ok) {
      const errorData = await response.json() as OpenRouterErrorResponse;
      throw new Error(`OpenRouter API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json() as OpenRouterResponse;
    return data.choices[0].message.content;
  } catch (error: any) {
    console.error('Error calling OpenRouter API:', error);
    throw new HttpError(500, error.message || 'Failed to call OpenRouter API');
  }
} 