// --- FILE: src/app/(pages)/dashboard/page.tsx ---
"use client";

import React, { useCallback, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  OnConnect,
  ReactFlowProvider,
  MiniMap,
  BackgroundVariant,
  SmoothStepEdge,
  Edge,
  useReactFlow
} from 'reactflow';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';
import { BrainCircuit } from 'lucide-react';
import { useDashboard, CassandraNode } from '@/components/DashboardContext';
import PitchNode from '@/components/PitchNode';
import { Button } from '@/components/ui/button';

import 'reactflow/dist/style.css';

function CanvasController() {
  const { fitView } = useReactFlow();
  const { nodes, activeSessionId } = useDashboard();

  useEffect(() => {
    const isStreaming = nodes.some(node => node.data.isLoading);
    if (isStreaming) {
      fitView({ duration: 800, padding: 0.2 });
    }
  }, [nodes, fitView]);

  useEffect(() => {
    if (nodes.length > 0) {
      const firstNode = nodes.find(n => n.data.parentId === undefined);
      if (firstNode) {
        fitView({
          nodes: [{ id: firstNode.id }],
          duration: 800,
          padding: 0.2,
        });
      }
    }
  }, [activeSessionId, fitView, nodes]);

  return null;
}


function DashboardCanvas() {
  const { resolvedTheme } = useTheme();
  const { nodes, setNodes, edges, setEdges } = useDashboard();
  const [selectedNodes, setSelectedNodes] = React.useState<CassandraNode[]>([]);
  
  const { fitView } = useReactFlow();

  const onNodesChange = useCallback((changes: any) => setNodes((nds) => applyNodeChanges(changes, nds)), [setNodes]);
  const onEdgesChange = useCallback((changes: any) => setEdges((eds) => applyEdgeChanges(changes, eds)), [setEdges]);
  const onConnect: OnConnect = useCallback((connection) => setEdges((eds) => addEdge(connection, eds)), [setEdges]);
  const onSelectionChange = useCallback(({ nodes }: { nodes: CassandraNode[] }) => { setSelectedNodes(nodes); }, []);

  const nodeTypes = useMemo(() => ({ pitchNode: PitchNode }), []);
  const edgeTypes = useMemo(() => ({ smoothstep: SmoothStepEdge }), []);

  const handleStreamingAnalysis = useCallback(async (nodeId: string, pitch: string, file: File | null) => {
    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, isLoading: true, response: '', structuredResponse: null, pitch } } : n));
  
    const currentNode = nodes.find(n => n.id === nodeId);
    const parentId = currentNode?.data.parentId;
    const parentNode = parentId ? nodes.find(n => n.id === parentId) : null;
  
    const formData = new FormData();
    formData.append('pitch', pitch);
    if (file) formData.append('file', file);
    if (parentNode) {
      formData.append('parentPitch', parentNode.data.pitch);
      if (parentNode.data.response) formData.append('parentAnalysis', parentNode.data.response);
    }
    const interactionType = parentNode ? 'follow-up' : 'initial';
    formData.append('interactionType', interactionType);
  
    try {
      const response = await fetch('/api/analyze', { method: 'POST', body: formData });
      
      if (!response.ok || !response.body) throw new Error(`API error: ${response.statusText}`);
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let jsonParsed = false;
      const separator = '---';
  
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, isLoading: false } } : n));
          break;
        }
  
        const chunk = decoder.decode(value, { stream: true });
        
        if (interactionType === 'follow-up') {
          setNodes(nds => nds.map(n => n.id === nodeId ? { 
            ...n, 
            data: { ...n.data, response: (n.data.response || '') + chunk } 
          } : n));
        } else {
          buffer += chunk;
          
          if (!jsonParsed) {
            const separatorIndex = buffer.indexOf(separator);
            
            if (separatorIndex !== -1) {
              const jsonPart = buffer.substring(0, separatorIndex);
              const markdownPart = buffer.substring(separatorIndex + separator.length);
              
              // --- FINAL, ROBUST FIX START ---
              // Add extra debugging to see exactly what we're trying to parse.
              console.log('Raw JSON part received from buffer:', jsonPart);
              
              try {
                // Find the start and end of the actual JSON object, ignoring any surrounding text or markdown.
                const firstBrace = jsonPart.indexOf('{');
                const lastBrace = jsonPart.lastIndexOf('}');
                
                if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                  const potentialJson = jsonPart.substring(firstBrace, lastBrace + 1);
                  console.log('Attempting to parse cleaned JSON:', potentialJson);
                  
                  const structuredData = JSON.parse(potentialJson);
                  jsonParsed = true;
                  
                  console.log('JSON PARSED SUCCESSFULLY:', structuredData);
                  
                  setNodes(nds => nds.map(n => n.id === nodeId ? {
                    ...n,
                    data: {
                      ...n.data,
                      structuredResponse: structuredData,
                      response: markdownPart,
                    }
                  } : n));
                }
              } catch (e) {
                console.log("JSON is not yet complete or valid, continuing to buffer...");
              }
              // --- FINAL, ROBUST FIX END ---
            }
          } else {
            setNodes(nds => nds.map(n => n.id === nodeId ? { 
              ...n, 
              data: { ...n.data, response: (n.data.response || '') + chunk } 
            } : n));
          }
        }
      }
    } catch (error) {
      console.error("Failed to stream analysis:", error);
      const errorMessage = "Sorry, I couldn't complete the analysis. The AI model may be overloaded. Please try again.";
      setNodes(nds => nds.map(n => n.id === nodeId ? { 
        ...n, 
        data: { ...n.data, response: errorMessage, isLoading: false } 
      } : n));
    }
  }, [setNodes, nodes]);  

  const createFollowUpNode = useCallback((text: string, sourceId: string) => {
    const sourceNode = nodes.find(n => n.id === sourceId);
    if (!sourceNode || !sourceNode.position) return;

    const { position: sourcePos, data: sourceData, width, height } = sourceNode;
    
    const newNodeId = `node_${Date.now()}`;
    const contextTitle = sourceData.pitch && sourceData.pitch.length > 50 ? sourceData.pitch.substring(0, 50) + '...' : sourceData.pitch;
    const newNodeWidth = 500;

    const finalX = sourcePos.x + (width || newNodeWidth) / 2 - (newNodeWidth / 2);
    const finalY = sourcePos.y + (height || 200) + 60;

    const newNode: CassandraNode = {
      id: newNodeId,
      type: 'pitchNode',
      position: { x: finalX, y: finalY },
      data: { 
        pitch: text, 
        response: null, 
        isLoading: false, 
        contextTitle, 
        parentId: sourceId,
        onAnalysis: () => {},
        createFollowUpNode: () => {},
      },
    };
    
    const newEdge: Edge = {
      id: `e-${sourceId}-${newNodeId}`,
      type: 'smoothstep',
      source: sourceId,
      target: newNodeId,
      style: { stroke: resolvedTheme === 'dark' ? '#444' : '#ccc', strokeWidth: 2 },
    };
    
    setNodes(n => [...n, newNode]);
    setEdges(e => [...e, newEdge]);
    
    setTimeout(() => {
      fitView({ nodes: [{ id: newNodeId }], duration: 600, padding: 0.3 });
    }, 50);

  }, [resolvedTheme, setNodes, setEdges, nodes, fitView]);

  const handleMerge = useCallback(async () => {
    if (selectedNodes.length < 2) return;
    const avgX = selectedNodes.reduce((s, n) => s + n.position.x, 0) / selectedNodes.length;
    const avgY = selectedNodes.reduce((s, n) => s + n.position.y, 0) / selectedNodes.length;
    const newId = `n_merged_${Date.now()}`;

    const loadingNode: CassandraNode = { 
      id: newId, 
      type: 'pitchNode', 
      position: { x: avgX, y: avgY }, 
      data: { pitch: 'Merging nodes...', isLoading: true, response: null, onAnalysis: () => {}, createFollowUpNode: () => {} } 
    };
    const selectedIds = new Set(selectedNodes.map(n => n.id));
    setNodes(nds => [...nds.filter(n => !selectedIds.has(n.id)), loadingNode]);
    setEdges(eds => eds.filter(e => !selectedIds.has(e.source) && !selectedIds.has(e.target)));
    setSelectedNodes([]);
    
    await new Promise(r => setTimeout(r, 1000));
    const mergedResponse = `This is a synthesized summary of ${selectedNodes.length} previous analyses. The recurring themes identified are market viability and user acquisition challenges. The consensus points towards prioritizing a niche-first strategy to validate the core value proposition before scaling.`;
    setNodes(nds => nds.map(n => n.id === newId ? { ...n, data: { ...n.data, pitch: 'Synthesized Analysis', response: mergedResponse, isLoading: false } } : n));
  }, [selectedNodes, setNodes, setEdges]);

  const nodesWithHandlers = useMemo(() => nodes.map(n => ({ ...n, data: { ...n.data, onAnalysis: handleStreamingAnalysis, createFollowUpNode } })), [nodes, handleStreamingAnalysis, createFollowUpNode]);
  
  if (nodes.length === 0) {
      return (
          <div className="flex flex-col items-center justify-center h-full w-full text-center">
              <BrainCircuit className="h-12 w-12 text-muted-foreground mb-4"/>
              <h2 className="text-xl font-semibold">Welcome to your Canvas</h2>
              <p className="text-muted-foreground">Create a new session to get started.</p>
          </div>
      )
  }

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodesWithHandlers}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{ type: 'smoothstep' }}
        className={resolvedTheme || 'dark'}
        onSelectionChange={onSelectionChange}
        multiSelectionKeyCode={null}
        selectionKeyCode="Shift"
        fitView
      >
        <Controls />
        <Background variant={BackgroundVariant.Dots} gap={16} size={0.5} />
        <MiniMap nodeColor={() => '#fbbf24'} nodeStrokeWidth={3} pannable />
        <CanvasController />
      </ReactFlow>
      
       <AnimatePresence>
          {selectedNodes.length > 1 && (
            <motion.div
              className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10"
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
            >
              <Button onClick={handleMerge} className="shadow-2xl">
                Merge {selectedNodes.length} Nodes
              </Button>
            </motion.div>
          )}
      </AnimatePresence>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ReactFlowProvider>
      <DashboardCanvas />
    </ReactFlowProvider>
  );
}