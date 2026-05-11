export interface VendorUserProfile {
  uid: string
  email: string
  firstName: string
  lastName: string
  phone: string
  photoUrl: string
  role: 'vendor'
  accountRole: 'vendor'
  accountStatus: 'active' | 'inactive' | 'suspended'
  isEmailVerified: boolean
  isPhoneVerified: boolean
  createdAt?: Date | null
  lastLoginAt?: Date | null
}

export interface VendorProfile {
  userId: string
  businessName: string
  businessEmail: string
  businessPhone: string
  vendorStatus: string
  kycStatus: string
  status?: string
  address?: string
  businessType?: string
  state?: string
  lga?: string
  idType?: string
  idNumber?: string
  cuisineTypes?: string[]
  selfieCaptured?: boolean
  walletBalance?: number
  rating?: number
  totalSales?: number
  isRestaurant?: boolean
  profileComplete?: boolean
  createdAt?: Date | null
  updatedAt?: Date | null
}
