"""
Cosilium-LLM: API Tests
Тесты для FastAPI endpoints
"""

import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from src.api.main import api, tasks_store


@pytest.fixture
def client():
    """FastAPI test client"""
    return TestClient(api)


@pytest.fixture(autouse=True)
def clear_tasks_store():
    """Clear tasks store before each test"""
    tasks_store.clear()
    yield
    tasks_store.clear()


class TestHealthEndpoints:
    """Тесты для health endpoints"""

    def test_root(self, client):
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["service"] == "Cosilium-LLM"

    def test_health(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "agents" in data

    def test_agents_list(self, client):
        response = client.get("/agents")
        assert response.status_code == 200
        data = response.json()
        assert "chatgpt" in data
        assert "claude" in data
        assert "gemini" in data
        assert "deepseek" in data


class TestAnalyzeEndpoint:
    """Тесты для /analyze endpoint"""

    def test_analyze_validation(self, client):
        # Missing required field
        response = client.post("/analyze", json={})
        assert response.status_code == 422

    def test_analyze_invalid_task_type(self, client):
        response = client.post(
            "/analyze",
            json={"task": "Test", "task_type": "invalid"},
        )
        assert response.status_code == 422

    @pytest.mark.unit
    def test_analyze_success(self, client, sample_state):
        with patch("src.api.main.langgraph_app") as mock_app:
            mock_app.ainvoke = AsyncMock(return_value=sample_state)

            response = client.post(
                "/analyze",
                json={
                    "task": "Test task",
                    "task_type": "research",
                    "context": "Test context",
                    "max_iterations": 2,
                },
            )

            assert response.status_code == 200
            data = response.json()
            assert "task" in data
            assert "analyses" in data
            assert "synthesis" in data

    @pytest.mark.unit
    def test_analyze_error_handling(self, client):
        with patch("src.api.main.langgraph_app") as mock_app:
            mock_app.ainvoke = AsyncMock(side_effect=Exception("LLM Error"))

            response = client.post(
                "/analyze",
                json={"task": "Test task"},
            )

            assert response.status_code == 500
            assert "LLM Error" in response.json()["detail"]


class TestAsyncAnalyzeEndpoint:
    """Тесты для /analyze/async endpoint"""

    def test_async_analyze_returns_task_id(self, client):
        response = client.post(
            "/analyze/async",
            json={"task": "Test task"},
        )

        assert response.status_code == 200
        data = response.json()
        assert "task_id" in data
        assert data["status"] == "pending"

    def test_async_analyze_creates_task(self, client):
        response = client.post(
            "/analyze/async",
            json={"task": "Test task"},
        )

        task_id = response.json()["task_id"]
        assert task_id in tasks_store
        assert tasks_store[task_id]["status"] == "pending"


class TestTasksEndpoint:
    """Тесты для /tasks/{task_id} endpoint"""

    def test_get_nonexistent_task(self, client):
        response = client.get("/tasks/nonexistent-id")
        assert response.status_code == 404

    def test_get_existing_task(self, client):
        # Create a task
        tasks_store["test-task-id"] = {
            "status": "completed",
            "input": {"task": "Test"},
            "result": {"summary": "Done"},
            "error": None,
        }

        response = client.get("/tasks/test-task-id")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "completed"

    def test_get_running_task(self, client):
        tasks_store["running-task"] = {
            "status": "running",
            "input": {"task": "Test"},
            "result": None,
            "error": None,
        }

        response = client.get("/tasks/running-task")
        assert response.status_code == 200
        assert response.json()["status"] == "running"

    def test_get_failed_task(self, client):
        tasks_store["failed-task"] = {
            "status": "failed",
            "input": {"task": "Test"},
            "result": None,
            "error": "Something went wrong",
        }

        response = client.get("/tasks/failed-task")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "failed"
        assert data["error"] == "Something went wrong"


class TestStreamEndpoint:
    """Тесты для /analyze/stream endpoint"""

    def test_stream_endpoint_exists(self, client):
        # Just test that the endpoint exists and accepts requests
        # Full streaming test would require async client
        with patch("src.api.main.langgraph_app") as mock_app:
            async def mock_stream(*args, **kwargs):
                yield {"test": "event"}

            mock_app.astream = mock_stream

            response = client.get(
                "/analyze/stream",
                params={"task": "Test task"},
            )

            # Should return streaming response
            assert response.status_code == 200
            assert "text/event-stream" in response.headers.get("content-type", "")


class TestInputValidation:
    """Тесты валидации входных данных"""

    def test_empty_task(self, client):
        response = client.post(
            "/analyze",
            json={"task": ""},
        )
        # Empty string should be rejected by Pydantic
        # depending on model configuration
        assert response.status_code in [200, 422]

    def test_max_iterations_bounds(self, client):
        # Too many iterations
        response = client.post(
            "/analyze",
            json={"task": "Test", "max_iterations": 10},
        )
        assert response.status_code == 422

        # Zero iterations
        response = client.post(
            "/analyze",
            json={"task": "Test", "max_iterations": 0},
        )
        assert response.status_code == 422

    def test_valid_task_types(self, client):
        valid_types = ["strategy", "research", "investment", "development", "audit"]

        for task_type in valid_types:
            with patch("src.api.main.langgraph_app") as mock_app:
                mock_app.ainvoke = AsyncMock(return_value={
                    "task": "Test",
                    "task_type": task_type,
                    "context": "",
                    "analyses": [],
                    "critiques": [],
                    "synthesis": {
                        "summary": "",
                        "conclusions": [],
                        "recommendations": [],
                        "formalized_result": "",
                        "consensus_level": 0.5,
                        "dissenting_opinions": [],
                    },
                    "iteration": 1,
                    "max_iterations": 3,
                    "should_continue": False,
                    "error": None,
                })

                response = client.post(
                    "/analyze",
                    json={"task": "Test", "task_type": task_type},
                )
                assert response.status_code == 200, f"Failed for task_type: {task_type}"
