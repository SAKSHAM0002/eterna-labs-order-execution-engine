-- Migration: Create Orders and Order History Tables
-- Version: 001
-- Description: Initial schema for order execution engine

-- Orders Table - Main table storing swap orders
CREATE TABLE IF NOT EXISTS orders (
  -- Primary Key
  id UUID PRIMARY KEY,
  
  -- Order Details
  token_in VARCHAR(100) NOT NULL,
  token_out VARCHAR(100) NOT NULL,
  amount DECIMAL(20, 8) NOT NULL CHECK (amount > 0),
  
  -- Order Status & Execution
  status VARCHAR(20) NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  selected_dex VARCHAR(50),
  executed_price DECIMAL(20, 8),
  transaction_hash VARCHAR(100) UNIQUE,
  
  -- Configuration
  slippage_tolerance DECIMAL(5, 2) NOT NULL DEFAULT 0.5 CHECK (slippage_tolerance >= 0),
  max_retries INTEGER NOT NULL DEFAULT 3 CHECK (max_retries >= 0),
  retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  
  -- Error Handling
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMP WITH TIME ZONE
);

-- Order History Table - Append-only event store for audit trail
CREATE TABLE IF NOT EXISTS order_history (
  -- Primary Key
  id UUID PRIMARY KEY,
  
  -- Foreign Key
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  
  -- Event Details
  event_type VARCHAR(100) NOT NULL,
  event_data JSONB NOT NULL,
  event_version INTEGER NOT NULL DEFAULT 1,
  
  -- Metadata
  metadata JSONB,
  
  -- Timestamp
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_token_in ON orders(token_in);
CREATE INDEX IF NOT EXISTS idx_orders_token_out ON orders(token_out);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_updated_at ON orders(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_selected_dex ON orders(selected_dex);
CREATE INDEX IF NOT EXISTS idx_orders_composite ON orders(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_history_order_id ON order_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_history_event_type ON order_history(event_type);
CREATE INDEX IF NOT EXISTS idx_order_history_timestamp ON order_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_order_history_composite ON order_history(order_id, timestamp ASC);
CREATE INDEX IF NOT EXISTS idx_order_history_event_data ON order_history USING GIN (event_data);

-- Trigger function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to orders table
DROP TRIGGER IF EXISTS trigger_orders_updated_at ON orders;
CREATE TRIGGER trigger_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Table Comments
COMMENT ON TABLE orders IS 'Main table storing swap orders for the order execution engine';
COMMENT ON TABLE order_history IS 'Append-only event store for order state changes (audit trail)';

COMMENT ON COLUMN orders.id IS 'Unique identifier for the order (UUID v4)';
COMMENT ON COLUMN orders.status IS 'Current status: pending, processing, completed, failed, cancelled';
COMMENT ON COLUMN orders.slippage_tolerance IS 'Maximum allowed price slippage in percentage';
COMMENT ON COLUMN orders.retry_count IS 'Current number of execution attempts';
COMMENT ON COLUMN orders.transaction_hash IS 'Solana blockchain transaction hash (unique)';

COMMENT ON COLUMN order_history.event_data IS 'JSONB payload containing full event details';
COMMENT ON COLUMN order_history.event_version IS 'Event version for ordering and event sourcing';
