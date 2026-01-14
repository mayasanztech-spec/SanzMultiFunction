
import React, { useRef } from 'react';
import { SourceFile } from '../types';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onClearChat: () => void;
  onOpenConfig: () => void;
  library: SourceFile[];
  onAddToLibrary: (file: SourceFile) => void;
  onRemoveFromLibrary: (id: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen, onToggle, onClearChat, onOpenConfig, library, onAddToLibrary, onRemoveFromLibrary
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        <span className="font-bold text-slate-500 text-[10px] tracking-widest uppercase">System Library</span>
        <button onClick={onToggle} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-8">
        <button 
          onClick={onClearChat} 
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-900/20 transition-all active:scale-95"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Clear Architecture
        </button>

        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Local Context</h3>
            <button onClick={() => fileInputRef.current?.click()} className="p-1 hover:bg-slate-800 rounded text-blue-400 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
            </button>
            <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileUpload} />
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
            {library.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-xl">
                <p className="text-[10px] text-slate-600 font-medium px-4 leading-relaxed uppercase">Drop multimodal assets for zero-shot context injection</p>
              </div>
            ) : (
              library.map(file => (
                <div key={file.id} className="group p-2.5 bg-slate-800/40 border border-slate-800 rounded-xl flex items-center justify-between hover:border-slate-700 transition-colors">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="p-2 rounded-lg bg-slate-900 text-blue-400">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                    </div>
                    <div className="overflow-hidden">
                      <div className="text-xs font-bold text-slate-300 truncate">{file.name}</div>
                      <div className="text-[9px] text-slate-500 font-mono">~{(file.size / 1024).toFixed(1)}KB</div>
                    </div>
                  </div>
                  <button onClick={() => onRemoveFromLibrary(file.id)} className="p-1.5 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-slate-800 bg-slate-900/50">
        <button onClick={onOpenConfig} className="flex items-center gap-3 w-full p-3 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-all">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1  1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
          <span className="text-xs font-bold uppercase tracking-widest">Settings</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
