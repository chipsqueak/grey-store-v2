import { useState, useEffect } from 'react'
import type { Category } from '../types'
import { fetchCategories, createCategory, updateCategory, deleteCategory } from '../lib/api'

const COLOR_OPTIONS = [
  { label: 'Gray',   value: 'bg-gray-100 text-gray-700',     swatch: '#6b7280' },
  { label: 'Red',    value: 'bg-red-100 text-red-700',       swatch: '#b91c1c' },
  { label: 'Orange', value: 'bg-orange-100 text-orange-700', swatch: '#c2410c' },
  { label: 'Yellow', value: 'bg-yellow-100 text-yellow-800', swatch: '#92400e' },
  { label: 'Green',  value: 'bg-green-100 text-green-700',   swatch: '#15803d' },
  { label: 'Teal',   value: 'bg-teal-100 text-teal-700',     swatch: '#0f766e' },
  { label: 'Blue',   value: 'bg-blue-100 text-blue-700',     swatch: '#1d4ed8' },
  { label: 'Purple', value: 'bg-purple-100 text-purple-700', swatch: '#7e22ce' },
  { label: 'Pink',   value: 'bg-pink-100 text-pink-700',     swatch: '#be185d' },
]

interface CategoryFormData {
  name: string
  icon: string
  color: string
}

export default function SettingsPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadCategories()
  }, [])

  const loadCategories = async () => {
    try {
      setCategories(await fetchCategories())
    } catch {
      setError('Failed to load categories')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (data: CategoryFormData) => {
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, data)
      } else {
        await createCategory(data)
      }
      setShowForm(false)
      setEditingCategory(null)
      setSuccess(editingCategory ? 'Category updated!' : 'Category created!')
      setTimeout(() => setSuccess(''), 2500)
      await loadCategories()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save category')
    }
  }

  const handleDelete = async (category: Category) => {
    if (!confirm(`Delete category "${category.name}"? Products will no longer show this category.`)) return
    try {
      await deleteCategory(category.id)
      setSuccess('Category deleted.')
      setTimeout(() => setSuccess(''), 2500)
      await loadCategories()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete category')
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Loading…</div>

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-bold">Settings</h1>

      {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3">{error}</div>}
      {success && <div className="bg-green-50 text-green-600 text-sm rounded-lg p-3">{success}</div>}

      {/* Category Management */}
      <div className="bg-white rounded-xl shadow-sm border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-base">🏷️ Category Management</h2>
          <button
            onClick={() => { setEditingCategory(null); setShowForm(true) }}
            className="bg-primary text-white px-3 py-1.5 rounded-lg text-sm font-medium"
          >
            + Add Category
          </button>
        </div>

        {showForm && (
          <CategoryForm
            category={editingCategory}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditingCategory(null) }}
          />
        )}

        <div className="space-y-2">
          {categories.length === 0 && (
            <p className="text-center text-gray-400 py-6 text-sm">
              No categories yet. Add one to get started.
            </p>
          )}
          {categories.map(cat => (
            <div key={cat.id} className="flex items-center justify-between py-2 border-b last:border-0">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${cat.color}`}>
                <span>{cat.icon}</span>
                {cat.name}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => { setEditingCategory(cat); setShowForm(true) }}
                  className="text-sm text-primary"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(cat)}
                  className="text-sm text-red-400 hover:text-red-600"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CategoryForm({
  category,
  onSave,
  onCancel,
}: {
  category: Category | null
  onSave: (data: CategoryFormData) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState<CategoryFormData>({
    name: category?.name ?? '',
    icon: category?.icon ?? '🏷️',
    color: category?.color ?? 'bg-gray-100 text-gray-700',
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
    <form onSubmit={handleSubmit} className="bg-gray-50 rounded-xl p-4 border space-y-3">
      <h3 className="font-semibold text-sm">{category ? 'Edit Category' : 'New Category'}</h3>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2 text-base outline-none focus:ring-2 focus:ring-primary"
            placeholder="e.g. Dog Food"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Icon (emoji)</label>
          <input
            type="text"
            value={form.icon}
            onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2 text-base outline-none focus:ring-2 focus:ring-primary"
            placeholder="🏷️"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
        <div className="flex flex-wrap gap-2">
          {COLOR_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setForm(f => ({ ...f, color: opt.value }))}
              className={`w-8 h-8 rounded-full border-2 transition ${
                form.color === opt.value ? 'border-gray-800 scale-110' : 'border-transparent'
              }`}
              style={{ backgroundColor: opt.swatch }}
              title={opt.label}
            />
          ))}
        </div>
        {/* Preview */}
        <div className="mt-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${form.color}`}>
            <span>{form.icon}</span>
            {form.name || 'Preview'}
          </span>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 bg-primary text-white font-semibold py-2 rounded-lg disabled:opacity-50 text-sm"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2 border rounded-lg text-gray-600 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
