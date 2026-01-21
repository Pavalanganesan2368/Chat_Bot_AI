import json
import logging
import httpx
import os
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional

# Load environment variables
load_dotenv("../.env")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="ChatBot API", description="Backend for ChatBot with Ollama", version="1.0.0")

# CORS Setup - Allow all for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
# Custom logic for ULLAMA_API if it's a URL
env_api = os.getenv("ULLAMA_API")
OLLAMA_BASE_URL = env_api if env_api and env_api.startswith("http") else "http://localhost:11434"

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    model: str = "llama3"  # Default model
    messages: List[Message]
    stream: bool = True

@app.get("/")
async def root():
    return {"status": "ok", "message": "ChatBot Backend is running"}

@app.post("/api/chat")
async def chat_generate(request: ChatRequest):
    """
    Forward chat requests to the Ollama instance.
    Supports streaming response.
    """
    logger.info(f"Received chat request for model: {request.model}")
    
    ollama_url = f"{OLLAMA_BASE_URL}/api/chat"
    
    # Payload for Ollama
    payload = request.model_dump()
    
    try:
        # We use a timeout because LLM generation can take time
        timeout = httpx.Timeout(60.0, connect=5.0)
        
        async def stream_generator():
            async with httpx.AsyncClient(timeout=timeout) as client:
                try:
                    async with client.stream("POST", ollama_url, json=payload) as response:
                        response.raise_for_status()
                        async for chunk in response.aiter_bytes():
                            yield chunk
                except httpx.ConnectError:
                     # If we can't connect explicitly inside the stream
                     error_msg = json.dumps({"error": f"Could not connect to Ollama at {OLLAMA_BASE_URL}. Is it running?"})
                     yield error_msg.encode('utf-8')
                except Exception as e:
                    logger.error(f"Error during stream: {str(e)}")
                    yield json.dumps({"error": str(e)}).encode('utf-8')

        return StreamingResponse(stream_generator(), media_type="application/x-ndjson")

    except Exception as e:
        logger.error(f"Error setup chat request: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/models")
async def list_models():
    """
    Proxy to list available models from Ollama
    """
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
             raise HTTPException(status_code=500, detail=f"Failed to fetch models: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
