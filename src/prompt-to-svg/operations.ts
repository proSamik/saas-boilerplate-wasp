import type { GenerateSvgs, ConvertToGif } from 'wasp/server/operations';
import { HttpError } from 'wasp/server';
import fetch from 'node-fetch';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Map of model IDs to their OpenRouter identifiers
const MODEL_MAP = {
  deepseek: 'deepseek/deepseek-r1-zero:free',
  claude: 'anthropic/claude-3.7-sonnet',
  openai: 'openai/chatgpt-4o-latest',
};

// OpenRouter API response type
type OpenRouterResponse = {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
};

// OpenRouter API error response type
type OpenRouterErrorResponse = {
  error?: {
    message: string;
  };
};

// Function to generate SVG using OpenRouter API
export const generateSvgs: GenerateSvgs<{ prompt: string; model: string }, { svgs: string[] }> = async (
  { prompt, model },
  context
) => {
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
            content: `You are an expert SVG artist. Generate SVG code based on text prompts. 
                     Keep the SVGs simple, clean, and suitable for animation. 
                     Respond only with valid SVG code, no explanations.
                     Use a 400x400 viewBox.`
          },
          {
            role: 'user',
            content: `Generate a simple SVG based on this prompt: ${prompt}`
          }
        ],
        max_tokens: 1000,
        temperature: 0.7,
        top_p: 0.7,
        stream: false
      })
    });

    if (!response.ok) {
      const errorData = await response.json() as OpenRouterErrorResponse;
      throw new Error(`OpenRouter API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json() as OpenRouterResponse;
    
    // Extract SVG code from the response and generate variations
    const baseSvg = data.choices[0].message.content;
    const svgs = generateSvgVariations(baseSvg);

    return { svgs };
  } catch (error: any) {
    console.error('Error generating SVGs:', error);
    throw new HttpError(500, error.message || 'Failed to generate SVGs');
  }
};

// Function to convert SVG to GIF
export const convertToGif: ConvertToGif<{ svg: string }, { gifUrl: string }> = async ({ svg }, context) => {
  try {
    // For now, we'll return a mock GIF URL
    // In a real implementation, you would:
    // 1. Use a library like svg2gif or a service to convert SVG to GIF
    // 2. Store the GIF file (e.g., in S3 or similar storage)
    // 3. Return the URL to the stored GIF
    
    return {
      gifUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    };
  } catch (error: any) {
    console.error('Error converting to GIF:', error);
    throw new HttpError(500, error.message || 'Failed to convert to GIF');
  }
};

// Helper function to generate SVG variations
function generateSvgVariations(baseSvg: string): string[] {
  // Create 4 variations of the SVG by applying different transformations
  const variations: string[] = [];
  
  // Base variation
  variations.push(baseSvg);
  
  // Rotated variation
  variations.push(
    baseSvg.replace(
      '<svg',
      '<svg style="transform: rotate(90deg)"'
    )
  );
  
  // Mirrored variation
  variations.push(
    baseSvg.replace(
      '<svg',
      '<svg style="transform: scaleX(-1)"'
    )
  );
  
  // Combined transformation
  variations.push(
    baseSvg.replace(
      '<svg',
      '<svg style="transform: rotate(180deg) scaleY(-1)"'
    )
  );
  
  return variations;
} 