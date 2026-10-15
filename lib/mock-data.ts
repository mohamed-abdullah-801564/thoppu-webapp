export type Role = 'supervisor' | 'accountant' | 'owner'
export type ExpenseStatus = 'Submitted' | 'Verified' | 'Query'
export type DepositStatus = 'Confirmed' | 'Sent (pending)'

export interface Category {
  id: string
  name: string
  type: 'Farm' | 'Personal'
  active: boolean
}

export interface Expense {
  id: string
  date: string
  category: string
  amount: number
  note?: string
  billPhoto?: string
  status: ExpenseStatus
  queryMessage?: string
}

export interface Deposit {
  id: string
  date: string
  amount: number
  from?: string
  mode: 'Cash' | 'GPay' | 'Bank'
  reference?: string
  status: DepositStatus
}

export interface User {
  id: string
  name: string
  role: Role
}

export const categories: Category[] = [
  { id: 'c1', name: 'Thopu Bill', type: 'Farm', active: true },
  { id: 'c2', name: 'Salary', type: 'Farm', active: true },
  { id: 'c3', name: 'Tractor / Machinery', type: 'Farm', active: true },
  { id: 'c4', name: 'Plants', type: 'Farm', active: true },
  { id: 'c5', name: 'Payment to Person', type: 'Farm', active: true },
  { id: 'c6', name: 'Bank Deposit', type: 'Farm', active: true },
  { id: 'c7', name: 'Household', type: 'Personal', active: true },
  { id: 'c8', name: 'Other', type: 'Farm', active: true },
]

export const deposits: Deposit[] = [
  {
    id: 'd1',
    date: '2026-08-05',
    amount: 15000,
    mode: 'Cash',
    status: 'Confirmed',
  },
  {
    id: 'd2',
    date: '2026-08-13',
    amount: 50000,
    mode: 'Cash',
    status: 'Confirmed',
  },
  {
    id: 'd3',
    date: '2026-09-05',
    amount: 15000,
    mode: 'GPay',
    status: 'Confirmed',
  },
  {
    id: 'd4',
    date: '2026-09-22',
    amount: 225000,
    mode: 'Cash',
    status: 'Confirmed',
  },
  {
    id: 'd5',
    date: '2026-10-09',
    amount: 100000,
    mode: 'Cash',
    status: 'Confirmed',
  },
  {
    id: 'd6',
    date: '2026-10-15',
    amount: 50000,
    mode: 'Cash',
    status: 'Sent (pending)',
  },
]

export const expenses: Expense[] = [
  {
    id: 'e1',
    date: '2026-08-12',
    category: 'c2',
    amount: 10000,
    status: 'Verified',
    billPhoto: '/placeholder.jpg',
  },
  {
    id: 'e2',
    date: '2026-08-17',
    category: 'c5',
    amount: 20000,
    note: 'haji periyappa',
    status: 'Verified',
    billPhoto: '/placeholder.jpg',
  },
  {
    id: 'e3',
    date: '2026-08-29',
    category: 'c1',
    amount: 3550,
    status: 'Verified',
    billPhoto: '/placeholder.jpg',
  },
  {
    id: 'e4',
    date: '2026-09-05',
    category: 'c3',
    amount: 18500,
    status: 'Verified',
    billPhoto: '/placeholder.jpg',
  },
  {
    id: 'e5',
    date: '2026-09-20',
    category: 'c4',
    amount: 1700,
    status: 'Verified',
    billPhoto: '/placeholder.jpg',
  },
  {
    id: 'e6',
    date: '2026-09-28',
    category: 'c3',
    amount: 12600,
    status: 'Query',
    queryMessage: 'Bill unclear, please upload again',
    billPhoto: '/placeholder.jpg',
  },
  {
    id: 'e7',
    date: '2026-10-09',
    category: 'c7',
    amount: 2400,
    note: 'gas, fruit',
    status: 'Submitted',
    billPhoto: '/placeholder.jpg',
  },
  {
    id: 'e8',
    date: '2026-10-14',
    category: 'c1',
    amount: 9977,
    status: 'Submitted',
    billPhoto: '/placeholder.jpg',
  },
]

export const users: User[] = [
  { id: 'u1', name: 'Sujoy', role: 'supervisor' },
  { id: 'u2', name: 'Ramesh', role: 'accountant' },
  { id: 'u3', name: 'Ashok', role: 'owner' },
]

export const openingBalance = 0

export const getCategoryById = (id: string) =>
  categories.find((c) => c.id === id)

export const getCategoryName = (id: string) =>
  getCategoryById(id)?.name || 'Unknown'

export const calculateTotalDeposits = () =>
  deposits.reduce((sum, d) => (d.status === 'Confirmed' ? sum + d.amount : sum), 0)

export const calculateTotalExpenses = () =>
  expenses.reduce((sum, e) => sum + e.amount, 0)

export const calculateBalance = () =>
  calculateTotalDeposits() - calculateTotalExpenses()

export const calculateCashInHand = () => {
  // Total received minus all expenses (including pending)
  const totalReceived = calculateTotalDeposits()
  const totalExpenses = calculateTotalExpenses()
  return totalReceived - totalExpenses
}

export const getFarmExpenses = () =>
  expenses
    .filter((e) => {
      const cat = getCategoryById(e.category)
      return cat?.type === 'Farm' && e.status === 'Verified'
    })
    .reduce((sum, e) => sum + e.amount, 0)

export const getPersonalExpenses = () =>
  expenses
    .filter((e) => {
      const cat = getCategoryById(e.category)
      return cat?.type === 'Personal' && e.status === 'Verified'
    })
    .reduce((sum, e) => sum + e.amount, 0)

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  }).format(amount)
}

export const formatDate = (dateString: string) => {
  const date = new Date(dateString + 'T00:00:00')
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}
