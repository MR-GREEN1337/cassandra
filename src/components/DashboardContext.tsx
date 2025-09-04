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
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    const allSessions = saved ? JSON.parse(saved) : {};
    
    const validSessions = Object.entries(allSessions).reduce((acc, [key, value]) => {
        if (value && typeof value === 'object' && 'id' in value) {
            acc[key] = value as Session;
        }
        return acc;
    }, {} as { [id: string]: Session });

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

  // --- FIX START ---
  const newSession = useCallback(() => {
    const id = `s_${Date.now()}`;
    const initialNodes: Node[] = [{ id: '1', type: 'pitchNode', position: { x: 250, y: 100 }, data: { pitch: '', response: null, isLoading: false }, }];
    const newSessionData: Session = { id, name: 'New Session', createdAt: Date.now(), nodes: initialNodes, edges: [] };
    
    // Directly set the UI state to the new session's data
    setNodes(newSessionData.nodes);
    setEdges(newSessionData.edges);
    setActiveSessionId(id);
    
    // Then, update the sessions map. This avoids the race condition.
    setSessions(prevSessions => ({
      ...prevSessions,
      [id]: newSessionData
    }));
  }, []); // Dependencies are no longer needed
  
  const deleteSession = useCallback((id: string) => {
    setSessions(prevSessions => {
      const { [id]: _, ...remainingSessions } = prevSessions;
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(remainingSessions));
      
      if (activeSessionId === id) {
        const nextSessionToLoad = Object.values(remainingSessions).sort((a, b) => b.createdAt - a.createdAt)[0];

        if (nextSessionToLoad) {
          // If another session exists, load it directly
          setNodes(nextSessionToLoad.nodes);
          setEdges(nextSessionToLoad.edges);
          setActiveSessionId(nextSessionToLoad.id);
        } else {
          // If no sessions are left, create a new one from scratch
          const newId = `s_${Date.now()}`;
          const initialNodes: Node[] = [{ id: '1', type: 'pitchNode', position: { x: 250, y: 100 }, data: { pitch: '', response: null, isLoading: false }, }];
          const newSessionData: Session = { id: newId, name: 'New Session', createdAt: Date.now(), nodes: initialNodes, edges: [] };
          
          setNodes(newSessionData.nodes);
          setEdges(newSessionData.edges);
          setActiveSessionId(newSessionData.id);
          
          return { [newId]: newSessionData }; // Return the new session map
        }
      }
      return remainingSessions;
    });
  }, [activeSessionId]);
  // --- FIX END ---
  
  const value = { sessions, activeSessionId, nodes, setNodes, edges, setEdges, loadSession, newSession, deleteSession };

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
};