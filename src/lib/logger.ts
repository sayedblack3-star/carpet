import { getSafeSession, supabase } from '../supabase';

const AUDIT_RETRYABLE_CODES = new Set(['408', '409', '42501', '429', '500', '502', '503', '504']);
const AUDIT_MAX_RETRIES = 2;
const AUDIT_RETRY_DELAY_MS = 180;
const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

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

const isRetryableAuditError = (error: {
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
    (error.code != null && AUDIT_RETRYABLE_CODES.has(error.code)) ||
    combined.includes('timeout') ||
    combined.includes('timed out') ||
    combined.includes('network') ||
    combined.includes('connection') ||
    combined.includes('temporarily unavailable')
  );
};

const insertAuditPayload = async (payload: Record<string, unknown>, attempt = 0) => {
  const { error } = await supabase.from('audit_logs').insert([payload]);

  if (!error) {
    return null;
  }

  if (attempt >= AUDIT_MAX_RETRIES || !isRetryableAuditError(error)) {
    return error;
  }

  await wait(AUDIT_RETRY_DELAY_MS * (attempt + 1));
  return insertAuditPayload(payload, attempt + 1);
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
      const error = await insertAuditPayload(payload);
      if (!error) {
        return;
      }

      lastError = error;
      if (!isSchemaCompatibilityError(error)) {
        break;
      }
    }

    if (lastError) {
      console.warn('Audit log insert skipped:', {
        action,
        branchId: branchId || null,
        message: lastError.message,
      });
    }
  } catch (error) {
    console.warn('Failed to log action:', {
      action,
      branchId: branchId || null,
      error,
    });
  }
};
