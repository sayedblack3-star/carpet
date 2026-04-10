import { getSafeSession, supabase } from '../supabase';

const buildAuditDetails = (details: unknown, branchId?: string) => {
  const normalized: Record<string, unknown> =
    typeof details === 'string'
      ? { message: details }
      : details && typeof details === 'object'
        ? { ...(details as Record<string, unknown>) }
        : details == null
          ? {}
          : { value: details };

  if (branchId && !('branchId' in normalized) && !('branch_id' in normalized)) {
    normalized.branch_id = branchId;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
};

const isSchemaCompatibilityError = (error: {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}) => {
  const combined = [error.code, error.message, error.details, error.hint]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return (
    error.code === 'PGRST204' ||
    error.code === '42703' ||
    combined.includes('schema cache') ||
    combined.includes('could not find') ||
    combined.includes('column')
  );
};

export const logAction = async (action: string, details: string | any, branchId?: string) => {
  try {
    const session = await getSafeSession();
    const user = session?.user;
    if (!user) return;

    const auditDetails = buildAuditDetails(details, branchId);
    const minimalAuditDetails = branchId ? { branch_id: branchId } : auditDetails;
    const basePayload = {
      action,
      user_id: user.id,
    };
    const emailPayload = user.email ? { ...basePayload, user_email: user.email } : basePayload;
    const payloads = auditDetails
      ? [
          {
            ...emailPayload,
            details: auditDetails,
          },
          {
            ...basePayload,
            details: minimalAuditDetails,
          },
          emailPayload,
          basePayload,
        ]
      : [emailPayload, basePayload];

    let lastError: { message?: string | null } | null = null;

    for (const payload of payloads) {
      const { error } = await supabase.from('audit_logs').insert([payload]);

      if (!error) {
        return;
      }

      lastError = error;
      if (!isSchemaCompatibilityError(error)) {
        break;
      }
    }

    if (lastError) {
      console.warn('Audit log insert skipped:', lastError.message);
    }
  } catch (error) {
    console.warn('Failed to log action:', error);
  }
};
