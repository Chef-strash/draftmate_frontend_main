from google.generativeai import GenerativeModel
import google.generativeai as genai
import json, os
from dotenv import load_dotenv
load_dotenv()

genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
model = GenerativeModel("gemini-2.5-flash")

def normalize_query(user_query: str):
    prompt = f"""
Convert this Indian legal drafting request into a structured search hint JSON.

Return **only JSON**, no explanation.

The JSON must follow:
{{
  "search_terms": ["list", "of", "important", "keywords"],
  "language": "en"
}}

User Query: "{user_query}"
"""
    resp = model.generate_content(prompt)
    raw = resp.text.strip()
    if raw.startswith("```"): raw = raw.strip("```json").strip("```")
    return json.loads(raw)

if __name__ == "__main__":
    test_query = "Find contracts related to intellectual property rights in India."
    result = normalize_query(test_query)
    print("Normalized Query:", result)