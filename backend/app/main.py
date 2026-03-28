import os
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
from dotenv import load_dotenv

from app.agents import run_tinyfish_agent
from app.prompts import MASTER_TUTOR_PROMPT

load_dotenv()
logger = logging.getLogger(__name__)

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

    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY is missing. Set it in backend/.env.")

    # 2. OpenAI Processing (The Master Tutor with extended thinking)
    try:
        response = client.responses.create(
            model="gpt-5.4",
            input=[
                {"role": "system", "content": MASTER_TUTOR_PROMPT},
                {"role": "user", "content": f"Here is the extracted data for the user's query:\n{scraped_data}"},
            ],
            reasoning={
                "effort": "high"
            },
        )
        return {"result": response.output_text}
    except Exception as e:
        logger.exception("OpenAI request failed")
        raise HTTPException(status_code=500, detail=f"OpenAI Error: {str(e)}")