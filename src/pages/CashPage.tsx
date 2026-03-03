import { useState, useEffect } from 'react'
import type { CashBucket, CashMovement } from '../types'
import {
  fetchCashBucket,
  updateCashBucket,
  fetchCashMovements,
  recordExpense,
  recordBillToCoinConversion,
  recordTakeHome,
  createDailyClose,
} from '../lib/api'
import { formatCurrency } from '../lib/utils'

export default function CashPage() {
  const [bucket, setBucket] = useState<CashBucket | null>(null)
  const [movements, setMovements] = useState<CashMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview' | 'expense' | 'convert' | 'close'>('overview')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [b, m] = await Promise.all([fetchCashBucket(), fetchCashMovements()])
      setBucket(b)
      setMovements(m)
    } catch {
      setError('Failed to load cash data')
    } finally {
      setLoading(false)
    }
  }

  const initBucket = async () => {
    try {
      await updateCashBucket(0, 0)
      await loadData()
      setSuccess('Cash bucket initialized')
      setTimeout(() => setSuccess(''), 3000)
    } catch {
      setError('Failed to initialize cash bucket')
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Loading…</div>

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-bold">Cash Management</h1>

      {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3">{error}</div>}
      {success && <div className="bg-green-50 text-green-600 text-sm rounded-lg p-3">{success}</div>}

      {!bucket ? (
        <div className="bg-white rounded-xl p-6 shadow-sm border text-center">
          <p className="text-gray-500 mb-4">Cash bucket not yet initialized</p>
          <button onClick={initBucket} className="bg-primary text-white px-6 py-2 rounded-lg font-medium">
            Initialize Cash Bucket
          </button>
        </div>
      ) : (
        <>
          {/* Cash summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl p-3 shadow-sm border text-center">
              <div className="text-xs text-gray-500">Bills</div>
              <div className="text-lg font-bold text-green-600">{formatCurrency(bucket.bills)}</div>
            </div>
            <div className="bg-white rounded-xl p-3 shadow-sm border text-center">
              <div className="text-xs text-gray-500">Coins</div>
              <div className="text-lg font-bold text-blue-600">{formatCurrency(bucket.coins)}</div>
            </div>
            <div className="bg-white rounded-xl p-3 shadow-sm border text-center">
              <div className="text-xs text-gray-500">Total</div>
              <div className="text-lg font-bold">{formatCurrency(bucket.bills + bucket.coins)}</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {(['overview', 'expense', 'convert', 'close'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 text-xs font-medium rounded-md transition ${
                  tab === t ? 'bg-white shadow text-primary' : 'text-gray-500'
                }`}
              >
                {t === 'overview' ? '📋 Log' : t === 'expense' ? '💸 Expense' : t === 'convert' ? '🔄 Convert' : '🌙 Close'}
              </button>
            ))}
          </div>

          {tab === 'overview' && <CashLog movements={movements} />}
          {tab === 'expense' && (
            <ExpenseForm
              onSubmit={async (amount, from, category, notes) => {
                try {
                  await recordExpense(amount, from, category, notes)
                  setSuccess('Expense recorded')
                  setTimeout(() => setSuccess(''), 3000)
                  await loadData()
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to record expense')
                }
              }}
            />
          )}
          {tab === 'convert' && (
            <ConvertForm
              onSubmit={async (amount, notes) => {
                try {
                  await recordBillToCoinConversion(amount, notes)
                  setSuccess('Conversion recorded')
                  setTimeout(() => setSuccess(''), 3000)
                  await loadData()
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to record conversion')
                }
              }}
            />
          )}
          {tab === 'close' && (
            <DailyCloseForm
              bucket={bucket}
              onSubmit={async (countedBills, countedCoins, takeHome, notes) => {
                try {
                  if (takeHome > 0) {
                    await recordTakeHome(takeHome, 'Daily close take-home')
                  }
                  const today = new Date().toISOString().split('T')[0]
                  await createDailyClose({
                    date: today,
                    counted_bills: countedBills,
                    counted_coins: countedCoins,
                    take_home_amount: takeHome,
                    coins_carried_forward: countedCoins,
                    notes: notes || null,
                  })
                  setSuccess('Day closed successfully')
                  setTimeout(() => setSuccess(''), 3000)
                  await loadData()
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to close day')
                }
              }}
            />
          )}
        </>
      )}
    </div>
  )
}

function CashLog({ movements }: { movements: CashMovement[] }) {
  const typeLabel = (type: CashMovement['type']) => {
    switch (type) {
      case 'sale': return '🛒 Sale'
      case 'expense': return '💸 Expense'
      case 'conversion': return '🔄 Convert'
      case 'take_home': return '🏠 Take Home'
      case 'adjustment': return '🔧 Adjust'
    }
  }

  return (
    <div className="space-y-2">
      {movements.length === 0 && (
        <p className="text-center text-gray-400 py-8">No cash movements yet</p>
      )}
      {movements.map(m => (
        <div key={m.id} className="bg-white rounded-xl p-3 shadow-sm border text-sm">
          <div className="flex justify-between items-start">
            <div>
              <span className="font-medium">{typeLabel(m.type)}</span>
              {m.category && <span className="text-gray-400 ml-1">· {m.category}</span>}
            </div>
            <span className={`font-semibold ${m.type === 'sale' ? 'text-green-600' : 'text-red-600'}`}>
              {m.type === 'sale' ? '+' : '-'}{formatCurrency(m.amount)}
            </span>
          </div>
          {m.notes && <p className="text-xs text-gray-500 mt-1">{m.notes}</p>}
          <p className="text-xs text-gray-400 mt-1">{new Date(m.created_at).toLocaleString()}</p>
        </div>
      ))}
    </div>
  )
}

function ExpenseForm({ onSubmit }: { onSubmit: (amount: number, from: 'bills' | 'coins', category?: string, notes?: string) => Promise<void> }) {
  const [amount, setAmount] = useState('')
  const [from, setFrom] = useState<'bills' | 'coins'>('bills')
  const [category, setCategory] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount) return
    setSaving(true)
    try {
      await onSubmit(Number(amount), from, category || undefined, notes || undefined)
      setAmount('')
      setCategory('')
      setNotes('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl p-4 shadow-sm border space-y-3">
      <h2 className="font-bold">Record Expense</h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₱)</label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-base outline-none focus:ring-2 focus:ring-primary"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Paid From</label>
        <select
          value={from}
          onChange={e => setFrom(e.target.value as 'bills' | 'coins')}
          className="w-full border rounded-lg px-3 py-2 text-base"
        >
          <option value="bills">Bills</option>
          <option value="coins">Coins</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
        <input
          type="text"
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-base outline-none focus:ring-2 focus:ring-primary"
          placeholder="e.g. Supplies, Utilities"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <input
          type="text"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-base outline-none focus:ring-2 focus:ring-primary"
          placeholder="Optional"
        />
      </div>

      <button
        type="submit"
        disabled={saving || !amount}
        className="w-full bg-danger text-white font-semibold py-2.5 rounded-lg disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Record Expense'}
      </button>
    </form>
  )
}

function ConvertForm({ onSubmit }: { onSubmit: (amount: number, notes?: string) => Promise<void> }) {
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount) return
    setSaving(true)
    try {
      await onSubmit(Number(amount), notes || undefined)
      setAmount('')
      setNotes('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl p-4 shadow-sm border space-y-3">
      <h2 className="font-bold">Bill → Coin Conversion</h2>
      <p className="text-sm text-gray-500">Convert bills to coins (e.g., exchange with Ate Eden). Net-zero — bills decrease, coins increase by the same amount.</p>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₱)</label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-base outline-none focus:ring-2 focus:ring-primary"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <input
          type="text"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-base outline-none focus:ring-2 focus:ring-primary"
          placeholder="e.g. Converted to coins – Ate Eden"
        />
      </div>

      <button
        type="submit"
        disabled={saving || !amount}
        className="w-full bg-primary text-white font-semibold py-2.5 rounded-lg disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Convert Bills → Coins'}
      </button>
    </form>
  )
}

function DailyCloseForm({
  bucket,
  onSubmit,
}: {
  bucket: CashBucket
  onSubmit: (countedBills: number, countedCoins: number, takeHome: number, notes?: string) => Promise<void>
}) {
  const [countedBills, setCountedBills] = useState('')
  const [countedCoins, setCountedCoins] = useState('')
  const [takeHome, setTakeHome] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSubmit(Number(countedBills) || 0, Number(countedCoins) || 0, Number(takeHome) || 0, notes || undefined)
      setCountedBills('')
      setCountedCoins('')
      setTakeHome('')
      setNotes('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl p-4 shadow-sm border space-y-3">
      <h2 className="font-bold">🌙 Daily Close</h2>

      <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
        <div className="flex justify-between">
          <span className="text-gray-500">System Bills:</span>
          <span className="font-medium">{formatCurrency(bucket.bills)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">System Coins:</span>
          <span className="font-medium">{formatCurrency(bucket.coins)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Counted Bills (₱)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={countedBills}
            onChange={e => setCountedBills(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-base outline-none focus:ring-2 focus:ring-primary"
            placeholder="0"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Counted Coins (₱)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={countedCoins}
            onChange={e => setCountedCoins(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-base outline-none focus:ring-2 focus:ring-primary"
            placeholder="0"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Take-Home Amount (₱ bills)</label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={takeHome}
          onChange={e => setTakeHome(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-base outline-none focus:ring-2 focus:ring-primary"
          placeholder="Bills removed from store"
        />
        <p className="text-xs text-gray-400 mt-1">Coins remain in store and carry forward</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <input
          type="text"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-base outline-none focus:ring-2 focus:ring-primary"
          placeholder="Optional"
        />
      </div>

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-primary text-white font-semibold py-2.5 rounded-lg disabled:opacity-50"
      >
        {saving ? 'Closing…' : 'Close Day'}
      </button>
    </form>
  )
}
