// --- FILE: src/components/PitchNode.tsx ---
"use client";

import React, { useState, useEffect, useRef, FC } from 'react';
import Image from 'next/image';
import { Handle, Position, NodeProps } from 'reactflow';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { ArrowRight, Plus, Loader2, SendHorizonal, Paperclip, X, Mic, AlertTriangle, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAudioInput } from '@/hooks/use-audio-input';
import { PitchNodeData, Risk } from './DashboardContext';
// WINNING DETAIL: Import the new reusable FaviconLink component.
import { FaviconLink } from './FaviconLink';
import { toast } from 'sonner';

// --- Custom renderer for Markdown links now uses our reusable component ---
// WINNING DETAIL: This refactor simplifies the renderer and ensures visual consistency across the app.
const MarkdownLinkRenderer: FC<React.PropsWithChildren<any>> = ({ href, children }) => {
  return (
    <FaviconLink href={href} className="not-prose">
      {children}
    </FaviconLink>
  );
};

// --- Risk Scorecard Component (No changes here) ---
const RiskScorecard: FC<{ analysis: { risk_analysis: Risk[] } }> = ({ analysis }) => {
  // ... (rest of the component is the same as before)
  if (!analysis?.risk_analysis?.length) return null;

  const getRiskColor = (score: number) => {
    if (score >= 8) return 'bg-red-500';
    if (score >= 5) return 'bg-amber-500';
    return 'bg-green-500';
  };

  return (
    <div className="space-y-4 my-4">
      <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        Primary Risks Identified
      </h3>
      <div className="space-y-3">
        {analysis.risk_analysis.map((risk, index) => (
          <motion.div
            key={risk.risk_name}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            className="text-xs"
          >
            <div className="flex justify-between items-center mb-1">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">{risk.risk_name}</span>
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">{risk.score}/10</span>
            </div>
            <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-1.5">
              <div
                className={cn("h-1.5 rounded-full", getRiskColor(risk.score))}
                style={{ width: `${risk.score * 10}%` }}
              />
            </div>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1.5">{risk.summary}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

const loadingSteps = [
    "Performing broad hybrid search...",
    "Reflecting on initial findings...",
    "Executing refined search against TiDB...",
    "Synthesizing final analysis...",
    "Finalizing citations...",
];

const PitchNode: React.FC<NodeProps<PitchNodeData>> = (node) => {
  const { id, data } = node;
  const [committedPitch, setCommittedPitch] = useState(data.pitch || '');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isEditing, setIsEditing] = useState(!data.pitch);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loadingMessage, setLoadingMessage] = useState(loadingSteps[0]);
  
  const currentPitch = (committedPitch.trim() ? committedPitch.trim() + ' ' : '') + liveTranscript;

  const handleFinalTranscript = (transcript: string) => {
    setCommittedPitch(prev => (prev.trim() ? prev.trim() + ' ' : '') + transcript.trim());
    setLiveTranscript('');
  };

  const handleInterimTranscript = (transcript: string) => {
    setLiveTranscript(transcript);
  };

  const { isListening, toggleListening, error } = useAudioInput(
    handleFinalTranscript,
    handleInterimTranscript
  );

  useEffect(() => {
    setCommittedPitch(data.pitch || '');
    if (data.pitch) setIsEditing(!!data.pitch && !data.response);
  }, [data.pitch, data.response]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isListening) {
      toggleListening();
    }
    setLiveTranscript('');
    setCommittedPitch(e.target.value);
  };


  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.style.height = 'auto';
      textAreaRef.current.style.height = `${textAreaRef.current.scrollHeight}px`;
    }
  }, [currentPitch, data.response]);

  useEffect(() => {
    if (isEditing) textAreaRef.current?.focus();
  }, [isEditing]);
  
  useEffect(() => {
    if (data.isLoading && !data.response && !data.structuredResponse) {
      let step = 0;
      setLoadingMessage(loadingSteps[0]); // Reset to first step
      const interval = setInterval(() => {
        step = (step + 1) % loadingSteps.length;
        setLoadingMessage(loadingSteps[step]);
      }, 1800);

      return () => clearInterval(interval);
    }
  }, [data.isLoading, data.response, data.structuredResponse]);


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) setFile(event.target.files[0]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalPitch = (committedPitch.trim() ? committedPitch.trim() + ' ' : '') + liveTranscript.trim();
    if ((finalPitch.trim() || file) && !data.isLoading) {
      setIsEditing(false);
      data.onAnalysis(id, finalPitch.trim(), file);
      setLiveTranscript('');
      // Update the committed pitch to reflect the submitted value
      setCommittedPitch(finalPitch.trim());
    }
  };

  // --- MODIFICATION START: New handler for copying content ---
  const handleCopyContent = async () => {
    if (data.isLoading || !data.response) return;

    let contentToCopy = `PITCH:\n"${data.pitch}"\n\n`;

    if (data.structuredResponse?.risk_analysis) {
        contentToCopy += "--- PRIMARY RISKS IDENTIFIED ---\n";
        data.structuredResponse.risk_analysis.forEach(risk => {
            contentToCopy += `\n[Risk: ${risk.risk_name} | Score: ${risk.score}/10]\n`;
            contentToCopy += `Summary: ${risk.summary}\n`;
        });
    }

    if (data.response) {
        contentToCopy += "\n--- DETAILED ANALYSIS ---\n";
        // A simple regex to strip markdown links for a cleaner text copy
        const cleanResponse = data.response.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
        contentToCopy += cleanResponse;
    }

    try {
        await navigator.clipboard.writeText(contentToCopy.trim());
        toast.success("Analysis copied to clipboard!");
    } catch (err) {
        console.error("Failed to copy content to clipboard:", err);
        toast.error("Could not copy content.");
    }
  };
  // --- MODIFICATION END ---

  const isAnalysisComplete = !data.isLoading && data.response && data.response.length > 0;
  const hasAnalysisStarted = data.isLoading || !!data.response || !!data.structuredResponse;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl w-[500px] text-black dark:text-white flex flex-col"
    >
      <Handle type="target" position={Position.Top} className="!w-full !h-2 !-top-1 !bg-transparent !border-none" />

      {/* --- MODIFICATION START: Update the header button --- */}
      <div className="flex items-center justify-between p-3 border-b border-zinc-200 dark:border-zinc-700 flex-shrink-0">
          <div className="flex items-center gap-2">
              <Image src="/kimi.png" alt="Kimi Logo" width={20} height={20}/>
              <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Kimi K2 Turbo</span>
          </div>
          <button 
            onClick={handleCopyContent}
            disabled={!isAnalysisComplete}
            className="p-1 rounded-md text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
            title={isAnalysisComplete ? "Copy Analysis" : "Analysis must be complete to copy"}
          >
              <Copy size={16} />
          </button>
      </div>
      {/* --- MODIFICATION END --- */}

      {data.contextTitle && (
          <div className="flex items-center gap-2 p-3 border-b border-zinc-200 dark:border-zinc-700 text-xs text-zinc-500 dark:text-zinc-400 flex-shrink-0">
              <ArrowRight size={14} className="shrink-0" />
              <span className="truncate">{data.contextTitle}</span>
          </div>
      )}

      <div className="p-4 space-y-4">
        {hasAnalysisStarted ? (
          <div>
            {file && (
              <div className="mb-2 flex items-center gap-2 text-xs bg-zinc-100 dark:bg-zinc-800 rounded-full px-3 py-1 w-fit">
                <Paperclip size={12} className="text-zinc-500"/>
                <span className="text-zinc-700 dark:text-zinc-300">{file.name}</span>
              </div>
            )}
            <p className="text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap">{currentPitch}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col">
            <div className="relative">
              <div className="min-h-[60px]" onClick={() => setIsEditing(true)}>
                {isEditing || currentPitch ? (
                  <textarea ref={textAreaRef} value={currentPitch} onChange={handleTextChange} onBlur={() => { if (!currentPitch) setIsEditing(false); }} className="w-full bg-transparent border-none p-0 pt-2 text-sm focus:outline-none focus:ring-0 resize-none overflow-hidden" rows={1}/>
                ) : (
                  <p className="text-zinc-500 dark:placeholder-zinc-400 cursor-text absolute top-2 left-0">
                    Describe your startup idea, or attach a file...
                  </p>
                )}
              </div>
              <button type="submit" className="absolute top-2 right-0 p-2 rounded-full text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50" disabled={!((currentPitch || '').trim() || file) || data.isLoading} title="Send Prompt">
                <SendHorizonal size={16}/>
              </button>
            </div>
            
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-1">
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 rounded-full text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700" title="Attach File">
                  <Paperclip size={16}/>
                </button>
                <button type="button" onClick={toggleListening} className={cn("p-2 rounded-full transition-colors", isListening ? "bg-red-500/20 text-red-500 animate-pulse" : "text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700")} title="Record Audio">
                    <Mic size={16} />
                </button>
                {file && (
                  <div className="flex items-center gap-2 text-xs bg-zinc-100 dark:bg-zinc-800 rounded-full px-3 py-1 w-fit animate-in fade-in-50">
                    <Paperclip size={12} className="text-zinc-500"/>
                    <span className="text-zinc-700 dark:text-zinc-300 max-w-48 truncate">{file.name}</span>
                    <button type="button" onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="ml-1 p-0.5 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700"><X size={12}/></button>
                  </div>
                )}
              </div>
               {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
          </form>
        )}

        {hasAnalysisStarted && (
            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-700">
                {data.isLoading && !data.response && !data.structuredResponse && (
                    <div className="flex items-center gap-2 text-zinc-500 text-sm">
                      <Loader2 size={16} className="animate-spin" />
                      <span>{loadingMessage}</span>
                    </div>
                )}
                
                {data.structuredResponse && <RiskScorecard analysis={data.structuredResponse} />}
                
                <div className="prose prose-sm dark:prose-invert prose-p:text-zinc-700 dark:prose-p:text-zinc-300 prose-headings:text-zinc-800 dark:prose-headings:text-zinc-200 prose-strong:text-zinc-800 dark:prose-strong:text-zinc-200 prose-a:text-amber-600 dark:prose-a:text-amber-400 selection:bg-amber-500/30">
                  <ReactMarkdown components={{ a: MarkdownLinkRenderer }}>
                    {data.response || ''}
                  </ReactMarkdown>
                  {data.isLoading && (data.response || data.structuredResponse) && <span className="inline-block w-2 h-4 bg-zinc-500 animate-pulse ml-1 rounded-sm" />}
                </div>
            </div>
        )}
      </div>

      <div className="h-14 flex-shrink-0">
        <AnimatePresence>
            {isAnalysisComplete && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="border-t border-zinc-200 dark:border-zinc-700 flex items-center justify-center p-2">
                    <button onClick={() => data.createFollowUpNode("Drill down on this risk...", id)} className="p-2 rounded-full text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all hover:scale-110 active:scale-95" title="Branch Idea">
                        <Plus size={20} />
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
      </div>

      <Handle type="source" position={Position.Bottom} className="!w-full !h-2 !-bottom-1 !bg-transparent !border-none" />
    </motion.div>
  );
};

export default PitchNode;