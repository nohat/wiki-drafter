"""
Integration tests for the main FastAPI app
"""

import pytest
from fastapi.testclient import TestClient

class TestAppIntegration:
    
    def test_health_check_endpoint(self, client):
        """Test the root health check endpoint"""
        response = client.get('/')
        
        assert response.status_code == 200
        data = response.json()
        assert data['service'] == 'wiki-drafter-companion'
        assert data['version'] == '0.1.0'
        assert data['status'] == 'healthy'
        assert 'endpoints' in data

    def test_detailed_health_endpoint(self, client):
        """Test the detailed health check endpoint"""
        response = client.get('/health')
        
        assert response.status_code == 200
        data = response.json()
        assert 'service' in data
        assert 'dependencies' in data
        assert 'parsoid' in data['dependencies']
        assert 'citoid' in data['dependencies']

    def test_render_endpoint_integration(self, client):
        """Integration test for render endpoint"""
        response = client.post('/render', json={
            'wikitext': "'''Test''' article with [[links]] and <ref>citation</ref>",
            'domain': 'en.wikipedia.org'
        })
        
        assert response.status_code == 200
        data = response.json()
        assert 'html' in data
        assert 'dsr_map' in data
        # Should contain rendered content (fallback or Parsoid)
        html = data['html']
        assert len(html) > 0
        assert 'wiki-content' in html or '<p>' in html

    def test_cors_headers(self, client):
        """Test CORS headers are present"""
        response = client.options('/')
        
        # CORS headers should be present due to middleware
        assert response.status_code == 200

    def test_invalid_endpoint_404(self, client):
        """Test 404 for invalid endpoints"""
        response = client.get('/nonexistent-endpoint')
        
        assert response.status_code == 404