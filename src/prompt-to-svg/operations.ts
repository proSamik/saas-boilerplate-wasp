import type { GenerateSvgs, ConvertToGif } from 'wasp/server/operations';
import { HttpError } from 'wasp/server';

// Import from the new modular files
import { callOpenRouterAPI } from './ai-connection';
import { getEnhancedPrompt, SYSTEM_PROMPT } from './prompt-templates';
import { 
  validateSvg, 
  autoFixSvg, 
  fixTruncatedSvg,
  generateSvgVariations, 
  convertSvgToGif 
} from './image-processing';

/**
 * Wasp operation to generate SVGs from a text prompt
 */
export const generateSvgs: GenerateSvgs<
  { prompt: string; model: string; type: 'workflow' | 'videoElement' },
  { svgs: string[] }
> = async ({ prompt, model, type }, context) => {
  try {
    // Get enhanced prompt based on type
    const enhancedPrompt = getEnhancedPrompt(prompt, type);
    
    // Call the OpenRouter API
    let baseSvg = await callOpenRouterAPI(SYSTEM_PROMPT, enhancedPrompt, model);
    
    // Fix truncated SVG if needed
    baseSvg = fixTruncatedSvg(baseSvg);

    // Auto-fix common issues
    baseSvg = autoFixSvg(baseSvg);

    // Validate the base SVG
    const validation = validateSvg(baseSvg);
    if (!validation.isValid) {
      console.warn('SVG validation failed:', validation.error);
      throw new Error(`Invalid SVG generated: ${validation.error}`);
    }

    // Generate variations with animations based on type
    const svgs = generateSvgVariations(baseSvg, type);

    return { svgs };
  } catch (error: any) {
    console.error('Error generating SVGs:', error);
    throw new HttpError(500, error.message || 'Failed to generate SVGs');
  }
};

/**
 * Wasp operation to convert SVG to GIF
 */
export const convertToGif: ConvertToGif<
  { svg: string }, 
  { gifUrl: string }
> = async ({ svg }, context) => {
  try {
    const gifUrl = await convertSvgToGif(svg);
    return { gifUrl };
  } catch (error: any) {
    console.error('Error converting to GIF:', error);
    throw new HttpError(500, `Failed to convert to GIF: ${error.message}`);
  }
};
