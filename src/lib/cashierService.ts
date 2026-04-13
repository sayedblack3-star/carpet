import { Order, OrderItem, Product } from '../types';
import { supabase } from '../supabase';
import { fetchProductsByIds, searchProducts } from './productService';

export type SellerMeta = Record<string, { employee_code?: string; full_name?: string }>;

export const fetchCashierOrders = async (
  branchEnabled: boolean,
  branchId?: string | null,
): Promise<Order[]> => {
  let query = supabase
    .from('orders')
    .select('*')
    .in('status', ['sent_to_cashier', 'under_review', 'confirmed']);

  if (branchEnabled && branchId) {
    query = query.eq('branch_id', branchId);
  }

  const { data, error } = await query.order('created_at', { ascending: false }).limit(50);
  if (error) throw error;
  return (data || []) as Order[];
};

export const fetchCashierProducts = async (searchTerm = '', limit = 6): Promise<Product[]> => {
  return searchProducts({
    searchTerm,
    limit,
    activeOnly: true,
  });
};

export const fetchCashierProductsByIds = async (productIds: string[]): Promise<Product[]> => {
  return fetchProductsByIds(productIds);
};

export const fetchCashierSellerMeta = async (
  branchEnabled: boolean,
  branchId?: string | null,
): Promise<SellerMeta> => {
  let query = supabase.from('profiles').select('id, full_name, employee_code');
  if (branchEnabled && branchId) {
    query = query.eq('branch_id', branchId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return ((data || []) as Array<{ id: string; full_name?: string; employee_code?: string }>).reduce<SellerMeta>((acc, profile) => {
    acc[profile.id] = {
      full_name: profile.full_name,
      employee_code: profile.employee_code,
    };
    return acc;
  }, {});
};

export const fetchCashierOrderItems = async (orderId: string): Promise<OrderItem[]> => {
  const { data, error } = await supabase.from('order_items').select('*').eq('order_id', orderId);
  if (error) throw error;
  return (data || []) as OrderItem[];
};

export const markOrderUnderReview = async (orderId: string) => {
  const { error } = await supabase
    .from('orders')
    .update({ status: 'under_review' })
    .eq('id', orderId)
    .neq('status', 'confirmed');

  if (error) throw error;
};

export const recalculateOrderTotals = async (orderId: string) => {
  const { data: items, error } = await supabase
    .from('order_items')
    .select('total_price, discount_amount')
    .eq('order_id', orderId);

  if (error || !items) {
    throw error ?? new Error('تعذر احتساب إجمالي الطلب.');
  }

  const totals = items.reduce(
    (acc, item) => {
      const totalPrice = typeof item.total_price === 'number' ? item.total_price : 0;
      const discountAmount = typeof item.discount_amount === 'number' ? item.discount_amount : 0;
      acc.totalFinal += totalPrice;
      acc.totalOriginal += totalPrice + discountAmount;
      return acc;
    },
    { totalFinal: 0, totalOriginal: 0 },
  );

  const { error: updateError } = await supabase
    .from('orders')
    .update({
      total_final_price: totals.totalFinal,
      total_original_price: totals.totalOriginal,
    })
    .eq('id', orderId);

  if (updateError) throw updateError;

  return totals;
};

export const updateCashierOrderItemQuantity = async (
  itemId: string,
  quantity: number,
  totalPrice: number,
  discountAmount: number,
) => {
  const { error } = await supabase
    .from('order_items')
    .update({
      quantity,
      total_price: totalPrice,
      discount_amount: discountAmount,
    })
    .eq('id', itemId);

  if (error) throw error;
};

export const deleteCashierOrderItem = async (itemId: string) => {
  const { error } = await supabase.from('order_items').delete().eq('id', itemId);
  if (error) throw error;
};

export const insertCashierOrderItem = async (payload: {
  order_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  total_price: number;
}) => {
  const { error } = await supabase.from('order_items').insert(payload);
  if (error) throw error;
};

export const confirmCashierOrder = async (payload: {
  orderId: string;
  cashierId?: string | null;
  confirmedAt: string;
}) => {
  const { error } = await supabase
    .from('orders')
    .update({
      status: 'confirmed',
      payment_status: 'paid',
      cashier_id: payload.cashierId || null,
      confirmed_at: payload.confirmedAt,
    })
    .eq('id', payload.orderId);

  if (error) throw error;
};

export const cancelCashierOrder = async (orderId: string) => {
  const { error } = await supabase.from('orders').update({ status: 'cancelled' }).eq('id', orderId);
  if (error) throw error;
};
