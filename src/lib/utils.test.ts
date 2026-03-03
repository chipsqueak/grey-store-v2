import { describe, it, expect } from 'vitest'
import type { Product, ProductVariant } from '../types'
import {
  calculateLineTotal,
  calculateStockDeduction,
  hasEnoughStock,
  getUnitLabel,
  formatCurrency,
  formatWeight,
  fuzzyMatch,
} from './utils'

const weightProduct: Product = {
  id: '1',
  name: 'Dog Food Premium',
  stock_type: 'weight',
  track_inventory: true,
  stock_on_hand: 25,
  price_per_unit: 100, // ₱100/kg
  price_per_half_kg: 55, // ₱55 per 0.5kg
  sack_size_kg: 25,
  sack_price: 2400, // ₱2400 per sack
  low_stock_threshold: 3,
  cost_per_unit: 80,
  category: 'Dog Food',
  category_ids: [],
  variants: [],
  is_favorite: true,
  created_at: '',
  updated_at: '',
}

const pieceProduct: Product = {
  id: '2',
  name: 'Canned Tuna',
  stock_type: 'piece',
  track_inventory: true,
  stock_on_hand: 20,
  price_per_unit: 45,
  price_per_half_kg: null,
  sack_size_kg: null,
  sack_price: null,
  low_stock_threshold: 5,
  cost_per_unit: 30,
  category: 'Canned Goods',
  category_ids: [],
  variants: [],
  is_favorite: false,
  created_at: '',
  updated_at: '',
}

const quarterSackVariant: ProductVariant = {
  id: 'v1',
  product_id: '1',
  name: '1/4 Sack',
  price: 625, // 2400 / 4 = 600, but user can override
  cost: 500,
  weight_kg: 6.25, // 25 * 0.25
  sort_order: 0,
  created_at: '',
}

const sizeSmallVariant: ProductVariant = {
  id: 'v2',
  product_id: '2',
  name: 'Small',
  price: 35,
  cost: 20,
  weight_kg: null,
  sort_order: 0,
  created_at: '',
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

  it('calculates variant total using variant price', () => {
    expect(calculateLineTotal(weightProduct, 'variant', 2, quarterSackVariant)).toBe(1250)
  })

  it('calculates piece variant total using variant price', () => {
    expect(calculateLineTotal(pieceProduct, 'variant', 3, sizeSmallVariant)).toBe(105)
  })

  it('calculates variant total falling back to price_per_unit when no variant provided', () => {
    expect(calculateLineTotal(weightProduct, 'variant', 1)).toBe(100)
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

  it('deducts weight variant by weight_kg', () => {
    expect(calculateStockDeduction('variant', 2, weightProduct, quarterSackVariant)).toBe(12.5)
  })

  it('deducts piece variant as 1 piece per unit', () => {
    expect(calculateStockDeduction('variant', 3, pieceProduct, sizeSmallVariant)).toBe(3)
  })

  it('deducts weight variant falling back to 1kg when no variant provided', () => {
    expect(calculateStockDeduction('variant', 2, weightProduct)).toBe(2)
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

  it('always returns true when track_inventory is false', () => {
    const untracked = { ...pieceProduct, track_inventory: false, stock_on_hand: 0 }
    expect(hasEnoughStock(untracked, 'piece', 999)).toBe(true)
  })

  it('checks stock for weight variant using weight_kg', () => {
    expect(hasEnoughStock(weightProduct, 'variant', 3, quarterSackVariant)).toBe(true) // 3 * 6.25 = 18.75 <= 25
    expect(hasEnoughStock(weightProduct, 'variant', 4, quarterSackVariant)).toBe(true) // 4 * 6.25 = 25 == 25
    expect(hasEnoughStock(weightProduct, 'variant', 5, quarterSackVariant)).toBe(false) // 5 * 6.25 = 31.25 > 25
  })

  it('checks stock for piece variant as 1 piece per unit', () => {
    expect(hasEnoughStock(pieceProduct, 'variant', 20, sizeSmallVariant)).toBe(true)
    expect(hasEnoughStock(pieceProduct, 'variant', 21, sizeSmallVariant)).toBe(false)
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

  it('returns variant name for variant unit', () => {
    expect(getUnitLabel('variant', quarterSackVariant)).toBe('1/4 Sack')
    expect(getUnitLabel('variant', sizeSmallVariant)).toBe('Small')
  })

  it('returns fallback for variant unit without variant object', () => {
    expect(getUnitLabel('variant')).toBe('variant')
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

describe('fuzzyMatch', () => {
  it('returns true for empty query', () => {
    expect(fuzzyMatch('Canned Tuna', '')).toBe(true)
    expect(fuzzyMatch('Canned Tuna', '   ')).toBe(true)
  })

  it('matches exact substring', () => {
    expect(fuzzyMatch('Canned Tuna', 'tuna')).toBe(true)
    expect(fuzzyMatch('Dog Food Premium', 'dog food')).toBe(true)
  })

  it('matches scrambled word letters (anagram)', () => {
    expect(fuzzyMatch('Dog Food', 'dgo')).toBe(true)   // dgo = dog scrambled
    expect(fuzzyMatch('Canned Tuna', 'unat')).toBe(true) // unat = tuna scrambled
  })

  it('matches word order scrambled (rearranged words)', () => {
    expect(fuzzyMatch('Canned Tuna', 'tuna canned')).toBe(true)
    expect(fuzzyMatch('Dog Food Premium', 'premium dog')).toBe(true)
  })

  it('matches via subsequence (characters in order)', () => {
    expect(fuzzyMatch('Dog Food', 'df')).toBe(true)  // d...f in "dog food"
    expect(fuzzyMatch('Canned Tuna', 'ctn')).toBe(true) // c...t...n
  })

  it('returns false for completely unrelated query', () => {
    expect(fuzzyMatch('Canned Tuna', 'xyz')).toBe(false)
    expect(fuzzyMatch('Dog Food', 'qqq')).toBe(false)
  })
})

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

  it('always returns true when track_inventory is false', () => {
    const untracked = { ...pieceProduct, track_inventory: false, stock_on_hand: 0 }
    expect(hasEnoughStock(untracked, 'piece', 999)).toBe(true)
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

describe('fuzzyMatch', () => {
  it('returns true for empty query', () => {
    expect(fuzzyMatch('Canned Tuna', '')).toBe(true)
    expect(fuzzyMatch('Canned Tuna', '   ')).toBe(true)
  })

  it('matches exact substring', () => {
    expect(fuzzyMatch('Canned Tuna', 'tuna')).toBe(true)
    expect(fuzzyMatch('Dog Food Premium', 'dog food')).toBe(true)
  })

  it('matches scrambled word letters (anagram)', () => {
    expect(fuzzyMatch('Dog Food', 'dgo')).toBe(true)   // dgo = dog scrambled
    expect(fuzzyMatch('Canned Tuna', 'unat')).toBe(true) // unat = tuna scrambled
  })

  it('matches word order scrambled (rearranged words)', () => {
    expect(fuzzyMatch('Canned Tuna', 'tuna canned')).toBe(true)
    expect(fuzzyMatch('Dog Food Premium', 'premium dog')).toBe(true)
  })

  it('matches via subsequence (characters in order)', () => {
    expect(fuzzyMatch('Dog Food', 'df')).toBe(true)  // d...f in "dog food"
    expect(fuzzyMatch('Canned Tuna', 'ctn')).toBe(true) // c...t...n
  })

  it('returns false for completely unrelated query', () => {
    expect(fuzzyMatch('Canned Tuna', 'xyz')).toBe(false)
    expect(fuzzyMatch('Dog Food', 'qqq')).toBe(false)
  })
})
