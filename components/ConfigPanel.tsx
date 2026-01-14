
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-lg font-bold">System Protocol</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
        </div>

        <div className="flex-1 p-6 space-y-8 overflow-y-auto custom-scrollbar">
          <div className="space-y-4">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Compute Core</label>
            <div className="grid grid-cols-2 gap-3">
              <ModelOption active={config.model === ModelId.FLASH} onClick={() => handleChange('model', ModelId.FLASH)} title="Gemini 3 Flash" desc="High-speed reasoning" />
              <ModelOption active={config.model === ModelId.FLASH_2_5} onClick={() => handleChange('model', ModelId.FLASH_2_5)} title="Flash Lite 2.5" desc="Efficient multimodal" />
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Active Tools</label>
            <div className="grid grid-cols-2 gap-3">
               <ToolToggle active={config.useGoogleSearch} onClick={() => handleChange('useGoogleSearch', !config.useGoogleSearch)} title="Search Grounding" desc="Web-based verification" />
               <ToolToggle active={config.useCodeExecution} onClick={() => handleChange('useCodeExecution', !config.useCodeExecution)} title="Python Sandbox" desc="Logical computation" />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
               <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Logic Depth</label>
               <button onClick={() => handleChange('includeThoughts', !config.includeThoughts)} className={`w-8 h-4 rounded-full relative transition-all ${config.includeThoughts ? 'bg-blue-600' : 'bg-slate-700'}`}>
                 <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${config.includeThoughts ? 'left-4.5' : 'left-0.5'}`} />
               </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {(['minimal', 'low', 'medium', 'high'] as ThinkingLevel[]).map(level => (
                <button key={level} onClick={() => handleChange('thinkingLevel', level)} className={`py-2 text-[10px] font-bold rounded-lg border transition-all ${config.thinkingLevel === level ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-600'}`}>
                  {level.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Temperature</label>
              <input type="range" min="0" max="2" step="0.1" value={config.temperature} onChange={(e) => handleChange('temperature', parseFloat(e.target.value))} className="w-full accent-blue-500" />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Max Output</label>
              <input type="range" min="512" max="8192" step="512" value={config.maxOutputTokens} onChange={(e) => handleChange('maxOutputTokens', parseInt(e.target.value))} className="w-full accent-blue-500" />
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex justify-end">
          <button onClick={onClose} className="px-10 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold uppercase text-[10px] tracking-widest transition-all">Apply</button>
        </div>
      </div>
    </div>
  );
};

const ToolToggle = ({ active, onClick, title, desc }: any) => (
  <button onClick={onClick} className={`p-4 rounded-2xl border transition-all text-left flex flex-col gap-1 ${active ? 'bg-blue-600/10 border-blue-500' : 'bg-slate-800 border-slate-700 hover:border-slate-600'}`}>
    <div className={`font-bold text-[10px] uppercase tracking-wider ${active ? 'text-blue-400' : 'text-slate-300'}`}>{title}</div>
    <div className="text-[9px] text-slate-500 leading-tight">{desc}</div>
  </button>
);

const ModelOption = ({ active, onClick, title, desc }: any) => (
  <button onClick={onClick} className={`p-4 rounded-2xl border transition-all text-left flex flex-col justify-between h-20 ${active ? 'bg-blue-600/10 border-blue-500' : 'bg-slate-800 border-slate-700 hover:border-slate-600'}`}>
    <div className={`font-bold text-xs ${active ? 'text-blue-400' : 'text-slate-200'}`}>{title}</div>
    <div className="text-[9px] text-slate-500 uppercase tracking-tight">{desc}</div>
  </button>
);

export default ConfigPanel;
