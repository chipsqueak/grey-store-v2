import { useState, useEffect } from 'react'
import { fetchSales } from '../lib/api'
import type { Sale } from '../types'
import { formatCurrency } from '../lib/utils'

export default function ReportsPage() {
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today')
  const [error, setError] = useState('')

  useEffect(() => {
    loadSales()
  }, [period])

  const loadSales = async () => {
    setLoading(true)
    try {
      const now = new Date()
      let startDate: string

      if (period === 'today') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      } else if (period === 'week') {
        const weekAgo = new Date(now)
        weekAgo.setDate(weekAgo.getDate() - 7)
        startDate = weekAgo.toISOString()
      } else {
        const monthAgo = new Date(now)
        monthAgo.setMonth(monthAgo.getMonth() - 1)
        startDate = monthAgo.toISOString()
      }

      const data = await fetchSales(startDate, now.toISOString())
      setSales(data)
    } catch {
      setError('Failed to load sales data')
    } finally {
      setLoading(false)
    }
  }

  const totalSales = sales.reduce((sum, s) => sum + s.total, 0)
  const totalTransactions = sales.length

  // Top products
  const productTotals = new Map<string, { name: string; qty: number; revenue: number }>()
  for (const sale of sales) {
    for (const item of (sale.items || [])) {
      const existing = productTotals.get(item.product_id) || { name: item.product_name, qty: 0, revenue: 0 }
      existing.qty += item.quantity
      existing.revenue += item.line_total
      productTotals.set(item.product_id, existing)
    }
  }
  const topProducts = [...productTotals.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  // Daily breakdown
  const dailyTotals = new Map<string, number>()
  for (const sale of sales) {
    const day = new Date(sale.created_at).toLocaleDateString()
    dailyTotals.set(day, (dailyTotals.get(day) || 0) + sale.total)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-bold">Reports</h1>

      {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3">{error}</div>}

      {/* Period selector */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {(['today', 'week', 'month'] as const).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition ${
              period === p ? 'bg-white shadow text-primary' : 'text-gray-500'
            }`}
          >
            {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : 'This Month'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-500">Loading…</div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl p-4 shadow-sm border text-center">
              <div className="text-xs text-gray-500 mb-1">Total Sales</div>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(totalSales)}</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border text-center">
              <div className="text-xs text-gray-500 mb-1">Transactions</div>
              <div className="text-2xl font-bold text-primary">{totalTransactions}</div>
            </div>
          </div>

          {/* Top products */}
          {topProducts.length > 0 && (
            <div className="bg-white rounded-xl p-4 shadow-sm border">
              <h2 className="font-bold mb-3">🏆 Top Products</h2>
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

          {/* Daily breakdown */}
          {dailyTotals.size > 0 && period !== 'today' && (
            <div className="bg-white rounded-xl p-4 shadow-sm border">
              <h2 className="font-bold mb-3">📅 Daily Breakdown</h2>
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

          {/* Recent sales */}
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <h2 className="font-bold mb-3">🧾 Recent Sales</h2>
            {sales.length === 0 ? (
              <p className="text-center text-gray-400 py-4">No sales in this period</p>
            ) : (
              <div className="space-y-2">
                {sales.slice(0, 20).map(sale => (
                  <div key={sale.id} className="flex justify-between text-sm border-b border-gray-50 pb-2">
                    <div>
                      <span className="font-medium">{formatCurrency(sale.total)}</span>
                      <span className="text-gray-400 ml-1">· {sale.payment_method}</span>
                      <div className="text-xs text-gray-400">
                        {(sale.items || []).map(i => `${i.product_name} (${i.quantity})`).join(', ')}
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">
                      {new Date(sale.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
