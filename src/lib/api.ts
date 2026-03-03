import { supabase } from './supabase'
import type { Product, Sale, SaleItem, InventoryMovement, CashBucket, CashMovement, DailyClose, Category } from '../types'

// ─── App Settings ─────────────────────────────────────────────────────────────

export async function fetchInventoryEnabled(): Promise<boolean> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('inventory_enabled')
    .single()
  if (error) throw error
  return data.inventory_enabled
}

export async function updateInventoryEnabled(enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ id: true, inventory_enabled: enabled, updated_at: new Date().toISOString() })
  if (error) throw error
}

// ─── Categories ──────────────────────────────────────────────────────────────

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function createCategory(category: Omit<Category, 'id' | 'created_at'>): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .insert(category)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCategory(id: string, updates: Partial<Omit<Category, 'id' | 'created_at'>>): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ─── Products ────────────────────────────────────────────────────────────────

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function fetchProduct(id: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createProduct(product: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .insert(product)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── Sales ───────────────────────────────────────────────────────────────────

export async function createSale(
  items: Omit<SaleItem, 'id' | 'sale_id'>[],
  total: number,
  paymentMethod: Sale['payment_method'],
  notes: string | null
): Promise<Sale> {
  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .insert({ total, payment_method: paymentMethod, notes })
    .select()
    .single()
  if (saleError) throw saleError

  const saleItems = items.map(item => ({
    ...item,
    sale_id: sale.id,
  }))

  const { error: itemsError } = await supabase
    .from('sale_items')
    .insert(saleItems)
  if (itemsError) throw itemsError

  return { ...sale, items: saleItems as SaleItem[] }
}

export async function fetchSales(startDate?: string, endDate?: string): Promise<Sale[]> {
  let query = supabase
    .from('sales')
    .select('*, sale_items(*)')
    .order('created_at', { ascending: false })

  if (startDate) query = query.gte('created_at', startDate)
  if (endDate) query = query.lte('created_at', endDate)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(s => ({ ...s, items: s.sale_items }))
}

// ─── Inventory Movements ─────────────────────────────────────────────────────

export async function createInventoryMovement(
  movement: Omit<InventoryMovement, 'id' | 'created_at' | 'user_id'>
): Promise<InventoryMovement> {
  const { data, error } = await supabase
    .from('inventory_movements')
    .insert(movement)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function fetchInventoryMovements(productId?: string): Promise<InventoryMovement[]> {
  let query = supabase
    .from('inventory_movements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  if (productId) query = query.eq('product_id', productId)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function receiveStock(
  productId: string,
  quantity: number,
  notes?: string
): Promise<void> {
  const product = await fetchProduct(productId)
  if (!product) throw new Error('Product not found')

  await updateProduct(productId, {
    stock_on_hand: product.stock_on_hand + quantity,
  })

  await createInventoryMovement({
    product_id: productId,
    type: 'receive',
    qty_delta: quantity,
    notes: notes ?? null,
  })
}

export async function adjustStock(
  productId: string,
  actualCount: number,
  reason?: string
): Promise<{ variance: number }> {
  const product = await fetchProduct(productId)
  if (!product) throw new Error('Product not found')

  const variance = actualCount - product.stock_on_hand

  await updateProduct(productId, { stock_on_hand: actualCount })

  await createInventoryMovement({
    product_id: productId,
    type: 'count',
    qty_delta: variance,
    notes: reason ?? `Physical count reconciliation (variance: ${variance})`,
  })

  return { variance }
}

// ─── Cash ────────────────────────────────────────────────────────────────────

export async function fetchCashBucket(): Promise<CashBucket | null> {
  const { data, error } = await supabase
    .from('cash_buckets')
    .select('*')
    .limit(1)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data
}

export async function updateCashBucket(bills: number, coins: number): Promise<CashBucket> {
  const existing = await fetchCashBucket()
  if (existing) {
    const { data, error } = await supabase
      .from('cash_buckets')
      .update({ bills, coins, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) throw error
    return data
  }

  const { data, error } = await supabase
    .from('cash_buckets')
    .insert({ bills, coins })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function createCashMovement(
  movement: Omit<CashMovement, 'id' | 'created_at' | 'user_id'>
): Promise<CashMovement> {
  const { data, error } = await supabase
    .from('cash_movements')
    .insert(movement)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function fetchCashMovements(limit = 50): Promise<CashMovement[]> {
  const { data, error } = await supabase
    .from('cash_movements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function recordExpense(
  amount: number,
  fromBucket: 'bills' | 'coins',
  category?: string,
  notes?: string
): Promise<void> {
  const bucket = await fetchCashBucket()
  if (!bucket) throw new Error('Cash bucket not initialized')

  const newBills = fromBucket === 'bills' ? bucket.bills - amount : bucket.bills
  const newCoins = fromBucket === 'coins' ? bucket.coins - amount : bucket.coins

  await updateCashBucket(newBills, newCoins)
  await createCashMovement({
    type: 'expense',
    amount,
    from_bucket: fromBucket,
    to_bucket: null,
    category: category ?? null,
    notes: notes ?? null,
  })
}

export async function recordBillToCoinConversion(amount: number, notes?: string): Promise<void> {
  const bucket = await fetchCashBucket()
  if (!bucket) throw new Error('Cash bucket not initialized')

  await updateCashBucket(bucket.bills - amount, bucket.coins + amount)
  await createCashMovement({
    type: 'conversion',
    amount,
    from_bucket: 'bills',
    to_bucket: 'coins',
    category: null,
    notes: notes ?? 'Bill to coin conversion',
  })
}

export async function recordTakeHome(amount: number, notes?: string): Promise<void> {
  const bucket = await fetchCashBucket()
  if (!bucket) throw new Error('Cash bucket not initialized')

  await updateCashBucket(bucket.bills - amount, bucket.coins)
  await createCashMovement({
    type: 'take_home',
    amount,
    from_bucket: 'bills',
    to_bucket: null,
    category: null,
    notes: notes ?? 'Bills taken home',
  })
}

// ─── Daily Close ─────────────────────────────────────────────────────────────

export async function createDailyClose(
  close: Omit<DailyClose, 'id' | 'created_at' | 'user_id'>
): Promise<DailyClose> {
  const { data, error } = await supabase
    .from('daily_closes')
    .insert(close)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function fetchDailyCloses(): Promise<DailyClose[]> {
  const { data, error } = await supabase
    .from('daily_closes')
    .select('*')
    .order('date', { ascending: false })
    .limit(30)
  if (error) throw error
  return data ?? []
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export async function fetchDailySalesTotal(date: string): Promise<number> {
  const startOfDay = `${date}T00:00:00`
  const endOfDay = `${date}T23:59:59`

  const { data, error } = await supabase
    .from('sales')
    .select('total')
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay)

  if (error) throw error
  return (data ?? []).reduce((sum, s) => sum + s.total, 0)
}
