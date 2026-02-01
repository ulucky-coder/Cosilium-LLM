# Инструкция по применению миграций в Supabase

## Шаг 1: Откройте Supabase SQL Editor

1. Перейдите в [Supabase Dashboard](https://supabase.com/dashboard)
2. Выберите проект
3. В левом меню выберите **SQL Editor**
4. Нажмите **New query**

## Шаг 2: Применение миграций

Скопируйте и выполните каждый файл **по порядку**:

### 1. Основная схема (`001_initial_schema.sql`)

```sql
-- Скопируйте содержимое файла migrations/001_initial_schema.sql
-- и выполните здесь
```

### 2. Промты агентов (`002_seed_prompts.sql`)

```sql
-- Скопируйте содержимое файла migrations/002_seed_prompts.sql
-- и выполните здесь
```

### 3. Паттерны мышления (`003_seed_thinking_patterns.sql`)

```sql
-- Скопируйте содержимое файла migrations/003_seed_thinking_patterns.sql
-- и выполните здесь
```

## Шаг 3: Проверка

После применения миграций выполните:

```sql
-- Проверить таблицы
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Проверить промты
SELECT agent_name, prompt_type, version, is_active
FROM rag_prompts
ORDER BY agent_name, prompt_type;

-- Проверить паттерны мышления
SELECT thinker_name, domains
FROM rag_thinking_patterns;
```

## Шаг 4: Генерация эмбеддингов

Эмбеддинги для `rag_thinking_patterns` нужно сгенерировать через n8n workflow:

1. Создайте workflow с HTTP Request к OpenAI Embeddings API
2. Для каждой записи в `rag_thinking_patterns`:
   - Текст для эмбеддинга: `pattern_description + ' ' + heuristics`
   - Модель: `text-embedding-3-small`
3. Обновите поле `embedding` в таблице

Или используйте SQL-функцию (если настроена интеграция с OpenAI в Supabase Edge Functions).

## Troubleshooting

### Ошибка "extension vector does not exist"

```sql
-- Включите расширение вручную
CREATE EXTENSION IF NOT EXISTS vector;
```

### Ошибка "permission denied"

Убедитесь, что используете **service_role** ключ, не **anon** ключ.

### Индексы не создаются

Индексы ivfflat требуют данных для обучения. Сначала загрузите данные, потом создайте индекс:

```sql
-- Создать индекс после загрузки данных
CREATE INDEX idx_patterns_embedding ON rag_thinking_patterns
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```
