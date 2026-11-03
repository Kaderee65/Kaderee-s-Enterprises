import { useEffect, useState } from 'react'

import { api, type StoreConfig } from './api'

// The shop's contact details come from the admin settings, so the owner can
// change a phone number or email without touching code. One fetch is shared by
// every component that asks for them.
let cached: StoreConfig | null = null
let pending: Promise<StoreConfig> | null = null

function load(): Promise<StoreConfig> {
  if (cached) return Promise.resolve(cached)
  if (!pending) {
    pending = api<StoreConfig>('/api/store')
      .then((store) => {
        cached = store
        pending = null
        return store
      })
      .catch((err: unknown) => {
        pending = null
        throw err
      })
  }
  return pending
}

export function useStore(): StoreConfig | null {
  const [store, setStore] = useState<StoreConfig | null>(cached)
  useEffect(() => {
    if (store) return
    let alive = true
    void load()
      .then((next) => alive && setStore(next))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [store])
  return store
}

// WhatsApp wants the number in international form without a plus sign. Kenyan
// numbers are often written 0723… so a leading zero becomes 254.
export function whatsappLink(phone: string, message: string): string {
  let digits = phone.replace(/\D/g, '')
  if (digits.startsWith('0')) digits = `254${digits.slice(1)}`
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}
