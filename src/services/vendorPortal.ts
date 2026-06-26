import {
  Timestamp,
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  where,
} from 'firebase/firestore'

import type { FoodItem, Notif, Order, Txn } from '../data/mock'
import { db } from '../lib/firebase'
import { apiFetchAuth } from '../lib/api'
import type { VendorProfile, VendorUserProfile } from '../types/firebase'
import type { BankAccount, PreorderConfig, VendorOrder, WalletOverview, WalletSummary, WithdrawalRecord } from '../types/portal'

const CATEGORY_TO_PRODUCT: Record<FoodItem['cat'], { categoryId: string; categoryName: string; subCategoryId: string; subCategoryName: string }> = {
  rice: { categoryId: 'food_drinks', categoryName: 'Food & Drinks', subCategoryId: 'meals', subCategoryName: 'Meals' },
  swallow: { categoryId: 'food_drinks', categoryName: 'Food & Drinks', subCategoryId: 'swallow', subCategoryName: 'Swallow' },
  soup: { categoryId: 'food_drinks', categoryName: 'Food & Drinks', subCategoryId: 'soups', subCategoryName: 'Soups' },
  protein: { categoryId: 'food_drinks', categoryName: 'Food & Drinks', subCategoryId: 'proteins', subCategoryName: 'Proteins' },
  sides: { categoryId: 'food_drinks', categoryName: 'Food & Drinks', subCategoryId: 'sides', subCategoryName: 'Sides' },
  snacks: { categoryId: 'food_drinks', categoryName: 'Food & Drinks', subCategoryId: 'snacks', subCategoryName: 'Snacks' },
  combos: { categoryId: 'food_drinks', categoryName: 'Food & Drinks', subCategoryId: 'combos', subCategoryName: 'Combos' },
  drinks: { categoryId: 'food_drinks', categoryName: 'Food & Drinks', subCategoryId: 'beverages', subCategoryName: 'Beverages' },
}

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

const statusToUiStatus = (status: string): Order['status'] => {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'scheduled') return 'scheduled'
  if (normalized === 'placed') return 'new'
  if (normalized === 'confirmed' || normalized === 'preparing' || normalized === 'processing') return 'accepted'
  if (normalized === 'ready') return 'ready'
  if (normalized === 'out_for_delivery' || normalized === 'picked_up' || normalized === 'shipped') return 'picked'
  if (normalized === 'delivered' || normalized === 'done' || normalized === 'completed' || normalized === 'cancelled' || normalized === 'failed') return 'done'
  return 'new'
}

const uiStatusToNextBackendStatus = (status: string) => {
  if (status === 'new' || status === 'placed') return 'confirmed'
  if (status === 'accepted' || status === 'confirmed' || status === 'preparing') return 'ready'
  if (status === 'ready') return 'out_for_delivery'
  if (status === 'picked' || status === 'out_for_delivery') return 'delivered'
  return null
}

const toMillis = (value: unknown) => {
  if (value instanceof Timestamp) return value.toMillis()
  if (value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis()
  }
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  if (value && typeof value === 'object') {
    const v = value as Record<string, unknown>
    const seconds = Number(v._seconds ?? v.seconds ?? NaN)
    if (!Number.isNaN(seconds)) return seconds * 1000 + Math.floor(Number(v._nanoseconds ?? v.nanoseconds ?? 0) / 1e6)
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    if (!Number.isNaN(parsed)) return parsed
  }
  return Date.now()
}

const toDate = (value: unknown) => new Date(toMillis(value))

const formatTime = (value: unknown) =>
  new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(toDate(value))

const formatShortDay = (date: Date) =>
  new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date)

const formatRelative = (value: unknown) => {
  const date = toDate(value)
  const diff = Date.now() - date.getTime()
  const mins = Math.round(diff / 60000)

  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`

  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`

  const days = Math.round(hours / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`

  return formatTime(value)
}

const normalizeTxnType = (type: string): Txn['type'] => {
  const normalized = String(type || '').toLowerCase()
  if (normalized === 'withdrawal') return 'debit'
  if (normalized === 'reversal') return 'reversal'
  if (normalized === 'adjustment') return 'adjustment'
  return normalized === 'credit' ? 'credit' : 'debit'
}

const categoryFromProduct = (product: Record<string, unknown>): FoodItem['cat'] => {
  const sub = String(product.subCategoryId || product.subCategoryName || '').toLowerCase()
  const cat = String(product.categoryName || '').toLowerCase()

  if (sub.includes('drink') || sub.includes('beverage')) return 'drinks'
  if (sub.includes('protein')) return 'protein'
  if (sub.includes('soup')) return 'soup'
  if (sub.includes('swallow')) return 'swallow'
  if (sub.includes('side')) return 'sides'
  if (sub.includes('snack')) return 'snacks'
  if (sub.includes('combo')) return 'combos'
  if (cat.includes('drink')) return 'drinks'
  return 'rice'
}

const emojiForCategory = (cat: FoodItem['cat']) =>
  ({ rice: '🍛', swallow: '🫓', soup: '🥣', protein: '🍗', sides: '🥗', snacks: '🥨', combos: '🍱', drinks: '🥤' })[cat]

export const uploadImageToCloudinary = async (
  imageDataUrl: string,
  onProgress?: (percent: number) => void,
) => {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    throw new Error('Cloudinary is not configured. Add VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET to vendor env.')
  }

  return new Promise<string>((resolve, reject) => {
    const formData = new FormData()
    formData.append('file', imageDataUrl)
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET)
    formData.append('folder', 'blorbmart/menu-items')

    const xhr = new XMLHttpRequest()
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`)

    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable) return
      onProgress(Math.round((event.loaded / event.total) * 100))
    }

    xhr.onerror = () => reject(new Error('Failed to upload image to Cloudinary'))
    xhr.onload = () => {
      const payload = JSON.parse(xhr.responseText || '{}')
      if (xhr.status >= 200 && xhr.status < 300 && payload.secure_url) {
        onProgress?.(100)
        resolve(String(payload.secure_url))
      } else {
        reject(new Error(payload.error?.message || 'Failed to upload image to Cloudinary'))
      }
    }

    xhr.send(formData)
  })
}

export const uploadProfilePhotoToCloudinary = async (
  imageDataUrl: string,
  onProgress?: (percent: number) => void,
) => {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    throw new Error('Cloudinary is not configured. Add VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET to vendor env.')
  }

  return new Promise<string>((resolve, reject) => {
    const formData = new FormData()
    formData.append('file', imageDataUrl)
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET)
    formData.append('folder', 'blorbmart/vendor-profiles')

    const xhr = new XMLHttpRequest()
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`)

    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable) return
      onProgress(Math.round((event.loaded / event.total) * 100))
    }

    xhr.onerror = () => reject(new Error('Failed to upload profile photo to Cloudinary'))
    xhr.onload = () => {
      const payload = JSON.parse(xhr.responseText || '{}')
      if (xhr.status >= 200 && xhr.status < 300 && payload.secure_url) {
        onProgress?.(100)
        resolve(String(payload.secure_url))
      } else {
        reject(new Error(payload.error?.message || 'Failed to upload profile photo to Cloudinary'))
      }
    }

    xhr.send(formData)
  })
}

export const updateVendorProfilePhoto = async (photoUrl: string) => {
  const response = await apiFetchAuth('/api/vendor-profile/photo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ photoUrl }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.message || 'Failed to update profile photo')
  }
  return payload
}

export const getVendorProfilePhoto = async () => {
  const response = await apiFetchAuth('/api/vendor-profile/photo')
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.message || 'Failed to get profile photo')
  }
  return payload.data?.photoUrl || ''
}

export const deleteVendorProfilePhoto = async () => {
  const response = await apiFetchAuth('/api/vendor-profile/photo', {
    method: 'DELETE',
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.message || 'Failed to remove profile photo')
  }
  return payload
}

const productToFoodItem = (id: string, product: Record<string, unknown>): FoodItem => {
  const cat = categoryFromProduct(product)
  const status = String(product.status || 'active').toLowerCase()
  const availability = String(product.availability || '').toLowerCase()
  const stock = Number(product.stockQuantity || 0)
  const mealDetails =
    product.mealDetails && typeof product.mealDetails === 'object'
      ? (product.mealDetails as Record<string, unknown>)
      : null
  const avail: FoodItem['avail'] =
    status !== 'active' ? 'hidden' : availability === 'soldout' || stock <= 0 ? 'soldout' : 'available'

  return {
    id,
    name: String(product.name || 'Untitled product'),
    cat,
    price: Number(product.discountPrice || product.price || 0),
    desc: String(product.description || ''),
    prep: Number(mealDetails?.prepTimeMinutes || product.prepTime || 15),
    avail,
    tags: Array.isArray(product.tags) ? product.tags.map(String) : [],
    emoji: String(product.emoji || emojiForCategory(cat)),
    featured: Boolean(product.featured),
    menuOrder: Number(product.menuOrder || 0),
    image: String(
      (Array.isArray(product.images) && product.images[0]) ||
      product.imageUrl ||
      product.image ||
      '',
    ) || undefined,
  }
}

export const fetchWalletOverview = async (): Promise<WalletOverview | null> => {
  const response = await apiFetchAuth('/api/seller-wallet')
  if (!response.ok) throw new Error('Failed to load wallet')
  const payload = await response.json()
  return payload.data as WalletOverview
}

export const fetchWalletSummary = async (): Promise<WalletSummary | null> => {
  const response = await apiFetchAuth('/api/seller-wallet/summary')
  if (!response.ok) throw new Error('Failed to load wallet summary')
  const payload = await response.json()
  return payload.data as WalletSummary
}

export const fetchWalletTransactions = async (): Promise<Txn[]> => {
  const response = await apiFetchAuth('/api/seller-wallet/transactions?limit=50')
  if (!response.ok) throw new Error('Failed to load transactions')
  const payload = await response.json()
  const transactions = payload.data?.transactions || []

  return transactions.map((tx: Record<string, unknown>) => {
    const direction = String(tx.direction || 'out').toLowerCase() === 'in' ? 'in' : 'out'
    const type = normalizeTxnType(String(tx.type || 'debit'))
    return {
      id: String(tx.id),
      type,
      desc: String(tx.description || tx.reference || 'Transaction'),
      amt: Number(tx.amount || 0),
      dir: direction,
      bal: Number(tx.balanceAfter || 0),
      time: formatTime(tx.createdAt),
      order: tx.orderId ? String(tx.orderId) : null,
      createdAtMs: toMillis(tx.createdAt),
    } as Txn
  })
}

export const fetchWithdrawals = async (): Promise<WithdrawalRecord[]> => {
  const response = await apiFetchAuth('/api/seller-wallet/withdrawals?limit=50')
  if (!response.ok) throw new Error('Failed to load withdrawals')
  const payload = await response.json()
  return (payload.data?.withdrawals || []) as WithdrawalRecord[]
}

export const createWithdrawal = async ({ amount, pin }: { amount: number; pin: string }) => {
  const response = await apiFetchAuth('/api/seller-wallet/withdraw', {
    method: 'POST',
    body: JSON.stringify({
      amountKobo: Math.round(amount * 100),
      pin,
    }),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.message || 'Failed to create withdrawal')
  }

  return payload.data as WithdrawalRecord
}

export const setupWalletPin = async (pin: string): Promise<void> => {
  const response = await apiFetchAuth('/api/seller-wallet/pin/setup', {
    method: 'POST',
    body: JSON.stringify({ pin }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.message || 'Failed to set PIN')
  }
}

export const changeWalletPin = async (currentPin: string, newPin: string): Promise<void> => {
  const response = await apiFetchAuth('/api/seller-wallet/pin/change', {
    method: 'POST',
    body: JSON.stringify({ currentPin, newPin }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.message || 'Failed to change PIN')
  }
}

export const verifyWalletPin = async (pin: string): Promise<boolean> => {
  const response = await apiFetchAuth('/api/seller-wallet/pin/verify', {
    method: 'POST',
    body: JSON.stringify({ pin }),
  })
  const payload = await response.json().catch(() => ({}))
  return response.ok && payload.data?.valid === true
}

export const requestPinReset = async (): Promise<{ emailMasked: string }> => {
  const response = await apiFetchAuth('/api/seller-wallet/pin/reset-request', {
    method: 'POST',
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.message || 'Failed to send reset code')
  return payload.data
}

export const confirmPinReset = async (otp: string, newPin: string): Promise<void> => {
  const response = await apiFetchAuth('/api/seller-wallet/pin/reset', {
    method: 'POST',
    body: JSON.stringify({ otp, newPin }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.message || 'Failed to reset PIN')
}

export const rejectVendorOrder = async (orderId: string): Promise<void> => {
  const response = await apiFetchAuth(`/api/orders/${orderId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'cancelled' }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.message || 'Failed to reject order')
}

export const uploadStoreLogo = async (
  imageDataUrl: string,
  onProgress?: (percent: number) => void,
): Promise<string> => {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    throw new Error('Cloudinary is not configured. Add VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET to vendor env.')
  }

  return new Promise<string>((resolve, reject) => {
    const formData = new FormData()
    formData.append('file', imageDataUrl)
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET)
    formData.append('folder', 'blorbmart/vendor-logos')

    const xhr = new XMLHttpRequest()
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`)

    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable) return
      onProgress(Math.round((event.loaded / event.total) * 100))
    }

    xhr.onerror = () => reject(new Error('Failed to upload store logo to Cloudinary'))
    xhr.onload = () => {
      const payload = JSON.parse(xhr.responseText || '{}')
      if (xhr.status >= 200 && xhr.status < 300 && payload.secure_url) {
        onProgress?.(100)
        resolve(String(payload.secure_url))
      } else {
        reject(new Error(payload.error?.message || 'Failed to upload store logo to Cloudinary'))
      }
    }

    xhr.send(formData)
  })
}

export const markVendorProfileComplete = async (uid: string) => {
  await setDoc(doc(db, 'vendors', uid), { profileComplete: true, updatedAt: serverTimestamp() }, { merge: true })
}

export const updateStoreProfile = async (profileData: {
  name?: string
  description?: string
  phone?: string
  email?: string
  address?: string
  city?: string
  state?: string
  logo?: string
  category?: string
  latitude?: number
  longitude?: number
}): Promise<void> => {
  const response = await apiFetchAuth('/api/stores/me', {
    method: 'PATCH',
    body: JSON.stringify(profileData),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.message || 'Failed to update store profile')
  }
}

export const fetchStoreProfile = async () => {
  const response = await apiFetchAuth('/api/stores/me')
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.message || 'Failed to fetch store profile')
  }
  return payload.data as Record<string, unknown>
}

export const fetchVendorStore = async (uid: string) => {
  const snapshot = await getDocs(query(collection(db, 'stores'), where('vendorId', '==', uid), limit(1)))
  if (!snapshot.empty) {
    return { id: snapshot.docs[0].id, ...(snapshot.docs[0].data() as Record<string, unknown>) }
  }
  return null
}

export const fetchVendorStoreControls = async () => {
  const response = await apiFetchAuth('/api/stores/me')
  if (!response.ok) return null
  const payload = await response.json()
  return payload.data || null
}

export const fetchVendorProducts = async (uid: string): Promise<FoodItem[]> => {
  const snapshot = await getDocs(query(collection(db, 'products'), where('vendorId', '==', uid)))
  return snapshot.docs
    .map((item) => productToFoodItem(item.id, item.data() as Record<string, unknown>))
    .sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || Number(a.menuOrder || 0) - Number(b.menuOrder || 0) || a.name.localeCompare(b.name))
}

export const saveVendorProduct = async ({
  item,
  vendorProfile,
  userProfile,
  uid,
  store,
  onUploadProgress,
}: {
  item: Omit<FoodItem, 'id' | 'emoji'> & { id?: string; emoji?: string }
  vendorProfile: VendorProfile | null
  userProfile: VendorUserProfile | null
  uid: string
  store: Record<string, unknown> | null
  onUploadProgress?: (percent: number) => void
}) => {
  let imageUrl = item.image || ''
  if (imageUrl && imageUrl.startsWith('data:image/')) {
    imageUrl = await uploadImageToCloudinary(imageUrl, onUploadProgress)
  }

  const refs = item.id ? doc(db, 'products', item.id) : doc(collection(db, 'products'))
  const categoryMeta = CATEGORY_TO_PRODUCT[item.cat]
  const status = item.avail === 'hidden' ? 'archived' : 'active'
  const availability = item.avail === 'hidden' ? 'hidden' : item.avail === 'soldout' ? 'soldout' : 'available'
  const stockQuantity = item.avail === 'soldout' ? 0 : 100
  const vendorName = [userProfile?.firstName, userProfile?.lastName].filter(Boolean).join(' ').trim() || 'Vendor'

  await setDoc(
    refs,
    {
      name: item.name,
      description: item.desc,
      price: item.price,
      discountPrice: item.price,
      status,
      availability,
      stockQuantity,
      tags: item.tags,
      emoji: item.emoji || emojiForCategory(item.cat),
      vendorId: uid,
      vendorName,
      businessName: vendorProfile?.businessName || store?.storeName || 'Blorbmart Vendor',
      storeId: String(store?.storeId || store?.id || ''),
      storeName: String(store?.storeName || vendorProfile?.businessName || 'Blorbmart Vendor'),
      categoryId: categoryMeta.categoryId,
      categoryName: categoryMeta.categoryName,
      subCategoryId: categoryMeta.subCategoryId,
      subCategoryName: categoryMeta.subCategoryName,
      hasVariants: false,
      featured: Boolean(item.featured),
      menuOrder: Number(item.menuOrder || Date.now()),
      imageUrl: imageUrl || null,
      images: imageUrl ? [imageUrl] : [],
      totalReviews: 0,
      totalSold: 0,
      rating: 0,
      mealDetails: {
        prepTimeMinutes: item.prep,
      },
      ...(item.id ? {} : { createdAt: serverTimestamp() }),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )

  return refs.id
}

export const setVendorProductAvailability = async (id: string, avail: FoodItem['avail']) => {
  await updateDoc(doc(db, 'products', id), {
    status: avail === 'hidden' ? 'archived' : 'active',
    availability: avail,
    stockQuantity: avail === 'soldout' ? 0 : 100,
    updatedAt: serverTimestamp(),
  })
}

export const archiveVendorProduct = async (id: string) => {
  await updateDoc(doc(db, 'products', id), {
    status: 'archived',
    availability: 'hidden',
    updatedAt: serverTimestamp(),
  })
}

export const bulkUpdateVendorProducts = async (
  ids: string[],
  action: 'soldout' | 'hide' | 'archive',
) => {
  if (!ids.length) return
  const batch = writeBatch(db)
  ids.forEach((id) => {
    const ref = doc(db, 'products', id)
    if (action === 'soldout') {
      batch.update(ref, {
        status: 'active',
        availability: 'soldout',
        stockQuantity: 0,
        updatedAt: serverTimestamp(),
      })
      return
    }
    if (action === 'hide') {
      batch.update(ref, {
        status: 'archived',
        availability: 'hidden',
        updatedAt: serverTimestamp(),
      })
      return
    }
    batch.update(ref, {
      status: 'archived',
      availability: 'hidden',
      updatedAt: serverTimestamp(),
    })
  })
  await batch.commit()
}

export const reorderVendorProducts = async (ids: string[]) => {
  if (!ids.length) return
  const batch = writeBatch(db)
  ids.forEach((id, index) => {
    batch.update(doc(db, 'products', id), {
      menuOrder: index + 1,
      updatedAt: serverTimestamp(),
    })
  })
  await batch.commit()
}

export const setVendorProductFeatured = async (id: string, featured: boolean) => {
  await updateDoc(doc(db, 'products', id), {
    featured,
    updatedAt: serverTimestamp(),
  })
}

export const fetchVendorOrders = async (): Promise<VendorOrder[]> => {
  const response = await apiFetchAuth('/api/orders/vendor')
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.message || 'Failed to fetch orders')

  const orders = (payload.data ?? []) as Record<string, unknown>[]

  return orders.map((data) => {
    const orderStatus = String(data.orderStatus || data.status || 'placed')
    const matchingStoreOrder = (data.matchingStoreOrder ?? {}) as Record<string, unknown>
    const itemsSource = Array.isArray(data.items) ? data.items as Record<string, unknown>[] : []
    const deliveryAddress =
      data.deliveryAddress && typeof data.deliveryAddress === 'object'
        ? (data.deliveryAddress as Record<string, unknown>)
        : null

    return {
      id: String(data.orderId || data.id),
      backendStatus: orderStatus,
      status: statusToUiStatus(orderStatus),
      customer: String(data.userName || 'Customer'),
      addr: String(
        deliveryAddress
          ? [deliveryAddress.street, deliveryAddress.city, deliveryAddress.state].filter(Boolean).join(', ')
          : data.deliveryAddress || data.address || 'Address unavailable',
      ),
      items: itemsSource.map((item) => ({
        name: String(item.productName || item.name || 'Item'),
        qty: Number(item.quantity || item.qty || 1),
        price: Number(item.price || 0),
        prepMinutes: Number(item.prepMinutes || 0) || undefined,
      })),
      total: Number(data.storeTotal || data.totalAmount || 0),
      placed: formatRelative(data.createdAt),
      note: String(data.notes || data.note || ''),
      readyInMinutes: Number(data.readyInMinutes || matchingStoreOrder.readyInMinutes || 0) || undefined,
      delayNotices: Array.isArray(data.delayNotices)
        ? (data.delayNotices as Record<string, unknown>[]).map((entry) => ({
            delayMinutes: Number(entry.delayMinutes || 0),
            reason: String(entry.reason || 'Delay'),
            createdAt: String(entry.createdAt || ''),
          }))
        : [],
      fulfillmentType: String(data.fulfillmentType || 'asap'),
      scheduledLabel: String(data.scheduledLabel || ''),
      scheduledFor: data.scheduledFor ? String(data.scheduledFor) : undefined,
      createdAtMs: toMillis(data.createdAt),
    } as VendorOrder
  })
}

export const advanceVendorOrderStatus = async (order: VendorOrder) => {
  const nextStatus = uiStatusToNextBackendStatus(order.backendStatus || order.status)
  if (!nextStatus) return

  const response = await apiFetchAuth(`/api/orders/${order.id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: nextStatus }),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.message || 'Failed to update order')
  }
}

export const setVendorOrderReadyInMinutes = async (orderId: string, readyInMinutes: number) => {
  const response = await apiFetchAuth(`/api/orders/${orderId}/ready-time`, {
    method: 'POST',
    body: JSON.stringify({ readyInMinutes }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.message || 'Failed to set ready time')
}

export const sendVendorOrderDelay = async (orderId: string, delayMinutes: number, reason: string) => {
  const response = await apiFetchAuth(`/api/orders/${orderId}/delay`, {
    method: 'POST',
    body: JSON.stringify({ delayMinutes, reason }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.message || 'Failed to send delay notification')
}

export const fetchVendorPreorderConfig = async (): Promise<{ preorderConfig: PreorderConfig; statusMessage: string | null } | null> => {
  const response = await apiFetchAuth('/api/stores/me/preorder')
  if (!response.ok) return null
  const payload = await response.json()
  return payload.data || null
}

export const saveVendorPreorderConfig = async (config: PreorderConfig) => {
  const response = await apiFetchAuth('/api/stores/me/preorder', {
    method: 'PUT',
    body: JSON.stringify(config),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.message || 'Failed to save preorder settings')
  return payload.data as { preorderConfig: PreorderConfig }
}

export const promoteVendorPreorders = async () => {
  const response = await apiFetchAuth('/api/orders/preorders/promote-me', { method: 'POST' })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.message || 'Failed to start fulfillment day')
  return payload.data as { count: number; promoted: string[] }
}

export const saveVendorStoreControls = async ({
  isOpen,
  pauseMinutes,
  weeklyHours,
  holidays,
  uid,
  storeId,
}: {
  isOpen: boolean
  pauseMinutes: number
  weeklyHours: unknown[]
  holidays: unknown[]
  uid?: string
  storeId?: string
}) => {
  await apiFetchAuth('/api/stores/me/status', {
    method: 'PATCH',
    body: JSON.stringify({ isOpen }),
  })
  if (pauseMinutes > 0) {
    await apiFetchAuth('/api/stores/me/pause', {
      method: 'PATCH',
      body: JSON.stringify({ pauseMinutes }),
    })
  }
  await apiFetchAuth('/api/stores/me/hours', {
    method: 'PUT',
    body: JSON.stringify({ weeklyHours, holidays }),
  })

  if (uid) {
    let storeRef
    if (storeId) {
      storeRef = doc(db, 'stores', storeId)
    } else {
      const snap = await getDocs(query(collection(db, 'stores'), where('vendorId', '==', uid), limit(1)))
      storeRef = snap.docs[0]?.ref
    }
    if (storeRef) {
      await setDoc(storeRef, { isOpen, weeklyHours, holidays, updatedAt: serverTimestamp() }, { merge: true })
    }
  }
}

export const fetchVendorNotifications = async (uid: string): Promise<Notif[]> => {
  const snapshot = await getDocs(query(collection(db, 'notifications'), where('userId', '==', uid)))
  return snapshot.docs
    .map((item) => {
      const data = item.data() as Record<string, unknown>
      return {
        id: item.id,
        title: String(data.title || 'Notification'),
        body: String(data.message || data.body || ''),
        time: formatRelative(data.createdAt || data.updatedAt),
        read: data.status === 'read',
        icon: 'check' as const,
      }
    })
    .sort((a, b) => Number(!a.read) - Number(!b.read))
}

export const markVendorNotificationRead = async (uid: string, id: string) => {
  const response = await apiFetchAuth(`/api/notifications/${uid}/${id}/read`, { method: 'PATCH' })
  if (!response.ok) throw new Error('Failed to mark notification as read')
}

export const markAllVendorNotificationsRead = async (uid: string) => {
  const response = await apiFetchAuth(`/api/notifications/${uid}/read-all`, { method: 'PATCH' })
  if (!response.ok) throw new Error('Failed to mark notifications as read')
}

export const buildChartFromTransactions = (txns: Txn[]) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (6 - index))
    return {
      d: formatShortDay(date),
      key: date.toDateString(),
      v: 0,
    }
  })

  txns.forEach((tx) => {
    if (tx.dir !== 'in') return
    const date = new Date((tx as Txn & { createdAtMs?: number }).createdAtMs || Date.now())
    const key = date.toDateString()
    const bucket = days.find((item) => item.key === key)
    if (bucket) {
      bucket.v += Number(tx.amt || 0)
    }
  })

  return days.map(({ d, v }) => ({ d, v }))
}

export interface Bank {
  name: string
  code: string
  active: boolean
  country: string
  currency: string
}

export const fetchBanks = async (): Promise<Bank[]> => {
  const response = await apiFetchAuth('/api/seller-wallet/banks')
  if (!response.ok) throw new Error('Failed to load banks')
  const payload = await response.json()
  return payload.data as Bank[]
}

export const verifyBankAccount = async (bankCode: string, accountNumber: string): Promise<{ bankCode: string; bankName: string; accountNumber: string; accountName: string }> => {
  const response = await apiFetchAuth('/api/seller-wallet/bank-account/verify', {
    method: 'POST',
    body: JSON.stringify({ bankCode, accountNumber }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.message || 'Failed to verify bank account')
  }
  return payload.data
}

export const saveBankAccount = async (bankCode: string, accountNumber: string): Promise<BankAccount> => {
  const response = await apiFetchAuth('/api/seller-wallet/bank-account', {
    method: 'POST',
    body: JSON.stringify({ bankCode, accountNumber }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.message || 'Failed to save bank account')
  }
  return payload.data as BankAccount
}

export const deleteBankAccount = async (): Promise<void> => {
  const response = await apiFetchAuth('/api/seller-wallet/bank-account', {
    method: 'DELETE',
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload.message || 'Failed to delete bank account')
  }
}
