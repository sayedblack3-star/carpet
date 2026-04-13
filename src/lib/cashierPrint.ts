import { format } from 'date-fns';

import { appClient } from '../config/appClient';
import type { Order, OrderItem, Product } from '../types';
import { getPaymentMethodLabel, parseOrderNotes } from './orderMetadata';
import type { SellerMeta } from './cashierService';

const moneyFormatter = new Intl.NumberFormat('ar-EG');

type PrintCashierInvoiceParams = {
  order: Order;
  orderItems: OrderItem[];
  products: Product[];
  sellerMeta: SellerMeta;
  branchEnabled?: boolean;
  branchName?: string;
};

export const printCashierInvoice = ({
  order,
  orderItems,
  products,
  sellerMeta,
  branchEnabled = false,
  branchName,
}: PrintCashierInvoiceParams): { ok: true } | { ok: false; reason: 'popup_blocked' } => {
  const productLookup = products.reduce<Record<string, Product>>((acc, product) => {
    acc[product.id] = product;
    return acc;
  }, {});

  const sellerCode = sellerMeta[order.salesperson_id]?.employee_code;
  const { plainNotes, metadata } = parseOrderNotes(order.notes);
  const invoiceTotal = orderItems.reduce((sum, item) => sum + (item.total_price || 0), 0) || order.total_final_price || 0;
  const invoiceDiscount = Math.max(0, (order.total_original_price || 0) - invoiceTotal);
  const printWindow = window.open('', '_blank');

  if (!printWindow) {
    return { ok: false, reason: 'popup_blocked' };
  }

  const rows = orderItems
    .map((item) => {
      const product = productLookup[item.product_id];
      const unitBeforeDiscount = item.quantity > 0 ? item.unit_price + (item.discount_amount || 0) / item.quantity : item.unit_price;
      return `
        <tr>
          <td>${product?.code || '-'}</td>
          <td>${item.product_name}</td>
          <td>${item.quantity}</td>
          <td>${moneyFormatter.format(unitBeforeDiscount)} ج.م</td>
          <td>${moneyFormatter.format(item.unit_price)} ج.م</td>
          <td>${moneyFormatter.format(item.total_price)} ج.م</td>
        </tr>`;
    })
    .join('');

  printWindow.document.write(`
    <html lang="ar" dir="rtl">
      <head>
        <title>فاتورة رقم ${order.order_number}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
          .sheet { max-width: 900px; margin: 0 auto; }
          .header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; margin-bottom: 24px; }
          .brand { background: linear-gradient(135deg, #0f172a, #1d4ed8); color: white; border-radius: 24px; padding: 20px 24px; min-width: 280px; }
          .brand h1 { margin: 0 0 8px; font-size: 28px; }
          .meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; width: 100%; }
          .meta-card { border: 1px solid #e2e8f0; border-radius: 18px; padding: 14px 16px; background: #f8fafc; }
          .meta-card small { display: block; color: #64748b; margin-bottom: 6px; font-weight: 700; }
          table { width: 100%; border-collapse: collapse; margin: 24px 0; }
          th, td { border-bottom: 1px solid #e2e8f0; padding: 14px 12px; text-align: right; }
          th { background: #eff6ff; color: #1e3a8a; font-size: 13px; }
          .summary { margin-top: 20px; margin-right: auto; width: min(320px, 100%); }
          .summary-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-weight: 700; }
          .summary-row.total { font-size: 24px; color: #0f172a; border-bottom: none; }
          .note { margin-top: 16px; padding: 14px 16px; border-radius: 18px; background: #fff7ed; border: 1px solid #fed7aa; color: #9a3412; font-weight: 700; }
          .footer { margin-top: 36px; text-align: center; color: #64748b; font-weight: 700; }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="header">
            <div class="brand">
              <h1>${appClient.companyNameEn}</h1>
              <div>فاتورة تحصيل رقم #${order.order_number}</div>
              <div>${format(new Date(order.created_at), 'yyyy-MM-dd HH:mm')}</div>
            </div>
            <div class="meta"></div>
          </div>
        </div>
      </body>
    </html>
  `);

  const metaContainer = printWindow.document.querySelector('.meta');
  if (metaContainer) {
    metaContainer.innerHTML = `
      <div class="meta-card"><small>البائع</small><div>${order.salesperson_name || '-'}</div></div>
      <div class="meta-card"><small>كود البائع</small><div>${sellerCode || '-'}</div></div>
      <div class="meta-card"><small>اسم العميل</small><div>${order.customer_name || '-'}</div></div>
      <div class="meta-card"><small>الهاتف</small><div>${order.customer_phone || '-'}</div></div>
      <div class="meta-card"><small>العنوان</small><div>${metadata.customerAddress || '-'}</div></div>
      <div class="meta-card"><small>طريقة الدفع</small><div>${getPaymentMethodLabel(metadata.paymentMethod)}</div></div>
      <div class="meta-card"><small>الفرع</small><div>${branchEnabled && branchName ? branchName : 'غير محدد'}</div></div>
      <div class="meta-card"><small>حالة الطلب</small><div>${order.status === 'confirmed' ? 'تم التحصيل' : 'قيد المعالجة'}</div></div>
    `;
  }

  printWindow.document.body.insertAdjacentHTML(
    'beforeend',
    `
      <table>
        <thead>
          <tr>
            <th>كود المنتج</th>
            <th>الصنف</th>
            <th>الكمية</th>
            <th>قبل الخصم</th>
            <th>بعد الخصم</th>
            <th>الإجمالي</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="summary">
        <div class="summary-row"><span>الإجمالي قبل الخصم</span><span>${moneyFormatter.format(order.total_original_price || invoiceTotal)} ج.م</span></div>
        <div class="summary-row"><span>إجمالي الخصم</span><span>${moneyFormatter.format(invoiceDiscount)} ج.م</span></div>
        <div class="summary-row total"><span>الإجمالي النهائي</span><span>${moneyFormatter.format(invoiceTotal)} ج.م</span></div>
      </div>
      ${plainNotes ? `<div class="note">ملاحظات: ${plainNotes}</div>` : ''}
      <div class="footer">شكرًا لتعاملكم مع ${appClient.companyNameAr}</div>
    `,
  );

  printWindow.document.close();
  printWindow.print();
  return { ok: true };
};
