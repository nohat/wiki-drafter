#!/usr/bin/env python3
"""
Wiki-Drafter Companion Service

This service provides backend functionality for the Wiki-Drafter VS Code extension,
including Parsoid rendering, citation normalization, archiving, and source quality scoring.
"""

import json
import logging
import os
from pathlib import Path
from typing import Any

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import archive, citoid, copyvio, render, score

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Wiki-Drafter Companion Service",
    description="Backend service for Wikipedia drafting with AI assistance",
    version="0.1.0"
)

# CORS middleware for VS Code extension communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this to specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
# The render router already exposes '/render' paths
app.include_router(render.router, tags=["rendering"])
app.include_router(citoid.router, prefix="/citoid", tags=["citations"])
app.include_router(archive.router, prefix="/archive", tags=["archiving"])
app.include_router(copyvio.router, prefix="/copyvio", tags=["copyvio"])
app.include_router(score.router, prefix="/score", tags=["scoring"])

# Global configuration
class Config:
    def __init__(self):
        self.parsoid_endpoint = os.getenv('PARSOID_ENDPOINT', 'http://localhost:8142')
        self.citoid_endpoint = os.getenv('CITOID_ENDPOINT', 'http://localhost:1970')
        self.wayback_endpoint = os.getenv('WAYBACK_ENDPOINT', 'https://web.archive.org')
        self.rsp_cache_file = Path(__file__).parent / 'rsp_cache.json'
        self.sources_file = Path(__file__).parent / 'sources.json'
        
        # Load RSP cache
        self.rsp_cache = self._load_json_file(self.rsp_cache_file, {})
        self.sources = self._load_json_file(self.sources_file, {})
    
    def _load_json_file(self, file_path: Path, default: Any) -> Any:
        try:
            if file_path.exists():
                with open(file_path, encoding='utf-8') as f:
                    return json.load(f)
        except Exception as e:
            logger.warning(f"Failed to load {file_path}: {e}")
        return default
    
    def save_rsp_cache(self):
        try:
            with open(self.rsp_cache_file, 'w', encoding='utf-8') as f:
                json.dump(self.rsp_cache, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save RSP cache: {e}")
    
    def save_sources(self):
        try:
            with open(self.sources_file, 'w', encoding='utf-8') as f:
                json.dump(self.sources, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error(f"Failed to save sources: {e}")

# Global config instance
config = Config()

@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "service": "wiki-drafter-companion",
        "version": "0.1.0",
        "status": "healthy",
        "endpoints": {
            "render": "/render",
            "citoid": "/citoid", 
            "archive": "/archive",
            "copyvio": "/copyvio",
            "score": "/score"
        }
    }

@app.options("/")
async def root_options():
    """CORS preflight for root; ensures OPTIONS / returns 200 in tests."""
    return {"ok": True}

@app.get("/health")
async def health_check():
    """Detailed health check with dependency status."""
    health_status = {
        "service": "healthy",
        "dependencies": {}
    }
    
    # Check Parsoid
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{config.parsoid_endpoint}/")
            health_status["dependencies"]["parsoid"] = {
                "status": "healthy" if response.status_code == 200 else "unhealthy",
                "endpoint": config.parsoid_endpoint
            }
    except Exception as e:
        health_status["dependencies"]["parsoid"] = {
            "status": "unreachable",
            "endpoint": config.parsoid_endpoint,
            "error": str(e)
        }
    
    # Check Citoid
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{config.citoid_endpoint}/")
            health_status["dependencies"]["citoid"] = {
                "status": "healthy" if response.status_code == 200 else "unhealthy",
                "endpoint": config.citoid_endpoint
            }
    except Exception as e:
        health_status["dependencies"]["citoid"] = {
            "status": "unreachable",
            "endpoint": config.citoid_endpoint,
            "error": str(e)
        }
    
    return health_status

# Make config available to routers
app.state.config = config

if __name__ == "__main__":
    import uvicorn
    
    # Development server
    uvicorn.run(
        "app:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        log_level="info"
    )