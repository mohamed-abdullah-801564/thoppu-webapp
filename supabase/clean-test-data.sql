-- ==============================================================================
-- CLEAN ALL TEST DATA FOR PRODUCTION LAUNCH
-- Run this in your Supabase Dashboard -> SQL Editor -> Click "Run"
-- ==============================================================================

-- 1. Wipe all test expenses and test deposits (bypasses row-lock triggers)
TRUNCATE TABLE public.expenses CASCADE;
TRUNCATE TABLE public.deposits CASCADE;

-- 2. Reset opening balance and period start timestamp to start fresh
UPDATE public.settings
SET opening_balance = 27686,
    updated_at = now()
WHERE property_id = '00000000-0000-0000-0000-000000000001';

-- 3. Check clean state (both should return 0)
SELECT count(*) AS remaining_expenses FROM public.expenses;
SELECT count(*) AS remaining_deposits FROM public.deposits;
SELECT * FROM public.settings;
