import os
import asyncio
import json
from typing import List, Dict, Any, Set

import google.generativeai as genai
from openai import AsyncOpenAI
from tavily import TavilyClient
import mysql.connector.aio
from mysql.connector.aio import pooling
from dotenv import load_dotenv

# --- Configuration ---
load_dotenv()
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
tavily = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))
openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
tidb_config = {
    'host': os.getenv('TIDB_HOST'), 'port': int(os.getenv('TIDB_PORT', 4000)),
    'user': os.getenv('TIDB_USER'), 'password': os.getenv('TIDB_PASSWORD'),
    'database': os.getenv('TIDB_DATABASE'), 'ssl_verify_cert': True, 'ssl_verify_identity': True,
}

# --- Agent Parameters ---
RESEARCH_ITERATIONS = 10
BATCH_SIZE = 5
SEMAPHORE = asyncio.Semaphore(5)  # Reduced from 10 to be more conservative
SEED_TOPICS = [
    "Y Combinator startup post-mortems", "TechCrunch deadpool analysis",
    "CB Insights startup failure reports", "failed SaaS companies 2022",
    "post-mortems of venture-backed startups", "failed fintech startups analysis",
    "why did D2C brands shut down", "biggest gaming startup failures",
    "failed HealthTech companies case studies", "top EdTech startup failures"
]

# Global pool variable
db_pool = None

async def get_db_connection():
    """Get a database connection with proper error handling and debugging"""
    global db_pool
    try:
        conn = await db_pool.get_connection()
        print(f"🔗 Got connection. Pool stats: {db_pool.pool_size - len(db_pool._cnx_queue._queue)} connections in use")
        return conn
    except Exception as e:
        print(f"❌ Failed to get connection: {e}")
        print(f"Pool size: {db_pool.pool_size}, Queue size: {len(db_pool._cnx_queue._queue)}")
        raise

async def safe_close_connection(conn):
    """Safely close a database connection"""
    try:
        if conn and conn.is_connected():
            await conn.close()
            print("🔌 Connection closed successfully")
    except Exception as e:
        print(f"⚠️ Error closing connection: {e}")

# --- Agent Components ---
async def seed_frontier():
    """Seed the research frontier with initial topics"""
    print("🌱 Seeding the research frontier...")
    conn = None
    try:
        conn = await get_db_connection()
        async with await conn.cursor() as cursor:
            for topic in SEED_TOPICS:
                await cursor.execute("INSERT IGNORE INTO search_frontier (query, status) VALUES (%s, 'pending')", (topic,))
            await conn.commit()
        print("✅ Frontier seeded.")
    except Exception as e:
        print(f"❌ Error seeding frontier: {e}")
        raise
    finally:
        await safe_close_connection(conn)

async def fetch_tasks_from_frontier(limit: int) -> List[str]:
    """Fetch pending tasks from the frontier"""
    conn = None
    try:
        conn = await get_db_connection()
        async with await conn.cursor(dictionary=True) as cursor:
            await cursor.execute("SELECT query FROM search_frontier WHERE status = 'pending' LIMIT %s", (limit,))
            tasks = await cursor.fetchall()
            return [task['query'] for task in tasks]
    except Exception as e:
        print(f"❌ Error fetching tasks: {e}")
        return []
    finally:
        await safe_close_connection(conn)

async def analyst_agent(query: str, search_results: List[Dict]) -> List[Dict]:
    """UPGRADED Analyst Stage: Extracts detailed data including the source URL."""
    print(f"  -> Analyzing (Pro): {query}")
    model = genai.GenerativeModel('gemini-1.5-pro-latest', generation_config={"response_mime_type": "application/json"})
    
    # Context now includes a clear 'Source URL' for each piece of content
    context = "\n\n".join([f"Source URL: {res['url']}\nContent: {res['content']}" for res in search_results])
    
    prompt = f"""
        You are a meticulous business analyst. Your task is to analyze the provided web search results about failed startups for the query "{query}".
        From the context, identify all distinct failed startups and extract detailed information for each one. For each failure, you MUST include its original source URL.

        Your output MUST be a valid JSON object with a single key "failures", which is a list of objects.
        Each object in the list MUST have the following SIX keys:
        1.  "company_name": string
        2.  "failure_reason_category": string
        3.  "what_they_did": string
        4.  "what_went_wrong": string
        5.  "key_takeaway": string
        6.  "source_url": string  // <-- ADDED KEY: The URL from the 'Source URL' line in the context.

        IMPORTANT: Ensure all string values are properly escaped for valid JSON output.

        Context from web search:
        ---
        {context[:100000]} 
        ---
    """
    try:
        response = await model.generate_content_async(prompt)
        # Clean the response text to ensure it's valid JSON
        cleaned_text = response.text.strip().replace("```json", "").replace("```", "")
        return json.loads(cleaned_text).get("failures", [])
    except Exception as e:
        print(f"  -> ❌ Analyst Agent Error for '{query}': {e}")
        return []

async def expand_frontier(new_cases: List[Dict]):
    """Expand the search frontier with new queries"""
    if not new_cases: 
        return
    
    print("🧠 Expanding frontier with new, more specific search queries...")
    model = genai.GenerativeModel('gemini-1.5-pro-latest')
    context = "\n".join([f"- {case['company_name']}: {case.get('what_went_wrong', case.get('summary', ''))}" for case in new_cases[:10]])
    prompt = f"""
    Based on these summaries of recently discovered failed startups, generate 5 new, highly specific search queries to find similar stories or dig deeper.
    Return a simple list of queries, one per line.
    Discovered startups: --- {context} ---
    """
    
    conn = None
    try:
        response = await model.generate_content_async(prompt)
        new_queries = [q.strip() for q in response.text.split('\n') if q.strip() and not q.strip().startswith('-')]
        
        conn = await get_db_connection()
        async with await conn.cursor() as cursor:
            for query in new_queries:
                await cursor.execute("INSERT IGNORE INTO search_frontier (query, status) VALUES (%s, 'pending')", (query,))
            await conn.commit()
        print(f"✅ Added {len(new_queries)} new queries to the frontier.")
        
    except Exception as e:
        print(f"  -> ❌ Expand Frontier Error: {e}")
    finally:
        await safe_close_connection(conn)

async def loader_task(case: Dict, existing_companies: Set[str]):
    """Load a single case into the database"""
    company_name = case.get("company_name", "").strip()
    if not company_name or company_name.lower() in existing_companies:
        return 0
    
    text_to_embed = case.get("what_went_wrong")
    if not text_to_embed:
        return 0

    conn = None
    try:
        # Get embedding first (no DB connection needed)
        embedding_response = await openai_client.embeddings.create(model="text-embedding-3-small", input=text_to_embed)
        embedding = embedding_response.data[0].embedding
        
        # Then handle database operation
        conn = await get_db_connection()
        async with await conn.cursor() as cursor:
            await cursor.execute(
                """
                INSERT INTO startup_failures 
                (company_name, failure_reason, summary, what_they_did, what_went_wrong, key_takeaway, sourceUrl, summary_vector) 
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    company_name, 
                    case.get('failure_reason_category'), 
                    case.get('what_they_did'), # Using detailed field as summary
                    case.get('what_they_did'), 
                    case.get('what_went_wrong'), 
                    case.get('key_takeaway'),
                    case.get('source_url'),    # <-- ADDED VALUE
                    json.dumps(embedding)
                )
            )
            await conn.commit()
        print(f"    -> ✅ Stored: {company_name} (from {case.get('source_url')})")
        return 1
        
    except Exception as e:
        print(f"    -> ❌ Loader Error for '{company_name}': {e}")
        return 0
    finally:
        await safe_close_connection(conn)

async def get_existing_companies() -> Set[str]:
    """Get existing companies from database"""
    conn = None
    try:
        conn = await get_db_connection()
        async with await conn.cursor() as cursor:
            await cursor.execute("SELECT LOWER(company_name) FROM startup_failures")
            result = await cursor.fetchall()
            return {row[0] for row in result}
    except Exception as e:
        print(f"❌ Error getting existing companies: {e}")
        return set()
    finally:
        await safe_close_connection(conn)

async def update_completed_tasks(tasks_to_run: List[str]):
    """Update task status to completed"""
    conn = None
    try:
        conn = await get_db_connection()
        async with await conn.cursor() as cursor:
            for query in tasks_to_run:
                await cursor.execute("UPDATE search_frontier SET status = 'completed' WHERE query = %s", (query,))
            await conn.commit()
    except Exception as e:
        print(f"❌ Error updating completed tasks: {e}")
    finally:
        await safe_close_connection(conn)

async def reset_agent_state():
    """Reset agent state for a fresh run"""
    print("🧹 Resetting agent state for a fresh run...")
    conn = None
    try:
        conn = await get_db_connection()
        async with await conn.cursor() as cursor:
            await cursor.execute("DELETE FROM search_frontier")
            await conn.commit()
    except Exception as e:
        print(f"❌ Error resetting agent state: {e}")
        raise
    finally:
        await safe_close_connection(conn)

# --- Main Orchestrator ---
async def main():
    global db_pool
    total_startups_found = 0  # Initialize at the top
    
    print("--- Starting Cassandra Industrial Research Agent (URL-Aware Edition) ---")
    
    try:
        # Create connection pool with more conservative settings
        db_pool = pooling.MySQLConnectionPool(
            pool_name="tidb_pool", 
            pool_size=5,  # Reduced from 10
            pool_reset_session=True,
            **tidb_config
        )
        print("✅ Database connection pool created.")

        # Test connection first
        test_conn = await get_db_connection()
        await safe_close_connection(test_conn)
        print("✅ Database connection test successful.")

        # Reset and seed with proper connection handling
        await reset_agent_state()
        await seed_frontier()
        
        for i in range(RESEARCH_ITERATIONS):
            print(f"\n--- 🔄 Starting Research Iteration {i+1}/{RESEARCH_ITERATIONS} ---")
            
            # Get existing companies and tasks
            existing_companies = await get_existing_companies()
            initial_count = len(existing_companies)
            tasks_to_run = await fetch_tasks_from_frontier(BATCH_SIZE)
            
            if not tasks_to_run:
                print("🏁 No more tasks in the frontier. Agent has completed its mission.")
                break

            async def research_and_analyze_task(query):
                async with SEMAPHORE:
                    try:
                        results = await asyncio.to_thread(tavily.search, query=query, search_depth="advanced", max_results=7)
                        if not results or not results.get('results'): 
                            return []
                        return await analyst_agent(query, results['results'])
                    except Exception as e:
                        print(f"  -> ❌ Research Error for '{query}': {e}")
                        return []

            # Execute research tasks
            pipeline_tasks = [research_and_analyze_task(query) for query in tasks_to_run]
            results_from_pipelines = await asyncio.gather(*pipeline_tasks, return_exceptions=True)
            
            # Handle exceptions in results
            all_new_cases = []
            for result in results_from_pipelines:
                if isinstance(result, Exception):
                    print(f"  -> ❌ Pipeline task failed: {result}")
                else:
                    all_new_cases.extend(result)

            print(f"  -> Found {len(all_new_cases)} potential cases. Loading new ones into TiDB...")
            
            # Load cases with limited concurrency
            loader_tasks = [loader_task(case, existing_companies) for case in all_new_cases]
            results = await asyncio.gather(*loader_tasks, return_exceptions=True)
            
            # Count successful insertions
            newly_added_count = sum(r for r in results if isinstance(r, int) and r > 0)
            total_startups_found += newly_added_count
            print(f"  -> Stored {newly_added_count} new startups. Total in DB: {initial_count + newly_added_count}")

            # Update completed tasks and expand frontier
            await update_completed_tasks(tasks_to_run)
            await expand_frontier(all_new_cases)

    except Exception as e:
        print(f"❌ Main loop error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        print(f"\n--- AGENT FINISHED - Total startups found: {total_startups_found} ---")

if __name__ == "__main__":
    asyncio.run(main())