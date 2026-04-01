import { supabase } from '../supabase';

export const logAction = async (action: string, details: string | any, branchId?: string) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;

    await supabase.from('audit_logs').insert([{
      action,
      user_id: user.id,
      user_email: user.email,
      user_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email,
      entity_type: 'system',
      details: { message: details, branchId: branchId || null }
    }]);
  } catch (error) {
    console.error('Failed to log action:', error);
  }
};
