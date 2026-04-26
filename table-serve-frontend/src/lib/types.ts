export type UserRole = 'user' | 'superadmin'
export type OrgStatus = 'active' | 'suspended' | 'trial' | 'inactive'
export type SubscriptionPlan = 'free' | 'basic' | 'premium'
export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'cancelled'
export type SpiceLevel = 'none' | 'mild' | 'medium' | 'hot'
export type MenuLayout = 'grid' | 'list'
export type MemberRole = 'owner' | 'admin' | 'manager' | 'staff'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  banned: boolean
  banReason?: string
  createdAt: string
}

export interface Organization {
  id: string
  name: string
  slug: string
  logo?: string
  createdAt: string
}

export interface OrganizationProfile {
  id: string
  organizationId: string
  address?: string
  phone?: string
  email?: string
  website?: string
  description?: string
  status: OrgStatus
  subscriptionPlan: SubscriptionPlan
  subscriptionExpiry?: string
  primaryColor: string
  secondaryColor: string
  accentColor: string
  fontFamily: string
  bannerUrl?: string
  menuLayout: MenuLayout
  showCalories: boolean
  showAllergens: boolean
  showPreparationTime: boolean
  showSpiceLevel: boolean
  currencySymbol: string
  currencyCode: string
  taxRate: string
  serviceChargeRate: string
  welcomeMessage?: string
  footerText?: string
  socialLinks?: {
    instagram?: string
    facebook?: string
    twitter?: string
    website?: string
  }
}

export interface OrganizationWithProfile {
  organization: Organization
  organization_profile: OrganizationProfile
}

export interface Member {
  id: string
  role: MemberRole
  createdAt: string
  userId: string
  name: string
  email: string
}

export interface MenuCategory {
  id: string
  organizationId: string
  name: string
  description?: string
  imageUrl?: string
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface MenuItem {
  id: string
  organizationId: string
  categoryId?: string
  name: string
  description?: string
  price: string
  imageUrl?: string
  isAvailable: boolean
  isChefSpecial: boolean
  isVegetarian: boolean
  isVegan: boolean
  isGlutenFree: boolean
  spiceLevel: SpiceLevel
  allergens: string[]
  tags: string[]
  preparationTime?: number
  calories?: number
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface RestaurantTable {
  id: string
  organizationId: string
  name: string
  nfcToken: string
  capacity: number
  location?: string
  isActive: boolean
  createdAt: string
}

export interface Order {
  id: string
  organizationId: string
  tableId?: string
  tableName?: string
  customerName?: string
  customerPhone?: string
  status: OrderStatus
  subtotal: string
  taxAmount: string
  serviceCharge: string
  totalAmount: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface OrderItem {
  id: string
  orderId: string
  menuItemId: string
  menuItemName: string
  quantity: number
  unitPrice: string
  totalPrice: string
  notes?: string
}

export interface PlatformStats {
  organizations: number
  activeOrganizations: number
  suspendedOrganizations: number
  users: number
  orders: number
  totalRevenue: string
}

export interface AnalyticsSummary {
  totalOrders: number
  totalRevenue: string
  avgOrderValue: string
}

export interface TopItem {
  menuItemId: string
  name: string
  totalQuantity: string
  totalRevenue: string
  orderCount?: number
}

export interface DailyRevenue {
  date: string
  revenue: string
  orders: number
}

export interface AnalyticsResponse {
  period: { from: string; to: string }
  summary: AnalyticsSummary
  byStatus?: { status: OrderStatus; count: number }[]
  topItems: TopItem[]
  slowItems?: TopItem[]
  dailyRevenue: DailyRevenue[]
  hourlyDistribution?: { hour: number; orders: number }[]
  revenueByCategory?: { categoryId?: string; categoryName?: string; totalRevenue: string; totalQuantity: string }[]
}

export interface CartItem {
  menuItem: MenuItem
  quantity: number
  notes?: string
}

export interface ApiError {
  error: string
}
