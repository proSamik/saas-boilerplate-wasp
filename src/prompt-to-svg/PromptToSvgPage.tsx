import { useState } from 'react';
import { generateSvgs, convertToGif } from 'wasp/client/operations';
import { CgSpinner } from 'react-icons/cg';
import { cn } from '../client/cn';

// Example prompts for SVG generation
const EXAMPLE_PROMPTS = {
  workflow: [
    'A user authentication flow diagram',
    'API request-response cycle',
    'Database CRUD operations flow',
    'Microservices architecture',
    'CI/CD pipeline visualization',
    'Event-driven system workflow',
  ],
  videoElement: [
    'Animated arrow pointing right',
    'Pulsing highlight circle',
    'Morphing shape transition',
    'Loading spinner animation',
    'Progress bar with glow',
    'Animated checkmark',
  ],
};

// Available AI models
const AI_MODELS = [
  { id: 'deepseek', name: 'Deepseek', description: 'Specialized in creative tasks' },
  { id: 'claude', name: 'Claude', description: 'Balanced performance' },
  { id: 'openai', name: 'OpenAI', description: 'GPT-4 powered' },
];

type GenerationType = 'workflow' | 'videoElement';

export default function PromptToSvgPage() {
  const [prompt, setPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState(AI_MODELS[0]);
  const [selectedType, setSelectedType] = useState<GenerationType>('videoElement');
  const [svgs, setSvgs] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isConverting, setIsConverting] = useState(false);

  const handleGenerate = async () => {
    try {
      setIsGenerating(true);
      const response = await generateSvgs({
        prompt,
        model: selectedModel.id,
        type: selectedType
      });
      setSvgs(response.svgs);
    } catch (error: any) {
      console.error('Error generating SVGs:', error);
      window.alert('Error: ' + (error.message || 'Something went wrong'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConvertToGif = async (svgContent: string) => {
    try {
      setIsConverting(true);
      const response = await convertToGif({
        svg: svgContent
      });
      // Handle GIF download
      const link = document.createElement('a');
      link.href = response.gifUrl;
      link.download = 'converted.gif';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error: any) {
      console.error('Error converting to GIF:', error);
      window.alert('Error: ' + (error.message || 'Something went wrong'));
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div className='py-10 lg:mt-10'>
      <div className='mx-auto max-w-7xl px-6 lg:px-8'>
        <div className='mx-auto max-w-4xl text-center'>
          <h2 className='mt-2 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl dark:text-white'>
            Prompt to <span className='text-yellow-500'>SVG</span>
          </h2>
        </div>
        <p className='mx-auto mt-6 max-w-2xl text-center text-lg leading-8 text-gray-600 dark:text-white'>
          Generate professional animated SVGs for video editing and workflow visualization. Choose your type and preferred AI model!
        </p>

        <div className='my-8 border rounded-3xl border-gray-900/10 dark:border-gray-100/10'>
          <div className='sm:w-[90%] md:w-[70%] lg:w-[50%] py-10 px-6 mx-auto my-8 space-y-10'>
            {/* Type Selection */}
            <div className='flex flex-col gap-4'>
              <label className='text-sm font-semibold text-gray-700 dark:text-gray-300'>
                Choose Generation Type
              </label>
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                <button
                  onClick={() => setSelectedType('workflow')}
                  className={cn(
                    'p-4 rounded-lg border text-left transition-all',
                    selectedType === 'workflow'
                      ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                      : 'border-gray-200 hover:border-yellow-300'
                  )}
                >
                  <div className='font-medium text-gray-900 dark:text-white'>Workflow</div>
                  <div className='text-sm text-gray-500 dark:text-gray-400'>System diagrams & process flows</div>
                </button>
                <button
                  onClick={() => setSelectedType('videoElement')}
                  className={cn(
                    'p-4 rounded-lg border text-left transition-all',
                    selectedType === 'videoElement'
                      ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                      : 'border-gray-200 hover:border-yellow-300'
                  )}
                >
                  <div className='font-medium text-gray-900 dark:text-white'>Video Element</div>
                  <div className='text-sm text-gray-500 dark:text-gray-400'>Animated graphics & effects</div>
                </button>
              </div>
            </div>

            {/* Model Selection */}
            <div className='flex flex-col gap-4'>
              <label className='text-sm font-semibold text-gray-700 dark:text-gray-300'>
                Choose AI Model
              </label>
              <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
                {AI_MODELS.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => setSelectedModel(model)}
                    className={cn(
                      'p-4 rounded-lg border text-left transition-all',
                      selectedModel.id === model.id
                        ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                        : 'border-gray-200 hover:border-yellow-300'
                    )}
                  >
                    <div className='font-medium text-gray-900 dark:text-white'>{model.name}</div>
                    <div className='text-sm text-gray-500 dark:text-gray-400'>{model.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt Input */}
            <div className='flex flex-col gap-4'>
              <label className='text-sm font-semibold text-gray-700 dark:text-gray-300'>
                Enter your prompt
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={selectedType === 'workflow' 
                  ? 'Describe the workflow or system diagram you want to generate...'
                  : 'Describe the video element or animation you want to generate...'}
                className='w-full h-32 p-3 rounded-lg border border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700'
              />
              <div className='flex flex-wrap gap-2'>
                {EXAMPLE_PROMPTS[selectedType].map((examplePrompt) => (
                  <button
                    key={examplePrompt}
                    onClick={() => setPrompt(examplePrompt)}
                    className='text-sm px-3 py-1 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700'
                  >
                    {examplePrompt}
                  </button>
                ))}
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={!prompt || isGenerating}
              className='w-full flex items-center justify-center py-3 px-4 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {isGenerating ? (
                <>
                  <CgSpinner className='inline-block mr-2 animate-spin' />
                  Generating...
                </>
              ) : (
                'Generate SVGs'
              )}
            </button>

            {/* SVG Display Grid */}
            {svgs.length > 0 && (
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-6'>
                {svgs.map((svg, index) => (
                  <div key={index} className='relative group'>
                    <div className='aspect-square rounded-lg border border-gray-200 overflow-hidden bg-white dark:bg-gray-800'>
                      <div dangerouslySetInnerHTML={{ __html: svg }} />
                    </div>
                    <button
                      onClick={() => handleConvertToGif(svg)}
                      disabled={isConverting}
                      className='absolute bottom-4 left-1/2 transform -translate-x-1/2 py-2 px-4 bg-black/75 text-white rounded-full text-sm opacity-0 group-hover:opacity-100 transition-opacity'
                    >
                      {isConverting ? 'Converting...' : 'Convert to GIF'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 