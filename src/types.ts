export interface Branch {
  id: string;
  name: string;
  location: string;
  is_active: boolean;
  created_at: string;
}

export type UserRole = 'owner' | 'admin' | 'branch_manager' | 'seller' | 'cashier' | 'price_manager';
export type OrderStatus = 'draft' | 'sent_to_cashier' | 'under_review' | 'confirmed' | 'cancelled';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  branch_id: string | null;
  is_approved: boolean;
  is_active: boolean;
  employee_code?: string;
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
  is_active: boolean;
  is_deleted: boolean;
  updated_at?: string;
  updated_by?: string;
  created_at: string;
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
  price_before_snapshot?: number;
  price_after_snapshot?: number;
  discount_percentage_snapshot?: number;
}

export interface Order {
  id: string;
  order_number: number;
  branch_id: string;
  salesperson_id: string;
  salesperson_name: string;
  cashier_id: string | null;
  status: OrderStatus;
  total_original_price: number;
  total_final_price: number;
  requires_manager_approval: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
  sent_to_cashier_at?: string;
  confirmed_at?: string;
}

export interface Shift {
  id: string;
  user_id: string;
  branch_id: string;
  start_time: string;
  end_time?: string;
  starting_cash: number;
  ending_cash: number;
  status: 'active' | 'closed';
}

export interface Notification {
  id: string;
  branch_id: string;
  sender_id: string;
  receiver_id?: string;
  order_id?: string;
  title: string;
  message: string;
  type: 'sale' | 'approval' | 'stock' | 'system';
  is_read: boolean;
  read_at?: string;
  created_at: string;
}

export interface Shortage {
  id: string;
  product_name: string;
  product_code?: string;
  notes: string;
  branch_id: string;
  reported_by_id?: string;
  reported_by_name: string;
  is_resolved: boolean;
  created_at: string;
}
