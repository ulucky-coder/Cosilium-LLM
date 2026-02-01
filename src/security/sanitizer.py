"""
Cosilium-LLM: Input Sanitizer
Защита от prompt injection и вредоносного ввода
"""

import re
from typing import Optional
from pydantic import BaseModel


class SanitizationResult(BaseModel):
    """Результат санитизации"""
    original: str
    sanitized: str
    was_modified: bool
    warnings: list[str] = []
    blocked: bool = False
    block_reason: Optional[str] = None


class InputSanitizer:
    """
    Санитайзер входных данных

    Защищает от:
    - Prompt injection
    - Jailbreak попыток
    - Вредоносных инструкций
    - Эксфильтрации данных
    """

    # Паттерны prompt injection
    INJECTION_PATTERNS = [
        # Прямые инструкции
        r"(?i)ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?)",
        r"(?i)disregard\s+(all\s+)?(previous|above|prior)",
        r"(?i)forget\s+(everything|all)\s+(you\s+)?know",
        r"(?i)you\s+are\s+now\s+(?!analyzing)",  # "You are now X" но не "You are now analyzing"

        # System prompt extraction
        r"(?i)what\s+(is|are)\s+your\s+(system\s+)?prompt",
        r"(?i)show\s+me\s+your\s+(instructions?|prompt)",
        r"(?i)repeat\s+(your\s+)?(system\s+)?prompt",
        r"(?i)print\s+(your\s+)?instructions?",

        # Role play injection
        r"(?i)pretend\s+you\s+are",
        r"(?i)act\s+as\s+if\s+you",
        r"(?i)roleplay\s+as",
        r"(?i)simulate\s+being",

        # Delimiter injection
        r"```\s*system",
        r"\[INST\]",
        r"<\|im_start\|>",
        r"<\|system\|>",

        # Data exfiltration
        r"(?i)send\s+(this\s+)?to\s+https?://",
        r"(?i)post\s+(this\s+)?to\s+https?://",
        r"(?i)upload\s+(this\s+)?to",
    ]

    # Опасные ключевые слова
    DANGEROUS_KEYWORDS = [
        "jailbreak",
        "DAN",
        "do anything now",
        "developer mode",
        "unrestricted mode",
        "evil mode",
        "bypass",
    ]

    # Максимальная длина ввода
    MAX_INPUT_LENGTH = 50000  # 50K символов

    def __init__(self, strict_mode: bool = False):
        self.strict_mode = strict_mode
        self._compiled_patterns = [
            re.compile(p) for p in self.INJECTION_PATTERNS
        ]

    def sanitize(self, text: str) -> SanitizationResult:
        """
        Санитизировать входной текст

        Args:
            text: Входной текст

        Returns:
            SanitizationResult с результатами проверки
        """
        result = SanitizationResult(
            original=text,
            sanitized=text,
            was_modified=False,
        )

        # Проверка длины
        if len(text) > self.MAX_INPUT_LENGTH:
            result.sanitized = text[:self.MAX_INPUT_LENGTH]
            result.was_modified = True
            result.warnings.append(f"Input truncated from {len(text)} to {self.MAX_INPUT_LENGTH} chars")

        # Проверка на injection паттерны
        for pattern in self._compiled_patterns:
            if pattern.search(result.sanitized):
                if self.strict_mode:
                    result.blocked = True
                    result.block_reason = "Potential prompt injection detected"
                    return result
                else:
                    # Предупреждаем но не блокируем
                    result.warnings.append(f"Suspicious pattern detected: {pattern.pattern[:50]}...")

        # Проверка на опасные ключевые слова
        text_lower = result.sanitized.lower()
        for keyword in self.DANGEROUS_KEYWORDS:
            if keyword.lower() in text_lower:
                if self.strict_mode:
                    result.blocked = True
                    result.block_reason = f"Dangerous keyword detected: {keyword}"
                    return result
                else:
                    result.warnings.append(f"Dangerous keyword: {keyword}")

        # Удаление потенциально опасных символов
        # Сохраняем обычную пунктуацию, но убираем специальные
        dangerous_chars = [
            '\x00',  # Null byte
            '\x0b',  # Vertical tab
            '\x0c',  # Form feed
        ]
        for char in dangerous_chars:
            if char in result.sanitized:
                result.sanitized = result.sanitized.replace(char, '')
                result.was_modified = True

        return result

    def sanitize_for_prompt(self, text: str) -> str:
        """
        Санитизировать текст для включения в промпт

        Добавляет экранирование и изоляцию
        """
        result = self.sanitize(text)

        if result.blocked:
            raise ValueError(result.block_reason)

        # Обёртка для изоляции пользовательского ввода
        isolated = f"[USER INPUT START]\n{result.sanitized}\n[USER INPUT END]"

        return isolated

    def validate_output(self, output: str, task: str) -> tuple[bool, list[str]]:
        """
        Валидировать выходные данные от LLM

        Проверяет что ответ не содержит:
        - Системные промпты
        - Конфиденциальные данные
        - Вредоносный контент
        """
        issues = []

        # Проверка на системные промпты в ответе
        system_prompt_indicators = [
            "system prompt",
            "my instructions",
            "I was told to",
            "my guidelines say",
        ]
        for indicator in system_prompt_indicators:
            if indicator.lower() in output.lower():
                issues.append(f"Potential system prompt leak: {indicator}")

        # Проверка на API ключи
        api_key_patterns = [
            r"sk-[a-zA-Z0-9]{20,}",  # OpenAI
            r"sk-ant-[a-zA-Z0-9]+",  # Anthropic
            r"AIza[a-zA-Z0-9_-]{35}",  # Google
        ]
        for pattern in api_key_patterns:
            if re.search(pattern, output):
                issues.append("Potential API key in output")

        # Проверка на релевантность (output должен относиться к task)
        # Упрощённая проверка - хотя бы одно слово из задачи должно быть в ответе
        task_words = set(task.lower().split())
        output_words = set(output.lower().split())
        overlap = task_words & output_words

        if len(overlap) < 2 and len(task_words) > 3:
            issues.append("Output may not be relevant to the task")

        is_valid = len(issues) == 0
        return is_valid, issues


class ContentFilter:
    """
    Фильтр контента

    Проверяет входные и выходные данные на соответствие политикам
    """

    def __init__(self):
        self.blocked_topics = [
            # Добавить темы которые не должны обрабатываться
        ]

    def is_allowed_topic(self, text: str) -> tuple[bool, Optional[str]]:
        """Проверить разрешена ли тема"""
        text_lower = text.lower()

        for topic in self.blocked_topics:
            if topic.lower() in text_lower:
                return False, f"Topic not allowed: {topic}"

        return True, None

    def filter_pii(self, text: str) -> str:
        """
        Фильтровать персональные данные

        Маскирует:
        - Email адреса
        - Телефоны
        - Номера карт
        """
        # Email
        text = re.sub(
            r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
            '[EMAIL]',
            text
        )

        # Телефоны (различные форматы)
        text = re.sub(
            r'\+?[0-9]{1,3}[-.\s]?[0-9]{3}[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}',
            '[PHONE]',
            text
        )

        # Номера карт
        text = re.sub(
            r'\b[0-9]{4}[-\s]?[0-9]{4}[-\s]?[0-9]{4}[-\s]?[0-9]{4}\b',
            '[CARD]',
            text
        )

        return text
