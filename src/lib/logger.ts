import { supabase } from '../supabase';

export const logAction = async (action: string, details: string | any, branchId?: string) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;

    // Keep the client-side audit payload minimal so it remains compatible
    // with older live schemas during rollout and does not spam 400s in the console.
    const { error } = await supabase.from('audit_logs').insert([
      {
        action,
        user_id: user.id,
        user_email: user.email,
      },
    ]);

    if (error) {
      console.warn('Audit log insert skipped:', error.message);
    }
  } catch (error) {
    console.warn('Failed to log action:', error);
  }
};
