import { ImagePlus, Loader2, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { CATEGORIES, CATEGORY_LABELS, money, type Product } from '../../../data/types'
import { Button, inputClass } from '../../components/ui'
import { api, uploadImage } from '../../lib/api'
import { useCatalog } from '../../lib/catalog'
import { cx } from '../../lib/cx'
import { prepareImage } from '../../lib/image'

interface FormState {
  name: string
  price: string
  compareAt: string
  category: string
  image: string
  badge: string
  short: string
  description: string
  details: string
  materials: string
  optionName: string
  optionValues: string
  stock: string
  featured: boolean
  active: boolean
}

const empty: FormState = {
  name: '',
  price: '',
  compareAt: '',
  category: 'tot-bags',
  image: '',
  badge: '',
  short: '',
  description: '',
  details: '',
  materials: '',
  optionName: 'Colour',
  optionValues: '',
  stock: '5',
  featured: false,
  active: true,
}

function toForm(product: Product): FormState {
  return {
    name: product.name,
    price: String(product.price),
    compareAt: product.compareAt ? String(product.compareAt) : '',
    category: product.category,
    image: product.image,
    badge: product.badge ?? '',
    short: product.short,
    description: product.description,
    details: product.details.join('\n'),
    materials: product.materials,
    optionName: product.options?.name ?? 'Colour',
    optionValues: product.options?.values.join(', ') ?? '',
    stock: String(product.stock),
    featured: product.featured,
    active: product.active,
  }
}

function toPayload(form: FormState) {
  return {
    name: form.name.trim(),
    price: Number(form.price),
    compareAt: form.compareAt ? Number(form.compareAt) : null,
    category: form.category,
    image: form.image.trim(),
    badge: form.badge.trim(),
    short: form.short.trim(),
    description: form.description.trim(),
    details: form.details,
    materials: form.materials.trim(),
    options: form.optionValues.trim() ? { name: form.optionName.trim() || 'Option', values: form.optionValues } : null,
    stock: Number(form.stock),
    featured: form.featured,
    active: form.active,
  }
}

export function AdminProducts({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<{ id: number | null; form: FormState } | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const { reload: reloadCatalog } = useCatalog()

  async function pickPhoto(file: File | undefined) {
    if (!file || !editing) return
    setPhotoError('')
    setUploading(true)
    try {
      const url = await uploadImage(await prepareImage(file))
      setEditing({ ...editing, form: { ...editing.form, image: url } })
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Could not upload that photo.')
    } finally {
      setUploading(false)
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const body = await api<{ products: Product[] }>('/api/admin/products')
      setProducts(body.products)
      setError('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load products.'
      if (message.toLowerCase().includes('unauthorized')) onUnauthorized()
      else setError(message)
    } finally {
      setLoading(false)
    }
  }, [onUnauthorized])

  useEffect(() => {
    void load()
  }, [load])

  async function save() {
    if (!editing) return
    setSaving(true)
    setError('')
    try {
      if (editing.id === null) {
        await api('/api/admin/products', { method: 'POST', body: JSON.stringify(toPayload(editing.form)) })
      } else {
        await api(`/api/admin/products/${editing.id}`, { method: 'PATCH', body: JSON.stringify(toPayload(editing.form)) })
      }
      setEditing(null)
      await Promise.all([load(), reloadCatalog()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that bag.')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: number) {
    setConfirmDelete(null)
    try {
      await api(`/api/admin/products/${id}`, { method: 'DELETE' })
      await Promise.all([load(), reloadCatalog()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove that bag.')
    }
  }

  async function toggle(product: Product, patch: { active?: boolean; featured?: boolean }) {
    try {
      await api(`/api/admin/products/${product.id}`, { method: 'PATCH', body: JSON.stringify(patch) })
      await Promise.all([load(), reloadCatalog()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update that bag.')
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14px] text-muted">
          {products.length} bags · {products.filter((p) => p.stock <= 0).length} sold out
        </p>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={load} loading={loading}>
            <RefreshCw /> Refresh
          </Button>
          <Button size="sm" onClick={() => setEditing({ id: null, form: { ...empty } })}>
            <Plus /> Add a bag
          </Button>
        </div>
      </div>

      {error && <p className="mt-4 rounded-control bg-accent-soft px-4 py-3 text-[14px] text-accent">{error}</p>}

      <div className="mt-4 overflow-hidden rounded-card border border-line bg-surface">
        {loading && products.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[14px] text-muted">
            <Loader2 className="size-4 animate-spin" /> Loading products…
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {products.map((product) => (
              <li key={product.id} className={cx('flex flex-wrap items-center gap-4 px-4 py-4 sm:px-5', !product.active && 'opacity-60')}>
                <span className="image-frame size-16 shrink-0 rounded-[12px]">
                  <img src={product.image} alt="" className="size-full object-cover" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[14.5px] font-medium">{product.name}</span>
                    {product.featured && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11.5px] text-muted">Featured</span>}
                    {!product.active && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11.5px] text-faint">Hidden</span>}
                  </span>
                  <span className="mt-0.5 block text-[13px] text-faint">
                    {CATEGORY_LABELS[product.category]} · {money(product.price)} · {product.stock} in stock
                  </span>
                </span>
                <span className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => toggle(product, { active: !product.active })}>
                    {product.active ? 'Hide' : 'Show'}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setEditing({ id: product.id, form: toForm(product) })}>
                    <Pencil /> Edit
                  </Button>
                  <button
                    type="button"
                    aria-label={`Delete ${product.name}`}
                    onClick={() => setConfirmDelete(product.id)}
                    className="grid size-9 place-items-center rounded-[10px] text-faint transition-colors hover:bg-accent-soft hover:text-accent"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </span>
                {confirmDelete === product.id && (
                  <div className="flex w-full items-center justify-between gap-3 rounded-control bg-surface-2 px-3 py-2 text-[13.5px]">
                    <span>Remove {product.name} from the shop?</span>
                    <span className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setConfirmDelete(null)}>
                        Keep
                      </Button>
                      <Button size="sm" onClick={() => remove(product.id)}>
                        Remove
                      </Button>
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-fg/40 p-3 backdrop-blur-sm sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && setEditing(null)}>
          <div className="mx-auto w-full max-w-[720px] rounded-dialog bg-bg p-5 shadow-drawer sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-[30px] leading-none">{editing.id === null ? 'Add a bag' : 'Edit bag'}</h2>
                <p className="mt-1.5 text-[13.5px] text-muted">Changes appear in the shop immediately.</p>
              </div>
              <button type="button" aria-label="Close" onClick={() => setEditing(null)} className="grid size-9 place-items-center rounded-[10px] hover:bg-surface-2">
                <X className="size-4" />
              </button>
            </div>

            <form
              className="mt-6 grid grid-cols-2 gap-4"
              onSubmit={(e) => {
                e.preventDefault()
                void save()
              }}
            >
              <Field label="Name" className="col-span-2">
                <input required className={inputClass} value={editing.form.name} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, name: e.target.value } })} />
              </Field>
              <Field label="Price (KSh)">
                <input required type="number" min="1" className={inputClass} value={editing.form.price} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, price: e.target.value } })} />
              </Field>
              <Field label="Was price (optional)">
                <input type="number" min="0" className={inputClass} value={editing.form.compareAt} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, compareAt: e.target.value } })} />
              </Field>
              <Field label="Category">
                <select className={inputClass} value={editing.form.category} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, category: e.target.value } })}>
                  {CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="In stock">
                <input type="number" min="0" className={inputClass} value={editing.form.stock} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, stock: e.target.value } })} />
              </Field>
              <Field label="Short line (under the name)" className="col-span-2">
                <input className={inputClass} placeholder="Full-grain leather, fits a 14&quot; laptop" value={editing.form.short} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, short: e.target.value } })} />
              </Field>
              <Field label="Description" className="col-span-2">
                <textarea rows={3} className={cx(inputClass, 'h-auto min-h-[88px] py-3')} value={editing.form.description} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, description: e.target.value } })} />
              </Field>
              <Field label="Details (one per line)" className="col-span-2">
                <textarea rows={3} className={cx(inputClass, 'h-auto min-h-[80px] py-3')} value={editing.form.details} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, details: e.target.value } })} />
              </Field>
              <Field label="Materials and care" className="col-span-2">
                <input className={inputClass} value={editing.form.materials} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, materials: e.target.value } })} />
              </Field>
              <Field label="Option name (e.g. Colour)">
                <input className={inputClass} value={editing.form.optionName} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, optionName: e.target.value } })} />
              </Field>
              <Field label="Option values (comma separated)">
                <input className={inputClass} placeholder="Tan, Black, Chestnut" value={editing.form.optionValues} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, optionValues: e.target.value } })} />
              </Field>
              <Field label="Photo" className="col-span-2">
                <div className="rounded-card border border-line bg-surface-2/40 p-3">
                  <div className="flex items-center gap-3">
                    <span className="image-frame size-20 shrink-0 rounded-[10px]">
                      {editing.form.image ? (
                        <img src={editing.form.image} alt="" className="size-full object-cover" />
                      ) : (
                        <span className="grid size-full place-items-center text-faint"><ImagePlus className="size-5" /></span>
                      )}
                    </span>
                    <div className="min-w-0">
                      <label className={cx('inline-flex h-10 cursor-pointer items-center gap-2 rounded-control bg-fg px-4 text-[13.5px] font-medium text-bg', uploading && 'pointer-events-none opacity-60')}>
                        {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
                        {uploading ? 'Uploading…' : editing.form.image ? 'Change photo' : 'Upload photo'}
                        <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void pickPhoto(e.target.files?.[0])} />
                      </label>
                      <p className="mt-1.5 text-[12.5px] text-faint">From your phone or computer — JPG, PNG or WebP.</p>
                    </div>
                  </div>
                  <details className="mt-3">
                    <summary className="cursor-pointer text-[12.5px] text-muted">Or paste a photo link</summary>
                    <input className={cx(inputClass, 'mt-2')} placeholder="/images/bag.jpg or https://…" value={editing.form.image} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, image: e.target.value } })} />
                  </details>
                  {photoError && <p className="mt-2 text-[13px] text-accent">{photoError}</p>}
                </div>
              </Field>
              <Field label="Badge (optional)">
                <input className={inputClass} placeholder="New, Bestseller, Low stock" value={editing.form.badge} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, badge: e.target.value } })} />
              </Field>
              <div className="flex items-end gap-4 pb-1">
                <label className="flex items-center gap-2 text-[14px]">
                  <input type="checkbox" checked={editing.form.featured} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, featured: e.target.checked } })} /> Featured
                </label>
                <label className="flex items-center gap-2 text-[14px]">
                  <input type="checkbox" checked={editing.form.active} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, active: e.target.checked } })} /> Visible
                </label>
              </div>

              {error && <p className="col-span-2 text-[14px] text-accent">{error}</p>}
              <div className="col-span-2 mt-2 flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button type="submit" loading={saving}>
                  {editing.id === null ? 'Add to the shop' : 'Save changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={className}>
      <span className="mb-1.5 block text-[13px] font-medium">{label}</span>
      {children}
    </label>
  )
}
