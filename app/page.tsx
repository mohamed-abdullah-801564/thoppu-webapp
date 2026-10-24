'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpFromLine,
  BarChart3,
  Bell,
  Camera,
  Check,
  ChevronRight,
  ClipboardList,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileText,
  Filter,
  Home,
  Image as ImageIcon,
  IndianRupee,
  KeyRound,
  Lock,
  LogOut,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Smartphone,
  Sprout,
  Sun,
  Tag,
  Upload,
  UserCheck,
  UserPlus,
  UserRound,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import { supabase, type Category, type Deposit, type Expense, type Profile, type Role } from '@/lib/supabase'
import { getTranslation, type Language } from '@/lib/i18n'
import { compressImage, getSignedBillUrl, uploadBillPhoto } from '@/lib/image-compressor'
import { exportToExcel, exportToPdf, parseExcelFile, type ParsedExcelRow } from '@/lib/excel-import-export'

const DEFAULT_PROPERTY_ID = '00000000-0000-0000-0000-000000000001'

// --- HELPER FUNCTIONS ---
function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateString: string) {
  if (!dateString) return ''
  const [y, m, d] = dateString.split('-')
  if (d && m && y) return `${d}.${m}.${y}`
  return dateString
}

function formatLedgerDate(dateString: string) {
  if (!dateString) return ''
  const [y, m, d] = dateString.split('-')
  if (!d || !m || !y) return dateString
  const currentYear = new Date().getFullYear().toString()
  if (y !== currentYear) {
    return `${d}.${m}.${y.slice(2)}`
  }
  return `${d}.${m}`
}

function Icon({ name, className = '' }: { name: string; className?: string }) {
  const icons: Record<string, any> = { Home, ClipboardList, Wallet, Settings, Users, Tag, BarChart3, FileText }
  const Component = icons[name] || Home
  return <Component className={className} strokeWidth={1.8} />
}

function StatusBadge({ status }: { status: string }) {
  const tone = status === 'Verified' || status === 'Confirmed' ? 'green' : status === 'Query' ? 'amber' : 'grey'
  return <span className={`badge badge-${tone}`}>{status}</span>
}

function Amount({ value, large = false }: { value: number; large?: boolean }) {
  return (
    <p className={`${large ? 'text-[32px]' : 'text-base'} font-bold tracking-tight text-[#18221c] dark:text-[#f2f5f3]`}>
      {formatCurrency(value)}
    </p>
  )
}

// --- HEADER COMPONENT ---
function Header({
  lang,
  setLang,
  role,
  onBack,
  onLogout,
}: {
  lang: Language
  setLang: (l: Language) => void
  role?: string
  onBack?: () => void
  onLogout?: () => void
}) {
  return (
    <header className="flex items-center justify-between px-5 py-4">
      <div className="flex items-center gap-3">
        {onBack ? (
          <button onClick={onBack} aria-label="Back" className="grid size-9 place-items-center rounded-full bg-white dark:bg-[#1a241e] border border-[#e5e9e3] dark:border-[#27372d] shadow-sm text-[#18221c] dark:text-[#f2f5f3]">
            <ArrowLeft className="size-4" />
          </button>
        ) : (
          <div className="grid size-9 place-items-center rounded-xl bg-[#1f5f46] text-white">
            <Sprout className="size-5" />
          </div>
        )}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#1f5f46] dark:text-[#35b586]">Thoppu</p>
          <h1 className="text-lg font-bold leading-none tracking-tight text-[#18221c] dark:text-[#f2f5f3]">Ledger</h1>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {role && <div className="hidden rounded-full bg-[#e8f0eb] dark:bg-[#1c3024] px-3 py-1.5 text-xs font-semibold text-[#1f5f46] dark:text-[#35b586] sm:block">{role}</div>}
        <button
          onClick={() => setLang(lang === 'en' ? 'ta' : 'en')}
          className="rounded-full border border-[#d9dfd9] dark:border-[#2e4235] bg-white dark:bg-[#1a241e] px-3 py-1.5 text-xs font-semibold text-[#1f5f46] dark:text-[#35b586] shadow-sm hover:opacity-90"
        >
          {lang === 'en' ? 'தமிழ்' : 'EN'}
        </button>
        {onLogout && (
          <button onClick={onLogout} aria-label="Log Out" title="Log Out" className="grid size-9 place-items-center rounded-full bg-white dark:bg-[#1a241e] border border-[#e5e9e3] dark:border-[#27372d] shadow-sm text-muted-foreground hover:text-destructive">
            <LogOut className="size-4" />
          </button>
        )}
      </div>
    </header>
  )
}

// --- BALANCE CARD ---
function BalanceCard({ title, amount, subtitle }: { title: string; amount: number; subtitle?: string }) {
  return (
    <section className="balance-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-white/80">{title}</p>
          <p className="text-[32px] font-bold tracking-tight text-white">{formatCurrency(amount)}</p>
        </div>
        <div className="grid size-10 place-items-center rounded-xl bg-white/10">
          <IndianRupee className="size-5 text-white/90" />
        </div>
      </div>
      {subtitle && <p className="mt-4 text-xs text-white/80">{subtitle}</p>}
    </section>
  )
}

// --- BOTTOM NAVIGATION ---
function BottomNav({ role, active, onChange, lang }: { role: Role; active: string; onChange: (s: string) => void; lang: Language }) {
  const items =
    role === 'supervisor'
      ? [
          ['home', 'Home', 'Home'],
          ['history', 'History', 'ClipboardList'],
          ['settings', 'Settings', 'Settings'],
        ]
      : role === 'accountant'
      ? [
          ['home', 'Home', 'Home'],
          ['review', 'Review', 'ClipboardList'],
          ['ledger', 'Ledger', 'BarChart3'],
          ['settings', 'Settings', 'Settings'],
        ]
      : [
          ['home', 'Home', 'Home'],
          ['feed', 'Feed', 'ClipboardList'],
          ['settings', 'Settings', 'Settings'],
        ]

  return (
    <nav className="bottom-nav">
      {items.map(([id, label, icon]) => (
        <button key={id} onClick={() => onChange(id)} className={active === id ? 'nav-item active' : 'nav-item'}>
          <Icon name={icon} />
          <span>{getTranslation(lang, label.toLowerCase() as any)}</span>
        </button>
      ))}
    </nav>
  )
}

// --- MODAL WRAPPER ---
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-backdrop">
      <div className="modal-sheet">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold">{title}</h2>
          <button onClick={onClose} className="grid size-9 place-items-center rounded-full bg-[#f2f4f0] dark:bg-[#243229]">
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// --- PWA INSTALL BANNER ---
function PwaBanner({ lang, deferredPrompt, onInstalled }: { lang: Language; deferredPrompt: any; onInstalled: () => void }) {
  if (!deferredPrompt) return null
  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-[#e8f3eb] dark:bg-[#1a2d22] p-3 text-xs">
      <div className="flex items-center gap-2">
        <Smartphone className="size-5 text-[#1f5f46] dark:text-[#35b586]" />
        <div>
          <p className="font-bold text-[#1f5f46] dark:text-[#35b586]">{getTranslation(lang, 'installApp')}</p>
          <p className="text-muted-foreground">{getTranslation(lang, 'installAppDesc')}</p>
        </div>
      </div>
      <button
        onClick={async () => {
          deferredPrompt.prompt()
          const { outcome } = await deferredPrompt.userChoice
          if (outcome === 'accepted') {
            onInstalled()
          }
        }}
        className="primary-button whitespace-nowrap !min-h-[36px] !py-1 !px-3 !text-xs"
      >
        {getTranslation(lang, 'installBtn')}
      </button>
    </div>
  )
}

// ==============================================================================
// LOGIN SCREEN (CLEAN, NO QUICK BUTTONS, HIGH CONTRAST, EYE TOGGLE)
// ==============================================================================
function Login({ onLogin, lang, setLang }: { onLogin: (profile: Profile) => void; lang: Language; setLang: (l: Language) => void }) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!identifier || !password) {
      setErrorMsg(getTranslation(lang, 'fillRequired'))
      return
    }

    setLoading(true)
    setErrorMsg('')

    try {
      const trimmed = identifier.trim().toLowerCase()
      const email = trimmed.includes('@') ? trimmed : `${trimmed}@thoppu.local`

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error || !data.user) {
        setErrorMsg(getTranslation(lang, 'invalidCredentials'))
        setLoading(false)
        return
      }

      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single()

      if (profileErr || !profile) {
        setErrorMsg('User profile not found. Please contact accountant.')
        setLoading(false)
        return
      }

      onLogin(profile as Profile)
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen app-shell px-5 py-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-md flex-col justify-between">
        <Header lang={lang} setLang={setLang} />

        <div className="py-6">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-5 grid size-20 place-items-center rounded-[28px] bg-[#1f5f46] text-white shadow-[0_12px_30px_rgba(31,95,70,0.2)]">
              <Sprout className="size-10" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-[#18221c] dark:text-[#f2f5f3]">
              {getTranslation(lang, 'welcomeTitle').split(',')[0]},<br />
              <span className="text-[#1f5f46] dark:text-[#35b586]">{getTranslation(lang, 'welcomeTitle').split(',')[1] || 'in good hands.'}</span>
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{getTranslation(lang, 'welcomeSubtitle')}</p>
          </div>

          <div className="rounded-[24px] bg-white dark:bg-[#1a241e] p-6 shadow-[0_12px_40px_rgba(34,47,38,0.06)] border border-[#e5e9e3] dark:border-[#27372d]">
            <h3 className="mb-5 text-center text-xl font-bold text-[#18221c] dark:text-[#f2f5f3]">{getTranslation(lang, 'loginTitle')}</h3>

            <form onSubmit={handleLogin} className="form-stack">
              <label>
                <span>{getTranslation(lang, 'usernameOrEmail')}</span>
                <input
                  type="text"
                  placeholder="e.g. umar, supervisor, owner"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoCapitalize="none"
                  autoCorrect="off"
                  required
                />
              </label>

              <label>
                <span>{getTranslation(lang, 'password')}</span>
                <div className="relative flex items-center">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 grid size-8 place-items-center text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </label>

              {errorMsg && (
                <div className="rounded-xl bg-[#fee2e2] dark:bg-[#451212] p-3 text-center text-xs font-semibold text-[#dc2626] dark:text-[#f87171]">
                  {errorMsg}
                </div>
              )}

              <button type="submit" disabled={loading} className="primary-button mt-3 w-full">
                {loading ? getTranslation(lang, 'loggingIn') : getTranslation(lang, 'loginButton')}
              </button>
            </form>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">Thoppu Ledger · 2026</p>
      </div>
    </main>
  )
}

// ==============================================================================
// EXPENSE ROW COMPONENT
// ==============================================================================
function ExpenseRow({
  expense,
  categories,
  onClick,
}: {
  expense: Expense
  categories: Category[]
  onClick?: () => void
}) {
  const cat = categories.find((c) => c.id === expense.category_id)
  const catName = cat?.name || 'Expense'

  return (
    <button onClick={onClick} className="entry-row text-left">
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#eef4ef] dark:bg-[#1a2d22] text-[#1f5f46] dark:text-[#35b586]">
        <FileText className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold">{catName}</p>
          <StatusBadge status={expense.status} />
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {expense.note ? `${formatDate(expense.date)} · ${expense.note}` : formatDate(expense.date)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Amount value={Number(expense.amount)} />
        <ChevronRight className="size-4 text-muted-foreground" />
      </div>
    </button>
  )
}

// ==============================================================================
// SUPERVISOR VIEW
// ==============================================================================
function SupervisorView({
  profile,
  expenses,
  deposits,
  categories,
  openingBalance,
  lang,
  setLang,
  theme,
  onToggleTheme,
  onLogout,
  onRefresh,
  deferredPrompt,
  onPwaInstalled,
  periodStartDate,
}: {
  profile: Profile
  expenses: Expense[]
  deposits: Deposit[]
  categories: Category[]
  openingBalance: number
  lang: Language
  setLang: (l: Language) => void
  theme: 'light' | 'dark'
  onToggleTheme: (t: 'light' | 'dark') => void
  onLogout: () => void
  onRefresh: () => void
  deferredPrompt: any
  onPwaInstalled: () => void
  periodStartDate?: string | null
}) {
  const [tab, setTab] = useState('home')
  const [filter, setFilter] = useState<'All' | 'Submitted' | 'Verified' | 'Query'>('All')
  const [showAdd, setShowAdd] = useState(false)
  const [selected, setSelected] = useState<Expense | null>(null)

  // Calculations for current period (Opening Balance + confirmed deposits - all expenses)
  const activeDeposits = useMemo(() => {
    if (!periodStartDate) return deposits
    return deposits.filter((d) => !d.created_at || d.created_at >= periodStartDate)
  }, [deposits, periodStartDate])

  const activeExpenses = useMemo(() => {
    if (!periodStartDate) return expenses
    return expenses.filter((e) => !e.created_at || e.created_at >= periodStartDate)
  }, [expenses, periodStartDate])

  const confirmedDeposits = activeDeposits.reduce((s, d) => (d.status === 'Confirmed' ? s + Number(d.amount) : s), 0)
  const allExpensesSum = activeExpenses.reduce((s, e) => s + Number(e.amount), 0)
  const cashInHand = openingBalance + confirmedDeposits - allExpensesSum

  const myExpenses = expenses.filter((e) => !e.user_id || e.user_id === profile.id)
  const recent = [...myExpenses].slice(0, 5)

  const filteredHistory = useMemo(() => {
    if (filter === 'All') return myExpenses
    return myExpenses.filter((e) => e.status === filter)
  }, [myExpenses, filter])

  return (
    <main className="app-shell">
      <Header lang={lang} setLang={setLang} role={getTranslation(lang, 'supervisor')} onLogout={onLogout} />
      <div className="page-content">
        {tab === 'home' && (
          <>
            <div className="mb-5">
              <p className="text-sm text-muted-foreground">Good morning, {profile.name}</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight">Keep things moving.</h2>
            </div>

            <BalanceCard
              title={getTranslation(lang, 'cashInHand')}
              amount={cashInHand}
              subtitle="Opening balance + confirmed deposits - all expenses"
            />

            <button onClick={() => setShowAdd(true)} className="primary-button mt-5 w-full">
              <Plus className="size-5" />
              {getTranslation(lang, 'addExpense')}
            </button>

            <div className="section-heading">
              <h3>{getTranslation(lang, 'recentEntries')}</h3>
              <button onClick={() => setTab('history')}>
                See all <ChevronRight className="size-4" />
              </button>
            </div>

            <div className="card-list">
              {recent.length === 0 ? (
                <p className="p-5 text-center text-xs text-muted-foreground">{getTranslation(lang, 'noEntries')}</p>
              ) : (
                recent.map((e) => (
                  <ExpenseRow key={e.id} expense={e} categories={categories} onClick={() => setSelected(e)} />
                ))
              )}
            </div>
          </>
        )}

        {tab === 'history' && (
          <>
            <div className="mb-5">
              <h2 className="text-2xl font-bold tracking-tight">{getTranslation(lang, 'myExpenses')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">All your recorded expenses</p>
            </div>

            <div className="filter-pills">
              {(['All', 'Submitted', 'Verified', 'Query'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setFilter(st)}
                  className={`filter-pill ${filter === st ? 'active' : ''}`}
                >
                  {st}
                </button>
              ))}
            </div>

            <div className="card-list mt-4">
              {filteredHistory.length === 0 ? (
                <p className="p-5 text-center text-xs text-muted-foreground">{getTranslation(lang, 'noEntries')}</p>
              ) : (
                filteredHistory.map((e) => (
                  <ExpenseRow key={e.id} expense={e} categories={categories} onClick={() => setSelected(e)} />
                ))
              )}
            </div>
          </>
        )}

        {tab === 'settings' && (
          <SettingsView
            profile={profile}
            openingBalance={openingBalance}
            lang={lang}
            theme={theme}
            onToggleTheme={onToggleTheme}
            onLogout={onLogout}
            onRefresh={onRefresh}
            deferredPrompt={deferredPrompt}
            onPwaInstalled={onPwaInstalled}
            periodStartDate={periodStartDate}
          />
        )}
      </div>

      <BottomNav role="supervisor" active={tab} onChange={setTab} lang={lang} />

      {showAdd && (
        <AddExpenseModal
          profile={profile}
          categories={categories}
          lang={lang}
          onClose={() => setShowAdd(false)}
          onSuccess={() => {
            setShowAdd(false)
            onRefresh()
          }}
        />
      )}

      {selected && (
        <ExpenseDetailModal
          expense={selected}
          categories={categories}
          profile={profile}
          lang={lang}
          onClose={() => setSelected(null)}
          onUpdated={() => {
            setSelected(null)
            onRefresh()
          }}
        />
      )}
    </main>
  )
}

// ==============================================================================
// ACCOUNTANT VIEW
// ==============================================================================
function AccountantView({
  profile,
  expenses,
  deposits,
  categories,
  openingBalance,
  lang,
  setLang,
  theme,
  onToggleTheme,
  onLogout,
  onRefresh,
  deferredPrompt,
  onPwaInstalled,
  periodStartDate,
}: {
  profile: Profile
  expenses: Expense[]
  deposits: Deposit[]
  categories: Category[]
  openingBalance: number
  lang: Language
  setLang: (l: Language) => void
  theme: 'light' | 'dark'
  onToggleTheme: (t: 'light' | 'dark') => void
  onLogout: () => void
  onRefresh: () => void
  deferredPrompt: any
  onPwaInstalled: () => void
  periodStartDate?: string | null
}) {
  const [tab, setTab] = useState('home')
  const [selected, setSelected] = useState<Expense | null>(null)
  const [showDeposit, setShowDeposit] = useState(false)
  const [showDirectExpense, setShowDirectExpense] = useState(false)
  const [showAllCategories, setShowAllCategories] = useState(false)

  // Core rule: Balance = Opening Balance + Confirmed deposits - ALL expenses (current period)
  const activeDeposits = useMemo(() => {
    if (!periodStartDate) return deposits
    return deposits.filter((d) => !d.created_at || d.created_at >= periodStartDate)
  }, [deposits, periodStartDate])

  const activeExpenses = useMemo(() => {
    if (!periodStartDate) return expenses
    return expenses.filter((e) => !e.created_at || e.created_at >= periodStartDate)
  }, [expenses, periodStartDate])

  const confirmedDeposits = activeDeposits.reduce((s, d) => (d.status === 'Confirmed' ? s + Number(d.amount) : s), 0)
  const allExpensesSum = activeExpenses.reduce((s, e) => s + Number(e.amount), 0)
  const currentBalance = openingBalance + confirmedDeposits - allExpensesSum

  const pendingExpenses = expenses.filter((e) => e.status === 'Submitted')

  const recent = [...expenses].slice(0, 5)

  return (
    <main className="app-shell">
      <Header lang={lang} setLang={setLang} role={getTranslation(lang, 'accountant')} onLogout={onLogout} />
      <div className="page-content">
        {tab === 'home' && (
          <>
            <div className="mb-5">
              <p className="text-sm text-muted-foreground">Good morning, {profile.name}</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight">Here's your overview.</h2>
            </div>

            <BalanceCard
              title={getTranslation(lang, 'currentBalance')}
              amount={currentBalance}
              subtitle="Opening balance + confirmed deposits - all expenses"
            />

            <div className="grid grid-cols-2 gap-3 mt-4">
              <button onClick={() => setTab('review')} className="text-left">
                <div className="metric-card">
                  <div className="metric-icon amber">
                    <ClipboardList />
                  </div>
                  <p className="mt-4 text-2xl font-bold">{pendingExpenses.length}</p>
                  <p className="text-xs leading-4 text-muted-foreground">{getTranslation(lang, 'pendingReview')}</p>
                </div>
              </button>

              <button onClick={() => setTab('ledger')} className="text-left">
                <div className="metric-card">
                  <div className="metric-icon green">
                    <FileText />
                  </div>
                  <p className="mt-4 text-2xl font-bold">{expenses.length + deposits.filter((d) => d.status === 'Confirmed').length}</p>
                  <p className="text-xs leading-4 text-muted-foreground">Cash Book (All Entries)</p>
                </div>
              </button>
            </div>

            <div className="section-heading">
              <h3>{getTranslation(lang, 'quickActions')}</h3>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setTab('review')} className="action-card">
                <ClipboardList />
                <span>{getTranslation(lang, 'reviewExpenses')}</span>
              </button>
              <button onClick={() => setShowDeposit(true)} className="action-card">
                <ArrowDownToLine />
                <span>{getTranslation(lang, 'recordDeposit')}</span>
              </button>
              <button onClick={() => setShowDirectExpense(true)} className="action-card">
                <Plus />
                <span>{getTranslation(lang, 'addEntry')}</span>
              </button>
              <button onClick={() => setTab('ledger')} className="action-card">
                <FileText />
                <span>{getTranslation(lang, 'ledger')}</span>
              </button>
            </div>

            <div className="section-heading">
              <h3>{getTranslation(lang, 'recentActivity')}</h3>
            </div>

            <div className="card-list">
              {recent.length === 0 ? (
                <p className="p-5 text-center text-xs text-muted-foreground">{getTranslation(lang, 'noEntries')}</p>
              ) : (
                recent.map((e) => (
                  <ExpenseRow key={e.id} expense={e} categories={categories} onClick={() => setSelected(e)} />
                ))
              )}
            </div>
          </>
        )}

        {tab === 'review' && (
          <>
            <div className="mb-5">
              <h2 className="text-2xl font-bold tracking-tight">{getTranslation(lang, 'reviewQueue')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {pendingExpenses.length} expenses need your attention
              </p>
            </div>

            <div className="card-list">
              {pendingExpenses.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Check className="mx-auto mb-2 size-8 text-[#1f5f46]" />
                  <p className="font-semibold">All caught up!</p>
                  <p className="text-xs">No pending expenses waiting for review.</p>
                </div>
              ) : (
                pendingExpenses.map((e) => {
                  const cat = categories.find((c) => c.id === e.category_id)
                  return (
                    <button
                      key={e.id}
                      onClick={() => setSelected(e)}
                      className="review-card"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold">{cat?.name || 'Expense'}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDate(e.date)}
                            {e.note && ` · ${e.note}`}
                          </p>
                        </div>
                        <Amount value={Number(e.amount)} />
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <div className="bill-thumb">
                          <ImageIcon className="size-4" />
                          <span>{e.bill_photo_url ? 'Bill attached' : 'No bill'}</span>
                        </div>
                        <span className="text-xs font-semibold text-[#1f5f46]">
                          Review <ChevronRight className="inline size-3" />
                        </span>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </>
        )}

        {tab === 'ledger' && (
          <LedgerScreen
            expenses={expenses}
            deposits={deposits}
            categories={categories}
            openingBalance={openingBalance}
            lang={lang}
            accountant
            profile={profile}
            onRefresh={onRefresh}
            periodStartDate={periodStartDate}
          />
        )}

        {tab === 'settings' && (
          <SettingsView
            profile={profile}
            openingBalance={openingBalance}
            categories={categories}
            expenses={expenses}
            deposits={deposits}
            lang={lang}
            theme={theme}
            onToggleTheme={onToggleTheme}
            onLogout={onLogout}
            onRefresh={onRefresh}
            accountant
            deferredPrompt={deferredPrompt}
            onPwaInstalled={onPwaInstalled}
            periodStartDate={periodStartDate}
          />
        )}
      </div>

      <BottomNav role="accountant" active={tab} onChange={setTab} lang={lang} />

      {selected && (
        <ExpenseDetailModal
          expense={selected}
          categories={categories}
          profile={profile}
          lang={lang}
          accountant
          onClose={() => setSelected(null)}
          onUpdated={() => {
            setSelected(null)
            onRefresh()
          }}
        />
      )}

      {showDeposit && (
        <DepositModal
          profile={profile}
          lang={lang}
          onClose={() => setShowDeposit(false)}
          onSuccess={() => {
            setShowDeposit(false)
            onRefresh()
          }}
        />
      )}

      {showDirectExpense && (
        <AddExpenseModal
          profile={profile}
          categories={categories}
          lang={lang}
          directVerified
          onClose={() => setShowDirectExpense(false)}
          onSuccess={() => {
            setShowDirectExpense(false)
            onRefresh()
          }}
        />
      )}

      {/* ALL CATEGORIES QUICK-ACCESS MODAL */}
      {showAllCategories && (
        <Modal title="Farm Categories" onClose={() => setShowAllCategories(false)}>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            <p className="text-xs text-muted-foreground pb-1">
              Active categories for logging farm receipts and expenses:
            </p>
            {categories.filter((c) => c.active).map((c) => {
              const count = expenses.filter((e) => e.category_id === c.id).length
              const total = expenses.filter((e) => e.category_id === c.id).reduce((s, e) => s + Number(e.amount), 0)
              return (
                <div
                  key={c.id}
                  onClick={() => {
                    setShowAllCategories(false)
                    setTab('ledger')
                  }}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-[#f8faf7] dark:bg-[#1a251f] text-xs cursor-pointer hover:bg-[#eef4ef] transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <span className={`dot shrink-0 ${c.type === 'Personal' ? 'personal' : ''}`} />
                    <div>
                      <span className="font-semibold truncate text-[#18221c] dark:text-[#f2f5f3] block">{c.name}</span>
                      <span className="text-[10px] text-muted-foreground">{count} {count === 1 ? 'entry' : 'entries'}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-[#1f5f46] dark:text-[#35b586] block">{formatCurrency(total)}</span>
                    <span className={`badge shrink-0 !text-[9px] ${c.type === 'Personal' ? 'badge-amber' : 'badge-green'}`}>
                      {c.type}
                    </span>
                  </div>
                </div>
              )
            })}
            <button
              onClick={() => {
                setShowAllCategories(false)
                setTab('ledger')
              }}
              className="primary-button w-full !min-h-[36px] text-xs mt-2"
            >
              Open Full Cash Book (All Entries)
            </button>
          </div>
        </Modal>
      )}
    </main>
  )
}

// ==============================================================================
// OWNER VIEW
// ==============================================================================
function OwnerView({
  profile,
  expenses,
  deposits,
  categories,
  openingBalance,
  lang,
  setLang,
  theme,
  onToggleTheme,
  onLogout,
  onRefresh,
  deferredPrompt,
  onPwaInstalled,
  periodStartDate,
}: {
  profile: Profile
  expenses: Expense[]
  deposits: Deposit[]
  categories: Category[]
  openingBalance: number
  lang: Language
  setLang: (l: Language) => void
  theme: 'light' | 'dark'
  onToggleTheme: (t: 'light' | 'dark') => void
  onLogout: () => void
  onRefresh: () => void
  deferredPrompt: any
  onPwaInstalled: () => void
  periodStartDate?: string | null
}) {
  const [tab, setTab] = useState('home')
  const [selected, setSelected] = useState<Expense | null>(null)
  const [typeFilter, setTypeFilter] = useState<'All' | 'Farm' | 'Personal'>('All')

  // Totals for current active period
  const activeDeposits = useMemo(() => {
    if (!periodStartDate) return deposits
    return deposits.filter((d) => !d.created_at || d.created_at >= periodStartDate)
  }, [deposits, periodStartDate])

  const activeExpenses = useMemo(() => {
    if (!periodStartDate) return expenses
    return expenses.filter((e) => !e.created_at || e.created_at >= periodStartDate)
  }, [expenses, periodStartDate])

  const confirmedDeposits = activeDeposits.reduce((s, d) => (d.status === 'Confirmed' ? s + Number(d.amount) : s), 0)
  const allExpensesSum = activeExpenses.reduce((s, e) => s + Number(e.amount), 0)
  const totalBalance = openingBalance + confirmedDeposits - allExpensesSum

  // Farm vs Personal breakdown for Verified expenses
  const verifiedExpenses = expenses.filter((e) => e.status === 'Verified')
  let farmSpent = 0
  let personalSpent = 0

  for (const e of verifiedExpenses) {
    const cat = categories.find((c) => c.id === e.category_id)
    if (cat?.type === 'Personal') {
      personalSpent += Number(e.amount)
    } else {
      farmSpent += Number(e.amount)
    }
  }

  const totalSplit = farmSpent + personalSpent || 1
  const farmPct = Math.round((farmSpent / totalSplit) * 100)
  const personalPct = 100 - farmPct

  const filteredFeed = useMemo(() => {
    return verifiedExpenses.filter((e) => {
      if (typeFilter === 'All') return true
      const cat = categories.find((c) => c.id === e.category_id)
      return cat?.type === typeFilter
    })
  }, [verifiedExpenses, typeFilter, categories])

  return (
    <main className="app-shell">
      <Header lang={lang} setLang={setLang} role={getTranslation(lang, 'owner')} onLogout={onLogout} />
      <div className="page-content">
        {tab === 'home' && (
          <>
            <div className="mb-5">
              <p className="text-sm text-muted-foreground">Welcome back, {profile.name}</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight">The big picture.</h2>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="stat-card">
                <p className="text-[10px] font-medium leading-3 text-muted-foreground">{getTranslation(lang, 'totalReceived')}</p>
                <p className="mt-2 text-[15px] font-bold tracking-tight">{formatCurrency(confirmedDeposits)}</p>
              </div>
              <div className="stat-card">
                <p className="text-[10px] font-medium leading-3 text-muted-foreground">{getTranslation(lang, 'totalSpent')}</p>
                <p className="mt-2 text-[15px] font-bold tracking-tight">{formatCurrency(allExpensesSum)}</p>
              </div>
              <div className="stat-card highlight">
                <p className="text-[10px] font-medium leading-3 text-muted-foreground">{getTranslation(lang, 'totalBalance')}</p>
                <p className="mt-2 text-[15px] font-bold tracking-tight text-[#1f5f46] dark:text-[#35b586]">{formatCurrency(totalBalance)}</p>
              </div>
            </div>

            <div className="section-heading">
              <h3>{getTranslation(lang, 'spendingBreakdown')}</h3>
            </div>

            <div className="split-card">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <span className="dot" /> Farm ({farmPct}%)
                </div>
                <p className="mt-2 text-xl font-bold">{formatCurrency(farmSpent)}</p>
                <div className="progress">
                  <span style={{ width: `${farmPct}%` }} />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <span className="dot personal" /> Personal ({personalPct}%)
                </div>
                <p className="mt-2 text-xl font-bold">{formatCurrency(personalSpent)}</p>
                <div className="progress">
                  <span className="personal-bar" style={{ width: `${personalPct}%` }} />
                </div>
              </div>
            </div>

            <div className="section-heading mt-4">
              <h3>{getTranslation(lang, 'expenseFeed')}</h3>
              <button onClick={() => setTab('feed')}>
                View all <ChevronRight className="size-4" />
              </button>
            </div>

            <div className="card-list">
              {verifiedExpenses.slice(0, 5).map((e) => (
                <ExpenseRow key={e.id} expense={e} categories={categories} onClick={() => setSelected(e)} />
              ))}
            </div>
          </>
        )}

        {tab === 'feed' && (
          <>
            <div className="mb-5">
              <h2 className="text-2xl font-bold tracking-tight">{getTranslation(lang, 'expenseFeed')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">Verified expenses from your coconut grove</p>
            </div>

            <div className="filter-pills">
              {(['All', 'Farm', 'Personal'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`filter-pill ${typeFilter === t ? 'active' : ''}`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="card-list mt-4">
              {filteredFeed.length === 0 ? (
                <p className="p-5 text-center text-xs text-muted-foreground">{getTranslation(lang, 'noExpenses')}</p>
              ) : (
                filteredFeed.map((e) => (
                  <ExpenseRow key={e.id} expense={e} categories={categories} onClick={() => setSelected(e)} />
                ))
              )}
            </div>
          </>
        )}

        {tab === 'settings' && (
          <SettingsView
            profile={profile}
            openingBalance={openingBalance}
            categories={categories}
            expenses={expenses}
            deposits={deposits}
            lang={lang}
            theme={theme}
            onToggleTheme={onToggleTheme}
            onLogout={onLogout}
            onRefresh={onRefresh}
            owner
            deferredPrompt={deferredPrompt}
            onPwaInstalled={onPwaInstalled}
            periodStartDate={periodStartDate}
          />
        )}
      </div>

      <BottomNav role="owner" active={tab} onChange={setTab} lang={lang} />

      {selected && (
        <ExpenseDetailModal
          expense={selected}
          categories={categories}
          profile={profile}
          lang={lang}
          onClose={() => setSelected(null)}
        />
      )}
    </main>
  )
}

// ==============================================================================
// LEDGER SCREEN (CSV + EXCEL IMPORT / EXPORT)
// ==============================================================================
// --- EDIT DEPOSIT PARTICULARS MODAL ---
function EditDepositModal({
  deposit,
  lang,
  onClose,
  onSuccess,
}: {
  deposit: Deposit
  lang: Language
  onClose: () => void
  onSuccess: () => void
}) {
  const [date, setDate] = useState(deposit.date)
  const [amount, setAmount] = useState(deposit.amount.toString())
  const [fromName, setFromName] = useState(deposit.from_name || '')
  const [reference, setReference] = useState(deposit.reference || '')
  const [mode, setMode] = useState(deposit.mode)
  const [saving, setSaving] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Please enter a valid amount')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase
        .from('deposits')
        .update({
          date,
          amount: numAmount,
          from_name: fromName.trim() || null,
          reference: reference.trim() || null,
          mode,
        })
        .eq('id', deposit.id)

      if (error) {
        if (error.message?.includes('Locked')) {
          alert('Database trigger active. Please run the 1-click SQL in supabase/allow-accountant-editing.sql in your Supabase Dashboard to enable full editing permissions.')
          return
        }
        throw error
      }
      onSuccess()
    } catch (err: any) {
      alert(`Error updating deposit: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(lang === 'ta' ? 'இந்த வைப்புத்தொகையை நிச்சயமாக நீக்க விரும்புகிறீர்களா?' : 'Are you sure you want to permanently delete this deposit?')) return
    setSaving(true)
    try {
      const { error } = await supabase.from('deposits').delete().eq('id', deposit.id)
      if (error) {
        if (error.message?.includes('Locked')) {
          alert('Database trigger active. Please run the 1-click SQL in supabase/allow-accountant-editing.sql in your Supabase Dashboard to enable full editing permissions.')
          return
        }
        throw error
      }
      onSuccess()
    } catch (err: any) {
      alert(`Error deleting deposit: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Edit Deposit" onClose={onClose}>
      <form onSubmit={handleSave} className="form-stack">
        <label>
          <span>Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </label>

        <label>
          <span>Amount (₹)</span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </label>

        <label>
          <span>Source / Deposit Type</span>
          <input
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
            placeholder="e.g. Owner Deposit, Coconut Harvest Sale"
          />
        </label>

        <label>
          <span>Mode</span>
          <select value={mode} onChange={(e) => setMode(e.target.value as any)}>
            <option value="Cash">Cash</option>
            <option value="GPay">GPay</option>
            <option value="Bank">Bank</option>
          </select>
        </label>

        <label>
          <span>Reference / Note</span>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g. Advance for tractor, 2,500 nuts"
          />
        </label>

        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={saving} className="primary-button flex-1">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleDelete}
            className="secondary-button !border-destructive/40 text-destructive hover:bg-destructive/10 !px-3"
            title="Delete Deposit"
          >
            Delete
          </button>
        </div>
      </form>
    </Modal>
  )
}

function LedgerScreen({
  expenses,
  deposits,
  categories,
  openingBalance,
  lang,
  accountant,
  profile,
  onRefresh,
  periodStartDate,
}: {
  expenses: Expense[]
  deposits: Deposit[]
  categories: Category[]
  openingBalance: number
  lang: Language
  accountant?: boolean
  profile?: Profile
  onRefresh?: () => void
  periodStartDate?: string | null
}) {
  const [periodMode, setPeriodMode] = useState<'current' | 'all'>('current')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [showImportModal, setShowImportModal] = useState(false)
  const [showRecordDeposit, setShowRecordDeposit] = useState(false)
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null)
  const [selectedDeposit, setSelectedDeposit] = useState<Deposit | null>(null)

  // Pending deposits check
  // Build sorted chronological entries (5 Columns: Date, Particular, Expense, Income, Balance)
  const isFiltered = categoryFilter !== 'ALL' || searchQuery.trim() !== ''

  const rows = useMemo(() => {
    type LedgerRow = {
      id: string
      date: string
      created_at?: string
      particular: string
      expense: number
      income: number
      category_id?: string
      type: 'deposit' | 'expense'
    }

    const items: LedgerRow[] = []

    // 1. Confirmed deposits (Owner capital injections: 50k, 1L, etc.) -> Recorded in Income column
    for (const d of deposits) {
      if (d.status === 'Confirmed') {
        const from = d.from_name ? d.from_name : 'Owner Deposit'
        const ref = d.reference ? ` · ${d.reference}` : ''
        const particular = `${from}${ref} (${d.mode})`
        items.push({
          id: d.id,
          date: d.date,
          created_at: d.created_at,
          particular,
          expense: 0,
          income: Number(d.amount),
          type: 'deposit',
        })
      }
    }

    // 2. All expenses and staff payouts -> Recorded in Expense column
    for (const e of expenses) {
      const cat = categories.find((c) => c.id === e.category_id)
      const catName = cat?.name || 'Expense'
      const particular = e.note ? `${catName} (${e.note})` : catName

      items.push({
        id: e.id,
        date: e.date,
        created_at: e.created_at,
        particular,
        expense: Number(e.amount),
        income: 0,
        category_id: e.category_id,
        type: 'expense',
      })
    }

    // Sort chronologically ascending (oldest date first, deterministic secondary sort by created_at)
    items.sort((a, b) => {
      const dDiff = new Date(a.date).getTime() - new Date(b.date).getTime()
      if (dDiff !== 0) return dDiff
      if (a.created_at && b.created_at) {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      }
      return 0
    })

    // Filter
    let filtered = items
    if (periodMode === 'current' && periodStartDate) {
      filtered = filtered.filter((r) => !r.created_at || r.created_at >= periodStartDate)
    }
    if (categoryFilter !== 'ALL') {
      filtered = filtered.filter((r) => r.category_id === categoryFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      filtered = filtered.filter((r) => r.particular.toLowerCase().includes(q))
    }
    if (startDate) {
      filtered = filtered.filter((r) => r.date >= startDate)
    }
    if (endDate) {
      filtered = filtered.filter((r) => r.date <= endDate)
    }

    // In full cash book: starts with openingBalance, calculates running cash-in-hand
    // In filtered work/category ledger: starts at 0, calculates running total spent on this work
    let running = isFiltered ? 0 : openingBalance
    return filtered.map((item) => {
      running = isFiltered ? running + item.expense + item.income : running + item.income - item.expense
      return {
        ...item,
        balance: running,
      }
    })
  }, [expenses, deposits, categories, openingBalance, categoryFilter, searchQuery, isFiltered, startDate, endDate, periodMode, periodStartDate])

  // Download CSV (5 columns)
  const handleDownloadCSV = () => {
    const headers = ['Date', 'Particular', 'Expense', 'Income', 'Balance']
    const csvRows = [headers.join(',')]
    csvRows.push([formatDate(new Date().toISOString().slice(0, 10)), 'Opening Balance', '', '', openingBalance].join(','))

    for (const r of rows) {
      const dateStr = formatDate(r.date)
      const partStr = `"${r.particular.replace(/"/g, '""')}"`
      const expStr = r.expense > 0 ? r.expense : ''
      const incStr = r.income > 0 ? r.income : ''
      const balStr = r.balance
      csvRows.push([dateStr, partStr, expStr, incStr, balStr].join(','))
    }

    // Summary footer row
    const totalExp = rows.reduce((s, r) => s + r.expense, 0)
    const totalInc = rows.reduce((s, r) => s + r.income, 0)
    const finalBal = rows.length > 0 ? rows[rows.length - 1].balance : openingBalance
    csvRows.push(['', '', '', '', ''].join(','))
    csvRows.push(['TOTAL', '"Net Period Total"', totalExp > 0 ? totalExp : '', totalInc > 0 ? totalInc : '', finalBal].join(','))

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `thoppu-ledger-${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Download .xlsx Excel (5 columns)
  const handleDownloadExcel = () => {
    exportToExcel(
      rows.map((r) => ({
        date: formatDate(r.date),
        particular: r.particular,
        expense: r.expense,
        income: r.income,
        balance: r.balance,
      })),
      openingBalance,
      `thoppu-ledger-${new Date().toISOString().slice(0, 10)}.xlsx`
    )
  }

  // Download .pdf Report (5 columns)
  const handleDownloadPdf = () => {
    exportToPdf(
      rows.map((r) => ({
        date: formatDate(r.date),
        particular: r.particular,
        expense: r.expense,
        income: r.income,
        balance: r.balance,
      })),
      openingBalance,
      'Thoppu Farm Ledger Report',
      `thoppu-ledger-${new Date().toISOString().slice(0, 10)}.pdf`
    )
  }

  return (
    <div className="pb-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{getTranslation(lang, 'ledger')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">Running farm cash book & bank reconciliation</p>
        </div>
      </div>

      {/* Period Filter Selector: Current Period vs Full Archive */}
      {periodStartDate && (
        <div className="mb-4 flex items-center justify-between gap-2 p-1.5 rounded-2xl bg-[#f0f4f1] dark:bg-[#151e18] border border-[#d9dfd9] dark:border-[#2e4235]">
          <button
            type="button"
            onClick={() => setPeriodMode('current')}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold transition-all ${
              periodMode === 'current'
                ? 'bg-white dark:bg-[#1f2c23] text-[#18221c] dark:text-[#f2f5f3] shadow-sm font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Current Period (Active)
          </button>
          <button
            type="button"
            onClick={() => setPeriodMode('all')}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold transition-all ${
              periodMode === 'all'
                ? 'bg-white dark:bg-[#1f2c23] text-[#18221c] dark:text-[#f2f5f3] shadow-sm font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Full Archive (All Time)
          </button>
        </div>
      )}

      {/* Search Input for Work / Particulars */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search work or note (e.g. kadalai, sand, diesel, thopu)..."
          className="w-full pl-9 pr-8 py-2 rounded-xl border border-[#d9dfd9] dark:border-[#2e4235] text-xs bg-white dark:bg-[#151e18]"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {isFiltered && (
        <div className="mb-3 p-2 rounded-xl bg-[#e8f3eb] dark:bg-[#1a2d22] border border-[#35b586]/30 flex items-center justify-between text-xs">
          <span className="font-semibold text-[#1f5f46] dark:text-[#35b586]">
            Showing Category Ledger ({rows.length} {rows.length === 1 ? 'entry' : 'entries'})
          </span>
          <button
            onClick={() => {
              setCategoryFilter('ALL')
              setSearchQuery('')
            }}
            className="text-[11px] font-bold text-destructive hover:underline"
          >
            Clear Filter (Show All)
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 grid grid-cols-2 gap-2 text-xs">
        <div>
          <label className="text-[11px] font-bold text-muted-foreground">From Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-xl border border-[#d9dfd9] dark:border-[#2e4235] p-2 bg-white dark:bg-[#151e18]"
          />
        </div>
        <div>
          <label className="text-[11px] font-bold text-muted-foreground">To Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full rounded-xl border border-[#d9dfd9] dark:border-[#2e4235] p-2 bg-white dark:bg-[#151e18]"
          />
        </div>
        <div className="col-span-2">
          <label className="text-[11px] font-bold text-muted-foreground">Category Filter</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full rounded-xl border border-[#d9dfd9] dark:border-[#2e4235] p-2 bg-white dark:bg-[#151e18]"
          >
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Export / Import & Add Deposit Action Buttons */}
      <div className="mb-4 space-y-2">
        <div className="grid grid-cols-3 gap-2">
          <button onClick={handleDownloadPdf} className="secondary-button text-xs !px-1.5 justify-center">
            <FileText className="size-4 text-[#1f5f46] dark:text-[#35b586] shrink-0" />
            PDF
          </button>
          <button onClick={handleDownloadExcel} className="secondary-button text-xs !px-1.5 justify-center">
            <FileSpreadsheet className="size-4 text-[#1f5f46] dark:text-[#35b586] shrink-0" />
            Excel
          </button>
          <button onClick={handleDownloadCSV} className="secondary-button text-xs !px-1.5 justify-center">
            <ArrowDownToLine className="size-4 text-[#1f5f46] dark:text-[#35b586] shrink-0" />
            CSV
          </button>
        </div>
        {accountant && (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setShowRecordDeposit(true)}
              className="primary-button !min-h-[40px] text-xs justify-center"
            >
              <Plus className="size-4" />
              + Record Deposit
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="secondary-button !min-h-[40px] text-xs border-dashed justify-center"
            >
              <Upload className="size-4" />
              {getTranslation(lang, 'importExcel')}
            </button>
          </div>
        )}
      </div>

      {/* Ledger Table (5 Columns: Date, Particular, Expense, Income, Balance) */}
      <div className="overflow-x-auto -mx-1 px-1">
        <div className="ledger-table min-w-[365px]">
          <div className="ledger-head !grid-cols-[48px_1fr_60px_60px_68px] !gap-1.5 text-[11px]">
            <span>Date</span>
            <span>Particular</span>
            <span className="text-right text-destructive font-bold">Expense</span>
            <span className="text-right text-[#1f5f46] dark:text-[#35b586] font-bold">Income</span>
            <span className="text-right font-bold">{isFiltered ? 'Total Spent' : 'Balance'}</span>
          </div>

          {/* Opening balance row at top (Cash Book view only) */}
          {!isFiltered && (
            <div className="ledger-row opening-row !grid-cols-[48px_1fr_60px_60px_68px] !gap-1.5 font-semibold text-xs bg-[#f4f7f4] dark:bg-[#1a261f]">
              <span>—</span>
              <span className="truncate text-[#1f5f46] dark:text-[#35b586] font-bold">Opening Balance</span>
              <span className="text-right text-muted-foreground">—</span>
              <span className="text-right text-muted-foreground">—</span>
              <span className="text-right text-[#1f5f46] dark:text-[#35b586] font-bold">{formatCurrency(openingBalance)}</span>
            </div>
          )}

          {/* Chronological transaction rows (Date Order) */}
          {rows.map((r) => (
            <div
              key={r.id}
              onClick={() => {
                if (!accountant) return
                if (r.type === 'expense') {
                  const exp = expenses.find((e) => e.id === r.id)
                  if (exp) setSelectedExpense(exp)
                } else if (r.type === 'deposit') {
                  const dep = deposits.find((d) => d.id === r.id)
                  if (dep) setSelectedDeposit(dep)
                }
              }}
              className={`ledger-row !grid-cols-[48px_1fr_60px_60px_68px] !gap-1.5 text-xs ${accountant ? 'cursor-pointer hover:bg-[#f5f8f5] dark:hover:bg-[#1a251f] transition-colors' : ''}`}
              title={accountant ? 'Click to inspect or edit details' : undefined}
            >
              <span className="truncate text-muted-foreground" title={r.date}>{formatLedgerDate(r.date)}</span>
              <span className="truncate font-medium">{r.particular}</span>
              <span className="text-right text-destructive font-semibold">
                {r.expense > 0 ? formatCurrency(r.expense).replace('₹', '') : '—'}
              </span>
              <span className="text-right text-[#1f5f46] dark:text-[#35b586] font-semibold">
                {r.income > 0 ? formatCurrency(r.income).replace('₹', '') : '—'}
              </span>
              <span className="text-right font-bold text-[#18221c] dark:text-[#f2f5f3]">
                {formatCurrency(r.balance).replace('₹', '')}
              </span>
            </div>
          ))}

          {/* Summary Footer with Total Expenses, Total Income, and Final Closing Balance */}
          <div className="ledger-row closing-row !grid-cols-[48px_1fr_60px_60px_68px] !gap-1.5 font-bold text-xs bg-[#eef4ef] dark:bg-[#1c2c22] border-t-2 border-[#1f5f46]/30 mt-1">
            <span>TOTAL</span>
            <span className="truncate text-muted-foreground uppercase text-[10px]">
              {isFiltered ? 'Filtered Total' : 'Net Period Total'}
            </span>
            <span className="text-right text-destructive font-bold">
              {rows.reduce((s, r) => s + r.expense, 0) > 0 ? formatCurrency(rows.reduce((s, r) => s + r.expense, 0)).replace('₹', '') : '—'}
            </span>
            <span className="text-right text-[#1f5f46] dark:text-[#35b586] font-bold">
              {rows.reduce((s, r) => s + r.income, 0) > 0 ? formatCurrency(rows.reduce((s, r) => s + r.income, 0)).replace('₹', '') : '—'}
            </span>
            <span className="text-right font-extrabold text-[#1f5f46] dark:text-[#35b586]">
              {formatCurrency(isFiltered ? rows.reduce((s, r) => s + r.expense, 0) : (rows.length > 0 ? rows[rows.length - 1].balance : openingBalance)).replace('₹', '')}
            </span>
          </div>
        </div>
      </div>

      {/* MODALS */}
      {showImportModal && (
        <ExcelImportModal
          categories={categories}
          lang={lang}
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            setShowImportModal(false)
            onRefresh?.()
          }}
        />
      )}

      {showRecordDeposit && profile && (
        <DepositModal
          profile={profile}
          lang={lang}
          onClose={() => setShowRecordDeposit(false)}
          onSuccess={() => {
            setShowRecordDeposit(false)
            onRefresh?.()
          }}
        />
      )}

      {selectedDeposit && (
        <EditDepositModal
          deposit={selectedDeposit}
          lang={lang}
          onClose={() => setSelectedDeposit(null)}
          onSuccess={() => {
            setSelectedDeposit(null)
            onRefresh?.()
          }}
        />
      )}

      {selectedExpense && (
        <ExpenseDetailModal
          expense={selectedExpense}
          categories={categories}
          profile={profile || { id: '', name: 'Accountant', role: 'accountant', username: 'accountant', property_id: DEFAULT_PROPERTY_ID }}
          lang={lang}
          accountant={accountant}
          onClose={() => setSelectedExpense(null)}
          onUpdated={() => {
            setSelectedExpense(null)
            onRefresh?.()
          }}
        />
      )}
    </div>
  )
}

// ==============================================================================
// EXCEL IMPORT MODAL
// ==============================================================================
function ExcelImportModal({
  categories,
  lang,
  onClose,
  onSuccess,
}: {
  categories: Category[]
  lang: Language
  onClose: () => void
  onSuccess: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [parsedRows, setParsedRows] = useState<ParsedExcelRow[]>([])
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return

    setFile(selected)
    setParsing(true)
    setErrorMsg('')

    try {
      const rows = await parseExcelFile(selected, categories)
      setParsedRows(rows)
    } catch (err: any) {
      setErrorMsg(err.message || 'Error parsing Excel file')
      setParsedRows([])
    } finally {
      setParsing(false)
    }
  }

  const expenseCount = parsedRows.filter((r) => r.type === 'expense').length
  const depositCount = parsedRows.filter((r) => r.type === 'deposit').length

  const handleImport = async () => {
    if (parsedRows.length === 0) return
    setImporting(true)

    try {
      // 1. Prepare batch expenses
      const expenseBatch = parsedRows
        .filter((r) => r.type === 'expense')
        .map((r) => ({
          property_id: DEFAULT_PROPERTY_ID,
          category_id: r.categoryId || categories[0]?.id,
          amount: r.expenseAmount,
          date: r.date,
          note: r.note || null,
          status: 'Verified' as const, // Historical Excel data imports directly as verified
        }))

      // 2. Prepare batch deposits
      const depositBatch = parsedRows
        .filter((r) => r.type === 'deposit')
        .map((r) => ({
          property_id: DEFAULT_PROPERTY_ID,
          amount: r.incomeAmount,
          date: r.date,
          from_name: r.note || 'Excel Import',
          mode: r.mode || 'Cash',
          status: 'Confirmed' as const,
        }))

      if (expenseBatch.length > 0) {
        const { error: expErr } = await supabase.from('expenses').insert(expenseBatch)
        if (expErr) throw expErr
      }

      if (depositBatch.length > 0) {
        const { error: depErr } = await supabase.from('deposits').insert(depositBatch)
        if (depErr) throw depErr
      }

      alert(getTranslation(lang, 'importSuccess'))
      onSuccess()
    } catch (err: any) {
      alert(`Import error: ${err.message}`)
    } finally {
      setImporting(false)
    }
  }

  return (
    <Modal title={getTranslation(lang, 'importExcel')} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Upload your existing Excel workbook (`.xlsx`, `.xls`, or `.csv`). Columns expected: <br />
          <code className="text-[#1f5f46] dark:text-[#35b586] font-bold">Date | particular | expenses | income</code>
        </p>

        <input
          type="file"
          accept=".xlsx, .xls, .csv"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="upload-box w-full justify-center !py-6 cursor-pointer"
        >
          <FileSpreadsheet className="size-6 text-[#1f5f46] dark:text-[#35b586]" />
          <span className="font-semibold">{file ? file.name : 'Select Excel (.xlsx) or CSV file'}</span>
        </button>

        {parsing && <p className="text-center text-xs text-[#1f5f46] animate-pulse">Reading and analyzing sheet...</p>}
        {errorMsg && <p className="text-center text-xs font-semibold text-destructive">{errorMsg}</p>}

        {parsedRows.length > 0 && (
          <div className="rounded-xl border border-[#d9dfd9] dark:border-[#2e4235] bg-[#fafcf9] dark:bg-[#151e18] p-3 text-xs space-y-2">
            <div className="flex justify-between font-bold text-sm">
              <span>{parsedRows.length} total rows parsed</span>
              <span className="text-[#1f5f46] dark:text-[#35b586]">Ready to import</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-muted-foreground">
              <p>• {expenseCount} {getTranslation(lang, 'detectedExpenses')}</p>
              <p>• {depositCount} {getTranslation(lang, 'detectedDeposits')}</p>
            </div>

            {/* Preview of first 3 rows */}
            <p className="font-bold pt-2 text-[11px] uppercase tracking-wide text-muted-foreground">Sample Preview:</p>
            <div className="space-y-1">
              {parsedRows.slice(0, 3).map((r, idx) => (
                <div key={idx} className="flex justify-between rounded bg-white dark:bg-[#1a241e] p-1.5 border border-[#edf0eb] dark:border-[#27372d]">
                  <span className="truncate">{formatDate(r.date)} · {r.particular}</span>
                  <span className="font-bold">
                    {r.type === 'expense' ? `-${formatCurrency(r.expenseAmount)}` : `+${formatCurrency(r.incomeAmount)}`}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={handleImport}
              disabled={importing}
              className="primary-button w-full mt-3 !min-h-[44px]"
            >
              {importing ? getTranslation(lang, 'importing') : getTranslation(lang, 'importConfirm')}
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}

// ==============================================================================
// SETTINGS & PROFILE VIEW (PASSWORD UPDATE, DARK MODE TOGGLE, SUPERVISOR CREATION)
// ==============================================================================
function SettingsView({
  profile,
  openingBalance,
  categories = [],
  expenses = [],
  deposits = [],
  lang,
  theme,
  onToggleTheme,
  onLogout,
  onRefresh,
  accountant,
  owner,
  deferredPrompt,
  onPwaInstalled,
  periodStartDate,
}: {
  profile: Profile
  openingBalance: number
  categories?: Category[]
  expenses?: Expense[]
  deposits?: Deposit[]
  lang: Language
  theme: 'light' | 'dark'
  onToggleTheme: (t: 'light' | 'dark') => void
  onLogout: () => void
  onRefresh: () => void
  accountant?: boolean
  owner?: boolean
  deferredPrompt?: any
  onPwaInstalled?: () => void
  periodStartDate?: string | null
}) {
  const [profiles, setProfiles] = useState<any[]>([])
  const [editingName, setEditingName] = useState(false)
  const [newName, setNewName] = useState(profile.name)
  const [editingBal, setEditingBal] = useState(false)
  const [newBal, setNewBal] = useState(openingBalance.toString())
  const [isInstalled, setIsInstalled] = useState(false)
  const [showInstallModal, setShowInstallModal] = useState(false)

  // Live closing balance calculations for active period
  const activeDeposits = useMemo(() => {
    if (!periodStartDate) return deposits || []
    return (deposits || []).filter((d) => !d.created_at || d.created_at >= periodStartDate)
  }, [deposits, periodStartDate])

  const activeExpenses = useMemo(() => {
    if (!periodStartDate) return expenses || []
    return (expenses || []).filter((e) => !e.created_at || e.created_at >= periodStartDate)
  }, [expenses, periodStartDate])

  const confirmedDeposits = activeDeposits.reduce((s, d) => (d.status === 'Confirmed' ? s + Number(d.amount) : s), 0)
  const allExpensesSum = activeExpenses.reduce((s, e) => s + Number(e.amount), 0)
  const currentClosingBalance = openingBalance + confirmedDeposits - allExpensesSum

  // Month-end rollover modal state
  const [showRolloverModal, setShowRolloverModal] = useState(false)
  const [customRolloverBal, setCustomRolloverBal] = useState(currentClosingBalance.toString())
  const [rolloverLoading, setRolloverLoading] = useState(false)

  useEffect(() => {
    const checkInstalled = () => {
      const standalone =
        typeof window !== 'undefined' &&
        (window.matchMedia('(display-mode: standalone)').matches ||
          (window.navigator as any).standalone === true ||
          document.referrer.includes('android-app://'))
      setIsInstalled(!!standalone)
    }
    checkInstalled()
    window.addEventListener('appinstalled', () => setIsInstalled(true))
  }, [])

  // Category creation
  const [showAddCat, setShowAddCat] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatType, setNewCatType] = useState<'Farm' | 'Personal'>('Farm')

  // Password update (any user / supervisor)
  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMsg, setPasswordMsg] = useState({ text: '', isError: false })
  const [passwordLoading, setPasswordLoading] = useState(false)

  // User / Supervisor creation (accountant only)
  const [showAddUser, setShowAddUser] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [newUserFullName, setNewUserFullName] = useState('')
  const [newUserRole, setNewUserRole] = useState<'supervisor' | 'owner'>('supervisor')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [userLoading, setUserLoading] = useState(false)
  const [userMsg, setUserMsg] = useState({ text: '', isError: false })

  // Load team members with active/banned status from /api/admin/users
  const loadTeamMembers = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (token && accountant) {
        const res = await fetch('/api/admin/users', {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (res.ok) {
          const json = await res.json()
          if (json.users) {
            setProfiles(json.users)
            return
          }
        }
      }
      const { data } = await supabase.from('profiles').select('*')
      if (data) setProfiles(data as Profile[])
    } catch {
      const { data } = await supabase.from('profiles').select('*')
      if (data) setProfiles(data as Profile[])
    }
  }

  useEffect(() => {
    setNewName(profile.name)
  }, [profile.name])

  useEffect(() => {
    setNewBal(openingBalance.toString())
  }, [openingBalance])

  useEffect(() => {
    loadTeamMembers()
  }, [accountant])

  const handleUpdateName = async () => {
    if (!newName.trim()) return
    try {
      const { error } = await supabase.from('profiles').update({ name: newName.trim() }).eq('id', profile.id)
      if (error) throw error
      setEditingName(false)
      onRefresh()
    } catch (err: any) {
      alert('Error updating name: ' + (err.message || err))
    }
  }

  const handleUpdateBalance = async () => {
    const val = parseFloat(newBal)
    if (isNaN(val)) return
    try {
      const { error } = await supabase.from('settings').update({ opening_balance: val }).eq('property_id', DEFAULT_PROPERTY_ID)
      if (error) throw error
      setEditingBal(false)
      onRefresh()
    } catch (err: any) {
      alert('Error updating balance: ' + (err.message || err))
    }
  }

  // Generate full closing ledger rows for PDF & Excel archiving (5 Columns)
  const getClosingLedgerRows = () => {
    const items: Array<{
      date: string
      particular: string
      expense: number
      income: number
    }> = []

    // 1. Confirmed active deposits -> Direct into Income column
    for (const d of (activeDeposits || [])) {
      if (d.status === 'Confirmed') {
        const from = d.from_name ? d.from_name : 'Owner'
        const ref = d.reference ? ` · ${d.reference}` : ''
        items.push({
          date: formatDate(d.date),
          particular: `${from}${ref} (${d.mode})`,
          expense: 0,
          income: Number(d.amount),
        })
      }
    }

    // 2. Active expenses -> Strictly Expense column (including salaries)
    for (const e of (activeExpenses || [])) {
      const cat = (categories || []).find((c) => c.id === e.category_id)
      const catName = cat?.name || 'Expense'
      const particular = e.note ? `${catName} (${e.note})` : catName

      items.push({
        date: formatDate(e.date),
        particular,
        expense: Number(e.amount),
        income: 0,
      })
    }

    // Sort chronologically ascending
    items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // Running balance
    let running = openingBalance
    return items.map((item) => {
      running = running + item.income - item.expense
      return {
        ...item,
        balance: running,
      }
    })
  }

  const handleApplyRollover = async () => {
    const val = parseFloat(customRolloverBal)
    if (isNaN(val)) {
      alert('Please enter a valid amount')
      return
    }
    setRolloverLoading(true)
    try {
      const nowIso = new Date().toISOString()
      const { error } = await supabase
        .from('settings')
        .update({
          opening_balance: val,
          updated_at: nowIso,
        })
        .eq('property_id', DEFAULT_PROPERTY_ID)

      if (error) throw error
      setShowRolloverModal(false)
      onRefresh()
    } catch (err: any) {
      alert(`Error updating balance: ${err.message}`)
    } finally {
      setRolloverLoading(false)
    }
  }

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return
    try {
      const { error } = await supabase.from('categories').insert({
        property_id: DEFAULT_PROPERTY_ID,
        name: newCatName.trim(),
        type: newCatType,
        active: true,
      })
      if (error) throw error
      setNewCatName('')
      setShowAddCat(false)
      onRefresh()
    } catch (err: any) {
      alert('Error adding category: ' + (err.message || err))
    }
  }

  const handleToggleCategory = async (cat: Category) => {
    try {
      const { error } = await supabase.from('categories').update({ active: !cat.active }).eq('id', cat.id)
      if (error) throw error
      onRefresh()
    } catch (err: any) {
      alert('Error updating category status: ' + (err.message || err))
    }
  }

  const handleDeleteCategory = async (cat: Category) => {
    const confirmPrompt =
      lang === 'ta'
        ? `"${cat.name}" வகையை நிச்சயமாக நீக்க விரும்புகிறீர்களா?`
        : `Are you sure you want to permanently delete category "${cat.name}"?`

    if (!confirm(confirmPrompt)) return

    try {
      const { count } = await supabase
        .from('expenses')
        .select('*', { count: 'exact', head: true })
        .eq('category_id', cat.id)

      if (count && count > 0) {
        alert(
          lang === 'ta'
            ? `"${cat.name}" வகை ${count} செலவுகளில் பயன்படுத்தப்பட்டுள்ளது. பழைய கணக்குகள் பாதிக்கப்படாமல் இருக்க, இதை நீக்குவதற்கு பதிலாக 'Deactivate' செய்யவும்.`
            : `Cannot delete "${cat.name}" because it is already linked to ${count} recorded expense(s). Please Deactivate it instead to hide it while preserving your records.`
        )
        return
      }

      const { error } = await supabase.from('categories').delete().eq('id', cat.id)
      if (error) {
        alert('Failed to delete category: ' + error.message)
      } else {
        onRefresh()
      }
    } catch (err: any) {
      alert('Error deleting category: ' + (err.message || err))
    }
  }

  // Handle password update for supervisor or any logged in user
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 6) {
      setPasswordMsg({ text: getTranslation(lang, 'passwordTooShort'), isError: true })
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ text: getTranslation(lang, 'passwordMismatch'), isError: true })
      return
    }

    setPasswordLoading(true)
    setPasswordMsg({ text: '', isError: false })

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error

      setPasswordMsg({ text: getTranslation(lang, 'passwordChanged'), isError: false })
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setShowPasswordChange(false), 2000)
    } catch (err: any) {
      setPasswordMsg({ text: err.message || 'Error updating password', isError: true })
    } finally {
      setPasswordLoading(false)
    }
  }

  // Accountant creates supervisor / user
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newUsername.trim() || !newUserFullName.trim() || !newUserPassword.trim()) {
      setUserMsg({ text: getTranslation(lang, 'fillRequired'), isError: true })
      return
    }

    setUserLoading(true)
    setUserMsg({ text: '', isError: false })

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: newUsername.trim(),
          name: newUserFullName.trim(),
          role: newUserRole,
          password: newUserPassword.trim(),
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to create user')

      setUserMsg({ text: getTranslation(lang, 'userCreated'), isError: false })
      setNewUsername('')
      setNewUserFullName('')
      setNewUserPassword('')

      // Reload team
      loadTeamMembers()

      setTimeout(() => setShowAddUser(false), 1500)
    } catch (err: any) {
      setUserMsg({ text: err.message, isError: true })
    } finally {
      setUserLoading(false)
    }
  }

  // Toggle supervisor active/inactive
  const handleToggleUserBan = async (u: any) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId: u.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to update user status')
      loadTeamMembers()
    } catch (err: any) {
      alert(err.message)
    }
  }

  // Delete supervisor
  const handleDeleteUser = async (u: any) => {
    if (!confirm(lang === 'ta' ? `"${u.name}" பயனரை நிச்சயமாக நீக்க விரும்புகிறீர்களா?` : `Are you sure you want to permanently delete "${u.name}"?`)) return
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      const res = await fetch(`/api/admin/users?userId=${u.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to delete user')
      loadTeamMembers()
    } catch (err: any) {
      alert(err.message)
    }
  }

  return (
    <div className="space-y-4 pb-8">
      <div className="mb-2">
        <h2 className="text-2xl font-bold tracking-tight">{getTranslation(lang, 'settings')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Account, ledger configuration & farm preferences</p>
      </div>

      {/* CARD 1: ACCOUNT & PREFERENCES (ALL USERS) */}
      <div className="settings-card !p-4 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#edf0eb] dark:border-[#27372d]">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-full bg-[#1f5f46] text-white font-bold text-base shadow-sm">
              {profile.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-bold text-[#18221c] dark:text-[#f2f5f3]">{profile.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="badge badge-green !text-[10px] capitalize">{profile.role}</span>
                <span className="text-[11px] text-muted-foreground">@{profile.username}</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setEditingName(!editingName)}
            className="text-xs font-semibold text-[#1f5f46] dark:text-[#35b586] hover:underline"
          >
            {editingName ? getTranslation(lang, 'cancel') : getTranslation(lang, 'edit')}
          </button>
        </div>

        {editingName && (
          <div className="p-3 rounded-xl bg-[#f2f6f3] dark:bg-[#151e18] flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Display name"
              className="flex-1 rounded-xl border border-[#d9dfd9] dark:border-[#2e4235] p-2 text-sm bg-white dark:bg-[#151e18]"
            />
            <button onClick={handleUpdateName} className="primary-button !min-h-[36px] !py-1 !px-4 !text-xs whitespace-nowrap">
              {getTranslation(lang, 'save')}
            </button>
          </div>
        )}

        {/* Theme Switcher */}
        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-lg bg-[#f3f6f2] dark:bg-[#1a251f]">
              {theme === 'dark' ? <Moon className="size-4 text-[#35b586]" /> : <Sun className="size-4 text-[#d7a33f]" />}
            </div>
            <div>
              <p className="text-xs font-semibold text-[#18221c] dark:text-[#f2f5f3]">{getTranslation(lang, 'theme')}</p>
              <p className="text-[11px] text-muted-foreground">
                {theme === 'dark' ? getTranslation(lang, 'darkMode') : getTranslation(lang, 'lightMode')}
              </p>
            </div>
          </div>
          <div className="flex rounded-full border border-[#d9dfd9] dark:border-[#2e4235] p-0.5 bg-[#f3f6f2] dark:bg-[#151e18]">
            <button
              onClick={() => onToggleTheme('light')}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                theme === 'light' ? 'bg-[#1f5f46] text-white shadow-sm' : 'text-muted-foreground'
              }`}
            >
              Light
            </button>
            <button
              onClick={() => onToggleTheme('dark')}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                theme === 'dark' ? 'bg-[#1f5f46] text-white shadow-sm' : 'text-muted-foreground'
              }`}
            >
              Dark
            </button>
          </div>
        </div>

        {/* Change Password */}
        <div className="pt-2 border-t border-[#edf0eb] dark:border-[#27372d]">
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2.5">
              <div className="grid size-8 place-items-center rounded-lg bg-[#f3f6f2] dark:bg-[#1a251f]">
                <KeyRound className="size-4 text-[#1f5f46] dark:text-[#35b586]" />
              </div>
              <div>
                <p className="text-xs font-semibold text-[#18221c] dark:text-[#f2f5f3]">{getTranslation(lang, 'changePassword')}</p>
                <p className="text-[11px] text-muted-foreground">Update your login security credentials</p>
              </div>
            </div>
            <button
              onClick={() => setShowPasswordChange(!showPasswordChange)}
              className="text-xs font-semibold text-[#1f5f46] dark:text-[#35b586] hover:underline"
            >
              {showPasswordChange ? getTranslation(lang, 'cancel') : getTranslation(lang, 'edit')}
            </button>
          </div>

          {showPasswordChange && (
            <form onSubmit={handleChangePassword} className="mt-3 rounded-xl bg-[#f2f6f3] dark:bg-[#151e18] p-3.5 text-xs form-stack">
              <label>
                {getTranslation(lang, 'newPassword')}
                <input
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </label>
              <label>
                {getTranslation(lang, 'confirmPassword')}
                <input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </label>

              {passwordMsg.text && (
                <p className={`text-xs font-semibold ${passwordMsg.isError ? 'text-destructive' : 'text-[#1f5f46] dark:text-[#35b586]'}`}>
                  {passwordMsg.text}
                </p>
              )}

              <button type="submit" disabled={passwordLoading} className="primary-button !min-h-[36px] !py-1 !text-xs mt-1">
                {passwordLoading ? getTranslation(lang, 'loading') : getTranslation(lang, 'savePassword')}
              </button>
            </form>
          )}
        </div>

        {/* App Installation & Standalone Status */}
        <div className="pt-2 border-t border-[#edf0eb] dark:border-[#27372d] flex items-center justify-between py-1">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-lg bg-[#e8f3eb] dark:bg-[#1a2d22]">
              <Smartphone className="size-4 text-[#1f5f46] dark:text-[#35b586]" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#18221c] dark:text-[#f2f5f3]">{getTranslation(lang, 'installApp')}</p>
              <p className="text-[11px] text-muted-foreground">
                {isInstalled
                  ? (lang === 'ta' ? 'செயலி நிறுவப்பட்டு இயங்குகிறது' : 'Installed & running as standalone app')
                  : (lang === 'ta' ? 'முகப்புத் திரையில் செயலியாக சேர்க்கவும்' : 'Add to home screen as standalone app')}
              </p>
            </div>
          </div>
          {isInstalled ? (
            <button
              type="button"
              onClick={() => setShowInstallModal(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#e8f3eb] dark:bg-[#1c3024] px-3 py-1.5 text-xs font-bold text-[#1f5f46] dark:text-[#35b586] hover:opacity-80 transition-opacity"
              title="Click to view installation info"
            >
              <Check className="size-3.5" />
              {lang === 'ta' ? 'நிறுவப்பட்டது' : 'Installed'}
            </button>
          ) : (
            <button
              type="button"
              onClick={async () => {
                if (deferredPrompt) {
                  deferredPrompt.prompt()
                  const { outcome } = await deferredPrompt.userChoice
                  if (outcome === 'accepted') {
                    onPwaInstalled?.()
                    setIsInstalled(true)
                  }
                } else {
                  setShowInstallModal(true)
                }
              }}
              className="primary-button !min-h-[32px] !py-1 !px-3 !text-xs whitespace-nowrap"
            >
              {getTranslation(lang, 'installBtn')}
            </button>
          )}
        </div>
      </div>

      {/* CARD 2: FARM LEDGER SETUP & CLOSING (ACCOUNTANT & OWNER ONLY) */}
      {(accountant || owner) && (
        <div className="settings-card !p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#edf0eb] dark:border-[#27372d]">
            <div className="flex items-center gap-2">
              <Wallet className="size-4 text-[#1f5f46] dark:text-[#35b586]" />
              <h3 className="text-sm font-bold text-[#18221c] dark:text-[#f2f5f3]">Farm Ledger Setup & Balances</h3>
            </div>
            <button
              onClick={() => setEditingBal(!editingBal)}
              className="text-xs font-semibold text-[#1f5f46] dark:text-[#35b586] hover:underline"
            >
              {editingBal ? getTranslation(lang, 'cancel') : getTranslation(lang, 'edit')}
            </button>
          </div>

          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-xs font-semibold text-[#18221c] dark:text-[#f2f5f3]">{getTranslation(lang, 'openingBalance')}</p>
              <p className="text-[11px] text-muted-foreground">Starting cash in hand for current period</p>
            </div>
            <span className="text-base font-bold text-[#1f5f46] dark:text-[#35b586]">
              {formatCurrency(openingBalance)}
            </span>
          </div>

          {editingBal && (
            <div className="p-3 rounded-xl bg-[#f2f6f3] dark:bg-[#151e18] flex gap-2">
              <input
                type="number"
                value={newBal}
                onChange={(e) => setNewBal(e.target.value)}
                placeholder="Opening Balance"
                className="flex-1 rounded-xl border border-[#d9dfd9] dark:border-[#2e4235] p-2 text-sm bg-white dark:bg-[#151e18]"
              />
              <button onClick={handleUpdateBalance} className="primary-button !min-h-[36px] !py-1 !px-4 !text-xs whitespace-nowrap">
                {getTranslation(lang, 'save')}
              </button>
            </div>
          )}

          {/* Current Closing Cash Balance */}
          <div className="flex items-center justify-between py-1 pt-2 border-t border-[#edf0eb] dark:border-[#27372d]">
            <div>
              <p className="text-xs font-semibold text-[#18221c] dark:text-[#f2f5f3]">Current Closing Cash in Hand</p>
              <p className="text-[11px] text-muted-foreground">Opening + Deposits - Expenses</p>
            </div>
            <span className={`text-base font-bold ${currentClosingBalance >= 0 ? 'text-[#1f5f46] dark:text-[#35b586]' : 'text-destructive'}`}>
              {formatCurrency(currentClosingBalance)}
            </span>
          </div>

          {accountant && (
            <div className="pt-2 border-t border-[#edf0eb] dark:border-[#27372d] space-y-2">
              <div className="rounded-xl bg-[#e8f3eb] dark:bg-[#1a2d22] p-2.5 text-[11px] text-[#1f5f46] dark:text-[#88d9b6] leading-relaxed">
                <strong>💡 Month-End Closing:</strong> Ready to close the month? Customize the closing balance and carry it forward as the new starting balance.
              </div>
              <button
                type="button"
                onClick={() => {
                  setCustomRolloverBal(currentClosingBalance.toString())
                  setShowRolloverModal(true)
                }}
                className="secondary-button w-full !min-h-[38px] text-xs font-semibold"
              >
                <RefreshCw className="size-3.5 text-[#1f5f46] dark:text-[#35b586]" />
                Month-End Close & Rollover Balance
              </button>
            </div>
          )}
        </div>
      )}

      {/* CARD 3: CATEGORIES MANAGEMENT (ACCOUNTANT ONLY) */}
      {accountant && (
        <div className="settings-card !p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#edf0eb] dark:border-[#27372d]">
            <div className="flex items-center gap-2">
              <Tag className="size-4 text-[#1f5f46] dark:text-[#35b586]" />
              <h3 className="text-sm font-bold text-[#18221c] dark:text-[#f2f5f3]">
                {getTranslation(lang, 'categories')} ({categories.length})
              </h3>
            </div>
            <button
              onClick={() => setShowAddCat(!showAddCat)}
              className="text-xs font-semibold text-[#1f5f46] dark:text-[#35b586] hover:underline"
            >
              {showAddCat ? getTranslation(lang, 'cancel') : `+ ${getTranslation(lang, 'addCategory')}`}
            </button>
          </div>

          {showAddCat && (
            <div className="rounded-xl bg-[#f2f6f3] dark:bg-[#151e18] p-3 text-xs form-stack mb-2">
              <label>
                {getTranslation(lang, 'categoryName')}
                <input
                  placeholder="e.g. Irrigation, Fuel, Coconut Sale"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                />
              </label>
              <label>
                {getTranslation(lang, 'categoryType')}
                <select
                  value={newCatType}
                  onChange={(e) => setNewCatType(e.target.value as any)}
                >
                  <option value="Farm">{getTranslation(lang, 'farm')}</option>
                  <option value="Personal">{getTranslation(lang, 'personal')}</option>
                </select>
              </label>
              <button onClick={handleAddCategory} className="primary-button !min-h-[34px] !py-1 !text-xs mt-1">
                {getTranslation(lang, 'save')}
              </button>
            </div>
          )}

          {/* Scrollable category list with clean padding */}
          <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1 divide-y divide-[#edf0eb] dark:divide-[#27372d]">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between pt-1.5 pb-1 text-xs">
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <span className={`dot shrink-0 ${c.type === 'Personal' ? 'personal' : ''}`} />
                  <span className={`truncate font-medium ${c.active ? 'text-[#18221c] dark:text-[#f2f5f3]' : 'text-muted-foreground line-through'}`}>
                    {c.name}
                  </span>
                  <span className={`badge shrink-0 !text-[10px] ${c.type === 'Personal' ? 'badge-amber' : 'badge-green'}`}>
                    {c.type}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleToggleCategory(c)}
                    className="text-[11px] font-semibold text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded"
                  >
                    {c.active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(c)}
                    className="text-[11px] font-semibold text-destructive hover:underline px-1 py-0.5"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CARD 4: FARM TEAM MEMBERS (ACCOUNTANT ONLY - STRICTLY HIDDEN FOR OTHERS) */}
      {accountant && (
        <div className="settings-card !p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#edf0eb] dark:border-[#27372d]">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-[#1f5f46] dark:text-[#35b586]" />
              <h3 className="text-sm font-bold text-[#18221c] dark:text-[#f2f5f3]">
                Farm Team ({profiles.length})
              </h3>
            </div>
            <button
              onClick={() => setShowAddUser(!showAddUser)}
              className="text-xs font-semibold text-[#1f5f46] dark:text-[#35b586] hover:underline"
            >
              {showAddUser ? getTranslation(lang, 'cancel') : `+ ${getTranslation(lang, 'createUser')}`}
            </button>
          </div>

          {showAddUser && (
            <form onSubmit={handleCreateUser} className="rounded-xl bg-[#f2f6f3] dark:bg-[#151e18] p-3.5 text-xs form-stack mb-2">
              <label>
                {getTranslation(lang, 'enterUsername')}
                <input
                  placeholder="e.g. kannan or supervisor2"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  required
                />
              </label>
              <label>
                {getTranslation(lang, 'fullName')}
                <input
                  placeholder="e.g. Kannan S."
                  value={newUserFullName}
                  onChange={(e) => setNewUserFullName(e.target.value)}
                  required
                />
              </label>
              <label>
                {getTranslation(lang, 'role')}
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as any)}
                >
                  <option value="supervisor">{getTranslation(lang, 'supervisor')}</option>
                  <option value="owner">{getTranslation(lang, 'owner')}</option>
                </select>
              </label>
              <label>
                {getTranslation(lang, 'initialPassword')}
                <input
                  type="password"
                  placeholder="••••••••"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </label>

              {userMsg.text && (
                <p className={`text-xs font-semibold ${userMsg.isError ? 'text-destructive' : 'text-[#1f5f46] dark:text-[#35b586]'}`}>
                  {userMsg.text}
                </p>
              )}

              <button type="submit" disabled={userLoading} className="primary-button !min-h-[34px] !py-1 !text-xs mt-1">
                {userLoading ? getTranslation(lang, 'loading') : getTranslation(lang, 'save')}
              </button>
            </form>
          )}

          {/* Clean Member List */}
          <div className="space-y-2">
            {profiles.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-2.5 rounded-xl bg-[#f8faf7] dark:bg-[#1a251f] text-xs">
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <div className="grid size-7 shrink-0 place-items-center rounded-full bg-[#e8f0eb] dark:bg-[#25372c] text-[#1f5f46] dark:text-[#35b586] font-bold text-xs">
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className={`font-semibold truncate ${p.is_banned ? 'line-through text-muted-foreground' : 'text-[#18221c] dark:text-[#f2f5f3]'}`}>
                      {p.name}
                      {p.id === profile.id && <span className="ml-1 text-[10px] font-normal text-muted-foreground">(You)</span>}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">@{p.username}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`badge ${p.role === 'accountant' ? 'badge-green' : p.role === 'owner' ? 'badge-amber' : 'badge-grey'} capitalize`}>
                    {p.role}
                  </span>
                  {p.is_banned && (
                    <span className="badge badge-amber !text-[10px]">Inactive</span>
                  )}
                  {p.id !== profile.id && p.role === 'supervisor' && (
                    <div className="flex items-center gap-1.5 ml-1">
                      <button
                        type="button"
                        onClick={() => handleToggleUserBan(p)}
                        className="text-[11px] font-semibold text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded border border-[#d9dfd9] dark:border-[#2e4235]"
                      >
                        {p.is_banned ? 'Activate' : 'Deactivate'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteUser(p)}
                        className="text-[11px] font-semibold text-destructive hover:underline px-1 py-0.5"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LOGOUT BUTTON */}
      <button onClick={onLogout} className="secondary-button w-full text-destructive hover:bg-destructive/10 !min-h-[44px]">
        <LogOut className="size-4" />
        {getTranslation(lang, 'switchUser')}
      </button>

      {/* MONTH-END CLOSE & PERIOD ROLLOVER MODAL */}
      {showRolloverModal && (
        <Modal title="Month-End Close & Period Rollover" onClose={() => setShowRolloverModal(false)}>
          <div className="form-stack space-y-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              When closing an accounting period (month or harvest season), export your full ledger for your permanent records, then set your new starting balance.
            </p>

            <div className="p-3 rounded-xl bg-[#f2f6f3] dark:bg-[#151e18] space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Previous Starting Balance:</span>
                <span className="font-semibold">{formatCurrency(openingBalance)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Confirmed Deposits:</span>
                <span className="font-semibold text-[#1f5f46] dark:text-[#35b586]">+{formatCurrency(confirmedDeposits)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Expenses:</span>
                <span className="font-semibold text-destructive">-{formatCurrency(allExpensesSum)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-[#d9dfd9] dark:border-[#2e4235] font-bold text-sm">
                <span>Calculated Closing Cash:</span>
                <span className={currentClosingBalance >= 0 ? 'text-[#1f5f46] dark:text-[#35b586]' : 'text-destructive'}>
                  {formatCurrency(currentClosingBalance)}
                </span>
              </div>
            </div>

            <label className="text-xs font-semibold">
              <span>Customize New Starting Opening Balance (₹)</span>
              <input
                type="number"
                value={customRolloverBal}
                onChange={(e) => setCustomRolloverBal(e.target.value)}
                placeholder="Custom Opening Balance"
                className="mt-1 w-full rounded-xl border border-[#d9dfd9] dark:border-[#2e4235] p-2.5 text-sm bg-white dark:bg-[#151e18] font-bold"
              />
              <span className="text-[11px] text-muted-foreground font-normal mt-0.5 block">
                You can customize this amount if your physical cash box was rounded or adjusted.
              </span>
            </label>

            <div className="space-y-2 pt-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const rows = getClosingLedgerRows()
                    exportToPdf(
                      rows,
                      openingBalance,
                      'Thoppu Farm - Period Closing Ledger',
                      `thoppu-closing-${new Date().toISOString().slice(0, 10)}.pdf`
                    )
                  }}
                  className="secondary-button !min-h-[40px] text-xs justify-center"
                >
                  <FileText className="size-4 text-[#1f5f46] dark:text-[#35b586]" />
                  Download PDF
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const rows = getClosingLedgerRows()
                    exportToExcel(
                      rows,
                      openingBalance,
                      `thoppu-closing-${new Date().toISOString().slice(0, 10)}.xlsx`
                    )
                  }}
                  className="secondary-button !min-h-[40px] text-xs justify-center"
                >
                  <FileSpreadsheet className="size-4 text-[#1f5f46] dark:text-[#35b586]" />
                  Archive Excel
                </button>
              </div>
              <button
                type="button"
                disabled={rolloverLoading}
                onClick={handleApplyRollover}
                className="primary-button w-full !min-h-[40px] text-xs whitespace-nowrap justify-center"
              >
                {rolloverLoading ? 'Applying...' : 'Apply & Start Fresh'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* INSTALL GUIDE / STANDALONE INFO MODAL */}
      {showInstallModal && (
        <Modal
          title={lang === 'ta' ? 'செயலியை நிறுவுவது எப்படி?' : 'How to Install Thoppu Ledger'}
          onClose={() => setShowInstallModal(false)}
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-2xl bg-[#e8f3eb] dark:bg-[#1a2d22] flex items-center gap-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#1f5f46] text-white">
                <Smartphone className="size-5" />
              </div>
              <div>
                <p className="font-bold text-[#1f5f46] dark:text-[#35b586] text-sm">
                  {lang === 'ta' ? 'வேகமான மொபைல் செயலி' : 'Fast, Standalone Farm App'}
                </p>
                <p className="text-muted-foreground text-[11px]">
                  {lang === 'ta'
                    ? 'முகப்புத் திரையில் சேர்த்தால் பிரவுசர் திறக்காமலே உடனே பயன்படுத்தலாம்.'
                    : 'Install directly to your home screen or desktop without Play Store.'}
                </p>
              </div>
            </div>

            {isInstalled ? (
              <div className="p-3.5 rounded-xl border border-[#d9dfd9] dark:border-[#2e4235] bg-white dark:bg-[#151e18] space-y-1">
                <p className="font-bold text-[#1f5f46] dark:text-[#35b586] flex items-center gap-1.5">
                  <Check className="size-4" />
                  {lang === 'ta' ? 'செயலி ஏற்கனவே இயங்குகிறது' : 'App is already installed!'}
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  {lang === 'ta'
                    ? 'நீங்கள் ஏற்கனவே Thoppu Ledger செயலியை உங்கள் சாதனத்தில் நிறுவி பயன்படுத்துகிறீர்கள். உங்கள் மொபைல் முகப்புத் திரையிலிருந்து இதை நேரடியாகத் திறக்கலாம்.'
                    : 'You are currently running the installed version of Thoppu Ledger. You can access it anytime directly from your phone home screen or computer apps.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="p-3 rounded-xl border border-[#d9dfd9] dark:border-[#2e4235] bg-white dark:bg-[#151e18] space-y-1">
                  <p className="font-bold text-[#18221c] dark:text-[#f2f5f3] flex items-center gap-1.5">
                    <span className="grid size-5 place-items-center rounded-full bg-[#1f5f46] text-white text-[10px]">1</span>
                    {lang === 'ta' ? 'Android / Google Chrome' : 'Android / Google Chrome'}
                  </p>
                  <p className="text-muted-foreground pl-6 leading-relaxed">
                    {lang === 'ta'
                      ? 'Chrome மெனுவைத் தட்டவும் (⋮) -> "செயலியை நிறுவு" அல்லது "முகப்புத் திரையில் சேர்" என்பதைத் தேர்ந்தெடுக்கவும்.'
                      : 'Tap Chrome menu (⋮) -> Tap "Install app" or "Add to Home screen".'}
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-[#d9dfd9] dark:border-[#2e4235] bg-white dark:bg-[#151e18] space-y-1">
                  <p className="font-bold text-[#18221c] dark:text-[#f2f5f3] flex items-center gap-1.5">
                    <span className="grid size-5 place-items-center rounded-full bg-[#1f5f46] text-white text-[10px]">2</span>
                    {lang === 'ta' ? 'iPhone / Apple Safari' : 'iPhone / Apple Safari'}
                  </p>
                  <p className="text-muted-foreground pl-6 leading-relaxed">
                    {lang === 'ta'
                      ? 'Safari கீழ் உள்ள Share (⎋) ஐகானைத் தட்டவும் -> கீழே உருட்டி "Add to Home Screen" (+) என்பதைத் தேர்ந்தெடுக்கவும்.'
                      : 'Tap Share button (⎋) in Safari -> Scroll down and tap "Add to Home Screen" (+).'}
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-[#d9dfd9] dark:border-[#2e4235] bg-white dark:bg-[#151e18] space-y-1">
                  <p className="font-bold text-[#18221c] dark:text-[#f2f5f3] flex items-center gap-1.5">
                    <span className="grid size-5 place-items-center rounded-full bg-[#1f5f46] text-white text-[10px]">3</span>
                    {lang === 'ta' ? 'கணினி / PC (Chrome / Edge)' : 'PC / Computer (Chrome / Edge)'}
                  </p>
                  <p className="text-muted-foreground pl-6 leading-relaxed">
                    {lang === 'ta'
                      ? 'முகவரிப் பட்டியில் (URL bar) உள்ள "Install" (⊕/💻) ஐகானைக் கிளிக் செய்யவும்.'
                      : 'Click the "Install" icon (⊕/💻) in your browser address bar.'}
                  </p>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowInstallModal(false)}
              className="primary-button w-full !min-h-[40px] text-xs"
            >
              {getTranslation(lang, 'close')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ==============================================================================
// ADD EXPENSE MODAL (WITH CLIENT COMPRESSION)
// ==============================================================================
function AddExpenseModal({
  profile,
  categories,
  lang,
  directVerified,
  onClose,
  onSuccess,
}: {
  profile: Profile
  categories: Category[]
  lang: Language
  directVerified?: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const activeCategories = categories.filter((c) => c.active)
  const [categoryName, setCategoryName] = useState(activeCategories[0]?.name || 'Thopu Bill')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [compressing, setCompressing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const quickCategories = [
    'Kadalai work',
    'Thopu Bill',
    'Tractor / Machinery',
    'Salary',
    'Thenga selavu',
    'Plants',
    'Household',
    'Other',
  ]

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return
    setFile(selected)
    setPreviewUrl(URL.createObjectURL(selected))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Please enter a valid amount')
      return
    }

    const trimmedCat = categoryName.trim()
    if (!trimmedCat) {
      alert('Please specify a category or work name')
      return
    }

    setSubmitting(true)
    let photoPath: string | null = null

    try {
      if (file) {
        setCompressing(true)
        photoPath = await uploadBillPhoto(file, DEFAULT_PROPERTY_ID)
        setCompressing(false)
      }

      // Check if category exists or create a new one automatically
      let finalCatId = activeCategories.find((c) => c.name.toLowerCase() === trimmedCat.toLowerCase())?.id

      if (!finalCatId) {
        const isPersonal = trimmedCat.toLowerCase().includes('house') || trimmedCat.toLowerCase().includes('personal') || trimmedCat.toLowerCase().includes('dad')
        const { data: newCat, error: catErr } = await supabase
          .from('categories')
          .insert({
            property_id: DEFAULT_PROPERTY_ID,
            name: trimmedCat,
            type: isPersonal ? 'Personal' : 'Farm',
            active: true,
          })
          .select()
          .maybeSingle()

        if (!catErr && newCat) {
          finalCatId = newCat.id
        } else {
          finalCatId = activeCategories[0]?.id
        }
      }

      // Accountant direct entries post as Verified. Supervisor posts as Submitted.
      const status = directVerified ? 'Verified' : 'Submitted'

      const { error } = await supabase.from('expenses').insert({
        property_id: DEFAULT_PROPERTY_ID,
        user_id: profile.id,
        category_id: finalCatId,
        amount: numAmount,
        date,
        note: note.trim() || null,
        bill_photo_url: photoPath,
        status,
      })

      if (error) throw error

      onSuccess()
    } catch (err: any) {
      alert(`Error saving expense: ${err.message}`)
    } finally {
      setSubmitting(false)
      setCompressing(false)
    }
  }

  return (
    <Modal title={directVerified ? getTranslation(lang, 'addEntry') : getTranslation(lang, 'addExpense')} onClose={onClose}>
      <form onSubmit={handleSubmit} className="form-stack">
        <label>
          <span>{getTranslation(lang, 'category')} / Work Name</span>
          <input
            list="farm-category-suggestions"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            placeholder="Type or select work (e.g. Kadalai work, Thopu Bill, Tractor)..."
            required
            className="w-full rounded-xl border border-[#d9dfd9] dark:border-[#2e4235] p-2 text-xs bg-white dark:bg-[#151e18]"
          />
          <datalist id="farm-category-suggestions">
            {activeCategories.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
            <option value="Kadalai work" />
            <option value="Thenga selavu" />
            <option value="Fertilizer / Uram" />
            <option value="Diesel / Fuel" />
          </datalist>
        </label>

        {/* Quick tap chips for mobile speed */}
        <div className="flex flex-wrap gap-1.5 pt-0.5 pb-1">
          {quickCategories.map((qc) => (
            <button
              key={qc}
              type="button"
              onClick={() => setCategoryName(qc)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                categoryName.toLowerCase() === qc.toLowerCase()
                  ? 'bg-[#1f5f46] text-white'
                  : 'bg-[#edf3ee] dark:bg-[#1c2c22] text-[#2c3d31] dark:text-[#d2ded5] hover:bg-[#d8e6db]'
              }`}
            >
              {qc}
            </button>
          ))}
        </div>

        <label>
          <span>{getTranslation(lang, 'amount')}</span>
          <div className="input-prefix">
            <span className="font-bold">₹</span>
            <input
              type="number"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              min="1"
            />
          </div>
        </label>

        <label>
          <span>{getTranslation(lang, 'date')}</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </label>

        <label>
          <span>
            {getTranslation(lang, 'note')} <span className="font-normal text-muted-foreground">(optional)</span>
          </span>
          <input
            placeholder="e.g. food to b.p, farthana ratha, tractor repair"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        <div>
          <p className="mb-2 text-sm font-semibold">{getTranslation(lang, 'billPhoto')}</p>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />

          {previewUrl ? (
            <div className="relative overflow-hidden rounded-xl border border-[#d9dfd9] dark:border-[#2e4235]">
              <img src={previewUrl} alt="Bill preview" className="max-h-48 w-full object-cover" />
              <button
                type="button"
                onClick={() => {
                  setFile(null)
                  setPreviewUrl(null)
                }}
                className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="upload-box w-full"
            >
              <Camera className="size-5 text-[#1f5f46] dark:text-[#35b586]" />
              <span>{getTranslation(lang, 'takePicture')}</span>
              <Upload className="size-4 text-muted-foreground" />
            </button>
          )}
        </div>

        <button type="submit" disabled={submitting} className="primary-button mt-2">
          {compressing ? getTranslation(lang, 'compressingImage') : submitting ? getTranslation(lang, 'submitting') : getTranslation(lang, 'submit')}
        </button>
      </form>
    </Modal>
  )
}

// ==============================================================================
// RECORD DEPOSIT / I SENT MONEY MODAL (ACCOUNTANT & OWNER)
// ==============================================================================
function DepositModal({
  profile,
  lang,
  owner,
  defaultFromName,
  onClose,
  onSuccess,
}: {
  profile: Profile
  lang: Language
  owner?: boolean
  defaultFromName?: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [fromName, setFromName] = useState(defaultFromName || (owner ? profile.name : ''))
  const [mode, setMode] = useState<'Cash' | 'GPay' | 'Bank'>('Cash')
  const [reference, setReference] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Please enter a valid amount')
      return
    }

    setSubmitting(true)
    const status = owner ? 'Sent (pending)' : 'Confirmed'

    try {
      const { error } = await supabase.from('deposits').insert({
        property_id: DEFAULT_PROPERTY_ID,
        recorded_by: profile.id,
        date,
        amount: numAmount,
        from_name: fromName.trim() || (owner ? profile.name : null),
        mode,
        reference: reference.trim() || null,
        status,
      })

      if (error) throw error
      onSuccess()
    } catch (err: any) {
      alert(`Error recording deposit: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title={owner ? getTranslation(lang, 'iSentMoney') : getTranslation(lang, 'recordDeposit')} onClose={onClose}>
      <form onSubmit={handleSubmit} className="form-stack">
        <label>
          <span>{getTranslation(lang, 'amount')}</span>
          <div className="input-prefix">
            <span className="font-bold">₹</span>
            <input
              type="number"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              min="1"
            />
          </div>
        </label>

        <label>
          <span>{getTranslation(lang, 'date')}</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </label>

        {!owner ? (
          <label>
            <span>Source / Deposit Type</span>
            <input
              placeholder="e.g. Owner Deposit (Ashok), Coconut Sales Income, Extra Capital"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
            />
          </label>
        ) : (
          <label>
            <span>Sender Name</span>
            <input
              placeholder="Your Name (e.g. Ashok)"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
            />
          </label>
        )}

        <label>
          <span>{getTranslation(lang, 'mode')}</span>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as any)}
          >
            <option value="Cash">{getTranslation(lang, 'cash')}</option>
            <option value="GPay">{getTranslation(lang, 'gpay')}</option>
            <option value="Bank">{getTranslation(lang, 'bank')}</option>
          </select>
        </label>

        <label>
          <span>
            {owner ? 'Note / Purpose' : 'Description / Reference Note'} <span className="font-normal text-muted-foreground">(optional)</span>
          </span>
          <input
            placeholder={owner ? 'e.g. Weekly farm wages, Fertilizer advance' : 'e.g. 2,500 Coconuts sold, Harvest advance, UPI Ref'}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </label>

        {owner && (
          <p className="text-xs text-muted-foreground">{getTranslation(lang, 'ownerDepositSentNote')}</p>
        )}

        <button type="submit" disabled={submitting} className="primary-button mt-2">
          {submitting ? getTranslation(lang, 'loading') : owner ? getTranslation(lang, 'sent') : getTranslation(lang, 'save')}
        </button>
      </form>
    </Modal>
  )
}

// ==============================================================================
// EXPENSE DETAIL MODAL (REVIEW, QUERY, RESUBMIT)
// ==============================================================================
function ExpenseDetailModal({
  expense,
  categories,
  profile,
  lang,
  accountant,
  onClose,
  onUpdated,
}: {
  expense: Expense
  categories: Category[]
  profile: Profile
  lang: Language
  accountant?: boolean
  onClose: () => void
  onUpdated?: () => void
}) {
  const [signedPhotoUrl, setSignedPhotoUrl] = useState<string | null>(null)
  const [queryInput, setQueryInput] = useState(false)
  const [questionText, setQuestionText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Accountant edit mode
  const isAccountant = accountant || profile.role === 'accountant'
  const [isAccountantEditing, setIsAccountantEditing] = useState(false)
  const [accDate, setAccDate] = useState(expense.date)
  const [accCategoryId, setAccCategoryId] = useState(expense.category_id)
  const [accNote, setAccNote] = useState(expense.note || '')
  const [accAmount, setAccAmount] = useState(expense.amount.toString())

  // Resubmit state for supervisor
  const [isResubmitting, setIsResubmitting] = useState(false)
  const [editAmount, setEditAmount] = useState(expense.amount.toString())
  const [editNote, setEditNote] = useState(expense.note || '')

  const cat = categories.find((c) => c.id === (isAccountantEditing ? accCategoryId : expense.category_id))

  useEffect(() => {
    if (expense.bill_photo_url) {
      getSignedBillUrl(expense.bill_photo_url).then((url) => {
        setSignedPhotoUrl(url)
      })
    }
  }, [expense.bill_photo_url])

  // Approve expense (turns to Verified and locks it permanently)
  const handleApprove = async () => {
    setSubmitting(true)
    try {
      const { error } = await supabase.from('expenses').update({ status: 'Verified' }).eq('id', expense.id)
      if (error) throw error
      onUpdated?.()
    } catch (err: any) {
      alert(`Approval error: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  // Query expense
  const handleSendQuery = async () => {
    if (!questionText.trim()) return
    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('expenses')
        .update({
          status: 'Query',
          query_message: questionText.trim(),
        })
        .eq('id', expense.id)

      if (error) throw error
      onUpdated?.()
    } catch (err: any) {
      alert(`Query error: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  // Accountant Save
  const handleAccountantSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const num = parseFloat(accAmount)
    if (isNaN(num) || num <= 0) {
      alert('Please enter a valid amount')
      return
    }
    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('expenses')
        .update({
          date: accDate,
          category_id: accCategoryId,
          note: accNote.trim() || null,
          amount: num,
        })
        .eq('id', expense.id)

      if (error) {
        if (error.message?.includes('Locked')) {
          alert('Database trigger active. Please run the 1-click SQL in supabase/allow-accountant-editing.sql in your Supabase Dashboard to enable full editing permissions.')
          return
        }
        throw error
      }
      setIsAccountantEditing(false)
      onUpdated?.()
    } catch (err: any) {
      alert(`Error updating expense: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  // Accountant Delete
  const handleAccountantDelete = async () => {
    if (!confirm(lang === 'ta' ? 'இந்த செலவை நிச்சயமாக நீக்க விரும்புகிறீர்களா?' : 'Are you sure you want to permanently delete this expense?')) return
    setSubmitting(true)
    try {
      const { error } = await supabase.from('expenses').delete().eq('id', expense.id)
      if (error) {
        if (error.message?.includes('Locked')) {
          alert('Database trigger active. Please run the 1-click SQL in supabase/allow-accountant-editing.sql in your Supabase Dashboard to enable full editing permissions.')
          return
        }
        throw error
      }
      onUpdated?.()
    } catch (err: any) {
      alert(`Error deleting expense: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  // Supervisor Resubmit
  const handleResubmit = async () => {
    const num = parseFloat(editAmount)
    if (isNaN(num) || num <= 0) return
    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('expenses')
        .update({
          amount: num,
          note: editNote.trim() || null,
          status: 'Submitted',
        })
        .eq('id', expense.id)

      if (error) throw error
      onUpdated?.()
    } catch (err: any) {
      alert(`Resubmit error: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const isLocked = expense.status === 'Verified' && !isAccountant

  return (
    <Modal title={isAccountantEditing ? 'Edit Expense' : getTranslation(lang, 'expenseDetails')} onClose={onClose}>
      <div className="form-stack">
        {isAccountantEditing ? (
          <form onSubmit={handleAccountantSave} className="space-y-3">
            <label>
              <span>Date</span>
              <input
                type="date"
                value={accDate}
                onChange={(e) => setAccDate(e.target.value)}
                required
              />
            </label>

            <label>
              <span>Category</span>
              <select
                value={accCategoryId}
                onChange={(e) => setAccCategoryId(e.target.value)}
                required
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.type})
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Work / Note Description</span>
              <input
                value={accNote}
                onChange={(e) => setAccNote(e.target.value)}
                placeholder="e.g. kadalai work, sand for thopu"
              />
            </label>

            <label>
              <span>Amount (₹)</span>
              <input
                type="number"
                value={accAmount}
                onChange={(e) => setAccAmount(e.target.value)}
                required
                min="1"
              />
            </label>

            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={submitting} className="primary-button flex-1">
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setIsAccountantEditing(false)}
                className="secondary-button"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="detail-amount">
              <p className="text-xs text-muted-foreground">{cat?.name || 'Expense'}</p>
              <Amount value={Number(expense.amount)} large />
            </div>

            <div className="detail-grid">
              <div>
                <span className="text-muted-foreground">Date</span>
                <strong>{formatDate(expense.date)}</strong>
              </div>
              <div>
                <span className="text-muted-foreground">Status</span>
                <StatusBadge status={expense.status} />
              </div>
            </div>

            {expense.note && (
              <div className="note-box">
                <span className="text-xs text-muted-foreground block mb-1">Note / Work</span>
                <p className="text-sm font-medium">{expense.note}</p>
              </div>
            )}

            {/* Bill Image View */}
            {signedPhotoUrl ? (
              <div className="overflow-hidden rounded-2xl border border-[#d9dfd9] dark:border-[#2e4235]">
                <a href={signedPhotoUrl} target="_blank" rel="noopener noreferrer">
                  <img src={signedPhotoUrl} alt="Bill full view" className="max-h-64 w-full object-cover" />
                </a>
              </div>
            ) : (
              <div className="bill-large">
                <ImageIcon className="size-6 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">No bill image attached</span>
              </div>
            )}

            {/* Query Message Box */}
            {expense.query_message && (
              <div className="query-box">
                <p className="text-xs font-bold uppercase tracking-wide text-[#9b6a10]">
                  {getTranslation(lang, 'accountantQuestion')}
                </p>
                <p className="mt-1 text-sm">{expense.query_message}</p>
              </div>
            )}

            {/* Locked badge for supervisors */}
            {isLocked && (
              <div className="flex items-center justify-center gap-2 rounded-xl bg-[#eef1ee] dark:bg-[#1a2d22] p-2 text-xs font-semibold text-[#68736b] dark:text-[#7a8e80]">
                <Lock className="size-3.5" />
                <span>Entry verified and locked (cannot be edited)</span>
              </div>
            )}

            {/* Accountant Management Actions (Edit & Delete) */}
            {isAccountant && (
              <div className="flex gap-2 pt-2 border-t border-[#edf0eb] dark:border-[#27372d]">
                <button
                  type="button"
                  onClick={() => setIsAccountantEditing(true)}
                  className="primary-button flex-1 !min-h-[36px] text-xs justify-center"
                >
                  Edit Entry
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleAccountantDelete}
                  className="secondary-button !border-destructive/40 text-destructive hover:bg-destructive/10 !px-3 !min-h-[36px] text-xs"
                  title="Delete Entry"
                >
                  Delete
                </button>
              </div>
            )}

            {/* Supervisor resubmit edit mode */}
            {profile.role === 'supervisor' && expense.status === 'Query' && (
              <div>
                {isResubmitting ? (
                  <div className="space-y-3 pt-2">
                    <label>
                      <span>Amount</span>
                      <input
                        type="number"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                      />
                    </label>
                    <label>
                      <span>Note</span>
                      <input
                        value={editNote}
                        onChange={(e) => setEditNote(e.target.value)}
                      />
                    </label>
                    <button onClick={handleResubmit} disabled={submitting} className="primary-button w-full">
                      {getTranslation(lang, 'submit')}
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setIsResubmitting(true)} className="primary-button w-full">
                    {getTranslation(lang, 'editResubmit')}
                  </button>
                )}
              </div>
            )}

            {/* Accountant review actions */}
            {accountant && expense.status === 'Submitted' && (
              <div>
                {queryInput ? (
                  <div className="space-y-2">
                    <textarea
                      placeholder={getTranslation(lang, 'queryQuestionPlaceholder')}
                      value={questionText}
                      onChange={(e) => setQuestionText(e.target.value)}
                      className="w-full rounded-xl border border-[#d9dfd9] dark:border-[#2e4235] p-2 text-xs"
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <button onClick={handleSendQuery} disabled={submitting} className="primary-button flex-1 !min-h-[36px]">
                        {getTranslation(lang, 'sendQuery')}
                      </button>
                      <button onClick={() => setQueryInput(false)} className="secondary-button !min-h-[36px]">
                        {getTranslation(lang, 'cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={handleApprove} disabled={submitting} className="primary-button">
                      <Check className="size-4" />
                      {getTranslation(lang, 'approve')}
                    </button>
                    <button onClick={() => setQueryInput(true)} className="secondary-button">
                      {getTranslation(lang, 'query')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}

// ==============================================================================
// MAIN APP COMPONENT
// ==============================================================================
export default function Page() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [lang, setLang] = useState<Language>('en')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  // Real database state
  const [categories, setCategories] = useState<Category[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [deposits, setDeposits] = useState<Deposit[]>([])
  const [openingBalance, setOpeningBalance] = useState(27686)
  const [periodStartDate, setPeriodStartDate] = useState<string | null>(null)

  // PWA install prompt handler
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

  useEffect(() => {
    // Theme initialization
    const savedTheme = (localStorage.getItem('thoppu_theme') as 'light' | 'dark') || 'light'
    setTheme(savedTheme)
    document.documentElement.classList.toggle('dark', savedTheme === 'dark')
    document.documentElement.classList.toggle('light', savedTheme === 'light')
    document.documentElement.style.colorScheme = savedTheme

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
  }, [])

  const handleToggleTheme = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme)
    localStorage.setItem('thoppu_theme', newTheme)
    document.documentElement.classList.toggle('dark', newTheme === 'dark')
    document.documentElement.classList.toggle('light', newTheme === 'light')
    document.documentElement.style.colorScheme = newTheme
  }

  // Refresh all database records
  const loadData = async () => {
    try {
      const [catsRes, expRes, depRes, setRes] = await Promise.all([
        supabase.from('categories').select('*').order('name'),
        supabase.from('expenses').select('*').order('date', { ascending: false }),
        supabase.from('deposits').select('*').order('date', { ascending: false }),
        supabase.from('settings').select('*').eq('property_id', DEFAULT_PROPERTY_ID).maybeSingle(),
      ])

      if (catsRes.data) setCategories(catsRes.data as Category[])
      if (expRes.data) setExpenses(expRes.data as Expense[])
      if (depRes.data) setDeposits(depRes.data as Deposit[])
      if (setRes.data?.opening_balance !== undefined) {
        setOpeningBalance(Number(setRes.data.opening_balance))
      }
      if (setRes.data?.updated_at) {
        setPeriodStartDate(setRes.data.updated_at)
      }
    } catch (err) {
      console.error('Failed to load ledger data:', err)
    }
  }

  // Check auth session on boot
  useEffect(() => {
    let mounted = true

    const checkSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (error) {
          console.warn('Session error:', error.message)
        }
        if (data?.session?.user && mounted) {
          const { data: userProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.session.user.id)
            .maybeSingle()

          if (userProfile && mounted) {
            setProfile(userProfile as Profile)
            loadData()
          }
        }
      } catch (err) {
        console.error('Session check failed:', err)
      }
    }

    checkSession()

    return () => {
      mounted = false
    }
  }, [])

  const handleLogin = (userProfile: Profile) => {
    setProfile(userProfile)
    loadData()
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }

  if (!profile) {
    return <Login onLogin={handleLogin} lang={lang} setLang={setLang} />
  }

  if (profile.role === 'supervisor') {
    return (
      <SupervisorView
        profile={profile}
        expenses={expenses}
        deposits={deposits}
        categories={categories}
        openingBalance={openingBalance}
        lang={lang}
        setLang={setLang}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onLogout={handleLogout}
        onRefresh={loadData}
        deferredPrompt={deferredPrompt}
        onPwaInstalled={() => setDeferredPrompt(null)}
        periodStartDate={periodStartDate}
      />
    )
  }

  if (profile.role === 'accountant') {
    return (
      <AccountantView
        profile={profile}
        expenses={expenses}
        deposits={deposits}
        categories={categories}
        openingBalance={openingBalance}
        lang={lang}
        setLang={setLang}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onLogout={handleLogout}
        onRefresh={loadData}
        deferredPrompt={deferredPrompt}
        onPwaInstalled={() => setDeferredPrompt(null)}
        periodStartDate={periodStartDate}
      />
    )
  }

  return (
    <OwnerView
      profile={profile}
      expenses={expenses}
      deposits={deposits}
      categories={categories}
      openingBalance={openingBalance}
      lang={lang}
      setLang={setLang}
      theme={theme}
      onToggleTheme={handleToggleTheme}
      onLogout={handleLogout}
      onRefresh={loadData}
      deferredPrompt={deferredPrompt}
      onPwaInstalled={() => setDeferredPrompt(null)}
      periodStartDate={periodStartDate}
    />
  )
}
