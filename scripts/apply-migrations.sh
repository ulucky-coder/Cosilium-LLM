#!/bin/bash
# ============================================================
# LLM-top: Apply Database Migrations
# ============================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
MIGRATIONS_DIR="$(dirname "$0")/../migrations"
SUPABASE_URL="${SUPABASE_URL:-https://daqaxdkyufelexsivywl.supabase.co}"

echo -e "${GREEN}=== LLM-top Database Migration ===${NC}"
echo ""

# Check for required environment variables
if [ -z "$SUPABASE_SERVICE_KEY" ]; then
    echo -e "${RED}Error: SUPABASE_SERVICE_KEY environment variable is required${NC}"
    echo "Set it with: export SUPABASE_SERVICE_KEY='your-service-role-key'"
    exit 1
fi

# List migrations
echo -e "${YELLOW}Available migrations:${NC}"
ls -1 "$MIGRATIONS_DIR"/*.sql 2>/dev/null || {
    echo -e "${RED}No migration files found in $MIGRATIONS_DIR${NC}"
    exit 1
}
echo ""

# Function to apply a single migration
apply_migration() {
    local file="$1"
    local filename=$(basename "$file")

    echo -e "${YELLOW}Applying: $filename${NC}"

    # Read SQL content
    local sql_content=$(cat "$file")

    # Apply via Supabase REST API (using pg_query)
    local response=$(curl -s -X POST \
        "${SUPABASE_URL}/rest/v1/rpc/pg_query" \
        -H "apikey: ${SUPABASE_SERVICE_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
        -H "Content-Type: application/json" \
        -d "{\"query\": $(echo "$sql_content" | jq -Rs .)}" \
        2>&1)

    if echo "$response" | grep -q "error"; then
        echo -e "${RED}Error applying $filename:${NC}"
        echo "$response" | jq .
        return 1
    fi

    echo -e "${GREEN}✓ Applied: $filename${NC}"
    return 0
}

# Apply migrations in order
echo -e "${YELLOW}Applying migrations...${NC}"
echo ""

for migration in "$MIGRATIONS_DIR"/*.sql; do
    if [ -f "$migration" ]; then
        apply_migration "$migration" || {
            echo -e "${RED}Migration failed. Stopping.${NC}"
            exit 1
        }
    fi
done

echo ""
echo -e "${GREEN}=== All migrations applied successfully ===${NC}"
echo ""
echo "Next steps:"
echo "1. Verify tables in Supabase Dashboard"
echo "2. Generate embeddings for rag_thinking_patterns"
echo "3. Configure n8n credentials"
