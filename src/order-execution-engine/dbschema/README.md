# Database Migrations

## Overview
This directory contains SQL migration scripts for the Order Execution Engine database schema.

## Migration Files
- `001_create_orders_tables.sql` - Initial schema creation (orders + order_history tables)

## Running Migrations
Migrations should be run in numerical order. You can use:
- pg-migrate
- node-pg-migrate
- Flyway
- or manually via psql

### Manual Execution
```bash
psql -U postgres -d order_execution -f 001_create_orders_tables.sql
```

### Environment Setup
Make sure your database is created first:
```bash
psql -U postgres -c "CREATE DATABASE order_execution;"
```

## Schema Overview

### orders table
- Stores active order state
- Indexed for fast queries by status, token pairs, timestamps
- Auto-updates `updated_at` via trigger

### order_history table
- Append-only event store (audit trail)
- JSONB for flexible event data
- GIN index for fast JSON queries

## Notes
- All timestamps are in UTC (TIMESTAMP WITH TIME ZONE)
- Column name follows standard: `transaction_hash` not `tx_hash`
- Foreign key cascade delete ensures data integrity
