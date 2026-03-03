import { useState, useEffect } from 'react'
import type { Product } from '../types'
import { fetchProducts, createProduct, updateProduct } from '../lib/api'
import { formatCurrency } from '../lib/utils'

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    loadProducts()
  }, [])

  const loadProducts = async () => {
    try {
      setProducts(await fetchProducts())
    } catch {
      setError('Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (data: ProductFormData) => {
    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, data)
      } else {
        await createProduct(data as Omit<Product, 'id' | 'created_at' | 'updated_at'>)
      }
      setShowForm(false)
      setEditingProduct(null)
      await loadProducts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save product')
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Loading…</div>

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Products</h1>
        <button
          onClick={() => { setEditingProduct(null); setShowForm(true) }}
          className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          + Add Product
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3">{error}</div>}

      {showForm && (
        <ProductForm
          product={editingProduct}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditingProduct(null) }}
        />
      )}

      <div className="space-y-2">
        {products.map(product => (
          <div key={product.id} className="bg-white rounded-xl p-3 shadow-sm border">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold flex items-center gap-1">
                  {product.is_favorite && <span>⭐</span>}
                  {product.name}
                  <span className="text-xs font-normal text-gray-400 ml-1">
                    ({product.stock_type}{!product.track_inventory ? ', untracked' : ''})
                  </span>
                </h3>
                <p className="text-sm text-gray-500">
                  {product.track_inventory
                    ? <>Stock: {product.stock_on_hand}{product.stock_type === 'weight' ? 'kg' : 'pcs'}{' · '}</>
                    : <><span className="text-blue-500">∞ Unlimited</span>{' · '}</>
                  }
                  Price: {formatCurrency(product.price_per_unit)}{product.stock_type === 'weight' ? '/kg' : '/pc'}
                </p>
                {product.stock_type === 'weight' && product.sack_size_kg && (
                  <p className="text-xs text-gray-400">
                    Sack: {product.sack_size_kg}kg
                    {product.sack_price ? ` @ ${formatCurrency(product.sack_price)}` : ' (auto-priced)'}
                  </p>
                )}
              </div>
              <button
                onClick={() => { setEditingProduct(product); setShowForm(true) }}
                className="text-sm text-primary"
              >
                Edit
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

interface ProductFormData {
  name: string
  stock_type: 'piece' | 'weight'
  track_inventory: boolean
  stock_on_hand: number
  price_per_unit: number
  price_per_half_kg: number | null
  sack_size_kg: number | null
  sack_price: number | null
  low_stock_threshold: number
  cost_per_unit: number | null
  category: string | null
  is_favorite: boolean
}

function ProductForm({
  product,
  onSave,
  onCancel,
}: {
  product: Product | null
  onSave: (data: ProductFormData) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState<ProductFormData>({
    name: product?.name ?? '',
    stock_type: product?.stock_type ?? 'piece',
    track_inventory: product?.track_inventory ?? true,
    stock_on_hand: product?.stock_on_hand ?? 0,
    price_per_unit: product?.price_per_unit ?? 0,
    price_per_half_kg: product?.price_per_half_kg ?? null,
    sack_size_kg: product?.sack_size_kg ?? null,
    sack_price: product?.sack_price ?? null,
    low_stock_threshold: product?.low_stock_threshold ?? 5,
    cost_per_unit: product?.cost_per_unit ?? null,
    category: product?.category ?? null,
    is_favorite: product?.is_favorite ?? false,
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave(form)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl p-4 shadow-sm border space-y-3">
      <h2 className="font-bold">{product ? 'Edit Product' : 'New Product'}</h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
        <input
          type="text"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          className="w-full border rounded-lg px-3 py-2 text-base outline-none focus:ring-2 focus:ring-primary"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Stock Type</label>
        <select
          value={form.stock_type}
          onChange={e => setForm(f => ({ ...f, stock_type: e.target.value as 'piece' | 'weight' }))}
          className="w-full border rounded-lg px-3 py-2 text-base"
        >
          <option value="piece">Piece (counted)</option>
          <option value="weight">Weight (kg)</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Price per {form.stock_type === 'weight' ? 'kg' : 'piece'} (₱)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.price_per_unit}
            onChange={e => setForm(f => ({ ...f, price_per_unit: Number(e.target.value) }))}
            className="w-full border rounded-lg px-3 py-2 text-base outline-none focus:ring-2 focus:ring-primary"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Current Stock</label>
          <input
            type="number"
            step={form.stock_type === 'weight' ? '0.01' : '1'}
            min="0"
            value={form.stock_on_hand}
            onChange={e => setForm(f => ({ ...f, stock_on_hand: Number(e.target.value) }))}
            className="w-full border rounded-lg px-3 py-2 text-base outline-none focus:ring-2 focus:ring-primary"
            required
          />
        </div>
      </div>

      {form.stock_type === 'weight' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Price per 0.5kg (₱)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.price_per_half_kg ?? ''}
              onChange={e => setForm(f => ({ ...f, price_per_half_kg: e.target.value ? Number(e.target.value) : null }))}
              className="w-full border rounded-lg px-3 py-2 text-base outline-none focus:ring-2 focus:ring-primary"
              placeholder="Auto from per-kg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sack Size (kg)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={form.sack_size_kg ?? ''}
              onChange={e => setForm(f => ({ ...f, sack_size_kg: e.target.value ? Number(e.target.value) : null }))}
              className="w-full border rounded-lg px-3 py-2 text-base outline-none focus:ring-2 focus:ring-primary"
              placeholder="e.g. 25"
            />
          </div>
        </div>
      )}

      {form.stock_type === 'weight' && form.sack_size_kg && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sack Price (₱)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.sack_price ?? ''}
            onChange={e => setForm(f => ({ ...f, sack_price: e.target.value ? Number(e.target.value) : null }))}
            className="w-full border rounded-lg px-3 py-2 text-base outline-none focus:ring-2 focus:ring-primary"
            placeholder={`Auto: ${formatCurrency(form.price_per_unit * (form.sack_size_kg ?? 0))}`}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Low Stock Threshold</label>
          <input
            type="number"
            step={form.stock_type === 'weight' ? '0.1' : '1'}
            min="0"
            value={form.low_stock_threshold}
            onChange={e => setForm(f => ({ ...f, low_stock_threshold: Number(e.target.value) }))}
            className="w-full border rounded-lg px-3 py-2 text-base outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cost per Unit (₱)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.cost_per_unit ?? ''}
            onChange={e => setForm(f => ({ ...f, cost_per_unit: e.target.value ? Number(e.target.value) : null }))}
            className="w-full border rounded-lg px-3 py-2 text-base outline-none focus:ring-2 focus:ring-primary"
            placeholder="Optional"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <input
            type="text"
            value={form.category ?? ''}
            onChange={e => setForm(f => ({ ...f, category: e.target.value || null }))}
            className="w-full border rounded-lg px-3 py-2 text-base outline-none focus:ring-2 focus:ring-primary"
            placeholder="e.g. Dog Food"
          />
        </div>
        <div className="flex flex-col gap-2 justify-end pb-1">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_favorite}
              onChange={e => setForm(f => ({ ...f, is_favorite: e.target.checked }))}
              className="w-5 h-5 rounded"
            />
            ⭐ Favorite
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.track_inventory}
              onChange={e => setForm(f => ({ ...f, track_inventory: e.target.checked }))}
              className="w-5 h-5 rounded"
            />
            📦 Track stock
          </label>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 bg-primary text-white font-semibold py-2.5 rounded-lg disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2.5 border rounded-lg text-gray-600"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
