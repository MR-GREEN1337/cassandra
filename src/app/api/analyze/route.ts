// --- FILE: src/app/api/analyze/route.ts ---

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { tavily as TavilyClient } from '@tavily/core';
import prisma from '@/lib/prisma';
import { generateEmbedding } from '@/lib/embedding';

const kimi = new OpenAI({
  apiKey: process.env.MOONSHOT_API_KEY,
  baseURL: 'https://api.moonshot.ai/v1',
});

const tavily = TavilyClient({ apiKey: process.env.TAVILY_API_KEY });

// Define a type for the raw query result
type FailureCaseResult = {
  id: number;
  company_name: string;
  failure_reason: string;
  summary: string;
  sourceUrl: string | null;
  distance?: number;
  score?: number;
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const pitch = formData.get('pitch') as string;
    const file = formData.get('file') as File | null;
    const parentPitch = formData.get('parentPitch') as string | null;
    const parentAnalysis = formData.get('parentAnalysis') as string | null;
    const interactionType = formData.get('interactionType') as 'follow-up' | 'initial' | null;

    if (!pitch && !file) {
      return new NextResponse(JSON.stringify({ error: 'Pitch or file is required' }), { status: 400 });
    }

    const contextSections: string[] = [];

    // Agent Step 0: Handle conversational context
    if (parentPitch && parentAnalysis) {
      let parentContext = `--- Previous Context ---\nPrevious Pitch: "${parentPitch}"`;
      parentContext += `\n\nPrevious Analysis:\n${parentAnalysis}`;
      contextSections.push(parentContext);
    }

    // Agent Step 1: Handle file upload
    if (file) {
      try {
        const fileContent = await file.text();
        if (fileContent) {
          contextSections.push(`--- Uploaded File Content ---\n${fileContent.substring(0, 5000)}...`);
        }
      } catch (fileError) {
        console.error('Error reading file content:', fileError);
        contextSections.push("--- NOTE ---\nFile processing failed, analysis will proceed without file context.");
      }
    }

    // Agent Step 2: HYBRID SEARCH from vector database
    const textForEmbedding = pitch || `Analysis of the document named ${file?.name}`;
    
    // Query 1: Vector Search (for conceptual similarity)
    const pitchVector = await generateEmbedding(textForEmbedding);
    
    // FIX 1: Use the vector directly as a string parameter for MySQL vector functions
    const vectorString = `[${pitchVector.join(',')}]`;
    
    const vectorSearchPromise = prisma.$queryRaw<FailureCaseResult[]>`
      SELECT id, company_name, failure_reason, summary, sourceUrl,
             VEC_COSINE_DISTANCE(summary_vector, ${vectorString}) as distance
      FROM startup_failures
      ORDER BY distance ASC
      LIMIT 3
    `;

    // Query 2: Full-Text Search (for factual/keyword similarity)
    const fullTextSearchPromise = prisma.$queryRaw<FailureCaseResult[]>`
        SELECT id, company_name, failure_reason, summary, sourceUrl,
               MATCH(company_name, failure_reason, summary, what_went_wrong) AGAINST(${pitch} IN NATURAL LANGUAGE MODE) as score
        FROM startup_failures 
        WHERE MATCH(company_name, failure_reason, summary, what_went_wrong) AGAINST(${pitch} IN NATURAL LANGUAGE MODE)
        ORDER BY score DESC 
        LIMIT 3
    `;

    // Execute both queries in parallel with error handling
    const [vectorResults, textResults] = await Promise.allSettled([
      vectorSearchPromise,
      fullTextSearchPromise
    ]);

    // Handle results safely
    const validVectorResults: FailureCaseResult[] = vectorResults.status === 'fulfilled' ? vectorResults.value : [];
    const validTextResults: FailureCaseResult[] = textResults.status === 'fulfilled' ? textResults.value : [];

    // Log any errors for debugging
    if (vectorResults.status === 'rejected') {
      console.error('Vector search error:', vectorResults.reason);
    }
    if (textResults.status === 'rejected') {
      console.error('Full-text search error:', textResults.reason);
    }

    // Combine and de-duplicate the results
    const combinedResults = new Map<number, FailureCaseResult>();
    [...validVectorResults, ...validTextResults].forEach(res => {
      if (res && res.id) {
        if (!combinedResults.has(res.id)) {
          combinedResults.set(res.id, res);
        }
      }
    });
    
    const dbContext = Array.from(combinedResults.values())
      .map(row => `- Company: ${row.company_name} (Source: ${row.sourceUrl || '#no-source'})\n  Reason for Failure: ${row.failure_reason}\n  Summary: ${row.summary}`)
      .join('\n\n');
      
    if (dbContext) {
        contextSections.push(`--- Relevant Case Studies (from Database) ---\n${dbContext}`);
    }

    // Agent Step 2.5: TARGETED DEEP-DIVE on source URLs with Tavily
    const sourceUrls = Array.from(combinedResults.values())
        .map(r => r.sourceUrl)
        .filter((url): url is string => url !== null && url.startsWith('http'));

    if (sourceUrls.length > 0) {
        const researchPromises = sourceUrls.map(url => 
            tavily.search(`Summarize the key failure points and root causes from this article: ${url}`, { search_depth: 'basic' })
        );
        const researchResults = await Promise.allSettled(researchPromises);

        const deepDiveContext = researchResults
            .map((res, i) => {
                if (res.status === 'fulfilled' && res.value.results.length > 0) {
                    return `Source: ${sourceUrls[i]}\nContent: ${res.value.results[0].content}`;
                }
                return null;
            })
            .filter(Boolean)
            .join('\n\n---\n\n');
        
        if (deepDiveContext) {
            contextSections.push(`--- Deep-Dive Source Analysis (from Live Web Search) ---\n${deepDiveContext}`);
        }
    }

    const fullContext = contextSections.join('\n\n');

    // Agent Step 3: CONTEXTUAL PROMPTING
    let systemPrompt: string;
    let userPrompt: string;

    if (interactionType === 'follow-up' && parentPitch && parentAnalysis) {
      // This is a conversational follow-up
      systemPrompt = `You are Cassandra, an AI co-pilot for startup founders. You are in a conversation about a specific startup idea. Your goal is to provide a detailed, insightful, and conversational answer to the user's follow-up question, using the provided context. Do not perform a new risk analysis.`;
      userPrompt = `Here is the original pitch and your analysis. Now, please answer my follow-up question.

      **Original Pitch:**
      "${parentPitch}"

      **Your Previous Analysis:**
      ${parentAnalysis}

      **My Follow-up Question:**
      "${pitch}"

      **Your Task:**
      - Provide a direct, detailed answer to my question in Markdown.
      - When you reference a specific case study from the "Relevant Case Studies" section, you MUST cite it as a Markdown link using its provided Source URL. For example: "Similar to the issues faced by [Webvan](https://www.failory.com/cemetery/webvan), you might struggle with logistics."
      - Be conversational and helpful.
      - DO NOT output a JSON object or a "---" separator.`;
    } else {
      // This is an initial risk analysis
      systemPrompt = `You are Cassandra, an AI co-pilot for startup founders. Your goal is to identify potential risks by comparing a user's pitch to a database of failed startups and any provided documents. You are critical, insightful, and constructive.`;
      userPrompt = `Based on my pitch and the provided context, perform a critical risk analysis.
        **My Pitch:**
        "${pitch}"
        **Context for your analysis:**
        ${fullContext}
        **Your Task:**
        1.  **First, you MUST output a valid JSON object.** This object must have a single key "risk_analysis" which is an array of objects. Each object in the array represents a single, primary risk and MUST have three keys: "risk_name" (string), "score" (integer 1-10), and "summary" (string).
        2.  **After the JSON object, add a "---" separator.**
        3.  **After the separator, provide your full, detailed analysis in Markdown.** Elaborate on the risks. When you reference a case study, you MUST cite it as a Markdown link using its provided Source URL. Be direct and constructive.`;
    }

    // Agent Step 4: Stream the response from Kimi
    const stream = await kimi.chat.completions.create({
      model: 'kimi-k2-turbo-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      stream: true,
      temperature: 0.5,
      max_tokens: 8192,
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
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });

  } catch (error) {
    console.error('Error in /api/analyze:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new NextResponse(JSON.stringify({ error: 'An internal error occurred', details: errorMessage }), { status: 500 });
  }
}