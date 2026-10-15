import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: 'thoppu_auth_token',
  },
})

export type Role = 'accountant' | 'supervisor' | 'owner'
export type ExpenseStatus = 'Submitted' | 'Verified' | 'Query'
export type DepositStatus = 'Confirmed' | 'Sent (pending)'

export interface Profile {
  id: string
  property_id: string
  username: string
  name: string
  role: Role
  created_at?: string
  updated_at?: string
}

export interface Category {
  id: string
  property_id: string
  name: string
  type: 'Farm' | 'Personal'
  active: boolean
}

export interface Expense {
  id: string
  property_id: string
  user_id?: string
  category_id: string
  amount: number
  date: string
  note?: string | null
  bill_photo_url?: string | null
  status: ExpenseStatus
  query_message?: string | null
  created_at?: string
  updated_at?: string
}

export interface Deposit {
  id: string
  property_id: string
  recorded_by?: string
  date: string
  amount: number
  from_name?: string | null
  mode: 'Cash' | 'GPay' | 'Bank'
  reference?: string | null
  status: DepositStatus
  created_at?: string
  updated_at?: string
}

export interface Settings {
  id: string
  property_id: string
  opening_balance: number
  updated_at?: string
}
