"""
Pytest configuration and fixtures for the Wiki-Drafter service tests
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch
import sys
import os

# Add the parent directory to the path so we can import the app
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app, config

@pytest.fixture
def client():
    """Test client for FastAPI app"""
    return TestClient(app)

@pytest.fixture
def mock_config():
    """Mock configuration for tests"""
    with patch('app.config') as mock:
        mock.parsoid_endpoint = 'http://mock-parsoid:8142'
        mock.citoid_endpoint = 'http://mock-citoid:1970'
        mock.wayback_endpoint = 'https://mock-wayback.org'
        mock.rsp_cache = {}
        mock.sources = {}
        yield mock

@pytest.fixture
def sample_wikitext():
    """Sample wikitext for testing"""
    return """{{Infobox person
| name = Test Person
| birth_date = 1985
}}

'''Test Person''' is a fictional character. She was born in 1985.<ref name="bio">{{cite web|url=https://example.com|title=Biography}}</ref>

== Career ==
She works as a scientist. Her research focuses on climate change.
"""

@pytest.fixture
def sample_claims():
    """Sample claims data for testing"""
    return [
        {
            "id": "c_1",
            "section": "Introduction", 
            "start": 100,
            "end": 180,
            "text": "She was born in 1985.",
            "type": "BLP",
            "risk": "medium",
            "requires_inline": True,
            "existing_refs": ["bio"],
            "status": "supported",
            "sources": ["bio"]
        },
        {
            "id": "c_2", 
            "section": "Career",
            "start": 200,
            "end": 280,
            "text": "Her research focuses on climate change.",
            "type": "general",
            "risk": "low", 
            "requires_inline": False,
            "existing_refs": [],
            "status": "unsupported",
            "sources": []
        }
    ]