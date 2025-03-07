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

// Animation presets for different use cases
const ANIMATION_PRESETS = {
  workflow: {
    highlight: `<animate attributeName="stroke-width" values="2;4;2" dur="1s" repeatCount="indefinite"/>
                <animate attributeName="stroke-opacity" values="0.6;1;0.6" dur="1s" repeatCount="indefinite"/>`,
    flow: `<animate attributeName="stroke-dashoffset" from="0" to="20" dur="1s" repeatCount="indefinite"/>`,
    pulse: `<animate attributeName="r" values="10;12;10" dur="1s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0.6;1;0.6" dur="1s" repeatCount="indefinite"/>`,
    fadeIn: `<animate attributeName="opacity" from="0" to="1" dur="0.5s" fill="freeze"/>`
  },
  videoElements: {
    glow: `<animate attributeName="filter" values="blur(0px);blur(2px);blur(0px)" dur="2s" repeatCount="indefinite"/>`,
    rotate: `<animateTransform attributeName="transform" type="rotate" from="0 200 200" to="360 200 200" dur="3s" repeatCount="indefinite"/>`,
    morph: `<animate attributeName="d" dur="2s" repeatCount="indefinite"/>`,
    scale: `<animateTransform attributeName="transform" type="scale" values="1;1.2;1" dur="1s" repeatCount="indefinite"/>`
  }
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

// Function to generate SVG variations with different styles and animations
function generateSvgVariations(baseSvg: string, type: 'workflow' | 'videoElement'): string[] {
  // Helper function to add animation to SVG
  const addAnimation = (svg: string, animation: string, target: string): string => {
    return svg.replace(`<${target}`, `<${target}>${animation}`);
  };

  let enhancedSvg = baseSvg;

  if (type === 'workflow') {
    // Add drop shadow for better visibility
    enhancedSvg = enhancedSvg.replace(
      '<svg',
      '<svg style="filter: drop-shadow(0 0 3px rgba(0,0,0,0.2))"'
    );

    // Add flow animation to paths (arrows and connections)
    enhancedSvg = addAnimation(
      enhancedSvg,
      ANIMATION_PRESETS.workflow.flow,
      'path'
    );

    // Add pulse animation to circles (nodes)
    enhancedSvg = addAnimation(
      enhancedSvg,
      ANIMATION_PRESETS.workflow.pulse,
      'circle'
    );

    // Add highlight animation to important groups
    enhancedSvg = addAnimation(
      enhancedSvg,
      ANIMATION_PRESETS.workflow.highlight,
      'g[class*="highlight"]'
    );

    // Add fade-in animation to text elements
    enhancedSvg = addAnimation(
      enhancedSvg,
      ANIMATION_PRESETS.workflow.fadeIn,
      'text'
    );
  } else {
    // Add glow effect for video elements
    enhancedSvg = enhancedSvg.replace(
      '<svg',
      '<svg style="filter: drop-shadow(0 0 5px rgba(255,255,255,0.5))"'
    );

    // Add rotation animation to specific groups
    enhancedSvg = addAnimation(
      enhancedSvg,
      ANIMATION_PRESETS.videoElements.rotate,
      'g[class*="rotate"]'
    );

    // Add scale animation to specific elements
    enhancedSvg = addAnimation(
      enhancedSvg,
      ANIMATION_PRESETS.videoElements.scale,
      'g[class*="scale"]'
    );

    // Add morphing animation to paths
    enhancedSvg = addAnimation(
      enhancedSvg,
      ANIMATION_PRESETS.videoElements.morph,
      'path[class*="morph"]'
    );
  }

  return [enhancedSvg];
}

// Function to fix truncated SVG
function fixTruncatedSvg(svg: string): string {
  // Check if SVG is truncated (doesn't end with closing tag)
  if (!svg.trim().endsWith('</svg>')) {
    console.warn('Detected truncated SVG, attempting to fix');
    
    // Close any open tags and add closing SVG tag
    let fixed = svg;
    
    // Find the last complete element and truncate there
    const lastCompleteElement = Math.max(
      fixed.lastIndexOf('</g>'),
      fixed.lastIndexOf('</path>'),
      fixed.lastIndexOf('</rect>'),
      fixed.lastIndexOf('</circle>'),
      fixed.lastIndexOf('</text>')
    );
    
    if (lastCompleteElement > 0) {
      fixed = fixed.substring(0, lastCompleteElement + 4); // +4 to include the closing tag
    }
    
    // Close the SVG tag
    fixed += '</g></svg>';
    
    return fixed;
  }
  
  return svg;
}

// Function to generate SVG using OpenRouter API
export const generateSvgs: GenerateSvgs<
  { prompt: string; model: string; type: 'workflow' | 'videoElement' },
  { svgs: string[] }
> = async ({ prompt, model, type }, context) => {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new HttpError(500, 'OpenRouter API key is not configured');
  }

  // Enhanced user prompts based on type
  const enhancedPrompt = type === 'workflow' 
    ? `Design a professional, animated workflow diagram with these specifications:

CONTENT:
- Create a workflow diagram showing: ${prompt}
- Use 4-6 main components with connecting arrows
- Follow a logical flow direction

STYLING:
- Use a clean design with rounded corners
- Apply a blue/gray color scheme
- Keep it professional with appropriate details

TECHNICAL:
- Add class names: "highlight", "rotate", "scale", "flow-arrow", "pulse-node"
- Group related elements with <g> tags
- Make text readable and properly positioned
- IMPORTANT: Keep SVG code well-structured and complete`

    : `Design a professional video element with these specifications:

CONTENT:
- Create a ${prompt} suitable for video overlays
- Design for smooth animation

STYLING:
- Use gradients and subtle shadows
- Create clean vector shapes
- Use a harmonious color palette

TECHNICAL:
- Add class names: "rotate", "scale", "morph"
- Group elements with <g> tags
- IMPORTANT: Keep SVG code well-structured and complete`;

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
            content: `You are an expert SVG designer. Create valid SVG code following these requirements:

SVG STRUCTURE:
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <defs>
    <!-- Define gradients, filters here -->
  </defs>
  <g class="container">
    <!-- Components with proper classes -->
  </g>
</svg>

REQUIREMENTS:
1. Use xmlns="http://www.w3.org/2000/svg" attribute
2. Set viewBox="0 0 400 400" and dimensions
3. Include at least 1 gradient and 1 filter
4. Use classes that match animation targets
5. Output ONLY valid SVG code
6. All opening tags must have closing tags

DESIGN PRINCIPLES:
- Create clean, modern designs
- Add appropriate shadows
- Use readable fonts
- Ensure all elements are complete and well-formed`
          },
          {
            role: 'user',
            content: enhancedPrompt
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
    
    // Extract SVG code from the response
    let baseSvg = data.choices[0].message.content;
    
    // Fix truncated SVG if needed
    baseSvg = fixTruncatedSvg(baseSvg);

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

    // Generate variations with animations based on type
    const svgs = generateSvgVariations(baseSvg, type);

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
    if (!validateSvg(svg).isValid) {
      throw new Error('Invalid SVG content');
    }

    // Create a temporary directory for processing
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'svg-to-gif-'));
    const svgPath = path.join(tempDir, 'input.svg');
    const htmlPath = path.join(tempDir, 'render.html');
    const gifPath = path.join(tempDir, 'output.gif');

    // Create an HTML file that embeds the SVG with proper sizing
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body, html {
              margin: 0;
              padding: 0;
              overflow: hidden;
              background: transparent;
              width: 100%;
              height: 100%;
            }
            .svg-container {
              width: 100%;
              height: 100%;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            svg {
              width: 100%;
              height: 100%;
              max-width: 800px;
              max-height: 800px;
            }
          </style>
        </head>
        <body>
          <div class="svg-container">
            ${svg}
          </div>
        </body>
      </html>
    `;
    
    // Write files to disk
    await fs.writeFile(svgPath, svg, 'utf8');
    await fs.writeFile(htmlPath, htmlContent, 'utf8');

    // Launch Puppeteer to capture frames
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      
      // Set viewport to a large size to accommodate SVGs
      await page.setViewport({ 
        width: 800, 
        height: 800,
        deviceScaleFactor: 1
      });
      
      // Load the HTML file
      await page.goto(`file://${htmlPath}`, {
        waitUntil: 'networkidle0',
        timeout: 5000
      });

      // Capture multiple frames for animation (5 frames at 200ms intervals)
      const frames = [];
      for (let i = 0; i < 5; i++) {
        // Delay to allow animations to progress
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Capture frame
        const frameData = await page.screenshot({
          type: 'png',
          omitBackground: true,
          encoding: 'binary'
        });
        
        frames.push(frameData);
      }

      // Close the browser
      await browser.close();

      // Use sharp to create an animated GIF from the frames
      const frameBuffers = frames.map(frame => Buffer.from(frame));
      const firstFrame = await sharp(frameBuffers[0]).metadata();
      
      // Use the first frame to determine dimensions
      const width = firstFrame.width || 800;
      const height = firstFrame.height || 800;

      // Create an animated GIF from frames using sharp
      const gifOptions = {
        delay: 20, // 20 centi-seconds = 200ms between frames
        loop: 0    // 0 = loop forever
      };

      // Process all frames and create GIF
      const frameProcessing = frameBuffers.map(frame => 
        sharp(frame)
          .resize(width, height)
          .toBuffer()
      );
      
      const processedFrames = await Promise.all(frameProcessing);
      
      // Use the first frame as the base and add the rest as frames
      const outputBuffer = await sharp(processedFrames[0])
        .gif(gifOptions)
        .toBuffer();
      
      await fs.writeFile(gifPath, outputBuffer);

      // Read the GIF file and convert to base64
      const gifBuffer = await fs.readFile(gifPath);
      const gifBase64 = gifBuffer.toString('base64');

      // Clean up temporary files
      await fs.rm(tempDir, { recursive: true, force: true });

      return {
        gifUrl: `data:image/gif;base64,${gifBase64}`
      };
    } catch (error) {
      await browser.close();
      throw error;
    }
  } catch (error: any) {
    console.error('Error converting to GIF:', error);
    throw new HttpError(500, `Failed to convert to GIF: ${error.message}`);
  }
}; 