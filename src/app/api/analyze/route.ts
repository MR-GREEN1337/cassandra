import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import prisma from '@/lib/prisma';
import { generateEmbedding } from '@/lib/embedding';

const kimi = new OpenAI({
  apiKey: process.env.MOONSHOT_API_KEY,
  baseURL: 'https://api.moonshot.ai/v1',
});

// Define a type for the raw query result, now including the source URL
type FailureCaseResult = {
  company_name: string;
  failure_reason: string;
  summary: string;
  source_url: string | null; // <-- ADD THIS
  distance: number;
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const pitch = formData.get('pitch') as string;
    const file = formData.get('file') as File | null;
    const parentPitch = formData.get('parentPitch') as string | null;
    const parentAnalysis = formData.get('parentAnalysis') as string | null;

    if (!pitch && !file) {
      return new NextResponse(JSON.stringify({ error: 'Pitch or file is required' }), { status: 400 });
    }

    const contextSections: string[] = [];

    // Agent Step 0: Handle conversational context if it exists
    if (parentPitch) {
      let parentContext = `--- Previous Context ---\nPrevious Pitch: "${parentPitch}"`;
      if (parentAnalysis) {
        parentContext += `\n\nPrevious Analysis:\n${parentAnalysis}`;
      }
      contextSections.push(parentContext);
    }


    // Agent Step 1: Handle file upload if it exists
    if (file) {
      try {
        //@ts-expect-error
        const fileObject = await kimi.files.create({ file, purpose: 'file-extract' });
        const fileContent = await (await kimi.files.content(fileObject.id)).text();
        if (fileContent) {
          contextSections.push(`--- Uploaded File Content ---\n${fileContent}`);
        }
      } catch (fileError) {
        console.error('Error handling file upload to Kimi:', fileError);
        contextSections.push("--- NOTE ---\nFile processing failed, analysis will proceed without file context.");
      }
    }

    // Agent Step 2: Retrieve context from vector database
    const textForEmbedding = pitch || `Analysis of the document named ${file?.name}`;
    const pitchVector = await generateEmbedding(textForEmbedding);
    const results: FailureCaseResult[] = await prisma.$queryRaw`
      SELECT company_name, failure_reason, summary, source_url, -- <-- SELECT source_url
             VEC_COSINE_DISTANCE(summary_vector, CAST(${JSON.stringify(pitchVector)} AS VECTOR(1536))) as distance
      FROM startup_failures
      ORDER BY distance ASC
      LIMIT 3
    `;

    // Create a context string that includes the source URL for the AI to reference
    const dbContext = results
      .map(row => `- Company: ${row.company_name} (Source: ${row.source_url})\n  Reason for Failure: ${row.failure_reason}\n  Summary: ${row.summary}`)
      .join('\n\n');
      
    if (dbContext) {
        contextSections.push(`--- Relevant Case Studies ---\n${dbContext}`);
    }

    const fullContext = contextSections.join('\n\n');

    const systemPrompt = `You are Cassandra, an AI co-pilot for startup founders. Your goal is to identify potential risks by comparing a user's pitch to a database of failed startups and any provided documents. You are critical, insightful, and constructive. Structure your entire response using Markdown. Use headings, bold text, and bullet points.`;
    
    // Update the user prompt to explicitly request linked citations
    const userPrompt = `Here is my startup pitch${parentPitch ? " (as a follow-up to our previous discussion)" : ""}:
      "${pitch}"

      Analyze my pitch based on the following context.
      
      ${fullContext}
      
      ${parentPitch 
        ? "Your analysis should consider our previous conversation and focus on how this new information changes the risk profile or answers the follow-up query. Be concise."
        : "Based on ALL the context provided, what are the primary risks my venture faces? Provide a concise, critical analysis and suggest potential mitigation strategies."
      }
      **IMPORTANT**: When you reference a specific case study from the "Relevant Case Studies" section, you MUST cite it as a Markdown link using its provided Source URL. For example: "Similar to the issues faced by [Webvan](https://www.failory.com/cemetery/webvan), you might struggle with logistics."
    `;

    // Agent Step 4: Stream the response from Kimi
    const stream = await kimi.chat.completions.create({
      model: 'kimi-k2-turbo-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      stream: true,
      temperature: 0.6,
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
    console.error('Error in /api/analyze:', error);
    return new NextResponse(JSON.stringify({ error: 'An internal error occurred' }), { status: 500 });
  }
}