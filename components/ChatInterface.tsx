
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Message, Role, MessagePart, GroundingMetadata, GroundingChunk, UrlContextMetadata, UsageMetadata, GenerationConfig } from '../types';
import { gemini } from '../services/geminiService';

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (text: string, media: { data: string; mimeType: string }[]) => void;
  onExecuteTool?: (callId: string, result: any) => void;
  currentConfig: GenerationConfig;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, onSendMessage, onExecuteTool, currentConfig }) => {
  const [input, setInput] = useState('');
  const [media, setMedia] = useState<{ data: string; mimeType: string; url: string }[]>([]);
  const [tokenStats, setTokenStats] = useState<{ current: number, total: number }>({ current: 0, total: 0 });
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const updateTokenCount = useCallback(async () => {
    if (!input.trim() && media.length === 0) {
      setTokenStats({ current: 0, total: 0 });
      return;
    }

    try {
      const contents = [];
      contents.push({ role: 'user', parts: [{ text: input || ' ' }] });
      media.forEach(m => contents[0].parts.push({ inlineData: { data: m.data, mimeType: m.mimeType } }));

      // Current message tokens
      const currentTokens = await gemini.countTokens(currentConfig.model, contents, currentConfig);
      
      // History tokens
      let historyTokens = 0;
      if (messages.length > 0) {
        const historyForCount = messages.map(m => ({
          role: m.role === Role.USER ? 'user' : 'model',
          parts: m.parts
        }));
        historyTokens = await gemini.countTokens(currentConfig.model, historyForCount, currentConfig);
      }

      setTokenStats({ current: currentTokens, total: currentTokens + historyTokens });
    } catch (e) {
      console.warn("Token counting failed", e);
    }
  }, [input, media, currentConfig, messages]);

  useEffect(() => {
    const timer = setTimeout(() => {
      updateTokenCount();
    }, 1000);
    return () => clearTimeout(timer);
  }, [input, media, updateTokenCount]);

  const insertDelimiter = (tag: string) => {
    const start = textareaRef.current?.selectionStart || 0;
    const end = textareaRef.current?.selectionEnd || 0;
    const text = `<${tag}>\n\n</${tag}>`;
    const newInput = input.substring(0, start) + text + input.substring(end);
    setInput(newInput);
    
    // Position cursor inside the tag
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + tag.length + 3;
        textareaRef.current.focus();
      }
    }, 0);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() && media.length === 0) return;
    onSendMessage(input, media.map(m => ({ data: m.data, mimeType: m.mimeType })));
    setInput('');
    setMedia([]);
    setTokenStats({ current: 0, total: 0 });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        setMedia(prev => [...prev, {
          data: base64,
          mimeType: file.type,
          url: URL.createObjectURL(file)
        }]);
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Fixed Error: Cannot find name 'useMemo'.
  const activeTools = useMemo(() => {
    const tools = [];
    if (currentConfig.useGoogleSearch) tools.push('Web Search');
    if (currentConfig.useCodeExecution) tools.push('Python Sandbox');
    if (currentConfig.useGoogleMaps) tools.push('Google Maps');
    if (currentConfig.useFileSearch) tools.push('RAG Engine');
    if (currentConfig.useComputerUse) tools.push('Browser Control');
    return tools;
  }, [currentConfig]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950">
      <div className="h-8 bg-slate-900/30 flex items-center px-4 gap-4 border-b border-slate-900/50">
        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Active Tool Matrix:</span>
        <div className="flex gap-2">
          {activeTools.length > 0 ? activeTools.map(t => (
            <div key={t} className="flex items-center gap-1">
               <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" />
               <span className="text-[9px] font-mono text-blue-400 font-bold uppercase">{t.replace(' ', '_')}</span>
            </div>
          )) : (
            <span className="text-[9px] font-mono text-slate-700 italic">No tools deployed in current session</span>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scroll-smooth">
        {messages.length === 0 ? (
          <EmptyState setInput={setInput} />
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === Role.USER ? 'justify-end' : (msg.role === Role.TOOL ? 'justify-end' : 'justify-start')} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
              <div className={`max-w-[85%] md:max-w-[80%] rounded-2xl p-4 ${msg.role === Role.USER || msg.role === Role.TOOL ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-900 border border-slate-800 text-slate-100 shadow-xl'}`}>
                <div className="flex flex-col gap-3">
                  {msg.parts.map((part, i) => (
                    <MessagePartRenderer 
                      key={`${msg.id}-part-${i}`} 
                      part={part} 
                      isLast={i === msg.parts.length - 1} 
                      isStreaming={!!msg.isStreaming} 
                      onExecuteTool={onExecuteTool}
                    />
                  ))}
                </div>
                {msg.interactionId && (
                  <div className="mt-2 flex items-center gap-1.5 text-[9px] font-mono opacity-50 text-blue-300">
                    <span className="w-1 h-1 rounded-full bg-blue-400 animate-ping" />
                    INTERACTION_ID: {msg.interactionId}
                  </div>
                )}
                <div className="flex items-center justify-between mt-3">
                  <div className={`text-[10px] opacity-40 uppercase font-bold tracking-widest ${msg.role === Role.USER || msg.role === Role.TOOL ? 'text-white' : 'text-slate-500'}`}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {msg.usage && (
                    <div className="flex gap-2">
                       {msg.usage.cachedContentTokenCount && msg.usage.cachedContentTokenCount > 0 && (
                         <div className="px-1.5 py-0.5 bg-green-500/10 border border-green-500/20 rounded text-[9px] font-bold text-green-400 uppercase tracking-tighter">
                            Cache Hit: {msg.usage.cachedContentTokenCount}
                         </div>
                       )}
                       <div className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[9px] font-bold text-slate-500 uppercase tracking-tighter">
                          {msg.usage.totalTokenCount} TK
                       </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      
      <div className="p-4 md:px-8 pb-8 bg-slate-950/90 backdrop-blur-xl border-t border-slate-900/50">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex items-center justify-between px-2">
             <div className="flex gap-4">
                <div className="flex items-center gap-1.5">
                   <div className={`w-1 h-1 rounded-full ${tokenStats.current > 0 ? 'bg-blue-400 animate-pulse' : 'bg-slate-700'}`} />
                   <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Payload: <span className="text-blue-400">{tokenStats.current.toLocaleString()}</span> TK</span>
                </div>
                <div className="flex items-center gap-1.5">
                   <div className={`w-1 h-1 rounded-full ${tokenStats.total > 0 ? 'bg-indigo-400' : 'bg-slate-700'}`} />
                   <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Context: <span className="text-indigo-400">{tokenStats.total.toLocaleString()}</span> TK</span>
                </div>
             </div>
             
             <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                <span className="text-[9px] font-bold text-slate-600 uppercase tracking-tighter mr-1 whitespace-nowrap">Delimiters:</span>
                {['context', 'task', 'role', 'constraints', 'examples'].map(tag => (
                   <button 
                    key={tag} 
                    onClick={() => insertDelimiter(tag)}
                    className="px-2 py-0.5 bg-slate-900 border border-slate-800 rounded text-[9px] font-bold text-slate-400 uppercase hover:border-blue-500 transition-colors whitespace-nowrap"
                   >
                     {tag}
                   </button>
                ))}
             </div>
          </div>

          <ChatInput 
            input={input} 
            setInput={setInput} 
            media={media} 
            setMedia={setMedia} 
            fileInputRef={fileInputRef} 
            handleFileChange={handleFileChange} 
            handleSubmit={handleSubmit} 
            textareaRef={textareaRef}
          />
        </div>
      </div>
    </div>
  );
};

const MessagePartRenderer: React.FC<{ part: MessagePart; isLast: boolean; isStreaming: boolean; onExecuteTool?: any }> = ({ part, isLast, isStreaming, onExecuteTool }) => {
  
  const renderTextWithGrounding = (text: string, grounding?: GroundingMetadata) => {
    if (!grounding || !grounding.groundingSupports) return text;
    
    const sortedSupports = [...grounding.groundingSupports].sort((a, b) => a.segment.startIndex - b.segment.startIndex);
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;

    sortedSupports.forEach((support, idx) => {
      if (support.segment.startIndex > lastIndex) {
        elements.push(text.substring(lastIndex, support.segment.startIndex));
      }

      elements.push(
        <span key={`support-${idx}`} className="relative group cursor-help border-b border-dotted border-blue-400/50">
          {text.substring(support.segment.startIndex, support.segment.endIndex)}
          <span className="ml-0.5 text-[10px] font-bold text-blue-400 align-top opacity-70">
            [{support.groundingChunkIndices.map(i => i + 1).join(', ')}]
          </span>
        </span>
      );

      lastIndex = support.segment.endIndex;
    });

    if (lastIndex < text.length) {
      elements.push(text.substring(lastIndex));
    }

    return elements;
  };

  return (
    <div className="relative">
      {part.thought && (
        <div className="bg-slate-800/40 border-l-4 border-slate-600 p-4 rounded-r-2xl my-3 animate-in fade-in zoom-in-95">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Architectural Reasoning</span>
          </div>
          <p className="text-[12px] text-slate-400 font-mono leading-relaxed italic whitespace-pre-wrap">
            {part.text}
          </p>
        </div>
      )}
      
      {part.researchThought && (
        <div className="bg-amber-500/10 border-l-4 border-amber-500/40 p-3 rounded-r-xl my-2 animate-in fade-in slide-in-from-left-1">
          <div className="flex items-center gap-2 mb-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="3"><circle cx="11" cy="11" r="8"></circle><line x1="21" cy1="21" x2="16.65" y2="16.65"></line></svg>
            <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest">Agent Logic Branch</span>
          </div>
          <p className="text-[11px] text-amber-200/70 font-sans leading-tight italic">
            {part.researchThought}
          </p>
        </div>
      )}

      {!part.thought && !part.researchThought && part.text && (
        <div className="prose prose-invert prose-sm md:prose-base max-w-none whitespace-pre-wrap font-sans leading-relaxed">
          {renderTextWithGrounding(part.text, part.groundingMetadata)}
          {isStreaming && isLast && <span className="inline-block w-1 h-4 ml-1 bg-slate-400 animate-pulse align-middle" />}
        </div>
      )}

      {part.safetyDecision && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 my-2 animate-in slide-in-from-top-1">
           <div className="flex items-center gap-2 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
              <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">Safety Intervention Required</span>
           </div>
           <p className="text-xs text-rose-200/80 mb-4">{part.safetyDecision.explanation}</p>
           <div className="flex gap-2">
             <button 
               onClick={() => onExecuteTool?.(part.functionCall?.name || "action", { ...part.functionCall?.args, safety_acknowledgement: true })} 
               className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold rounded-lg transition-all"
             >
               CONFIRM ACTION
             </button>
             <button className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 text-[10px] font-bold rounded-lg transition-all">
               DENY
             </button>
           </div>
        </div>
      )}

      {part.groundingMetadata && (
        <div className="mt-4 pt-4 border-t border-slate-800/50 space-y-3 animate-in fade-in slide-in-from-top-1">
          {part.groundingMetadata.webSearchQueries && part.groundingMetadata.webSearchQueries.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest self-center mr-1">Queries:</span>
              {part.groundingMetadata.webSearchQueries.map((q, idx) => (
                <span key={idx} className="px-2 py-0.5 bg-slate-800 text-[10px] text-slate-400 rounded-md border border-slate-700/50">
                  {q}
                </span>
              ))}
            </div>
          )}
          
          {part.groundingMetadata.groundingChunks && part.groundingMetadata.groundingChunks.length > 0 && (
            <div className="space-y-1.5">
               <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Verifiable Sources</div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                 {part.groundingMetadata.groundingChunks.map((chunk, idx) => {
                   const item = chunk.web || chunk.maps;
                   const isMaps = !!chunk.maps;
                   if (!item) return null;
                   return (
                     <a 
                       key={idx} 
                       href={item.uri} 
                       target="_blank" 
                       rel="noopener noreferrer"
                       className="flex items-center gap-2 p-2 bg-slate-800/50 hover:bg-slate-800 border border-slate-800 rounded-lg group transition-all"
                     >
                       <div className="text-[10px] font-bold text-blue-400 opacity-60 group-hover:opacity-100 min-w-[1.2rem]">{idx + 1}</div>
                       <div className="flex-1 overflow-hidden">
                         <div className="text-[11px] font-bold text-slate-300 truncate">{item.title}</div>
                         <div className="text-[9px] text-slate-500 truncate flex items-center gap-1">
                            {isMaps && <span className="text-[8px] font-bold text-green-500 uppercase">Maps</span>}
                            {new URL(item.uri).hostname}
                         </div>
                       </div>
                       <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-600 group-hover:text-slate-400 transition-colors">
                         <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                         <polyline points="15 3 21 3 21 9"></polyline>
                         <line x1="10" y1="14" x2="21" y2="3"></line>
                       </svg>
                     </a>
                   );
                 })}
               </div>
               {/* Google Maps Text Attribution Guidelines Adherence */}
               {part.groundingMetadata.groundingChunks.some(c => c.maps) && (
                 <div className="pt-2 text-[10px] font-normal text-slate-500" translate="no" style={{ fontFamily: 'Roboto, sans-serif' }}>
                   Source: <span className="font-medium text-slate-400">Google Maps</span>
                 </div>
               )}
            </div>
          )}
          
          {part.groundingMetadata.searchEntryPoint && (
             <div 
               className="text-[10px] opacity-60 hover:opacity-100 transition-opacity"
               dangerouslySetInnerHTML={{ __html: part.groundingMetadata.searchEntryPoint.renderedContent }} 
             />
          )}
        </div>
      )}

      {part.urlContextMetadata && part.urlContextMetadata.urlMetadata.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-800/50 space-y-2 animate-in fade-in slide-in-from-top-1">
           <div className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Retrieved URL Context</div>
           <div className="flex flex-col gap-1.5">
             {part.urlContextMetadata.urlMetadata.map((url, idx) => (
               <div key={idx} className="flex items-center gap-3 p-2 bg-slate-800/30 border border-slate-800/50 rounded-lg text-[10px]">
                 <div className={`w-1.5 h-1.5 rounded-full ${url.urlRetrievalStatus === 'URL_RETRIEVAL_STATUS_SUCCESS' ? 'bg-green-500' : 'bg-red-500'}`} />
                 <div className="flex-1 truncate text-slate-400 font-mono">{url.retrievedUrl}</div>
                 <div className="text-[8px] font-bold text-slate-600 uppercase whitespace-nowrap">
                   {url.urlRetrievalStatus.replace('URL_RETRIEVAL_STATUS_', '')}
                 </div>
               </div>
             ))}
           </div>
        </div>
      )}

      {part.executableCode && (
        <div className="my-3 bg-[#1e1e1e] border border-slate-700 rounded-xl overflow-hidden shadow-2xl animate-in slide-in-from-right-2">
          <div className="bg-slate-800 px-4 py-1.5 border-b border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2">architect_sandbox.py</span>
            </div>
            <div className="text-[9px] font-mono text-slate-500">PYTHON 3.10</div>
          </div>
          <pre className="p-4 text-xs font-mono text-blue-300 overflow-x-auto selection:bg-blue-500/30">
            <code>{part.executableCode}</code>
          </pre>
        </div>
      )}

      {part.executionOutput && (
        <div className="my-3 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-inner animate-in fade-in scale-95 duration-500">
           <div className="bg-slate-950 px-4 py-1.5 border-b border-slate-800 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="3"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
              <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">Runtime Console</span>
           </div>
           <pre className="p-4 text-xs font-mono text-cyan-200/80 bg-black/20 overflow-x-auto whitespace-pre-wrap selection:bg-cyan-500/20">
              {part.executionOutput}
           </pre>
        </div>
      )}

      {part.inlineData && (
        <div className="relative group mt-4 animate-in zoom-in-95 duration-300">
           <img 
            src={`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`} 
            className="rounded-2xl max-h-[500px] w-full object-contain border border-white/10 shadow-2xl bg-slate-800/20" 
            alt="Architectural Output" 
           />
           <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-[9px] font-bold text-white uppercase tracking-tighter">Environment Snapshot</span>
           </div>
        </div>
      )}

      {part.functionCall && (
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 my-2 space-y-3 shadow-2xl overflow-hidden animate-in slide-in-from-left-2">
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2.5"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
                <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">Environment Controller</span>
              </div>
           </div>
           <div className="bg-black/30 p-3 rounded-lg border border-white/5 font-mono text-xs text-slate-300 overflow-x-auto">
             <span className="text-blue-400 font-bold">{part.functionCall.name}</span>({JSON.stringify(part.functionCall.args, null, 2)})
           </div>
           {!part.safetyDecision && (
             <div className="text-[10px] text-slate-500 italic flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
                Action validated. Dispatching to runtime...
             </div>
           )}
        </div>
      )}
    </div>
  );
};

const EmptyState = ({ setInput }: { setInput: (s: string) => void }) => (
  <div className="h-full flex flex-col items-center justify-center text-center max-w-2xl mx-auto space-y-6 opacity-80 p-4">
    <div className="w-16 h-16 bg-blue-500/10 flex items-center justify-center rounded-2xl shadow-xl border border-blue-500/20">
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
    </div>
    <div className="space-y-2">
      <h2 className="text-3xl font-bold text-white tracking-tight">Gemini Agent Architect</h2>
      <p className="text-slate-400 text-sm">Autonomous planning, visual thinking, browser control, and deep research across local and public web environments.</p>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-xl">
      <QuickAction onClick={() => setInput("Search for current Gemini API documentation on tool configurations and grounding.")} label="Web Search: Gemini API Specs" />
      <QuickAction onClick={() => setInput("Calculate the compound interest for $10,000 at 5% over 10 years using Python and plot the growth curve.")} label="Compute: Visual Growth Analysis" />
      <QuickAction onClick={() => setInput("Find highly rated Japanese restaurants within 5 miles of my current location.")} label="Maps: Local Interaction" />
      <QuickAction onClick={() => setInput("Check the stock performance of GOOGL vs MSFT over the last month and interpret the volatility using code.")} label="Tool: Market Analysis" />
    </div>
  </div>
);

const ChatInput = ({ input, setInput, media, setMedia, fileInputRef, handleFileChange, handleSubmit, textareaRef }: any) => (
  <form onSubmit={handleSubmit} className="relative bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl focus-within:ring-2 focus-within:ring-blue-500/50 transition-all overflow-hidden">
    {media.length > 0 && (
      <div className="flex flex-wrap gap-2 p-3 bg-slate-950/50 border-b border-slate-800/50">
        {media.map((m: any, idx: number) => (
          <div key={idx} className="relative group h-16 w-16">
             <img src={m.url} className="h-full w-full object-cover rounded-lg border border-slate-700 shadow-md" alt="Preview" />
            <button type="button" onClick={() => setMedia((prev: any) => prev.filter((_: any, i: number) => i !== idx))} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg hover:scale-110 transition-transform"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
          </div>
        ))}
      </div>
    )}
    <textarea
      ref={textareaRef}
      value={input}
      onChange={(e) => setInput(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
      placeholder="Initiate research query or agent command..."
      className="w-full bg-transparent border-none focus:ring-0 text-slate-100 placeholder-slate-600 py-5 px-6 pr-32 min-h-[64px] max-h-48 resize-none font-sans"
    />
    <div className="absolute right-3 bottom-3 flex items-center gap-1.5">
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleFileChange} />
      <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2.5 hover:bg-slate-800 text-slate-500 hover:text-blue-400 rounded-2xl transition-all"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg></button>
      <button type="submit" disabled={!input.trim() && media.length === 0} className={`p-3 rounded-2xl transition-all ${input.trim() || media.length > 0 ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/30 active:scale-95' : 'bg-slate-800 text-slate-600'}`}><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg></button>
    </div>
  </form>
);

const QuickAction = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button onClick={onClick} className="px-5 py-3 text-xs font-medium bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-2xl text-slate-400 hover:text-white transition-all text-left shadow-sm hover:shadow-lg">
    {label}
  </button>
);

export default ChatInterface;
