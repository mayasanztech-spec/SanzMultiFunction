
import { GoogleGenAI, GenerateContentResponse, Chat, Modality, Type } from "@google/genai";
import { GenerationConfig, ModelId, SpecializedTask, TOOL_LIBRARY, BatchJob, BatchJobState } from "../types";

export class GeminiService {
  private chat: Chat | null = null;

  private buildThinkingConfig(config: GenerationConfig) {
    return { 
      thinkingBudget: config.thinkingBudget >= 0 ? config.thinkingBudget : 16000, 
      includeThoughts: config.includeThoughts 
    };
  }

  private augmentSystemInstruction(config: GenerationConfig): string {
    let instruction = config.systemInstruction || "";
    
    if (config.useStrictGrounding) {
      instruction += "\n\nYou are a strictly grounded assistant. Rely ONLY on the provided context.";
    }

    if (config.useAutoPlanning) {
      instruction += "\n\nBefore responding, create a step-by-step execution plan.";
    }

    if (config.useSelfCritique) {
      instruction += "\n\nCritique your own response for accuracy before finalizing.";
    }

    if (config.useVisualThinking) {
      instruction += "\n\nUse visual reasoning to describe images spatially and logically.";
    }

    return instruction;
  }

  private parseSchema(schemaStr: string): any {
    try {
      const schema = JSON.parse(schemaStr);
      const mapTypes = (obj: any) => {
        if (obj.type && typeof obj.type === 'string') {
          obj.type = Type[obj.type as keyof typeof Type] || obj.type;
        }
        if (obj.properties) {
          for (const key in obj.properties) mapTypes(obj.properties[key]);
        }
        if (obj.items) mapTypes(obj.items);
      };
      mapTypes(schema);
      return schema;
    } catch (e) {
      return null;
    }
  }

  private getTools(config: GenerationConfig) {
    const tools: any[] = [];
    
    if (config.useGoogleSearch) {
      tools.push({ googleSearch: {} });
    }
    
    if (config.useCodeExecution) {
      tools.push({ codeExecution: {} });
    }

    if (config.activeTools && config.activeTools.length > 0) {
      const functionDeclarations = config.activeTools.map(name => {
        const tool = TOOL_LIBRARY[name];
        return {
          name: tool.name,
          description: tool.description,
          parameters: this.parseSchema(JSON.stringify(tool.parameters))
        };
      });
      tools.push({ functionDeclarations });
    }
    
    return tools.length > 0 ? tools : undefined;
  }

  // Implementation for Live API auth token provisioning
  public async createAuthToken(minutes: number): Promise<{ name: string }> {
    // In a real app, this would call a backend endpoint to generate a short-lived token
    return { name: `session_token_${Date.now()}_exp_${minutes}` };
  }

  // Implementation for Live API real-time connectivity
  public async connectLive(callbacks: any, systemInstruction: string, options: any) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    return ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      callbacks,
      config: {
        systemInstruction,
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
        },
        tools: this.getTools({ ...options, systemInstruction } as any),
        thinkingConfig: { thinkingBudget: options.thinkingBudget || 0 }
      }
    });
  }

  // Implementation for Batch API operations (Stubs for storage/management)
  public async listFiles(): Promise<any[]> {
    // Returns list of accessible JSONL files for batch processing
    return [];
  }

  public async createBatchJob(model: ModelId, source: any, displayName: string): Promise<BatchJob> {
    // Orchestrates a long-running batch inference pipeline
    return {
      name: `batch_job_${Date.now()}`,
      displayName,
      model,
      state: BatchJobState.PENDING,
      createTime: new Date().toISOString()
    };
  }

  public async getBatchJob(name: string): Promise<BatchJob> {
    // Retrieves current lifecycle state of a batch pipeline
    return {
      name,
      displayName: "Neural_Architect_Batch",
      model: ModelId.FLASH,
      state: BatchJobState.SUCCEEDED,
      createTime: new Date().toISOString(),
      dest: { inlinedResponses: [] }
    };
  }

  public async cancelBatchJob(name: string): Promise<void> {
    // Terminates an active batch pipeline
    console.debug(`Signaling termination for pipeline: ${name}`);
  }

  public async countTokens(model: string, contents: any[], config?: Partial<GenerationConfig>) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const countParams: any = { model, contents };
    
    if (config) {
      countParams.config = {
        systemInstruction: this.augmentSystemInstruction(config as GenerationConfig),
        tools: this.getTools(config as GenerationConfig)
      };
    }

    const response = await ai.models.countTokens(countParams);
    return response.totalTokens;
  }

  public initChat(config: GenerationConfig, history: any[] = []) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const isSpecialTask = config.specializedTask !== SpecializedTask.NONE;
    
    const generationConfig: any = {
      systemInstruction: this.augmentSystemInstruction(config),
      temperature: config.temperature,
      thinkingConfig: this.buildThinkingConfig(config),
      mediaResolution: config.mediaResolution
    };

    if (config.maxOutputTokens > 0) {
      generationConfig.maxOutputTokens = config.maxOutputTokens;
    }

    if (isSpecialTask) {
      generationConfig.responseMimeType = "application/json";
      if (config.specializedTask === SpecializedTask.STRUCTURED) {
        const schema = this.parseSchema(config.customSchema);
        if (schema) generationConfig.responseSchema = schema;
      }
    }

    this.chat = ai.chats.create({
      model: config.model,
      history,
      config: {
        ...generationConfig,
        tools: this.getTools(config)
      }
    });
  }

  public async *sendMessageStream(parts: any[]) {
    if (!this.chat) throw new Error("Chat session not active.");
    const stream = await this.chat.sendMessageStream({ message: parts });
    for await (const chunk of stream) {
      yield chunk;
    }
  }
}

export const gemini = new GeminiService();
