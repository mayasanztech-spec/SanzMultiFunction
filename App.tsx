
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { gemini } from './services/geminiService';
import { Message, Role, GenerationConfig, ModelId, MessagePart, SpecializedTask, SCHEMA_PRESETS, SourceFile, UsageMetadata, MediaResolution, MODEL_LIMITS } from './types';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import ConfigPanel from './components/ConfigPanel';

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [library, setLibrary] = useState<SourceFile[]>([]);

  const [config, setConfig] = useState<GenerationConfig>({
    model: ModelId.FLASH,
    systemInstruction: "You are a helpful AI assistant. Answer the user based on provided context.",
    temperature: 1.0,
    thinkingLevel: 'high',
    thinkingBudget: -1,
    includeThoughts: true,
    maxOutputTokens: 2048,
    aspectRatio: "1:1",
    mediaResolution: MediaResolution.UNSPECIFIED,
    useGoogleSearch: false,
    useCodeExecution: false,
    specializedTask: SpecializedTask.NONE,
    customSchema: SCHEMA_PRESETS.RECIPE,
    activeTools: [],
    useStrictGrounding: false,
    useAutoPlanning: false,
    useSelfCritique: false,
    useVisualThinking: false
  });

  useEffect(() => {
    gemini.initChat(config);
  }, [config]);

  const currentCapacity = useMemo(() => {
    const limit = MODEL_LIMITS[config.model]?.input || 1048576;
    const lastMsgWithUsage = [...messages].reverse().find(m => m.usage);
    const used = lastMsgWithUsage?.usage?.totalTokenCount || 0;
    const percentage = Math.min(100, (used / limit) * 100);
    return { used, limit, percentage };
  }, [messages, config.model]);

  const handleSendMessage = useCallback(async (text: string, media: { data: string; mimeType: string }[]) => {
    const userParts: MessagePart[] = [];
    userParts.push({ text });
    media.forEach(m => userParts.push({ inlineData: { data: m.data, mimeType: m.mimeType } }));

    if (library.length > 0 && messages.length === 0) {
      library.forEach(file => {
        userParts.push({ inlineData: { data: file.data, mimeType: file.mimeType } });
      });
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: Role.USER,
      parts: userParts,
      timestamp: Date.now(),
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    await processModelTurn(newHistory, config);
  }, [config, messages, library]);

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
      const chatHistory = history.slice(0, -1).map((msg) => ({
        role: msg.role === Role.USER ? 'user' : 'model',
        parts: msg.parts.map(p => {
          const part: any = { text: p.text };
          if (p.inlineData) part.inlineData = p.inlineData;
          return part;
        })
      }));

      gemini.initChat(currentConfig, chatHistory);

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
              inlineData: p.inlineData
            };

            if (p.text && candidate.groundingMetadata) part.groundingMetadata = candidate.groundingMetadata;
            if (p.executableCode) part.executableCode = p.executableCode.code;
            if (p.codeExecutionResult) part.executionOutput = p.codeExecutionResult.output;

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

    } catch (error: any) {
      setMessages(prev => prev.map(msg => msg.id === assistantMessageId ? { ...msg, parts: [{ text: `Error: ${error.message}` }], isStreaming: false } : msg));
    }
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
      />
      <main className="flex-1 flex flex-col relative min-w-0">
        <header className="h-14 border-b border-slate-800 flex items-center justify-between px-4 bg-slate-900/50 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
             <button onClick={() => setIsSidebarOpen(true)} className={`p-2 hover:bg-slate-800 rounded-lg transition-all ${isSidebarOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
             </button>
            <h1 className="font-semibold text-lg flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span className="hidden sm:inline">Gemini Flash Architect</span>
            </h1>
          </div>
          
          <div className="flex-1 max-w-md px-8 hidden lg:block">
             <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Context Usage</span>
                <span className="text-[9px] font-mono text-slate-400">{(currentCapacity.used / 1000).toFixed(1)}k / {(currentCapacity.limit / 1000).toFixed(1)}k TK</span>
             </div>
             <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${currentCapacity.percentage}%` }} />
             </div>
          </div>

          <button onClick={() => setIsConfigOpen(true)} className="p-2 hover:bg-slate-800 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1  1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 10-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
          </button>
        </header>
        
        <ChatInterface 
          messages={messages} 
          onSendMessage={handleSendMessage} 
          currentConfig={config}
        />
      </main>
      <ConfigPanel isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} config={config} onUpdateConfig={setConfig} />
    </div>
  );
};

export default App;
