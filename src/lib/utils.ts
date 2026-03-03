import type { Product, CartItem } from '../types'

export function calculateLineTotal(product: Product, unit: CartItem['unit'], quantity: number): number {
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
    default:
      return 0
  }
}

export function calculateStockDeduction(unit: CartItem['unit'], quantity: number, product: Product): number {
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
    default:
      return 0
  }
}

export function hasEnoughStock(product: Product, unit: CartItem['unit'], quantity: number): boolean {
  const deduction = calculateStockDeduction(unit, quantity, product)
  return product.stock_on_hand >= deduction
}

export function getUnitLabel(unit: CartItem['unit']): string {
  switch (unit) {
    case 'piece': return 'pc'
    case '0.5kg': return '0.5kg'
    case '1kg': return '1kg'
    case 'sack': return 'sack'
    case 'custom': return 'kg'
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
