import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import type { Product, CartItem } from '../types'
import { fetchProducts } from '../lib/api'
import { calculateLineTotal, calculateStockDeduction, fuzzyMatch, formatCurrency, getUnitLabel } from '../lib/utils'

export default function POSPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const navigate = useNavigate()
  const location = useLocation()

  const loadProducts = useCallback(async () => {
    try {
      const data = await fetchProducts()
      setProducts(data)
    } catch {
      setError('Failed to load products')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  // Show success message when returning from checkout
  useEffect(() => {
    const state = location.state as { successMessage?: string } | null
    if (state?.successMessage) {
      setSuccess(state.successMessage)
      setCart([])
      // Clear location state so it doesn't re-show on refresh
      navigate('/', { replace: true, state: {} })
      loadProducts()
      const t = setTimeout(() => setSuccess(''), 3000)
      return () => clearTimeout(t)
    }
  }, [location.state, navigate, loadProducts])

  const filteredProducts = products.filter(p =>
    fuzzyMatch(p.name, search) ||
    (p.category ? fuzzyMatch(p.category, search) : false)
  )

  const favorites = products.filter(p => p.is_favorite)

  /** Returns the total stock deduction already in the cart for the given product */
  const getCartDeduction = useCallback((productId: string): number =>
    cart
      .filter(item => item.product.id === productId)
      .reduce((sum, item) => sum + calculateStockDeduction(item.unit, item.quantity, item.product), 0),
    [cart]
  )

  const addToCart = (product: Product, unit: CartItem['unit']) => {
    setCart(prev => {
      // Compute total cart deduction for this product (across all units)
      const existingDeduction = prev
        .filter(item => item.product.id === product.id)
        .reduce((sum, item) => sum + calculateStockDeduction(item.unit, item.quantity, item.product), 0)
      const newDeduction = calculateStockDeduction(unit, 1, product)

      if (product.track_inventory && product.stock_on_hand < existingDeduction + newDeduction) {
        setError(`Insufficient stock for ${product.name}. Available: ${product.stock_on_hand - existingDeduction} ${product.stock_type === 'weight' ? 'kg' : 'pcs'}`)
        setTimeout(() => setError(''), 3000)
        return prev
      }

      const existing = prev.find(item => item.product.id === product.id && item.unit === unit)
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id && item.unit === unit
            ? { ...item, quantity: item.quantity + 1, line_total: calculateLineTotal(product, unit, item.quantity + 1) }
            : item
        )
      }
      return [...prev, {
        product,
        quantity: 1,
        unit,
        line_total: calculateLineTotal(product, unit, 1),
      }]
    })
    setError('')
  }

  const updateCartQuantity = (index: number, qty: number) => {
    if (qty <= 0) {
      setCart(prev => prev.filter((_, i) => i !== index))
      return
    }
    setCart(prev => prev.map((item, i) => {
      if (i !== index) return item
      if (item.product.track_inventory) {
        // Total cart deduction for this product excluding the current item
        const otherDeduction = prev
          .filter((other, oi) => oi !== index && other.product.id === item.product.id)
          .reduce((sum, other) => sum + calculateStockDeduction(other.unit, other.quantity, other.product), 0)
        const newDeduction = calculateStockDeduction(item.unit, qty, item.product)
        if (item.product.stock_on_hand < otherDeduction + newDeduction) {
          setError(`Insufficient stock for ${item.product.name}`)
          setTimeout(() => setError(''), 3000)
          return item
        }
      }
      return { ...item, quantity: qty, line_total: calculateLineTotal(item.product, item.unit, qty) }
    }))
  }

  const removeFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index))
  }

  const cartTotal = cart.reduce((sum, item) => sum + item.line_total, 0)

  const handleCheckout = () => {
    if (cart.length === 0) return
    navigate('/checkout', { state: { cart, cartTotal } })
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">Loading products…</div>
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-bold">Point of Sale</h1>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3">{error}</div>
      )}
      {success && (
        <div className="bg-green-50 text-green-600 text-sm rounded-lg p-3">{success}</div>
      )}

      {/* Search */}
      <div className="relative">
        <input
          type="search"
          placeholder="Search products…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full border rounded-lg px-3 py-2.5 pr-11 text-base focus:ring-2 focus:ring-primary focus:border-primary outline-none"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 hover:bg-gray-300 text-gray-600 transition"
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {/* Favorites quick access */}
      {!search && favorites.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 mb-2">⭐ Favorites</h2>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {favorites.map(p => (
              <ProductQuickButton key={p.id} product={p} cartDeduction={getCartDeduction(p.id)} onAdd={addToCart} />
            ))}
          </div>
        </div>
      )}

      {/* Product list */}
      <div className="space-y-2">
        {filteredProducts.map(product => (
          <ProductCard key={product.id} product={product} cartDeduction={getCartDeduction(product.id)} onAdd={addToCart} />
        ))}
        {filteredProducts.length === 0 && (
          <p className="text-center text-gray-400 py-8">No products found</p>
        )}
      </div>

      {/* Cart */}
      {cart.length > 0 && (
        <div className="fixed bottom-16 left-0 right-0 bg-white border-t shadow-lg p-4 safe-area-bottom z-10">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold">Cart ({cart.length})</h2>
              <span className="font-bold text-lg">{formatCurrency(cartTotal)}</span>
            </div>

            <div className="max-h-40 overflow-y-auto space-y-2 mb-3">
              {cart.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium truncate">{item.product.name}</span>
                    <span className="text-gray-500 ml-1">({getUnitLabel(item.unit)})</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => updateCartQuantity(i, item.quantity - 1)}
                      className="w-7 h-7 rounded-full bg-gray-100 text-base font-bold"
                    >−</button>
                    <span className="w-6 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateCartQuantity(i, item.quantity + 1)}
                      className="w-7 h-7 rounded-full bg-gray-100 text-base font-bold"
                    >+</button>
                    <span className="w-16 text-right">{formatCurrency(item.line_total)}</span>
                    <button
                      onClick={() => removeFromCart(i)}
                      className="text-red-400 hover:text-red-600 ml-1"
                    >✕</button>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleCheckout}
              className="w-full bg-success text-white font-bold py-3 rounded-lg text-base transition"
            >
              Checkout {formatCurrency(cartTotal)}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ProductCard({ product, cartDeduction, onAdd }: {
  product: Product
  cartDeduction: number
  onAdd: (p: Product, u: CartItem['unit']) => void
}) {
  const availableStock = product.track_inventory ? product.stock_on_hand - cartDeduction : Infinity
  const isLowStock = product.track_inventory && product.stock_on_hand <= product.low_stock_threshold && product.stock_on_hand > 0
  const isOutOfStock = product.track_inventory && availableStock <= 0

  return (
    <div className={`bg-white rounded-xl p-3 shadow-sm border ${isOutOfStock ? 'opacity-50' : ''}`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="font-semibold">{product.name}</h3>
          <p className="text-sm text-gray-500">
            {product.track_inventory
              ? <>
                  Stock: {product.stock_on_hand}{product.stock_type === 'weight' ? 'kg' : 'pcs'}
                  {isLowStock && !isOutOfStock && <span className="text-warning ml-1">⚠️ Low</span>}
                  {isOutOfStock && <span className="text-danger ml-1">❌ Out</span>}
                </>
              : <span className="text-blue-500">∞ Unlimited stock</span>
            }
          </p>
        </div>
        <span className="text-sm font-medium text-gray-600">
          {formatCurrency(product.price_per_unit)}{product.stock_type === 'weight' ? '/kg' : '/pc'}
        </span>
      </div>

      <div className="flex gap-2 flex-wrap">
        {product.stock_type === 'piece' && (
          <button
            onClick={() => onAdd(product, 'piece')}
            disabled={isOutOfStock}
            className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 transition"
          >
            + 1 pc
          </button>
        )}
        {product.stock_type === 'weight' && (
          <>
            <button
              onClick={() => onAdd(product, '0.5kg')}
              disabled={product.track_inventory && availableStock < 0.5}
              className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 transition"
            >
              + 0.5kg
            </button>
            <button
              onClick={() => onAdd(product, '1kg')}
              disabled={product.track_inventory && availableStock < 1}
              className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 transition"
            >
              + 1kg
            </button>
            {product.sack_size_kg && (
              <button
                onClick={() => onAdd(product, 'sack')}
                disabled={product.track_inventory && availableStock < product.sack_size_kg}
                className="bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 transition"
              >
                + Sack ({product.sack_size_kg}kg)
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function ProductQuickButton({ product, cartDeduction, onAdd }: {
  product: Product
  cartDeduction: number
  onAdd: (p: Product, u: CartItem['unit']) => void
}) {
  const defaultUnit = product.stock_type === 'piece' ? 'piece' : '1kg' as CartItem['unit']
  const availableStock = product.track_inventory ? product.stock_on_hand - cartDeduction : Infinity
  const isDisabled = product.track_inventory && availableStock <= 0
  return (
    <button
      onClick={() => onAdd(product, defaultUnit)}
      disabled={isDisabled}
      className="shrink-0 bg-white border rounded-xl px-3 py-2 text-sm font-medium shadow-sm disabled:opacity-40"
    >
      {product.name}
    </button>
  )
}
