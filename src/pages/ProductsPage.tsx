import { useState, useEffect } from 'react'
import type { Product, Category } from '../types'
import { fetchProducts, createProduct, updateProduct, fetchCategories, createProductVariant, updateProductVariant, deleteProductVariant } from '../lib/api'
import { formatCurrency } from '../lib/utils'
import { useInventorySettings } from '../hooks/useInventorySettings'

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [error, setError] = useState('')
  const { inventoryEnabled } = useInventorySettings()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [prods, cats] = await Promise.all([fetchProducts(), fetchCategories()])
      setProducts(prods)
      setCategories(cats)
    } catch {
      setError('Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (data: ProductFormData, variants: VariantDraft[]) => {
    try {
      let productId: string
      if (editingProduct) {
        await updateProduct(editingProduct.id, data)
        productId = editingProduct.id
      } else {
        const created = await createProduct({ ...data, variants: [] } as Omit<Product, 'id' | 'created_at' | 'updated_at'>)
        productId = created.id
      }

      // Sync variants: delete removed, create/update new ones
      const existingVariants = editingProduct?.variants ?? []
      const keptIds = new Set(variants.filter(v => v.id).map(v => v.id as string))
      for (const ev of existingVariants) {
        if (!keptIds.has(ev.id)) {
          await deleteProductVariant(ev.id)
        }
      }
      for (let i = 0; i < variants.length; i++) {
        const v = variants[i]
        const payload = {
          product_id: productId,
          name: v.name,
          price: v.price,
          cost: v.cost,
          weight_kg: v.weight_kg,
          sort_order: i,
        }
        if (v.id) {
          await updateProductVariant(v.id, payload)
        } else {
          await createProductVariant(payload)
        }
      }

      setShowForm(false)
      setEditingProduct(null)
      await loadData()
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
          categories={categories}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditingProduct(null) }}
          inventoryEnabled={inventoryEnabled}
        />
      )}

      <div className="space-y-2">
        {products.map(product => (
          <div key={product.id} className="bg-white rounded-xl p-3 shadow-sm border">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold flex items-center gap-1">
                  {product.is_favorite && <span>⭐</span>}
                  {product.name}
                  <span className="text-xs font-normal text-gray-400 ml-1">
                    ({product.stock_type}{inventoryEnabled && !product.track_inventory ? ', untracked' : ''})
                  </span>
                </h3>
                <p className="text-sm text-gray-500">
                  {inventoryEnabled && (
                    product.track_inventory
                      ? <>{`Stock: ${product.stock_on_hand}${product.stock_type === 'weight' ? 'kg' : 'pcs'}`}{' · '}</>
                      : <><span className="text-blue-500">∞ Unlimited</span>{' · '}</>
                  )}
                  Price: {formatCurrency(product.price_per_unit)}{product.stock_type === 'weight' ? '/kg' : '/pc'}
                </p>
                {product.stock_type === 'weight' && product.sack_size_kg && (
                  <p className="text-xs text-gray-400">
                    Sack: {product.sack_size_kg}kg
                    {product.sack_price ? ` @ ${formatCurrency(product.sack_price)}` : ' (auto-priced)'}
                  </p>
                )}
                {product.category_ids.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {product.category_ids.map(id => {
                      const cat = categories.find(c => c.id === id)
                      if (!cat) return null
                      return (
                        <span key={id} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cat.color}`}>
                          {cat.icon} {cat.name}
                        </span>
                      )
                    })}
                  </div>
                )}
                {product.variants.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {product.variants.map(v => (
                      <span key={v.id} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                        {v.name}: {formatCurrency(v.price)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => { setEditingProduct(product); setShowForm(true) }}
                className="text-sm text-primary shrink-0 ml-2"
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
  category_ids: string[]
  is_favorite: boolean
}

// A variant draft in the form (may or may not have an id yet)
interface VariantDraft {
  id?: string
  name: string
  price: number
  cost: number | null
  weight_kg: number | null
}

const SACK_FRACTIONS = [
  { label: '1/4 Sack', value: 0.25 },
  { label: '1/2 Sack', value: 0.5 },
  { label: '3/4 Sack', value: 0.75 },
]

function ProductForm({
  product,
  categories,
  onSave,
  onCancel,
  inventoryEnabled,
}: {
  product: Product | null
  categories: Category[]
  onSave: (data: ProductFormData, variants: VariantDraft[]) => Promise<void>
  onCancel: () => void
  inventoryEnabled: boolean
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
    category_ids: product?.category_ids ?? [],
    is_favorite: product?.is_favorite ?? false,
  })
  const [variants, setVariants] = useState<VariantDraft[]>(
    product?.variants.map(v => ({ id: v.id, name: v.name, price: v.price, cost: v.cost, weight_kg: v.weight_kg })) ?? []
  )
  const [newVariant, setNewVariant] = useState<VariantDraft>({ name: '', price: 0, cost: null, weight_kg: null })
  const [saving, setSaving] = useState(false)

  const toggleCategory = (id: string) => {
    setForm(f => ({
      ...f,
      category_ids: f.category_ids.includes(id)
        ? f.category_ids.filter(c => c !== id)
        : [...f.category_ids, id],
    }))
  }

  // Auto-fill new variant price/cost/weight from sack fraction
  const applyFraction = (fraction: number) => {
    const sackKg = form.sack_size_kg ?? 0
    const basePrice = form.sack_price ?? form.price_per_unit * sackKg
    const weightKg = Math.round(sackKg * fraction * 1000) / 1000
    const price = Math.round(basePrice * fraction * 100) / 100
    const cost = form.cost_per_unit != null
      ? Math.round(form.cost_per_unit * weightKg * 100) / 100
      : null
    setNewVariant(v => ({ ...v, weight_kg: weightKg, price, cost }))
  }

  const addVariant = () => {
    if (!newVariant.name.trim()) return
    setVariants(prev => [...prev, { ...newVariant, name: newVariant.name.trim() }])
    setNewVariant({ name: '', price: 0, cost: null, weight_kg: null })
  }

  const removeVariant = (idx: number) => {
    setVariants(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave(form, variants)
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

        {inventoryEnabled && (
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
        )}
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
        {inventoryEnabled && (
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
        )}
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

      {/* Categories multi-select pills */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Categories</label>
        {categories.length === 0 ? (
          <p className="text-xs text-gray-400">No categories yet. Add them in Settings.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => {
              const selected = form.category_ids.includes(cat.id)
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => toggleCategory(cat.id)}
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border-2 transition ${
                    selected
                      ? `${cat.color} border-current`
                      : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {cat.icon} {cat.name}
                  {selected && <span className="ml-0.5">✓</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.is_favorite}
            onChange={e => setForm(f => ({ ...f, is_favorite: e.target.checked }))}
            className="w-5 h-5 rounded"
          />
          ⭐ Favorite
        </label>
        {inventoryEnabled && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.track_inventory}
              onChange={e => setForm(f => ({ ...f, track_inventory: e.target.checked }))}
              className="w-5 h-5 rounded"
            />
            📦 Track stock
          </label>
        )}
      </div>

      {/* ── Variants ─────────────────────────────────────────────────────── */}
      <div className="border-t pt-3 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">
            🏷️ Variants
            <span className="text-xs font-normal text-gray-400 ml-1">
              ({form.stock_type === 'piece' ? 'e.g. Small, Medium, Large' : 'e.g. 1/4 Sack, 1/2 Sack'})
            </span>
          </h3>
        </div>

        {/* Existing variants */}
        {variants.map((v, i) => (
          <div key={i} className="flex items-center gap-2 bg-purple-50 rounded-lg px-3 py-2 text-sm">
            <span className="font-medium flex-1">{v.name}</span>
            <span className="text-gray-500">{formatCurrency(v.price)}</span>
            {v.weight_kg != null && (
              <span className="text-gray-400 text-xs">{v.weight_kg}kg</span>
            )}
            <button
              type="button"
              onClick={() => removeVariant(i)}
              className="text-red-400 hover:text-red-600 ml-1 shrink-0"
              aria-label="Remove variant"
            >
              ✕
            </button>
          </div>
        ))}

        {/* New variant row */}
        <div className="bg-gray-50 rounded-lg p-3 space-y-2">
          <p className="text-xs font-medium text-gray-500">Add variant</p>

          {/* Quick fraction buttons for weight products with a sack */}
          {form.stock_type === 'weight' && form.sack_size_kg != null && (
            <div className="flex gap-2 flex-wrap">
              {SACK_FRACTIONS.map(f => (
                <button
                  key={f.label}
                  type="button"
                  onClick={() => {
                    applyFraction(f.value)
                    setNewVariant(v => ({ ...v, name: v.name || f.label }))
                  }}
                  className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Name (e.g. Small)"
              value={newVariant.name}
              onChange={e => setNewVariant(v => ({ ...v, name: e.target.value }))}
              className="border rounded px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
            />
            <input
              type="number"
              placeholder="Price (₱)"
              step="0.01"
              min="0"
              value={newVariant.price || ''}
              onChange={e => setNewVariant(v => ({ ...v, price: Number(e.target.value) }))}
              className="border rounded px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
            />
            <input
              type="number"
              placeholder="Cost (₱, optional)"
              step="0.01"
              min="0"
              value={newVariant.cost ?? ''}
              onChange={e => setNewVariant(v => ({ ...v, cost: e.target.value ? Number(e.target.value) : null }))}
              className="border rounded px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
            />
            {form.stock_type === 'weight' && (
              <input
                type="number"
                placeholder="Weight (kg)"
                step="0.001"
                min="0"
                value={newVariant.weight_kg ?? ''}
                onChange={e => setNewVariant(v => ({ ...v, weight_kg: e.target.value ? Number(e.target.value) : null }))}
                className="border rounded px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
              />
            )}
          </div>

          <button
            type="button"
            onClick={addVariant}
            disabled={!newVariant.name.trim() || newVariant.price <= 0}
            className="w-full text-sm bg-purple-600 text-white py-1.5 rounded disabled:opacity-40 hover:bg-purple-700 transition"
          >
            + Add Variant
          </button>
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
