import { format, startOfDay, subDays } from 'date-fns';

import { supabase } from '../supabase';
import { Branch, Order, OrderItem, Product, Profile, Shift } from '../types';

const QUERY_TIMEOUT_MS = 6000;
const QUERY_RETRY_DELAY_MS = 700;

export const DASHBOARD_POLL_INTERVAL_MS = 30000;

export type DashboardDateRange = 'today' | 'week' | 'month' | 'all';

export interface DashboardSnapshot {
  orders: Order[];
  products: Product[];
  users: Profile[];
  orderItems: OrderItem[];
  shifts: Shift[];
  branches: Branch[];
  hasPartialFailure: boolean;
  lastUpdated: string;
}

type QueryPayload<T> = {
  data: T[] | null;
  error: { message?: string } | null;
};

const delay = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const isTransientNetworkError = (error: unknown) => {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('load failed') ||
    message.includes('fetch') ||
    message.includes('timeout')
  );
};

const runQueryWithTimeout = async <T,>(
  runQuery: (signal: AbortSignal) => PromiseLike<T>,
  timeoutMs = QUERY_TIMEOUT_MS,
): Promise<T> => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(new DOMException('timeout', 'AbortError')), timeoutMs);

  try {
    return await Promise.resolve(runQuery(controller.signal));
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const queryWithRetry = async <T,>(runQuery: (signal: AbortSignal) => PromiseLike<T>, retries = 1): Promise<T> => {
  try {
    return await runQueryWithTimeout(runQuery);
  } catch (error) {
    if (retries <= 0 || !isTransientNetworkError(error)) {
      throw error;
    }

    await delay(QUERY_RETRY_DELAY_MS);
    return queryWithRetry(runQuery, retries - 1);
  }
};

const buildOrdersQuery = (dateRange: DashboardDateRange) => {
  let query = supabase.from('orders').select('*');
  const now = new Date();

  if (dateRange === 'today') {
    query = query.gte('created_at', startOfDay(now).toISOString());
  } else if (dateRange === 'week') {
    query = query.gte('created_at', subDays(now, 7).toISOString());
  } else if (dateRange === 'month') {
    query = query.gte('created_at', subDays(now, 30).toISOString());
  }

  return query.order('created_at', { ascending: false });
};

const getSettledData = <T,>(result: PromiseSettledResult<QueryPayload<T>>): T[] => {
  if (result.status !== 'fulfilled' || result.value.error) {
    return [];
  }

  return (result.value.data || []) as T[];
};

const hasFailedResult = <T,>(result: PromiseSettledResult<QueryPayload<T>>) =>
  result.status === 'rejected' || Boolean(result.value.error);

export const canRefreshDashboard = () => {
  const isVisible = typeof document === 'undefined' || document.visibilityState === 'visible';
  const isOnline = typeof navigator === 'undefined' || navigator.onLine;
  return isVisible && isOnline;
};

export const fetchDashboardSnapshot = async (dateRange: DashboardDateRange): Promise<DashboardSnapshot> => {
  const dashboardRequests: Array<Promise<QueryPayload<any>>> = [
    queryWithRetry((signal) => buildOrdersQuery(dateRange).abortSignal(signal)),
    queryWithRetry((signal) => supabase.from('products').select('*').eq('is_deleted', false).abortSignal(signal)),
    queryWithRetry((signal) => supabase.from('profiles').select('*').abortSignal(signal)),
    queryWithRetry((signal) => supabase.from('order_items').select('*').abortSignal(signal)),
    queryWithRetry((signal) =>
      supabase.from('shifts').select('*').order('start_time', { ascending: false }).limit(50).abortSignal(signal),
    ),
    queryWithRetry((signal) =>
      supabase.from('branches').select('id, name, slug, is_active').eq('is_active', true).order('name').abortSignal(signal),
    ),
  ];

  const [ordersResult, productsResult, usersResult, orderItemsResult, shiftsResult, branchesResult] =
    await Promise.allSettled(dashboardRequests);

  const settledResults = [ordersResult, productsResult, usersResult, orderItemsResult, shiftsResult, branchesResult];

  return {
    orders: getSettledData<Order>(ordersResult),
    products: getSettledData<Product>(productsResult),
    users: getSettledData<Profile>(usersResult),
    orderItems: getSettledData<OrderItem>(orderItemsResult),
    shifts: getSettledData<Shift>(shiftsResult),
    branches: getSettledData<Branch>(branchesResult),
    hasPartialFailure: settledResults.some((result) => hasFailedResult(result)),
    lastUpdated: format(new Date(), 'HH:mm'),
  };
};
