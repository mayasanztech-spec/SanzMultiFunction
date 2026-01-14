
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
  STRUCTURED = 'structured'
}

export type ThinkingLevel = 'minimal' | 'low' | 'medium' | 'high';

export enum MediaResolution {
  UNSPECIFIED = 'MEDIA_RESOLUTION_UNSPECIFIED',
  LOW = 'MEDIA_RESOLUTION_LOW',
  MEDIUM = 'MEDIA_RESOLUTION_MEDIUM',
  HIGH = 'MEDIA_RESOLUTION_HIGH'
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
}

// Added missing URL context types for grounded reasoning
export interface UrlMetadata {
  retrievedUrl: string;
  urlRetrievalStatus: string;
}

export interface UrlContextMetadata {
  urlMetadata: UrlMetadata[];
}

export interface MessagePart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
  thought?: boolean;
  thoughtSignature?: string;
  researchThought?: string; // Added for advanced research traces
  safetyDecision?: { // Added for safety interventions
    explanation: string;
  };
  visionResults?: VisionResult[];
  transcriptResult?: TranscriptResult;
  structuredResult?: any;
  functionCall?: FunctionCall;
  functionResponse?: FunctionResponse;
  executableCode?: string;
  executionOutput?: string;
  groundingMetadata?: GroundingMetadata;
  urlContextMetadata?: UrlContextMetadata; // Added for URL context visualization
}

export interface UsageMetadata {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
  cachedContentTokenCount?: number; // Added for cache tracking
}

export interface Message {
  id: string;
  role: Role;
  parts: MessagePart[];
  timestamp: number;
  isStreaming?: boolean;
  usage?: UsageMetadata;
  interactionId?: string; // Added for session tracking
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
  mediaResolution: MediaResolution;
  useGoogleSearch: boolean;
  useCodeExecution: boolean;
  specializedTask: SpecializedTask;
  customSchema: string;
  activeTools: string[];
  // Prompt Strategy Augmentations
  useStrictGrounding: boolean;
  useAutoPlanning: boolean;
  useSelfCritique: boolean;
  useVisualThinking: boolean;
  // Capability flags for UI display
  useGoogleMaps?: boolean;
  useFileSearch?: boolean;
  useComputerUse?: boolean;
}

export enum ModelId {
  FLASH = 'gemini-3-flash-preview',
  FLASH_2_5 = 'gemini-2.5-flash-lite-latest',
  IMAGE_FLASH = 'gemini-2.5-flash-image',
  PRO = 'gemini-3-pro-preview', // Added missing PRO model
  IMAGE_PRO = 'gemini-3-pro-image-preview' // Added missing Image PRO model
}

// Added missing Batch Job state and interface
export enum BatchJobState {
  PENDING = 'JOB_STATE_PENDING',
  RUNNING = 'JOB_STATE_RUNNING',
  SUCCEEDED = 'JOB_STATE_SUCCEEDED',
  FAILED = 'JOB_STATE_FAILED',
  CANCELLED = 'JOB_STATE_CANCELLED'
}

export interface BatchJob {
  name: string;
  displayName: string;
  model: string;
  state: BatchJobState;
  createTime: string;
  dest?: {
    inlinedResponses?: any[];
    fileName?: string;
  };
}

export const MODEL_LIMITS: Record<ModelId | string, { input: number, output: number }> = {
  [ModelId.FLASH]: { input: 1048576, output: 8192 },
  [ModelId.FLASH_2_5]: { input: 1048576, output: 8192 },
  [ModelId.IMAGE_FLASH]: { input: 1048576, output: 2048 },
  [ModelId.PRO]: { input: 2097152, output: 8192 },
  [ModelId.IMAGE_PRO]: { input: 1048576, output: 2048 }
};

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
  get_stock_price: {
    name: "get_stock_price",
    description: "Retrieve historical stock performance for a given symbol.",
    parameters: {
      type: "OBJECT",
      properties: {
        symbol: { type: "STRING", description: "The stock ticker symbol, e.g. GOOGL" }
      },
      required: ["symbol"]
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
