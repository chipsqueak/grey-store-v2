/**
 * ProductVariant type
 * Represents a named size/weight variant for a product.
 * - Piece products: use for S/M/L sizes (weight_kg is null; stock deduction is 1 piece)
 * - Weight products: use for fractional amounts, e.g. 1/4 sack (weight_kg = kg to deduct)
 */
export interface ProductVariant {
  id: string
  product_id: string
  name: string           // e.g. "Small", "1/4 Sack"
  price: number          // selling price for this variant
  cost: number | null    // optional cost
  weight_kg: number | null  // kg deducted per unit (weight products only)
  sort_order: number
  created_at: string
}

/**
 * Category type for product categorization
 * Supports label, emoji icon, and Tailwind color class
 */
export interface Category {
  id: string;
  name: string;
  icon: string;   // emoji, e.g. "🐾"
  color: string;  // Tailwind classes, e.g. "bg-blue-100 text-blue-700"
  created_at: string;
}

/**
 * Product type for Grey Store POS application
 * Represents an item that can be sold in the store
 */
export interface Product {
  id: string;
  name: string;
  stock_type: 'piece' | 'weight';
  track_inventory: boolean;
  stock_on_hand: number;
  price_per_unit: number;
  price_per_half_kg: number | null;
  sack_size_kg: number | null;
  sack_price: number | null;
  low_stock_threshold: number;
  cost_per_unit: number | null;
  category: string | null;
  category_ids: string[];
  is_favorite: boolean;
  variants: ProductVariant[];
  created_at: string;
  updated_at: string;
}

/**
 * CartItem type
 * Represents a product added to the shopping cart
 */
export interface CartItem {
  product: Product;
  quantity: number;
  unit: 'piece' | '0.5kg' | '1kg' | 'sack' | 'custom' | 'variant';
  line_total: number;
  variant?: ProductVariant;  // populated when unit === 'variant'
}

/**
 * SaleItem type
 * Represents an individual item in a completed sale
 */
export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total: number;
}

/**
 * Sale type
 * Represents a completed transaction/sale
 */
export interface Sale {
  id: string;
  items: SaleItem[];
  total: number;
  payment_method: 'cash' | 'gcash' | 'bpi';
  notes: string | null;
  created_at: string;
  user_id: string;
}

/**
 * InventoryMovement type
 * Represents a change in inventory for a product
 */
export interface InventoryMovement {
  id: string;
  product_id: string;
  type: 'sale' | 'receive' | 'adjust' | 'count';
  qty_delta: number;
  notes: string | null;
  user_id: string;
  created_at: string;
}

/**
 * CashBucket type
 * Represents the separation of cash into bills and coins
 */
export interface CashBucket {
  id: string;
  bills: number;
  coins: number;
  updated_at: string;
}

/**
 * CashMovement type
 * Represents a transaction involving cash movement between buckets
 */
export interface CashMovement {
  id: string;
  type: 'sale' | 'expense' | 'conversion' | 'take_home' | 'adjustment';
  amount: number;
  from_bucket: 'bills' | 'coins' | null;
  to_bucket: 'bills' | 'coins' | null;
  category: string | null;
  notes: string | null;
  user_id: string;
  created_at: string;
}

/**
 * DailyClose type
 * Represents the end-of-day reconciliation of cash and inventory
 */
export interface DailyClose {
  id: string;
  date: string;
  counted_bills: number;
  counted_coins: number;
  take_home_amount: number;
  coins_carried_forward: number;
  notes: string | null;
  user_id: string;
  created_at: string;
}

/**
 * StockAlert type
 * Represents an alert for low or out-of-stock products
 */
export interface StockAlert {
  product: Product;
  alert_type: 'low' | 'out';
}
