
import { GoogleGenAI, GenerateContentResponse, Chat, Modality, Type, LiveServerMessage } from "@google/genai";
import { GenerationConfig, ModelId, SpecializedTask, TOOL_LIBRARY, DEEP_RESEARCH_AGENT, BatchJob } from "../types";

export class GeminiService {
  private chat: Chat | null = null;
  private activeCacheName: string | null = null;

  private buildThinkingConfig(config: GenerationConfig) {
    if (config.specializedTask === SpecializedTask.SEGMENTATION) {
      return { thinkingBudget: 0, includeThoughts: config.includeThoughts };
    }
    return { 
      thinkingBudget: config.thinkingBudget >= 0 ? config.thinkingBudget : 16000, 
      includeThoughts: config.includeThoughts 
    };
  }

  private augmentSystemInstruction(config: GenerationConfig): string {
    let instruction = config.systemInstruction || "";
    
    if (config.useStrictGrounding) {
      instruction += "\n\nYou are a strictly grounded assistant limited to the information provided in the User Context. In your answers, rely **only** on the facts that are directly mentioned in that context. You must **not** access or utilize your own knowledge or common sense to answer. Do not assume or infer from the provided facts; simply report them exactly as they appear. Treat the provided context as the absolute limit of truth.";
    }

    if (config.useDateAwareness) {
      instruction += "\n\nFor time-sensitive user queries that require up-to-date information, you MUST follow the provided current time (date and year) when formulating search queries in tool calls. Remember it is 2025 this year.";
    }

    if (config.useKnowledgeCutoff) {
      instruction += "\n\nYour knowledge cutoff date is January 2025.";
    }

    if (config.useAutoPlanning) {
      instruction += "\n\nBefore providing the final answer, please: 1. Parse the stated goal into distinct sub-tasks. 2. Check if the input information is complete. 3. Create a structured outline to achieve the goal.";
    }

    if (config.useSelfCritique) {
      instruction += "\n\nBefore returning your final response, review your generated output against the user's original constraints: 1. Did I answer the user's *intent*, not just their literal words? 2. Is the tone authentic to the requested persona?";
    }

    if (config.useVisualThinking) {
      instruction += "\n\n**Visual Reasoning Engine Enabled**: When analyzing or manipulating images, you are encouraged to use the Python Sandbox to perform precise pixel-level calculations, color histogram analysis, geometric transformations, or OCR verification. If a task requires manipulating image data, write Python code using standard libraries (PIL, NumPy) to process and output the derived data.";
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
    
    if (config.useFileSearch && config.fileSearchStoreName) {
      tools.push({ 
        fileSearch: { 
          fileSearchStoreNames: [config.fileSearchStoreName] 
        } 
      });
    } else {
      if (config.useGoogleSearch && !config.model.includes('tts')) {
        tools.push({ googleSearch: {} });
      }
      
      if (config.useGoogleMaps && config.model.startsWith('gemini-2.5')) {
        tools.push({ googleMaps: {} });
      }

      if (config.useUrlContext) {
        tools.push({ urlContext: {} });
      }
    }
    
    if (config.useCodeExecution && config.model.startsWith('gemini-3')) {
      tools.push({ codeExecution: {} });
    }

    if (config.useComputerUse && config.model === ModelId.COMPUTER_USE) {
      tools.push({ 
        computerUse: { 
          environment: 'ENVIRONMENT_BROWSER' 
        } 
      });
    }

    if (config.activeTools && config.activeTools.length > 0) {
      const functionDeclarations = config.activeTools.map(name => {
        const tool = TOOL_LIBRARY[name];
        return {
          name: tool.name,
          description: tool.description,
          parameters: this.parseSchema(JSON.stringify(tool.parameters)),
          behavior: "NON_BLOCKING"
        };
      });
      tools.push({ functionDeclarations });
    }
    
    return tools.length > 0 ? tools : undefined;
  }

  private getToolConfig(config: GenerationConfig) {
    if (config.useGoogleMaps && config.latitude !== undefined && config.longitude !== undefined) {
      return {
        retrievalConfig: {
          latLng: {
            latitude: config.latitude,
            longitude: config.longitude
          }
        }
      };
    }
    return undefined;
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

  // --- STANDARD FILES API ---
  public async uploadFile(blob: Blob, displayName: string) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    return await ai.files.upload({
      file: blob,
      config: { displayName, mimeType: blob.type }
    });
  }

  public async getFile(name: string) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    return await ai.files.get({ name });
  }

  public async listFiles() {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    return await ai.files.list();
  }

  public async deleteFile(name: string) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    return await ai.files.delete({ name });
  }

  // --- CONTEXT CACHING API ---
  public async createCache(config: GenerationConfig, contents: any[]) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const cache = await ai.caches.create({
        model: config.model,
        config: {
          displayName: `NeuralCache_${Date.now()}`,
          systemInstruction: this.augmentSystemInstruction(config),
          contents,
          ttl: `${config.cacheTtlSeconds}s`
        }
      });
      this.activeCacheName = cache.name;
      return cache;
    } catch (e) {
      console.error("Cache creation failed", e);
      throw e;
    }
  }

  public async listCaches() {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    return await ai.caches.list();
  }

  public async deleteCache(name: string) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    if (this.activeCacheName === name) this.activeCacheName = null;
    return await ai.caches.delete({ name });
  }

  public async updateCacheTTL(name: string, ttlSeconds: number) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    return await ai.caches.update({
      name,
      config: { ttl: `${ttlSeconds}s` }
    });
  }

  public setActiveCache(name: string | null) {
    this.activeCacheName = name;
  }

  public clearCache() {
    this.activeCacheName = null;
  }

  // --- RAG / FILE SEARCH STORE API ---
  public async createFileSearchStore(displayName: string) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    return await (ai as any).fileSearchStores.create({ config: { display_name: displayName } });
  }

  public async uploadToFileSearchStore(storeName: string, fileData: string, mimeType: string, displayName: string) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const byteCharacters = atob(fileData);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });

    let operation = await (ai as any).fileSearchStores.uploadToFileSearchStore({
      file: blob,
      fileSearchStoreName: storeName,
      config: { display_name: displayName }
    });

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await (ai as any).operations.get(operation);
    }
    return operation;
  }

  public async createAuthToken(minutes: number = 30) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const now = new Date();
    const expireTime = new Date(now.getTime() + minutes * 60000).toISOString();
    const newSessionExpireTime = new Date(now.getTime() + 1 * 60000).toISOString();

    const token = await (ai as any).authTokens.create({
      config: {
        uses: 1,
        expire_time: expireTime,
        new_session_expire_time: newSessionExpireTime
      }
    });
    return token;
  }

  public initChat(config: GenerationConfig, history: any[] = []) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const isImageGenModel = config.model === ModelId.IMAGE_FLASH || config.model === ModelId.IMAGE_PRO;
    const isSpecialTask = config.specializedTask !== SpecializedTask.NONE;
    const isTTS = config.model === ModelId.TTS_FLASH || config.model === ModelId.TTS_PRO;
    
    const generationConfig: any = {
      systemInstruction: this.augmentSystemInstruction(config),
      temperature: config.temperature,
      thinkingConfig: this.buildThinkingConfig(config),
      mediaResolution: config.mediaResolution
    };

    if (config.maxOutputTokens > 0) {
      generationConfig.maxOutputTokens = config.maxOutputTokens;
    }

    if (isImageGenModel) {
      generationConfig.responseModalities = ['TEXT', 'IMAGE'];
      generationConfig.imageConfig = { aspectRatio: config.aspectRatio };
    }

    if (isTTS) {
      generationConfig.responseModalities = [Modality.AUDIO];
      generationConfig.speechConfig = config.multiSpeaker ? {
        multiSpeakerVoiceConfig: {
          speakerVoiceConfigs: config.speakers.map(s => ({
            speaker: s.name,
            voiceConfig: { prebuiltVoiceConfig: { voiceName: s.voice } }
          }))
        }
      } : {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: config.voiceName } }
      };
    }

    if (isSpecialTask && !(config.useGoogleMaps && config.model.startsWith('gemini-2.5'))) {
      generationConfig.responseMimeType = "application/json";
      if (config.specializedTask === SpecializedTask.STRUCTURED) {
        const schema = this.parseSchema(config.customSchema);
        if (schema) generationConfig.responseSchema = schema;
      }
    }

    if (this.activeCacheName) {
      generationConfig.cachedContent = this.activeCacheName;
    }

    this.chat = ai.chats.create({
      model: config.model,
      history,
      config: {
        ...generationConfig,
        tools: this.getTools(config),
        toolConfig: this.getToolConfig(config)
      }
    });
  }

  public connectLive(callbacks: {
    onopen: () => void;
    onmessage: (message: any) => void;
    onerror: (e: any) => void;
    onclose: (e: any) => void;
  }, systemInstruction: string, liveConfig: { 
    transcription?: boolean, 
    thinkingBudget?: number,
    includeThoughts?: boolean,
    useGoogleSearch?: boolean,
    activeTools?: string[],
    resumptionHandle?: string,
    authToken?: string
  } = {}) {
    const apiKey = liveConfig.authToken || process.env.API_KEY;
    const ai = new GoogleGenAI({ apiKey });
    
    const tools: any[] = [];
    if (liveConfig.useGoogleSearch) {
      tools.push({ googleSearch: {} });
    }
    if (liveConfig.activeTools && liveConfig.activeTools.length > 0) {
      const functionDeclarations = liveConfig.activeTools.map(name => {
        const tool = TOOL_LIBRARY[name];
        return {
          name: tool.name,
          description: tool.description,
          parameters: this.parseSchema(JSON.stringify(tool.parameters)),
          behavior: "NON_BLOCKING"
        };
      });
      tools.push({ functionDeclarations });
    }

    return ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      callbacks,
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction,
        tools: tools.length > 0 ? tools : undefined,
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
        },
        inputAudioTranscription: liveConfig.transcription ? {} : undefined,
        outputAudioTranscription: liveConfig.transcription ? {} : undefined,
        thinkingConfig: liveConfig.thinkingBudget !== undefined ? {
          thinkingBudget: liveConfig.thinkingBudget,
          includeThoughts: liveConfig.includeThoughts ?? false
        } : undefined,
        contextWindowCompression: {
          slidingWindow: {} 
        },
        sessionResumption: liveConfig.resumptionHandle ? {
          handle: liveConfig.resumptionHandle
        } : undefined
      }
    });
  }

  // Batch API Methods
  public async createBatchJob(model: string, src: any, displayName: string) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    return await (ai as any).batches.create({
      model,
      src,
      config: { display_name: displayName }
    });
  }

  public async getBatchJob(name: string): Promise<BatchJob> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    return await (ai as any).batches.get({ name });
  }

  public async cancelBatchJob(name: string) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    return await (ai as any).batches.cancel({ name });
  }

  public async deleteBatchJob(name: string) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    return await (ai as any).batches.delete({ name });
  }

  public async downloadBatchResultFile(fileName: string) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const content = await (ai as any).files.download({ name: fileName });
    return new TextDecoder().decode(content);
  }

  public async *sendMessageStream(parts: any[]) {
    if (!this.chat) throw new Error("Chat session not active.");
    const stream = await this.chat.sendMessageStream({ message: parts });
    for await (const chunk of stream) {
      yield chunk;
    }
  }

  public async *generateContentStream(contents: any[], config: GenerationConfig) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const generationConfig: any = {
      systemInstruction: this.augmentSystemInstruction(config),
      temperature: config.temperature,
      thinkingConfig: this.buildThinkingConfig(config),
      tools: this.getTools(config),
      toolConfig: this.getToolConfig(config),
      mediaResolution: config.mediaResolution
    };

    if (config.maxOutputTokens > 0) {
      generationConfig.maxOutputTokens = config.maxOutputTokens;
    }

    if (this.activeCacheName) {
      generationConfig.cachedContent = this.activeCacheName;
    }

    const stream = await ai.models.generateContentStream({
      model: config.model,
      contents,
      config: generationConfig,
    });

    for await (const chunk of stream) {
      yield chunk;
    }
  }

  public async generateContent(contents: any[], config: GenerationConfig) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const isImageGenModel = config.model === ModelId.IMAGE_FLASH || config.model === ModelId.IMAGE_PRO;
    const isSpecialTask = config.specializedTask !== SpecializedTask.NONE;
    const isTTS = config.model === ModelId.TTS_FLASH || config.model === ModelId.TTS_PRO;
    
    const generationConfig: any = {
      systemInstruction: this.augmentSystemInstruction(config),
      temperature: config.temperature,
      thinkingConfig: this.buildThinkingConfig(config),
      tools: this.getTools(config),
      toolConfig: this.getToolConfig(config),
      mediaResolution: config.mediaResolution
    };

    if (config.maxOutputTokens > 0) {
      generationConfig.maxOutputTokens = config.maxOutputTokens;
    }

    if (isImageGenModel) {
      generationConfig.responseModalities = ['TEXT', 'IMAGE'];
      generationConfig.imageConfig = { aspectRatio: config.aspectRatio };
    }

    if (isTTS) {
      generationConfig.responseModalities = [Modality.AUDIO];
      generationConfig.speechConfig = config.multiSpeaker ? {
        multiSpeakerVoiceConfig: {
          speakerVoiceConfigs: config.speakers.map(s => ({
            speaker: s.name,
            voiceConfig: { prebuiltVoiceConfig: { voiceName: s.voice } }
          }))
        }
      } : {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: config.voiceName } }
      };
    }

    if (isSpecialTask && !(config.useGoogleMaps && config.model.startsWith('gemini-2.5'))) {
      generationConfig.responseMimeType = "application/json";
      if (config.specializedTask === SpecializedTask.STRUCTURED) {
        const schema = this.parseSchema(config.customSchema);
        if (schema) generationConfig.responseSchema = schema;
      }
    }

    if (this.activeCacheName) {
      generationConfig.cachedContent = this.activeCacheName;
    }

    const response = await ai.models.generateContent({
      model: config.model,
      contents,
      config: generationConfig,
    });

    return response;
  }

  public async *startResearch(input: any[], config: GenerationConfig) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const stream = await (ai as any).interactions.create({
      input,
      agent: DEEP_RESEARCH_AGENT,
      background: true,
      stream: true,
      agent_config: {
        type: "deep-research",
        thinking_summaries: "auto"
      }
    });

    for await (const chunk of stream) {
      yield chunk;
    }
  }
}

export const gemini = new GeminiService();
