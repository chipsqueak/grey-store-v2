import { describe, it, expect } from 'vitest'
import type { Product, CartItem } from '../types'
import {
  calculateLineTotal,
  calculateStockDeduction,
  hasEnoughStock,
  getUnitLabel,
  formatCurrency,
  formatWeight,
} from './utils'

const weightProduct: Product = {
  id: '1',
  name: 'Dog Food Premium',
  stock_type: 'weight',
  stock_on_hand: 25,
  price_per_unit: 100, // ₱100/kg
  price_per_half_kg: 55, // ₱55 per 0.5kg
  sack_size_kg: 25,
  sack_price: 2400, // ₱2400 per sack
  low_stock_threshold: 3,
  cost_per_unit: 80,
  category: 'Dog Food',
  is_favorite: true,
  created_at: '',
  updated_at: '',
}

const pieceProduct: Product = {
  id: '2',
  name: 'Canned Tuna',
  stock_type: 'piece',
  stock_on_hand: 20,
  price_per_unit: 45,
  price_per_half_kg: null,
  sack_size_kg: null,
  sack_price: null,
  low_stock_threshold: 5,
  cost_per_unit: 30,
  category: 'Canned Goods',
  is_favorite: false,
  created_at: '',
  updated_at: '',
}

describe('calculateLineTotal', () => {
  it('calculates piece item total', () => {
    expect(calculateLineTotal(pieceProduct, 'piece', 3)).toBe(135)
  })

  it('calculates 1kg weight item total', () => {
    expect(calculateLineTotal(weightProduct, '1kg', 2)).toBe(200)
  })

  it('calculates 0.5kg weight item total with custom price', () => {
    expect(calculateLineTotal(weightProduct, '0.5kg', 1)).toBe(55)
  })

  it('calculates 0.5kg weight item total auto-derived when no custom price', () => {
    const product = { ...weightProduct, price_per_half_kg: null }
    expect(calculateLineTotal(product, '0.5kg', 1)).toBe(50) // 100 * 0.5
  })

  it('calculates sack total with custom sack price', () => {
    expect(calculateLineTotal(weightProduct, 'sack', 1)).toBe(2400)
  })

  it('calculates sack total auto-derived when no sack price', () => {
    const product = { ...weightProduct, sack_price: null }
    expect(calculateLineTotal(product, 'sack', 1)).toBe(2500) // 100 * 25
  })
})

describe('calculateStockDeduction', () => {
  it('deducts pieces correctly', () => {
    expect(calculateStockDeduction('piece', 3, pieceProduct)).toBe(3)
  })

  it('deducts 0.5kg correctly', () => {
    expect(calculateStockDeduction('0.5kg', 2, weightProduct)).toBe(1) // 0.5 * 2
  })

  it('deducts 1kg correctly', () => {
    expect(calculateStockDeduction('1kg', 3, weightProduct)).toBe(3)
  })

  it('deducts sack correctly using sack_size_kg', () => {
    expect(calculateStockDeduction('sack', 1, weightProduct)).toBe(25)
  })
})

describe('hasEnoughStock', () => {
  it('returns true when stock is sufficient', () => {
    expect(hasEnoughStock(weightProduct, '1kg', 5)).toBe(true)
  })

  it('returns false when stock is insufficient', () => {
    expect(hasEnoughStock(weightProduct, '1kg', 30)).toBe(false)
  })

  it('returns true for exact stock match', () => {
    expect(hasEnoughStock(weightProduct, 'sack', 1)).toBe(true) // 25kg sack, 25kg stock
  })

  it('returns false when trying to buy sack with insufficient stock', () => {
    const lowStock = { ...weightProduct, stock_on_hand: 20 }
    expect(hasEnoughStock(lowStock, 'sack', 1)).toBe(false) // 25kg sack, 20kg stock
  })

  it('handles piece items correctly', () => {
    expect(hasEnoughStock(pieceProduct, 'piece', 20)).toBe(true)
    expect(hasEnoughStock(pieceProduct, 'piece', 21)).toBe(false)
  })

  it('blocks sale when stock is zero', () => {
    const empty = { ...pieceProduct, stock_on_hand: 0 }
    expect(hasEnoughStock(empty, 'piece', 1)).toBe(false)
  })
})

describe('getUnitLabel', () => {
  it('returns correct labels', () => {
    expect(getUnitLabel('piece')).toBe('pc')
    expect(getUnitLabel('0.5kg')).toBe('0.5kg')
    expect(getUnitLabel('1kg')).toBe('1kg')
    expect(getUnitLabel('sack')).toBe('sack')
    expect(getUnitLabel('custom')).toBe('kg')
  })
})

describe('formatCurrency', () => {
  it('formats with peso sign and 2 decimals', () => {
    expect(formatCurrency(100)).toBe('₱100.00')
    expect(formatCurrency(0)).toBe('₱0.00')
    expect(formatCurrency(1234.5)).toBe('₱1234.50')
  })
})

describe('formatWeight', () => {
  it('formats kg', () => {
    expect(formatWeight(5)).toBe('5kg')
    expect(formatWeight(25)).toBe('25kg')
  })

  it('formats sub-kg as grams', () => {
    expect(formatWeight(0.5)).toBe('500g')
  })
})
