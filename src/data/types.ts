// Shared shapes for the catalogue, orders and the admin API. The Worker and
// the React app both import from here so a change lands in one place.

export type Category = 'tot-bags' | 'kitenge-map-big' | 'kitenge-kichwa-big' | 'kitenge-map-medium' | 'kitenge-kichwa-medium' | 'kitenge-small'

export interface ProductOption {
  name: string
  values: string[]
}

export interface Product {
  id: number
  slug: string
  name: string
  price: number
  compareAt?: number
  category: Category
  image: string
  badge?: string
  short: string
  description: string
  details: string[]
  materials: string
  options?: ProductOption
  stock: number
  featured: boolean
  active: boolean
}

export type OrderStatus = 'awaiting_payment' | 'paid' | 'shipped' | 'delivered' | 'cancelled'
/** Deliver to the shopper's address, or collect from the shop. */
export type Fulfilment = 'delivery' | 'pickup'
export type PaymentMethod = 'mpesa' | 'bank'
export type PaymentStatus = 'pending' | 'paid' | 'failed'

export interface OrderItem {
  slug: string
  name: string
  option?: string
  unitPrice: number
  quantity: number
}

export interface OrderCustomer {
  name: string
  email: string
  phone: string
  address: string
  city: string
  notes?: string
}

export interface Order {
  reference: string
  status: OrderStatus
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  fulfilment: Fulfilment
  /** Distance the delivery fee was worked out from, when delivered. */
  distanceKm?: number
  customer: OrderCustomer
  items: OrderItem[]
  subtotal: number
  shipping: number
  total: number
  createdAt: string
  mpesaReceipt?: string
}

export interface PaymentInstructions {
  method: PaymentMethod
  mode: 'stk' | 'manual'
  payToName?: string
  payToLabel?: string
  payToNumber?: string
  /** The account shoppers type in after the paybill number, if the shop has one. */
  payToAccount?: string
  bankName?: string
  bankAccountName?: string
  bankAccountNumber?: string
  bankBranch?: string
  note?: string
  message?: string
}

export interface CreateOrderResponse {
  reference: string
  token: string
  total: number
  payment: PaymentInstructions
}

export const CATEGORIES: { key: Category; label: string; blurb: string; image: string }[] = [
  { key: 'tot-bags', label: 'Tot Bags', blurb: 'Plain and everyday', image: '/images/tot-bag.svg' },
  { key: 'kitenge-map-big', label: 'Kitenge Map (Big)', blurb: 'Our largest tote', image: '/images/kitenge-map-big.svg' },
  { key: 'kitenge-kichwa-big', label: 'Kitenge Kichwa (Big)', blurb: 'Structured and roomy', image: '/images/kitenge-kichwa-big.svg' },
  { key: 'kitenge-map-medium', label: 'Kitenge Map (Medium)', blurb: 'The everyday size', image: '/images/kitenge-map-medium.svg' },
  { key: 'kitenge-kichwa-medium', label: 'Kitenge Kichwa (Medium)', blurb: 'A little lighter', image: '/images/kitenge-kichwa-medium.svg' },
  { key: 'kitenge-small', label: 'Kitenge Small', blurb: 'Hands free', image: '/images/kitenge-small.svg' },
]

export const CATEGORY_LABELS: Record<Category, string> = {
  'tot-bags': 'Tot Bags',
  'kitenge-map-big': 'Kitenge Map (Big)',
  'kitenge-kichwa-big': 'Kitenge Kichwa (Big)',
  'kitenge-map-medium': 'Kitenge Map (Medium)',
  'kitenge-kichwa-medium': 'Kitenge Kichwa (Medium)',
  'kitenge-small': 'Kitenge Small',
}

/** Delivery is charged per kilometre from the shop. */
export const DELIVERY_RATE_PER_KM = 100

export const money = (value: number) => `KSh ${Math.round(value).toLocaleString('en-KE')}`

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  awaiting_payment: 'Awaiting payment',
  paid: 'Paid',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}
