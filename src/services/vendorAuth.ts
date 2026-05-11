import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore'

import { auth, db } from '../lib/firebase'
import { apiUrl } from '../lib/api'
import type { VendorProfile, VendorUserProfile } from '../types/firebase'

interface RegisterVendorInput {
  firstName: string
  lastName: string
  businessName: string
  email: string
  phone: string
  password: string
}

interface VendorKycInput {
  businessType: string
  address: string
  state: string
  lga: string
  idType: string
  idNumber: string
  cuisineTypes: string[]
  selfieCaptured: boolean
  vendorType: 'general' | 'food'
}

const usersCollection = 'users'
const vendorsCollection = 'vendors'

const toDate = (value: unknown) => {
  if (value instanceof Timestamp) return value.toDate()
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate()
  }
  return value instanceof Date ? value : null
}

const getFriendlyAuthError = (error: unknown) => {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''

  switch (code) {
    case 'auth/email-already-in-use':
      return 'That email is already in use.'
    case 'auth/invalid-email':
      return 'Please use a valid email address.'
    case 'auth/weak-password':
      return 'Please choose a stronger password.'
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Incorrect email or password.'
    case 'auth/popup-closed-by-user':
      return 'Google sign-in was cancelled.'
    case 'auth/account-exists-with-different-credential':
      return 'This email is already linked to another sign-in method.'
    default:
      return typeof error === 'object' && error && 'message' in error
        ? String(error.message)
        : 'Something went wrong. Please try again.'
  }
}

const getInitials = (firstName: string, lastName: string) =>
  `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || 'VD'

const buildNamesFromDisplayName = (displayName: string | null) => {
  const parts = String(displayName || '').trim().split(/\s+/).filter(Boolean)
  return {
    firstName: parts[0] || 'Vendor',
    lastName: parts.slice(1).join(' ') || 'User',
  }
}

const ensureVendorRole = async (uid: string) => {
  const userSnap = await getDoc(doc(db, usersCollection, uid))

  if (!userSnap.exists()) return

  const role = String(userSnap.data()?.role || userSnap.data()?.accountRole || '').toLowerCase()
  if (role && role !== 'vendor' && role !== 'kitchen') {
    throw new Error('This account is not registered as a vendor.')
  }
}

const isVendorOtpVerifiedByUid = async (uid: string) => {
  const userSnap = await getDoc(doc(db, usersCollection, uid))
  if (!userSnap.exists()) return false
  return Boolean(userSnap.data()?.isEmailOtpVerified)
}

const writeVendorUserDocs = async (
  user: User,
  input: Pick<RegisterVendorInput, 'firstName' | 'lastName' | 'businessName' | 'phone'>,
) => {
  const userRef = doc(db, usersCollection, user.uid)
  const vendorRef = doc(db, vendorsCollection, user.uid)

  await setDoc(
    userRef,
    {
      uid: user.uid,
      email: user.email || '',
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      photoUrl: user.photoURL || '',
      role: 'vendor',
      accountRole: 'vendor',
      accountStatus: 'active',
      isEmailVerified: user.emailVerified,
      isEmailOtpVerified: false,
      isPhoneVerified: false,
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    },
    { merge: true },
  )

  await setDoc(
    vendorRef,
    {
      userId: user.uid,
      businessName: input.businessName,
      businessEmail: user.email || '',
      businessPhone: input.phone,
      vendorStatus: 'pending',
      kycStatus: 'pending',
      status: 'pending',
      walletBalance: 0,
      rating: 0,
      totalSales: 0,
      isRestaurant: true,
      profileComplete: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

export const signInVendor = async (email: string, password: string) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password)
    await ensureVendorRole(result.user.uid)
    const otpVerified = await isVendorOtpVerifiedByUid(result.user.uid)
    if (!otpVerified) {
      await sendVendorEmailOtp(email).catch(() => undefined)
      throw new Error('Email OTP verification required. Check your email for the 6-digit code.')
    }
    await updateDoc(doc(db, usersCollection, result.user.uid), {
      lastLoginAt: serverTimestamp(),
      isEmailVerified: result.user.emailVerified,
    }).catch(() => undefined)
    return result.user
  } catch (error) {
    throw new Error(getFriendlyAuthError(error))
  }
}

export const signInVendorWithGoogle = async () => {
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })

  try {
    const result = await signInWithPopup(auth, provider)
    const user = result.user
    await ensureVendorRole(user.uid)

    const { firstName, lastName } = buildNamesFromDisplayName(user.displayName)

    await writeVendorUserDocs(user, {
      firstName,
      lastName,
      businessName: user.displayName || 'Blorbmart Vendor',
      phone: user.phoneNumber || '',
    })

    const otpVerified = await isVendorOtpVerifiedByUid(user.uid)
    if (!otpVerified) {
      if (user.email) await sendVendorEmailOtp(user.email).catch(() => undefined)
      throw new Error(`Email OTP verification required for ${user.email || 'your email'}. Check your email for the 6-digit code.`)
    }

    return user
  } catch (error) {
    throw new Error(getFriendlyAuthError(error))
  }
}

export const registerVendor = async (input: RegisterVendorInput) => {
  try {
    const result = await createUserWithEmailAndPassword(auth, input.email, input.password)
    const user = result.user

    await updateProfile(user, {
      displayName: `${input.firstName} ${input.lastName}`.trim(),
    })

    await writeVendorUserDocs(user, input)

    // Trigger welcome email from CEO (fire-and-forget)
    sendWelcomeEmail(input).catch(() => undefined)

    return {
      user,
      initials: getInitials(input.firstName, input.lastName),
    }
  } catch (error) {
    throw new Error(getFriendlyAuthError(error))
  }
}

/**
 * Send welcome email from CEO to new vendor
 * Called after successful registration (fire-and-forget)
 */
const sendWelcomeEmail = async (input: RegisterVendorInput) => {
  try {
    const response = await fetch(apiUrl('/api/vendor-auth/welcome-email'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: input.email,
        firstName: input.firstName,
        businessName: input.businessName,
        userType: 'vendor', // Specify this is a vendor
      }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      console.error('Failed to send welcome email:', payload.message)
    }
  } catch (error) {
    console.error('Welcome email error:', error)
  }
}

export const sendVendorEmailOtp = async (email: string) => {
  const response = await fetch(apiUrl('/api/vendor-auth/email-otp/send'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.message || 'Failed to send verification code')
  }
}

export const verifyVendorEmailOtp = async (email: string, code: string, uid?: string) => {
  const response = await fetch(apiUrl('/api/vendor-auth/email-otp/verify'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code, uid }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.message || 'Verification failed')
  }
}

export const isVendorOtpVerified = async () => {
  if (!auth.currentUser) return false
  const response = await fetch(apiUrl('/api/vendor-auth/email-otp/status'), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${await auth.currentUser.getIdToken()}`,
    },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) return false
  return Boolean(payload.data?.verified)
}

export const submitVendorKyc = async (uid: string, input: VendorKycInput) => {
  try {
    await setDoc(
      doc(db, vendorsCollection, uid),
      {
        address: input.address,
        businessType: input.businessType,
        vendorType: input.vendorType,
        state: input.state,
        lga: input.lga,
        idType: input.idType,
        idNumber: input.idNumber,
        cuisineTypes: input.cuisineTypes,
        selfieCaptured: input.selfieCaptured,
        vendorStatus: 'pending',
        kycStatus: 'pending',
        status: 'pending',
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
  } catch (error) {
    throw new Error(getFriendlyAuthError(error))
  }
}

export const sendVendorResetEmail = async (email: string) => {
  try {
    await sendPasswordResetEmail(auth, email)
  } catch (error) {
    throw new Error(getFriendlyAuthError(error))
  }
}

export const signOutVendor = async () => {
  await signOut(auth)
}

export const getVendorProfile = async (uid: string): Promise<VendorProfile | null> => {
  const snapshot = await getDoc(doc(db, vendorsCollection, uid))
  if (!snapshot.exists()) return null

  const data = snapshot.data()
  return {
    userId: String(data.userId || uid),
    businessName: String(data.businessName || ''),
    businessEmail: String(data.businessEmail || ''),
    businessPhone: String(data.businessPhone || ''),
    vendorStatus: String(data.vendorStatus || data.status || 'pending'),
    kycStatus: String(data.kycStatus || 'pending'),
    status: data.status ? String(data.status) : undefined,
    address: data.address ? String(data.address) : undefined,
    businessType: data.businessType ? String(data.businessType) : undefined,
    state: data.state ? String(data.state) : undefined,
    lga: data.lga ? String(data.lga) : undefined,
    idType: data.idType ? String(data.idType) : undefined,
    idNumber: data.idNumber ? String(data.idNumber) : undefined,
    cuisineTypes: Array.isArray(data.cuisineTypes) ? data.cuisineTypes.map(String) : [],
    selfieCaptured: Boolean(data.selfieCaptured),
    walletBalance: typeof data.walletBalance === 'number' ? data.walletBalance : 0,
    rating: typeof data.rating === 'number' ? data.rating : 0,
    totalSales: typeof data.totalSales === 'number' ? data.totalSales : 0,
    isRestaurant: Boolean(data.isRestaurant),
    profileComplete: Boolean(data.profileComplete),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  }
}

export const getVendorUserProfile = async (uid: string): Promise<VendorUserProfile | null> => {
  const snapshot = await getDoc(doc(db, usersCollection, uid))
  if (!snapshot.exists()) return null

  const data = snapshot.data()
  return {
    uid,
    email: String(data.email || ''),
    firstName: String(data.firstName || ''),
    lastName: String(data.lastName || ''),
    phone: String(data.phone || ''),
    photoUrl: String(data.photoUrl || ''),
    role: 'vendor',
    accountRole: 'vendor',
    accountStatus:
      data.accountStatus === 'inactive' || data.accountStatus === 'suspended'
        ? data.accountStatus
        : 'active',
    isEmailVerified: Boolean(data.isEmailVerified),
    isPhoneVerified: Boolean(data.isPhoneVerified),
    createdAt: toDate(data.createdAt),
    lastLoginAt: toDate(data.lastLoginAt),
  }
}
