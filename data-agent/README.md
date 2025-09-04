# Cassandra Research Agent 

An autonomous AI research agent that continuously discovers, analyzes, and catalogues startup failure stories from across the web. Named after Cassandra of Troy, who could see the future but was cursed to never be believed - this agent helps entrepreneurs learn from the past to avoid repeating it.

## 🎯 What It Does

The Cassandra Agent operates as a **self-expanding research system** that:

### 1. **Intelligent Web Discovery**
- Starts with seed topics about startup failures and post-mortems
- Uses advanced web search to find relevant articles, blog posts, and reports
- Dynamically generates new search queries based on discovered patterns
- Maintains a "research frontier" of unexplored topics

### 2. **AI-Powered Analysis**
- Extracts detailed failure stories from web content using Google Gemini
- Identifies specific companies, failure reasons, and key takeaways
- Categorizes failures by type (product-market fit, funding, execution, etc.)
- Preserves source URLs for verification and deeper research

### 3. **Semantic Knowledge Base**
- Stores findings in TiDB with vector embeddings for semantic search
- Prevents duplicate entries while building comprehensive coverage
- Creates structured data from unstructured web content
- Enables similarity-based discovery of related failure patterns

### 4. **Autonomous Operation**
- Runs continuously without human intervention
- Self-expands research scope based on discoveries
- Manages rate limits and API quotas intelligently
- Handles errors and connection issues gracefully

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│   Web Search    │───▶│   AI Analysis    │───▶│   Vector Storage    │
│   (Tavily)      │    │   (Gemini Pro)   │    │     (TiDB)          │
└─────────────────┘    └──────────────────┘    └─────────────────────┘
         ▲                       │                        │
         │                       ▼                        │
┌─────────────────┐    ┌──────────────────┐               │
│ Query Generator │◀───│ Pattern Analysis │◀──────────────┘
│   (Gemini)      │    │   (Discovery)    │
└─────────────────┘    └──────────────────┘
```

## 📊 Data Schema

Each discovered startup failure includes:

```json
{
  "company_name": "string",
  "failure_reason_category": "string", 
  "what_they_did": "string",
  "what_went_wrong": "string", 
  "key_takeaway": "string",
  "source_url": "string",
  "summary_vector": "float[]"
}
```

## 🚀 Getting Started

### Prerequisites

- Python 3.9+
- TiDB database (local or cloud)
- API keys for:
  - Google AI (Gemini)
  - Tavily Search
  - OpenAI (for embeddings)

### Installation

```bash
# Clone and setup
git clone <repository>
cd cassandra-agent
uv venv
source .venv/bin/activate
uv pip install -r requirements.txt
```

### Configuration

Create `.env` file:

```env
# Database
TIDB_HOST=your-tidb-host
TIDB_PORT=4000
TIDB_USER=your-username
TIDB_PASSWORD=your-password
TIDB_DATABASE=your-database

# API Keys
GOOGLE_API_KEY=your-gemini-key
TAVILY_API_KEY=your-tavily-key
OPENAI_API_KEY=your-openai-key
```

### Database Setup

```sql
-- Create tables
CREATE TABLE search_frontier (
    id INT AUTO_INCREMENT PRIMARY KEY,
    query VARCHAR(500) UNIQUE,
    status ENUM('pending', 'completed') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE startup_failures (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_name VARCHAR(255),
    failure_reason VARCHAR(500),
    summary TEXT,
    what_they_did TEXT,
    what_went_wrong TEXT,
    key_takeaway TEXT,
    sourceUrl VARCHAR(1000),
    summary_vector JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX(company_name)
);
```

### Running the Agent

```bash
uv run main.py
```

## 🎛️ Configuration Options

```python
# Agent Parameters
RESEARCH_ITERATIONS = 10    # Max research cycles
BATCH_SIZE = 5             # Queries per iteration
SEMAPHORE = asyncio.Semaphore(5)  # Concurrent operations limit

# Seed topics - customize for your research focus
SEED_TOPICS = [
    "Y Combinator startup post-mortems",
    "TechCrunch deadpool analysis",
    "CB Insights startup failure reports",
    # Add your own topics...
]
```

## 📈 Sample Output

```
--- Starting Cassandra Industrial Research Agent ---
🌱 Seeding the research frontier...
✅ Frontier seeded.

--- 🔄 Starting Research Iteration 1/10 ---
  -> Analyzing (Pro): Y Combinator startup post-mortems
  -> Found 12 potential cases. Loading new ones into TiDB...
    -> ✅ Stored: Homejoy (from https://techcrunch.com/...)
    -> ✅ Stored: Zirtual (from https://medium.com/...)
  -> Stored 8 new startups. Total in DB: 8

🧠 Expanding frontier with new search queries...
✅ Added 5 new queries to the frontier.
```

## 🔍 What You'll Discover

The agent typically finds:

- **Product-Market Fit Failures**: Companies that built something nobody wanted
- **Funding & Cash Flow Issues**: Startups that ran out of money
- **Execution Problems**: Good ideas, poor implementation
- **Market Timing**: Too early or too late to market
- **Team Dynamics**: Co-founder conflicts and leadership issues
- **Competition**: Outmaneuvered by larger players
- **Pivot Failures**: Unsuccessful attempts to change direction

## 🛡️ Features

### Intelligent Deduplication
- Prevents storing the same company multiple times
- Uses fuzzy matching on company names
- Maintains data quality and uniqueness

### Source Attribution
- Every failure story includes its source URL
- Enables fact-checking and deeper research
- Maintains transparency and credibility

### Semantic Search Ready
- Vector embeddings enable "find similar failures"
- Can discover patterns across different industries
- Supports building recommendation systems

### Fault Tolerant
- Handles API rate limits gracefully
- Recovers from network errors
- Manages database connection pooling
- Logs errors without stopping the research

## 📚 Use Cases

### For Entrepreneurs
- Learn from others' mistakes before making your own
- Identify common failure patterns in your industry
- Validate assumptions against historical data

### For Investors
- Due diligence research on market risks
- Pattern recognition for investment decisions
- Portfolio company risk assessment

### For Researchers
- Academic studies on entrepreneurship
- Failure pattern analysis across industries
- Building predictive models for startup success

### For Content Creators
- Rich source material for articles and videos
- Data-driven insights on startup ecosystems
- Trend analysis and market intelligence

## 🔮 Future Enhancements

- **Industry Classification**: Auto-categorize failures by sector
- **Timeline Analysis**: Track failure patterns over time
- **Sentiment Analysis**: Measure emotional tone of failure stories
- **Network Effects**: Map connections between failed startups
- **Predictive Modeling**: Early warning systems for current startups

## ⚠️ Limitations

- **Data Quality**: Dependent on publicly available information
- **Bias**: May overrepresent well-documented failures
- **Recency**: Some historical failures may be under-represented
- **Attribution**: Source quality varies across the web

## 🤝 Contributing

This agent is designed to be extensible:

1. **Add New Sources**: Modify search strategies for specific data sources
2. **Improve Analysis**: Enhance the AI prompts for better extraction
3. **New Categories**: Add failure classification categories
4. **Export Features**: Build dashboards and reporting tools

*"Those who cannot remember the past are condemned to repeat it."* - George Santayana

Let Cassandra help you learn from the futures that never were.