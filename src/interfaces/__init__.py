"""
LLM-top: Interfaces
Telegram, webhooks, Slack
"""

from src.interfaces.telegram_bot import CosiliumBot
from src.interfaces.webhooks import WebhookManager

__all__ = ["CosiliumBot", "WebhookManager"]
