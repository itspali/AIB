-- Enum values must commit before use in functions/RPCs (PostgreSQL 55P04).
-- Split from 20260802130000 / 20260802160000 so CI single-transaction migrations succeed.

ALTER TYPE public.document_voucher_type ADD VALUE IF NOT EXISTS 'IMPORT_SHIPMENT';
ALTER TYPE public.document_voucher_type ADD VALUE IF NOT EXISTS 'GOODS_IN_TRANSIT';
ALTER TYPE public.document_posting_document_type ADD VALUE IF NOT EXISTS 'SHIPMENT';
ALTER TYPE public.activity_entity_type ADD VALUE IF NOT EXISTS 'SHIPMENT';
