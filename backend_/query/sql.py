import psycopg2
import psycopg2.extras
import os
from dotenv import load_dotenv

load_dotenv()
conn = psycopg2.connect(os.getenv("POSTGRES_DSN"))

def search_documents(search_terms, language="en"):
    sql = """
    SELECT 
        doc_id,
        title,
        canonical_title,
        tags,
        snippet,
        s3_path
    FROM documents
    WHERE language = %s
    """
    params = [language]

    # Add keyword matching
    for term in search_terms:
        sql += " AND (canonical_title ILIKE %s OR snippet ILIKE %s OR %s = ANY(tags))"
        params += [f"%{term}%", f"%{term}%", term.lower()]

    sql += " LIMIT 20"

    with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
        cur.execute(sql, params)
        return cur.fetchall()
