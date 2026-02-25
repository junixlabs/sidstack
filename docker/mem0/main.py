"""
Minimal mem0 REST API server.

LLM + embeddings routed through LiteLLM proxy for provider flexibility.
Vector store: Qdrant.
"""

import os
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, Header, HTTPException, Query
from pydantic import BaseModel
from mem0 import Memory

load_dotenv()

QDRANT_HOST = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", "6333"))
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY", "")
QDRANT_COLLECTION = os.getenv("QDRANT_COLLECTION", "sidstack_mem0")
LITELLM_BASE_URL = os.getenv("LITELLM_BASE_URL", "http://localhost:4000/v1")
LITELLM_API_KEY = os.getenv("LITELLM_API_KEY", "sk-sidstack-dev")
LLM_MODEL = os.getenv("LLM_MODEL", "gemini-flash")
EMBED_MODEL = os.getenv("EMBED_MODEL", "gemini-embedding")

qdrant_config: dict = {
    "collection_name": QDRANT_COLLECTION,
    "url": f"http://{QDRANT_HOST}:{QDRANT_PORT}",
}
if QDRANT_API_KEY:
    qdrant_config["api_key"] = QDRANT_API_KEY

config = {
    "llm": {
        "provider": "openai",
        "config": {
            "model": LLM_MODEL,
            "api_key": LITELLM_API_KEY,
            "temperature": 0.1,
            "max_tokens": 1000,
        },
    },
    "embedder": {
        "provider": "openai",
        "config": {
            "model": EMBED_MODEL,
            "api_key": LITELLM_API_KEY,
            "openai_base_url": LITELLM_BASE_URL,
        },
    },
    "vector_store": {
        "provider": "qdrant",
        "config": qdrant_config,
    },
}

MEM0_API_KEY = os.getenv("MEM0_API_KEY", "")

memory = Memory.from_config(config)
app = FastAPI(title="mem0 API (LiteLLM)")


# ── Auth ───────────────────────────────────────────────
def verify_api_key(authorization: str = Header(None)):
    if not MEM0_API_KEY:
        return  # no key configured = no auth (dev mode)
    if not authorization or authorization != f"Bearer {MEM0_API_KEY}":
        raise HTTPException(status_code=401, detail="Invalid API key")


def verify_ownership(memory_id: str, user_id: str):
    result = memory.get(memory_id)
    if not result:
        raise HTTPException(status_code=404, detail="Memory not found")
    if result.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return result


# ── Models ──────────────────────────────────────────────
class AddMemoryRequest(BaseModel):
    messages: list[dict]
    user_id: str
    agent_id: str | None = None
    run_id: str | None = None
    metadata: dict | None = None


class SearchRequest(BaseModel):
    query: str
    user_id: str
    agent_id: str | None = None
    limit: int = 10
    metadata_filter: dict | None = None


# ── Routes ──────────────────────────────────────────────
@app.get("/")
def root():
    return {
        "status": "ok",
        "gateway": "litellm",
        "llm_model": LLM_MODEL,
        "embed_model": EMBED_MODEL,
    }


@app.post("/v1/memories/", dependencies=[Depends(verify_api_key)])
def add_memory(req: AddMemoryRequest):
    result = memory.add(
        messages=req.messages,
        user_id=req.user_id,
        agent_id=req.agent_id,
        run_id=req.run_id,
        metadata=req.metadata or {},
    )
    return result


@app.post("/v1/memories/search/", dependencies=[Depends(verify_api_key)])
def search_memories(req: SearchRequest):
    kwargs = dict(
        query=req.query,
        user_id=req.user_id,
        agent_id=req.agent_id,
        limit=req.limit,
    )
    if req.metadata_filter:
        kwargs["filters"] = req.metadata_filter
    results = memory.search(**kwargs)
    return {"results": results}


@app.get("/v1/memories/", dependencies=[Depends(verify_api_key)])
def list_memories(user_id: str = Query(...), agent_id: str | None = None):
    results = memory.get_all(user_id=user_id, agent_id=agent_id)
    return {"results": results}


@app.get("/v1/memories/{memory_id}/", dependencies=[Depends(verify_api_key)])
def get_memory(memory_id: str, user_id: str = Query(...)):
    verify_ownership(memory_id, user_id)
    result = memory.get(memory_id)
    return result


@app.put("/v1/memories/{memory_id}/", dependencies=[Depends(verify_api_key)])
def update_memory(memory_id: str, data: dict, user_id: str = Query(...)):
    verify_ownership(memory_id, user_id)
    result = memory.update(memory_id, data=data.get("data", ""))
    return result


@app.delete("/v1/memories/{memory_id}/", dependencies=[Depends(verify_api_key)])
def delete_memory(memory_id: str, user_id: str = Query(...)):
    verify_ownership(memory_id, user_id)
    memory.delete(memory_id)
    return {"status": "deleted"}


@app.get("/v1/memories/{memory_id}/history/", dependencies=[Depends(verify_api_key)])
def memory_history(memory_id: str, user_id: str = Query(...)):
    verify_ownership(memory_id, user_id)
    history = memory.history(memory_id)
    return history
