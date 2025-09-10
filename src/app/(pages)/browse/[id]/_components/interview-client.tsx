// --- FILE: src/app/(pages)/browse/[id]/_components/interview-client.tsx ---
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowUp, Bot, Loader2, Sparkles, User } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { FaviconLink } from '@/components/FaviconLink';
import { StartupFailure } from '@/generated/prisma';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const markdownRenderers = {
  a: (props: any) => <FaviconLink href={props.href}>{props.children}</FaviconLink>,
};

export function InterviewClientPage({ startup }: { startup: StartupFailure }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `I've reviewed the internal report on **${startup.companyName}**. What specific questions do you have about their failure?`,
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [agentStatus, setAgentStatus] = useState('');
  
  // --- MODIFICATION START: Use a ref for the scroll viewport ---
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (scrollViewportRef.current) {
      // Use requestAnimationFrame for smoother scrolling after render
      requestAnimationFrame(() => {
        if (scrollViewportRef.current) {
            scrollViewportRef.current.scrollTop = scrollViewportRef.current.scrollHeight;
        }
      });
    }
  }, [messages, agentStatus]);
  // --- MODIFICATION END ---

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const newMessages: Message[] = [...messages, { role: 'user', content: input }];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    setAgentStatus('Searching internal notes...');
    await new Promise(res => setTimeout(res, 900));
    setAgentStatus('Consulting web sources for additional context...');

    try {
      const response = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startupId: startup.id, messages: newMessages.filter(m => m.role !== 'system'), }),
      });

      setAgentStatus('');

      if (!response.ok || !response.body) { throw new Error(`API error: ${response.statusText}`); }

      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const lastMessage = prev[prev.length - 1];
          if (lastMessage.role === 'assistant') {
            const updatedLastMessage = { ...lastMessage, content: lastMessage.content + chunk };
            return [...prev.slice(0, -1), updatedLastMessage];
          }
          return prev;
        });
      }
    } catch (error) {
      console.error('Failed to get response:', error);
      setMessages((prev) => [...prev, { role: 'assistant', content: "Sorry, I encountered an error. Please try again." }]);
    } finally {
      setIsLoading(false);
      setAgentStatus('');
    }
  };

  return (
    // --- MODIFICATION START: Add `relative` to the main container ---
    <div className="flex-1 flex flex-col overflow-hidden relative">
    {/* --- MODIFICATION END --- */}

      {/* --- MODIFICATION START: Pass the ref to the ScrollArea's viewport --- */}
      <ScrollArea className="flex-1" ref={scrollViewportRef}>
        {/* --- MODIFICATION START: Add padding-bottom to prevent content from being hidden by the absolute footer --- */}
        <div className="container mx-auto max-w-3xl px-4 pt-8 pb-28">
        {/* --- MODIFICATION END --- */}
          <div className="space-y-6">
            {messages.map((msg, index) => (
              <div key={index} className={cn('flex items-start gap-3 w-full', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className={cn(msg.role === 'user' ? 'bg-secondary text-secondary-foreground' : 'bg-primary text-primary-foreground')}>
                    {msg.role === 'user' ? <User size={16} /> : <Sparkles size={16} />}
                  </AvatarFallback>
                </Avatar>
                <div className={cn('max-w-xl p-3 rounded-lg prose prose-sm dark:prose-invert prose-p:my-1', msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                  <ReactMarkdown components={markdownRenderers}>{msg.content}</ReactMarkdown>
                </div>
              </div>
            ))}
            {agentStatus && (
               <div className='flex items-start gap-3 w-full flex-row'>
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className='bg-primary text-primary-foreground'>
                      <Loader2 size={16} className="animate-spin" />
                    </AvatarFallback>
                  </Avatar>
                  <div className='max-w-xl p-3 rounded-lg bg-muted text-sm text-muted-foreground italic'>
                    {agentStatus}
                  </div>
               </div>
            )}
          </div>
        </div>
      </ScrollArea>
      
      {/* --- MODIFICATION START: Position the footer absolutely within the relative parent --- */}
      <footer className="absolute bottom-0 left-0 right-0 z-10">
      {/* --- MODIFICATION END --- */}
        <div className="w-full bg-gradient-to-t from-background via-background/90 to-transparent">
          <div className="container mx-auto max-w-3xl p-4">
            <form onSubmit={handleSubmit} className="relative">
              <div className="relative">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); }
                  }}
                  placeholder={`Ask a question about ${startup.companyName}...`}
                  className="pr-14 pl-4 min-h-[52px] bg-background/80 backdrop-blur-sm border-2 shadow-lg text-base"
                  rows={1}
                  disabled={isLoading}
                />
                <Button type="submit" size="icon" className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9" disabled={isLoading || !input.trim()}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </footer>
    </div>
  );
}