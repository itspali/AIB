-- Enum value must commit before SALES_QUOTATION can be referenced (PostgreSQL 55P04).
ALTER TYPE public.activity_entity_type ADD VALUE IF NOT EXISTS 'SALES_QUOTATION';
