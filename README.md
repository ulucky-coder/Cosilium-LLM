# Cosilium-LLM

**Мульти-агентная аналитическая система на LangGraph**

Cosilium-LLM объединяет несколько LLM (ChatGPT, Claude, Gemini, DeepSeek) в единую систему для получения аналитических результатов, превосходящих уровень человеческих экспертов.

## Архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│                         FastAPI                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                        LangGraph                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   Итерация 1                              │  │
│  │              Параллельный анализ                          │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │  │
│  │  │ ChatGPT │ │ Claude  │ │ Gemini  │ │DeepSeek │        │  │
│  │  │ Логика  │ │Методолог│ │Альтернат│ │ Формалы │        │  │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   Итерация 2                              │  │
│  │              Adversarial Mode                             │  │
│  │         (Взаимная критика по 10 критериям)               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   Итерация 3                              │  │
│  │                    Синтез                                 │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │              Claude (Интегратор)                     │ │  │
│  │  │  • Объединение анализов                             │ │  │
│  │  │  • Разрешение противоречий                          │ │  │
│  │  │  • Формализация выводов                             │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                    ┌─────────┴─────────┐                        │
│                    │  Консенсус < 80%? │                        │
│                    └─────────┬─────────┘                        │
│                         ДА   │   НЕТ                            │
│                         ▼    │    ▼                             │
│                    [Refine]  │  [END]                           │
│                         │    │                                   │
│                         └────┘                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Быстрый старт

### 1. Клонирование и настройка

```bash
cd /root/projects/Cosilium-LLM

# Копируем .env
cp .env.example .env

# Редактируем API ключи
nano .env
```

### 2. Установка зависимостей

```bash
# Создаём виртуальное окружение
python -m venv venv
source venv/bin/activate

# Устанавливаем зависимости
pip install -r requirements.txt
```

### 3. Запуск

```bash
# Локально
python main.py

# Или через Docker
docker-compose up -d
```

### 4. Использование API

```bash
# Health check
curl http://localhost:8000/health

# Синхронный анализ
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Оценить перспективы выхода на рынок облачных решений в России",
    "task_type": "strategy",
    "context": "Компания — средний B2B SaaS стартап с ARR $2M",
    "max_iterations": 3
  }'

# Асинхронный анализ
curl -X POST http://localhost:8000/analyze/async \
  -H "Content-Type: application/json" \
  -d '{"task": "...", "task_type": "research"}'

# Проверка статуса
curl http://localhost:8000/tasks/{task_id}

# Streaming
curl "http://localhost:8000/analyze/stream?task=Проанализировать..."
```

## Структура проекта

```
Cosilium-LLM/
├── main.py                 # Точка входа
├── requirements.txt        # Зависимости
├── Dockerfile
├── docker-compose.yml
├── .env.example
│
├── src/
│   ├── config.py           # Конфигурация
│   │
│   ├── models/
│   │   └── state.py        # Pydantic модели и LangGraph State
│   │
│   ├── agents/
│   │   ├── base.py         # Базовый класс агента
│   │   ├── llm_agents.py   # Реализации агентов (GPT, Claude, etc)
│   │   └── synthesizer.py  # Синтезатор результатов
│   │
│   ├── graph/
│   │   └── workflow.py     # LangGraph граф
│   │
│   ├── prompts/
│   │   └── agent_prompts.py # Промпты для агентов
│   │
│   ├── api/
│   │   └── main.py         # FastAPI endpoints
│   │
│   └── utils/
│
└── tests/
```

## API Endpoints

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/` | Health check |
| GET | `/health` | Детальный статус |
| GET | `/agents` | Список агентов |
| POST | `/analyze` | Синхронный анализ |
| POST | `/analyze/async` | Асинхронный анализ |
| GET | `/tasks/{id}` | Статус задачи |
| GET | `/analyze/stream` | Streaming анализ |

## Типы задач

| Тип | Описание |
|-----|----------|
| `strategy` | Бизнес-стратегия, рынки, конкуренты |
| `research` | Глубокое исследование темы |
| `investment` | Оценка проектов, риски, ROI |
| `development` | Архитектура, code review |
| `audit` | Методологический аудит |

## Формат результата

```json
{
  "task": "...",
  "analyses": [
    {
      "agent_name": "ChatGPT",
      "analysis": "...",
      "confidence": 0.85,
      "key_points": ["..."],
      "risks": ["..."],
      "assumptions": ["..."]
    }
  ],
  "critiques": [
    {
      "critic_name": "Claude",
      "target_name": "ChatGPT",
      "critique": "...",
      "score": 7.5,
      "weaknesses": ["..."],
      "strengths": ["..."]
    }
  ],
  "synthesis": {
    "summary": "...",
    "conclusions": [
      {
        "conclusion": "...",
        "probability": "75%",
        "falsification_condition": "..."
      }
    ],
    "recommendations": [...],
    "formalized_result": "...",
    "consensus_level": 0.82
  },
  "iterations_used": 3
}
```

## Мониторинг

Для мониторинга используйте LangSmith:

```bash
# В .env
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=your-key
LANGCHAIN_PROJECT=cosilium-llm
```

## Принципы

```
Если можно посчитать — нужно посчитать.
Если нельзя посчитать — нужно объяснить почему.
Если нельзя фальсифицировать — вывод считается слабым.
```

## Лицензия

MIT
