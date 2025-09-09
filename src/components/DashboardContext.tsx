// --- FILE: src/components/DashboardContext.tsx ---
"use client";

import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import { Node, Edge } from 'reactflow';
import { useDebounce } from '@/hooks/use-debounce';

const LOCAL_STORAGE_KEY = 'cassandra-sessions-v2';

// --- NEW TYPES FOR STRUCTURED RISK DATA ---
export interface Risk {
  risk_name: string;
  score: number;
  summary: string;
}

export interface PitchNodeData {
  pitch: string;
  response?: string | null;
  structuredResponse?: { risk_analysis: Risk[] } | null; // <-- ADDED: For risk scorecard data
  isLoading: boolean;
  contextTitle?: string;
  // These function types are simplified for context definition; their implementation is in the page
  onAnalysis: (nodeId: string, pitch: string, file: File | null) => void;
  createFollowUpNode: (text: string, sourceId: string) => void;
  parentId?: string; // Add parentId to track conversational context
}

// Define a specific Node type for our app
export type CassandraNode = Node<PitchNodeData>;
// --- END OF NEW TYPES ---

export interface Session { 
  id: string; 
  name: string; 
  createdAt: number; 
  nodes: CassandraNode[]; // Use the specific node type
  edges: Edge[]; 
}

interface DashboardContextType {
  sessions: { [id: string]: Session };
  activeSessionId: string | null;
  nodes: CassandraNode[]; // Use the specific node type
  setNodes: React.Dispatch<React.SetStateAction<CassandraNode[]>>;
  edges: Edge[];
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  loadSession: (id: string) => void;
  newSession: () => void;
  deleteSession: (id: string) => void;
  renameSession: (id: string, newName: string) => void;
  forkSession: (id: string) => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
};

export const DashboardProvider = ({ children }: { children: ReactNode }) => {
  const [sessions, setSessions] = useState<{ [id: string]: Session }>({});
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<CassandraNode[]>([]); // Use the specific node type
  const [edges, setEdges] = useState<Edge[]>([]);

  const debouncedNodes = useDebounce(nodes, 500);
  const debouncedEdges = useDebounce(edges, 500);
  
  // The rest of this component is identical to your original version
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const pitchFromUrl = searchParams.get('pitch');
    
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    const allSessions = saved ? JSON.parse(saved) : {};
    
    const validSessions = Object.entries(allSessions).reduce((acc, [key, value]) => {
        if (value && typeof value === 'object' && 'id' in value) {
            acc[key] = value as Session;
        }
        return acc;
    }, {} as { [id: string]: Session });

    if (pitchFromUrl) {
      const decodedPitch = decodeURIComponent(pitchFromUrl);
      const id = `s_${Date.now()}`;
      const initialNodes: CassandraNode[] = [{ id: '1', type: 'pitchNode', position: { x: 250, y: 100 }, data: { pitch: decodedPitch, response: null, isLoading: false, onAnalysis: () => {}, createFollowUpNode: () => {} }, }];
      const sessionName = decodedPitch.substring(0, 40).trim() || "Untitled Session";
      const newSessionData: Session = { id, name: sessionName, createdAt: Date.now(), nodes: initialNodes, edges: [] };

      const updatedSessions = { ...validSessions, [id]: newSessionData };
      setNodes(newSessionData.nodes);
      setEdges(newSessionData.edges);
      setActiveSessionId(id);
      setSessions(updatedSessions);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedSessions));
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    const recentId = Object.values(validSessions).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0]?.id;

    if (recentId) {
      const sessionToLoad = validSessions[recentId];
      setNodes(sessionToLoad.nodes);
      setEdges(sessionToLoad.edges);
      setActiveSessionId(recentId);
    } else {
      const id = `s_${Date.now()}`;
      const initialNodes: CassandraNode[] = [{ id: '1', type: 'pitchNode', position: { x: 250, y: 100 }, data: { pitch: '', response: null, isLoading: false, onAnalysis: () => {}, createFollowUpNode: () => {} }, }];
      const newSessionData: Session = { id, name: 'New Session', createdAt: Date.now(), nodes: initialNodes, edges: [] };
      const updatedSessions = { ...validSessions, [id]: newSessionData };
      setNodes(newSessionData.nodes);
      setEdges(newSessionData.edges);
      setActiveSessionId(id);
      setSessions(updatedSessions);
      return;
    }
    setSessions(validSessions);
  }, []);

  const saveSession = useCallback((currentNodes: CassandraNode[], currentEdges: Edge[], sessionId: string | null) => {
    if (!sessionId) return;
    setSessions(prevSessions => {
      const existingSession = prevSessions[sessionId];
      if (!existingSession) { return prevSessions; }

      // Only auto-rename if it's the default "New Session" name
      let sessionName = existingSession.name;
      if (sessionName === 'New Session' && currentNodes.length > 0 && currentNodes[0].data.pitch) {
        sessionName = currentNodes[0].data.pitch.substring(0, 40).trim() || "Untitled Session";
      }

      const updatedSession: Session = { ...existingSession, name: sessionName, nodes: currentNodes, edges: currentEdges };
      const updatedSessions = { ...prevSessions, [sessionId]: updatedSession };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedSessions));
      return updatedSessions;
    });
  }, []);

  useEffect(() => {
    if (activeSessionId) {
      saveSession(debouncedNodes, debouncedEdges, activeSessionId);
    }
  }, [debouncedNodes, debouncedEdges, activeSessionId, saveSession]);

  const loadSession = useCallback((id: string) => {
    const sessionToLoad = sessions[id];
    if (sessionToLoad) {
      setNodes(sessionToLoad.nodes);
      setEdges(sessionToLoad.edges);
      setActiveSessionId(id);
    } else {
      console.error(`Attempted to load a session that does not exist: ${id}`);
    }
  }, [sessions]);

  const newSession = useCallback(() => {
    const id = `s_${Date.now()}`;
    const initialNodes: CassandraNode[] = [{ id: '1', type: 'pitchNode', position: { x: 250, y: 100 }, data: { pitch: '', response: null, isLoading: false, onAnalysis: () => {}, createFollowUpNode: () => {} }, }];
    const newSessionData: Session = { id, name: 'New Session', createdAt: Date.now(), nodes: initialNodes, edges: [] };
    
    setNodes(newSessionData.nodes);
    setEdges(newSessionData.edges);
    setActiveSessionId(id);
    
    setSessions(prevSessions => {
      const updatedSessions = { ...prevSessions, [id]: newSessionData };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedSessions));
      return updatedSessions;
    });
  }, []);
  
  const deleteSession = useCallback((id: string) => {
    setSessions(prevSessions => {
      const { [id]: _, ...remainingSessions } = prevSessions;
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(remainingSessions));
      
      if (activeSessionId === id) {
        const nextSessionToLoad = Object.values(remainingSessions).sort((a, b) => b.createdAt - a.createdAt)[0];

        if (nextSessionToLoad) {
          setNodes(nextSessionToLoad.nodes);
          setEdges(nextSessionToLoad.edges);
          setActiveSessionId(nextSessionToLoad.id);
        } else {
          const newId = `s_${Date.now()}`;
          const initialNodes: CassandraNode[] = [{ id: '1', type: 'pitchNode', position: { x: 250, y: 100 }, data: { pitch: '', response: null, isLoading: false, onAnalysis: () => {}, createFollowUpNode: () => {} }, }];
          const newSessionData: Session = { id: newId, name: 'New Session', createdAt: Date.now(), nodes: initialNodes, edges: [] };
          
          setNodes(newSessionData.nodes);
          setEdges(newSessionData.edges);
          setActiveSessionId(newSessionData.id);
          const finalSessions = { [newId]: newSessionData };
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(finalSessions));
          return finalSessions;
        }
      }
      return remainingSessions;
    });
  }, [activeSessionId]);
  
  const renameSession = useCallback((id: string, newName: string) => {
    setSessions(prev => {
        if (!prev[id]) return prev;
        const updatedSession = { ...prev[id], name: newName };
        const newSessions = { ...prev, [id]: updatedSession };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newSessions));
        return newSessions;
    });
  }, []);

  const forkSession = useCallback((id: string) => {
    const sourceSession = sessions[id];
    if (!sourceSession) return;

    const newId = `s_${Date.now()}`;
    // Deep copy nodes and edges to prevent reference issues
    const newSessionData: Session = {
        id: newId,
        name: `Copy of ${sourceSession.name}`,
        createdAt: Date.now(),
        nodes: JSON.parse(JSON.stringify(sourceSession.nodes)),
        edges: JSON.parse(JSON.stringify(sourceSession.edges)),
    };

    setSessions(prev => {
        const newSessions = { ...prev, [newId]: newSessionData };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newSessions));
        return newSessions;
    });
    
    // Automatically switch to the new session
    loadSession(newId);
  }, [sessions, loadSession]);


  const value = { sessions, activeSessionId, nodes, setNodes, edges, setEdges, loadSession, newSession, deleteSession, renameSession, forkSession };

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
};