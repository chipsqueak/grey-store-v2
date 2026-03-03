import type { Product, CartItem, ProductVariant } from '../types'

export function calculateLineTotal(product: Product, unit: CartItem['unit'], quantity: number, variant?: ProductVariant): number {
  switch (unit) {
    case 'piece':
      return product.price_per_unit * quantity
    case '0.5kg':
      return (product.price_per_half_kg ?? product.price_per_unit * 0.5) * quantity
    case '1kg':
      return product.price_per_unit * quantity
    case 'sack':
      return (product.sack_price ?? product.price_per_unit * (product.sack_size_kg ?? 1)) * quantity
    case 'custom':
      return product.price_per_unit * quantity
    case 'variant':
      return (variant?.price ?? product.price_per_unit) * quantity
    default:
      return 0
  }
}

export function calculateStockDeduction(unit: CartItem['unit'], quantity: number, product: Product, variant?: ProductVariant): number {
  switch (unit) {
    case 'piece':
      return quantity
    case '0.5kg':
      return 0.5 * quantity
    case '1kg':
      return 1 * quantity
    case 'sack':
      return (product.sack_size_kg ?? 1) * quantity
    case 'custom':
      return quantity
    case 'variant':
      if (product.stock_type === 'weight') {
        return (variant?.weight_kg ?? 1) * quantity
      }
      return quantity  // piece product: 1 piece per variant unit
    default:
      return 0
  }
}

export function hasEnoughStock(product: Product, unit: CartItem['unit'], quantity: number, variant?: ProductVariant): boolean {
  if (!product.track_inventory) return true
  const deduction = calculateStockDeduction(unit, quantity, product, variant)
  return product.stock_on_hand >= deduction
}

export function getUnitLabel(unit: CartItem['unit'], variant?: ProductVariant): string {
  switch (unit) {
    case 'piece': return 'pc'
    case '0.5kg': return '0.5kg'
    case '1kg': return '1kg'
    case 'sack': return 'sack'
    case 'custom': return 'kg'
    case 'variant': return variant?.name ?? 'variant'
    default: return unit
  }
}

export function formatCurrency(amount: number): string {
  return `₱${amount.toFixed(2)}`
}

export function formatWeight(kg: number): string {
  if (kg >= 1) return `${kg}kg`
  return `${(kg * 1000).toFixed(0)}g`
}

function isSubsequence(needle: string, haystack: string): boolean {
  let ni = 0
  for (let hi = 0; hi < haystack.length && ni < needle.length; hi++) {
    if (needle[ni] === haystack[hi]) ni++
  }
  return ni === needle.length
}

export function fuzzyMatch(target: string, query: string): boolean {
  if (!query.trim()) return true
  const t = target.toLowerCase()
  const q = query.toLowerCase().trim()

  // Direct substring match
  if (t.includes(q)) return true

  // Every query word must match against the target
  const queryWords = q.split(/\s+/).filter(Boolean)
  const targetWords = t.split(/\s+/).filter(Boolean)

  return queryWords.every(qw => {
    // Substring match (query word inside any target word, or vice versa)
    if (targetWords.some(tw => tw.includes(qw) || qw.includes(tw))) return true
    // Sorted characters match (scrambled letters within a word)
    if (qw.length >= 2) {
      const qSorted = [...qw].sort().join('')
      if (targetWords.some(tw => [...tw].sort().join('') === qSorted)) return true
    }
    // Subsequence match against full target (handles scrambled/partial matches)
    return isSubsequence(qw, t)
  })
}
