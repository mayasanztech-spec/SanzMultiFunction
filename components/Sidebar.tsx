
import React, { useRef, useState, useEffect } from 'react';
import { SourceFile } from '../types';
import { gemini } from '../services/geminiService';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onClearChat: () => void;
  onOpenConfig: () => void;
  library: SourceFile[];
  onAddToLibrary: (file: SourceFile) => void;
  onRemoveFromLibrary: (id: string) => void;
  activeCache: string | null;
  onCacheContext: () => void;
  onClearCache: (name: string) => void;
  isCaching: boolean;
  onIndexLibrary: () => void;
  isIndexing: boolean;
  isIndexed: boolean;
  isLiveMode: boolean;
  onToggleLive: () => void;
  isBatchMode: boolean;
  onToggleBatch: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen, onToggle, onClearChat, onOpenConfig, library, onAddToLibrary, onRemoveFromLibrary, 
  activeCache, onCacheContext, onClearCache, isCaching, onIndexLibrary, isIndexing, isIndexed,
  isLiveMode, onToggleLive, isBatchMode, onToggleBatch
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const serverFileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'LOCAL' | 'SERVER'>('LOCAL');
  const [serverFiles, setServerFiles] = useState<any[]>([]);
  const [serverCaches, setServerCaches] = useState<any[]>([]);
  const [isRefreshingServer, setIsRefreshingServer] = useState(false);
  const [hasUserKey, setHasUserKey] = useState(false);

  useEffect(() => {
    checkAuthStatus();
    if (activeTab === 'SERVER') {
      refreshServerFiles();
      refreshCaches();
    }
  }, [activeTab]);

  const checkAuthStatus = async () => {
    if (typeof (window as any).aistudio?.hasSelectedApiKey === 'function') {
      const selected = await (window as any).aistudio.hasSelectedApiKey();
      setHasUserKey(selected);
    }
  };

  const handleSelectKey = async () => {
    if (typeof (window as any).aistudio?.openSelectKey === 'function') {
      await (window as any).aistudio.openSelectKey();
      setHasUserKey(true);
    }
  };

  const refreshServerFiles = async () => {
    setIsRefreshingServer(true);
    try {
      const files = await gemini.listFiles();
      setServerFiles(files);
    } catch (e: any) {
      console.error(e);
      if (e.message?.includes('403') || e.message?.includes('permission')) {
        setHasUserKey(false);
      }
    } finally {
      setIsRefreshingServer(false);
    }
  };

  const refreshCaches = async () => {
    try {
      const caches = await gemini.listCaches();
      setServerCaches(caches);
    } catch (e) {
      console.error(e);
    }
  };

  const handleServerFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    try {
      await gemini.uploadFile(file, file.name);
      refreshServerFiles();
    } catch (e) {
      console.error("Server upload failed", e);
    }
  };

  const handleDeleteServerFile = async (name: string) => {
    try {
      await gemini.deleteFile(name);
      refreshServerFiles();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteCache = async (name: string) => {
    try {
      await gemini.deleteCache(name);
      refreshCaches();
    } catch (e) {
      console.error(e);
    }
  };

  const handleExtendTTL = async (name: string) => {
    try {
      await gemini.updateCacheTTL(name, 3600); // Extend by 1 hour
      refreshCaches();
    } catch (e) {
      console.error(e);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        onAddToLibrary({
          id: Date.now().toString() + Math.random(),
          name: file.name,
          mimeType: file.type,
          data: base64,
          size: file.size,
          tokenCountEstimate: Math.floor(file.size / 4)
        });
      };
      reader.readAsDataURL(file);
    });
  };

  if (!isOpen) return null;

  return (
    <aside className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col transition-all duration-300">
      <div className="p-4 flex items-center justify-between border-b border-slate-800">
        <span className="font-bold text-slate-500 text-[10px] tracking-widest uppercase">Memory Unit</span>
        <button onClick={onToggle} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-8">
        {/* Auth Protocol Section */}
        <div className="p-4 bg-slate-800/40 border border-slate-700/50 rounded-2xl space-y-3">
           <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Auth Protocol</span>
              <div className={`w-1.5 h-1.5 rounded-full ${hasUserKey ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
           </div>
           <button 
            onClick={handleSelectKey}
            className={`w-full py-2.5 rounded-xl text-[10px] font-bold uppercase transition-all border flex items-center justify-center gap-2 ${hasUserKey ? 'bg-slate-900 border-slate-700 text-slate-400' : 'bg-blue-600 border-blue-500 text-white hover:bg-blue-700 shadow-lg shadow-blue-900/20'}`}
           >
             <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
             {hasUserKey ? 'Protocol Connected' : 'Connect Billing Key'}
           </button>
           {!hasUserKey && (
             <p className="text-[8px] text-slate-500 leading-tight">
               Permission error detected. Advanced Gemini features (Batch, Caching, Pro) require a <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="text-blue-400 underline">paid project API key</a> selection.
             </p>
           )}
        </div>

        <div className="space-y-3">
          <button 
            onClick={onClearChat} 
            disabled={isLiveMode || isBatchMode}
            className={`w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-900/20 transition-all active:scale-95 ${isLiveMode || isBatchMode ? 'opacity-30 cursor-not-allowed' : ''}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            New Architectural Loop
          </button>
          
          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={onToggleLive} 
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-bold shadow-lg transition-all active:scale-95 border ${isLiveMode ? 'bg-red-600 border-red-500 text-white animate-pulse' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path></svg>
              {isLiveMode ? 'LIVE' : 'GO LIVE'}
            </button>
            <button 
              onClick={onToggleBatch} 
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-bold shadow-lg transition-all active:scale-95 border ${isBatchMode ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
              {isBatchMode ? 'PIPELINE' : 'BATCH'}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex border-b border-slate-800">
             <button 
              onClick={() => setActiveTab('LOCAL')} 
              className={`flex-1 py-2 text-[9px] font-bold uppercase tracking-widest border-b-2 transition-all ${activeTab === 'LOCAL' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
             >
               Local Files
             </button>
             <button 
              onClick={() => setActiveTab('SERVER')} 
              className={`flex-1 py-2 text-[9px] font-bold uppercase tracking-widest border-b-2 transition-all ${activeTab === 'SERVER' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
             >
               Cloud Space
             </button>
          </div>

          {activeTab === 'LOCAL' ? (
            <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-300">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Library (Inline/RAG)</h3>
                <button onClick={() => fileInputRef.current?.click()} className="p-1 hover:bg-slate-800 rounded text-blue-400 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                </button>
                <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileUpload} />
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                {library.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-slate-800 rounded-xl">
                    <p className="text-[10px] text-slate-600 font-medium px-4 leading-relaxed uppercase">Drop technical manuals or datasets to initialize context</p>
                  </div>
                ) : (
                  library.map(file => (
                    <div key={file.id} className="group p-2.5 bg-slate-800/40 border border-slate-800 rounded-xl flex items-center justify-between hover:border-slate-700 transition-colors">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className={`p-2 rounded-lg ${file.isIndexed ? 'bg-amber-900/50 text-amber-400' : 'bg-slate-900 text-blue-400'}`}>
                          {file.isIndexed ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"></path></svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                          )}
                        </div>
                        <div className="overflow-hidden">
                          <div className="text-xs font-bold text-slate-300 truncate">{file.name}</div>
                          <div className="text-[9px] text-slate-500 font-mono uppercase">~{(file.size / 1024).toFixed(1)}KB</div>
                        </div>
                      </div>
                      <button onClick={() => onRemoveFromLibrary(file.id)} className="p-1.5 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      </button>
                    </div>
                  ))
                )}
              </div>

              {library.length > 0 && !isLiveMode && !isBatchMode && (
                <div className="pt-2 space-y-2">
                  {!isIndexed ? (
                    <button 
                      onClick={onIndexLibrary} 
                      disabled={isIndexing}
                      className="w-full py-2.5 bg-amber-600/10 border border-amber-500/30 hover:bg-amber-600/20 text-amber-400 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all shadow-lg shadow-amber-900/10"
                    >
                      {isIndexing ? 'Semantic Embedding...' : 'Index Library (RAG)'}
                    </button>
                  ) : (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        <div className="flex-1 text-left">
                          <div className="text-[10px] font-bold text-amber-400 uppercase tracking-tighter">Semantic Index Ready</div>
                          <div className="text-[8px] font-mono text-slate-500 uppercase tracking-widest">Retrieval Tool Enabled</div>
                        </div>
                    </div>
                  )}

                  {!activeCache ? (
                    <button 
                      onClick={onCacheContext} 
                      disabled={isCaching || isIndexed}
                      className={`w-full py-2.5 bg-indigo-600/10 border border-indigo-500/30 hover:bg-indigo-600/20 text-indigo-400 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${isIndexed ? 'opacity-30 cursor-not-allowed' : ''}`}
                    >
                      {isCaching ? 'Freezing Context...' : 'Freeze Context (Cache)'}
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                          <div className="flex-1 text-left">
                            <div className="text-[10px] font-bold text-green-400 uppercase tracking-tighter">Active Neural Freeze</div>
                            <div className="text-[8px] font-mono text-slate-500 truncate">{activeCache}</div>
                          </div>
                      </div>
                      <button onClick={() => onClearCache(activeCache)} className="w-full py-2 text-[9px] text-slate-500 hover:text-red-400 font-bold uppercase tracking-widest transition-colors">Invalidate Cache</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
              {/* Files API Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Global Files (48h)</h3>
                  <div className="flex gap-2">
                    <button onClick={refreshServerFiles} disabled={isRefreshingServer} className="p-1 hover:bg-slate-800 rounded text-amber-400 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={isRefreshingServer ? 'animate-spin' : ''}><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                    </button>
                    <button onClick={() => serverFileInputRef.current?.click()} className="p-1 hover:bg-slate-800 rounded text-amber-400 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                    </button>
                  </div>
                  <input type="file" ref={serverFileInputRef} className="hidden" onChange={handleServerFileUpload} />
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                  {serverFiles.map(file => (
                    <div key={file.name} className="group p-2.5 bg-slate-800/20 border border-slate-800 rounded-xl flex items-center justify-between hover:border-slate-700 transition-colors">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="p-2 rounded-lg bg-slate-900 text-amber-500">
                           <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                        </div>
                        <div className="overflow-hidden text-left">
                          <div className="text-xs font-bold text-slate-300 truncate">{file.displayName}</div>
                          <div className="text-[8px] text-slate-500 font-mono uppercase truncate">{file.name}</div>
                        </div>
                      </div>
                      <button onClick={() => handleDeleteServerFile(file.name)} className="p-1.5 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Context Caches Section */}
              <div className="space-y-3 pt-4 border-t border-slate-800/50">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Neural Caches (Frozen State)</h3>
                  <button onClick={refreshCaches} className="p-1 hover:bg-slate-800 rounded text-indigo-400 transition-colors">
                     <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                  {serverCaches.length === 0 ? (
                    <div className="text-center py-6 border border-slate-800 rounded-xl bg-slate-900/20">
                      <p className="text-[9px] text-slate-600 font-bold uppercase">No Active Neural Freezes</p>
                    </div>
                  ) : (
                    serverCaches.map(cache => (
                      <div key={cache.name} className="group p-3 bg-indigo-900/10 border border-indigo-500/20 rounded-xl space-y-3 transition-all hover:bg-indigo-900/20">
                        <div className="flex items-center justify-between">
                           <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${activeCache === cache.name ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)] animate-pulse' : 'bg-indigo-500'}`} />
                              <span className="text-[10px] font-bold text-slate-300 truncate max-w-[120px]">{cache.displayName}</span>
                           </div>
                           <button onClick={() => handleDeleteCache(cache.name)} className="p-1 hover:text-red-400 text-slate-600 transition-all">
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                           </button>
                        </div>
                        <div className="flex items-center justify-between text-[8px] font-mono text-slate-500 uppercase">
                           <span>{cache.usageMetadata.totalTokenCount} Tokens</span>
                           <span>Expires: {new Date(cache.expireTime).toLocaleTimeString()}</span>
                        </div>
                        <div className="flex gap-2">
                           <button 
                            onClick={() => gemini.setActiveCache(cache.name === activeCache ? null : cache.name)}
                            className={`flex-1 py-1 rounded text-[9px] font-bold uppercase transition-all ${activeCache === cache.name ? 'bg-green-600/20 text-green-400 border border-green-500/30' : 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-600/30'}`}
                           >
                             {activeCache === cache.name ? 'Active State' : 'Apply State'}
                           </button>
                           <button 
                            onClick={() => handleExtendTTL(cache.name)}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 rounded text-[9px] font-bold uppercase transition-all"
                           >
                             +1h TTL
                           </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="p-3 bg-slate-900/50 border border-slate-800 rounded-xl">
                 <p className="text-[8px] text-slate-500 uppercase leading-tight font-medium">Neural Caching ensures bit-perfect context reuse. Billing is optimized for repeated prefix hits on long-lived datasets.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 border-t border-slate-800 bg-slate-900/50">
        <button onClick={onOpenConfig} className="flex items-center gap-3 w-full p-3 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-all group">
          <svg className="group-hover:rotate-45 transition-transform" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1  1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
          <span className="text-xs font-bold uppercase tracking-widest">Protocol Config</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
