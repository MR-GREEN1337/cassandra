#!/bin/bash
#
# Alloy - Context Generation Script v1
# This script gathers all relevant source code from the backend and web,
# then appends an updated architectural prompt and directory trees to create a comprehensive context file.
#

echo "--- Generating complete context for Alloy ---"

# --- Step 1: Clear previous context for a fresh start ---
echo "[1/4] Clearing old context file..."
> claude_context.txt

# --- Step 2: Append Backend Source (Python/FastAPI) ---
echo "[2/4] Appending backend source files (*.py)..."
find backend/src -name "*.py" -exec sh -c '
  echo "File: {}" >> claude_context.txt && cat {} >> claude_context.txt && echo -e "\n-e\n" >> claude_context.txt
' \;
find backend/tests -name "*.py" -exec sh -c '
  echo "File: {}" >> claude_context.txt && cat {} >> claude_context.txt && echo -e "\n-e\n" >> claude_context.txt
' \;

# --- Step 3: Append Web App Source (Next.js/React) ---
echo "[3/4] Appending web source files (*.ts, *.tsx)..."
find web/src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sh -c '
  echo "File: $1" >> claude_context.txt && cat "$1" >> claude_context.txt && echo -e "\n-e\n" >> claude_context.txt
' sh {} \;

# --- Step 4: Append Directory Trees & Final Prompt ---
echo "[4/4] Appending directory trees and project prompt..."
{
  echo "--- DIRECTORY TREES ---"
  echo ""
  echo "Backend Tree:"
  tree backend/src
  echo ""
  echo "Backend Tests Tree:"
  tree backend/tests
  echo ""
  echo "Web App Tree:"
  tree web/src
  echo ""
  echo "-----------------------"
  echo ""
} >> claude_context.txt

# Append your startup context at the bottom
cat <<'EOT' >> claude_context.txt
The project is "Cassandra," a full-stack, AI-powered strategic co-pilot for startup founders. Its mission is to prevent preventable failures by stress-testing a founder's idea against a rich, agent-built knowledge base of 1,000+ startup post-mortems.

The system is a cohesive, three-part architecture:

1.  **The Autonomous Data Agent (`data-agent`):** A sophisticated Python agent that built the project's core dataset. It uses Tavily for web discovery, Gemini 1.5 Pro for structured data extraction, OpenAI for vector embeddings, and populates a TiDB Serverless database. This agent demonstrates a complete, automated data pipeline.

2.  **The Hybrid RAG Backend (`/api/analyze`):** A high-performance Next.js serverless function that acts as the live reasoning engine. When a user submits a pitch, it performs a **true hybrid search** against TiDB—using vector search for semantic/conceptual similarity and full-text search for factual/keyword matches. This retrieved context is then fed to the Kimi LLM to generate a two-part response:
    *   A structured JSON object with a quantitative **Risk Scorecard**.
    *   A detailed, streaming Markdown analysis with verifiable source citations.

3.  **The Strategic Frontend Workspace (`/dashboard`):** A polished and intuitive UI built with Next.js, React Flow, and Tailwind CSS. This is the user's "Failure Map," an infinite canvas for non-linear idea exploration. It features:
    *   **Interactive Nodes:** Display the AI's analysis, including the color-coded Risk Scorecard and favicon-enhanced links to sources.
    *   **Session Management:** A complete, persistent workspace with sessions saved to localStorage.
    *   **"Browse Corpus" Page:** A searchable, paginated view of the underlying TiDB database, providing full transparency into the knowledge base.

**Key Differentiators (Why This Project Wins):**

-   **True Hybrid RAG:** Perfectly leverages the sponsor's tech (TiDB) by combining vector and full-text search in a single workflow to produce nuanced, highly relevant context. This is the core technical innovation.
-   **Structured + Streaming Analysis:** The API doesn't just return text; it provides a quantitative JSON `Risk Scorecard` upfront for immediate insight, followed by a detailed qualitative analysis streamed in real-time.
-   **Agent-Built Knowledge Base:** The data isn't a static CSV file; it's a living database built and maintained by a separate, autonomous AI agent, fulfilling the "multi-step agentic workflow" requirement of the hackathon.
-   **Actionable & Verifiable UX:** The "Failure Map" is more than a chat window; it's a strategic tool. The Risk Scorecard and cited sources transform AI-generated text into trusted, actionable intelligence.
EOT

echo "--- Context generation complete. File 'claude_context.txt' is ready. ---"