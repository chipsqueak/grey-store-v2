import { useState, useEffect } from 'react'
import type { Product } from '../types'
import { fetchProducts, receiveStock, adjustStock, fetchInventoryMovements } from '../lib/api'
import type { InventoryMovement } from '../types'

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'stock' | 'receive' | 'count' | 'log'>('stock')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [prods, movs] = await Promise.all([fetchProducts(), fetchInventoryMovements()])
      setProducts(prods)
      setMovements(movs)
    } catch {
      setError('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const lowStockProducts = products.filter(p => p.stock_on_hand > 0 && p.stock_on_hand <= p.low_stock_threshold)
  const outOfStockProducts = products.filter(p => p.stock_on_hand <= 0)

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Loading…</div>

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-bold">Inventory</h1>

      {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3">{error}</div>}
      {success && <div className="bg-green-50 text-green-600 text-sm rounded-lg p-3">{success}</div>}

      {/* Alerts */}
      {(lowStockProducts.length > 0 || outOfStockProducts.length > 0) && (
        <div className="space-y-2">
          {outOfStockProducts.length > 0 && (
            <div className="bg-red-50 rounded-xl p-3 border border-red-100">
              <h3 className="text-sm font-semibold text-red-700 mb-1">❌ Out of Stock ({outOfStockProducts.length})</h3>
              <p className="text-xs text-red-600">{outOfStockProducts.map(p => p.name).join(', ')}</p>
            </div>
          )}
          {lowStockProducts.length > 0 && (
            <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
              <h3 className="text-sm font-semibold text-amber-700 mb-1">⚠️ Low Stock ({lowStockProducts.length})</h3>
              <p className="text-xs text-amber-600">{lowStockProducts.map(p => `${p.name} (${p.stock_on_hand}${p.stock_type === 'weight' ? 'kg' : 'pcs'})`).join(', ')}</p>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {(['stock', 'receive', 'count', 'log'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition ${
              tab === t ? 'bg-white shadow text-primary' : 'text-gray-500'
            }`}
          >
            {t === 'stock' ? '📦 Stock' : t === 'receive' ? '📥 Receive' : t === 'count' ? '🔢 Count' : '📋 Log'}
          </button>
        ))}
      </div>

      {tab === 'stock' && <StockList products={products} />}
      {tab === 'receive' && (
        <ReceiveForm
          products={products}
          onReceive={async (productId, qty, notes) => {
            try {
              await receiveStock(productId, qty, notes)
              setSuccess('Stock received successfully')
              setTimeout(() => setSuccess(''), 3000)
              await loadData()
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Failed to receive stock')
            }
          }}
        />
      )}
      {tab === 'count' && (
        <CountForm
          products={products}
          onCount={async (productId, actual, reason) => {
            try {
              const { variance } = await adjustStock(productId, actual, reason)
              setSuccess(`Stock adjusted. Variance: ${variance >= 0 ? '+' : ''}${variance}`)
              setTimeout(() => setSuccess(''), 3000)
              await loadData()
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Failed to adjust stock')
            }
          }}
        />
      )}
      {tab === 'log' && <MovementLog movements={movements} products={products} />}
    </div>
  )
}

function StockList({ products }: { products: Product[] }) {
  return (
    <div className="space-y-2">
      {products.map(p => {
        const isLow = p.stock_on_hand > 0 && p.stock_on_hand <= p.low_stock_threshold
        const isOut = p.stock_on_hand <= 0
        return (
          <div key={p.id} className={`bg-white rounded-xl p-3 shadow-sm border flex justify-between items-center ${isOut ? 'border-red-200' : isLow ? 'border-amber-200' : ''}`}>
            <div>
              <span className="font-medium">{p.name}</span>
              <span className="text-xs text-gray-400 ml-1">({p.stock_type})</span>
            </div>
            <span className={`font-semibold ${isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-gray-800'}`}>
              {p.stock_on_hand}{p.stock_type === 'weight' ? 'kg' : 'pcs'}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function ReceiveForm({ products, onReceive }: { products: Product[]; onReceive: (id: string, qty: number, notes?: string) => Promise<void> }) {
  const [productId, setProductId] = useState('')
  const [qty, setQty] = useState('')
  const [unit, setUnit] = useState<'units' | 'sacks'>('units')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const selectedProduct = products.find(p => p.id === productId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!productId || !qty) return
    setSaving(true)
    try {
      let actualQty = Number(qty)
      if (unit === 'sacks' && selectedProduct?.sack_size_kg) {
        actualQty = actualQty * selectedProduct.sack_size_kg
      }
      await onReceive(productId, actualQty, notes || undefined)
      setQty('')
      setNotes('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl p-4 shadow-sm border space-y-3">
      <h2 className="font-bold">Receive Stock</h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
        <select
          value={productId}
          onChange={e => setProductId(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-base"
          required
        >
          <option value="">Select product…</option>
          {products.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={qty}
            onChange={e => setQty(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-base outline-none focus:ring-2 focus:ring-primary"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
          <select
            value={unit}
            onChange={e => setUnit(e.target.value as 'units' | 'sacks')}
            className="w-full border rounded-lg px-3 py-2 text-base"
          >
            <option value="units">{selectedProduct?.stock_type === 'weight' ? 'kg' : 'pcs'}</option>
            {selectedProduct?.sack_size_kg && (
              <option value="sacks">Sacks ({selectedProduct.sack_size_kg}kg each)</option>
            )}
          </select>
        </div>
      </div>

      {unit === 'sacks' && selectedProduct?.sack_size_kg && qty && (
        <p className="text-sm text-gray-500">= {Number(qty) * selectedProduct.sack_size_kg}kg total</p>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <input
          type="text"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-base outline-none focus:ring-2 focus:ring-primary"
          placeholder="e.g. Weekly delivery from supplier"
        />
      </div>

      <button
        type="submit"
        disabled={saving || !productId || !qty}
        className="w-full bg-success text-white font-semibold py-2.5 rounded-lg disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Receive Stock'}
      </button>
    </form>
  )
}

function CountForm({ products, onCount }: { products: Product[]; onCount: (id: string, actual: number, reason?: string) => Promise<void> }) {
  const [productId, setProductId] = useState('')
  const [actual, setActual] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const selectedProduct = products.find(p => p.id === productId)
  const variance = selectedProduct && actual ? Number(actual) - selectedProduct.stock_on_hand : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!productId || actual === '') return
    setSaving(true)
    try {
      await onCount(productId, Number(actual), reason || undefined)
      setActual('')
      setReason('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl p-4 shadow-sm border space-y-3">
      <h2 className="font-bold">Physical Count</h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
        <select
          value={productId}
          onChange={e => { setProductId(e.target.value); setActual('') }}
          className="w-full border rounded-lg px-3 py-2 text-base"
          required
        >
          <option value="">Select product…</option>
          {products.map(p => (
            <option key={p.id} value={p.id}>{p.name} (system: {p.stock_on_hand}{p.stock_type === 'weight' ? 'kg' : 'pcs'})</option>
          ))}
        </select>
      </div>

      {selectedProduct && (
        <>
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <span className="text-gray-500">System stock:</span>{' '}
            <span className="font-semibold">{selectedProduct.stock_on_hand}{selectedProduct.stock_type === 'weight' ? 'kg' : 'pcs'}</span>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Actual Count</label>
            <input
              type="number"
              step={selectedProduct.stock_type === 'weight' ? '0.01' : '1'}
              min="0"
              value={actual}
              onChange={e => setActual(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-base outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          {variance !== null && (
            <div className={`text-sm font-medium ${variance === 0 ? 'text-green-600' : variance > 0 ? 'text-blue-600' : 'text-red-600'}`}>
              Variance: {variance >= 0 ? '+' : ''}{variance}{selectedProduct.stock_type === 'weight' ? 'kg' : 'pcs'}
              {variance === 0 && ' ✓ Matches'}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-base outline-none focus:ring-2 focus:ring-primary"
              placeholder="e.g. Physical count reconciliation"
            />
          </div>
        </>
      )}

      <button
        type="submit"
        disabled={saving || !productId || actual === ''}
        className="w-full bg-primary text-white font-semibold py-2.5 rounded-lg disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save Count'}
      </button>
    </form>
  )
}

function MovementLog({ movements, products }: { movements: InventoryMovement[]; products: Product[] }) {
  const productMap = new Map(products.map(p => [p.id, p.name]))

  const typeLabel = (type: InventoryMovement['type']) => {
    switch (type) {
      case 'sale': return '🛒 Sale'
      case 'receive': return '📥 Receive'
      case 'adjust': return '🔧 Adjust'
      case 'count': return '🔢 Count'
    }
  }

  return (
    <div className="space-y-2">
      {movements.length === 0 && (
        <p className="text-center text-gray-400 py-8">No movements yet</p>
      )}
      {movements.map(m => (
        <div key={m.id} className="bg-white rounded-xl p-3 shadow-sm border text-sm">
          <div className="flex justify-between">
            <span className="font-medium">{productMap.get(m.product_id) ?? 'Unknown'}</span>
            <span className={`font-semibold ${m.qty_delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {m.qty_delta >= 0 ? '+' : ''}{m.qty_delta}
            </span>
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>{typeLabel(m.type)}</span>
            <span>{new Date(m.created_at).toLocaleString()}</span>
          </div>
          {m.notes && <p className="text-xs text-gray-500 mt-1">{m.notes}</p>}
        </div>
      ))}
    </div>
  )
}
