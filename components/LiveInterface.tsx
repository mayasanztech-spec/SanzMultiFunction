
import React, { useEffect, useRef, useState } from 'react';
import { gemini } from '../services/geminiService';
import { decodeBase64, decodeAudioData, createPcmBlob } from '../services/audioUtils';

interface LiveInterfaceProps {
  systemInstruction: string;
}

const LiveInterface: React.FC<LiveInterfaceProps> = ({ systemInstruction }) => {
  const [isActive, setIsActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isTranscriptionOn, setIsTranscriptionOn] = useState(true);
  const [isThinkingOn, setIsThinkingOn] = useState(true);
  const [useLiveSearch, setUseLiveSearch] = useState(false);
  const [useEphemeral, setUseEphemeral] = useState(true);
  const [status, setStatus] = useState<'IDLE' | 'PROVISIONING' | 'CONNECTING' | 'LIVE'>('IDLE');
  
  // Resumption state
  const [resumptionHandle, setResumptionHandle] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string | null>(null);
  const [tokenInfo, setTokenInfo] = useState<{ name: string, expiresAt: Date } | null>(null);
  const [tokenTimeRemaining, setTokenTimeRemaining] = useState<number>(0);

  // Transcriptions state
  const [transcriptions, setTranscriptions] = useState<{ role: 'user' | 'model' | 'tool', text: string }[]>([]);
  const [currentThoughts, setCurrentThoughts] = useState<string>("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<any>(null);
  const audioContextInRef = useRef<AudioContext | null>(null);
  const audioContextOutRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesSetRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const frameIntervalRef = useRef<number | null>(null);
  const transcriptScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
    }
  }, [transcriptions, currentThoughts]);

  // Token countdown timer
  useEffect(() => {
    if (!tokenInfo) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, tokenInfo.expiresAt.getTime() - Date.now());
      setTokenTimeRemaining(remaining);
      if (remaining <= 0) {
        setTokenInfo(null);
        if (isActive) stopSession();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [tokenInfo, isActive]);

  const startSession = async () => {
    let authToken = "";

    if (useEphemeral) {
      setStatus('PROVISIONING');
      try {
        const token = await gemini.createAuthToken(30);
        authToken = token.name;
        setTokenInfo({
          name: token.name,
          expiresAt: new Date(Date.now() + 30 * 60000)
        });
      } catch (err) {
        console.error("Token provisioning failed", err);
        setStatus('IDLE');
        return;
      }
    }

    setStatus('CONNECTING');
    setTimeLeft(null);
    if (!resumptionHandle) {
      setTranscriptions([]);
      setCurrentThoughts("");
    }
    
    if (!audioContextInRef.current) {
      audioContextInRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    }
    if (!audioContextOutRef.current) {
      audioContextOutRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    nextStartTimeRef.current = 0;

    const sessionPromise = gemini.connectLive({
      onopen: async () => {
        setStatus('LIVE');
        setIsActive(true);
        
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const source = audioContextInRef.current!.createMediaStreamSource(stream);
          const scriptProcessor = audioContextInRef.current!.createScriptProcessor(4096, 1, 1);
          
          scriptProcessor.onaudioprocess = (e) => {
            if (isMuted || !isActive) return;
            const inputData = e.inputBuffer.getChannelData(0);
            const pcmBlob = createPcmBlob(inputData);
            sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
          };
          
          source.connect(scriptProcessor);
          scriptProcessor.connect(audioContextInRef.current!.destination);
        } catch (err) {
          console.error("Mic access failed", err);
          setStatus('IDLE');
        }
      },
      onmessage: async (message) => {
        if (message.sessionResumptionUpdate) {
          const update = message.sessionResumptionUpdate;
          if (update.resumable && update.newHandle) {
            setResumptionHandle(update.newHandle);
          }
        }

        if (message.goAway) {
          setTimeLeft(message.goAway.timeLeft);
        }

        const base64Audio = message.serverContent?.modelTurn?.parts?.find(p => p.inlineData)?.inlineData?.data;
        if (base64Audio && audioContextOutRef.current) {
          nextStartTimeRef.current = Math.max(nextStartTimeRef.current, audioContextOutRef.current.currentTime);
          const audioBuffer = await decodeAudioData(
            decodeBase64(base64Audio),
            audioContextOutRef.current,
            24000,
            1
          );
          const source = audioContextOutRef.current.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(audioContextOutRef.current.destination);
          source.start(nextStartTimeRef.current);
          nextStartTimeRef.current += audioBuffer.duration;
          
          sourcesSetRef.current.add(source);
          source.onended = () => sourcesSetRef.current.delete(source);
        }

        if (message.serverContent?.inputTranscription) {
          const text = message.serverContent.inputTranscription.text;
          setTranscriptions(prev => {
            const last = prev[prev.length - 1];
            if (last && last.role === 'user') {
              return [...prev.slice(0, -1), { role: 'user', text: last.text + text }];
            }
            return [...prev, { role: 'user', text }];
          });
        }
        
        if (message.serverContent?.outputTranscription) {
          const text = message.serverContent.outputTranscription.text;
          setTranscriptions(prev => {
            const last = prev[prev.length - 1];
            if (last && last.role === 'model') {
              return [...prev.slice(0, -1), { role: 'model', text: last.text + text }];
            }
            return [...prev, { role: 'model', text }];
          });
        }

        if (message.toolCall) {
          const functionResponses: any[] = [];
          for (const fc of message.toolCall.functionCalls) {
            setTranscriptions(prev => [...prev, { role: 'tool', text: `Executing: ${fc.name}...` }]);
            
            let result: any = { status: "ok" };
            if (fc.name === 'get_weather') {
              result = { status: "success", temperature: "22C", condition: "Partly Cloudy" };
            } else if (fc.name === 'control_light') {
              result = { status: "success", action: `Light set to ${fc.args.brightness}% brightness` };
            }

            functionResponses.push({
              id: fc.id,
              name: fc.name,
              response: { ...result, scheduling: "INTERRUPT" }
            });
          }

          if (functionResponses.length > 0) {
            sessionPromise.then(session => session.sendToolResponse({ functionResponses }));
          }
        }

        const thoughtPart = message.serverContent?.modelTurn?.parts?.find(p => p.thought);
        if (thoughtPart && thoughtPart.text) {
          setCurrentThoughts(prev => prev + thoughtPart.text);
        }

        if (message.serverContent?.turnComplete) {
          setCurrentThoughts(""); 
        }

        if (message.serverContent?.interrupted) {
          sourcesSetRef.current.forEach(s => s.stop());
          sourcesSetRef.current.clear();
          nextStartTimeRef.current = 0;
          setCurrentThoughts("");
        }
      },
      onerror: (e) => {
        console.error("Live Error", e);
        setStatus('IDLE');
      },
      onclose: () => {
        setIsActive(false);
        setStatus('IDLE');
      }
    }, systemInstruction, {
      transcription: isTranscriptionOn,
      thinkingBudget: isThinkingOn ? 4000 : 0,
      includeThoughts: true,
      useGoogleSearch: useLiveSearch,
      activeTools: ['get_weather', 'control_light'],
      resumptionHandle: resumptionHandle || undefined,
      authToken: authToken || undefined
    });

    sessionRef.current = await sessionPromise;
  };

  const stopSession = () => {
    if (sessionRef.current) sessionRef.current.close();
    if (frameIntervalRef.current) window.clearInterval(frameIntervalRef.current);
    audioContextInRef.current?.close();
    audioContextOutRef.current?.close();
    audioContextInRef.current = null;
    audioContextOutRef.current = null;
    setIsActive(false);
    setStatus('IDLE');
    setResumptionHandle(null);
    setTimeLeft(null);
    setTokenInfo(null);
  };

  const toggleCamera = async () => {
    if (!isCameraOn) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        if (videoRef.current) videoRef.current.srcObject = stream;
        setIsCameraOn(true);
        
        frameIntervalRef.current = window.setInterval(() => {
          if (canvasRef.current && videoRef.current && sessionRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            canvasRef.current.width = 320;
            canvasRef.current.height = 240;
            ctx?.drawImage(videoRef.current, 0, 0, 320, 240);
            canvasRef.current.toBlob(async (blob) => {
              if (blob) {
                const reader = new FileReader();
                reader.onloadend = () => {
                  const base64 = (reader.result as string).split(',')[1];
                  sessionRef.current.sendRealtimeInput({
                    media: { data: base64, mimeType: 'image/jpeg' }
                  });
                };
                reader.readAsDataURL(blob);
              }
            }, 'image/jpeg', 0.5);
          }
        }, 1000 / 2); 
      } catch (err) {
        console.error("Camera access failed", err);
      }
    } else {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
      if (frameIntervalRef.current) window.clearInterval(frameIntervalRef.current);
      setIsCameraOn(false);
    }
  };

  const formatTime = (ms: number) => {
    const min = Math.floor(ms / 60000);
    const sec = Math.floor((ms % 60000) / 1000);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row bg-slate-950 overflow-hidden relative">
      <div className="flex-1 flex flex-col items-center justify-center p-8 relative">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
          <div className={`w-[600px] h-[600px] rounded-full blur-[120px] transition-all duration-1000 ${status === 'LIVE' ? (useEphemeral ? 'bg-indigo-600/10 scale-150' : 'bg-blue-600/5 scale-150') : 'scale-50 opacity-0'}`} />
        </div>

        <div className="relative w-full max-w-2xl flex flex-col items-center gap-10 z-10">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <div className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-full">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">{status} NEURAL_SESSION</span>
              </div>
              {useEphemeral && status === 'LIVE' && (
                <div className="px-3 py-1 bg-indigo-900/40 border border-indigo-400/30 rounded-full flex items-center gap-2">
                   <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="3"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                   <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">Ephemeral Security Active</span>
                </div>
              )}
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-white">Live Architect Interface</h2>
            {timeLeft && (
              <div className="mt-2 p-3 bg-red-900/20 border border-red-500/30 rounded-2xl flex items-center gap-3 animate-pulse">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                <div className="text-left">
                  <div className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Connection Refresh</div>
                  <div className="text-[9px] text-red-300 opacity-70">Server reset in: {timeLeft}</div>
                </div>
              </div>
            )}
          </div>

          <div className="relative group">
             <div className={`w-56 h-56 rounded-full border-2 flex items-center justify-center transition-all duration-700 shadow-2xl ${status === 'LIVE' ? (useEphemeral ? 'border-indigo-500/50 bg-indigo-500/5 shadow-indigo-500/20' : 'border-blue-500/50 bg-blue-500/5 shadow-blue-500/20') : 'border-slate-800 bg-slate-900 shadow-black'}`}>
                <div className={`w-28 h-28 rounded-full transition-all duration-500 flex items-center justify-center ${status === 'LIVE' ? (useEphemeral ? 'bg-indigo-600 animate-pulse scale-110 shadow-[0_0_40px_rgba(79,70,229,0.4)]' : 'bg-blue-600 animate-pulse scale-110 shadow-[0_0_40px_rgba(37,99,235,0.4)]') : 'bg-slate-800 scale-100'}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                </div>
                {status === 'LIVE' && (
                  <>
                    <div className={`absolute inset-0 rounded-full border animate-[spin_10s_linear_infinite] ${useEphemeral ? 'border-indigo-400/20' : 'border-blue-400/20'}`} />
                    <div className={`absolute inset-4 rounded-full border animate-[spin_7s_linear_infinite_reverse] ${useEphemeral ? 'border-indigo-400/10' : 'border-blue-400/10'}`} />
                  </>
                )}
             </div>
             {isCameraOn && (
               <div className="absolute -bottom-6 -right-16 w-52 h-36 bg-black rounded-2xl border-2 border-slate-800 overflow-hidden shadow-2xl animate-in zoom-in duration-300">
                 <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                 <canvas ref={canvasRef} className="hidden" />
               </div>
             )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4">
            {status === 'IDLE' ? (
              <button onClick={startSession} className={`px-8 py-4 ${useEphemeral ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-900/30' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-900/30'} text-white rounded-2xl font-bold flex items-center gap-3 transition-all active:scale-95 shadow-xl group`}>
                <div className="w-2 h-2 rounded-full bg-white group-hover:animate-ping" />
                {resumptionHandle ? 'Resume Neural Link' : 'Secure Neural Handshake'}
              </button>
            ) : (
              <>
                <button onClick={stopSession} className="px-6 py-4 bg-red-600/10 border border-red-500/50 hover:bg-red-600/20 text-red-500 rounded-2xl font-bold transition-all">
                  Disconnect
                </button>
                <div className="flex gap-2 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl">
                   <LiveControlBtn 
                     active={!isMuted} 
                     onClick={() => setIsMuted(!isMuted)} 
                     icon={isMuted ? <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg> : <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>} 
                   />
                   <LiveControlBtn 
                     active={isCameraOn} 
                     onClick={toggleCamera} 
                     icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>} 
                   />
                </div>
              </>
            )}
          </div>
          
          <div className="flex flex-wrap gap-4 justify-center">
             <LiveSettingToggle label="Ephemeral" active={useEphemeral} onClick={() => setUseEphemeral(!useEphemeral)} />
             <LiveSettingToggle label="Transcription" active={isTranscriptionOn} onClick={() => setIsTranscriptionOn(!isTranscriptionOn)} />
             <LiveSettingToggle label="Thinking" active={isThinkingOn} onClick={() => setIsThinkingOn(!isThinkingOn)} />
             <LiveSettingToggle label="Live Search" active={useLiveSearch} onClick={() => setUseLiveSearch(!useLiveSearch)} />
          </div>
        </div>
      </div>

      <div className="w-full md:w-96 border-l border-slate-800 bg-slate-900/50 flex flex-col">
        <div className="p-4 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Signal Stream</h3>
          {status === 'LIVE' && <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
        </div>

        {tokenInfo && (
          <div className="p-4 bg-indigo-950/30 border-b border-indigo-500/20">
             <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">Token Lifecycle</span>
                <span className="text-[9px] font-mono text-indigo-300">{formatTime(tokenTimeRemaining)}</span>
             </div>
             <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 transition-all duration-1000" 
                  style={{ width: `${(tokenTimeRemaining / (30 * 60000)) * 100}%` }}
                />
             </div>
          </div>
        )}
        
        <div ref={transcriptScrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth">
          {transcriptions.length === 0 && !currentThoughts && (
            <div className="h-full flex flex-col items-center justify-center text-slate-600 text-[10px] uppercase font-bold text-center p-8 space-y-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-20"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
              Waiting for Neural Interaction
            </div>
          )}

          {transcriptions.map((t, i) => (
            <div key={i} className={`flex flex-col gap-1 ${t.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-1`}>
              <span className={`text-[9px] font-bold uppercase tracking-tighter ${t.role === 'tool' ? 'text-cyan-500' : 'text-slate-500'}`}>{t.role}</span>
              <div className={`max-w-[90%] p-3 rounded-2xl text-xs leading-relaxed ${t.role === 'user' ? 'bg-blue-600 text-white' : (t.role === 'tool' ? 'bg-cyan-950/40 border border-cyan-500/30 text-cyan-200 font-mono' : 'bg-slate-800 text-slate-300 border border-slate-700')}`}>
                {t.text}
              </div>
            </div>
          ))}

          {currentThoughts && (
            <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl animate-pulse">
               <div className="flex items-center gap-2 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest">Model Reasoning</span>
               </div>
               <p className="text-[11px] text-amber-200/60 font-mono italic leading-relaxed">
                 {currentThoughts}
               </p>
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-slate-800 text-[9px] text-slate-500 uppercase font-mono flex items-center gap-2">
           <div className={`w-1.5 h-1.5 rounded-full ${status === 'LIVE' ? 'bg-green-500' : 'bg-slate-700'}`} />
           Status: {status}
           {resumptionHandle && <span className="ml-auto text-[8px] text-indigo-400">Resumable Handle Active</span>}
        </div>
      </div>
    </div>
  );
};

const LiveControlBtn = ({ active, onClick, icon }: any) => (
  <button onClick={onClick} className={`p-3 rounded-xl transition-all ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}>
    {icon}
  </button>
);

const LiveSettingToggle = ({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) => (
  <button onClick={onClick} className="flex items-center gap-2 group">
    <div className={`w-8 h-4 rounded-full relative transition-all ${active ? (label === 'Ephemeral' ? 'bg-indigo-500' : 'bg-blue-600') : 'bg-slate-800 border border-slate-700'}`}>
      <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${active ? 'left-4.5' : 'left-0.5'}`} />
    </div>
    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest group-hover:text-slate-300 transition-colors">{label}</span>
  </button>
);

export default LiveInterface;
