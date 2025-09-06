from unittest.mock import Mock, patch

from fastapi.testclient import TestClient

from app import app

client = TestClient(app)


def test_health_dependency_exceptions():
    """Health check handles exceptions from dependencies and still returns 200."""
    async def _raise_request_error(*args, **kwargs):
        raise Exception("boom")

    with patch("httpx.AsyncClient.get", side_effect=_raise_request_error):
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert "service" in data
        assert "dependencies" in data
        # When both checks fail, both should be marked unreachable
        assert data["dependencies"]["parsoid"]["status"] in {"unreachable", "unhealthy"}
        assert data["dependencies"]["citoid"]["status"] in {"unreachable", "unhealthy"}


def test_health_non_200_unhealthy():
    """Health check marks non-200 responses as unhealthy."""
    mock_response = Mock()
    mock_response.status_code = 500

    class _Client:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

        async def get(self, *args, **kwargs):
            return mock_response

    with patch("httpx.AsyncClient", return_value=_Client()):
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["dependencies"]["parsoid"]["status"] == "unhealthy"
        assert data["dependencies"]["citoid"]["status"] == "unhealthy"
