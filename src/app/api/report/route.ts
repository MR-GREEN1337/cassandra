// --- FILE: src/app/api/report/route.ts ---

import { NextRequest, NextResponse } from 'next/server';
import { ImageResponse } from '@vercel/og';
import { marked } from 'marked';
import OpenAI from 'openai';
import { CassandraNode, Edge } from '@/components/DashboardContext';
import { promises as fs } from 'fs';
import path from 'path';
import { jsPDF } from 'jspdf';
import { html } from 'satori-html';

// We must use the Node.js runtime for fs and jspdf
// export const runtime = 'edge';

const kimi = new OpenAI({
  apiKey: process.env.MOONSHOT_API_KEY,
  baseURL: 'https://api.moonshot.ai/v1',
});

// Helper function remains the same...
function distillCanvasData(nodes: CassandraNode[], edges: Edge[]): string {
    let distilledContent = "## Canvas Exploration Summary\n\n";
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
  
    const findChildren = (nodeId: string) => 
      edges.filter(e => e.source === nodeId).map(e => nodeMap.get(e.target));
  
    const buildNodeText = (node: CassandraNode, level: number) => {
      const prefix = ' '.repeat(level * 2) + '- ';
      distilledContent += `${prefix}**Idea/Question:** "${node.data.pitch}"\n`;
      if (node.data.structuredResponse?.risk_analysis) {
        const risks = node.data.structuredResponse.risk_analysis
          .map(r => `${r.risk_name} (Score: ${r.score}/10)`)
          .join(', ');
        distilledContent += `${prefix}  **Identified Risks:** ${risks}\n`;
      }
      if (node.data.response) {
        const cleanResponse = node.data.response.replace(/\[.*?\]\(.*?\)/g, '').substring(0, 500);
        distilledContent += `${prefix}  **AI Summary:** ${cleanResponse}...\n\n`;
      }
      const children = findChildren(node.id);
      children.forEach(child => child && buildNodeText(child, level + 1));
    };
  
    const rootNodes = nodes.filter(n => !edges.some(e => e.target === n.id));
    rootNodes.forEach(node => buildNodeText(node, 0));
  
    return distilledContent;
}

export async function POST(req: NextRequest) {
  try {
    const { nodes, edges } = await req.json() as { nodes: CassandraNode[], edges: Edge[] };

    if (!nodes || nodes.length === 0) {
      return new NextResponse(JSON.stringify({ error: 'Canvas data is required' }), { status: 400 });
    }

    const canvasSummary = distillCanvasData(nodes, edges);

    const systemPrompt = `You are Cassandra, an executive-level AI strategist...`; // Unchanged
    const userPrompt = `Synthesize the provided canvas data into a formal 'Path to Survival' report...`; // Unchanged

    const response = await kimi.chat.completions.create({
      model: 'kimi-k2-turbo-preview',
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      temperature: 0.4,
    });

    const reportMarkdown = response.choices[0].message.content || 'Error: Could not generate report content.';
    
    const cleanMarkdown = reportMarkdown.replace(/&amp;/g, '&');
    const reportHtml = await marked.parse(cleanMarkdown);

    // --- FINAL & ROBUST HTML TEMPLATE ---
    // This version uses aggressive flexbox styling on all potential parent elements
    // to satisfy Satori's strict layout requirements.
    const fullHtmlTemplate = `
      <div style="font-family: 'Inter'; display: flex; flex-direction: column; width: 100%; height: 100%; background-color: #111827; color: #e5e7eb; padding: 64px; line-height: 1.6;">
        
        <!-- Header -->
        <div style="display: flex; align-items: center; gap: 16px; border-bottom: 1px solid #374151; padding-bottom: 24px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /><circle cx="12" cy="12" r="1.5" fill="#f59e0b" stroke="none" /></svg>
          <div style="display: flex; flex-direction: column;">
            <h1 style="font-size: 32px; font-weight: 700; color: #ffffff; margin: 0; line-height: 1;">Cassandra Report</h1>
            <p style="font-size: 16px; color: #9ca3af; margin: 0;">Path to Survival Analysis</p>
          </div>
        </div>

        <!-- Meta Info -->
        <div style="display: flex; justify-content: space-between; font-size: 12px; color: #6b7280; padding: 24px 0; border-bottom: 1px solid #374151; margin-bottom: 40px;">
          <div style="display: flex; flex-direction: column;"><span style="font-weight: 600;">PREPARED FOR</span><span style="color: #d1d5db;">[Redacted] Founding Team</span></div>
          <div style="display: flex; flex-direction: column; text-align: center;"><span style="font-weight: 600;">DATE</span><span style="color: #d1d5db;">${new Date().toLocaleDateString('en-US')}</span></div>
          <div style="display: flex; flex-direction: column; text-align: right;"><span style="font-weight: 600;">CLASSIFICATION</span><span style="color: #d1d5db;">Internal Strategic Brief</span></div>
        </div>

        <!-- Report Content -->
        <div style="display: flex; flex-direction: column; flex-grow: 1; font-size: 15px; color: #d1d5db; width: 100%;">
          ${reportHtml
            .replace(/<h2/g, '<h2 style="font-size: 20px; font-weight: 600; color: #ffffff; border-bottom: 1px solid #4b5563; padding-bottom: 8px; margin-top: 24px; margin-bottom: 16px; width: 100%; display: flex;"')
            .replace(/<h3/g, '<h3 style="font-size: 16px; font-weight: 600; color: #e5e7eb; margin-top: 16px; margin-bottom: 8px; width: 100%; display: flex;"')
            .replace(/<p/g, '<p style="margin-bottom: 16px; width: 100%; display: flex; flex-wrap: wrap; align-items: center;"')
            .replace(/<ul/g, '<ul style="margin-left: 20px; margin-bottom: 16px; width: 100%; display: flex; flex-direction: column;"')
            .replace(/<li/g, '<li style="margin-bottom: 8px; width: 100%; display: flex; flex-direction: column;"')
            .replace(/<table/g, '<table style="width: 100%; border-collapse: collapse; margin-top: 16px;"')
            .replace(/<th/g, '<th style="border: 1px solid #4b5563; padding: 10px; text-align: left; background-color: #1f2937; font-weight: 600; color: #9ca3af; text-transform: uppercase; font-size: 12px;"')
            .replace(/<td/g, '<td style="border: 1px solid #4b5563; padding: 10px; display: flex;"')
          }
        </div>
      </div>
    `;

    const reportJsx = html(fullHtmlTemplate);
    
    const interRegularPath = path.join(process.cwd(), 'public/assets/Inter-Regular.ttf');
    const interBoldPath = path.join(process.cwd(), 'public/assets/Inter-Bold.ttf');
    const interRegular = await fs.readFile(interRegularPath);
    const interBold = await fs.readFile(interBoldPath);
    
    const imageResponse = new ImageResponse(
      reportJsx,
      {
        width: 1200,
        height: 1697,
        fonts: [
          { name: 'Inter', data: interRegular, style: 'normal', weight: 400 },
          { name: 'Inter', data: interBold, style: 'normal', weight: 700 },
        ],
      },
    );

    const imageBuffer = await imageResponse.arrayBuffer();

    const pdfWidth = 595.28;
    const pdfHeight = 841.89;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    doc.addImage(new Uint8Array(imageBuffer), 'PNG', 0, 0, pdfWidth, pdfHeight);
    const pdfBuffer = doc.output('arraybuffer');

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="cassandra-report.pdf"',
      },
    });

  } catch (error) {
    console.error('Error in /api/report:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new NextResponse(JSON.stringify({ error: 'An internal error occurred', details: errorMessage }), { status: 500 });
  }
}