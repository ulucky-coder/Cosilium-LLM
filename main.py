"""
LLM-top: Entry Point
Точка входа приложения
"""

import uvicorn
from src.api.main import api
from src.config import get_settings


def main():
    """Запуск сервера"""
    settings = get_settings()
    uvicorn.run(
        "src.api.main:api",
        host=settings.api_host,
        port=settings.api_port,
        reload=True,
    )


if __name__ == "__main__":
    main()
