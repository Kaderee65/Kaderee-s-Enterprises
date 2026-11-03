import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import type { Product } from '../../data/types'

interface CatalogState {
  products: Product[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  bySlug: (slug: string) => Product | undefined
}

const CatalogContext = createContext<CatalogState | null>(null)
const CACHE = 'kaderee-catalog-v1'

function readCache(): Product[] {
  try {
    const raw = localStorage.getItem(CACHE)
    return raw ? (JSON.parse(raw) as Product[]) : []
  } catch {
    return []
  }
}

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>(readCache)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const response = await fetch('/api/products')
      const body = (await response.json()) as { products?: Product[]; error?: string }
      if (!response.ok || !body.products) throw new Error(body.error ?? 'Could not load the catalogue.')
      setProducts(body.products)
      setError(null)
      try {
        localStorage.setItem(CACHE, JSON.stringify(body.products))
      } catch {
        /* storage may be full or blocked; the in-memory list still works */
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the catalogue.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const value = useMemo<CatalogState>(
    () => ({
      products,
      loading,
      error,
      reload,
      bySlug: (slug: string) => products.find((p) => p.slug === slug),
    }),
    [products, loading, error, reload],
  )

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
}

export function useCatalog(): CatalogState {
  const ctx = useContext(CatalogContext)
  if (!ctx) throw new Error('useCatalog outside CatalogProvider')
  return ctx
}
