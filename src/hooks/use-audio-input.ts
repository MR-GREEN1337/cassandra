// src/hooks/use-audio-input.ts
'use client';

import { useState, useEffect, useRef } from 'react';

// Type guard for SpeechRecognition
interface CustomWindow extends Window {
  SpeechRecognition: any;
  webkitSpeechRecognition: any;
}

export function useAudioInput(
  onFinalTranscript: (transcript: string) => void,
  onInterimTranscript: (transcript: string) => void
) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    //@ts-expect-error
    const SpeechRecognition = (window as CustomWindow).SpeechRecognition || (window as CustomWindow).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        onFinalTranscript(finalTranscript);
      }
      if (interimTranscript) {
        onInterimTranscript(interimTranscript);
      }
    };
    
    recognition.onerror = (event: any) => {
        setError(`Speech recognition error: ${event.error}`);
        setIsListening(false);
    };
    
    recognition.onend = () => {
        if (recognitionRef.current) {
          setIsListening(false);
        }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, [onFinalTranscript, onInterimTranscript]);

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        setError(null);
      } catch (err) {
        setError("Could not start recognition. Please check microphone permissions.");
        setIsListening(false);
      }
    }
  };

  return { isListening, toggleListening, error };
}