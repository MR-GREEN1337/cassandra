// --- FILE: src/components/DashboardContext.tsx ---
"use client";

import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import { Node, Edge } from 'reactflow';
import { useDebounce } from '@/hooks/use-debounce';

const LOCAL_STORAGE_KEY = 'cassandra-sessions-v2';

export interface Session { id: string; name: string; createdAt: number; nodes: Node[]; edges: Edge[]; }

interface DashboardContextType {
  sessions: { [id: string]: Session };
  activeSessionId: string | null;
  nodes: Node[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  edges: Edge[];
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  loadSession: (id: string) => void;
  newSession: () => void;
  deleteSession: (id: string) => void;
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
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  const debouncedNodes = useDebounce(nodes, 500);
  const debouncedEdges = useDebounce(edges, 500);
  
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
      const initialNodes: Node[] = [{ id: '1', type: 'pitchNode', position: { x: 250, y: 100 }, data: { pitch: decodedPitch, response: null, isLoading: false }, }];
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
      const initialNodes: Node[] = [{ id: '1', type: 'pitchNode', position: { x: 250, y: 100 }, data: { pitch: '', response: null, isLoading: false }, }];
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

  const saveSession = useCallback((currentNodes: Node[], currentEdges: Edge[], sessionId: string | null) => {
    if (!sessionId) return;
    setSessions(prevSessions => {
      if (!prevSessions[sessionId]) { return prevSessions; }
      let sessionName = "Untitled Session";
      if (currentNodes.length > 0 && currentNodes[0].data.pitch) {
        sessionName = currentNodes[0].data.pitch.substring(0, 40).trim() || "Untitled Session";
      }
      const updatedSession: Session = { ...prevSessions[sessionId], name: sessionName, nodes: currentNodes, edges: currentEdges };
      const updatedSessions = { ...prevSessions, [sessionId]: updatedSession };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedSessions));
      return updatedSessions;
    });
  }, []);

  useEffect(() => {
    if (activeSessionId && (debouncedNodes.length > 0 || debouncedEdges.length > 0)) {
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
    const initialNodes: Node[] = [{ id: '1', type: 'pitchNode', position: { x: 250, y: 100 }, data: { pitch: '', response: null, isLoading: false }, }];
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
          const initialNodes: Node[] = [{ id: '1', type: 'pitchNode', position: { x: 250, y: 100 }, data: { pitch: '', response: null, isLoading: false }, }];
          const newSessionData: Session = { id: newId, name: 'New Session', createdAt: Date.now(), nodes: initialNodes, edges: [] };
          
          setNodes(newSessionData.nodes);
          setEdges(newSessionData.edges);
          setActiveSessionId(newSessionData.id);
          
          return { [newId]: newSessionData };
        }
      }
      return remainingSessions;
    });
  }, [activeSessionId]);
  
  const value = { sessions, activeSessionId, nodes, setNodes, edges, setEdges, loadSession, newSession, deleteSession };

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
};