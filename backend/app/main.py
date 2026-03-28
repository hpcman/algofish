import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
from dotenv import load_dotenv

from app.agents import run_tinyfish_agent
from app.prompts import MASTER_TUTOR_PROMPT

load_dotenv()

app = FastAPI(title="AlgoFish API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

class LearnRequest(BaseModel):
    query: str  # Can be "CF 1503D", "https://leetcode.com/...", or "KMP Algorithm"

@app.post("/api/learn")
async def master_learning_pipeline(request: LearnRequest):
    """
    Scrapes the target, explains it, lists prerequisites, and synthesizes a new problem.
    """
    # 1. Agentic Scraping
    scraped_data = run_tinyfish_agent(request.query)
    
    if not scraped_data:
        raise HTTPException(status_code=500, detail="TinyFish failed to extract data.")

    # 2. OpenAI Processing (The God Mode Prompt)
    try:
        completion = client.chat.completions.create(
            model="gpt-5.4",
            messages=[
                {"role": "system", "content": MASTER_TUTOR_PROMPT},
                {"role": "user", "content": f"Here is the extracted data for the user's query:\n{scraped_data}"}
            ]
        )
        return {"result": completion.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenAI Error: {str(e)}")