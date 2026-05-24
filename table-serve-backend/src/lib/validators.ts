import { z } from 'zod'

// ─── Auth ────────────────────────────────────

export const registerSuperAdminSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  masterPassword: z.string().min(1),
})

export const registerAdminSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  organizationName: z.string().min(2).max(100),
  organizationSlug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens'),
})

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

// ─── Organization ────────────────────────────

export const createOrganizationSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens'),
  ownerEmail: z.string().email(),
  ownerName: z.string().min(2).max(100),
  ownerPassword: z.string().min(8),
})

export const updateOrganizationProfileSchema = z.object({
  address: z.string().max(300).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional().or(z.literal('')),
  description: z.string().max(1000).optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  fontFamily: z.enum(['Inter', 'Roboto', 'Poppins', 'Playfair Display', 'Lato', 'Montserrat']).optional(),
  bannerUrl: z.union([z.string().url(), z.string().startsWith('data:')]).optional().or(z.literal('')),
  menuLayout: z.enum(['grid', 'list']).optional(),
  showCalories: z.boolean().optional(),
  showAllergens: z.boolean().optional(),
  showPreparationTime: z.boolean().optional(),
  showSpiceLevel: z.boolean().optional(),
  currencySymbol: z.string().max(5).optional(),
  currencyCode: z.string().length(3).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  serviceChargeRate: z.number().min(0).max(100).optional(),
  welcomeMessage: z.string().max(500).optional(),
  footerText: z.string().max(300).optional(),
  logoUrl: z.union([z.string().url(), z.string().startsWith('data:')]).optional().or(z.literal('')),
  supportName: z.string().max(100).optional(),
  orderEditWindowMinutes: z.number().int().min(0).max(60).optional(),
  socialLinks: z
    .object({
      instagram: z.string().optional(),
      facebook: z.string().optional(),
      twitter: z.string().optional(),
      website: z.string().optional(),
    })
    .optional(),
  receiptSettings: z
    .object({
      headerNote: z.string().max(300).optional(),
      footerNote: z.string().max(300).optional(),
      thankYouMessage: z.string().max(200).optional(),
      showTax: z.boolean().optional(),
      showServiceCharge: z.boolean().optional(),
      showOrderId: z.boolean().optional(),
      showLogo: z.boolean().optional(),
      showItemizedList: z.boolean().optional(),
    })
    .optional(),
})

export const suspendOrganizationSchema = z.object({
  reason: z.string().min(5).max(500),
})

export const updateSubscriptionSchema = z.object({
  plan: z.enum(['free', 'basic', 'premium']),
  expiryDays: z.number().int().min(1).max(3650).optional(),
})

// ─── Menu Category ───────────────────────────

export const createMenuCategorySchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(300).optional(),
  imageUrl: z.string().url().optional().or(z.literal('')),
  sortOrder: z.number().int().min(0).optional(),
})

export const updateMenuCategorySchema = createMenuCategorySchema.partial().extend({
  isActive: z.boolean().optional(),
})

// ─── Menu Item ───────────────────────────────

export const createMenuItemSchema = z.object({
  categoryId: z.string().optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(600).optional(),
  price: z.number().positive().max(99999.99),
  imageUrl: z.string().url().optional().or(z.literal('')),
  isChefSpecial: z.boolean().optional(),
  isVegetarian: z.boolean().optional(),
  isVegan: z.boolean().optional(),
  isGlutenFree: z.boolean().optional(),
  spiceLevel: z.enum(['none', 'mild', 'medium', 'hot']).optional(),
  allergens: z.array(z.string().max(50)).max(20).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  preparationTime: z.number().int().min(1).max(300).optional(),
  calories: z.number().int().min(0).max(10000).optional(),
  sortOrder: z.number().int().min(0).optional(),
})

export const updateMenuItemSchema = createMenuItemSchema.partial().extend({
  isAvailable: z.boolean().optional(),
})

// ─── Restaurant Table ────────────────────────

export const createRestaurantTableSchema = z.object({
  name: z.string().min(1).max(60),
  capacity: z.number().int().min(1).max(50).optional(),
  location: z.string().max(100).optional(),
})

export const updateRestaurantTableSchema = createRestaurantTableSchema.partial().extend({
  isActive: z.boolean().optional(),
})

// ─── Order ───────────────────────────────────

export const createOrderSchema = z.object({
  tableToken: z.string().min(1),
  customerName: z.string().min(1).max(100).optional(),
  customerPhone: z.string().max(20).optional(),
  notes: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        menuItemId: z.string().min(1),
        quantity: z.number().int().min(1).max(99),
        notes: z.string().max(200).optional(),
      })
    )
    .min(1)
    .max(50),
})

export const updateOrderStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'preparing', 'ready', 'served', 'cancelled']),
})

export const editOrderSchema = z.object({
  items: z
    .array(
      z.object({
        menuItemId: z.string().min(1),
        quantity: z.number().int().min(1).max(99),
        notes: z.string().max(200).optional(),
      })
    )
    .min(1)
    .max(50),
  notes: z.string().max(500).optional(),
})

// ─── Analytics query ─────────────────────────

export const analyticsQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  period: z.enum(['today', 'week', 'month', 'quarter', 'year', 'custom']).optional(),
  organizationId: z.string().optional(),
})

// ─── Waiter management ───────────────────────

export const createWaiterSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  tableIds: z.array(z.string()).default([]),
})

export const updateWaiterSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  tableIds: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
})

export const updateWaiterDutyStatusSchema = z.object({
  dutyStatus: z.enum(['on_duty', 'on_leave', 'off_shift']),
})

// ─── Table session / security ─────────────────

export const startSessionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  partySize: z.number().int().min(1).max(50).optional(),
  otp: z.string().length(6).optional(),
})

export const tableSessionSettingsSchema = z.object({
  collectCustomerDetails: z.boolean().optional(),
  requireOrderingOtp: z.boolean().optional(),
  requireSessionApproval: z.boolean().optional(),
})
