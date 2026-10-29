// The app's API running inside the browser: same routes, rules, messages and JSON as the .NET API of the PC
// version (src/Api/Endpoints), with the data kept in IndexedDB on the device. Nothing leaves the phone.

type EntryType = 'Income' | 'Expense'
type AccountKind = 'Bank' | 'MealCard'
type Q = URLSearchParams
// Handler bodies are the JSON the frontend sends; validated field by field below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Body = any

interface AccountRow { id: number; name: string; kind: AccountKind; color: string | null; sortOrder: number; isActive: boolean; isDefault: boolean; openingBalance: number }
interface CategoryRow { id: number; name: string; type: EntryType; color: string | null; sortOrder: number; isActive: boolean; isSavings: boolean }
interface SubRow { id: number; categoryId: number; name: string; sortOrder: number; isActive: boolean; holdingId: number | null }
interface TxRow {
  id: number; date: string; type: EntryType; categoryId: number; subCategoryId: number | null; accountId: number
  amount: number; description: string | null; source: 'Manual' | 'Import'; createdAt: string; updatedAt: string
}
interface TransferRow { id: number; date: string; fromAccountId: number; toAccountId: number; amount: number; description: string | null; createdAt: string; updatedAt: string }
interface PlanRow { year: number; month: number; subCategoryId: number; amount: number; accountId: number | null }
interface HoldingRow { id: number; name: string; color: string | null; sortOrder: number; isActive: boolean }
interface ValuationRow { id: number; holdingId: number; date: string; value: number; note: string | null; createdAt: string }

interface Data {
  version: 1
  nextId: number
  startDate: string
  accounts: AccountRow[]
  categories: CategoryRow[]
  subCategories: SubRow[]
  transactions: TxRow[]
  transfers: TransferRow[]
  plans: PlanRow[]
  holdings: HoldingRow[]
  valuations: ValuationRow[]
}

// ---------------------------------------------------------------- storage (IndexedDB, one record)

const DB_NAME = 'orcamento-pessoal'
const STORE = 'kv'

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function readStored(): Promise<Data | undefined> {
  const conn = await idb()
  return new Promise((resolve, reject) => {
    const req = conn.transaction(STORE).objectStore(STORE).get('data')
    req.onsuccess = () => resolve(req.result as Data | undefined)
    req.onerror = () => reject(req.error)
  })
}

async function writeStored(data: Data): Promise<void> {
  const conn = await idb()
  return new Promise((resolve, reject) => {
    const tx = conn.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(data, 'data')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

let loaded: Promise<Data> | null = null
function load(): Promise<Data> {
  loaded ??= (async () => {
    // Ask Safari/Chrome not to evict the data under storage pressure.
    navigator.storage?.persist?.().catch(() => {})
    const stored = await readStored()
    if (stored) return stored
    const fresh = seed()
    await writeStored(fresh)
    return fresh
  })()
  return loaded
}

/** Whole database as JSON (Definições › Cópia de segurança). */
export async function exportData(): Promise<string> {
  return JSON.stringify(await load())
}

/** Replaces everything with a backup made by exportData. */
export async function importData(json: string): Promise<void> {
  const data = JSON.parse(json) as Data
  const keys: (keyof Data)[] = ['accounts', 'categories', 'subCategories', 'transactions', 'transfers', 'plans', 'holdings', 'valuations']
  if (data?.version !== 1 || typeof data.startDate !== 'string' || keys.some((k) => !Array.isArray(data[k])))
    throw new Error('O ficheiro não é uma cópia de segurança desta app.')
  await writeStored(data)
  loaded = Promise.resolve(data)
}

// ---------------------------------------------------------------- seed (same as Seed.cs)

function seed(): Data {
  const d: Data = {
    version: 1, nextId: 1, startDate: `${new Date().getFullYear()}-01-01`,
    accounts: [], categories: [], subCategories: [], transactions: [], transfers: [], plans: [], holdings: [], valuations: [],
  }
  const id = () => d.nextId++
  const cats: [string, EntryType, string, string[]][] = [
    ['Receitas', 'Income', '#1F497D', ['Vencimento', 'Cartão Refeição', 'Prendas', 'Subsídios / Bónus', 'IRS', 'Outros']],
    ['Transportes', 'Expense', '#4F81BD', ['Mensalidade Carro', 'Seguro Carro', 'Manutenção Carro', 'Combustível', 'IUC']],
    ['Dia a Dia', 'Expense', '#D2711C', ['Supermercado', 'Restaurante', 'Café', 'Eletrónica', 'Barbeiro', 'Roupa']],
    ['Lazer', 'Expense', '#7A4FB5', ['Cinema/concertos', 'Noite', 'Desporto', 'Férias']],
    ['Saúde', 'Expense', '#0FA3C4', ['Consultas', 'Exames', 'Farmácia', 'Psicologia', 'Outros']],
    ['Serviços', 'Expense', '#C0504D',
      ['Renda Casa', 'Condomínio', 'Seguros', 'Água', 'Luz', 'TV + NET', 'Telemóvel', 'Levantamentos', 'Prendas', 'Uber', 'Poupança', 'Outros']],
  ]
  cats.forEach(([name, type, color, subs], order) => {
    const c: CategoryRow = { id: id(), name, type, color, sortOrder: order, isActive: true, isSavings: false }
    d.categories.push(c)
    subs.forEach((s, i) => d.subCategories.push({ id: id(), categoryId: c.id, name: s, sortOrder: i, isActive: true, holdingId: null }))
  })
  const inv: CategoryRow = { id: id(), name: 'Investimentos', type: 'Expense', color: '#1E8C6E', sortOrder: 6, isActive: true, isSavings: true }
  d.categories.push(inv)
  ;[['Ações (XTB)', '#1E8C6E'], ['Fundo de emergência', '#4F81BD']].forEach(([name, color], i) => {
    const h: HoldingRow = { id: id(), name, color, sortOrder: i, isActive: true }
    d.holdings.push(h)
    d.subCategories.push({ id: id(), categoryId: inv.id, name, sortOrder: i, isActive: true, holdingId: h.id })
  })
  d.accounts.push({ id: id(), name: 'Conta à ordem', kind: 'Bank', color: '#1F497D', sortOrder: 0, isActive: true, isDefault: true, openingBalance: 0 })
  d.accounts.push({ id: id(), name: 'Cartão Refeição', kind: 'MealCard', color: '#B8A444', sortOrder: 1, isActive: true, isDefault: false, openingBalance: 0 })
  return d
}

// ---------------------------------------------------------------- helpers

/** Error response, shaped like the API's ProblemDetails. */
export class HttpError {
  status: number
  problem: Record<string, unknown>
  constructor(status: number, problem: Record<string, unknown>) {
    this.status = status
    this.problem = problem
  }
}
type Errors = Record<string, string[]>
const addError = (e: Errors, field: string, msg: string) => (e[field] ??= []).push(msg)
const validation = (e: Errors) => new HttpError(400, { title: 'Dados inválidos.', errors: e })
const invalid = (field: string, msg: string) => new HttpError(400, { title: msg, errors: { [field]: [msg] } })
const notFound = (msg: string) => new HttpError(404, { title: msg })
const conflict = (msg: string, ext: Record<string, unknown> = {}) => new HttpError(409, { title: msg, ...ext })
function check(e: Errors) {
  if (Object.keys(e).length > 0) throw validation(e)
}

const r2 = (x: number) => Math.round(x * 100) / 100
const r4 = (x: number) => Math.round(x * 10000) / 10000
const sum = <T>(items: T[], f: (x: T) => number) => r2(items.reduce((s, x) => s + f(x), 0))
const twoDecimals = (x: number) => Math.abs(x * 100 - Math.round(x * 100)) < 1e-6
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase() // SQL Server compares names case-insensitively
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'pt')
const bySort = (a: { sortOrder: number; name: string }, b: { sortOrder: number; name: string }) => a.sortOrder - b.sortOrder || byName(a, b)
const HEX = /^#[0-9A-Fa-f]{6}$/
const color = (c: unknown) => (typeof c === 'string' && c.trim() ? c.trim().toUpperCase() : null)
const text = (s: unknown) => (typeof s === 'string' && s.trim() ? s.trim() : null)
const now = () => new Date().toISOString()
const signed = (t: TxRow) => (t.type === 'Income' ? t.amount : -t.amount)

// Dates are 'yyyy-MM-dd' strings, so they compare as text.
const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d = 1) => `${y}-${pad(m)}-${pad(d)}`
const firstOfMonth = (d: string) => `${d.slice(0, 8)}01`
function addMonths(first: string, n: number) {
  const total = Number(first.slice(0, 4)) * 12 + Number(first.slice(5, 7)) - 1 + n
  return iso(Math.floor(total / 12), (total % 12) + 1)
}
function addDays(d: string, n: number) {
  const x = new Date(`${d}T12:00:00Z`)
  x.setUTCDate(x.getUTCDate() + n)
  return x.toISOString().slice(0, 10)
}
function today() {
  const t = new Date()
  return iso(t.getFullYear(), t.getMonth() + 1, t.getDate())
}
const ym = (d: string) => d.slice(0, 7)
const isDate = (d: unknown): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)
const int = (q: Q, k: string) => (q.get(k) ? Number(q.get(k)) : undefined)

function validateAmount(e: Errors, amount: unknown) {
  if (typeof amount !== 'number' || !(amount > 0)) addError(e, 'amount', 'O valor tem de ser maior que zero.')
  else if (!twoDecimals(amount)) addError(e, 'amount', 'O valor só pode ter duas casas decimais.')
  else if (amount >= 10_000_000_000) addError(e, 'amount', 'O valor é demasiado grande.')
}

// ---------------------------------------------------------------- shared calculations

const startMonthOf = (d: Data) => firstOfMonth(d.startDate)
const defaultAccountId = (d: Data) => (d.accounts.find((a) => a.isDefault) ?? [...d.accounts].sort(bySort)[0]).id

/** Income − expense for transactions in [from, to). */
const signedSum = (txs: TxRow[], from: string, to: string) =>
  from >= to ? 0 : sum(txs.filter((t) => t.date >= from && t.date < to), signed)

/** Net (income − expense) per 'yyyy-MM' for transactions in [from, to). */
function monthlyNet(txs: TxRow[], from: string, to: string) {
  const m = new Map<string, number>()
  if (from < to) for (const t of txs) if (t.date >= from && t.date < to) m.set(ym(t.date), r2((m.get(ym(t.date)) ?? 0) + signed(t)))
  return m
}

/** Transfers in − out of one account in [from, to). */
const transferNet = (d: Data, acc: number, from: string, to: string) =>
  from >= to ? 0 : sum(d.transfers.filter((t) => t.date >= from && t.date < to), (t) => (t.toAccountId === acc ? t.amount : 0) - (t.fromAccountId === acc ? t.amount : 0))

/** Transfers in − out per account in [from, to). */
function transferNetPerAccount(d: Data, from: string, to: string) {
  const m = new Map<number, number>()
  if (from < to)
    for (const t of d.transfers)
      if (t.date >= from && t.date < to) {
        m.set(t.toAccountId, r2((m.get(t.toAccountId) ?? 0) + t.amount))
        m.set(t.fromAccountId, r2((m.get(t.fromAccountId) ?? 0) - t.amount))
      }
  return m
}

/** Transfers in − out of one account per 'yyyy-MM' in [from, to). */
function transferMonthlyNet(d: Data, acc: number, from: string, to: string) {
  const m = new Map<string, number>()
  if (from < to)
    for (const t of d.transfers)
      if (t.date >= from && t.date < to && (t.toAccountId === acc || t.fromAccountId === acc))
        m.set(ym(t.date), r2((m.get(ym(t.date)) ?? 0) + (t.toAccountId === acc ? t.amount : -t.amount)))
  return m
}

const isSavingsTx = (d: Data) => {
  const savings = new Set(d.categories.filter((c) => c.isSavings).map((c) => c.id))
  return (t: TxRow) => savings.has(t.categoryId)
}

// ---------------------------------------------------------------- DTOs

function txDto(d: Data, t: TxRow) {
  const c = d.categories.find((x) => x.id === t.categoryId)!
  const s = t.subCategoryId === null ? undefined : d.subCategories.find((x) => x.id === t.subCategoryId)
  const a = d.accounts.find((x) => x.id === t.accountId)!
  return {
    id: t.id, date: t.date, type: t.type, categoryId: c.id, categoryName: c.name, categoryColor: c.color,
    subCategoryId: t.subCategoryId, subCategoryName: s?.name ?? null,
    accountId: a.id, accountName: a.name, accountKind: a.kind, accountColor: a.color,
    amount: t.amount, description: t.description, source: t.source, createdAt: t.createdAt, updatedAt: t.updatedAt,
  }
}

function transferDto(d: Data, t: TransferRow) {
  const f = d.accounts.find((x) => x.id === t.fromAccountId)!
  const to = d.accounts.find((x) => x.id === t.toAccountId)!
  return {
    id: t.id, date: t.date,
    fromAccountId: f.id, fromAccountName: f.name, fromAccountKind: f.kind, fromAccountColor: f.color,
    toAccountId: to.id, toAccountName: to.name, toAccountKind: to.kind, toAccountColor: to.color,
    amount: t.amount, description: t.description, createdAt: t.createdAt, updatedAt: t.updatedAt,
  }
}

const subDto = (d: Data, s: SubRow) => ({
  id: s.id, categoryId: s.categoryId, name: s.name, sortOrder: s.sortOrder, isActive: s.isActive,
  transactionCount: d.transactions.filter((t) => t.subCategoryId === s.id).length,
})

const categoryDto = (d: Data, c: CategoryRow) => ({
  id: c.id, name: c.name, type: c.type, color: c.color, sortOrder: c.sortOrder, isActive: c.isActive,
  transactionCount: d.transactions.filter((t) => t.categoryId === c.id).length,
  subCategories: d.subCategories.filter((s) => s.categoryId === c.id).sort(bySort).map((s) => subDto(d, s)),
  isSavings: c.isSavings,
})

// ---------------------------------------------------------------- transactions

function listTransactions(d: Data, q: Q) {
  const from = q.get('from'), to = q.get('to'), type = q.get('type'), search = q.get('search')?.trim().toLowerCase()
  const categoryId = int(q, 'categoryId'), subId = int(q, 'subCategoryId'), accountId = int(q, 'accountId')
  const min = int(q, 'minAmount'), max = int(q, 'maxAmount')
  let rows = d.transactions.filter((t) =>
    (!from || t.date >= from) && (!to || t.date <= to) && (!type || t.type === type) &&
    (categoryId === undefined || t.categoryId === categoryId) && (subId === undefined || t.subCategoryId === subId) &&
    (accountId === undefined || t.accountId === accountId) &&
    (!search || (t.description ?? '').toLowerCase().includes(search)) &&
    (min === undefined || t.amount >= min) && (max === undefined || t.amount <= max))

  const savings = isSavingsTx(d)
  const totals = {
    income: sum(rows, (t) => (t.type === 'Income' ? t.amount : 0)),
    expense: sum(rows, (t) => (t.type === 'Expense' && !savings(t) ? t.amount : 0)),
    net: sum(rows, signed),
    invested: sum(rows, (t) => (t.type === 'Expense' && savings(t) ? t.amount : 0)),
  }
  const sorts: Record<string, (a: TxRow, b: TxRow) => number> = {
    date_asc: (a, b) => a.date.localeCompare(b.date) || a.id - b.id,
    created_desc: (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id,
    amount_desc: (a, b) => b.amount - a.amount || b.date.localeCompare(a.date),
    amount_asc: (a, b) => a.amount - b.amount || b.date.localeCompare(a.date),
  }
  rows = [...rows].sort(sorts[q.get('sort') ?? ''] ?? ((a, b) => b.date.localeCompare(a.date) || b.id - a.id))
  const page = Math.max(1, int(q, 'page') ?? 1)
  const pageSize = Math.min(1000, Math.max(1, int(q, 'pageSize') ?? 50))
  return {
    items: rows.slice((page - 1) * pageSize, page * pageSize).map((t) => txDto(d, t)),
    totalCount: rows.length, page, pageSize, totals,
  }
}

function saveTransaction(d: Data, b: Body, id?: number) {
  const entity = id === undefined ? undefined : d.transactions.find((t) => t.id === id)
  if (id !== undefined && !entity) throw notFound('Transação não encontrada.')
  const accountId = b.accountId ?? defaultAccountId(d)
  const e: Errors = {}
  if (!isDate(b.date)) addError(e, 'date', 'A data é obrigatória.')
  if (b.type !== 'Income' && b.type !== 'Expense') addError(e, 'type', 'O tipo é obrigatório.')
  validateAmount(e, b.amount)
  if (!d.accounts.some((a) => a.id === accountId)) addError(e, 'accountId', 'A conta não existe.')
  if ((text(b.description)?.length ?? 0) > 500) addError(e, 'description', 'A descrição não pode ter mais de 500 caracteres.')
  const category = d.categories.find((c) => c.id === b.categoryId)
  if (b.categoryId == null) addError(e, 'categoryId', 'A categoria é obrigatória.')
  else if (!category) addError(e, 'categoryId', 'A categoria não existe.')
  else {
    if (b.type && category.type !== b.type) addError(e, 'categoryId', 'O tipo da categoria não corresponde ao tipo da transação.')
    if (b.subCategoryId != null && !d.subCategories.some((s) => s.id === b.subCategoryId && s.categoryId === category.id))
      addError(e, 'subCategoryId', 'A subcategoria não pertence à categoria escolhida.')
  }
  check(e)

  const t = entity ?? ({ id: d.nextId++, source: 'Manual', createdAt: now() } as TxRow)
  Object.assign(t, {
    date: b.date, type: b.type, categoryId: b.categoryId, subCategoryId: b.subCategoryId ?? null, accountId,
    amount: b.amount, description: text(b.description), updatedAt: now(),
  })
  if (!entity) d.transactions.push(t)
  return txDto(d, t)
}

function removeById<T extends { id: number }>(list: T[], id: number, msg: string) {
  const i = list.findIndex((x) => x.id === id)
  if (i < 0) throw notFound(msg)
  list.splice(i, 1)
}

// ---------------------------------------------------------------- transfers

function listTransfers(d: Data, q: Q) {
  const from = q.get('from'), to = q.get('to'), acc = int(q, 'accountId'), search = q.get('search')?.trim().toLowerCase()
  return d.transfers
    .filter((t) => (!from || t.date >= from) && (!to || t.date <= to) &&
      (acc === undefined || t.fromAccountId === acc || t.toAccountId === acc) &&
      (!search || (t.description ?? '').toLowerCase().includes(search)))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
    .map((t) => transferDto(d, t))
}

function saveTransfer(d: Data, b: Body, id?: number) {
  const entity = id === undefined ? undefined : d.transfers.find((t) => t.id === id)
  if (id !== undefined && !entity) throw notFound('Transferência não encontrada.')
  const e: Errors = {}
  if (!isDate(b.date)) addError(e, 'date', 'A data é obrigatória.')
  validateAmount(e, b.amount)
  if ((text(b.description)?.length ?? 0) > 500) addError(e, 'description', 'A descrição não pode ter mais de 500 caracteres.')
  if (b.fromAccountId == null) addError(e, 'fromAccountId', 'Escolha a conta de origem.')
  else if (!d.accounts.some((a) => a.id === b.fromAccountId)) addError(e, 'fromAccountId', 'A conta de origem não existe.')
  if (b.toAccountId == null) addError(e, 'toAccountId', 'Escolha a conta de destino.')
  else if (!d.accounts.some((a) => a.id === b.toAccountId)) addError(e, 'toAccountId', 'A conta de destino não existe.')
  if (b.fromAccountId != null && b.fromAccountId === b.toAccountId)
    addError(e, 'toAccountId', 'A conta de destino tem de ser diferente da de origem.')
  check(e)

  const t = entity ?? ({ id: d.nextId++, createdAt: now() } as TransferRow)
  Object.assign(t, {
    date: b.date, fromAccountId: b.fromAccountId, toAccountId: b.toAccountId, amount: b.amount,
    description: text(b.description), updatedAt: now(),
  })
  if (!entity) d.transfers.push(t)
  return transferDto(d, t)
}

// ---------------------------------------------------------------- accounts

function listAccounts(d: Data) {
  const start = startMonthOf(d)
  const transfers = transferNetPerAccount(d, start, '9999-12-31')
  return [...d.accounts].sort(bySort).map((a) => {
    const mine = d.transactions.filter((t) => t.accountId === a.id)
    return {
      ...a,
      balance: r2(a.openingBalance + sum(mine.filter((t) => t.date >= start), signed) + (transfers.get(a.id) ?? 0)),
      transactionCount: mine.length,
      transferCount: d.transfers.filter((t) => t.fromAccountId === a.id).length + d.transfers.filter((t) => t.toAccountId === a.id).length,
    }
  })
}

function validateAccount(d: Data, b: Body, id: number | null): Errors {
  const e: Errors = {}
  const name = text(b.name)
  if (!name) addError(e, 'name', 'O nome é obrigatório.')
  else if (name.length > 100) addError(e, 'name', 'O nome não pode ter mais de 100 caracteres.')
  else if (d.accounts.some((a) => a.id !== id && same(a.name, name))) addError(e, 'name', 'Já existe uma conta com esse nome.')
  if (text(b.color) && !HEX.test(text(b.color)!)) addError(e, 'color', 'A cor tem de estar no formato #RRGGBB.')
  if (typeof b.openingBalance === 'number' && !twoDecimals(b.openingBalance))
    addError(e, 'openingBalance', 'O saldo inicial só pode ter duas casas decimais.')
  return e
}

function applyAccount(a: AccountRow, b: Body) {
  a.name = text(b.name)!
  if (b.kind) a.kind = b.kind
  a.color = color(b.color)
  if (typeof b.isActive === 'boolean') a.isActive = b.isActive
  if (b.isDefault === true) { a.isDefault = true; a.isActive = true }
  if (typeof b.openingBalance === 'number') a.openingBalance = b.openingBalance
}

function singleDefault(d: Data, a: AccountRow) {
  if (a.isDefault) for (const x of d.accounts) if (x.id !== a.id) x.isDefault = false
}

function createAccount(d: Data, b: Body) {
  check(validateAccount(d, b, null))
  const a: AccountRow = {
    id: d.nextId++, name: '', kind: 'Bank', color: null, isActive: true, isDefault: false, openingBalance: 0,
    sortOrder: Math.max(-1, ...d.accounts.map((x) => x.sortOrder)) + 1,
  }
  applyAccount(a, b)
  if (d.accounts.length === 0) a.isDefault = true // the first account is always the default one
  d.accounts.push(a)
  singleDefault(d, a)
  return listAccounts(d).find((x) => x.id === a.id)
}

function updateAccount(d: Data, id: number, b: Body) {
  const a = d.accounts.find((x) => x.id === id)
  if (!a) throw notFound('Conta não encontrada.')
  const e = validateAccount(d, b, id)
  if (a.isDefault && b.isActive === false)
    addError(e, 'isActive', 'A conta principal não pode ser desativada. Escolha outra como principal primeiro.')
  if (a.isDefault && b.isDefault === false)
    addError(e, 'isDefault', 'Tem de haver uma conta principal: marque outra como principal.')
  check(e)
  applyAccount(a, b)
  singleDefault(d, a)
  return listAccounts(d).find((x) => x.id === id)
}

function deleteAccount(d: Data, id: number, q: Q) {
  const a = d.accounts.find((x) => x.id === id)
  if (!a) throw notFound('Conta não encontrada.')
  if (a.isDefault) throw conflict('A conta principal não pode ser apagada. Escolha outra como principal primeiro.')
  const count = d.transactions.filter((t) => t.accountId === id).length
  const transfers = d.transfers.filter((t) => t.fromAccountId === id || t.toAccountId === id).length
  const to = int(q, 'moveToAccountId')
  if (count + transfers > 0 && to === undefined)
    throw conflict(`A conta "${a.name}" tem ${count} transação(ões) e ${transfers} transferência(s).`, { transactionCount: count, transferCount: transfers })
  if (to !== undefined && (to === id || !d.accounts.some((x) => x.id === to))) throw invalid('moveToAccountId', 'Conta de destino inválida.')

  if (to !== undefined) {
    const t0 = now()
    for (const t of d.transactions) if (t.accountId === id) { t.accountId = to; t.updatedAt = t0 }
    // Transfers between this account and the target would become "to itself": they simply disappear.
    d.transfers = d.transfers.filter((t) => !((t.fromAccountId === id && t.toAccountId === to) || (t.fromAccountId === to && t.toAccountId === id)))
    for (const t of d.transfers) {
      if (t.fromAccountId === id) { t.fromAccountId = to; t.updatedAt = t0 }
      if (t.toAccountId === id) { t.toAccountId = to; t.updatedAt = t0 }
    }
  }
  for (const p of d.plans) if (p.accountId === id) p.accountId = null // plans fall back to the default account
  d.accounts = d.accounts.filter((x) => x.id !== id)
}

// ---------------------------------------------------------------- categories & subcategories

function validateCategory(d: Data, b: Body, type: EntryType | undefined, id: number | null): Errors {
  const e: Errors = {}
  const name = text(b.name)
  if (!name) addError(e, 'name', 'O nome é obrigatório.')
  else if (name.length > 100) addError(e, 'name', 'O nome não pode ter mais de 100 caracteres.')
  else if (type && d.categories.some((c) => c.id !== id && c.type === type && same(c.name, name)))
    addError(e, 'name', 'Já existe uma categoria com esse nome.')
  if (text(b.color) && !HEX.test(text(b.color)!)) addError(e, 'color', 'A cor tem de estar no formato #RRGGBB.')
  return e
}

function createCategory(d: Data, b: Body) {
  const e = validateCategory(d, b, b.type, null)
  if (b.type !== 'Income' && b.type !== 'Expense') addError(e, 'type', 'O tipo é obrigatório.')
  check(e)
  const c: CategoryRow = {
    id: d.nextId++, name: text(b.name)!, type: b.type, color: color(b.color),
    sortOrder: b.sortOrder ?? Math.max(-1, ...d.categories.filter((x) => x.type === b.type).map((x) => x.sortOrder)) + 1,
    isActive: b.isActive ?? true, isSavings: b.type === 'Expense' && b.isSavings === true,
  }
  d.categories.push(c)
  return categoryDto(d, c)
}

function updateCategory(d: Data, id: number, b: Body) {
  const c = d.categories.find((x) => x.id === id)
  if (!c) throw notFound('Categoria não encontrada.')
  check(validateCategory(d, b, b.type ?? c.type, id))
  if (b.type && b.type !== c.type) {
    if (d.transactions.some((t) => t.categoryId === id))
      throw conflict('Não é possível mudar o tipo de uma categoria que já tem transações.')
    c.type = b.type
  }
  c.name = text(b.name)!
  c.color = color(b.color)
  if (typeof b.sortOrder === 'number') c.sortOrder = b.sortOrder
  if (typeof b.isActive === 'boolean') c.isActive = b.isActive
  if (typeof b.isSavings === 'boolean') c.isSavings = b.isSavings
  if (c.type !== 'Expense') c.isSavings = false // only expenses can be savings
  return categoryDto(d, c)
}

/** What to do with the transactions of a category/subcategory being deleted (move or delete them). */
function deleteOptions(d: Data, q: Q, type: EntryType, txCount: number, conflictMsg: string, ext: Record<string, unknown>,
  excludeCategoryId: number | null, excludeSubCategoryId: number | null) {
  const moveTo = int(q, 'moveToCategoryId')
  const moveToSub = int(q, 'moveToSubCategoryId') ?? null
  const deleting = q.get('deleteTransactions') === 'true'
  if (txCount === 0) return { moveTo: undefined, moveToSub }
  if (moveTo === undefined && !deleting) throw conflict(conflictMsg, ext)
  if (moveTo !== undefined && deleting) throw invalid('deleteTransactions', 'Escolha mover ou apagar as transações, não ambos.')
  if (moveTo !== undefined) {
    const target = d.categories.find((c) => c.id === moveTo)
    if (!target) throw invalid('moveToCategoryId', 'A categoria de destino não existe.')
    if (target.id === excludeCategoryId)
      throw invalid('moveToCategoryId', 'A categoria de destino tem de ser diferente da que vai ser apagada.')
    if (target.type !== type) throw invalid('moveToCategoryId', 'A categoria de destino tem de ser do mesmo tipo (Receita/Despesa).')
    if (moveToSub !== null) {
      if (moveToSub === excludeSubCategoryId)
        throw invalid('moveToSubCategoryId', 'A subcategoria de destino tem de ser diferente da que vai ser apagada.')
      if (!d.subCategories.some((s) => s.id === moveToSub && s.categoryId === target.id))
        throw invalid('moveToSubCategoryId', 'A subcategoria de destino não pertence à categoria de destino.')
    }
  }
  return { moveTo, moveToSub }
}

function moveOrDelete(d: Data, match: (t: TxRow) => boolean, moveTo: number | undefined, moveToSub: number | null) {
  if (moveTo === undefined) {
    d.transactions = d.transactions.filter((t) => !match(t))
    return
  }
  const t0 = now()
  for (const t of d.transactions) if (match(t)) Object.assign(t, { categoryId: moveTo, subCategoryId: moveToSub, updatedAt: t0 })
}

function deleteSubCategoriesWhere(d: Data, match: (s: SubRow) => boolean) {
  const gone = new Set(d.subCategories.filter(match).map((s) => s.id))
  d.subCategories = d.subCategories.filter((s) => !gone.has(s.id))
  d.plans = d.plans.filter((p) => !gone.has(p.subCategoryId)) // a plan goes away with its subcategory
}

function deleteCategory(d: Data, id: number, q: Q) {
  const c = d.categories.find((x) => x.id === id)
  if (!c) throw notFound('Categoria não encontrada.')
  const txCount = d.transactions.filter((t) => t.categoryId === id).length
  const subCount = d.subCategories.filter((s) => s.categoryId === id).length
  const o = deleteOptions(d, q, c.type, txCount, `A categoria "${c.name}" tem ${txCount} transação(ões) associada(s).`,
    { transactionCount: txCount, subCategoryCount: subCount }, id, null)
  if (txCount > 0) moveOrDelete(d, (t) => t.categoryId === id, o.moveTo, o.moveToSub)
  deleteSubCategoriesWhere(d, (s) => s.categoryId === id)
  d.categories = d.categories.filter((x) => x.id !== id)
}

function validateSub(d: Data, b: Body, categoryId: number | undefined, id: number | null): Errors {
  const e: Errors = {}
  if (categoryId == null) addError(e, 'categoryId', 'A categoria é obrigatória.')
  else if (!d.categories.some((c) => c.id === categoryId)) addError(e, 'categoryId', 'A categoria não existe.')
  const name = text(b.name)
  if (!name) addError(e, 'name', 'O nome é obrigatório.')
  else if (name.length > 100) addError(e, 'name', 'O nome não pode ter mais de 100 caracteres.')
  else if (categoryId != null && d.subCategories.some((s) => s.id !== id && s.categoryId === categoryId && same(s.name, name)))
    addError(e, 'name', 'Já existe uma subcategoria com esse nome nesta categoria.')
  return e
}

const nextSubOrder = (d: Data, categoryId: number) =>
  Math.max(-1, ...d.subCategories.filter((s) => s.categoryId === categoryId).map((s) => s.sortOrder)) + 1

function createSub(d: Data, b: Body) {
  check(validateSub(d, b, b.categoryId, null))
  const s: SubRow = {
    id: d.nextId++, categoryId: b.categoryId, name: text(b.name)!,
    sortOrder: b.sortOrder ?? nextSubOrder(d, b.categoryId), isActive: b.isActive ?? true, holdingId: null,
  }
  d.subCategories.push(s)
  return subDto(d, s)
}

function updateSub(d: Data, id: number, b: Body) {
  const s = d.subCategories.find((x) => x.id === id)
  if (!s) throw notFound('Subcategoria não encontrada.')
  const target = b.categoryId ?? s.categoryId
  check(validateSub(d, b, target, id))
  if (target !== s.categoryId) {
    const from = d.categories.find((c) => c.id === s.categoryId)!
    if (d.categories.find((c) => c.id === target)!.type !== from.type)
      throw invalid('categoryId', 'A categoria de destino tem de ser do mesmo tipo (Receita/Despesa).')
    // Moving a subcategory drags its transactions along to the new category.
    const t0 = now()
    for (const t of d.transactions) if (t.subCategoryId === id) { t.categoryId = target; t.updatedAt = t0 }
    s.sortOrder = b.sortOrder ?? nextSubOrder(d, target)
    s.categoryId = target
  } else if (typeof b.sortOrder === 'number') s.sortOrder = b.sortOrder
  s.name = text(b.name)!
  if (typeof b.isActive === 'boolean') s.isActive = b.isActive
  return subDto(d, s)
}

function deleteSub(d: Data, id: number, q: Q) {
  const s = d.subCategories.find((x) => x.id === id)
  if (!s) throw notFound('Subcategoria não encontrada.')
  const type = d.categories.find((c) => c.id === s.categoryId)!.type
  const txCount = d.transactions.filter((t) => t.subCategoryId === id).length
  const o = deleteOptions(d, q, type, txCount, `A subcategoria "${s.name}" tem ${txCount} transação(ões) associada(s).`,
    { transactionCount: txCount }, null, id)
  if (txCount > 0) moveOrDelete(d, (t) => t.subCategoryId === id, o.moveTo, o.moveToSub)
  deleteSubCategoriesWhere(d, (x) => x.id === id)
}

function reorder(list: { id: number; sortOrder: number }[], b: Body) {
  const ids: number[] = b?.ids ?? []
  for (const x of list) if (ids.includes(x.id)) x.sortOrder = ids.indexOf(x.id)
}

// ---------------------------------------------------------------- reports

function validYear(y: number | undefined) {
  if (y === undefined || !(y >= 1900 && y <= 2999)) throw invalid('year', 'Ano inválido.')
  return y
}
function validMonth(m: number | undefined) {
  if (m === undefined || !(m >= 1 && m <= 12)) throw invalid('month', 'Mês inválido.')
  return m
}

function monthlyGrid(d: Data, q: Q) {
  const y = validYear(int(q, 'year') ?? new Date().getFullYear())
  const accountId = int(q, 'accountId')
  const startMonth = startMonthOf(d)
  const yearStart = iso(y, 1), yearEnd = iso(y + 1, 1)
  const txs = accountId === undefined ? d.transactions : d.transactions.filter((t) => t.accountId === accountId)
  const inYear = txs.filter((t) => t.date >= yearStart && t.date < yearEnd)
  const month = (t: TxRow) => Number(t.date.slice(5, 7)) - 1
  const months = (rows: TxRow[]) => {
    const m = new Array<number>(12).fill(0)
    for (const t of rows) m[month(t)] += t.amount
    return m.map(r2)
  }
  const total = (m: number[]) => sum(m, (x) => x)
  const categories = [...d.categories].sort(bySort)

  const section = (type: EntryType, savings = false) => {
    const cats = categories.filter((c) => c.type === type && c.isSavings === savings)
    const ids = new Set(cats.map((c) => c.id))
    const cells = inYear.filter((t) => t.type === type && ids.has(t.categoryId))
    const result = []
    for (const c of cats) {
      const catCells = cells.filter((t) => t.categoryId === c.id)
      if (!c.isActive && catCells.length === 0) continue
      const rows = []
      for (const s of d.subCategories.filter((x) => x.categoryId === c.id).sort(bySort)) {
        const m = months(catCells.filter((t) => t.subCategoryId === s.id))
        if (!s.isActive && m.every((x) => x === 0)) continue
        rows.push({ subCategoryId: s.id, name: s.name, isActive: s.isActive, months: m, total: total(m) })
      }
      const loose = months(catCells.filter((t) => t.subCategoryId === null))
      if (loose.some((x) => x !== 0)) rows.push({ subCategoryId: null, name: '(sem subcategoria)', isActive: true, months: loose, total: total(loose) })
      const cm = months(catCells)
      result.push({ id: c.id, name: c.name, color: c.color, isActive: c.isActive, rows, months: cm, total: total(cm) })
    }
    const totals = months(cells)
    return { type, categories: result, months: totals, total: total(totals) }
  }

  const income = section('Income'), expense = section('Expense'), savings = section('Expense', true)
  const net = income.months.map((x, i) => r2(x - expense.months[i]))

  const balances = (source: TxRow[], opening: number, forAccount?: number) => {
    const countedFrom = yearStart > startMonth ? yearStart : startMonth
    let netBefore = signedSum(source, startMonth, yearStart)
    const counted = monthlyNet(source, countedFrom, yearEnd)
    if (forAccount !== undefined) {
      netBefore += transferNet(d, forAccount, startMonth, yearStart)
      for (const [k, v] of transferMonthlyNet(d, forAccount, countedFrom, yearEnd)) counted.set(k, r2((counted.get(k) ?? 0) + v))
    }
    const previous: (number | null)[] = new Array(12).fill(null)
    const end: (number | null)[] = new Array(12).fill(null)
    let running: number | null = null
    for (let m = 1; m <= 12; m++) {
      const first = iso(y, m)
      if (first < startMonth) continue
      running ??= r2(opening + netBefore)
      previous[m - 1] = running
      running = r2(running + (counted.get(ym(first)) ?? 0))
      end[m - 1] = running
    }
    return { previous, end }
  }

  const opening = sum(d.accounts.filter((a) => accountId === undefined || a.id === accountId), (a) => a.openingBalance)
  const { previous, end } = balances(txs, opening, accountId)

  let transfers: number[] | null = null
  if (accountId !== undefined) {
    const monthly = transferMonthlyNet(d, accountId, yearStart, yearEnd)
    transfers = Array.from({ length: 12 }, (_, i) => monthly.get(ym(iso(y, i + 1))) ?? 0)
  }
  let previousBalanceByAccount = null
  if (accountId === undefined) {
    previousBalanceByAccount = []
    for (const a of [...d.accounts].sort(bySort)) {
      const values = balances(d.transactions.filter((t) => t.accountId === a.id), a.openingBalance, a.id).previous
      // Inactive accounts only show while they still hold money.
      if (a.isActive || values.some((v) => v !== null && v !== 0))
        previousBalanceByAccount.push({ accountId: a.id, name: a.name, kind: a.kind, color: a.color, isActive: a.isActive, values })
    }
  }
  return { year: y, startMonth, income, expense, previousBalance: previous, net, endBalance: end, previousBalanceByAccount, transfers, savings }
}

function dashboard(d: Data, q: Q) {
  const t0 = new Date()
  const y = validYear(int(q, 'year') ?? t0.getFullYear())
  const m = validMonth(int(q, 'month') ?? t0.getMonth() + 1)
  const startMonth = startMonthOf(d)
  const monthStart = iso(y, m), monthEnd = addMonths(monthStart, 1), seriesStart = addMonths(monthStart, -11)
  const savings = isSavingsTx(d)

  const countedFrom = seriesStart > startMonth ? seriesStart : startMonth
  const counted = monthlyNet(d.transactions, countedFrom, monthEnd)
  const netBefore = signedSum(d.transactions, startMonth, seriesStart)
  const totalOpening = sum(d.accounts, (a) => a.openingBalance)

  const series = []
  let running: number | null = null
  for (let first = seriesStart; first < monthEnd; first = addMonths(first, 1)) {
    const rows = d.transactions.filter((t) => ym(t.date) === ym(first))
    const income = sum(rows, (t) => (t.type === 'Income' ? t.amount : 0))
    const expense = sum(rows, (t) => (t.type === 'Expense' && !savings(t) ? t.amount : 0))
    const invested = sum(rows, (t) => (t.type === 'Expense' && savings(t) ? t.amount : 0))
    if (first >= startMonth) {
      running ??= r2(totalOpening + netBefore)
      running = r2(running + (counted.get(ym(first)) ?? 0))
    }
    const net = r2(income - expense)
    series.push({
      year: Number(first.slice(0, 4)), month: Number(first.slice(5, 7)), income, expense, net, balance: running,
      savingsRate: income > 0 ? r4(net / income) : null, invested,
    })
  }

  const before = monthEnd <= startMonth
  const transfers = transferNetPerAccount(d, startMonth, monthEnd)
  const accountBalances = [...d.accounts].sort(bySort)
    .map((a) => ({
      isActive: a.isActive,
      dto: {
        accountId: a.id, name: a.name, kind: a.kind, color: a.color,
        balance: before ? null : r2(a.openingBalance
          + signedSum(d.transactions.filter((t) => t.accountId === a.id), startMonth, monthEnd) + (transfers.get(a.id) ?? 0)),
      },
    }))
    .filter((x) => x.isActive || (x.dto.balance !== null && x.dto.balance !== 0)) // inactive accounts only while they hold money
    .map((x) => x.dto)

  const lastDay = addDays(monthEnd, -1)
  const investments = totalHoldingsValue(d, lastDay < today() ? lastDay : today())
  const previousInvestments = totalHoldingsValue(d, addDays(monthStart, -1))

  const spent = d.transactions.filter((t) => t.type === 'Expense' && !savings(t) && t.date >= monthStart && t.date < monthEnd)
  const byCategory = new Map<number, number>()
  for (const t of spent) byCategory.set(t.categoryId, (byCategory.get(t.categoryId) ?? 0) + t.amount)
  const expenseTotal = sum([...byCategory.values()], (x) => x)
  const expensesByCategory = [...byCategory.entries()]
    .map(([id, amount]) => {
      const c = d.categories.find((x) => x.id === id)!
      return { categoryId: id, name: c.name, color: c.color, amount: r2(amount), percent: expenseTotal > 0 ? r4(amount / expenseTotal) : 0 }
    })
    .sort((a, b) => b.amount - a.amount)

  const bySub = new Map<string, { categoryId: number; subCategoryId: number | null; amount: number }>()
  for (const t of spent) {
    const k = `${t.categoryId}/${t.subCategoryId}`
    const x = bySub.get(k) ?? { categoryId: t.categoryId, subCategoryId: t.subCategoryId, amount: 0 }
    x.amount += t.amount
    bySub.set(k, x)
  }
  const topSubCategories = [...bySub.values()]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map((x) => {
      const c = d.categories.find((cc) => cc.id === x.categoryId)!
      const s = d.subCategories.find((ss) => ss.id === x.subCategoryId)
      return {
        categoryId: c.id, categoryName: c.name, categoryColor: c.color, subCategoryId: x.subCategoryId,
        name: s?.name ?? `${c.name} (sem subcategoria)`, amount: r2(x.amount),
      }
    })

  const latestTransactions = d.transactions
    .filter((t) => t.date < monthEnd)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
    .slice(0, 10)
    .map((t) => txDto(d, t))

  return {
    current: series[series.length - 1], accountBalances, investments, previous: series[series.length - 2], series,
    expensesByCategory, topSubCategories, latestTransactions, previousInvestments,
  }
}

// ---------------------------------------------------------------- budget

function budgetMonth(d: Data, y: number, m: number) {
  const monthStart = iso(y, m), monthEnd = addMonths(monthStart, 1), t = today()
  const status = monthEnd <= t ? 'past' : monthStart > t ? 'future' : 'current'
  const plans = new Map(d.plans.filter((p) => p.year === y && p.month === m).map((p) => [p.subCategoryId, p]))
  const inMonth = d.transactions.filter((x) => x.date >= monthStart && x.date < monthEnd)
  const project = (planned: number, actual: number) => (status === 'past' ? actual : Math.max(planned, actual))
  const categories = [...d.categories].sort(bySort)

  type Line = { categoryId: number; subCategoryId: number | null; name: string; isActive: boolean; planned: number; actual: number; projected: number; accountId: number | null }
  const groups = (type: EntryType, savings = false) => {
    const result = []
    for (const c of categories.filter((x) => x.type === type && x.isSavings === savings)) {
      const lines: Line[] = []
      for (const s of d.subCategories.filter((x) => x.categoryId === c.id).sort(bySort)) {
        const plan = plans.get(s.id)
        const planned = plan?.amount ?? 0
        const actual = sum(inMonth.filter((x) => x.subCategoryId === s.id), (x) => x.amount)
        // Inactive subcategories only show up when they still carry numbers this month.
        if (!s.isActive && planned === 0 && actual === 0) continue
        lines.push({ categoryId: c.id, subCategoryId: s.id, name: s.name, isActive: s.isActive, planned, actual, projected: project(planned, actual), accountId: plan?.accountId ?? null })
      }
      const loose = sum(inMonth.filter((x) => x.categoryId === c.id && x.subCategoryId === null), (x) => x.amount)
      if (loose !== 0)
        lines.push({ categoryId: c.id, subCategoryId: null, name: '(sem subcategoria)', isActive: true, planned: 0, actual: loose, projected: loose, accountId: null })
      if (!c.isActive && lines.every((l) => l.planned === 0 && l.actual === 0)) continue
      result.push({
        id: c.id, name: c.name, color: c.color, isActive: c.isActive, lines,
        planned: sum(lines, (l) => l.planned), actual: sum(lines, (l) => l.actual), projected: sum(lines, (l) => l.projected),
      })
    }
    return result
  }
  const totals = (g: { planned: number; actual: number; projected: number }[]) =>
    ({ planned: sum(g, (x) => x.planned), actual: sum(g, (x) => x.actual), projected: sum(g, (x) => x.projected) })

  const income = groups('Income'), expense = groups('Expense'), savings = groups('Expense', true)
  const incomeTotals = totals(income), expenseTotals = totals(expense), savingsTotals = totals(savings)

  const startMonth = startMonthOf(d)
  const beforeStart = monthStart < startMonth
  const previous = beforeStart ? null : r2(sum(d.accounts, (a) => a.openingBalance) + signedSum(d.transactions, startMonth, monthStart))

  // ---- per account ----
  const defaultId = defaultAccountId(d)
  const transfersBefore = transferNetPerAccount(d, startMonth, monthStart)
  const transfersThisMonth = transferNetPerAccount(d, monthStart, monthEnd)
  const isSav = isSavingsTx(d)
  const allLines = [
    ...income.flatMap((g) => g.lines.map((line) => ({ line, sign: 1, isSavings: false }))),
    ...expense.flatMap((g) => g.lines.map((line) => ({ line, sign: -1, isSavings: false }))),
    ...savings.flatMap((g) => g.lines.map((line) => ({ line, sign: -1, isSavings: true }))),
  ]
  const accounts = []
  for (const a of [...d.accounts].sort(bySort)) {
    const mine = allLines.filter((x) => (x.line.accountId ?? defaultId) === a.id)
    const plannedIncome = sum(mine.filter((x) => x.sign > 0), (x) => x.line.planned)
    const plannedExpense = sum(mine.filter((x) => x.sign < 0 && !x.isSavings), (x) => x.line.planned)
    const plannedSavings = sum(mine.filter((x) => x.isSavings), (x) => x.line.planned)
    const plannedNet = r2(plannedIncome - plannedExpense)
    // What is planned on this account but hasn't happened yet (nothing left once the month is closed).
    const remaining = status === 'past' ? 0 : sum(mine, (x) => x.sign * Math.max(x.line.planned - x.line.actual, 0))
    const own = inMonth.filter((x) => x.accountId === a.id)
    const actualIncome = sum(own, (x) => (x.type === 'Income' ? x.amount : 0))
    const actualExpense = sum(own, (x) => (x.type === 'Expense' && !isSav(x) ? x.amount : 0))
    const actualSavings = sum(own, (x) => (x.type === 'Expense' && isSav(x) ? x.amount : 0))
    const actualNet = r2(actualIncome - actualExpense)
    const prev = beforeStart ? null
      : r2(a.openingBalance + signedSum(d.transactions.filter((x) => x.accountId === a.id), startMonth, monthStart) + (transfersBefore.get(a.id) ?? 0))
    const tNet = transfersThisMonth.get(a.id) ?? 0
    if (!a.isActive && plannedNet === 0 && actualNet === 0 && tNet === 0 && plannedSavings === 0 && actualSavings === 0 && (prev ?? 0) === 0) continue
    accounts.push({
      id: a.id, name: a.name, kind: a.kind, color: a.color, previousBalance: prev, actualNet, plannedNet,
      plannedEnd: prev === null ? null : r2(prev + plannedNet - plannedSavings),
      projectedEnd: prev === null ? null : r2(prev + actualNet - actualSavings + tNet + remaining),
      actualIncome, actualExpense, plannedIncome, plannedExpense, transferNet: tNet, plannedSavings, actualSavings,
    })
  }

  const end = (k: 'planned' | 'projected' | 'actual') =>
    previous === null ? null : r2(previous + incomeTotals[k] - expenseTotals[k] - savingsTotals[k])
  return {
    year: y, month: m, status, hasPlan: plans.size > 0, previousBalance: previous,
    income, expense, incomeTotals, expenseTotals,
    plannedEndBalance: end('planned'), projectedEndBalance: end('projected'), actualEndBalance: end('actual'),
    defaultAccountId: defaultId, accounts, savings, savingsTotals,
  }
}

function saveBudget(d: Data, y: number, m: number, b: Body) {
  const items: { subCategoryId: number; amount: number; accountId?: number | null }[] = b?.items ?? []
  const e: Errors = {}
  if (items.some((i) => !(i.amount >= 0) || !twoDecimals(i.amount) || i.amount >= 10_000_000_000))
    addError(e, 'items', 'Os valores previstos têm de ser positivos e ter no máximo duas casas decimais.')
  const ids = items.map((i) => i.subCategoryId)
  if (new Set(ids).size !== ids.length) addError(e, 'items', 'Há subcategorias repetidas.')
  if (ids.some((id) => !d.subCategories.some((s) => s.id === id))) addError(e, 'items', 'Há subcategorias que não existem.')
  if (items.some((i) => i.accountId != null && !d.accounts.some((a) => a.id === i.accountId))) addError(e, 'items', 'Há contas que não existem.')
  check(e)
  d.plans = d.plans.filter((p) => !(p.year === y && p.month === m))
  for (const i of items)
    if (i.amount > 0) d.plans.push({ year: y, month: m, subCategoryId: i.subCategoryId, amount: i.amount, accountId: i.accountId ?? null })
  return budgetMonth(d, y, m)
}

function budgetSuggestions(d: Data, y: number, m: number, source: string | null) {
  const monthStart = iso(y, m)
  const prev = addMonths(monthStart, -1)
  if (source === 'plan')
    return d.plans
      .filter((p) => p.year === Number(prev.slice(0, 4)) && p.month === Number(prev.slice(5, 7)))
      .map((p) => ({ subCategoryId: p.subCategoryId, amount: p.amount, accountId: p.accountId }))
  if (source === 'actual' || source === 'average') {
    const months = source === 'actual' ? 1 : 3
    const from = addMonths(monthStart, -months)
    const sums = new Map<number, number>()
    for (const t of d.transactions)
      if (t.date >= from && t.date < monthStart && t.subCategoryId !== null) sums.set(t.subCategoryId, (sums.get(t.subCategoryId) ?? 0) + t.amount)
    return [...sums.entries()]
      .sort(([a], [b]) => a - b)
      .map(([subCategoryId, total]) => ({ subCategoryId, amount: r2(total / months), accountId: null }))
  }
  throw invalid('source', 'Origem inválida (plan, actual ou average).')
}

// ---------------------------------------------------------------- holdings

/** Transactions booked in subcategories linked to the holding: expense = money in, income = money out. */
function contributions(d: Data, holdingId: number) {
  const subs = new Set(d.subCategories.filter((s) => s.holdingId === holdingId).map((s) => s.id))
  return d.transactions.filter((t) => t.subCategoryId !== null && subs.has(t.subCategoryId))
}
const investedUntil = (d: Data, holdingId: number, date: string) =>
  sum(contributions(d, holdingId).filter((t) => t.date <= date), (t) => (t.type === 'Expense' ? t.amount : -t.amount))

type ValuationDto = {
  id: number; date: string; value: number; note: string | null; investedAtDate: number
  previousDate?: string | null; previousValue?: number | null; change?: number | null; changePercent?: number | null
}
const valuationDto = (v: ValuationRow, investedAtDate: number): ValuationDto => ({ id: v.id, date: v.date, value: v.value, note: v.note, investedAtDate })

/** Growth since the previous update, without the money put in (or taken out) in between. */
function withChange(current: ValuationDto, previous: ValuationDto): ValuationDto {
  const putIn = r2(current.investedAtDate - previous.investedAtDate)
  const change = r2(current.value - previous.value - putIn)
  const basis = previous.value + putIn
  return { ...current, previousDate: previous.date, previousValue: previous.value, change, changePercent: basis > 0 ? r4(change / basis) : null }
}

function summarize(d: Data, h: HoldingRow, asOf: string) {
  const catOrder = (id: number) => d.categories.find((c) => c.id === id)?.sortOrder ?? 0
  const subCategories = d.subCategories
    .filter((s) => s.holdingId === h.id)
    .sort((a, b) => catOrder(a.categoryId) - catOrder(b.categoryId) || a.sortOrder - b.sortOrder)
    .map((s) => {
      const c = d.categories.find((x) => x.id === s.categoryId)!
      return { id: s.id, name: s.name, categoryId: c.id, categoryName: c.name, type: c.type }
    })
  const invested = investedUntil(d, h.id, asOf)
  const vals = d.valuations.filter((v) => v.holdingId === h.id && v.date <= asOf).sort((a, b) => b.date.localeCompare(a.date))
  const last = vals[0]
  let lastValuation: ValuationDto | null = null
  let gain: number | null = null, gainPercent: number | null = null, since = invested, estimated = invested
  if (last) {
    const atValuation = investedUntil(d, h.id, last.date)
    lastValuation = valuationDto(last, atValuation)
    const previous = vals[1]
    if (previous) lastValuation = withChange(lastValuation, valuationDto(previous, investedUntil(d, h.id, previous.date)))
    gain = r2(last.value - atValuation)
    gainPercent = atValuation > 0 ? r4(gain / atValuation) : null
    since = r2(invested - atValuation)
    estimated = r2(last.value + since)
  }
  return {
    id: h.id, name: h.name, color: h.color, sortOrder: h.sortOrder, isActive: h.isActive, subCategories,
    invested, lastValuation, gain, gainPercent, investedSinceValuation: since, estimatedValue: estimated,
  }
}

const totalHoldingsValue = (d: Data, asOf: string) => sum(d.holdings, (h) => summarize(d, h, asOf).estimatedValue)

function holdingHistory(d: Data, id: number) {
  if (!d.holdings.some((h) => h.id === id)) throw notFound('Investimento não encontrado.')
  const perDay = new Map<string, number>()
  for (const t of contributions(d, id)) perDay.set(t.date, (perDay.get(t.date) ?? 0) + (t.type === 'Expense' ? t.amount : -t.amount))
  let running = 0
  const invested = [...perDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, amount]) => ({ date, invested: (running = r2(running + amount)) }))
  const valuations: ValuationDto[] = []
  for (const v of d.valuations.filter((x) => x.holdingId === id).sort((a, b) => a.date.localeCompare(b.date))) {
    const at = [...invested].reverse().find((p) => p.date <= v.date)?.invested ?? 0
    const dto = valuationDto(v, at)
    valuations.push(valuations.length === 0 ? dto : withChange(dto, valuations[valuations.length - 1]))
  }
  return { valuations, invested }
}

function validateHolding(d: Data, b: Body, id: number | null): Errors {
  const e: Errors = {}
  const name = text(b.name)
  if (!name) addError(e, 'name', 'O nome é obrigatório.')
  else if (name.length > 100) addError(e, 'name', 'O nome não pode ter mais de 100 caracteres.')
  else if (d.holdings.some((h) => h.id !== id && same(h.name, name))) addError(e, 'name', 'Já existe um investimento com esse nome.')
  if (text(b.color) && !HEX.test(text(b.color)!)) addError(e, 'color', 'A cor tem de estar no formato #RRGGBB.')
  const ids: number[] = b.subCategoryIds ?? []
  const found = d.subCategories.filter((s) => ids.includes(s.id))
  if (found.length !== new Set(ids).size) addError(e, 'subCategoryIds', 'Há subcategorias que não existem.')
  for (const s of found.filter((x) => x.holdingId !== null && x.holdingId !== id))
    addError(e, 'subCategoryIds', `A subcategoria "${s.name}" já está ligada a "${d.holdings.find((h) => h.id === s.holdingId)?.name}".`)
  return e
}

/** Makes subCategoryIds the exact set of subcategories linked to the holding. */
function link(d: Data, holdingId: number, ids: number[]) {
  for (const s of d.subCategories) {
    if (s.holdingId === holdingId && !ids.includes(s.id)) s.holdingId = null
    if (ids.includes(s.id)) s.holdingId = holdingId
  }
}

function saveHolding(d: Data, b: Body, id?: number) {
  const existing = id === undefined ? undefined : d.holdings.find((h) => h.id === id)
  if (id !== undefined && !existing) throw notFound('Investimento não encontrado.')
  check(validateHolding(d, b, id ?? null))
  const h = existing ?? { id: d.nextId++, sortOrder: Math.max(-1, ...d.holdings.map((x) => x.sortOrder)) + 1, isActive: true } as HoldingRow
  h.name = text(b.name)!
  h.color = color(b.color)
  if (typeof b.isActive === 'boolean') h.isActive = b.isActive
  if (!existing) d.holdings.push(h)
  if (!existing || b.subCategoryIds) link(d, h.id, b.subCategoryIds ?? [])
  return summarize(d, h, today())
}

function validateValuation(b: Body): Errors {
  const e: Errors = {}
  if (!isDate(b.date)) addError(e, 'date', 'A data é obrigatória.')
  else if (b.date > today()) addError(e, 'date', 'A data não pode ser no futuro.')
  if (typeof b.value !== 'number' || b.value < 0) addError(e, 'value', 'O valor tem de ser zero ou positivo.')
  else if (!twoDecimals(b.value)) addError(e, 'value', 'O valor só pode ter duas casas decimais.')
  if ((text(b.note)?.length ?? 0) > 200) addError(e, 'note', 'A nota não pode ter mais de 200 caracteres.')
  return e
}

function addValuation(d: Data, holdingId: number, b: Body) {
  const h = d.holdings.find((x) => x.id === holdingId)
  if (!h) throw notFound('Investimento não encontrado.')
  check(validateValuation(b))
  // One value per day: updating twice on the same day replaces it.
  let v = d.valuations.find((x) => x.holdingId === holdingId && x.date === b.date)
  if (!v) {
    v = { id: d.nextId++, holdingId, date: b.date, value: 0, note: null, createdAt: now() }
    d.valuations.push(v)
  }
  v.value = b.value
  v.note = text(b.note)
  return summarize(d, h, today())
}

function updateValuation(d: Data, id: number, b: Body) {
  const v = d.valuations.find((x) => x.id === id)
  if (!v) throw notFound('Atualização não encontrada.')
  const e = validateValuation(b)
  if (isDate(b.date) && b.date !== v.date && d.valuations.some((x) => x.holdingId === v.holdingId && x.date === b.date && x.id !== id))
    addError(e, 'date', 'Já existe uma atualização nesse dia.')
  check(e)
  Object.assign(v, { date: b.date, value: b.value, note: text(b.note) })
}

// ---------------------------------------------------------------- router

type Handler = (d: Data, m: RegExpMatchArray, q: Q, body: Body) => unknown
const routes: [string, RegExp, Handler][] = [
  ['GET', /^\/transactions$/, (d, _, q) => listTransactions(d, q)],
  ['POST', /^\/transactions$/, (d, _, __, b) => saveTransaction(d, b)],
  ['PUT', /^\/transactions\/(\d+)$/, (d, m, _, b) => saveTransaction(d, b, Number(m[1]))],
  ['DELETE', /^\/transactions\/(\d+)$/, (d, m) => removeById(d.transactions, Number(m[1]), 'Transação não encontrada.')],

  ['GET', /^\/transfers$/, (d, _, q) => listTransfers(d, q)],
  ['POST', /^\/transfers$/, (d, _, __, b) => saveTransfer(d, b)],
  ['PUT', /^\/transfers\/(\d+)$/, (d, m, _, b) => saveTransfer(d, b, Number(m[1]))],
  ['DELETE', /^\/transfers\/(\d+)$/, (d, m) => removeById(d.transfers, Number(m[1]), 'Transferência não encontrada.')],

  ['GET', /^\/accounts$/, (d) => listAccounts(d)],
  ['POST', /^\/accounts$/, (d, _, __, b) => createAccount(d, b)],
  ['POST', /^\/accounts\/reorder$/, (d, _, __, b) => reorder(d.accounts, b)],
  ['PUT', /^\/accounts\/(\d+)$/, (d, m, _, b) => updateAccount(d, Number(m[1]), b)],
  ['DELETE', /^\/accounts\/(\d+)$/, (d, m, q) => deleteAccount(d, Number(m[1]), q)],

  ['GET', /^\/categories$/, (d) =>
    [...d.categories].sort((a, b) => (a.type === b.type ? bySort(a, b) : a.type === 'Income' ? -1 : 1)).map((c) => categoryDto(d, c))],
  ['POST', /^\/categories$/, (d, _, __, b) => createCategory(d, b)],
  ['POST', /^\/categories\/reorder$/, (d, _, __, b) => reorder(d.categories, b)],
  ['PUT', /^\/categories\/(\d+)$/, (d, m, _, b) => updateCategory(d, Number(m[1]), b)],
  ['DELETE', /^\/categories\/(\d+)$/, (d, m, q) => deleteCategory(d, Number(m[1]), q)],
  ['POST', /^\/subcategories$/, (d, _, __, b) => createSub(d, b)],
  ['POST', /^\/subcategories\/reorder$/, (d, _, __, b) => reorder(d.subCategories, b)],
  ['PUT', /^\/subcategories\/(\d+)$/, (d, m, _, b) => updateSub(d, Number(m[1]), b)],
  ['DELETE', /^\/subcategories\/(\d+)$/, (d, m, q) => deleteSub(d, Number(m[1]), q)],

  ['GET', /^\/reports\/monthly-grid$/, (d, _, q) => monthlyGrid(d, q)],
  ['GET', /^\/reports\/dashboard$/, (d, _, q) => dashboard(d, q)],

  ['GET', /^\/budget$/, (d, _, q) => budgetMonth(d, validYear(int(q, 'year')), validMonth(int(q, 'month')))],
  ['PUT', /^\/budget$/, (d, _, q, b) => saveBudget(d, validYear(int(q, 'year')), validMonth(int(q, 'month')), b)],
  ['GET', /^\/budget\/suggestions$/, (d, _, q) => budgetSuggestions(d, validYear(int(q, 'year')), validMonth(int(q, 'month')), q.get('source'))],

  ['GET', /^\/holdings$/, (d) => [...d.holdings].sort(bySort).map((h) => summarize(d, h, today()))],
  ['GET', /^\/holdings\/(\d+)\/history$/, (d, m) => holdingHistory(d, Number(m[1]))],
  ['POST', /^\/holdings$/, (d, _, __, b) => saveHolding(d, b)],
  ['PUT', /^\/holdings\/(\d+)$/, (d, m, _, b) => saveHolding(d, b, Number(m[1]))],
  ['DELETE', /^\/holdings\/(\d+)$/, (d, m) => {
    const id = Number(m[1])
    removeById(d.holdings, id, 'Investimento não encontrado.')
    d.valuations = d.valuations.filter((v) => v.holdingId !== id) // valuations go with it
    for (const s of d.subCategories) if (s.holdingId === id) s.holdingId = null // subcategories just get unlinked
  }],
  ['POST', /^\/holdings\/(\d+)\/valuations$/, (d, m, _, b) => addValuation(d, Number(m[1]), b)],
  ['PUT', /^\/valuations\/(\d+)$/, (d, m, _, b) => updateValuation(d, Number(m[1]), b)],
  ['DELETE', /^\/valuations\/(\d+)$/, (d, m) => removeById(d.valuations, Number(m[1]), 'Atualização não encontrada.')],

  ['GET', /^\/settings$/, (d) => ({ startDate: d.startDate })],
  ['PUT', /^\/settings$/, (d, _, __, b) => {
    if (!isDate(b?.startDate)) throw invalid('startDate', 'A data de início é obrigatória.')
    d.startDate = b.startDate
    return { startDate: d.startDate }
  }],
]

// One request at a time, so a write never interleaves with another request's read of the same data.
let queue: Promise<unknown> = Promise.resolve()

/** Handles one API call. Writes work on a copy that only replaces the data once saved. Throws HttpError. */
export function handle(method: string, url: string, body?: unknown): Promise<unknown> {
  const run = async () => {
    const [path, search = ''] = url.split('?')
    const route = routes.find(([m, re]) => m === method && re.test(path))
    if (!route) throw notFound('Rota não encontrada.')
    const current = await load()
    const write = method !== 'GET'
    const data = write ? structuredClone(current) : current
    const result = route[2](data, path.match(route[1])!, new URLSearchParams(search), body ?? {})
    if (write) {
      await writeStored(data)
      loaded = Promise.resolve(data)
    }
    return result
  }
  const p = queue.then(run, run)
  queue = p.catch(() => {})
  return p
}
