import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { CartItem, Sale } from '../types'
import {
  createSale,
  updateProduct,
  createInventoryMovement,
  fetchCashBucket,
  updateCashBucket,
  createCashMovement,
} from '../lib/api'
import { calculateStockDeduction, formatCurrency, getUnitLabel } from '../lib/utils'

type PaymentMethod = Sale['payment_method']

const DENOMINATIONS = [10, 20, 50, 100, 200, 500, 1000]

export default function CheckoutPage() {
  const location = useLocation()
  const navigate = useNavigate()

  const { cart, cartTotal } = (location.state ?? {}) as {
    cart: CartItem[]
    cartTotal: number
  }

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [tendered, setTendered] = useState(0)
  const [notes, setNotes] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')

  // Redirect if no cart
  if (!cart || cart.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-gray-500">No items in cart.</p>
        <button
          onClick={() => navigate('/')}
          className="bg-primary text-white px-6 py-2 rounded-lg font-medium"
        >
          Back to POS
        </button>
      </div>
    )
  }

  const change = paymentMethod === 'cash' ? Math.max(0, tendered - cartTotal) : 0
  const isUnderpaid = paymentMethod === 'cash' && tendered < cartTotal
  const canConfirm = !processing && (paymentMethod !== 'cash' || tendered >= cartTotal)

  const addDenomination = (value: number) => {
    setTendered(prev => prev + value)
  }

  const setExact = () => {
    setTendered(cartTotal)
  }

  const clearTendered = () => {
    setTendered(0)
  }

  const handleConfirm = async () => {
    if (!canConfirm) return
    setProcessing(true)
    setError('')

    try {
      // Verify stock for tracked items
      for (const item of cart) {
        if (!item.product.track_inventory) continue
        const deduction = calculateStockDeduction(item.unit, item.quantity, item.product)
        if (item.product.stock_on_hand < deduction) {
          throw new Error(`Insufficient stock for ${item.product.name}`)
        }
      }

      // Create sale record
      const saleItems = cart.map(item => ({
        product_id: item.product.id,
        product_name: item.product.name,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.line_total / item.quantity,
        line_total: item.line_total,
      }))

      await createSale(saleItems, cartTotal, paymentMethod, notes || null)

      // Deduct stock and create inventory movements (tracked products only)
      for (const item of cart) {
        if (!item.product.track_inventory) continue
        const deduction = calculateStockDeduction(item.unit, item.quantity, item.product)
        await updateProduct(item.product.id, {
          stock_on_hand: item.product.stock_on_hand - deduction,
        })
        await createInventoryMovement({
          product_id: item.product.id,
          type: 'sale',
          qty_delta: -deduction,
          notes: `Sale: ${item.quantity} ${getUnitLabel(item.unit)}`,
        })
      }

      // Update cash bucket for cash sales
      if (paymentMethod === 'cash') {
        try {
          const bucket = await fetchCashBucket()
          if (bucket) {
            await updateCashBucket(bucket.bills + cartTotal, bucket.coins)
          }
          await createCashMovement({
            type: 'sale',
            amount: cartTotal,
            from_bucket: null,
            to_bucket: 'bills',
            category: null,
            notes: `Sale of ${cart.length} item(s)`,
          })
        } catch {
          // Cash bucket may not be initialized yet, that's okay
        }
      }

      navigate('/', {
        state: { successMessage: `Sale completed: ${formatCurrency(cartTotal)}` },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed')
      setProcessing(false)
    }
  }

  return (
    <div className="max-w-md mx-auto flex flex-col gap-0">
      {/* ── Sticky summary header ───────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white border-b shadow-sm px-4 pt-3 pb-3 space-y-2">
        {/* Back + title */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-lg"
            aria-label="Back"
          >
            ‹
          </button>
          <h1 className="font-bold text-lg flex-1">Checkout</h1>
        </div>

        {/* Total */}
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-gray-500 font-medium">Total</span>
          <span className="text-3xl font-extrabold text-gray-900">{formatCurrency(cartTotal)}</span>
        </div>

        {/* Payment method selector */}
        <div className="flex gap-2">
          {(['cash', 'gcash', 'bpi'] as PaymentMethod[]).map(m => (
            <button
              key={m}
              onClick={() => { setPaymentMethod(m); if (m !== 'cash') setTendered(0) }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition ${
                paymentMethod === m
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-gray-600 border-gray-300'
              }`}
            >
              {m === 'cash' ? '💵 Cash' : m === 'gcash' ? '📱 GCash' : '🏦 BPI'}
            </button>
          ))}
        </div>

        {/* Tendered + change (cash only) */}
        {paymentMethod === 'cash' && (
          <div className="flex gap-3">
            <div className="flex-1 text-center bg-gray-50 rounded-xl py-2 px-3">
              <p className="text-xs text-gray-500 mb-0.5">Tendered</p>
              <p className={`text-2xl font-bold ${isUnderpaid ? 'text-red-500' : 'text-gray-800'}`}>
                {formatCurrency(tendered)}
              </p>
            </div>
            <div className="flex-1 text-center bg-green-50 rounded-xl py-2 px-3">
              <p className="text-xs text-gray-500 mb-0.5">Change</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(change)}</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">{error}</div>
        )}
      </div>

      {/* ── Body ────────────────────────────────────────────────────── */}
      <div className="px-4 pt-3 pb-4 space-y-4">
        {/* Denomination numpad (cash only) */}
        {paymentMethod === 'cash' && (
          <div className="space-y-2">
            <div className="grid grid-cols-4 gap-2">
              {DENOMINATIONS.map(d => (
                <button
                  key={d}
                  onClick={() => addDenomination(d)}
                  className="py-3 rounded-xl bg-gray-100 hover:bg-gray-200 font-semibold text-sm active:scale-95 transition"
                >
                  ₱{d}
                </button>
              ))}
              <button
                onClick={setExact}
                className="py-3 rounded-xl bg-blue-100 hover:bg-blue-200 text-blue-700 font-semibold text-sm active:scale-95 transition"
              >
                Exact
              </button>
            </div>
            {tendered > 0 && (
              <button
                onClick={clearTendered}
                className="w-full py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 font-medium text-sm transition"
              >
                Clear (Reset to ₱0)
              </button>
            )}
          </div>
        )}

        {/* Notes for digital payments */}
        {(paymentMethod === 'gcash' || paymentMethod === 'bpi') && (
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Reference / Notes <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. ref #12345"
              className="w-full border rounded-lg px-3 py-2.5 text-base focus:ring-2 focus:ring-primary focus:border-primary outline-none"
            />
          </div>
        )}

        {/* Cart summary */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 mb-2">Items ({cart.length})</h2>
          <div className="space-y-1.5">
            {cart.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="flex-1 truncate text-gray-700">
                  {item.product.name}
                  <span className="text-gray-400 ml-1">×{item.quantity} {getUnitLabel(item.unit)}</span>
                </span>
                <span className="font-medium ml-2 shrink-0">{formatCurrency(item.line_total)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Confirm button */}
        <button
          onClick={handleConfirm}
          disabled={!canConfirm}
          className="w-full bg-success text-white font-bold py-4 rounded-xl text-lg disabled:opacity-40 transition active:scale-95"
        >
          {processing
            ? 'Processing…'
            : paymentMethod === 'cash'
              ? isUnderpaid
                ? `Need ${formatCurrency(cartTotal - tendered)} more`
                : `Confirm Payment`
              : `Confirm ${paymentMethod.toUpperCase()} Payment`}
        </button>
      </div>
    </div>
  )
}
