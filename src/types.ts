export type UserRole = 'admin' | 'seller' | 'cashier';
export type OrderStatus = 'draft' | 'sent_to_cashier' | 'under_review' | 'confirmed' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'paid' | 'partial';

export interface Branch {
  id: string;
  name: string;
  slug: string;
  is_active?: boolean;
  created_at?: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  employee_code?: string;
  branch_id?: string | null;
  is_approved: boolean;
  is_active: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  description: string;
  price_buy: number;
  price_sell_before: number;
  price_sell_after: number;
  stock_quantity: number;
  min_stock_level: number;
  category: string;
  product_image?: string;
  is_active: boolean;
  is_deleted: boolean;
  updated_at?: string;
  updated_by?: string;
  created_by?: string;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: number;
  salesperson_id: string;
  salesperson_name: string;
  cashier_id: string | null;
  branch_id?: string | null;
  customer_name: string;
  customer_phone: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  total_original_price: number;
  total_final_price: number;
  notes: string;
  created_at: string;
  updated_at: string;
  sent_to_cashier_at?: string;
  confirmed_at?: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  total_price: number;
}

export interface Shortage {
  id: string;
  product_name: string;
  product_code?: string;
  notes: string;
  reported_by_id?: string;
  reported_by_name: string;
  branch_id?: string | null;
  is_resolved: boolean;
  created_at: string;
}

export interface Shift {
  id: string;
  user_id: string;
  branch_id?: string | null;
  status: 'active' | 'closed';
  start_time: string;
  end_time?: string | null;
  starting_cash?: number | null;
  ending_cash?: number | null;
  created_at?: string;
}
