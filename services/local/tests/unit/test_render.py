"""
Unit tests for the render router
"""

import pytest
from unittest.mock import patch, Mock
import httpx
from fastapi import HTTPException

from routers.render import router
from fastapi.testclient import TestClient
from fastapi import FastAPI

app = FastAPI()
app.include_router(router)
test_client = TestClient(app)

class TestRenderRouter:
    
    def test_render_with_parsoid_success(self, mock_config):
        """Test successful rendering via Parsoid"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.text = '<p><strong>Test</strong> content</p>'
        mock_response.json.return_value = {
            'html': '<p><strong>Test</strong> content</p>',
            'dsr': []
        }
        
        with patch('httpx.AsyncClient') as mock_client:
            mock_client.return_value.__aenter__.return_value.post.return_value = mock_response
            
            response = test_client.post('/render', json={
                'wikitext': "'''Test''' content",
                'domain': 'en.wikipedia.org'
            })
            
            assert response.status_code == 200
            result = response.json()
            assert 'html' in result
            assert 'dsr_map' in result
            assert '<strong>Test</strong>' in result['html']

    def test_render_fallback_on_parsoid_failure(self, mock_config):
        """Test fallback to basic rendering when Parsoid fails"""
        with patch('httpx.AsyncClient') as mock_client:
            mock_client.return_value.__aenter__.return_value.post.side_effect = httpx.RequestError("Connection failed")
            
            response = test_client.post('/render', json={
                'wikitext': "'''Bold''' and ''italic'' text",
                'domain': 'en.wikipedia.org'
            })
            
            assert response.status_code == 200
            result = response.json()
            assert 'html' in result
            # Should have fallback HTML
            assert '<strong>Bold</strong>' in result['html']
            assert '<em>italic</em>' in result['html']

    def test_render_with_section_parameter(self, mock_config):
        """Test rendering with section parameter"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.text = '<h2>Section Title</h2><p>Content</p>'
        mock_response.json.return_value = {
            'html': '<h2>Section Title</h2><p>Content</p>',
            'dsr': []
        }
        
        with patch('httpx.AsyncClient') as mock_client:
            mock_client.return_value.__aenter__.return_value.post.return_value = mock_response
            
            response = test_client.post('/render', json={
                'wikitext': '== Section Title ==\nContent',
                'section': 'Section Title'
            })
            
            assert response.status_code == 200
            result = response.json()
            assert '<h2>Section Title</h2>' in result['html']

    def test_render_empty_wikitext(self, mock_config):
        """Test rendering empty wikitext"""
        response = test_client.post('/render', json={
            'wikitext': '',
            'domain': 'en.wikipedia.org'
        })
        
        assert response.status_code == 200
        result = response.json()
        assert result['html'] == '<div class="wiki-content"></div>'

    def test_render_invalid_request(self):
        """Test invalid request handling"""
        response = test_client.post('/render', json={})
        
        assert response.status_code == 422  # Validation error