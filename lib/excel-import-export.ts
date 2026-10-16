import * as XLSX from 'xlsx'
import { type Category } from './supabase'

export interface ParsedExcelRow {
  date: string
  particular: string
  expenseAmount: number
  incomeAmount: number
  type: 'expense' | 'deposit'
  categoryId?: string
  categoryName?: string
  mode?: 'Cash' | 'GPay' | 'Bank'
  note?: string
}

/**
 * Parses date from various Excel formats:
 * - Excel serial number (e.g. 45678)
 * - String: DD.MM.YYYY, DD/MM/YYYY, YYYY-MM-DD
 */
export function normalizeExcelDate(val: any): string {
  if (!val) {
    return new Date().toISOString().slice(0, 10)
  }

  // If it's an Excel numeric date
  if (typeof val === 'number') {
    const dateObj = XLSX.SSF.parse_date_code(val)
    if (dateObj) {
      const y = dateObj.y
      const m = String(dateObj.m).padStart(2, '0')
      const d = String(dateObj.d).padStart(2, '0')
      return `${y}-${m}-${d}`
    }
  }

  const str = String(val).trim()

  // Match DD.MM.YYYY or DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/)
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  // Match YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/)
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  return new Date().toISOString().slice(0, 10)
}

/**
 * Intelligent keyword matching from Excel 'particular' to system Category
 */
export function matchCategory(particular: string, categories: Category[]): Category | undefined {
  const p = particular.toLowerCase()

  if (p.includes('salary')) {
    return categories.find((c) => c.name.toLowerCase().includes('salary'))
  }
  if (p.includes('thopu') || p.includes('bill')) {
    return categories.find((c) => c.name.toLowerCase().includes('thopu'))
  }
  if (p.includes('tractor') || p.includes('trakter') || p.includes('tarackter') || p.includes('machinery')) {
    return categories.find((c) => c.name.toLowerCase().includes('tractor'))
  }
  if (p.includes('plant')) {
    return categories.find((c) => c.name.toLowerCase().includes('plant'))
  }
  if (p.includes('bank deposit') || p.includes('deposit')) {
    return categories.find((c) => c.name.toLowerCase().includes('bank deposit'))
  }
  if (p.includes('owner') || p.includes('ashok')) {
    return categories.find((c) => c.name.toLowerCase().includes('owner'))
  }
  if (p.includes('dad') || p.includes('home') || p.includes('house') || p.includes('food') || p.includes('canteen') || p.includes('mutton') || p.includes('gas')) {
    return categories.find((c) => c.name.toLowerCase().includes('household') || c.type === 'Personal')
  }

  // Default to Farm category or first category
  return categories.find((c) => c.name.toLowerCase().includes('other')) || categories[0]
}

/**
 * Parses an uploaded .xlsx, .xls, or .csv file
 */
export async function parseExcelFile(file: File, categories: Category[]): Promise<ParsedExcelRow[]> {
  const data = await file.arrayBuffer()
  const workbook = XLSX.read(data, { type: 'array' })
  const firstSheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[firstSheetName]

  // Read rows as arrays of objects or rows
  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

  if (rawRows.length < 2) {
    throw new Error('Excel sheet appears to be empty or has no data rows')
  }

  // Find header row (usually contains date, particular, expenses, income)
  let headerIndex = -1
  let colDate = -1
  let colParticular = -1
  let colExpenses = -1
  let colIncome = -1

  for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
    const row = rawRows[i].map((cell: any) => String(cell).toLowerCase().trim())
    const dIdx = row.findIndex((c: string) => c.includes('date') || c.includes('தேதி'))
    const pIdx = row.findIndex((c: string) => c.includes('particular') || c.includes('விவரம்'))
    const eIdx = row.findIndex((c: string) => c.includes('expense') || c.includes('செலவு'))
    const iIdx = row.findIndex((c: string) => c.includes('deposit') || c.includes('income') || c.includes('வரவு'))

    if (dIdx !== -1 && pIdx !== -1) {
      headerIndex = i
      colDate = dIdx
      colParticular = pIdx
      colExpenses = eIdx !== -1 ? eIdx : 2
      colIncome = iIdx !== -1 ? iIdx : 3
      break
    }
  }

  // Fallback default column indices if headers weren't named standardly
  if (headerIndex === -1) {
    headerIndex = 0
    colDate = 0
    colParticular = 1
    colExpenses = 2
    colIncome = 3
  }

  const parsedResults: ParsedExcelRow[] = []

  for (let i = headerIndex + 1; i < rawRows.length; i++) {
    const row = rawRows[i]
    if (!row || row.length === 0) continue

    const dateRaw = row[colDate]
    const particularRaw = String(row[colParticular] || '').trim()
    const expenseRaw = parseFloat(String(row[colExpenses]).replace(/[^\d.-]/g, '')) || 0
    const incomeRaw = parseFloat(String(row[colIncome]).replace(/[^\d.-]/g, '')) || 0

    // Skip empty or summary rows
    if (!particularRaw && expenseRaw === 0 && incomeRaw === 0) continue
    if (particularRaw.toLowerCase().includes('total') || particularRaw.toLowerCase().includes('balance')) continue

    const date = normalizeExcelDate(dateRaw)

    if (incomeRaw > 0) {
      // It's a deposit / income
      let mode: 'Cash' | 'GPay' | 'Bank' = 'Cash'
      const p = particularRaw.toLowerCase()
      if (p.includes('gpay') || p.includes('upi')) mode = 'GPay'
      else if (p.includes('bank') || p.includes('neft') || p.includes('rtgs')) mode = 'Bank'

      parsedResults.push({
        date,
        particular: particularRaw,
        expenseAmount: 0,
        incomeAmount: incomeRaw,
        type: 'deposit',
        mode,
        note: particularRaw,
      })
    } else if (expenseRaw > 0) {
      // It's an expense
      const matchedCat = matchCategory(particularRaw, categories)
      parsedResults.push({
        date,
        particular: particularRaw,
        expenseAmount: expenseRaw,
        incomeAmount: 0,
        type: 'expense',
        categoryId: matchedCat?.id,
        categoryName: matchedCat?.name || 'Expense',
        note: particularRaw,
      })
    }
  }

  return parsedResults
}

/**
 * Export running ledger to genuine .xlsx Excel workbook file
 */
export function exportToExcel(
  rows: Array<{
    date: string
    particular: string
    expense: number
    income?: number
    deposit?: number
    balance: number
  }>,
  openingBalance: number,
  filename = 'thoppu-ledger.xlsx'
) {
  const wb = XLSX.utils.book_new()

  const excelData = [
    ['Date', 'Particular', 'Expenses', 'Deposit', 'Balance'],
    [new Date().toISOString().slice(0, 10), 'Opening Balance', '', '', openingBalance],
  ]

  for (const r of rows) {
    const depVal = r.deposit !== undefined && r.deposit > 0 ? r.deposit : (r.income && r.income > 0 ? r.income : '')
    excelData.push([
      r.date,
      r.particular,
      r.expense > 0 ? (r.expense as any) : '',
      depVal as any,
      r.balance as any,
    ])
  }

  const ws = XLSX.utils.aoa_to_sheet(excelData)

  // Auto-width columns
  ws['!cols'] = [
    { wch: 14 },
    { wch: 32 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Ledger')
  XLSX.writeFile(wb, filename)
}
