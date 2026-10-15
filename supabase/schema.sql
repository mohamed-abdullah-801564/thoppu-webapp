-- ==============================================================================
-- THOPPU LEDGER DATABASE SCHEMA & ROW LEVEL SECURITY
-- Run this in your Supabase Dashboard -> SQL Editor -> Click "Run"
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. PROPERTIES TABLE (Multi-farm readiness)
CREATE TABLE IF NOT EXISTS public.properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL DEFAULT 'Thoppu Grove 1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default property
INSERT INTO public.properties (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Thoppu Grove 1')
ON CONFLICT (id) DO NOTHING;

-- 2. PROFILES TABLE (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('accountant', 'supervisor', 'owner')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('Farm', 'Personal')),
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default categories
INSERT INTO public.categories (property_id, name, type, active)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'Thopu Bill', 'Farm', true),
    ('00000000-0000-0000-0000-000000000001', 'Salary', 'Farm', true),
    ('00000000-0000-0000-0000-000000000001', 'Tractor / Machinery', 'Farm', true),
    ('00000000-0000-0000-0000-000000000001', 'Plants', 'Farm', true),
    ('00000000-0000-0000-0000-000000000001', 'Owner Expense', 'Farm', true),
    ('00000000-0000-0000-0000-000000000001', 'Bank Deposit', 'Farm', true),
    ('00000000-0000-0000-0000-000000000001', 'Household', 'Personal', true),
    ('00000000-0000-0000-0000-000000000001', 'Other', 'Farm', true)
ON CONFLICT DO NOTHING;

-- 4. EXPENSES TABLE
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    category_id UUID NOT NULL REFERENCES public.categories(id),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    date DATE NOT NULL,
    note TEXT,
    bill_photo_url TEXT,
    status TEXT NOT NULL DEFAULT 'Submitted' CHECK (status IN ('Submitted', 'Verified', 'Query')),
    query_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. DEPOSITS TABLE
CREATE TABLE IF NOT EXISTS public.deposits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    recorded_by UUID REFERENCES auth.users(id),
    date DATE NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    from_name TEXT,
    mode TEXT NOT NULL CHECK (mode IN ('Cash', 'GPay', 'Bank')),
    reference TEXT,
    status TEXT NOT NULL DEFAULT 'Sent (pending)' CHECK (status IN ('Sent (pending)', 'Confirmed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID UNIQUE NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    opening_balance NUMERIC(12, 2) NOT NULL DEFAULT 27686.00,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default settings (Excel go-live balance)
INSERT INTO public.settings (property_id, opening_balance)
VALUES ('00000000-0000-0000-0000-000000000001', 27686.00)
ON CONFLICT (property_id) DO NOTHING;

-- 7. DATABASE LOCKING TRIGGERS
-- Protects financial amounts and dates from tampering, while allowing note/category corrections
CREATE OR REPLACE FUNCTION public.check_expense_lock()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.status = 'Verified' THEN
            RAISE EXCEPTION 'Locked: Verified expenses cannot be deleted.';
        END IF;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Protect verified amounts and dates from silent alteration; allow note & category corrections
        IF OLD.status = 'Verified' AND (OLD.amount != NEW.amount OR OLD.date != NEW.date) THEN
            RAISE EXCEPTION 'Locked: Verified expense amount and date cannot be changed. Enter an adjustment entry instead.';
        END IF;
        NEW.updated_at = now();
        RETURN NEW;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_expense_lock ON public.expenses;
CREATE TRIGGER tr_expense_lock
    BEFORE UPDATE OR DELETE ON public.expenses
    FOR EACH ROW
    EXECUTE FUNCTION public.check_expense_lock();

-- Prevents deleting confirmed deposits or altering their amounts/dates; allows editing reference notes
CREATE OR REPLACE FUNCTION public.check_deposit_lock()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.status = 'Confirmed' THEN
            RAISE EXCEPTION 'Locked: Confirmed deposits cannot be deleted.';
        END IF;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status = 'Confirmed' AND (OLD.amount != NEW.amount OR OLD.date != NEW.date) THEN
            RAISE EXCEPTION 'Locked: Confirmed deposit amount and date cannot be changed.';
        END IF;
        NEW.updated_at = now();
        RETURN NEW;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_deposit_lock ON public.deposits;
CREATE TRIGGER tr_deposit_lock
    BEFORE UPDATE OR DELETE ON public.deposits
    FOR EACH ROW
    EXECUTE FUNCTION public.check_deposit_lock();

-- 8. STORAGE BUCKET FOR BILL PHOTOS
INSERT INTO storage.buckets (id, name, public)
VALUES ('bills', 'bills', false)
ON CONFLICT (id) DO NOTHING;

-- 9. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Helper security definer functions to look up role & property without recursive policy evaluation
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.current_user_property_id()
RETURNS uuid AS $$
  SELECT property_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Properties policies
DROP POLICY IF EXISTS "Users can view their property" ON public.properties;
CREATE POLICY "Users can view their property"
  ON public.properties FOR SELECT
  TO authenticated
  USING (id = public.current_user_property_id());

-- Profiles policies
DROP POLICY IF EXISTS "Users can view profiles in the same property" ON public.profiles;
CREATE POLICY "Users can view profiles in the same property"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (property_id = public.current_user_property_id());

DROP POLICY IF EXISTS "Users can update their own display name" ON public.profiles;
CREATE POLICY "Users can update their own display name"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Accountant can manage profiles" ON public.profiles;
CREATE POLICY "Accountant can manage profiles"
  ON public.profiles FOR ALL
  TO authenticated
  USING (public.current_user_role() = 'accountant');

-- Categories policies
DROP POLICY IF EXISTS "Authenticated users can view categories" ON public.categories;
CREATE POLICY "Authenticated users can view categories"
  ON public.categories FOR SELECT
  TO authenticated
  USING (property_id = public.current_user_property_id());

DROP POLICY IF EXISTS "Accountant can insert categories" ON public.categories;
CREATE POLICY "Accountant can insert categories"
  ON public.categories FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() = 'accountant');

DROP POLICY IF EXISTS "Accountant can update categories" ON public.categories;
CREATE POLICY "Accountant can update categories"
  ON public.categories FOR UPDATE
  TO authenticated
  USING (public.current_user_role() = 'accountant');

DROP POLICY IF EXISTS "Accountant can delete categories" ON public.categories;
CREATE POLICY "Accountant can delete categories"
  ON public.categories FOR DELETE
  TO authenticated
  USING (public.current_user_role() = 'accountant');

-- Settings policies
DROP POLICY IF EXISTS "Users can view settings" ON public.settings;
CREATE POLICY "Users can view settings"
  ON public.settings FOR SELECT
  TO authenticated
  USING (property_id = public.current_user_property_id());

DROP POLICY IF EXISTS "Owner and Accountant can update settings" ON public.settings;
CREATE POLICY "Owner and Accountant can update settings"
  ON public.settings FOR UPDATE
  TO authenticated
  USING (public.current_user_role() IN ('owner', 'accountant'));

-- Expenses policies
DROP POLICY IF EXISTS "Users can view expenses in property" ON public.expenses;
CREATE POLICY "Users can view expenses in property"
  ON public.expenses FOR SELECT
  TO authenticated
  USING (property_id = public.current_user_property_id());

DROP POLICY IF EXISTS "Users can insert expenses according to role" ON public.expenses;
CREATE POLICY "Users can insert expenses according to role"
  ON public.expenses FOR INSERT
  TO authenticated
  WITH CHECK (
    property_id = public.current_user_property_id()
    AND (
      (public.current_user_role() = 'supervisor' AND status = 'Submitted')
      OR (public.current_user_role() = 'accountant' AND status = 'Verified')
    )
  );

DROP POLICY IF EXISTS "Accountant can update expenses" ON public.expenses;
CREATE POLICY "Accountant can update expenses"
  ON public.expenses FOR UPDATE
  TO authenticated
  USING (public.current_user_role() = 'accountant');

DROP POLICY IF EXISTS "Supervisor can update own queried expenses" ON public.expenses;
CREATE POLICY "Supervisor can update own queried expenses"
  ON public.expenses FOR UPDATE
  TO authenticated
  USING (
    public.current_user_role() = 'supervisor'
    AND user_id = auth.uid()
    AND status IN ('Submitted', 'Query')
  )
  WITH CHECK (
    status = 'Submitted'
  );

DROP POLICY IF EXISTS "Accountant can delete unverified expenses" ON public.expenses;
CREATE POLICY "Accountant can delete unverified expenses"
  ON public.expenses FOR DELETE
  TO authenticated
  USING (public.current_user_role() = 'accountant' AND status != 'Verified');

-- Deposits policies
DROP POLICY IF EXISTS "Users can view deposits in property" ON public.deposits;
CREATE POLICY "Users can view deposits in property"
  ON public.deposits FOR SELECT
  TO authenticated
  USING (property_id = public.current_user_property_id());

DROP POLICY IF EXISTS "Accountant can manage deposits" ON public.deposits;
CREATE POLICY "Accountant can manage deposits"
  ON public.deposits FOR ALL
  TO authenticated
  USING (public.current_user_role() = 'accountant');

DROP POLICY IF EXISTS "Owner can insert pending deposits" ON public.deposits;
CREATE POLICY "Owner can insert pending deposits"
  ON public.deposits FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_role() = 'owner'
    AND status = 'Sent (pending)'
  );

-- Storage bucket policies
DROP POLICY IF EXISTS "Authenticated users can upload bills" ON storage.objects;
CREATE POLICY "Authenticated users can upload bills"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'bills');

DROP POLICY IF EXISTS "Authenticated users can view bills" ON storage.objects;
CREATE POLICY "Authenticated users can view bills"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'bills');
