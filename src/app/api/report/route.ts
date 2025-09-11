import { NextRequest, NextResponse } from 'next/server';
import { ImageResponse } from '@vercel/og';
import { marked } from 'marked';
import OpenAI from 'openai';
import { CassandraNode } from '@/components/DashboardContext';
import { Edge } from 'reactflow';
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

// Helper function to distill canvas data. (No changes here)
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
    //@ts-ignore
    if (!nodes || !nodes.length === 0) {
      return new NextResponse(JSON.stringify({ error: 'Canvas data is required' }), { status: 400 });
    }

    const canvasSummary = distillCanvasData(nodes, edges);

    // Refined prompt to ensure clean Markdown output
    const systemPrompt = `You are Cassandra, an executive-level AI strategist...`; // Unchanged
    const userPrompt = `Synthesize the provided canvas data into a formal 'Path to Survival' report...`; // Unchanged

    const response = await kimi.chat.completions.create({
      model: 'kimi-k2-turbo-preview',
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      temperature: 0.4,
    });

    const reportMarkdown = response.choices[0].message.content || 'Error: Could not generate report content.';
    
    // Sanitize and parse markdown
    const cleanMarkdown = reportMarkdown.replace(/&amp;/g, '&');
    const reportHtml = await marked.parse(cleanMarkdown);

    // Professional HTML template with proper text constraints
    const fullHtmlTemplate = `
      <div style="
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
        width: 1120px;
        height: 1617px;
        background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
        color: #e2e8f0;
        padding: 0;
        margin: 0;
        box-sizing: border-box;
        position: relative;
        overflow: hidden;
      ">
        
        <!-- Header Section -->
        <div style="
          background: linear-gradient(90deg, #1e40af 0%, #3b82f6 100%);
          padding: 48px 60px;
          border-bottom: 3px solid #2563eb;
          position: relative;
        ">
          <div style="display: flex; align-items: center; gap: 20px;">
            <!-- Logo/Icon -->
            <div style="
              width: 64px;
              height: 64px;
              background: rgba(255,255,255,0.1);
              border-radius: 12px;
              display: flex;
              align-items: center;
              justify-content: center;
              backdrop-filter: blur(10px);
            ">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="#fbbf24" stroke-width="2"/>
                <circle cx="12" cy="12" r="3" fill="#fbbf24"/>
                <path d="M12 3v6M12 15v6M3 12h6M15 12h6" stroke="#fbbf24" stroke-width="2"/>
              </svg>
            </div>
            
            <div>
              <h1 style="
                font-size: 42px;
                font-weight: 800;
                color: #ffffff;
                margin: 0;
                line-height: 1.1;
                letter-spacing: -0.025em;
              ">CASSANDRA</h1>
              <p style="
                font-size: 18px;
                color: rgba(255,255,255,0.8);
                margin: 4px 0 0 0;
                font-weight: 500;
              ">Strategic Risk Analysis & Path to Survival</p>
            </div>
          </div>
          
          <!-- Report metadata -->
          <div style="
            position: absolute;
            top: 48px;
            right: 60px;
            text-align: right;
            color: rgba(255,255,255,0.9);
          ">
            <div style="font-size: 14px; font-weight: 600; margin-bottom: 4px;">
              ${new Date().toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </div>
            <div style="font-size: 12px; color: rgba(255,255,255,0.7);">
              CONFIDENTIAL • INTERNAL USE
            </div>
          </div>
        </div>

        <!-- Content Area -->
        <div style="
          padding: 60px;
          max-width: 1000px;
          margin: 0 auto;
        ">
          <div style="
            font-size: 16px;
            line-height: 1.7;
            color: #cbd5e1;
            word-wrap: break-word;
            overflow-wrap: break-word;
            hyphens: auto;
          ">
            ${reportHtml
              // Headers with proper spacing and typography
              .replace(/<h1[^>]*>/g, '<h1 style="font-size: 32px; font-weight: 700; color: #ffffff; margin: 48px 0 24px 0; padding-bottom: 12px; border-bottom: 2px solid #3b82f6; line-height: 1.2;">')
              .replace(/<h2[^>]*>/g, '<h2 style="font-size: 26px; font-weight: 700; color: #f1f5f9; margin: 40px 0 20px 0; padding-bottom: 8px; border-bottom: 1px solid #475569; line-height: 1.3;">')
              .replace(/<h3[^>]*>/g, '<h3 style="font-size: 20px; font-weight: 600; color: #e2e8f0; margin: 32px 0 16px 0; line-height: 1.4;">')
              .replace(/<h4[^>]*>/g, '<h4 style="font-size: 18px; font-weight: 600; color: #cbd5e1; margin: 24px 0 12px 0; line-height: 1.4;">')
              
              // Paragraphs with proper text flow
              .replace(/<p[^>]*>/g, '<p style="margin: 0 0 18px 0; max-width: 100%; word-wrap: break-word; overflow-wrap: break-word; line-height: 1.7;">')
              
              // Lists with proper indentation
              .replace(/<ul[^>]*>/g, '<ul style="margin: 16px 0; padding-left: 24px; list-style-type: disc;">')
              .replace(/<ol[^>]*>/g, '<ol style="margin: 16px 0; padding-left: 24px; list-style-type: decimal;">')
              .replace(/<li[^>]*>/g, '<li style="margin: 8px 0; line-height: 1.6; max-width: 100%; word-wrap: break-word;">')
              
              // Tables with professional styling
              .replace(/<table[^>]*>/g, '<table style="width: 100%; border-collapse: collapse; margin: 24px 0; background: rgba(51, 65, 85, 0.3); border-radius: 8px; overflow: hidden;">')
              .replace(/<thead[^>]*>/g, '<thead style="background: rgba(30, 64, 175, 0.8);">')
              .replace(/<th[^>]*>/g, '<th style="padding: 16px; text-align: left; font-weight: 600; color: #ffffff; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #475569;">')
              .replace(/<td[^>]*>/g, '<td style="padding: 16px; border-bottom: 1px solid rgba(71, 85, 105, 0.3); vertical-align: top; word-wrap: break-word;">')
              .replace(/<tr[^>]*>/g, '<tr style="border-bottom: 1px solid rgba(71, 85, 105, 0.2);">')
              
              // Emphasis and links
              .replace(/<strong[^>]*>/g, '<strong style="font-weight: 700; color: #f1f5f9;">')
              .replace(/<em[^>]*>/g, '<em style="font-style: italic; color: #94a3b8;">')
              .replace(/<a[^>]*>/g, '<a style="color: #60a5fa; text-decoration: underline; word-wrap: break-word;">')
              
              // Code blocks
              .replace(/<code[^>]*>/g, '<code style="background: rgba(51, 65, 85, 0.6); padding: 2px 6px; border-radius: 4px; font-family: \'SF Mono\', \'Monaco\', monospace; font-size: 14px; color: #fbbf24;">')
              .replace(/<pre[^>]*>/g, '<pre style="background: rgba(51, 65, 85, 0.8); padding: 20px; border-radius: 8px; overflow: hidden; margin: 16px 0; border-left: 4px solid #3b82f6;">')
              
              // Blockquotes
              .replace(/<blockquote[^>]*>/g, '<blockquote style="border-left: 4px solid #3b82f6; padding-left: 20px; margin: 20px 0; font-style: italic; color: #94a3b8; background: rgba(51, 65, 85, 0.3); padding: 20px; border-radius: 0 8px 8px 0;">')
            }
          </div>
        </div>

        <!-- Footer -->
        <div style="
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 60px;
          background: linear-gradient(90deg, #1e40af 0%, #3b82f6 100%);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="
            font-size: 12px;
            color: rgba(255,255,255,0.8);
            font-weight: 500;
          ">
            Generated by Cassandra AI • Strategic Analysis Platform
          </div>
        </div>
      </div>
    `;

    const reportJsx: any = html(fullHtmlTemplate);
    
    const interRegularPath = path.join(process.cwd(), 'public/assets/Inter-Regular.ttf');
    const interBoldPath = path.join(process.cwd(), 'public/assets/Inter-Bold.ttf');
    const interRegular = await fs.readFile(interRegularPath);
    const interBold = await fs.readFile(interBoldPath);
    
    const imageResponse = new ImageResponse(
      reportJsx,
      {
        width: 1120,
        height: 1617,
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
        'Content-Disposition': 'attachment; filename="cassandra-strategic-report.pdf"',
      },
    });

  } catch (error) {
    console.error('Error in /api/report:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new NextResponse(JSON.stringify({ error: 'An internal error occurred', details: errorMessage }), { status: 500 });
  }
}