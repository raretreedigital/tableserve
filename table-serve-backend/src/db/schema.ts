import {
  pgTable,
  text,
  boolean,
  timestamp,
  integer,
  numeric,
  jsonb,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ─────────────────────────────────────────────
// better-auth core tables
// ─────────────────────────────────────────────

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  // admin plugin fields
  role: text('role').notNull().default('user'),
  banned: boolean('banned').default(false),
  banReason: text('ban_reason'),
  banExpires: timestamp('ban_expires'),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  activeOrganizationId: text('active_organization_id'),
  impersonatedBy: text('impersonated_by'),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
})

// ─────────────────────────────────────────────
// better-auth organization plugin tables
// ─────────────────────────────────────────────

export const organization = pgTable('organization', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').unique(),
  logo: text('logo'),
  createdAt: timestamp('created_at').notNull(),
  metadata: text('metadata'),
})

export const member = pgTable('member', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  createdAt: timestamp('created_at').notNull(),
})

export const invitation = pgTable('invitation', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: text('role'),
  status: text('status').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  inviterId: text('inviter_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull(),
})

// ─────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────

export const orgStatusEnum = pgEnum('org_status', ['active', 'suspended', 'trial', 'inactive'])
export const subscriptionPlanEnum = pgEnum('subscription_plan', ['free', 'basic', 'premium'])
export const orderStatusEnum = pgEnum('order_status', ['pending', 'confirmed', 'preparing', 'ready', 'served', 'cancelled'])
export const spiceLevelEnum = pgEnum('spice_level', ['none', 'mild', 'medium', 'hot'])
export const menuLayoutEnum = pgEnum('menu_layout', ['grid', 'list'])

// ─────────────────────────────────────────────
// Organization profile (extends better-auth org)
// ─────────────────────────────────────────────

export const organizationProfile = pgTable('organization_profile', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().unique().references(() => organization.id, { onDelete: 'cascade' }),
  address: text('address'),
  phone: text('phone'),
  email: text('email'),
  website: text('website'),
  description: text('description'),
  status: orgStatusEnum('status').notNull().default('trial'),
  subscriptionPlan: subscriptionPlanEnum('subscription_plan').notNull().default('free'),
  subscriptionExpiry: timestamp('subscription_expiry'),
  // Customization
  primaryColor: text('primary_color').notNull().default('#1a1a1a'),
  secondaryColor: text('secondary_color').notNull().default('#f5f5f5'),
  accentColor: text('accent_color').notNull().default('#e85d04'),
  fontFamily: text('font_family').notNull().default('Inter'),
  bannerUrl: text('banner_url'),
  menuLayout: menuLayoutEnum('menu_layout').notNull().default('grid'),
  showCalories: boolean('show_calories').notNull().default(true),
  showAllergens: boolean('show_allergens').notNull().default(true),
  showPreparationTime: boolean('show_preparation_time').notNull().default(true),
  showSpiceLevel: boolean('show_spice_level').notNull().default(true),
  currencySymbol: text('currency_symbol').notNull().default('$'),
  currencyCode: text('currency_code').notNull().default('USD'),
  taxRate: numeric('tax_rate', { precision: 5, scale: 2 }).notNull().default('0'),
  serviceChargeRate: numeric('service_charge_rate', { precision: 5, scale: 2 }).notNull().default('0'),
  welcomeMessage: text('welcome_message'),
  footerText: text('footer_text'),
  socialLinks: jsonb('social_links'),
  logoUrl: text('logo_url'),
  orderEditWindowMinutes: integer('order_edit_window_minutes').notNull().default(5),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// ─────────────────────────────────────────────
// Restaurant Tables (physical tables with NFC)
// ─────────────────────────────────────────────

export const restaurantTable = pgTable('restaurant_table', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  nfcToken: text('nfc_token').notNull().unique(),
  capacity: integer('capacity').notNull().default(4),
  location: text('location'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// ─────────────────────────────────────────────
// Menu Categories
// ─────────────────────────────────────────────

export const menuCategory = pgTable('menu_category', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  imageUrl: text('image_url'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// ─────────────────────────────────────────────
// Menu Items
// ─────────────────────────────────────────────

export const menuItem = pgTable('menu_item', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  categoryId: text('category_id').references(() => menuCategory.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  description: text('description'),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  imageUrl: text('image_url'),
  isAvailable: boolean('is_available').notNull().default(true),
  isChefSpecial: boolean('is_chef_special').notNull().default(false),
  isVegetarian: boolean('is_vegetarian').notNull().default(false),
  isVegan: boolean('is_vegan').notNull().default(false),
  isGlutenFree: boolean('is_gluten_free').notNull().default(false),
  spiceLevel: spiceLevelEnum('spice_level').notNull().default('none'),
  allergens: text('allergens').array().notNull().default([]),
  tags: text('tags').array().notNull().default([]),
  preparationTime: integer('preparation_time'),
  calories: integer('calories'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// ─────────────────────────────────────────────
// Orders
// ─────────────────────────────────────────────

export const order = pgTable('order', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  tableId: text('table_id').references(() => restaurantTable.id, { onDelete: 'set null' }),
  tableName: text('table_name'),
  customerName: text('customer_name'),
  customerPhone: text('customer_phone'),
  status: orderStatusEnum('status').notNull().default('pending'),
  subtotal: numeric('subtotal', { precision: 10, scale: 2 }).notNull(),
  taxAmount: numeric('tax_amount', { precision: 10, scale: 2 }).notNull().default('0'),
  serviceCharge: numeric('service_charge', { precision: 10, scale: 2 }).notNull().default('0'),
  totalAmount: numeric('total_amount', { precision: 10, scale: 2 }).notNull(),
  notes: text('notes'),
  editableUntil: timestamp('editable_until'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const orderItem = pgTable('order_item', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull().references(() => order.id, { onDelete: 'cascade' }),
  menuItemId: text('menu_item_id').notNull().references(() => menuItem.id, { onDelete: 'restrict' }),
  menuItemName: text('menu_item_name').notNull(),
  quantity: integer('quantity').notNull(),
  unitPrice: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
  totalPrice: numeric('total_price', { precision: 10, scale: 2 }).notNull(),
  notes: text('notes'),
})

// ─────────────────────────────────────────────
// Waiter Assignments
// ─────────────────────────────────────────────

export const waiterAssignment = pgTable('waiter_assignment', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  tableIds: text('table_ids').notNull().default('[]'), // JSON array of restaurantTable IDs
  isActive: boolean('is_active').notNull().default(true),
  dutyStatus: text('duty_status').notNull().default('on_duty'), // on_duty | on_leave | off_shift
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// ─────────────────────────────────────────────
// Relations
// ─────────────────────────────────────────────

export const organizationRelations = relations(organization, ({ one, many }) => ({
  profile: one(organizationProfile, { fields: [organization.id], references: [organizationProfile.organizationId] }),
  members: many(member),
  tables: many(restaurantTable),
  categories: many(menuCategory),
  items: many(menuItem),
  orders: many(order),
}))

export const menuCategoryRelations = relations(menuCategory, ({ one, many }) => ({
  organization: one(organization, { fields: [menuCategory.organizationId], references: [organization.id] }),
  items: many(menuItem),
}))

export const menuItemRelations = relations(menuItem, ({ one }) => ({
  organization: one(organization, { fields: [menuItem.organizationId], references: [organization.id] }),
  category: one(menuCategory, { fields: [menuItem.categoryId], references: [menuCategory.id] }),
}))

export const orderRelations = relations(order, ({ one, many }) => ({
  organization: one(organization, { fields: [order.organizationId], references: [organization.id] }),
  table: one(restaurantTable, { fields: [order.tableId], references: [restaurantTable.id] }),
  items: many(orderItem),
}))

export const orderItemRelations = relations(orderItem, ({ one }) => ({
  order: one(order, { fields: [orderItem.orderId], references: [order.id] }),
  menuItem: one(menuItem, { fields: [orderItem.menuItemId], references: [menuItem.id] }),
}))

export const waiterAssignmentRelations = relations(waiterAssignment, ({ one }) => ({
  organization: one(organization, { fields: [waiterAssignment.organizationId], references: [organization.id] }),
  user: one(user, { fields: [waiterAssignment.userId], references: [user.id] }),
}))
