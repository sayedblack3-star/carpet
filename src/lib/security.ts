const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SAFE_PHONE_PATTERN = /^[+\d\s()-]{7,20}$/;
const STRONG_PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,}$/;

export const normalizeText = (value: string) => value.trim().replace(/\s+/g, ' ');

export const normalizeEmail = (value: string) => normalizeText(value).toLowerCase();

export const validateEmail = (value: string) => {
  const normalized = normalizeEmail(value);
  if (!EMAIL_PATTERN.test(normalized)) {
    return 'يرجى إدخال بريد إلكتروني صحيح.';
  }

  return null;
};

export const validateStrongPassword = (value: string) => {
  if (!STRONG_PASSWORD_PATTERN.test(value)) {
    return 'كلمة المرور يجب أن تكون 10 أحرف على الأقل وتحتوي على حرف كبير وحرف صغير ورقم.';
  }

  return null;
};

export const validateProductPayload = (payload: {
  code: string;
  name: string;
  size_label?: string;
  size_code?: string;
  price_buy: number;
  price_sell_before: number;
  price_sell_after: number;
  stock_quantity: number;
  min_stock_level: number;
}) => {
  if (!normalizeText(payload.code) || !normalizeText(payload.name)) {
    return 'كود المنتج واسم المنتج مطلوبان.';
  }

  if (payload.size_label && normalizeText(payload.size_label).length > 40) {
    return 'المقاس طويل أكثر من اللازم.';
  }

  if (payload.size_code && normalizeText(payload.size_code).length > 40) {
    return 'كود المقاس طويل أكثر من اللازم.';
  }

  if (payload.price_buy < 0 || payload.price_sell_before <= 0 || payload.price_sell_after < 0) {
    return 'الأسعار يجب أن تكون أرقامًا صحيحة وغير سالبة، وسعر البيع قبل الخصم يجب أن يكون أكبر من صفر.';
  }

  if (payload.price_sell_after > 0 && payload.price_sell_after > payload.price_sell_before) {
    return 'سعر البيع بعد الخصم لا يجوز أن يكون أكبر من سعر البيع قبل الخصم.';
  }

  if (payload.stock_quantity < 0 || payload.min_stock_level < 0) {
    return 'الكميات وحد التنبيه لا يجوز أن تكون سالبة.';
  }

  return null;
};

export const validateOrderInput = (input: {
  customerName: string;
  customerPhone: string;
  notes: string;
}) => {
  const customerName = normalizeText(input.customerName);
  const customerPhone = normalizeText(input.customerPhone);
  const notes = normalizeText(input.notes);

  if (customerName.length > 80) {
    return 'اسم العميل طويل أكثر من اللازم.';
  }

  if (customerPhone && !SAFE_PHONE_PATTERN.test(customerPhone)) {
    return 'رقم الهاتف يحتوي على صيغة غير مسموح بها.';
  }

  if (notes.length > 300) {
    return 'الملاحظات يجب ألا تتجاوز 300 حرف.';
  }

  return null;
};
