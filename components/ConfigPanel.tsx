
import React from 'react';
import { GenerationConfig, ModelId, SpecializedTask, ThinkingLevel, MediaResolution } from '../types';

interface ConfigPanelProps {
  isOpen: boolean;
  onClose: () => void;
  config: GenerationConfig;
  onUpdateConfig: (config: GenerationConfig) => void;
}

const ConfigPanel: React.FC<ConfigPanelProps> = ({ isOpen, onClose, config, onUpdateConfig }) => {
  if (!isOpen) return null;

  const handleChange = (field: keyof GenerationConfig, value: any) => {
    onUpdateConfig({ ...config, [field]: value });
  };

  const isGemini3 = config.model.startsWith('gemini-3');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1  1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            Agent Architect Protocol
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
        </div>

        <div className="flex-1 p-6 space-y-8 overflow-y-auto scroll-smooth custom-scrollbar">
          <div className="space-y-4">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Neural Compute Engine</label>
            <div className="grid grid-cols-2 gap-3">
              <ModelOption active={config.model === ModelId.FLASH} onClick={() => handleChange('model', ModelId.FLASH)} title="Logic Flash 3" desc="Semantic RAG · 1M Window" />
              <ModelOption active={config.model === ModelId.PRO} onClick={() => handleChange('model', ModelId.PRO)} title="Logic Pro 3" desc="2M Window · Max Intelligence" />
              <ModelOption active={config.model === ModelId.COMPUTER_USE} onClick={() => handleChange('model', ModelId.COMPUTER_USE)} title="Computer Use Preview" desc="Agentic Browser Control" />
              <ModelOption active={config.model === ModelId.PRO_2_5} onClick={() => handleChange('model', ModelId.PRO_2_5)} title="Logic Pro 2.5" desc="High-Fidelity Context" />
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Prompt Strategy Lab</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
               <StrategyToggle 
                  active={config.useStrictGrounding} 
                  onClick={() => handleChange('useStrictGrounding', !config.useStrictGrounding)} 
                  title="Strict Context Grounding" 
                  desc="Forces model to rely ONLY on user context." 
               />
               <StrategyToggle 
                  active={config.useDateAwareness} 
                  onClick={() => handleChange('useDateAwareness', !config.useDateAwareness)} 
                  title="2025 Date Awareness" 
                  desc="Anchors search and tools to current year 2025." 
               />
               <StrategyToggle 
                  active={config.useVisualThinking} 
                  onClick={() => {
                    handleChange('useVisualThinking', !config.useVisualThinking);
                    if (!config.useVisualThinking) handleChange('useCodeExecution', true);
                  }} 
                  title="Visual Logic Engine" 
                  desc="Encourages Python for image analysis/editing." 
               />
               <StrategyToggle 
                  active={config.useAutoPlanning} 
                  onClick={() => handleChange('useAutoPlanning', !config.useAutoPlanning)} 
                  title="Step-by-Step Planning" 
                  desc="Model creates a plan before responding." 
               />
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Multimodal Fidelity</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: MediaResolution.UNSPECIFIED, label: 'Default' },
                { id: MediaResolution.LOW, label: 'Fast/Cheap' },
                { id: MediaResolution.MEDIUM, label: 'Standard' },
                { id: MediaResolution.HIGH, label: 'Precision' }
              ].map(res => (
                <button 
                  key={res.id} 
                  onClick={() => handleChange('mediaResolution', res.id)}
                  className={`py-2 px-1 text-[10px] font-bold rounded-lg border transition-all ${config.mediaResolution === res.id ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-600'}`}
                >
                  {res.label.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Autonomous Capability Matrix</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
               <ToolToggle 
                  active={config.useFileSearch} 
                  onClick={() => handleChange('useFileSearch', !config.useFileSearch)} 
                  title="Semantic RAG Index" 
                  desc="High-speed vector retrieval." 
                  icon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>}
                  disabled={!config.fileSearchStoreName}
               />
               <ToolToggle 
                  active={config.useCodeExecution} 
                  onClick={() => handleChange('useCodeExecution', !config.useCodeExecution)} 
                  title="Python Sandbox" 
                  desc="Run code and plots." 
                  icon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>}
               />
               <ToolToggle 
                  active={config.useGoogleSearch} 
                  onClick={() => handleChange('useGoogleSearch', !config.useGoogleSearch)} 
                  title="Web Grounding" 
                  desc="External verification." 
                  icon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>}
                  disabled={config.useFileSearch}
               />
               <ToolToggle 
                  active={config.useUrlContext} 
                  onClick={() => handleChange('useUrlContext', !config.useUrlContext)} 
                  title="Deep Link Analysis" 
                  desc="Specific page parsing." 
                  icon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>}
                  disabled={config.useFileSearch}
               />
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
               <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Logic Depth</label>
               <div className="flex items-center gap-2">
                 <span className="text-[10px] text-slate-400 font-bold uppercase">Chain-of-Thought</span>
                 <button onClick={() => handleChange('includeThoughts', !config.includeThoughts)} className={`w-8 h-4 rounded-full relative transition-all ${config.includeThoughts ? 'bg-blue-600' : 'bg-slate-700'}`}>
                   <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${config.includeThoughts ? 'left-4.5' : 'left-0.5'}`} />
                 </button>
               </div>
            </div>
            {isGemini3 && (
              <div className="grid grid-cols-4 gap-2">
                {(['minimal', 'low', 'medium', 'high'] as ThinkingLevel[]).map(level => (
                  <button key={level} onClick={() => handleChange('thinkingLevel', level)} className={`py-2 text-[10px] font-bold rounded-lg border transition-all ${config.thinkingLevel === level ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/40' : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-600'}`}>
                    {level.toUpperCase()}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-6 pb-6">
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Stochasticity</label>
              <input type="range" min="0" max="2" step="0.1" value={config.temperature} onChange={(e) => handleChange('temperature', parseFloat(e.target.value))} className="w-full accent-blue-500" />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Output Bounds</label>
              <input type="range" min="512" max="16384" step="512" value={config.maxOutputTokens} onChange={(e) => handleChange('maxOutputTokens', parseInt(e.target.value))} className="w-full accent-blue-500" />
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex justify-end">
          <button onClick={onClose} className="px-10 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold uppercase text-[10px] tracking-widest transition-all active:scale-95 shadow-xl shadow-blue-500/30">Deploy Protocol</button>
        </div>
      </div>
    </div>
  );
};

const StrategyToggle = ({ active, onClick, title, desc }: any) => (
  <button 
    onClick={onClick}
    className={`p-4 rounded-2xl border transition-all text-left flex flex-col gap-1 h-24 ${active ? 'bg-indigo-600/10 border-indigo-500 ring-1 ring-indigo-500 shadow-lg' : 'bg-slate-800 border-slate-700 hover:border-slate-600'}`}
  >
    <div className={`font-bold text-[10px] uppercase tracking-wider ${active ? 'text-indigo-400' : 'text-slate-300'}`}>{title}</div>
    <div className="text-[9px] text-slate-500 leading-tight font-medium">{desc}</div>
  </button>
);

const ToolToggle = ({ active, onClick, title, desc, icon, disabled }: any) => (
  <button 
    onClick={onClick} 
    disabled={disabled}
    className={`p-4 rounded-2xl border transition-all text-left flex items-start gap-3 h-24 ${active ? 'bg-blue-600/10 border-blue-500 ring-1 ring-blue-500 shadow-xl' : 'bg-slate-800 border-slate-700 hover:border-slate-600'} ${disabled ? 'opacity-30 cursor-not-allowed' : 'opacity-80'}`}
  >
    <div className={`p-2 rounded-lg ${active ? 'bg-blue-500 text-white' : 'bg-slate-900 text-slate-500'}`}>
       {icon}
    </div>
    <div className="flex-1 overflow-hidden">
      <div className={`font-bold text-xs truncate ${active ? 'text-blue-300' : 'text-slate-200'}`}>{title}</div>
      <div className="text-[9px] text-slate-500 leading-relaxed font-medium mt-1">{desc}</div>
    </div>
  </button>
);

const ModelOption = ({ active, onClick, title, desc }: any) => (
  <button onClick={onClick} className={`p-4 rounded-2xl border transition-all text-left flex flex-col justify-between h-24 ${active ? 'bg-blue-600/10 border-blue-500 ring-1 ring-blue-500 shadow-xl' : 'bg-slate-800 border-slate-700 hover:border-slate-600'}`}>
    <div className={`font-bold text-xs ${active ? 'text-blue-400' : 'text-slate-200'}`}>{title}</div>
    <div className="text-[9px] text-slate-500 leading-relaxed font-medium uppercase tracking-tight">{desc}</div>
  </button>
);

export default ConfigPanel;
