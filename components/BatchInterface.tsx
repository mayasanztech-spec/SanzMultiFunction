
import React, { useState, useEffect } from 'react';
import { gemini } from '../services/geminiService';
import { BatchJob, BatchJobState, ModelId } from '../types';

const BatchInterface: React.FC = () => {
  const [submissionMode, setSubmissionMode] = useState<'INLINE' | 'FILE'>('INLINE');
  const [prompts, setPrompts] = useState<string[]>(['']);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [serverFiles, setServerFiles] = useState<any[]>([]);
  const [displayName, setDisplayName] = useState(`Batch_Architect_${new Date().toLocaleTimeString()}`);
  const [selectedModel, setSelectedModel] = useState<ModelId>(ModelId.FLASH);
  const [jobs, setJobs] = useState<BatchJob[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewingJob, setViewingJob] = useState<BatchJob | null>(null);

  useEffect(() => {
    refreshJobs();
    if (submissionMode === 'FILE') {
      refreshServerFiles();
    }
    const interval = setInterval(() => {
      refreshJobs();
    }, 15000); 
    return () => clearInterval(interval);
  }, [submissionMode]);

  const refreshServerFiles = async () => {
    try {
      const files = await gemini.listFiles();
      setServerFiles(files.filter((f: any) => f.mimeType === 'jsonl' || f.name.endsWith('.jsonl')));
    } catch (e) {
      console.error(e);
    }
  };

  const refreshJobs = async () => {
    const updatedJobs = await Promise.all(
      jobs.map(async (job) => {
        if (job.state === BatchJobState.PENDING || job.state === BatchJobState.RUNNING) {
          try {
            return await gemini.getBatchJob(job.name);
          } catch (e) {
            return job;
          }
        }
        return job;
      })
    );
    setJobs(updatedJobs);
  };

  const handleAddPrompt = () => setPrompts([...prompts, '']);
  const handleRemovePrompt = (idx: number) => setPrompts(prompts.filter((_, i) => i !== idx));
  const handlePromptChange = (idx: number, val: string) => {
    const newPrompts = [...prompts];
    newPrompts[idx] = val;
    setPrompts(newPrompts);
  };

  const submitBatch = async () => {
    let src: any;
    if (submissionMode === 'INLINE') {
      if (prompts.filter(p => p.trim()).length === 0) return;
      src = prompts.filter(p => p.trim()).map(p => ({
        contents: [{ role: 'user', parts: [{ text: p }] }]
      }));
    } else {
      if (!selectedFile) return;
      src = selectedFile;
    }

    setIsSubmitting(true);
    try {
      const newJob = await gemini.createBatchJob(selectedModel, src, displayName);
      setJobs([newJob, ...jobs]);
      setPrompts(['']);
      setDisplayName(`Batch_Architect_${new Date().toLocaleTimeString()}`);
    } catch (e) {
      console.error("Batch creation failed", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelJob = async (name: string) => {
    try {
      await gemini.cancelBatchJob(name);
      refreshJobs();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
      <div className="flex-1 flex flex-col md:flex-row h-full">
        {/* Creator Panel */}
        <div className="w-full md:w-1/2 p-6 border-r border-slate-800 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-6">
             <div className="space-y-1">
                <div className="px-2 py-0.5 bg-blue-600/10 border border-blue-500/20 rounded text-[9px] font-bold text-blue-400 inline-block uppercase tracking-widest">Efficiency Mode: ON</div>
                <h2 className="text-xl font-bold text-white tracking-tight">New Batch Pipeline</h2>
             </div>
             <div className="text-right">
                <div className="text-[10px] text-slate-500 font-bold uppercase">Estimated Cost Reduction</div>
                <div className="text-lg font-mono text-green-500 font-bold">50% SAVING</div>
             </div>
          </div>

          <div className="flex gap-2 mb-6 p-1 bg-slate-900 border border-slate-800 rounded-2xl">
            <button 
              onClick={() => setSubmissionMode('INLINE')}
              className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all ${submissionMode === 'INLINE' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Inline Requests
            </button>
            <button 
              onClick={() => setSubmissionMode('FILE')}
              className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all ${submissionMode === 'FILE' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Large Scale (JSONL)
            </button>
          </div>

          <div className="space-y-4 mb-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pipeline Identity</label>
              <input 
                value={displayName} 
                onChange={e => setDisplayName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:ring-1 focus:ring-blue-500/50 outline-none"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Compute Core</label>
              <select 
                value={selectedModel} 
                onChange={e => setSelectedModel(e.target.value as ModelId)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:ring-1 focus:ring-blue-500/50 outline-none"
              >
                <option value={ModelId.FLASH}>Gemini 3 Flash (High Throughput)</option>
                <option value={ModelId.PRO}>Gemini 3 Pro (High Complexity)</option>
                <option value={ModelId.IMAGE_PRO}>Imagen 4 (Batch Image Gen)</option>
              </select>
            </div>
          </div>

          <div className="flex-1 flex flex-col min-h-0 bg-slate-900/30 border border-slate-800 rounded-2xl p-4 overflow-hidden">
            {submissionMode === 'INLINE' ? (
              <>
                <div className="flex items-center justify-between mb-4 px-1">
                   <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Neural Request Queue ({prompts.length})</h3>
                   <button onClick={handleAddPrompt} className="p-1 hover:bg-slate-800 rounded text-blue-400 transition-colors">
                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                   </button>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                   {prompts.map((p, idx) => (
                     <div key={idx} className="relative group flex gap-2">
                        <div className="mt-2.5 w-6 h-6 flex items-center justify-center rounded bg-slate-800 text-[10px] font-mono text-slate-500 flex-shrink-0">
                          {(idx + 1).toString().padStart(2, '0')}
                        </div>
                        <textarea 
                          value={p}
                          onChange={e => handlePromptChange(idx, e.target.value)}
                          placeholder="Enter instruction set..."
                          className="flex-1 bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-300 min-h-[60px] resize-none focus:border-slate-700 outline-none transition-colors"
                        />
                        <button 
                          onClick={() => handleRemovePrompt(idx)} 
                          className="absolute right-2 top-2 p-1.5 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                     </div>
                   ))}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col space-y-4">
                <div className="px-1">
                  <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Select Input File (JSONL)</h3>
                  <p className="text-[8px] text-slate-600 mt-1 uppercase">Files must be uploaded to 'Server Storage' first.</p>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {serverFiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-700 space-y-3 border-2 border-dashed border-slate-800 rounded-xl p-6">
                       <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-40"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                       <span className="text-[10px] font-bold uppercase">No JSONL files found in storage</span>
                    </div>
                  ) : (
                    serverFiles.map(file => (
                      <button 
                        key={file.name}
                        onClick={() => setSelectedFile(file.name)}
                        className={`w-full p-3 border rounded-xl flex items-center justify-between transition-all ${selectedFile === file.name ? 'bg-amber-600/10 border-amber-500 text-amber-400' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'}`}
                      >
                        <div className="flex items-center gap-3">
                           <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                           <span className="text-xs font-bold">{file.displayName}</span>
                        </div>
                        {selectedFile === file.name && <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
            
            <button 
              onClick={submitBatch}
              disabled={isSubmitting || (submissionMode === 'INLINE' ? prompts.filter(p => p.trim()).length === 0 : !selectedFile)}
              className={`mt-4 w-full py-4 ${submissionMode === 'FILE' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'} disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-bold flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl`}
            >
              {isSubmitting ? (
                 <>
                   <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                   {submissionMode === 'FILE' ? 'UPLOAD_TO_BATCH_ENGINE...' : 'INITIALIZING_PIPELINE...'}
                 </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                  {submissionMode === 'FILE' ? 'LAUNCH_LARGE_SCALE_BATCH' : 'DISPATCH_INLINE_BATCH'}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Status Panel */}
        <div className="flex-1 p-6 bg-slate-900/20 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-8">
             <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Neural Pipeline Status</h3>
             <button onClick={refreshJobs} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
             </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
            {jobs.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 text-[10px] uppercase font-bold text-center p-12 space-y-4">
                 <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-20"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                 No Neural Pipelines Dispatched
              </div>
            )}

            {jobs.map((job) => (
              <div key={job.name} className="p-4 bg-slate-900/50 border border-slate-800 rounded-2xl hover:border-slate-700 transition-all group">
                <div className="flex items-center justify-between mb-3">
                   <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${job.state === BatchJobState.SUCCEEDED ? 'bg-green-500' : (job.state === BatchJobState.RUNNING ? 'bg-blue-500 animate-pulse' : (job.state === BatchJobState.FAILED ? 'bg-red-500' : 'bg-slate-700'))}`} />
                      <span className="text-xs font-bold text-slate-300">{job.displayName}</span>
                   </div>
                   <div className="text-[9px] font-mono text-slate-600 uppercase">
                     {job.state.replace('JOB_STATE_', '')}
                   </div>
                </div>
                
                <div className="flex items-center justify-between text-[10px] text-slate-500 mb-4">
                   <div className="flex gap-4">
                      <span>{job.model.split('/').pop()}</span>
                      <span>Created: {new Date(job.createTime).toLocaleTimeString()}</span>
                   </div>
                </div>

                <div className="flex gap-2">
                   {job.state === BatchJobState.SUCCEEDED ? (
                     <button 
                      onClick={() => setViewingJob(job)}
                      className="flex-1 py-1.5 bg-green-600/10 border border-green-500/30 hover:bg-green-600/20 text-green-400 rounded-lg text-[10px] font-bold uppercase transition-all"
                     >
                       Explore Results
                     </button>
                   ) : (job.state === BatchJobState.RUNNING || job.state === BatchJobState.PENDING) && (
                      <button 
                        onClick={() => cancelJob(job.name)}
                        className="flex-1 py-1.5 bg-red-600/10 border border-red-500/30 hover:bg-red-600/20 text-red-400 rounded-lg text-[10px] font-bold uppercase transition-all"
                      >
                        Abort Pipeline
                      </button>
                   )}
                   <button 
                    onClick={() => setJobs(jobs.filter(j => j.name !== job.name))}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-500 rounded-lg transition-all"
                   >
                     <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                   </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Result Explorer Modal */}
      {viewingJob && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12">
           <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setViewingJob(null)} />
           <div className="relative w-full max-w-5xl h-full bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
              <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-green-600/10 border border-green-500/30 flex items-center justify-center text-green-500">
                       <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">{viewingJob.displayName}</h3>
                      <p className="text-xs text-slate-500 uppercase tracking-widest">{viewingJob.model} · Pipeline Complete</p>
                    </div>
                 </div>
                 <button onClick={() => setViewingJob(null)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                 </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                {viewingJob.dest?.inlinedResponses ? (
                  <div className="grid grid-cols-1 gap-6">
                    {viewingJob.dest.inlinedResponses.map((res: any, idx: number) => (
                       <div key={idx} className="space-y-3 p-6 bg-slate-950/50 border border-slate-800 rounded-2xl">
                          <div className="flex items-center gap-2 mb-2">
                             <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-[10px] font-mono text-slate-400">
                               {(idx + 1).toString().padStart(2, '0')}
                             </div>
                             <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Neural Response Data</span>
                          </div>
                          <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap leading-relaxed text-slate-300">
                            {res.response?.candidates?.[0]?.content?.parts?.[0]?.text || "No text content"}
                          </div>
                          {res.response?.candidates?.[0]?.content?.parts?.find((p:any) => p.inlineData) && (
                            <img 
                              src={`data:image/png;base64,${res.response.candidates[0].content.parts.find((p:any) => p.inlineData).inlineData.data}`}
                              className="mt-4 rounded-xl border border-white/5 max-h-96 object-contain"
                              alt="Batch Generated Output"
                            />
                          )}
                       </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-4">
                     <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="opacity-20"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                     <div className="text-center">
                        <p className="text-sm font-bold uppercase tracking-widest mb-1">Results Stored in Global File</p>
                        <p className="text-xs opacity-60">Result filename: {viewingJob.dest?.fileName || 'unknown'}</p>
                        <button className="mt-4 px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-[10px] font-bold uppercase transition-all">Download Result JSONL</button>
                     </div>
                  </div>
                )}
              </div>
              
              <div className="p-6 bg-slate-950/50 border-t border-slate-800 flex justify-between items-center">
                 <div className="text-[10px] font-mono text-slate-600">
                    ID: {viewingJob.name}
                 </div>
                 <button className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all">
                    Export Analysis
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default BatchInterface;
