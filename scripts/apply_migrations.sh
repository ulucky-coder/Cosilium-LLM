#!/bin/bash
# ============================================================
# LLM-top: Apply Migrations to Supabase
# ============================================================
#
# This script helps you apply migrations to Supabase.
# It outputs the SQL that needs to be run in the Supabase SQL Editor.
#
# Usage:
#   ./scripts/apply_migrations.sh
#   ./scripts/apply_migrations.sh 001  # Apply specific migration
#
# ============================================================

set -e

MIGRATIONS_DIR="$(dirname "$0")/../migrations"

echo "============================================================"
echo "LLM-top: Database Migrations"
echo "============================================================"
echo ""
echo "To apply migrations, copy the SQL below and run it in:"
echo "https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new"
echo ""
echo "============================================================"

if [ -n "$1" ]; then
    # Apply specific migration
    MIGRATION_FILE=$(ls "$MIGRATIONS_DIR"/${1}*.sql 2>/dev/null | head -1)
    if [ -z "$MIGRATION_FILE" ]; then
        echo "Migration not found: $1"
        exit 1
    fi
    echo "Migration: $(basename "$MIGRATION_FILE")"
    echo "============================================================"
    cat "$MIGRATION_FILE"
else
    # Apply all migrations in order
    for migration in "$MIGRATIONS_DIR"/*.sql; do
        echo ""
        echo "-- ============================================================"
        echo "-- Migration: $(basename "$migration")"
        echo "-- ============================================================"
        cat "$migration"
        echo ""
    done
fi

echo ""
echo "============================================================"
echo "Done! Copy the SQL above and paste it into Supabase SQL Editor."
echo "============================================================"
