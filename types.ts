
export enum Role {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system',
  TOOL = 'tool'
}

export enum SpecializedTask {
  NONE = 'none',
  DETECTION = 'detection',
  SEGMENTATION = 'segmentation',
  TRANSCRIPTION = 'transcription',
  STRUCTURED = 'structured',
  RESEARCH = 'research',
  COMPUTER_USE = 'computer_use'
}

export type ThinkingLevel = 'minimal' | 'low' | 'medium' | 'high';

export enum MediaResolution {
  UNSPECIFIED = 'MEDIA_RESOLUTION_UNSPECIFIED',
  LOW = 'MEDIA_RESOLUTION_LOW',
  MEDIUM = 'MEDIA_RESOLUTION_MEDIUM',
  HIGH = 'MEDIA_RESOLUTION_HIGH'
}

export enum BatchJobState {
  PENDING = 'JOB_STATE_PENDING',
  RUNNING = 'JOB_STATE_RUNNING',
  SUCCEEDED = 'JOB_STATE_SUCCEEDED',
  FAILED = 'JOB_STATE_FAILED',
  CANCELLED = 'JOB_STATE_CANCELLED',
  EXPIRED = 'JOB_STATE_EXPIRED'
}

export interface BatchRequest {
  contents: MessagePart[];
  config?: any;
}

export interface BatchJob {
  name: string;
  model: string;
  state: BatchJobState;
  createTime: string;
  displayName: string;
  error?: any;
  dest?: {
    inlinedResponses?: any[];
    fileName?: string;
  };
}

export interface VisionResult {
  box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax]
  label: string;
  mask?: string; // base64 png
}

export interface TranscriptResult {
  summary: string;
  segments: any[];
}

export interface FunctionCall {
  name: string;
  args: any;
  id?: string;
}

export interface FunctionResponse {
  name: string;
  response: any;
  id?: string;
}

export interface SourceFile {
  id: string;
  name: string;
  mimeType: string;
  data: string; // base64
  size: number;
  tokenCountEstimate: number;
  isIndexed?: boolean;
}

export interface GroundingChunk {
  web?: { uri: string; title: string };
  maps?: { uri: string; title: string; placeId?: string };
}

export interface GroundingSupport {
  segment: { startIndex: number; endIndex: number; text: string };
  groundingChunkIndices: number[];
}

export interface GroundingMetadata {
  webSearchQueries?: string[];
  groundingChunks?: GroundingChunk[];
  groundingSupports?: GroundingSupport[];
  searchEntryPoint?: { renderedContent: string };
  googleMapsWidgetContextToken?: string;
}

export interface UrlMetadata {
  retrievedUrl: string;
  urlRetrievalStatus: 'URL_RETRIEVAL_STATUS_SUCCESS' | 'URL_RETRIEVAL_STATUS_UNSAFE' | 'URL_RETRIEVAL_STATUS_FAILED';
}

export interface UrlContextMetadata {
  urlMetadata: UrlMetadata[];
}

export interface SafetyDecision {
  explanation: string;
  decision: 'require_confirmation' | 'regular';
}

export interface MessagePart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
  thought?: boolean;
  thoughtSignature?: string;
  visionResults?: VisionResult[];
  transcriptResult?: TranscriptResult;
  structuredResult?: any;
  functionCall?: FunctionCall;
  functionResponse?: FunctionResponse;
  executableCode?: string;
  executionOutput?: string;
  researchThought?: string;
  groundingMetadata?: GroundingMetadata;
  urlContextMetadata?: UrlContextMetadata;
  safetyDecision?: SafetyDecision;
}

export interface UsageMetadata {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
  cachedContentTokenCount?: number;
}

export interface Message {
  id: string;
  role: Role;
  parts: MessagePart[];
  timestamp: number;
  isStreaming?: boolean;
  interactionId?: string;
  usage?: UsageMetadata;
}

export interface SpeakerConfig {
  name: string;
  voice: string;
}

export interface ToolDeclaration {
  name: string;
  description: string;
  parameters: any;
}

export interface GenerationConfig {
  model: ModelId;
  systemInstruction: string;
  temperature: number;
  thinkingLevel: ThinkingLevel;
  thinkingBudget: number;
  includeThoughts: boolean;
  maxOutputTokens: number;
  aspectRatio: string;
  imageSize: string;
  mediaResolution: MediaResolution;
  useGoogleSearch: boolean;
  useCodeExecution: boolean;
  useGoogleMaps: boolean;
  useUrlContext: boolean;
  useComputerUse: boolean;
  useFileSearch: boolean;
  fileSearchStoreName: string | null;
  latitude?: number;
  longitude?: number;
  specializedTask: SpecializedTask;
  customSchema: string;
  activeTools: string[];
  voiceName: string;
  multiSpeaker: boolean;
  speakers: SpeakerConfig[];
  // Long Context Config
  cacheTtlSeconds: number;
  useCaching: boolean;
  // Prompt Strategy Augmentations
  useStrictGrounding: boolean;
  useDateAwareness: boolean;
  useKnowledgeCutoff: boolean;
  useAutoPlanning: boolean;
  useSelfCritique: boolean;
  useVisualThinking: boolean;
}

export enum ModelId {
  FLASH = 'gemini-3-flash-preview',
  PRO = 'gemini-3-pro-preview',
  COMPUTER_USE = 'gemini-2.5-computer-use-preview-10-2025',
  FLASH_2_5 = 'gemini-2.5-flash',
  PRO_2_5 = 'gemini-2.5-pro',
  IMAGE_FLASH = 'gemini-2.5-flash-image',
  IMAGE_PRO = 'gemini-3-pro-image-preview',
  TTS_FLASH = 'gemini-2.5-flash-preview-tts',
  TTS_PRO = 'gemini-2.5-pro-preview-tts',
  VEO_FAST = 'veo-3.1-fast-generate-preview'
}

export const MODEL_LIMITS: Record<ModelId | string, { input: number, output: number }> = {
  [ModelId.FLASH]: { input: 1048576, output: 8192 },
  [ModelId.PRO]: { input: 2097152, output: 8192 },
  [ModelId.COMPUTER_USE]: { input: 1048576, output: 8192 },
  [ModelId.FLASH_2_5]: { input: 1048576, output: 8192 },
  [ModelId.PRO_2_5]: { input: 2097152, output: 8192 },
  [ModelId.IMAGE_FLASH]: { input: 1048576, output: 2048 },
  [ModelId.IMAGE_PRO]: { input: 1048576, output: 2048 },
  [ModelId.TTS_FLASH]: { input: 1048576, output: 2048 },
  [ModelId.TTS_PRO]: { input: 1048576, output: 2048 },
  [ModelId.VEO_FAST]: { input: 1048576, output: 2048 }
};

export const DEEP_RESEARCH_AGENT = 'deep-research-pro-preview-12-2025';

export const VOICES = [
  "Zephyr", "Puck", "Charon", "Kore", "Fenrir", 
  "Leda", "Orus", "Aoede", "Callirrhoe", "Autonoe"
];

export const TOOL_LIBRARY: Record<string, ToolDeclaration> = {
  get_weather: {
    name: "get_weather",
    description: "Get the current weather for a specific location.",
    parameters: {
      type: "OBJECT",
      properties: {
        location: { type: "STRING", description: "City and state, e.g. San Francisco, CA" },
        unit: { type: "STRING", enum: ["celsius", "fahrenheit"] }
      },
      required: ["location"]
    }
  },
  control_light: {
    name: "control_light",
    description: "Sets the brightness and color temperature of a light.",
    parameters: {
      type: "OBJECT",
      properties: {
        brightness: { type: "NUMBER", description: "0-100 brightness level" },
        color_temp: { type: "STRING", enum: ["warm", "cool", "daylight"] }
      },
      required: ["brightness", "color_temp"]
    }
  },
  get_stock_price: {
    name: "get_stock_price",
    description: "Retrieve real-time or historical stock performance for a given symbol.",
    parameters: {
      type: "OBJECT",
      properties: {
        symbol: { type: "STRING", description: "The stock ticker symbol, e.g. GOOGL" },
        timeframe: { type: "STRING", enum: ["1d", "1w", "1m", "1y", "max"], default: "1d" }
      },
      required: ["symbol"]
    }
  },
  generate_image_description: {
    name: "generate_image_description",
    description: "Generate a highly detailed, prompt-engineered description for an image gen model based on user intent.",
    parameters: {
      type: "OBJECT",
      properties: {
        concept: { type: "STRING", description: "The core concept or object to describe" },
        style: { type: "STRING", description: "The artistic style requested" }
      },
      required: ["concept"]
    }
  }
};

export const SCHEMA_PRESETS = {
  RECIPE: JSON.stringify({
    type: "OBJECT",
    properties: {
      recipe_name: { type: "STRING" },
      ingredients: { 
        type: "ARRAY", 
        items: { 
          type: "OBJECT", 
          properties: { name: { type: "STRING" }, amount: { type: "STRING" } }
        } 
      }
    }
  }, null, 2)
};
