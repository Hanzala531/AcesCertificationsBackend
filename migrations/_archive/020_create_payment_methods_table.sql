-- Payment Methods table
-- Stores saved payment methods for organizations
-- Dependencies: organization

BEGIN;

CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  stripe_payment_method_id VARCHAR(255) NOT NULL,
  stripe_customer_id VARCHAR(255),
  type VARCHAR(50) NOT NULL, -- e.g., 'card', 'bank_account'
  card_brand VARCHAR(50), -- e.g., 'visa', 'mastercard', 'amex'
  card_last4 VARCHAR(4), -- Last 4 digits of card
  card_exp_month INTEGER,
  card_exp_year INTEGER,
  is_default BOOLEAN DEFAULT FALSE,
  billing_details JSONB, -- Store billing address and other details
  metadata JSONB, -- Additional metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_organization_id 
ON payment_methods(organization_id);

CREATE INDEX IF NOT EXISTS idx_payment_methods_stripe_payment_method_id 
ON payment_methods(stripe_payment_method_id);

CREATE INDEX IF NOT EXISTS idx_payment_methods_stripe_customer_id 
ON payment_methods(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_payment_methods_organization_default 
ON payment_methods(organization_id, is_default) 
WHERE is_default = TRUE;

DROP TRIGGER IF EXISTS update_payment_methods_updated_at ON payment_methods;
CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON payment_methods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
