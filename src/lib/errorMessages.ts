const stringifyError = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }

  return '';
};

export const toFriendlyErrorMessage = (error: unknown, fallback = 'حدث خطأ غير متوقع. حاول مرة أخرى.') => {
  const message = stringifyError(error).trim();
  if (!message) return fallback;

  const normalized = message.toLowerCase();

  if (
    normalized.includes('failed to fetch') ||
    normalized.includes('networkerror') ||
    normalized.includes('network request failed') ||
    normalized.includes('load failed') ||
    normalized.includes('timeout')
  ) {
    return 'الاتصال بالإنترنت غير مستقر حاليًا. تأكد من الشبكة ثم حاول مرة أخرى.';
  }

  if (normalized.includes('invalid login')) {
    return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
  }

  if (normalized.includes('already registered') || normalized.includes('already exists')) {
    return 'هذا السجل موجود بالفعل.';
  }

  if (normalized.includes('jwt') || normalized.includes('session')) {
    return 'انتهت الجلسة الحالية. سجل الدخول مرة أخرى ثم أعد المحاولة.';
  }

  if (normalized.includes('permission denied') || normalized.includes('not allowed') || normalized.includes('forbidden')) {
    return 'ليس لديك الصلاحية لتنفيذ هذه العملية.';
  }

  return message;
};
