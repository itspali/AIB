-- Composition (is_bundle) is independent of supply-chain role (classification).
-- Legacy KIT_BUNDLE rows become FINISHED_GOOD + is_bundle.

UPDATE public.items
SET
    classification = 'FINISHED_GOOD'::public.item_classification_type,
    is_bundle = TRUE
WHERE classification = 'KIT_BUNDLE'::public.item_classification_type
  AND is_bundle = FALSE;

CREATE OR REPLACE FUNCTION private.validate_item_type_classification(
    p_item_type public.item_type,
    p_classification public.item_classification_type,
    p_is_bundle BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF p_item_type = 'SERVICE'::public.item_type AND p_classification <> 'SERVICE'::public.item_classification_type THEN
        RAISE EXCEPTION 'service items must use service / overhead classification';
    END IF;

    IF p_item_type <> 'SERVICE'::public.item_type AND p_classification = 'SERVICE'::public.item_classification_type THEN
        RAISE EXCEPTION 'service / overhead classification is only for service items';
    END IF;

    IF p_item_type = 'PHYSICAL'::public.item_type THEN
        IF p_classification NOT IN (
            'RAW_MATERIAL'::public.item_classification_type,
            'WIP_ASSEMBLY'::public.item_classification_type,
            'FINISHED_GOOD'::public.item_classification_type,
            'CONSUMABLE'::public.item_classification_type,
            'KIT_BUNDLE'::public.item_classification_type,
            'PHYSICAL_GOOD'::public.item_classification_type
        ) THEN
            RAISE EXCEPTION 'classification is not valid for goods items';
        END IF;
    ELSIF p_item_type = 'DIGITAL'::public.item_type THEN
        IF p_classification NOT IN (
            'FINISHED_GOOD'::public.item_classification_type,
            'CONSUMABLE'::public.item_classification_type
        ) THEN
            RAISE EXCEPTION 'classification is not valid for digital items';
        END IF;
    END IF;

    -- Composition flag is orthogonal to classification (KIT_BUNDLE role is legacy only).
    IF COALESCE(p_is_bundle, FALSE) AND p_item_type NOT IN (
        'PHYSICAL'::public.item_type,
        'SERVICE'::public.item_type,
        'DIGITAL'::public.item_type
    ) THEN
        RAISE EXCEPTION 'composition is not supported for this item type';
    END IF;
END;
$$;
