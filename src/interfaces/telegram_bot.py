"""
Cosilium-LLM: Telegram Bot
Telegram интерфейс для системы
"""

import asyncio
from typing import Optional
from datetime import datetime
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
    ContextTypes,
    filters,
)
from pydantic import BaseModel

from src.config import get_settings
from src.models.state import TaskInput, CosiliumOutput


class UserSession(BaseModel):
    """Сессия пользователя"""
    user_id: int
    chat_id: int
    username: Optional[str] = None
    current_task: Optional[str] = None
    task_type: str = "research"
    awaiting_input: Optional[str] = None
    created_at: datetime = datetime.utcnow()


class CosiliumBot:
    """
    Telegram бот для Cosilium-LLM

    Команды:
    /start - Начать работу
    /analyze - Начать анализ
    /status - Статус текущего анализа
    /history - История анализов
    /help - Помощь
    """

    def __init__(self, token: str):
        self.token = token
        self.app = Application.builder().token(token).build()
        self.sessions: dict[int, UserSession] = {}
        self._setup_handlers()

    def _setup_handlers(self):
        """Настроить обработчики команд"""
        self.app.add_handler(CommandHandler("start", self.cmd_start))
        self.app.add_handler(CommandHandler("analyze", self.cmd_analyze))
        self.app.add_handler(CommandHandler("status", self.cmd_status))
        self.app.add_handler(CommandHandler("history", self.cmd_history))
        self.app.add_handler(CommandHandler("help", self.cmd_help))
        self.app.add_handler(CommandHandler("feedback", self.cmd_feedback))

        # Callback queries (кнопки)
        self.app.add_handler(CallbackQueryHandler(self.handle_callback))

        # Текстовые сообщения
        self.app.add_handler(MessageHandler(
            filters.TEXT & ~filters.COMMAND,
            self.handle_message
        ))

    def _get_session(self, user_id: int, chat_id: int, username: str = None) -> UserSession:
        """Получить или создать сессию"""
        if user_id not in self.sessions:
            self.sessions[user_id] = UserSession(
                user_id=user_id,
                chat_id=chat_id,
                username=username,
            )
        return self.sessions[user_id]

    async def cmd_start(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Обработчик /start"""
        user = update.effective_user
        session = self._get_session(user.id, update.effective_chat.id, user.username)

        welcome_text = f"""Привет, {user.first_name}!

Я Cosilium — мульти-агентная аналитическая система.

Я объединяю несколько AI (ChatGPT, Claude, Gemini, DeepSeek) для глубокого анализа задач.

**Что я умею:**
- Бизнес-стратегия
- Исследования
- Инвестиционный анализ
- Технический аудит

**Команды:**
/analyze — начать анализ
/status — статус текущего анализа
/history — история анализов
/help — подробная помощь

Просто отправь мне задачу для анализа!"""

        await update.message.reply_text(welcome_text, parse_mode="Markdown")

    async def cmd_analyze(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Обработчик /analyze"""
        user = update.effective_user
        session = self._get_session(user.id, update.effective_chat.id)

        # Показываем выбор типа задачи
        keyboard = [
            [
                InlineKeyboardButton("Стратегия", callback_data="type_strategy"),
                InlineKeyboardButton("Исследование", callback_data="type_research"),
            ],
            [
                InlineKeyboardButton("Инвестиции", callback_data="type_investment"),
                InlineKeyboardButton("Разработка", callback_data="type_development"),
            ],
            [
                InlineKeyboardButton("Аудит", callback_data="type_audit"),
            ],
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)

        await update.message.reply_text(
            "Выбери тип анализа:",
            reply_markup=reply_markup
        )

    async def cmd_status(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Обработчик /status"""
        user = update.effective_user
        session = self._get_session(user.id, update.effective_chat.id)

        if not session.current_task:
            await update.message.reply_text("Нет активного анализа. Используй /analyze")
            return

        # Здесь должна быть проверка статуса через API
        await update.message.reply_text(
            f"Текущая задача: {session.current_task[:100]}...\n"
            f"Тип: {session.task_type}\n"
            f"Статус: в обработке"
        )

    async def cmd_history(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Обработчик /history"""
        await update.message.reply_text(
            "История анализов пока не реализована.\n"
            "Будет доступна в следующей версии."
        )

    async def cmd_help(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Обработчик /help"""
        help_text = """**Как использовать Cosilium**

1. Отправь задачу текстом или используй /analyze
2. Выбери тип анализа
3. Дождись результата (обычно 1-3 минуты)
4. Получи структурированный отчёт

**Типы анализа:**
- **Стратегия** — рынки, конкуренты, бизнес-решения
- **Исследование** — глубокий анализ любой темы
- **Инвестиции** — оценка проектов, риски, ROI
- **Разработка** — архитектура, технические решения
- **Аудит** — проверка методологии, поиск ошибок

**Принципы системы:**
- Если можно посчитать — посчитаем
- Если нельзя — объясним почему
- Каждый вывод фальсифицируем

**Обратная связь:**
Используй /feedback после получения результата"""

        await update.message.reply_text(help_text, parse_mode="Markdown")

    async def cmd_feedback(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Обработчик /feedback"""
        user = update.effective_user
        session = self._get_session(user.id, update.effective_chat.id)

        keyboard = [
            [
                InlineKeyboardButton("⭐", callback_data="fb_1"),
                InlineKeyboardButton("⭐⭐", callback_data="fb_2"),
                InlineKeyboardButton("⭐⭐⭐", callback_data="fb_3"),
                InlineKeyboardButton("⭐⭐⭐⭐", callback_data="fb_4"),
                InlineKeyboardButton("⭐⭐⭐⭐⭐", callback_data="fb_5"),
            ],
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)

        await update.message.reply_text(
            "Оцени качество последнего анализа:",
            reply_markup=reply_markup
        )

    async def handle_callback(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Обработчик callback queries (кнопок)"""
        query = update.callback_query
        await query.answer()

        user = update.effective_user
        session = self._get_session(user.id, update.effective_chat.id)

        data = query.data

        # Выбор типа задачи
        if data.startswith("type_"):
            task_type = data.replace("type_", "")
            session.task_type = task_type
            session.awaiting_input = "task"

            await query.edit_message_text(
                f"Тип анализа: {task_type}\n\n"
                "Теперь отправь задачу для анализа:"
            )

        # Feedback
        elif data.startswith("fb_"):
            rating = int(data.replace("fb_", ""))
            await query.edit_message_text(
                f"Спасибо за оценку {rating}/5! "
                "Твой feedback помогает улучшать систему."
            )
            # Здесь сохранение feedback через FeedbackCollector

    async def handle_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Обработчик текстовых сообщений"""
        user = update.effective_user
        session = self._get_session(user.id, update.effective_chat.id)

        text = update.message.text

        # Если ожидаем ввод задачи или это просто текст
        if session.awaiting_input == "task" or not session.awaiting_input:
            session.current_task = text
            session.awaiting_input = None

            # Запускаем анализ
            await update.message.reply_text(
                f"Начинаю анализ...\n\n"
                f"Тип: {session.task_type}\n"
                f"Задача: {text[:100]}...\n\n"
                "Это займёт 1-3 минуты. Я пришлю результат когда будет готово."
            )

            # Здесь вызов API для анализа
            asyncio.create_task(
                self._run_analysis(update.effective_chat.id, session)
            )

    async def _run_analysis(self, chat_id: int, session: UserSession):
        """Запустить анализ в фоне"""
        try:
            # Здесь должен быть вызов реального API
            # Пока заглушка
            await asyncio.sleep(5)

            result_text = f"""**Результаты анализа**

Задача: {session.current_task[:100]}...

**Резюме:**
[Здесь будет резюме анализа]

**Ключевые выводы:**
1. Вывод 1 (уверенность: 80%)
2. Вывод 2 (уверенность: 75%)

**Рекомендации:**
- Рекомендация 1
- Рекомендация 2

**Уровень консенсуса:** 82%

Используй /feedback для оценки качества."""

            await self.app.bot.send_message(
                chat_id=chat_id,
                text=result_text,
                parse_mode="Markdown"
            )

        except Exception as e:
            await self.app.bot.send_message(
                chat_id=chat_id,
                text=f"Ошибка при анализе: {str(e)}\n\nПопробуй ещё раз."
            )

    def run(self):
        """Запустить бота"""
        self.app.run_polling()

    async def start_webhook(self, webhook_url: str, port: int = 8443):
        """Запустить бота через webhook"""
        await self.app.bot.set_webhook(webhook_url)
        await self.app.start()


def create_bot() -> CosiliumBot:
    """Создать бота с настройками из конфига"""
    settings = get_settings()
    # Предполагаем, что токен бота будет в настройках
    token = getattr(settings, 'telegram_bot_token', '')
    if not token:
        raise ValueError("TELEGRAM_BOT_TOKEN not configured")
    return CosiliumBot(token)
