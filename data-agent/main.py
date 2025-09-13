import os
import asyncio
import json
from typing import List, Dict, Any, Set

import google.generativeai as genai
from openai import AsyncOpenAI
from tavily import TavilyClient
import mysql.connector.aio  # Ensure aio is imported
from settings import settings
# --- Configuration ---
genai.configure(api_key=str(settings.GOOGLE_API_KEY.get_secret_value()))
tavily = TavilyClient(api_key=str(settings.TAVILY_API_KEY.get_secret_value()))
openai_client = AsyncOpenAI(api_key=str(settings.OPENAI_API_KEY.get_secret_value()))
tidb_config = {
    'host': settings.TIDB_HOST,
    'port': int(settings.TIDB_PORT),
    'user': settings.TIDB_USER,
    'password': str(settings.TIDB_PASSWORD.get_secret_value()),
    'database': settings.TIDB_DATABASE,
}

# --- Synchronous Connection Test (No changes here, it's good for debugging) ---
connection = None
try:
    # Use the SYNCHRONOUS connector for a clearer error message
    connection = mysql.connector.connect(**tidb_config)
    
    if connection.is_connected():
        print("\n✅✅✅ SUCCESS: Database connection established! ✅✅✅")
        cursor = connection.cursor()
        cursor.execute("SELECT VERSION();")
        record = cursor.fetchone()
        print(f"Database version: {record[0]}")
        cursor.close()
    else:
        print("\n❌❌❌ FAILURE: Connection object created, but not connected. ❌❌❌")

except mysql.connector.Error as err:
    print(f"\n❌❌❌ FAILURE: A mysql.connector error occurred: {err} ❌❌❌")
    print("--- DEBUGGING CHECKLIST ---")
    print("1. Is your IP address whitelisted in the TiDB Cloud console?")
    print("2. Are the HOST, USER, and PASSWORD in your .env file 100% correct (no typos, no extra spaces)?")
    print("3. Is your cluster 'Available' and not 'Paused' or 'Creating'?")

finally:
    if connection and connection.is_connected():
        connection.close()
        print("\nConnection closed.")

# --- Agent Parameters ---
RESEARCH_ITERATIONS = 30
BATCH_SIZE = 5
SEMAPHORE = asyncio.Semaphore(5)
SEED_TOPICS = [
    "Y Combinator startup post-mortems", "TechCrunch deadpool analysis",
    "CB Insights startup failure reports", "failed SaaS companies 2022",
    "post-mortems of venture-backed startups", "failed fintech startups analysis",
    "why did D2C brands shut down", "biggest gaming startup failures",
    "failed HealthTech companies case studies", "top EdTech startup failures"
]

# --- MODIFIED: Connection Management ---
async def get_db_connection():
    """Creates and returns a new async database connection."""
    try:
        # Use the async connector directly instead of a pool
        conn = await mysql.connector.aio.connect(**tidb_config)
        return conn
    except Exception as e:
        print(f"❌ Failed to create a new connection: {e}")
        raise

async def safe_close_connection(conn):
    """Safely close a database connection"""
    try:
        if conn and conn.is_connected():
            await conn.close()
    except Exception as e:
        print(f"⚠️ Error closing connection: {e}")

# --- Agent Components (Now with proper cursor handling) ---
async def seed_frontier():
    """Seed the research frontier with initial topics"""
    print("🌱 Seeding the research frontier...")
    conn = None
    try:
        conn = await get_db_connection()
        cursor = await conn.cursor()  # FIXED: Await the cursor creation
        try:
            for topic in SEED_TOPICS:
                await cursor.execute("INSERT IGNORE INTO search_frontier (query, status) VALUES (%s, 'pending')", (topic,))
            await conn.commit()
            print("✅ Frontier seeded.")
        finally:
            await cursor.close()  # Always close the cursor
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
        cursor = await conn.cursor(dictionary=True)  # FIXED: Await the cursor creation
        try:
            await cursor.execute("SELECT query FROM search_frontier WHERE status = 'pending' LIMIT %s", (limit,))
            tasks = await cursor.fetchall()
            return [task['query'] for task in tasks]
        finally:
            await cursor.close()
    except Exception as e:
        print(f"❌ Error fetching tasks: {e}")
        return []
    finally:
        await safe_close_connection(conn)

async def analyst_agent(query: str, search_results: List[Dict]) -> List[Dict]:
    """UPGRADED Analyst Stage: Extracts detailed data including the source URL."""
    print(f"  -> Analyzing (Pro): {query}")
    model = genai.GenerativeModel(settings.GEMINI_MODEL_NAME, generation_config={"response_mime_type": "application/json"})
    
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
        6.  "source_url": string

        IMPORTANT: Ensure all string values are properly escaped for valid JSON output.

        Context from web search:
        ---
        {context[:100000]} 
        ---
    """
    try:
        response = await model.generate_content_async(prompt)
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
        cursor = await conn.cursor()  # FIXED: Await the cursor creation
        try:
            for query in new_queries:
                await cursor.execute("INSERT IGNORE INTO search_frontier (query, status) VALUES (%s, 'pending')", (query,))
            await conn.commit()
            print(f"✅ Added {len(new_queries)} new queries to the frontier.")
        finally:
            await cursor.close()
        
    except Exception as e:
        print(f"  -> ❌ Expand Frontier Error: {e}")
    finally:
        await safe_close_connection(conn)

async def loader_task(case: Dict, existing_companies: Set[str]):
    """Load a single case into the database"""
    company_name = case.get("company_name", "").strip()
    if not company_name or company_name.lower() in existing_companies:
        return 0
    
    text_to_embed = f"""
    {case.get('what_they_did', '')} 
    {case.get('what_went_wrong', '')} 
    {case.get('what_went_wrong', '')}  # Repeat important parts
    {case.get('key_takeaway', '')}
    """
    if not text_to_embed:
        return 0

    conn = None
    try:
        embedding_response = await openai_client.embeddings.create(model="text-embedding-3-small", input=text_to_embed)
        embedding = embedding_response.data[0].embedding
        
        conn = await get_db_connection()
        cursor = await conn.cursor()  # FIXED: Await the cursor creation
        try:
            await cursor.execute(
                """
                INSERT INTO startup_failures 
                (company_name, failure_reason, summary, what_they_did, what_went_wrong, key_takeaway, source_url, summary_vector) 
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    company_name, 
                    case.get('failure_reason_category'), 
                    case.get('what_they_did'),
                    case.get('what_they_did'), 
                    case.get('what_went_wrong'), 
                    case.get('key_takeaway'),
                    case.get('source_url'),
                    json.dumps(embedding)
                )
            )
            await conn.commit()
            print(f"    -> ✅ Stored: {company_name} (from {case.get('source_url')})")
            return 1
        finally:
            await cursor.close()
        
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
        cursor = await conn.cursor()  # FIXED: Await the cursor creation
        try:
            await cursor.execute("SELECT LOWER(company_name) FROM startup_failures")
            result = await cursor.fetchall()
            return {row[0] for row in result}
        finally:
            await cursor.close()
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
        cursor = await conn.cursor()  # FIXED: Await the cursor creation
        try:
            for query in tasks_to_run:
                await cursor.execute("UPDATE search_frontier SET status = 'completed' WHERE query = %s", (query,))
            await conn.commit()
        finally:
            await cursor.close()
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
        cursor = await conn.cursor()  # FIXED: Await the cursor creation
        try:
            await cursor.execute("DELETE FROM search_frontier")
            await conn.commit()
        finally:
            await cursor.close()
    except Exception as e:
        print(f"❌ Error resetting agent state: {e}")
        raise
    finally:
        await safe_close_connection(conn)

# --- Main Orchestrator ---
async def main():
    total_startups_found = 0
    
    print("--- Starting Cassandra Industrial Research Agent (URL-Aware Edition) ---")
    
    try:
        # Test connection first (now using the async connector)
        print("🧪 Performing initial async connection test...")
        test_conn = await get_db_connection()
        await safe_close_connection(test_conn)
        print("✅ Async database connection test successful.")

        await reset_agent_state()
        await seed_frontier()
        
        for i in range(RESEARCH_ITERATIONS):
            print(f"\n--- 🔄 Starting Research Iteration {i+1}/{RESEARCH_ITERATIONS} ---")
            
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

            pipeline_tasks = [research_and_analyze_task(query) for query in tasks_to_run]
            results_from_pipelines = await asyncio.gather(*pipeline_tasks, return_exceptions=True)
            
            all_new_cases = []
            for result in results_from_pipelines:
                if isinstance(result, Exception):
                    print(f"  -> ❌ Pipeline task failed: {result}")
                else:
                    all_new_cases.extend(result)

            print(f"  -> Found {len(all_new_cases)} potential cases. Loading new ones into TiDB...")
            
            loader_tasks = [loader_task(case, existing_companies) for case in all_new_cases]
            results = await asyncio.gather(*loader_tasks, return_exceptions=True)
            
            newly_added_count = sum(r for r in results if isinstance(r, int) and r > 0)
            total_startups_found += newly_added_count
            print(f"  -> Stored {newly_added_count} new startups. Total in DB: {initial_count + newly_added_count}")

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