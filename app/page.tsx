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
import { exportToExcel, parseExcelFile, type ParsedExcelRow } from '@/lib/excel-import-export'

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
}) {
  const [tab, setTab] = useState('home')
  const [filter, setFilter] = useState<'All' | 'Submitted' | 'Verified' | 'Query'>('All')
  const [showAdd, setShowAdd] = useState(false)
  const [selected, setSelected] = useState<Expense | null>(null)

  // Calculations (Opening Balance + confirmed deposits - all expenses)
  const confirmedDeposits = deposits.reduce((s, d) => (d.status === 'Confirmed' ? s + Number(d.amount) : s), 0)
  const allExpensesSum = expenses.reduce((s, e) => s + Number(e.amount), 0)
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
}) {
  const [tab, setTab] = useState('home')
  const [selected, setSelected] = useState<Expense | null>(null)
  const [showDeposit, setShowDeposit] = useState(false)
  const [showDirectExpense, setShowDirectExpense] = useState(false)
  const [showOwnerDeposit, setShowOwnerDeposit] = useState(false)

  // Core rule: Balance = Opening Balance + Confirmed deposits - ALL expenses (including submitted & query)
  const confirmedDeposits = deposits.reduce((s, d) => (d.status === 'Confirmed' ? s + Number(d.amount) : s), 0)
  const allExpensesSum = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const currentBalance = openingBalance + confirmedDeposits - allExpensesSum

  const pendingExpenses = expenses.filter((e) => e.status === 'Submitted')
  const pendingDeposits = deposits.filter((d) => d.status === 'Sent (pending)')

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

              <button onClick={() => setShowDeposit(true)} className="text-left">
                <div className="metric-card">
                  <div className="metric-icon green">
                    <ArrowDownToLine />
                  </div>
                  <p className="mt-4 text-2xl font-bold">{pendingDeposits.length}</p>
                  <p className="text-xs leading-4 text-muted-foreground">{getTranslation(lang, 'pendingDeposits')}</p>
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
              <button onClick={() => setShowOwnerDeposit(true)} className="action-card">
                <IndianRupee />
                <span>{getTranslation(lang, 'recordOwnerDeposit')}</span>
              </button>
              <button onClick={() => setShowDirectExpense(true)} className="action-card">
                <Plus />
                <span>{getTranslation(lang, 'addEntry')}</span>
              </button>
            </div>

            {pendingDeposits.length > 0 && (
              <>
                <div className="section-heading">
                  <h3>{getTranslation(lang, 'pendingDeposits')}</h3>
                </div>
                <div className="card-list">
                  {pendingDeposits.map((d) => (
                    <div key={d.id} className="entry-row justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{d.from_name || 'Owner deposit'}</p>
                          <StatusBadge status={d.status} />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDate(d.date)} · {d.mode} {d.reference && `· ${d.reference}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Amount value={Number(d.amount)} />
                        <button
                          onClick={async () => {
                            await supabase.from('deposits').update({ status: 'Confirmed' }).eq('id', d.id)
                            onRefresh()
                          }}
                          className="primary-button !min-h-[32px] !py-1 !px-2.5 !text-xs whitespace-nowrap"
                        >
                          <Check className="size-3.5" /> Confirm
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

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
            onRefresh={onRefresh}
          />
        )}

        {tab === 'settings' && (
          <SettingsView
            profile={profile}
            openingBalance={openingBalance}
            categories={categories}
            lang={lang}
            theme={theme}
            onToggleTheme={onToggleTheme}
            onLogout={onLogout}
            onRefresh={onRefresh}
            accountant
            deferredPrompt={deferredPrompt}
            onPwaInstalled={onPwaInstalled}
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

      {showOwnerDeposit && (
        <DepositModal
          profile={profile}
          lang={lang}
          defaultFromName="Owner (Ashok)"
          onClose={() => setShowOwnerDeposit(false)}
          onSuccess={() => {
            setShowOwnerDeposit(false)
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
}) {
  const [tab, setTab] = useState('home')
  const [showSend, setShowSend] = useState(false)
  const [selected, setSelected] = useState<Expense | null>(null)
  const [typeFilter, setTypeFilter] = useState<'All' | 'Farm' | 'Personal'>('All')

  // Totals
  const confirmedDeposits = deposits.reduce((s, d) => (d.status === 'Confirmed' ? s + Number(d.amount) : s), 0)
  const allExpensesSum = expenses.reduce((s, e) => s + Number(e.amount), 0)
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

            <button onClick={() => setShowSend(true)} className="primary-button mt-5 w-full">
              <ArrowUpFromLine className="size-5" />
              {getTranslation(lang, 'iSentMoney')}
            </button>

            <div className="section-heading">
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
            lang={lang}
            theme={theme}
            onToggleTheme={onToggleTheme}
            onLogout={onLogout}
            onRefresh={onRefresh}
            owner
            deferredPrompt={deferredPrompt}
            onPwaInstalled={onPwaInstalled}
          />
        )}
      </div>

      <BottomNav role="owner" active={tab} onChange={setTab} lang={lang} />

      {showSend && (
        <DepositModal
          profile={profile}
          lang={lang}
          owner
          onClose={() => setShowSend(false)}
          onSuccess={() => {
            setShowSend(false)
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
        />
      )}
    </main>
  )
}

// ==============================================================================
// LEDGER SCREEN (CSV + EXCEL IMPORT / EXPORT)
// ==============================================================================
function LedgerScreen({
  expenses,
  deposits,
  categories,
  openingBalance,
  lang,
  accountant,
  onRefresh,
}: {
  expenses: Expense[]
  deposits: Deposit[]
  categories: Category[]
  openingBalance: number
  lang: Language
  accountant?: boolean
  onRefresh?: () => void
}) {
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [showImportModal, setShowImportModal] = useState(false)

  // Build sorted chronological entries:
  const rows = useMemo(() => {
    type LedgerRow = {
      id: string
      date: string
      particular: string
      expense: number
      income: number
      category_id?: string
      type: 'opening' | 'deposit' | 'expense'
    }

    const items: LedgerRow[] = []

    // 1. Confirmed deposits
    for (const d of deposits) {
      if (d.status === 'Confirmed') {
        items.push({
          id: d.id,
          date: d.date,
          particular: d.from_name ? `${d.mode} (${d.from_name})` : d.mode,
          expense: 0,
          income: Number(d.amount),
          type: 'deposit',
        })
      }
    }

    // 2. All expenses
    for (const e of expenses) {
      const cat = categories.find((c) => c.id === e.category_id)
      const catName = cat?.name || 'Expense'
      const particular = e.note ? `${catName} (${e.note})` : catName
      items.push({
        id: e.id,
        date: e.date,
        particular,
        expense: Number(e.amount),
        income: 0,
        category_id: e.category_id,
        type: 'expense',
      })
    }

    // Sort chronologically ascending
    items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // Filter
    let filtered = items
    if (categoryFilter !== 'ALL') {
      filtered = filtered.filter((r) => r.category_id === categoryFilter)
    }
    if (startDate) {
      filtered = filtered.filter((r) => r.date >= startDate)
    }
    if (endDate) {
      filtered = filtered.filter((r) => r.date <= endDate)
    }

    // Calculate running balance row by row
    let running = openingBalance
    return filtered.map((item) => {
      running = running + item.income - item.expense
      return {
        ...item,
        balance: running,
      }
    })
  }, [expenses, deposits, categories, openingBalance, categoryFilter, startDate, endDate])

  // Download CSV
  const handleDownloadCSV = () => {
    const headers = ['Date', 'Particular', 'Expenses', 'Income', 'Balance']
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

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `thoppu-ledger-${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Download .xlsx Excel
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

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{getTranslation(lang, 'ledger')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">Running farm cash book (matches Excel)</p>
        </div>
      </div>

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

      {/* Export / Import Buttons */}
      <div className="mb-4 grid grid-cols-2 gap-2">
        <button onClick={handleDownloadExcel} className="secondary-button text-xs">
          <FileSpreadsheet className="size-4 text-[#1f5f46] dark:text-[#35b586]" />
          {getTranslation(lang, 'exportExcel')}
        </button>
        <button onClick={handleDownloadCSV} className="secondary-button text-xs">
          <ArrowDownToLine className="size-4 text-[#1f5f46] dark:text-[#35b586]" />
          {getTranslation(lang, 'downloadCSV')}
        </button>
        {accountant && (
          <button
            onClick={() => setShowImportModal(true)}
            className="primary-button col-span-2 !min-h-[42px] text-xs"
          >
            <Upload className="size-4" />
            {getTranslation(lang, 'importExcel')}
          </button>
        )}
      </div>

      {/* Ledger Table */}
      <div className="ledger-table">
        <div className="ledger-head !grid-cols-[56px_1fr_64px_64px_68px] !gap-1">
          <span>Date</span>
          <span>Particular</span>
          <span className="text-right">Expense</span>
          <span className="text-right">Income</span>
          <span className="text-right">Balance</span>
        </div>

        {/* Opening balance row */}
        <div className="ledger-row opening-row !grid-cols-[56px_1fr_64px_64px_68px] !gap-1 font-semibold">
          <span>—</span>
          <span className="truncate text-[#1f5f46] dark:text-[#35b586]">Opening Balance</span>
          <span className="text-right">—</span>
          <span className="text-right">—</span>
          <span className="text-right text-[#1f5f46] dark:text-[#35b586] font-bold">{formatCurrency(openingBalance)}</span>
        </div>

        {rows.slice().reverse().map((r) => (
          <div key={r.id} className="ledger-row !grid-cols-[56px_1fr_64px_64px_68px] !gap-1">
            <span className="truncate text-muted-foreground">{formatDate(r.date).slice(0, 5)}</span>
            <span className="truncate font-medium">{r.particular}</span>
            <span className="text-right text-destructive font-semibold">
              {r.expense > 0 ? formatCurrency(r.expense).replace('₹', '') : '—'}
            </span>
            <span className="text-right text-[#1f5f46] dark:text-[#35b586] font-semibold">
              {r.income > 0 ? formatCurrency(r.income).replace('₹', '') : '—'}
            </span>
            <span className="text-right font-bold">
              {formatCurrency(r.balance).replace('₹', '')}
            </span>
          </div>
        ))}
      </div>

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
  lang,
  theme,
  onToggleTheme,
  onLogout,
  onRefresh,
  accountant,
  owner,
  deferredPrompt,
  onPwaInstalled,
}: {
  profile: Profile
  openingBalance: number
  categories?: Category[]
  lang: Language
  theme: 'light' | 'dark'
  onToggleTheme: (t: 'light' | 'dark') => void
  onLogout: () => void
  onRefresh: () => void
  accountant?: boolean
  owner?: boolean
  deferredPrompt?: any
  onPwaInstalled?: () => void
}) {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [editingName, setEditingName] = useState(false)
  const [newName, setNewName] = useState(profile.name)
  const [editingBal, setEditingBal] = useState(false)
  const [newBal, setNewBal] = useState(openingBalance.toString())
  const [isInstalled, setIsInstalled] = useState(false)

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

  // Load team members
  useEffect(() => {
    supabase.from('profiles').select('*').then(({ data }) => {
      if (data) setProfiles(data as Profile[])
    })
  }, [])

  const handleUpdateName = async () => {
    if (!newName.trim()) return
    await supabase.from('profiles').update({ name: newName.trim() }).eq('id', profile.id)
    setEditingName(false)
    onRefresh()
  }

  const handleUpdateBalance = async () => {
    const val = parseFloat(newBal)
    if (isNaN(val)) return
    await supabase.from('settings').update({ opening_balance: val }).eq('property_id', DEFAULT_PROPERTY_ID)
    setEditingBal(false)
    onRefresh()
  }

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return
    await supabase.from('categories').insert({
      property_id: DEFAULT_PROPERTY_ID,
      name: newCatName.trim(),
      type: newCatType,
      active: true,
    })
    setNewCatName('')
    setShowAddCat(false)
    onRefresh()
  }

  const handleToggleCategory = async (cat: Category) => {
    await supabase.from('categories').update({ active: !cat.active }).eq('id', cat.id)
    onRefresh()
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
      const { data } = await supabase.from('profiles').select('*')
      if (data) setProfiles(data as Profile[])

      setTimeout(() => setShowAddUser(false), 1500)
    } catch (err: any) {
      setUserMsg({ text: err.message, isError: true })
    } finally {
      setUserLoading(false)
    }
  }

  return (
    <>
      <div className="mb-5">
        <h2 className="text-2xl font-bold tracking-tight">{getTranslation(lang, 'settings')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Ledger configuration & team</p>
      </div>

      <div className="settings-card">
        {/* Profile Card */}
        <div className="setting-row">
          <div>
            <p className="text-sm font-semibold">{getTranslation(lang, 'profile')}</p>
            <p className="text-xs text-muted-foreground">
              {profile.name} · <span className="capitalize">{profile.role}</span>
            </p>
          </div>
          <button onClick={() => setEditingName(!editingName)} className="text-xs font-semibold text-[#1f5f46] dark:text-[#35b586]">
            {editingName ? getTranslation(lang, 'cancel') : getTranslation(lang, 'edit')}
          </button>
        </div>

        {editingName && (
          <div className="py-2">
            <div className="flex gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="flex-1 rounded-xl border border-[#d9dfd9] dark:border-[#2e4235] p-2 text-sm bg-white dark:bg-[#151e18]"
              />
              <button onClick={handleUpdateName} className="primary-button !min-h-[36px] !py-1 !px-3 !text-xs">
                {getTranslation(lang, 'save')}
              </button>
            </div>
          </div>
        )}

        {/* DARK MODE TOGGLE (EVERYONE) */}
        <div className="setting-row">
          <div className="flex items-center gap-2">
            {theme === 'dark' ? <Moon className="size-4 text-[#35b586]" /> : <Sun className="size-4 text-[#d7a33f]" />}
            <div>
              <p className="text-sm font-semibold">{getTranslation(lang, 'theme')}</p>
              <p className="text-xs text-muted-foreground">
                {theme === 'dark' ? getTranslation(lang, 'darkMode') : getTranslation(lang, 'lightMode')}
              </p>
            </div>
          </div>
          <div className="flex rounded-full border border-[#d9dfd9] dark:border-[#2e4235] p-0.5 bg-[#f3f6f2] dark:bg-[#151e18]">
            <button
              onClick={() => onToggleTheme('light')}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                theme === 'light' ? 'bg-[#1f5f46] text-white shadow-sm' : 'text-muted-foreground'
              }`}
            >
              Light
            </button>
            <button
              onClick={() => onToggleTheme('dark')}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                theme === 'dark' ? 'bg-[#1f5f46] text-white shadow-sm' : 'text-muted-foreground'
              }`}
            >
              Dark
            </button>
          </div>
        </div>

        {/* Install App on Phone (Shown in browser, hidden when already installed/standalone) */}
        {!isInstalled && (
          <div className="setting-row">
            <div className="flex items-center gap-2">
              <Smartphone className="size-4 text-[#1f5f46] dark:text-[#35b586]" />
              <div>
                <p className="text-sm font-semibold">{getTranslation(lang, 'installApp')}</p>
                <p className="text-xs text-muted-foreground">{getTranslation(lang, 'installAppDesc')}</p>
              </div>
            </div>
            <button
              onClick={async () => {
                if (deferredPrompt) {
                  deferredPrompt.prompt()
                  const { outcome } = await deferredPrompt.userChoice
                  if (outcome === 'accepted') {
                    onPwaInstalled?.()
                    setIsInstalled(true)
                  }
                } else {
                  alert(
                    lang === 'ta'
                      ? 'செயலியை நிறுவ: Chrome மெனுவைத் தட்டவும் (⋮) -> "செயலியை நிறுவு" அல்லது "முகப்புத் திரையில் சேர்".'
                      : 'To install on phone: Open in Chrome and tap Menu (⋮) -> "Install App" or "Add to Home Screen".'
                  )
                }
              }}
              className="primary-button !min-h-[36px] !py-1 !px-3 !text-xs whitespace-nowrap"
            >
              {getTranslation(lang, 'installBtn')}
            </button>
          </div>
        )}

        {/* Change Password (Available to ALL users including Supervisor) */}
        <div className="setting-row">
          <div>
            <p className="text-sm font-semibold">{getTranslation(lang, 'changePassword')}</p>
            <p className="text-xs text-muted-foreground">Update your login credentials</p>
          </div>
          <button onClick={() => setShowPasswordChange(!showPasswordChange)} className="text-xs font-semibold text-[#1f5f46] dark:text-[#35b586]">
            {showPasswordChange ? getTranslation(lang, 'cancel') : getTranslation(lang, 'edit')}
          </button>
        </div>

        {showPasswordChange && (
          <form onSubmit={handleChangePassword} className="my-2 rounded-xl bg-[#f2f6f3] dark:bg-[#151e18] p-3 text-xs form-stack">
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

            <button type="submit" disabled={passwordLoading} className="primary-button !min-h-[36px] !py-1 !text-xs">
              {passwordLoading ? getTranslation(lang, 'loading') : getTranslation(lang, 'savePassword')}
            </button>
          </form>
        )}

        {/* Opening Balance (Editable by Owner and Accountant) */}
        <div className="setting-row">
          <div>
            <p className="text-sm font-semibold">{getTranslation(lang, 'openingBalance')}</p>
            <p className="text-xs text-muted-foreground">Starting point for this ledger</p>
          </div>
          <div className="flex items-center gap-2">
            <p className="font-bold text-[#1f5f46] dark:text-[#35b586]">{formatCurrency(openingBalance)}</p>
            {(accountant || owner) && (
              <button onClick={() => setEditingBal(!editingBal)} className="text-xs font-semibold text-[#1f5f46] dark:text-[#35b586]">
                {editingBal ? getTranslation(lang, 'cancel') : getTranslation(lang, 'edit')}
              </button>
            )}
          </div>
        </div>

        {editingBal && (
          <div className="py-2">
            <div className="flex gap-2">
              <input
                type="number"
                value={newBal}
                onChange={(e) => setNewBal(e.target.value)}
                className="flex-1 rounded-xl border border-[#d9dfd9] dark:border-[#2e4235] p-2 text-sm bg-white dark:bg-[#151e18]"
              />
              <button onClick={handleUpdateBalance} className="primary-button !min-h-[36px] !py-1 !px-3 !text-xs">
                {getTranslation(lang, 'save')}
              </button>
            </div>
          </div>
        )}

        {/* Categories Management (Accountant only) */}
        {accountant && (
          <div className="pt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold">{getTranslation(lang, 'categories')}</p>
              <button onClick={() => setShowAddCat(!showAddCat)} className="text-xs font-semibold text-[#1f5f46] dark:text-[#35b586]">
                + {getTranslation(lang, 'addCategory')}
              </button>
            </div>

            {showAddCat && (
              <div className="mb-3 rounded-xl bg-[#f2f6f3] dark:bg-[#151e18] p-3 text-xs form-stack">
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
                <button onClick={handleAddCategory} className="primary-button !min-h-[32px] !py-1 !text-xs">
                  {getTranslation(lang, 'save')}
                </button>
              </div>
            )}

            <div className="space-y-1">
              {categories.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-1.5 text-xs border-b border-[#edf0eb] dark:border-[#27372d] last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={`dot ${c.type === 'Personal' ? 'personal' : ''}`} />
                    <span className={c.active ? 'font-medium' : 'text-muted-foreground line-through'}>
                      {c.name} ({c.type})
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => handleToggleCategory(c)}
                      className="text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                    >
                      {c.active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(c)}
                      className="text-[11px] font-semibold text-destructive hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* User / Supervisor Creation (Accountant only, no cluttered team list) */}
        {accountant && (
          <div className="pt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold">{getTranslation(lang, 'userList')}</p>
              <button onClick={() => setShowAddUser(!showAddUser)} className="text-xs font-semibold text-[#1f5f46] dark:text-[#35b586]">
                {showAddUser ? getTranslation(lang, 'cancel') : `+ ${getTranslation(lang, 'createUser')}`}
              </button>
            </div>

            {showAddUser && (
              <form onSubmit={handleCreateUser} className="mb-4 rounded-xl bg-[#f2f6f3] dark:bg-[#151e18] p-3 text-xs form-stack">
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

                <button type="submit" disabled={userLoading} className="primary-button !min-h-[34px] !py-1 !text-xs">
                  {userLoading ? getTranslation(lang, 'loading') : getTranslation(lang, 'save')}
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      <button onClick={onLogout} className="secondary-button mt-4 w-full text-destructive hover:bg-destructive/10">
        <LogOut className="size-4" />
        {getTranslation(lang, 'switchUser')}
      </button>
    </>
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
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [compressing, setCompressing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const activeCategories = categories.filter((c) => c.active)

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

    setSubmitting(true)
    let photoPath: string | null = null

    try {
      if (file) {
        setCompressing(true)
        photoPath = await uploadBillPhoto(file, DEFAULT_PROPERTY_ID)
        setCompressing(false)
      }

      // Accountant direct entries post as Verified. Supervisor posts as Submitted.
      const status = directVerified ? 'Verified' : 'Submitted'

      const { error } = await supabase.from('expenses').insert({
        property_id: DEFAULT_PROPERTY_ID,
        user_id: profile.id,
        category_id: categoryId || activeCategories[0]?.id,
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
          <span>{getTranslation(lang, 'category')}</span>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required
          >
            {activeCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.type})
              </option>
            ))}
          </select>
        </label>

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

        {!owner && (
          <label>
            <span>{getTranslation(lang, 'from')}</span>
            <input
              placeholder="e.g. Owner (Ashok), md hassan"
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
            {getTranslation(lang, 'reference')} <span className="font-normal text-muted-foreground">(optional)</span>
          </span>
          <input
            placeholder="UPI ref or Cheque / Transaction ID"
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

  // Resubmit state for supervisor
  const [isResubmitting, setIsResubmitting] = useState(false)
  const [editAmount, setEditAmount] = useState(expense.amount.toString())
  const [editNote, setEditNote] = useState(expense.note || '')

  const cat = categories.find((c) => c.id === expense.category_id)

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

  const isLocked = expense.status === 'Verified'

  return (
    <Modal title={getTranslation(lang, 'expenseDetails')} onClose={onClose}>
      <div className="form-stack">
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
            <span className="text-xs text-muted-foreground block mb-1">Note</span>
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

        {/* Locked badge */}
        {isLocked && (
          <div className="flex items-center justify-center gap-2 rounded-xl bg-[#eef1ee] dark:bg-[#1a2d22] p-2 text-xs font-semibold text-[#68736b] dark:text-[#7a8e80]">
            <Lock className="size-3.5" />
            <span>Entry verified and locked (cannot be edited)</span>
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
    />
  )
}
