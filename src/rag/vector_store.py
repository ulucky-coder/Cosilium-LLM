"""
LLM-top: Vector Store
Векторное хранилище на базе Supabase pgvector
"""

import hashlib
from typing import Optional
from datetime import datetime
from pydantic import BaseModel
from supabase import create_client, Client
from langchain_openai import OpenAIEmbeddings

from src.config import get_settings


class Document(BaseModel):
    """Документ для хранения в векторной БД"""
    id: Optional[str] = None
    content: str
    metadata: dict = {}
    embedding: Optional[list[float]] = None
    doc_type: str = "general"  # prompt, thinking_pattern, analysis, critique
    created_at: Optional[datetime] = None


class VectorStore:
    """
    Векторное хранилище на базе Supabase pgvector

    Таблицы:
    - cosilium_documents: основные документы
    - cosilium_prompts: эволюционирующие промпты
    - cosilium_patterns: образы мышления
    """

    def __init__(self):
        settings = get_settings()
        self.client: Client = create_client(
            settings.supabase_url,
            settings.supabase_key
        )
        self.embeddings = OpenAIEmbeddings(
            api_key=settings.openai_api_key,
            model="text-embedding-3-small"
        )
        self.table_name = "cosilium_documents"

    def _generate_id(self, content: str) -> str:
        """Генерация ID на основе контента"""
        return hashlib.md5(content.encode()).hexdigest()[:16]

    async def add_document(self, doc: Document) -> str:
        """Добавить документ в хранилище"""
        if not doc.id:
            doc.id = self._generate_id(doc.content)

        # Генерируем embedding
        embedding = await self.embeddings.aembed_query(doc.content)

        data = {
            "id": doc.id,
            "content": doc.content,
            "metadata": doc.metadata,
            "embedding": embedding,
            "doc_type": doc.doc_type,
            "created_at": datetime.utcnow().isoformat(),
        }

        self.client.table(self.table_name).upsert(data).execute()
        return doc.id

    async def search(
        self,
        query: str,
        doc_type: Optional[str] = None,
        limit: int = 5,
        threshold: float = 0.7
    ) -> list[Document]:
        """
        Семантический поиск документов

        Args:
            query: Поисковый запрос
            doc_type: Фильтр по типу документа
            limit: Максимальное количество результатов
            threshold: Минимальный порог схожести
        """
        # Получаем embedding запроса
        query_embedding = await self.embeddings.aembed_query(query)

        # RPC вызов для поиска по схожести
        params = {
            "query_embedding": query_embedding,
            "match_threshold": threshold,
            "match_count": limit,
        }

        if doc_type:
            params["filter_doc_type"] = doc_type

        result = self.client.rpc("match_cosilium_documents", params).execute()

        documents = []
        for row in result.data:
            documents.append(Document(
                id=row["id"],
                content=row["content"],
                metadata=row.get("metadata", {}),
                doc_type=row.get("doc_type", "general"),
                created_at=row.get("created_at"),
            ))

        return documents

    async def get_by_id(self, doc_id: str) -> Optional[Document]:
        """Получить документ по ID"""
        result = self.client.table(self.table_name)\
            .select("*")\
            .eq("id", doc_id)\
            .execute()

        if result.data:
            row = result.data[0]
            return Document(
                id=row["id"],
                content=row["content"],
                metadata=row.get("metadata", {}),
                doc_type=row.get("doc_type", "general"),
                created_at=row.get("created_at"),
            )
        return None

    async def delete(self, doc_id: str) -> bool:
        """Удалить документ"""
        self.client.table(self.table_name)\
            .delete()\
            .eq("id", doc_id)\
            .execute()
        return True

    async def list_by_type(self, doc_type: str, limit: int = 100) -> list[Document]:
        """Получить все документы определённого типа"""
        result = self.client.table(self.table_name)\
            .select("*")\
            .eq("doc_type", doc_type)\
            .limit(limit)\
            .execute()

        return [
            Document(
                id=row["id"],
                content=row["content"],
                metadata=row.get("metadata", {}),
                doc_type=row.get("doc_type", "general"),
                created_at=row.get("created_at"),
            )
            for row in result.data
        ]


# SQL для создания таблицы и функции поиска в Supabase
SETUP_SQL = """
-- Включаем pgvector
create extension if not exists vector;

-- Таблица документов
create table if not exists cosilium_documents (
    id text primary key,
    content text not null,
    metadata jsonb default '{}',
    embedding vector(1536),
    doc_type text default 'general',
    created_at timestamp with time zone default now()
);

-- Индекс для быстрого поиска
create index if not exists cosilium_documents_embedding_idx
on cosilium_documents
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

-- Индекс по типу документа
create index if not exists cosilium_documents_type_idx
on cosilium_documents (doc_type);

-- Функция поиска по схожести
create or replace function match_cosilium_documents(
    query_embedding vector(1536),
    match_threshold float,
    match_count int,
    filter_doc_type text default null
)
returns table (
    id text,
    content text,
    metadata jsonb,
    doc_type text,
    created_at timestamp with time zone,
    similarity float
)
language plpgsql
as $$
begin
    return query
    select
        cd.id,
        cd.content,
        cd.metadata,
        cd.doc_type,
        cd.created_at,
        1 - (cd.embedding <=> query_embedding) as similarity
    from cosilium_documents cd
    where
        (filter_doc_type is null or cd.doc_type = filter_doc_type)
        and 1 - (cd.embedding <=> query_embedding) > match_threshold
    order by cd.embedding <=> query_embedding
    limit match_count;
end;
$$;
"""
