import { supabase } from '../supabase';
import type { Product } from '../types';

export interface ProductListResult {
  products: Product[];
  totalCount: number;
}

interface ProductQueryOptions {
  searchTerm?: string;
  page?: number;
  pageSize?: number;
  activeOnly?: boolean;
}

const PRODUCT_COLUMNS =
  'id,code,name,size_label,size_code,description,price_buy,price_sell_before,price_sell_after,stock_quantity,min_stock_level,category,is_active,is_deleted,updated_at,created_at';

const normalizeProductSearch = (value: string) => value.trim();

const applyProductSearch = (query: any, searchTerm?: string) => {
  const normalizedSearch = normalizeProductSearch(searchTerm || '');
  if (!normalizedSearch) return query;

  const escaped = normalizedSearch.replace(/[%_,]/g, (match) => `\\${match}`);
  return query.or(`code.ilike.%${escaped}%,name.ilike.%${escaped}%`);
};

export const fetchProductList = async ({
  searchTerm = '',
  page = 1,
  pageSize = 24,
  activeOnly = false,
}: ProductQueryOptions = {}): Promise<ProductListResult> => {
  const from = Math.max(0, (page - 1) * pageSize);
  const to = from + pageSize - 1;

  let query = supabase
    .from('products')
    .select(PRODUCT_COLUMNS, { count: 'exact' })
    .eq('is_deleted', false);

  if (activeOnly) {
    query = query.eq('is_active', true);
  }

  query = applyProductSearch(query, searchTerm);

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw error;

  return {
    products: (data || []) as Product[],
    totalCount: count || 0,
  };
};

export const searchProducts = async ({
  searchTerm = '',
  limit = 12,
  activeOnly = true,
}: {
  searchTerm?: string;
  limit?: number;
  activeOnly?: boolean;
} = {}): Promise<Product[]> => {
  const normalizedSearch = normalizeProductSearch(searchTerm);
  if (!normalizedSearch) return [];

  let query = supabase
    .from('products')
    .select(PRODUCT_COLUMNS)
    .eq('is_deleted', false);

  if (activeOnly) {
    query = query.eq('is_active', true);
  }

  query = applyProductSearch(query, normalizedSearch);

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as Product[];
};

export const fetchProductsByIds = async (productIds: string[]): Promise<Product[]> => {
  if (productIds.length === 0) return [];

  const uniqueIds = [...new Set(productIds)];
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_COLUMNS)
    .in('id', uniqueIds);

  if (error) throw error;
  return (data || []) as Product[];
};

export const findProductByCode = async (code: string): Promise<Product | null> => {
  const normalizedCode = normalizeProductSearch(code);
  if (!normalizedCode) return null;

  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_COLUMNS)
    .eq('code', normalizedCode)
    .maybeSingle();

  if (error) throw error;
  return (data as Product | null) ?? null;
};
