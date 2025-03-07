import type { GenerateSvgs, ConvertToGif } from 'wasp/server/operations';
import { HttpError } from 'wasp/server';
import fetch from 'node-fetch';
import puppeteer from 'puppeteer';
import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Map of model IDs to their OpenRouter identifiers
const MODEL_MAP = {
  deepseek: 'deepseek/deepseek-r1:free',
  claude: 'anthropic/claude-3.7-sonnet',
  openai: 'openai/gpt-4o-mini'
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

// Helper function to auto-fix common SVG issues
function autoFixSvg(svg: string): string {
  let fixed = svg.trim();

  // Remove any markdown code blocks if present
  fixed = fixed.replace(/```svg/g, '').replace(/```/g, '');
  
  // Remove any explanatory text before or after the SVG
  fixed = fixed.replace(/^[\s\S]*?(<svg)/i, '$1');
  fixed = fixed.replace(/<\/svg>[\s\S]*$/i, '</svg>');

  // Fix unclosed SVG tag
  if (fixed.includes('<svg') && !fixed.includes('</svg>')) {
    fixed += '</svg>';
  }

  // Fix missing quotes in attributes
  fixed = fixed.replace(/(\w+)=(\w+)/g, '$1="$2"');

  // Ensure proper SVG structure
  if (!fixed.startsWith('<svg')) {
    fixed = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">${fixed}</svg>`;
  }

  return fixed;
}

// Helper function to validate SVG content with more detailed checks
function validateSvg(svg: string): { isValid: boolean; error?: string } {
  if (!svg) {
    return { isValid: false, error: 'SVG content is empty' };
  }

  const autoFixed = autoFixSvg(svg);
  
  if (!autoFixed.includes('<svg')) {
    return { isValid: false, error: 'Missing <svg> tag' };
  }

  if (!autoFixed.includes('</svg>')) {
    return { isValid: false, error: 'Missing closing </svg> tag' };
  }

  // Check for basic structure
  const basicStructure = /<svg[^>]*>.*<\/svg>/s.test(autoFixed);
  if (!basicStructure) {
    return { isValid: false, error: 'Invalid SVG structure' };
  }

  // Check for required attributes
  if (!autoFixed.includes('xmlns="http://www.w3.org/2000/svg"')) {
    return { isValid: false, error: 'Missing xmlns attribute' };
  }

  return { isValid: true };
}

// Function to sanitize SVG content
function sanitizeSvg(svg: string): string {
  let sanitized = svg.trim();
  
  // Add XML namespace if missing
  if (!sanitized.includes('xmlns="http://www.w3.org/2000/svg"')) {
    sanitized = sanitized.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  // Ensure proper viewBox
  if (!sanitized.includes('viewBox')) {
    sanitized = sanitized.replace('<svg', '<svg viewBox="0 0 400 400"');
  }

  // Ensure proper width and height
  if (!sanitized.includes('width=') && !sanitized.includes('height=')) {
    sanitized = sanitized.replace('<svg', '<svg width="400" height="400"');
  }

  // Remove any script tags for security
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  return sanitized;
}

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
            content: `You are an expert SVG artist specializing in creating clean, valid SVG code. Follow these rules strictly:

1. ALWAYS include these required attributes:
   - xmlns="http://www.w3.org/2000/svg"
   - viewBox="0 0 400 400"
   - width="400" height="400"

2. Basic structure must be:
   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
     <!-- content here -->
   </svg>

3. Use only valid SVG elements and attributes
4. Keep designs simple and suitable for animation
5. Ensure all paths are properly closed
6. Use descriptive class names for elements
7. Avoid external dependencies or images
8. No scripts or event handlers
9. Use relative coordinates within the 400x400 viewport
10. DO NOT include any markdown formatting or explanation text
11. Output ONLY the raw SVG code

Example valid response:
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <circle cx="200" cy="200" r="100" fill="currentColor"/>
</svg>`
          },
          {
            role: 'user',
            content: `Generate a simple SVG based on this prompt: ${prompt}`
          }
        ],
        max_tokens: 1000,
        temperature: 0.5, // Reduced temperature for more consistent output
        top_p: 0.9,
        stream: false
      })
    });

    if (!response.ok) {
      const errorData = await response.json() as OpenRouterErrorResponse;
      throw new Error(`OpenRouter API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json() as OpenRouterResponse;
    
    // Extract SVG code from the response
    let baseSvg = data.choices[0].message.content;

    // Auto-fix common issues
    baseSvg = autoFixSvg(baseSvg);

    // Validate the base SVG
    const validation = validateSvg(baseSvg);
    if (!validation.isValid) {
      console.warn('SVG validation failed:', validation.error);
      // Try one more time with auto-fixing
      baseSvg = sanitizeSvg(baseSvg);
      const secondValidation = validateSvg(baseSvg);
      if (!secondValidation.isValid) {
        throw new Error(`Invalid SVG generated: ${secondValidation.error}`);
      }
    }

    // Generate variations from the sanitized SVG
    const svgs = generateSvgVariations(baseSvg);

    // Validate all variations
    for (const svg of svgs) {
      const varValidation = validateSvg(svg);
      if (!varValidation.isValid) {
        throw new Error(`Invalid SVG variation: ${varValidation.error}`);
      }
    }

    return { svgs };
  } catch (error: any) {
    console.error('Error generating SVGs:', error);
    throw new HttpError(500, error.message || 'Failed to generate SVGs');
  }
};

// Function to convert SVG to GIF
export const convertToGif: ConvertToGif<{ svg: string }, { gifUrl: string }> = async ({ svg }, context) => {
  try {
    // Validate SVG content
    if (!validateSvg(svg)) {
      throw new Error('Invalid SVG content');
    }

    // Sanitize SVG content
    const sanitizedSvg = sanitizeSvg(svg);

    // Create a temporary directory for processing
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'svg-to-gif-'));
    const svgPath = path.join(tempDir, 'input.svg');
    const pngPath = path.join(tempDir, 'output.png');
    const gifPath = path.join(tempDir, 'output.gif');

    // Write SVG to temporary file
    await fs.writeFile(svgPath, sanitizedSvg, 'utf8');

    // Launch Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      
      // Set content with proper content type
      await page.setContent(sanitizedSvg, {
        waitUntil: 'networkidle0',
        timeout: 5000
      });
      
      // Set viewport size to match SVG dimensions
      await page.setViewport({ width: 400, height: 400 });
      
      // Ensure SVG is properly rendered
      await page.evaluate(() => {
        const svg = document.querySelector('svg');
        if (svg) {
          svg.setAttribute('width', '400');
          svg.setAttribute('height', '400');
        }
      });
      
      // Wait for any animations to complete
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Take a screenshot with proper settings
      await page.screenshot({
        path: pngPath,
        omitBackground: true,
        type: 'png'
      });
    } finally {
      await browser.close();
    }

    // Convert PNG to GIF using Sharp with optimized settings
    await sharp(pngPath)
      .resize(400, 400, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .toFormat('gif', {
        quality: 90,
        effort: 10
      })
      .toFile(gifPath);

    // Read the GIF file and convert to base64
    const gifBuffer = await fs.readFile(gifPath);
    const gifBase64 = gifBuffer.toString('base64');

    // Clean up temporary files
    await fs.rm(tempDir, { recursive: true, force: true });

    return {
      gifUrl: `data:image/gif;base64,${gifBase64}`
    };
  } catch (error: any) {
    console.error('Error converting to GIF:', error);
    throw new HttpError(500, `Failed to convert to GIF: ${error.message}`);
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