#!/bin/bash
#
# Context-Aware AI Prompt Generator for the Cassandra Project
#
# This script compiles the project's specific vision (a startup analysis tool),
# its file structure, and all relevant source code into a single context file.
# This allows an AI to understand the project's goals and implementation deeply.
#

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Color Codes for Output ---
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# --- Configuration ---
OUTPUT_FILE="prompt_context.txt"

# The "Vision": The high-level goal and purpose of THIS SPECIFIC project.
# This has been updated to reflect the Cassandra startup analysis tool concept.
PROJECT_VISION=$(cat <<-END
The project is a web application named "Cassandra", a frontend-only prototype designed to act as an AI co-pilot for startup founders.

The core premise is to de-risk new ventures by analyzing a user's startup pitch, business plan, or feature idea against a simulated knowledge base of 1,000+ startup failures. The AI's goal is to identify potential pitfalls, competitive threats, and market risks proactively.

**Crucially, this is a web-only prototype. All AI responses are currently simulated within the frontend code to demonstrate the UX and functionality without a real backend.**

The user interface is a spatial, canvas-based system built with Next.js and React Flow, which allows for a non-linear exploration of ideas:

Key Features:
- **Spatial Idea Exploration:** Users create nodes on an infinite canvas. The initial node is for the main pitch.
- **Contextual Follow-ups:** Users can highlight specific risks or points in the AI's analysis (e.g., "competitive pressure") to create new, connected nodes for deeper, focused exploration on that specific topic.
- **Node Merging:** Users can select multiple analysis nodes and merge them into a single, synthesized summary node.
- **Professional Session Management:** All analysis sessions are automatically saved to the browser's `localStorage`. A "startup-like" sidebar allows users to load, create, and delete past sessions, which are grouped by date.
- **Polished UI:** Includes a minimap for navigation, light/dark themes, and a clean aesthetic using Tailwind CSS and Shadcn UI.
END
)

# --- Script Execution ---
echo -e "${BLUE}Generating AI context for Cassandra (Frontend Prototype)...${NC}"

# Start with a clean slate.
> "$OUTPUT_FILE"

# 1. Add the Project Vision to the output file
echo "## Project Vision and Core Concept" >> "$OUTPUT_FILE"
echo "---------------------------------" >> "$OUTPUT_FILE"
echo "$PROJECT_VISION" >> "$OUTPUT_FILE"
echo -e "\n\n" >> "$OUTPUT_FILE"

# 2. Add the Project File Structure
echo "## Project File Structure" >> "$OUTPUT_FILE"
echo "------------------------" >> "$OUTPUT_FILE"
if ! command -v tree &> /dev/null
then
    echo -e "${YELLOW}Warning: 'tree' command not found. Skipping file structure generation.${NC}"
    echo "To install, run: brew install tree (macOS) or sudo apt-get install tree (Debian/Ubuntu)" >> "$OUTPUT_FILE"
else
    # Exclude common large/irrelevant directories for a clean tree
    tree -I 'node_modules|.next|.git|dist|build' >> "$OUTPUT_FILE"
fi
echo -e "\n\n" >> "$OUTPUT_FILE"

# 3. Add the contents of all relevant source files
echo "## Source Code Files" >> "$OUTPUT_FILE"
echo "-------------------" >> "$OUTPUT_FILE"

# Find and concatenate all relevant frontend source files.
find ./src -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.css" \) -print0 | while IFS= read -r -d '' file; do
    echo -e "\n// --- FILE: ${file} ---\n" >> "$OUTPUT_FILE"
    cat "$file" >> "$OUTPUT_FILE"
done

# Also include root configuration files
for file in "tailwind.config.ts" "package.json" "next.config.mjs" "postcss.config.js" "tsconfig.json"; do
    if [ -f "$file" ]; then
        echo -e "\n// --- FILE: ${file} ---\n" >> "$OUTPUT_FILE"
        cat "$file" >> "$OUTPUT_FILE"
    fi
done

cat ./data-agent/README.md >> "$OUTPUT_FILE"
echo -e "\n\n" >> "$OUTPUT_FILE"
cat ./data-agent/main.py >> "$OUTPUT_FILE"
echo -e "\n\n" >> "$OUTPUT_FILE"

echo -e "${GREEN}Context successfully generated in '${OUTPUT_FILE}'${NC}"

# 4. Copy to clipboard for easy pasting into an LLM
if command -v pbcopy &> /dev/null; then
    cat "$OUTPUT_FILE" | pbcopy
    echo -e "${GREEN}Project context has been copied to your clipboard (macOS).${NC}"
elif command -v xclip &> /dev/null; then
    cat "$OUTPUT_FILE" | xclip -selection clipboard
    echo -e "${GREEN}Project context has been copied to your clipboard (Linux).${NC}"
else
    echo -e "${YELLOW}Clipboard utility not found. Please manually copy the contents of '${OUTPUT_FILE}'.${NC}"
fi

echo -e "\n${BLUE}--- DONE ---${NC}"