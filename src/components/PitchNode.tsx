// --- FILE: src/components/PitchNode.tsx ---
"use client";

import React, { useState, useEffect, useRef, FC } from 'react';
import Image from 'next/image';
import { Handle, Position, Node, NodeProps } from 'reactflow';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { ArrowRight, Plus, Loader2, SendHorizonal, Paperclip, X, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAudioInput } from '@/hooks/use-audio-input';

// --- NEW: Custom renderer for Markdown links to show favicons ---
const MarkdownLinkRenderer: FC<React.PropsWithChildren<any>> = ({ href, children }) => {
  try {
    const hostname = new URL(href).hostname;
    // Use a public favicon service for simplicity and to avoid CORS issues.
    const faviconUrl = `https://www.google.com/s2/favicons?sz=32&domain_url=${hostname}`;

    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 not-prose font-medium hover:underline decoration-amber-500/50"
      >
        <Image 
          src={faviconUrl} 
          alt={`${hostname} favicon`} 
          width={16} 
          height={16} 
          className="flex-shrink-0 rounded-sm" 
          unoptimized // Recommended for external, dynamic URLs
        />
        <span>{children}</span>
      </a>
    );
  } catch (error) {
    // Fallback for invalid URLs (e.g., relative links)
    return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
  }
};

interface PitchNodeData {
  pitch: string;
  response?: string | null;
  isLoading: boolean;
  contextTitle?: string;
  onAnalysis: (nodeId: string, pitch: string, file: File | null) => void;
  createFollowUpNode: (text: string, sourceId: string) => void;
}

const PitchNode: React.FC<NodeProps<PitchNodeData>> = (node) => {
  const { id, data } = node;
  const [currentPitch, setCurrentPitch] = useState(data.pitch || '');
  const [file, setFile] = useState<File | null>(null);
  // --- MODIFICATION START: Initialize editing state based on incoming prop ---
  const [isEditing, setIsEditing] = useState(!!data.pitch);
  // --- MODIFICATION END ---
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTranscript = (transcript: string) => {
    setCurrentPitch(prev => prev + transcript + ' ');
    setIsEditing(true);
  };

  const { isListening, toggleListening, error } = useAudioInput(handleTranscript);

  // This hook ensures that if the node's data is updated from outside
  // (e.g., loading a different session), the component's state reflects that change.
  useEffect(() => {
    setCurrentPitch(data.pitch || '');
    // If we get a new pitch, assume we want to see it.
    if (data.pitch) {
      setIsEditing(true);
    }
  }, [data.pitch]);


  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.style.height = 'auto';
      textAreaRef.current.style.height = `${textAreaRef.current.scrollHeight}px`;
    }
  }, [currentPitch, data.response]);

  useEffect(() => {
    if (isEditing) {
      textAreaRef.current?.focus();
    }
  }, [isEditing]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((currentPitch.trim() || file) && !data.isLoading) {
      setIsEditing(false);
      data.onAnalysis(id, currentPitch, file);
    }
  };

  const isAnalysisComplete = !data.isLoading && data.response && data.response.length > 0;
  const hasAnalysisStarted = data.isLoading || !!data.response;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl w-[500px] text-black dark:text-white flex flex-col"
    >
      <Handle type="target" position={Position.Top} className="!w-full !h-2 !-top-1 !bg-transparent !border-none" />

      <div className="flex items-center justify-between p-3 border-b border-zinc-200 dark:border-zinc-700 flex-shrink-0">
          <div className="flex items-center gap-2">
              <Image src="/kimi.png" alt="Kimi Logo" width={20} height={20}/>
              <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Kimi K2 Turbo</span>
          </div>
          <button className="p-1 rounded-md text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" title="New Chat (coming soon)">
              <Plus size={16} />
          </button>
      </div>

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
                  <textarea ref={textAreaRef} value={currentPitch} onChange={(e) => setCurrentPitch(e.target.value)} onBlur={() => { if (!currentPitch) setIsEditing(false); }} className="w-full bg-transparent border-none p-0 pt-2 text-sm focus:outline-none focus:ring-0 resize-none overflow-hidden" rows={1}/>
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
                <button
                  type="button"
                  onClick={toggleListening}
                  className={cn(
                    "p-2 rounded-full transition-colors",
                    isListening ? "bg-red-500/20 text-red-500 animate-pulse" : "text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  )}
                  title="Record Audio"
                >
                    <Mic size={16} />
                </button>
                {file && (
                  <div className="flex items-center gap-2 text-xs bg-zinc-100 dark:bg-zinc-800 rounded-full px-3 py-1 w-fit animate-in fade-in-50">
                    <Paperclip size={12} className="text-zinc-500"/>
                    <span className="text-zinc-700 dark:text-zinc-300 max-w-48 truncate">{file.name}</span>
                    <button type="button" onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="ml-1 p-0.5 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700">
                      <X size={12}/>
                    </button>
                  </div>
                )}
              </div>
               {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
          </form>
        )}

        {hasAnalysisStarted && (
            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-700">
                {data.isLoading && !data.response && (
                    <div className="flex items-center gap-2 text-zinc-500">
                      <Loader2 size={16} className="animate-spin" />
                      <span>Analyzing...</span>
                    </div>
                )}
                <div className="prose prose-sm dark:prose-invert prose-p:text-zinc-700 dark:prose-p:text-zinc-300 prose-headings:text-zinc-800 dark:prose-headings:text-zinc-200 prose-strong:text-zinc-800 dark:prose-strong:text-zinc-200 prose-a:text-amber-600 dark:prose-a:text-amber-400 selection:bg-amber-500/30">
                  <ReactMarkdown components={{ a: MarkdownLinkRenderer }}>
                    {data.response || ''}
                  </ReactMarkdown>
                  {data.isLoading && data.response && <span className="inline-block w-2 h-4 bg-zinc-500 animate-pulse ml-1 rounded-sm" />}
                </div>
            </div>
        )}
      </div>

      <div className="h-14 flex-shrink-0">
        <AnimatePresence>
            {isAnalysisComplete && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="border-t border-zinc-200 dark:border-zinc-700 flex items-center justify-center p-2">
                    <button onClick={() => data.createFollowUpNode("New follow-up...", id)} className="p-2 rounded-full text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all hover:scale-110 active:scale-95" title="Branch Idea">
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