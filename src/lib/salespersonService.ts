import { supabase } from '../supabase';
import { Order, Product, Profile } from '../types';
import { searchProducts } from './productService';

export interface SellerProfileUpdatePayload {
  full_name: string;
  employee_code: string | null;
}

export interface OrderInsertPayload {
  salesperson_id: string;
  salesperson_name: string;
  customer_name: string;
  customer_phone: string;
  status: 'sent_to_cashier';
  payment_status: 'unpaid';
  total_original_price: number;
  total_final_price: number;
  notes: string;
  sent_to_cashier_at: string;
  branch_id?: string | null;
}

export interface OrderItemInsertPayload {
  order_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  total_price: number;
}

export const fetchSalespersonProfile = async (userId: string): Promise<Profile | null> => {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) throw error;
  return (data as Profile | null) ?? null;
};

export const fetchSalespersonProducts = async (searchTerm = '', limit = 24): Promise<Product[]> => {
  return searchProducts({
    searchTerm,
    limit,
    activeOnly: true,
  });
};

export const fetchSalespersonOrders = async (
  userId: string,
  options: { branchEnabled?: boolean; branchId?: string | null; limit?: number } = {},
): Promise<Order[]> => {
  const { branchEnabled = false, branchId, limit = 20 } = options;

  let query = supabase.from('orders').select('*').eq('salesperson_id', userId);
  if (branchEnabled && branchId) {
    query = query.eq('branch_id', branchId);
  }

  const { data, error } = await query.order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return (data || []) as Order[];
};

export const updateSalespersonProfile = async (userId: string, payload: SellerProfileUpdatePayload): Promise<void> => {
  const { error } = await supabase.from('profiles').update(payload).eq('id', userId);
  if (error) throw error;
};

export const createSalespersonOrder = async (
  orderPayload: OrderInsertPayload,
  items: Omit<OrderItemInsertPayload, 'order_id'>[],
): Promise<Order> => {
  const { data: order, error } = await supabase.from('orders').insert(orderPayload).select().single();
  if (error) throw error;

  const orderItems = items.map((item) => ({
    ...item,
    order_id: order.id,
  }));

  const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
  if (itemsError) throw itemsError;

  return order as Order;
};
