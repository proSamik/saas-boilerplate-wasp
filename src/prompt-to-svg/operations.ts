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

// Function to generate SVG using OpenRouter API
export const generateSvgs: GenerateSvgs<
  { prompt: string; model: string; type: 'workflow' | 'videoElement' },
  { svgs: string[] }
> = async ({ prompt, model, type }, context) => {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new HttpError(500, 'OpenRouter API key is not configured');
  }

  // Enhance prompt based on type
  const enhancedPrompt = type === 'workflow' 
    ? `Create a professional workflow diagram with the following requirements:
       - Use clean, modern design elements
       - Include connection lines with arrows
       - Add visual hierarchy with size and color
       - Ensure elements are properly spaced
       - Make it suitable for animation
       Workflow description: ${prompt}`
    : `Create a professional video element with the following requirements:
       - Use smooth, polished shapes
       - Add depth with gradients or shadows
       - Make it suitable for animation
       - Ensure high visual impact
       - Keep it clean and modern
       Element description: ${prompt}`;

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
            content: `You are an expert SVG artist specializing in creating professional-grade animated graphics for video editing and workflow visualization. Follow these rules strictly:

1. Required SVG Structure:
   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
     <defs>
       <!-- Define gradients, filters, and other effects here -->
     </defs>
     <g class="main">
       <!-- Main content here -->
     </g>
   </svg>

2. Design Guidelines:
   - Use professional-grade visual elements
   - Implement smooth gradients and shadows
   - Create clean, modern designs
   - Ensure high visual impact
   - Make elements suitable for animation

3. Technical Requirements:
   - Include proper xmlns attribute
   - Use viewBox="0 0 400 400"
   - Set width="400" height="400"
   - Group elements with <g> tags
   - Use descriptive class names
   - Close all paths properly
   - Use relative coordinates

4. Animation Support:
   - Add animation-ready elements
   - Use transform-origin attributes
   - Implement smooth transitions
   - Support motion paths
   - Enable morphing capabilities

5. Professional Features:
   - Add drop shadows where appropriate
   - Use gradient fills for depth
   - Implement proper stroke widths
   - Maintain visual hierarchy
   - Ensure scalability

6. Output Format:
   - Provide clean, valid SVG code
   - No explanations or markdown
   - Include only the SVG content
   - Ensure proper nesting
   - Validate all attributes

Example Response:
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:rgb(255,255,255);stop-opacity:1" />
      <stop offset="100%" style="stop-color:rgb(200,200,200);stop-opacity:1" />
    </linearGradient>
  </defs>
  <g class="main">
    <circle cx="200" cy="200" r="100" fill="url(#grad)" filter="drop-shadow(0 0 5px rgba(0,0,0,0.3))"/>
  </g>
</svg>`
          },
          {
            role: 'user',
            content: enhancedPrompt
          }
        ],
        max_tokens: 1500,
        temperature: 0.7,
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