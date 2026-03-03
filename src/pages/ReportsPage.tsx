import { useState, useEffect, useCallback } from 'react'
import { fetchSales, fetchCashBucket, fetchCashMovements, fetchPaymentMethodTotals } from '../lib/api'
import type { Sale, CashBucket, CashMovement } from '../types'
import { formatCurrency } from '../lib/utils'

type Preset = 'today' | 'week' | 'month' | 'custom'

const PAYMENT_METHODS = ['cash', 'gcash', 'bpi'] as const

function getPresetRange(preset: Exclude<Preset, 'custom'>): { start: string; end: string } {
  const now = new Date()
  const end = now.toISOString()
  if (preset === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    return { start, end }
  }
  if (preset === 'week') {
    const d = new Date(now)
    d.setDate(d.getDate() - 7)
    return { start: d.toISOString(), end }
  }
  // month
  const d = new Date(now)
  d.setMonth(d.getMonth() - 1)
  return { start: d.toISOString(), end }
}

function todayISOString() {
  return new Date().toISOString().split('T')[0]
}

export default function ReportsPage() {
  // ── Section 1: Sales ────────────────────────────────────────────────────
  const [preset, setPreset] = useState<Preset>('today')
  const [customStart, setCustomStart] = useState(todayISOString())
  const [customEnd, setCustomEnd] = useState(todayISOString())
  const [appliedRange, setAppliedRange] = useState<{ start: string; end: string }>(
    () => getPresetRange('today')
  )
  const [sales, setSales] = useState<Sale[]>([])
  const [salesLoading, setSalesLoading] = useState(true)
  const [salesError, setSalesError] = useState('')

  // ── Section 2: Money ────────────────────────────────────────────────────
  const [bucket, setBucket] = useState<CashBucket | null>(null)
  const [movements, setMovements] = useState<CashMovement[]>([])
  const [paymentTotals, setPaymentTotals] = useState<Record<string, number>>({})
  const [moneyLoading, setMoneyLoading] = useState(true)
  const [moneyError, setMoneyError] = useState('')

  // ── Load sales for the applied date range ───────────────────────────────
  const loadSales = useCallback(async (range: { start: string; end: string }) => {
    setSalesLoading(true)
    setSalesError('')
    try {
      const data = await fetchSales(range.start, range.end)
      setSales(data)
    } catch {
      setSalesError('Failed to load sales data')
    } finally {
      setSalesLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSales(appliedRange)
  }, [loadSales, appliedRange])

  // ── Load money data (all-time, no filter) ───────────────────────────────
  const loadMoney = useCallback(async () => {
    setMoneyLoading(true)
    setMoneyError('')
    try {
      const [b, m, pt] = await Promise.all([
        fetchCashBucket(),
        fetchCashMovements(1000),
        fetchPaymentMethodTotals(),
      ])
      setBucket(b)
      setMovements(m)
      setPaymentTotals(pt)
    } catch {
      setMoneyError('Failed to load money data')
    } finally {
      setMoneyLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMoney()
  }, [loadMoney])

  // ── Preset selection ────────────────────────────────────────────────────
  const selectPreset = (p: Exclude<Preset, 'custom'>) => {
    setPreset(p)
    setAppliedRange(getPresetRange(p))
  }

  const applyCustom = () => {
    if (!customStart || !customEnd) return
    if (customEnd < customStart) return
    setAppliedRange({
      start: new Date(customStart + 'T00:00:00').toISOString(),
      end: new Date(customEnd + 'T23:59:59').toISOString(),
    })
  }

  // ── Sales calculations ──────────────────────────────────────────────────
  const totalRevenue = sales.reduce((s, sale) => s + sale.total, 0)
  const totalTransactions = sales.length

  const salesByMethod = sales.reduce<Record<string, number>>((acc, sale) => {
    acc[sale.payment_method] = (acc[sale.payment_method] || 0) + sale.total
    return acc
  }, {})

  const productTotals = new Map<string, { name: string; qty: number; revenue: number }>()
  for (const sale of sales) {
    for (const item of (sale.items || [])) {
      const existing = productTotals.get(item.product_id) || { name: item.product_name, qty: 0, revenue: 0 }
      existing.qty += item.quantity
      existing.revenue += item.line_total
      productTotals.set(item.product_id, existing)
    }
  }
  const topProducts = [...productTotals.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10)

  const dailyTotals = new Map<string, number>()
  for (const sale of sales) {
    const day = new Date(sale.created_at).toLocaleDateString()
    dailyTotals.set(day, (dailyTotals.get(day) || 0) + sale.total)
  }

  // ── Money calculations ──────────────────────────────────────────────────
  const cashInHand = bucket ? bucket.bills + bucket.coins : 0

  const expenses = movements.filter(m => m.type === 'expense')
  const expenseByCategory = expenses.reduce<Record<string, number>>((acc, m) => {
    const cat = m.category || 'Uncategorized'
    acc[cat] = (acc[cat] || 0) + m.amount
    return acc
  }, {})
  const totalExpenses = expenses.reduce((sum, m) => sum + m.amount, 0)

  const gcashTotal = paymentTotals['gcash'] || 0
  const bpiTotal = paymentTotals['bpi'] || 0
  const totalMoney = cashInHand + gcashTotal + bpiTotal

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-4">
      <h1 className="text-xl font-bold">📊 Dashboard</h1>

      {/* ═══ SECTION 1: SALES OVERVIEW ══════════════════════════════════════ */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Sales Overview</h2>

        {salesError && <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3">{salesError}</div>}

        {/* Period selector */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(['today', 'week', 'month', 'custom'] as const).map(p => (
            <button
              key={p}
              onClick={() => {
                if (p === 'custom') {
                  setPreset('custom')
                } else {
                  selectPreset(p)
                }
              }}
              className={`flex-1 py-2 text-xs font-medium rounded-md transition ${
                preset === p ? 'bg-white shadow text-primary' : 'text-gray-500'
              }`}
            >
              {p === 'today' ? 'Today' : p === 'week' ? 'Week' : p === 'month' ? 'Month' : '📅 Custom'}
            </button>
          ))}
        </div>

        {/* Custom date range */}
        {preset === 'custom' && (
          <div className="flex gap-2 items-center">
            <input
              type="date"
              value={customStart}
              max={todayISOString()}
              onChange={e => setCustomStart(e.target.value)}
              className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
            <span className="text-gray-400 text-sm shrink-0">to</span>
            <input
              type="date"
              value={customEnd}
              max={todayISOString()}
              onChange={e => setCustomEnd(e.target.value)}
              className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={applyCustom}
              disabled={!customStart || !customEnd}
              className="bg-primary text-white px-3 py-2 rounded-lg text-sm font-medium shrink-0 disabled:opacity-50"
            >
              Apply
            </button>
          </div>
        )}

        {salesLoading ? (
          <div className="flex items-center justify-center h-24 text-gray-500 text-sm">Loading…</div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl p-4 shadow-sm border text-center">
                <div className="text-xs text-gray-500 mb-1">Total Revenue</div>
                <div className="text-2xl font-bold text-green-600">{formatCurrency(totalRevenue)}</div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border text-center">
                <div className="text-xs text-gray-500 mb-1">Transactions</div>
                <div className="text-2xl font-bold text-primary">{totalTransactions}</div>
              </div>
            </div>

            {/* Payment method breakdown */}
            <div className="bg-white rounded-xl p-4 shadow-sm border">
              <h3 className="font-bold mb-3 text-sm">💳 By Payment Method</h3>
              {totalTransactions === 0 ? (
                <p className="text-sm text-gray-400 text-center py-2">No sales in this period</p>
              ) : (
                <div className="space-y-2">
                  {PAYMENT_METHODS.map(method => {
                    const amount = salesByMethod[method] || 0
                    const count = sales.filter(s => s.payment_method === method).length
                    if (amount === 0) return null
                    return (
                      <div key={method} className="flex justify-between items-center text-sm">
                        <span className="flex items-center gap-2">
                          <span>{method === 'cash' ? '💵' : method === 'gcash' ? '📱' : '🏦'}</span>
                          <span>{method === 'gcash' ? 'GCash' : method === 'bpi' ? 'BPI' : 'Cash'}</span>
                          <span className="text-gray-400 text-xs">({count} txn{count !== 1 ? 's' : ''})</span>
                        </span>
                        <span className="font-medium">{formatCurrency(amount)}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Top products */}
            {topProducts.length > 0 && (
              <div className="bg-white rounded-xl p-4 shadow-sm border">
                <h3 className="font-bold mb-3 text-sm">🏆 Top Products</h3>
                <div className="space-y-2">
                  {topProducts.map((p, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span>
                        <span className="text-gray-400 mr-2">{i + 1}.</span>
                        {p.name}
                        <span className="text-gray-400 ml-1">({p.qty})</span>
                      </span>
                      <span className="font-medium">{formatCurrency(p.revenue)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Daily breakdown (only meaningful for multi-day ranges) */}
            {dailyTotals.size > 1 && (
              <div className="bg-white rounded-xl p-4 shadow-sm border">
                <h3 className="font-bold mb-3 text-sm">📅 Daily Breakdown</h3>
                <div className="space-y-2">
                  {[...dailyTotals.entries()].map(([day, total]) => (
                    <div key={day} className="flex justify-between text-sm">
                      <span>{day}</span>
                      <span className="font-medium">{formatCurrency(total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* ═══ SECTION 2: MONEY OVERVIEW ══════════════════════════════════════ */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Money Overview</h2>
          <span className="text-xs text-gray-400 italic">All-time · not filterable</span>
        </div>

        {moneyError && <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3">{moneyError}</div>}

        {moneyLoading ? (
          <div className="flex items-center justify-center h-24 text-gray-500 text-sm">Loading…</div>
        ) : (
          <>
            {/* Unified money snapshot */}
            <div className="bg-white rounded-xl p-4 shadow-sm border">
              <h3 className="font-bold mb-3 text-sm">💰 My Money</h3>
              <div className="space-y-2">
                {/* Cash in drawer */}
                <div className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-2"><span>💵</span><span>Cash in Drawer</span></span>
                  {bucket ? (
                    <span className="font-medium text-green-600">{formatCurrency(cashInHand)}</span>
                  ) : (
                    <span className="text-xs text-gray-400 italic">Not set up</span>
                  )}
                </div>
                {bucket && (
                  <>
                    <div className="flex justify-between text-xs text-gray-400 pl-6">
                      <span>Bills</span>
                      <span>{formatCurrency(bucket.bills)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 pl-6">
                      <span>Coins</span>
                      <span>{formatCurrency(bucket.coins)}</span>
                    </div>
                  </>
                )}
                {/* GCash */}
                <div className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-2"><span>📱</span><span>GCash</span></span>
                  <span className="font-medium text-blue-600">{formatCurrency(gcashTotal)}</span>
                </div>
                {/* BPI / Bank */}
                <div className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-2"><span>🏦</span><span>BPI / Bank</span></span>
                  <span className="font-medium text-indigo-600">{formatCurrency(bpiTotal)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t pt-2">
                  <span>Total</span>
                  <span>{formatCurrency(totalMoney)}</span>
                </div>

                {/* Expenses breakdown */}
                <div className="border-t pt-2 mt-1">
                  <div className="text-xs font-semibold text-gray-500 mb-2">💸 Expenses</div>
                  {totalExpenses === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-1">No expenses recorded</p>
                  ) : (
                    <>
                      {Object.entries(expenseByCategory)
                        .sort((a, b) => b[1] - a[1])
                        .map(([cat, amount]) => (
                          <div key={cat} className="flex justify-between text-sm">
                            <span className="text-gray-600">{cat}</span>
                            <span className="font-medium text-red-600">{formatCurrency(amount)}</span>
                          </div>
                        ))}
                      <div className="flex justify-between text-sm font-bold border-t pt-2">
                        <span>Total Expenses</span>
                        <span className="text-red-600">{formatCurrency(totalExpenses)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
