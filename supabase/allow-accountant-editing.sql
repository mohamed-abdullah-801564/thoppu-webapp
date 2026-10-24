-- ==============================================================================
-- ALLOW ACCOUNTANT EDITING & FIX TYPO DATES
-- Run this in your Supabase Dashboard -> SQL Editor -> Click "Run"
-- ==============================================================================

-- 1. DROP the restrictive locking triggers FIRST (so they don't block the update)
DROP TRIGGER IF EXISTS tr_expense_lock ON public.expenses;
DROP TRIGGER IF EXISTS tr_deposit_lock ON public.deposits;

-- 2. NOW update the typo date for Kadalai Work (Rs. 2,200) from 2029 to 2026
UPDATE public.expenses
SET date = '2026-07-01'
WHERE date = '2029-07-01' AND amount = 2200;

-- 3. Replace with smart trigger that gives the Accountant full control to edit/delete,
--    while still preventing unauthorized changes by supervisors.
CREATE OR REPLACE FUNCTION public.check_expense_lock()
RETURNS TRIGGER AS $$
BEGIN
    -- Accountant (or service role / admin) has full permission to edit, correct dates, amounts, and delete
    IF public.current_user_role() = 'accountant' OR auth.uid() IS NULL THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        ELSE
            NEW.updated_at = now();
            RETURN NEW;
        END IF;
    END IF;

    -- Supervisors cannot alter or delete verified expenses
    IF TG_OP = 'DELETE' AND OLD.status = 'Verified' THEN
        RAISE EXCEPTION 'Locked: Verified expenses cannot be deleted by supervisors.';
    ELSIF TG_OP = 'UPDATE' AND OLD.status = 'Verified' THEN
        IF (OLD.amount != NEW.amount OR OLD.date != NEW.date) THEN
            RAISE EXCEPTION 'Locked: Verified expense amount and date cannot be changed by supervisors.';
        END IF;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        NEW.updated_at = now();
        RETURN NEW;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_expense_lock
    BEFORE UPDATE OR DELETE ON public.expenses
    FOR EACH ROW
    EXECUTE FUNCTION public.check_expense_lock();

-- Also allow accountant to edit/delete deposits
CREATE OR REPLACE FUNCTION public.check_deposit_lock()
RETURNS TRIGGER AS $$
BEGIN
    IF public.current_user_role() = 'accountant' OR auth.uid() IS NULL THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        ELSE
            NEW.updated_at = now();
            RETURN NEW;
        END IF;
    END IF;

    IF TG_OP = 'DELETE' AND OLD.status = 'Confirmed' THEN
        RAISE EXCEPTION 'Locked: Confirmed deposits cannot be deleted by supervisors.';
    ELSIF TG_OP = 'UPDATE' AND OLD.status = 'Confirmed' THEN
        IF (OLD.amount != NEW.amount OR OLD.date != NEW.date) THEN
            RAISE EXCEPTION 'Locked: Confirmed deposit amount and date cannot be changed by supervisors.';
        END IF;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        NEW.updated_at = now();
        RETURN NEW;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_deposit_lock
    BEFORE UPDATE OR DELETE ON public.deposits
    FOR EACH ROW
    EXECUTE FUNCTION public.check_deposit_lock();

-- Verification check (should show 2026-07-01)
SELECT id, date, note, amount, status FROM public.expenses WHERE note ILIKE '%kadalai%' ORDER BY date DESC LIMIT 5;
