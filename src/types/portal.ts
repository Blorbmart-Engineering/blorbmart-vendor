import type { FoodItem, Notif, Order, Txn } from '../data/mock'

export interface WalletOverview {
  walletId: string
  availableBalance: number
  pendingBalance: number
  totalEarned: number
  isWithdrawalEnabled: boolean
  pinSet: boolean
  pinLockedUntil?: string | null
  bankAccount: BankAccount | null
}

export interface WalletSummary {
  earningsWeek: number
  earningsMonth: number
  ordersThisMonth: number
  averageOrderValue: number
}

export interface BankAccount {
  id: string
  walletId: string
  bankCode: string
  bankName: string
  accountName: string
  accountMasked: string | null
  isVerified: boolean
  paystackRecipientCode?: string | null
}

export interface WithdrawalRecord {
  id: string
  amount: number
  status: string
  initiatedAt?: string | null
  completedAt?: string | null
  failureReason?: string | null
  bankName?: string | null
  accountMasked?: string | null
  reference?: string | null
}

export interface VendorOrder extends Order {
  backendStatus: string
  createdAtMs: number
}

export interface PreorderConfig {
  enabled: boolean
  fulfillmentDays: string[]
  fulfillmentTime: string
  cutoffHoursBefore: number
  maxOrdersPerDay: number | null
  allowAsapWhenOpen: boolean
}

export interface VendorDashboardData {
  wallet: WalletOverview | null
  summary: WalletSummary | null
  txns: Txn[]
  withdrawals: WithdrawalRecord[]
  orders: VendorOrder[]
  foodItems: FoodItem[]
  notifications: Notif[]
  chart: { d: string; v: number }[]
}
