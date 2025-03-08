import { HttpError } from 'wasp/server';
import puppeteer from 'puppeteer';
import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { ANIMATION_PRESETS } from './prompt-templates';

/**
 * Validates SVG content with detailed checks
 * @param svg SVG string to validate
 * @returns Object with validation result and optional error message
 */
export function validateSvg(svg: string): { isValid: boolean; error?: string } {
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

/**
 * Fixes common issues in SVG content
 * @param svg SVG string to fix
 * @returns Fixed SVG string
 */
export function autoFixSvg(svg: string): string {
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

/**
 * Sanitizes SVG content
 * @param svg SVG string to sanitize
 * @returns Sanitized SVG string
 */
export function sanitizeSvg(svg: string): string {
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

/**
 * Fixes truncated SVG content
 * @param svg SVG string to fix
 * @returns Fixed SVG string
 */
export function fixTruncatedSvg(svg: string): string {
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

/**
 * Generates an enhanced SVG with animations based on type
 * @param baseSvg Original SVG string
 * @param type Type of SVG to generate (workflow or videoElement)
 * @returns Array containing the enhanced SVG
 */
export function generateSvgVariations(baseSvg: string, type: 'workflow' | 'videoElement'): string[] {
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

/**
 * Converts SVG to GIF
 * @param svg SVG content to convert
 * @returns Object containing the GIF URL as base64 data
 */
export async function convertSvgToGif(svg: string): Promise<string> {
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

  let browser;
  try {
    // Launch Puppeteer to capture frames
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

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
    browser = null;

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

    return `data:image/gif;base64,${gifBase64}`;
  } catch (error) {
    // Make sure browser is closed even if there's an error
    if (browser) await browser.close();
    console.error('Error converting SVG to GIF:', error);
    throw error;
  }
} 