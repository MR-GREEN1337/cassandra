// --- FILE: src/app/dashboard/page.tsx ---
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
  Node,
  Edge,
  useReactFlow
} from 'reactflow';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';
import { BrainCircuit } from 'lucide-react';
import { useDashboard } from '@/components/DashboardContext';
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

  // Effect to center on new/loaded session
  useEffect(() => {
    if (nodes.length > 0) {
      const nodeToFocus = nodes[0];
      if (nodeToFocus) {
        fitView({
          nodes: [{ id: nodeToFocus.id }],
          duration: 600,
          padding: 0.2,
        });
      }
    }
  }, [activeSessionId, fitView]);

  return null;
}


function DashboardCanvas() {
  const { resolvedTheme } = useTheme();
  const { nodes, setNodes, edges, setEdges } = useDashboard();
  const [selectedNodes, setSelectedNodes] = React.useState<Node[]>([]);
  
  const { fitView } = useReactFlow();

  const onNodesChange = useCallback((changes: any) => setNodes((nds) => applyNodeChanges(changes, nds)), [setNodes]);
  const onEdgesChange = useCallback((changes: any) => setEdges((eds) => applyEdgeChanges(changes, eds)), [setEdges]);
  const onConnect: OnConnect = useCallback((connection) => setEdges((eds) => addEdge(connection, eds)), [setEdges]);
  const onSelectionChange = useCallback(({ nodes }: { nodes: Node[] }) => { setSelectedNodes(nodes); }, []);

  const nodeTypes = useMemo(() => ({ pitchNode: PitchNode }), []);
  const edgeTypes = useMemo(() => ({ smoothstep: SmoothStepEdge }), []);

  const handleStreamingAnalysis = useCallback(async (nodeId: string, pitch: string, file: File | null) => {
    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, isLoading: true, response: '' } } : n));

    const currentNode = nodes.find(n => n.id === nodeId);
    const parentId = currentNode?.data.parentId;
    const parentNode = parentId ? nodes.find(n => n.id === parentId) : null;

    const formData = new FormData();
    formData.append('pitch', pitch);
    if (file) {
      formData.append('file', file);
    }
    if (parentNode) {
      formData.append('parentPitch', parentNode.data.pitch);
      if (parentNode.data.response) { formData.append('parentAnalysis', parentNode.data.response); }
    }

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok || !response.body) { throw new Error(`API error: ${response.statusText}`); }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const read = async () => {
        const { done, value } = await reader.read();
        if (done) {
          setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, isLoading: false } } : n));
          return;
        }
        const chunk = decoder.decode(value, { stream: true });
        setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, response: (n.data.response || '') + chunk } } : n));
        await read();
      };
      await read();
    } catch (error) {
      console.error("Failed to stream analysis:", error);
      const errorMessage = "Sorry, I couldn't complete the analysis. Please try again.";
      setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, response: errorMessage, isLoading: false } } : n));
    }
  }, [setNodes, nodes]);

  const createFollowUpNode = useCallback((text: string, sourceId: string) => {
    const sourceNode = nodes.find(n => n.id === sourceId);
    if (!sourceNode) { return; }
    const { position: sourcePos, data: sourceData, width, height } = sourceNode;
    if (!sourcePos) { return; }
    const newNodeId = `node_${Date.now()}`;
    const contextTitle = sourceData.pitch && sourceData.pitch.length > 50 ? sourceData.pitch.substring(0, 50) + '...' : sourceData.pitch;
    const newNodeWidth = 500;

    const newNode: Node = {
      id: newNodeId,
      type: 'pitchNode',
      position: { x: sourcePos.x + (width || newNodeWidth) / 2 - (newNodeWidth / 2), y: sourcePos.y + (height || 200) + 60 },
      data: { pitch: text, response: null, isLoading: false, contextTitle, parentId: sourceId },
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
  }, [resolvedTheme, setNodes, setEdges, nodes]);

  const handleMerge = useCallback(async () => {
    if (selectedNodes.length < 2) return;
    const content = selectedNodes.map((n, i) => `--- Entry ${i + 1} ---\nPitch: ${n.data.pitch}\nAnalysis: ${n.data.response || 'N/A'}`).join('\n\n');
    const prompt = `Synthesize these entries:\n\n${content}`;
    const avgX = selectedNodes.reduce((s, n) => s + n.position.x, 0) / selectedNodes.length;
    const avgY = selectedNodes.reduce((s, n) => s + n.position.y, 0) / selectedNodes.length;
    const newId = `n_merged_${Date.now()}`;
    const loadingNode: Node = { id: newId, type: 'pitchNode', position: { x: avgX, y: avgY }, data: { pitch: 'Merging nodes...', isLoading: true, response: null } };
    const selectedIds = new Set(selectedNodes.map(n => n.id));
    setNodes(nds => [...nds.filter(n => !selectedIds.has(n.id)), loadingNode]);
    setEdges(eds => eds.filter(e => !selectedIds.has(e.source) && !selectedIds.has(e.target)));
    setSelectedNodes([]);
    
    await new Promise(r => setTimeout(r, 2000));
    const mergedResponse = `Summary of ${selectedNodes.length} items:\nThe main themes are market viability and user acquisition. The consensus points towards a niche-first approach.`;
    setNodes(nds => nds.map(n => n.id === newId ? { ...n, data: { ...n.data, pitch: prompt, response: mergedResponse, isLoading: false } } : n));
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