
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { gemini } from './services/geminiService';
import { Message, Role, GenerationConfig, ModelId, MessagePart, SpecializedTask, SCHEMA_PRESETS, SourceFile, UsageMetadata, MediaResolution, MODEL_LIMITS } from './types';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import ConfigPanel from './components/ConfigPanel';
import LiveInterface from './components/LiveInterface';
import BatchInterface from './components/BatchInterface';

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [library, setLibrary] = useState<SourceFile[]>([]);
  const [isCaching, setIsCaching] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [activeCacheName, setActiveCacheName] = useState<string | null>(null);

  // Mock "Browser" state for Computer Use simulation
  const [browserState, setBrowserState] = useState({
    url: "https://www.google.com",
    lastAction: "none",
    logs: [] as string[]
  });

  const [config, setConfig] = useState<GenerationConfig>({
    model: ModelId.FLASH,
    systemInstruction: "You are a helpful AI assistant specialized in Long Context architecture, Browser Control, and Retrieval-Augmented Generation. Answer based on the provided library files.",
    temperature: 1.0,
    thinkingLevel: 'high',
    thinkingBudget: -1,
    includeThoughts: true,
    maxOutputTokens: 2048,
    aspectRatio: "1:1",
    imageSize: "1K",
    mediaResolution: MediaResolution.UNSPECIFIED,
    useGoogleSearch: false,
    useCodeExecution: false,
    useGoogleMaps: false,
    useUrlContext: false,
    useComputerUse: false,
    useFileSearch: false,
    fileSearchStoreName: null,
    specializedTask: SpecializedTask.NONE,
    customSchema: SCHEMA_PRESETS.RECIPE,
    activeTools: [],
    voiceName: "Zephyr",
    multiSpeaker: false,
    speakers: [],
    cacheTtlSeconds: 3600,
    useCaching: false,
    useStrictGrounding: false,
    useDateAwareness: true,
    useKnowledgeCutoff: true,
    useAutoPlanning: false,
    useSelfCritique: false,
    useVisualThinking: false
  });

  useEffect(() => {
    if (!isLiveMode && !isBatchMode) {
      // Re-initialize SDK Chat when config or cache changes. 
      // We'll hydrate with existing history later during the first message turn to ensure accuracy.
      gemini.initChat(config);
    }
  }, [config, activeCacheName, isLiveMode, isBatchMode]);

  const handleAuthError = async (error: any) => {
    const errorStr = typeof error === 'string' ? error : JSON.stringify(error);
    const errorMsg = error?.message || "";
    
    const isPermissionError = 
      errorStr.includes('403') || 
      errorStr.includes('PERMISSION_DENIED') || 
      errorStr.includes('permission') || 
      errorStr.includes('Requested entity was not found') ||
      errorMsg.includes('403') || 
      errorMsg.includes('permission');

    if (isPermissionError) {
      if (typeof (window as any).aistudio?.openSelectKey === 'function') {
        await (window as any).aistudio.openSelectKey();
      }
    }
    return isPermissionError;
  };

  const currentCapacity = useMemo(() => {
    const limit = MODEL_LIMITS[config.model]?.input || 1048576;
    const lastMsgWithUsage = [...messages].reverse().find(m => m.usage);
    const used = lastMsgWithUsage?.usage?.totalTokenCount || 0;
    const percentage = Math.min(100, (used / limit) * 100);
    return { used, limit, percentage };
  }, [messages, config.model]);

  const getCurrentLocation = (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation not supported"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => reject(err)
      );
    });
  };

  const handleCacheContext = async () => {
    if (library.length === 0) return;
    setIsCaching(true);
    try {
      const contents = library.map(file => ({
        role: 'user',
        parts: [{ inlineData: { data: file.data, mimeType: file.mimeType } }]
      }));
      const cache = await gemini.createCache(config, contents);
      setActiveCacheName(cache.name);
    } catch (e: any) {
      console.error(e);
      await handleAuthError(e);
    } finally {
      setIsCaching(false);
    }
  };

  const handleIndexLibrary = async () => {
    if (library.length === 0) return;
    setIsIndexing(true);
    try {
      const store = await gemini.createFileSearchStore(`ArchitectStore_${Date.now()}`);
      
      for (const file of library) {
        await gemini.uploadToFileSearchStore(store.name, file.data, file.mimeType, file.name);
        setLibrary(prev => prev.map(f => f.id === file.id ? { ...f, isIndexed: true } : f));
      }

      setConfig(prev => ({ 
        ...prev, 
        useFileSearch: true, 
        fileSearchStoreName: store.name 
      }));
    } catch (e: any) {
      console.error("Indexing failed", e);
      await handleAuthError(e);
    } finally {
      setIsIndexing(false);
    }
  };

  const clearCache = async (name: string) => {
    try {
      await gemini.deleteCache(name);
      if (activeCacheName === name) setActiveCacheName(null);
    } catch (e) {
      await handleAuthError(e);
    }
  };

  const handleSendMessage = useCallback(async (text: string, media: { data: string; mimeType: string }[]) => {
    if (typeof (window as any).aistudio?.hasSelectedApiKey === 'function') {
      const hasKey = await (window as any).aistudio.hasSelectedApiKey();
      if (!hasKey) await (window as any).aistudio.openSelectKey();
    }

    let updatedConfig = { ...config };
    if (config.useGoogleMaps && config.model.startsWith('gemini-2.5')) {
      try {
        const { lat, lng } = await getCurrentLocation();
        updatedConfig = { ...config, latitude: lat, longitude: lng };
        setConfig(updatedConfig);
      } catch (e) {
        console.warn("Failed to get geolocation, proceeding without precise context", e);
      }
    }

    const userParts: MessagePart[] = [];
    userParts.push({ text });
    media.forEach(m => userParts.push({ inlineData: { data: m.data, mimeType: m.mimeType } }));

    // For first-turn interactions where file context is passed directly (not via RAG/Cache)
    if (!config.useFileSearch && !activeCacheName && library.length > 0 && messages.length === 0) {
      library.forEach(file => {
        userParts.push({ inlineData: { data: file.data, mimeType: file.mimeType } });
      });
    }

    if (config.model === ModelId.COMPUTER_USE && config.useComputerUse) {
      const canvas = document.createElement('canvas');
      canvas.width = 1440;
      canvas.height = 900;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#f1f5f9';
        ctx.fillRect(0, 0, 1440, 900);
        ctx.fillStyle = '#0f172a';
        ctx.font = '30px Inter';
        ctx.fillText(`Simulated Browser: ${browserState.url}`, 50, 50);
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(100, 100, 200, 50);
        ctx.fillStyle = 'white';
        ctx.fillText("Search", 120, 135);
      }
      const dataUrl = canvas.toDataURL('image/png').split(',')[1];
      userParts.push({ inlineData: { data: dataUrl, mimeType: 'image/png' } });
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: Role.USER,
      parts: userParts,
      timestamp: Date.now(),
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    
    if (config.specializedTask === SpecializedTask.RESEARCH) {
      await processResearchTurn(newHistory);
    } else {
      await processModelTurn(newHistory, updatedConfig);
    }
  }, [config, messages, library, activeCacheName, browserState]);

  const processResearchTurn = async (history: Message[]) => {
    const assistantMessageId = (Date.now() + 1).toString();
    const initialAssistantMsg: Message = {
      id: assistantMessageId,
      role: Role.MODEL,
      parts: [],
      timestamp: Date.now(),
      isStreaming: true,
    };
    setMessages(prev => [...prev, initialAssistantMsg]);

    try {
      const lastMsg = history[history.length - 1];
      const researchInput = lastMsg.parts.map(p => {
        if (p.text) return { type: "text", text: p.text };
        if (p.inlineData) return { type: "image", data: p.inlineData.data, mimeType: p.inlineData.mimeType };
        return null;
      }).filter(Boolean);

      const researchStream = gemini.startResearch(researchInput as any, config);
      let accumulatedText = "";

      for await (const chunk of researchStream) {
        if (chunk.event_type === "interaction.start") {
          const interactionId = chunk.interaction.id;
          setMessages(prev => prev.map(msg => msg.id === assistantMessageId ? { ...msg, interactionId } : msg));
        }

        if (chunk.event_type === "content.delta") {
          if (chunk.delta.type === "text") {
            accumulatedText += chunk.delta.text;
            setMessages(prev => prev.map(msg => {
              if (msg.id === assistantMessageId) {
                const parts = [...msg.parts];
                const textPartIndex = parts.findIndex(p => !p.researchThought && p.text !== undefined);
                if (textPartIndex > -1) {
                  parts[textPartIndex].text = accumulatedText;
                } else {
                  parts.push({ text: accumulatedText });
                }
                return { ...msg, parts };
              }
              return msg;
            }));
          } else if (chunk.delta.type === "thought_summary") {
            const thought = chunk.delta.content.text;
            setMessages(prev => prev.map(msg => {
              if (msg.id === assistantMessageId) {
                const parts = [...msg.parts];
                parts.push({ researchThought: thought });
                return { ...msg, parts };
              }
              return msg;
            }));
          }
        }

        if (chunk.event_type === "interaction.complete") {
          setMessages(prev => prev.map(msg => msg.id === assistantMessageId ? { ...msg, isStreaming: false } : msg));
        }
      }
    } catch (e: any) {
      const isAuth = await handleAuthError(e);
      const errorMsg = isAuth 
        ? "Access Denied. Advanced Gemini models require a billing-enabled API Key. Please select your paid key in the memory unit sidebar."
        : `Research loop failed: ${e.message || 'Connection Error'}`;
      setMessages(prev => prev.map(msg => msg.id === assistantMessageId ? { ...msg, parts: [{ text: errorMsg }], isStreaming: false } : msg));
    }
  };

  const processModelTurn = async (history: Message[], currentConfig: GenerationConfig) => {
    const assistantMessageId = (Date.now() + 1).toString();
    const initialAssistantMsg: Message = {
      id: assistantMessageId,
      role: Role.MODEL,
      parts: [],
      timestamp: Date.now(),
      isStreaming: true,
    };
    setMessages(prev => [...prev, initialAssistantMsg]);

    try {
      // Map React history state to SDK Content objects for Chat hydration
      const chatHistory = history.slice(0, -1).map((msg) => ({
        role: msg.role === Role.USER || msg.role === Role.TOOL ? 'user' : 'model',
        parts: msg.parts.map(p => {
          const part: any = { text: p.text };
          if (p.inlineData) part.inlineData = p.inlineData;
          if (p.functionCall) part.functionCall = p.functionCall;
          if (p.functionResponse) part.functionResponse = p.functionResponse;
          return part;
        })
      }));

      // Re-hydrate or refresh the stateful Chat SDK session
      gemini.initChat(currentConfig, chatHistory);

      // Get the parts from the LATEST user message to send as the next turn
      const lastUserMsg = history[history.length - 1];
      const nextParts = lastUserMsg.parts.map(p => {
        const part: any = { text: p.text };
        if (p.inlineData) part.inlineData = p.inlineData;
        return part;
      });

      const stream = gemini.sendMessageStream(nextParts);
      
      let combinedParts: MessagePart[] = [];
      let finalUsage: UsageMetadata | undefined;

      for await (const chunk of stream) {
        if (chunk.usageMetadata) {
          finalUsage = chunk.usageMetadata as UsageMetadata;
        }

        const candidates = chunk.candidates;
        if (!candidates || candidates.length === 0) continue;

        const candidate = candidates[0];
        const newParts = candidate.content?.parts;
        if (!newParts) continue;

        newParts.forEach((p: any) => {
          const isThought = !!p.thought;
          const isText = !!p.text && !isThought;

          const existingPartIndex = combinedParts.findIndex(cp => 
            (isThought && cp.thought) || (isText && cp.text !== undefined && !cp.thought)
          );

          if (existingPartIndex > -1 && (isThought || isText)) {
            if (isThought) combinedParts[existingPartIndex].text = (combinedParts[existingPartIndex].text || "") + p.text;
            if (isText) combinedParts[existingPartIndex].text = (combinedParts[existingPartIndex].text || "") + p.text;
          } else {
            const part: MessagePart = {
              text: p.text,
              thought: !!p.thought,
              thoughtSignature: p.thoughtSignature,
              inlineData: p.inlineData,
              functionCall: p.functionCall,
              functionResponse: p.functionResponse,
            };

            if (p.text && candidate.groundingMetadata) part.groundingMetadata = candidate.groundingMetadata;
            if (p.text && candidate.urlContextMetadata) part.urlContextMetadata = candidate.urlContextMetadata;
            if (p.executableCode) part.executableCode = p.executableCode.code;
            if (p.codeExecutionResult) part.executionOutput = p.codeExecutionResult.output;
            if (p.functionCall?.args?.safety_decision) part.safetyDecision = p.functionCall.args.safety_decision;

            combinedParts.push(part);
          }
        });

        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessageId 
            ? { ...msg, parts: [...combinedParts], usage: finalUsage } 
            : msg
        ));
      }

      setMessages(prev => prev.map(msg => msg.id === assistantMessageId ? { ...msg, isStreaming: false } : msg));

      // Post-process tool calls (e.g., Computer Use actions)
      const lastMsgParts = combinedParts;
      const computerActions = lastMsgParts.filter(p => p.functionCall && ['open_web_browser', 'navigate', 'click_at', 'type_text_at', 'scroll_document'].includes(p.functionCall.name));
      if (computerActions.length > 0) {
        const anyRequireConfirmation = computerActions.some(p => p.functionCall?.args?.safety_decision?.decision === 'require_confirmation');
        if (!anyRequireConfirmation) {
          setTimeout(() => {
             handleExecuteComputerActions(computerActions.map(p => p.functionCall!), assistantMessageId);
          }, 1500);
        }
      }

    } catch (error: any) {
      const isAuth = await handleAuthError(error);
      const errorMsg = isAuth 
        ? "Protocol Error 403: Permission Denied. Chat session failed to sync. Ensure you have a paid project API key selected."
        : `Chat turn failed: ${error.message || 'Session Interrupted'}.`;
      setMessages(prev => prev.map(msg => msg.id === assistantMessageId ? { ...msg, parts: [{ text: errorMsg }], isStreaming: false } : msg));
    }
  };

  const handleExecuteComputerActions = async (calls: any[], messageId: string) => {
    const updatedLogs = [...browserState.logs];
    let newUrl = browserState.url;

    const toolResponses = calls.map(call => {
      let result = { status: "success" };
      if (call.name === 'navigate') {
        newUrl = call.args.url;
        updatedLogs.push(`Navigated to: ${newUrl}`);
      } else if (call.name === 'click_at') {
        updatedLogs.push(`Clicked at X:${call.args.x}, Y:${call.args.y}`);
      } else if (call.name === 'type_text_at') {
        updatedLogs.push(`Typed "${call.args.text}" at X:${call.args.x}, Y:${call.args.y}`);
      }

      return {
        name: call.name,
        response: { url: newUrl, ...result }
      };
    });

    setBrowserState(prev => ({ ...prev, url: newUrl, logs: updatedLogs }));

    const canvas = document.createElement('canvas');
    canvas.width = 1440;
    canvas.height = 900;
    const ctx = canvas.getContext('2d');
    const lastCall = calls[calls.length - 1];
    if (ctx) {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, 1440, 900);
      ctx.fillStyle = '#0f172a';
      ctx.font = '24px JetBrains Mono';
      ctx.fillText(`Active Environment: ${newUrl}`, 40, 60);
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(lastCall?.args?.x || 100, lastCall?.args?.y || 100, 10, 10);
    }
    const screenshot = canvas.toDataURL('image/png').split(',')[1];

    const toolMessage: Message = {
      id: Date.now().toString(),
      role: Role.TOOL,
      parts: toolResponses.map(tr => ({
        functionResponse: tr,
        inlineData: { data: screenshot, mimeType: 'image/png' }
      })),
      timestamp: Date.now()
    };

    const nextHistory = [...messages, toolMessage];
    setMessages(nextHistory);
    processModelTurn(nextHistory, config);
  };

  const handleFileToLibrary = (file: SourceFile) => setLibrary(prev => [...prev, file]);
  const handleRemoveFromLibrary = (id: string) => setLibrary(prev => prev.filter(f => f.id !== id));

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden text-slate-100 font-sans">
      <Sidebar 
        isOpen={isSidebarOpen} 
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)} 
        onClearChat={() => setMessages([])} 
        onOpenConfig={() => setIsConfigOpen(true)}
        library={library}
        onAddToLibrary={handleFileToLibrary}
        onRemoveFromLibrary={handleRemoveFromLibrary}
        activeCache={activeCacheName}
        onCacheContext={handleCacheContext}
        onClearCache={clearCache}
        isCaching={isCaching}
        onIndexLibrary={handleIndexLibrary}
        isIndexing={isIndexing}
        isIndexed={!!config.fileSearchStoreName}
        isLiveMode={isLiveMode}
        onToggleLive={() => { setIsLiveMode(!isLiveMode); setIsBatchMode(false); }}
        isBatchMode={isBatchMode}
        onToggleBatch={() => { setIsBatchMode(!isBatchMode); setIsLiveMode(false); }}
      />
      <main className="flex-1 flex flex-col relative min-w-0">
        <header className="h-14 border-b border-slate-800 flex items-center justify-between px-4 bg-slate-900/50 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
             <button onClick={() => setIsSidebarOpen(true)} className={`p-2 hover:bg-slate-800 rounded-lg transition-all ${isSidebarOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
             </button>
            <h1 className="font-semibold text-lg flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isLiveMode ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.6)] animate-ping' : (isBatchMode ? 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]' : (config.useFileSearch ? 'bg-amber-400' : (activeCacheName ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]' : 'bg-blue-500')))} `} />
              <span className="hidden sm:inline">{isLiveMode ? 'Live Architect Vision' : (isBatchMode ? 'High-Volume Batch Pipeline' : (config.useFileSearch ? 'Semantic RAG Agent' : 'Long-Context Architect'))}</span>
            </h1>
          </div>
          
          <div className="flex-1 max-w-md px-8 hidden lg:block">
             <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Active Neural Context</span>
                <span className="text-[9px] font-mono text-slate-400">{(currentCapacity.used / 1000).toFixed(1)}k / {(currentCapacity.limit / 1000).toFixed(1)}k TK</span>
             </div>
             <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
                <div 
                  className={`h-full transition-all duration-1000 ${currentCapacity.percentage > 90 ? 'bg-red-500' : (currentCapacity.percentage > 70 ? 'bg-amber-500' : 'bg-blue-500')}`}
                  style={{ width: `${currentCapacity.percentage}%` }}
                />
             </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-3 border-r border-slate-800 pr-4">
              <div className="text-right">
                <div className="text-[10px] text-slate-500 font-bold uppercase">System State</div>
                <div className="text-xs font-mono text-blue-400 uppercase">
                  {isLiveMode ? 'LIVE_NEURAL_LINK' : (isBatchMode ? 'BATCH_EFFICIENCY' : (config.useFileSearch ? 'FILE_SEARCH_ON' : (activeCacheName ? 'CACHE_COLD_READ' : 'STANDARD')))}
                </div>
              </div>
            </div>
            <button onClick={() => setIsConfigOpen(true)} className="p-2 hover:bg-slate-800 rounded-lg"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1  1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1-2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg></button>
          </div>
        </header>
        
        {isLiveMode ? (
          <LiveInterface systemInstruction={config.systemInstruction} />
        ) : isBatchMode ? (
          <BatchInterface />
        ) : (
          <ChatInterface 
            messages={messages} 
            onSendMessage={handleSendMessage} 
            onExecuteTool={(id, result) => handleExecuteComputerActions([{ name: id, args: result }], messages[messages.length-1].id)}
            currentConfig={config}
          />
        )}
      </main>
      <ConfigPanel isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} config={config} onUpdateConfig={setConfig} />
    </div>
  );
};

export default App;
