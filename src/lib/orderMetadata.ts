export type PaymentMethod = 'cash' | 'visa' | 'cash_and_visa';

export interface OrderMetadata {
  customerAddress?: string;
  paymentMethod?: PaymentMethod;
}

const METADATA_PREFIX = '[[META:';
const METADATA_SUFFIX = ']]';

export const serializeOrderNotes = (plainNotes: string, metadata: OrderMetadata) => {
  const cleanedNotes = plainNotes.trim();
  const normalizedMetadata: OrderMetadata = {};

  if (metadata.customerAddress?.trim()) {
    normalizedMetadata.customerAddress = metadata.customerAddress.trim();
  }

  if (metadata.paymentMethod) {
    normalizedMetadata.paymentMethod = metadata.paymentMethod;
  }

  if (!normalizedMetadata.customerAddress && !normalizedMetadata.paymentMethod) {
    return cleanedNotes;
  }

  return `${METADATA_PREFIX}${JSON.stringify(normalizedMetadata)}${METADATA_SUFFIX}${cleanedNotes ? `\n${cleanedNotes}` : ''}`;
};

export const parseOrderNotes = (value?: string | null): { plainNotes: string; metadata: OrderMetadata } => {
  if (!value) {
    return { plainNotes: '', metadata: {} };
  }

  if (!value.startsWith(METADATA_PREFIX)) {
    return { plainNotes: value, metadata: {} };
  }

  const suffixIndex = value.indexOf(METADATA_SUFFIX);
  if (suffixIndex === -1) {
    return { plainNotes: value, metadata: {} };
  }

  try {
    const rawJson = value.slice(METADATA_PREFIX.length, suffixIndex);
    const parsed = JSON.parse(rawJson) as OrderMetadata;
    const plainNotes = value.slice(suffixIndex + METADATA_SUFFIX.length).trim();
    return {
      plainNotes,
      metadata: {
        customerAddress: parsed.customerAddress?.trim(),
        paymentMethod: parsed.paymentMethod,
      },
    };
  } catch {
    return { plainNotes: value, metadata: {} };
  }
};

export const getPaymentMethodLabel = (paymentMethod?: PaymentMethod) => {
  switch (paymentMethod) {
    case 'cash':
      return 'كاش';
    case 'visa':
      return 'فيزا';
    case 'cash_and_visa':
      return 'كاش + فيزا';
    default:
      return 'غير محدد';
  }
};
