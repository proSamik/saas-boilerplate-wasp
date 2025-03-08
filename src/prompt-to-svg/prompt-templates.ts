/**
 * Gets the enhanced user prompt based on type and user input
 * @param prompt User input prompt
 * @param type Type of SVG to generate (workflow or videoElement)
 * @returns Formatted prompt for the AI
 */
export function getEnhancedPrompt(prompt: string, type: 'workflow' | 'videoElement'): string {
  return type === 'workflow' 
    ? `Design a professional, animated workflow diagram with these specifications:

CONTENT:
- Create a workflow diagram showing: ${prompt}
- Follow a logical flow direction
- Use your own imagination to create a professional workflow diagram
- Follow left to right direction

STYLING:
- Use a clean design with rounded corners
- Keep it professional with appropriate details
- Background should be white
- All the elements should be visible and in contrast to the background
- Don't overlay text on top of other text
- Don't overlap elements
- Use a harmonious color palette
- Keep Some space between the elements
- Prefer using line instead of arrow, but if required use arrow
- Don't overlay element over text
- If using text over element, use text-anchor to align text properly and inside the element
- Arrows should have proper direction and with tail only on one side
- For biderection communication use two arrows
- Use proper arrow head
- Use proper arrow tail
- Use proper arrow body
- If using arrow, show some animation on it
- If using line, use dotted line and show animation on it

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
}

/**
 * The system prompt that instructs the AI how to generate SVG code
 */
export const SYSTEM_PROMPT = `You are an expert SVG designer which replaces animation work for video editors and provide alternative via svg code. 

Create valid SVG code following these requirements:

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
- Ensure all elements are complete and well-formed`;

// Animation presets for different use cases
export const ANIMATION_PRESETS = {
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