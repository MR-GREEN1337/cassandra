// --- FILE: src/app/api/interview/route.ts ---

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import prisma from '@/lib/prisma';
import { StartupFailure } from '@prisma/client';
import { tavily as TavilyClient } from '@tavily/core';

const kimi = new OpenAI({
  apiKey: process.env.MOONSHOT_API_KEY,
  baseURL: 'https://api.moonshot.ai/v1',
});

const tavily = TavilyClient({ apiKey: process.env.TAVILY_API_KEY });

// Function to format the startup data into a clean context string for the LLM
const formatCaseStudyContext = (failure: StartupFailure): string => {
  return `
- Company Name: ${failure.companyName}
- Primary Reason for Failure: ${failure.failureReason || 'Not specified.'}
- What They Did (Summary): ${failure.whatTheyDid || 'Not specified.'}
- What Went Wrong: ${failure.whatWentWrong || 'Not specified.'}
- Key Takeaway: ${failure.keyTakeaway || 'Not specified.'}
- Source URL: ${failure.sourceUrl || 'Not available.'}
  `.trim();
};

export async function POST(req: NextRequest) {
  try {
    const { startupId, messages } = await req.json();

    if (!startupId || !messages || !Array.isArray(messages)) {
      return new NextResponse(JSON.stringify({ error: 'Missing startupId or messages' }), { status: 400 });
    }

    // --- WINNING AGENT WORKFLOW STEP 1: Fetch Primary Knowledge from TiDB ---
    const failureCase = await prisma.startupFailure.findUnique({
      where: { id: Number(startupId) },
    });

    if (!failureCase) {
      return new NextResponse(JSON.stringify({ error: 'Startup not found' }), { status: 404 });
    }

    const caseStudyContext = formatCaseStudyContext(failureCase);
    const lastUserMessage = messages[messages.length - 1]?.content || '';

    // --- WINNING AGENT WORKFLOW STEP 2: Augment with Live Web Intelligence ---
    const searchQuery = `"${failureCase.companyName}" startup failure details about ${lastUserMessage}`;
    const searchResults = await tavily.search(searchQuery, { max_results: 3 });
    const webContext = searchResults.results.map(res => `- URL: ${res.url}\n  Content: ${res.content}`).join('\n\n');

    // --- WINNING AGENT WORKFLOW STEP 3: Synthesize with an Advanced Prompt ---
    const systemPrompt = `You are a world-class post-mortem analyst AI. You are interviewing a user about the failure of "${failureCase.companyName}".
    
    Your knowledge comes from two sources:
    1.  **Primary Internal Report:** A concise summary from our database. This is your most trusted source.
    2.  **Live Web Intelligence:** Fresh context from a real-time web search. Use this to add detail, find recent information, or answer questions not covered in the internal report.

    IMPORTANT RULES:
    1.  **Synthesize, Don't Just List:** Combine insights from both sources into a single, coherent answer.
    2.  **Prioritize Primary Report:** If sources conflict, state that the internal report says one thing while other sources say another.
    3.  **CITE EVERYTHING:** When you use information from any source, you MUST cite it as a Markdown link. For example: "Their main issue was marketing ([Source](${failureCase.sourceUrl})), similar to what other reports confirm ([Source](${searchResults.results[0]?.url}))."
    4.  **Stay Focused:** Only answer questions about "${failureCase.companyName}". Do not answer general startup questions.
    5.  **Be Factual:** If you cannot answer from the provided context, state that the information is not available in the provided materials. Do NOT use outside knowledge.

    --- [PRIMARY INTERNAL REPORT] ---
    ${caseStudyContext}
    --- [END PRIMARY INTERNAL REPORT] ---

    --- [LIVE WEB INTELLIGENCE] ---
    ${webContext}
    --- [END LIVE WEB INTELLIGENCE] ---
    `;
    
    const requestMessages = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    // --- WINNING AGENT WORKFLOW STEP 4: Stream the Synthesized Response ---
    const stream = await kimi.chat.completions.create({
      model: 'kimi-k2-turbo-preview',
      messages: requestMessages,
      stream: true,
      temperature: 0.3,
    });

    const readableStream = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || '';
          controller.enqueue(new TextEncoder().encode(content));
        }
        controller.close();
      },
    });

    return new Response(readableStream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });

  } catch (error) {
    console.error('Error in /api/interview:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new NextResponse(JSON.stringify({ error: 'An internal error occurred', details: errorMessage }), { status: 500 });
  }
}