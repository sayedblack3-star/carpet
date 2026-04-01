import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Order, OrderItem, BRANCHES, Product } from '../types';
import { format } from 'date-fns';
import { Copy, CheckCircle, Clock, Trash2, Edit, X, ShoppingCart, Store, Printer, RotateCcw, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { logAction } from '../lib/logger';
import ShiftManager from './ShiftManager';

interface CashierViewProps {
  userBranchId?: string | null;
  userRole?: string;
}

export default function CashierView({ userBranchId, userRole }: CashierViewProps) {
  const [selectedBranch, setSelectedBranch] = useState<string>(userBranchId || 'all');
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editItems, setEditItems] = useState<OrderItem[]>([]);
  const [sessionUser, setSessionUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
            setSessionUser(session.user);
        }
    });

    const fetchOrders = async () => {
      let query = supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(100);
      
      if (userBranchId) {
        query = query.eq('branch_id', userBranchId);
      } else if (selectedBranch !== 'all') {
        query = query.eq('branch_id', selectedBranch);
      }

      const { data, error } = await query;
      if (data) {
        setOrders(data.map((d: any) => ({
          id: d.id,
          branchId: d.branch_id,
          salespersonId: d.salesperson_id,
          salespersonName: d.salesperson_name,
          items: d.items,
          totalOriginalPrice: d.total_original_price,
          totalFinalPrice: d.total_final_price,
          status: d.status,
          requiresManagerApproval: d.requires_manager_approval,
          createdAt: new Date(d.created_at)
        })));
      } else {
        toast.error("خطأ في جلب الطلبات");
      }
    };

    fetchOrders();

    const channel = supabase.channel('cashier-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, payload => {
        fetchOrders();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedBranch, userBranchId]);

  const handleSelectOrder = (order: Order) => {
    setSelectedOrder(order);
    setIsEditing(false);
    setEditItems(order.items);
  };

  const handleCopyInvoice = (order: Order) => {
    let text = `فاتورة مبيعات - Carpet Land\n`;
    text += `التاريخ: ${order.createdAt ? format(order.createdAt, 'yyyy-MM-dd HH:mm') : ''}\n`;
    text += `البائع: ${order.salespersonName} (كود: ${order.salespersonId})\n`;
    text += `------------------------\n`;
    order.items.forEach(item => {
      text += `- ${item.productCode} | ${item.productName}\n`;
      text += `  السعر: ${item.originalPrice} ج.م | خصم: ${item.discountPercentage}%\n`;
      text += `  الصافي: ${item.finalPrice.toFixed(2)} ج.م\n`;
    });
    text += `------------------------\n`;
    text += `الإجمالي قبل الخصم: ${order.totalOriginalPrice.toFixed(2)} ج.م\n`;
    text += `الصافي المطلوب: ${order.totalFinalPrice.toFixed(2)} ج.م\n`;

    navigator.clipboard.writeText(text).then(() => {
      toast.success('تم نسخ الفاتورة بنجاح');
    }).catch(() => {
      toast.error('فشل نسخ الفاتورة');
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const updateInventory = async (items: OrderItem[], isRestore: boolean) => {
    for (const item of items) {
      const { data: prods } = await supabase.from('products').select('*').eq('code', item.productCode);
      if (prods && prods.length > 0) {
        const product = prods[0];
        const currentQty = product.quantity || 0;
        const diff = item.quantity || 1;
        const newQty = isRestore ? currentQty + diff : Math.max(0, currentQty - diff);
        
        await supabase.from('products').update({ quantity: newQty }).eq('id', product.id);
      }
    }
  };

  const handleMarkCompleted = async (orderId: string) => {
    if (!selectedOrder) return;
    try {
      // Update inventory (decrease)
      await updateInventory(selectedOrder.items, false);

      // Update order status
      const { error } = await supabase.from('orders').update({
        status: 'completed',
        updated_at: new Date().toISOString()
      }).eq('id', orderId);
      
      if (error) throw error;

      await logAction('إكمال طلب', `تم تأكيد الدفع للطلب رقم ${orderId}`, selectedOrder.branchId);
      toast.success('تم تأكيد الدفع وتحديث المخزون');
      setSelectedOrder(null);
    } catch (error: any) {
      console.error("Error completing order:", error);
      toast.error(error.message || 'حدث خطأ أثناء تأكيد الدفع');
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (window.confirm('هل أنت متأكد من إلغاء هذا الطلب؟')) {
      try {
        if (selectedOrder && selectedOrder.status === 'completed') {
          await updateInventory(selectedOrder.items, true);
        }

        const { error } = await supabase.from('orders').update({
          status: 'cancelled',
          updated_at: new Date().toISOString()
        }).eq('id', orderId);

        if (error) throw error;

        await logAction('إلغاء طلب', `تم إلغاء الطلب رقم ${orderId}`, selectedOrder?.branchId);
        toast.success('تم إلغاء الطلب');
        setSelectedOrder(null);
      } catch (error) {
        toast.error('حدث خطأ أثناء إلغاء الطلب');
      }
    }
  };

  const handleReturnOrder = async (orderId: string) => {
    if (window.confirm('هل أنت متأكد من إرجاع هذا الطلب؟ سيتم استرداد المنتجات للمخزن.')) {
      try {
        if (selectedOrder && selectedOrder.status === 'completed') {
          await updateInventory(selectedOrder.items, true);
        }

        const { error } = await supabase.from('orders').update({
          status: 'returned',
          updated_at: new Date().toISOString()
        }).eq('id', orderId);

        if (error) throw error;

        await logAction('إرجاع طلب', `تم إرجاع الطلب رقم ${orderId} واسترداد المخزون`, selectedOrder?.branchId);
        toast.success('تم إرجاع الطلب للمخزن بنجاح');
        setSelectedOrder(null);
      } catch (error) {
        toast.error('حدث خطأ أثناء إرجاع الطلب');
      }
    }
  };

  const handleRemoveEditItem = (itemId: string) => {
    setEditItems(editItems.filter(i => i.id !== itemId));
  };

  const handleSaveEdit = async () => {
    if (!selectedOrder?.id) return;
    
    const newTotalOriginal = editItems.reduce((sum, item) => sum + item.originalPrice * item.quantity, 0);
    const newTotalFinal = editItems.reduce((sum, item) => sum + item.finalPrice, 0);

    try {
      const { error } = await supabase.from('orders').update({
        items: editItems,
        total_original_price: newTotalOriginal,
        total_final_price: newTotalFinal,
        updated_at: new Date().toISOString()
      }).eq('id', selectedOrder.id);
      
      if (error) throw error;

      await logAction('تعديل طلب', `تم تعديل الطلب رقم ${selectedOrder.id}`, selectedOrder.branchId);
      toast.success('تم تحديث الفاتورة');
      setIsEditing(false);
      setSelectedOrder({
        ...selectedOrder,
        items: editItems,
        totalOriginalPrice: newTotalOriginal,
        totalFinalPrice: newTotalFinal
      });
    } catch (error) {
      toast.error('حدث خطأ أثناء التحديث');
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-slate-50" dir="rtl">
      <div className="p-2 sm:p-4 border-b border-slate-200 bg-white">
        <ShiftManager userRole="cashier" userBranchId={userBranchId || selectedBranch} userName={sessionUser?.user_metadata?.full_name || 'الكاشير'} />
      </div>
      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar - Orders List */}
        <div className={`w-full lg:w-1/3 border-l border-slate-200 bg-white flex flex-col h-full transition-transform duration-300 lg:translate-x-0 ${selectedOrder ? 'hidden lg:flex' : 'flex'}`}>
            <div className="p-4 border-b border-slate-200 bg-slate-50 space-y-3">
              <h2 className="font-bold text-lg text-slate-800">الطلبات الواردة</h2>
              <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200">
                <Store className="w-4 h-4 text-slate-500" />
                {userBranchId ? (
                  <div className="w-full text-sm outline-none bg-transparent text-slate-700 font-medium">
                    {BRANCHES.find(b => b.id === userBranchId)?.name || 'فرع غير معروف'}
                  </div>
                ) : (
                  <select 
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    className="w-full text-sm outline-none bg-transparent text-slate-700 font-medium"
                  >
                    <option value="all">جميع الفروع</option>
                    {BRANCHES.map(branch => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            <div className="overflow-y-auto flex-1 p-3 space-y-2">
              {orders.length === 0 ? (
                <div className="text-center text-slate-500 py-10 text-sm">لا توجد طلبات حالياً</div>
              ) : (
                orders.map(order => (
                  <div 
                    key={order.id} 
                    onClick={() => handleSelectOrder(order)}
                    className={`p-3 rounded-xl cursor-pointer border transition-all ${selectedOrder?.id === order.id ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-slate-100 bg-white hover:border-blue-300'}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-bold text-slate-800 text-sm">بائع: {order.salespersonName}</div>
                        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                          <Store className="w-3 h-3" />
                          {BRANCHES.find(b => b.id === order.branchId)?.name || 'فرع غير معروف'}
                        </div>
                      </div>
                      <div className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${order.status === 'completed' ? 'bg-green-100 text-green-700' : order.status === 'cancelled' ? 'bg-red-100 text-red-700' : order.status === 'returned' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>
                        {order.status === 'completed' ? <CheckCircle className="w-3 h-3" /> : order.status === 'cancelled' ? <X className="w-3 h-3" /> : order.status === 'returned' ? <RotateCcw className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {order.status === 'completed' ? 'مكتمل' : order.status === 'cancelled' ? 'ملغي' : order.status === 'returned' ? 'مرتجع' : 'قيد الانتظار'}
                      </div>
                    </div>
                    <div className="flex justify-between items-end">
                      <div className="text-xs text-slate-500">
                        {order.items.length} منتجات
                        <br/>
                        {order.createdAt ? format(order.createdAt, 'HH:mm') : ''}
                      </div>
                      <div className="font-bold text-blue-600">{order.totalFinalPrice.toFixed(2)} ج.م</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Main Content - Order Details */}
          <div className={`flex-1 flex flex-col bg-slate-50 h-full overflow-y-auto print:bg-white print:h-auto print:overflow-visible ${!selectedOrder ? 'hidden lg:flex' : 'flex'}`}>
            {selectedOrder ? (
              <div className="p-4 sm:p-6 max-w-3xl mx-auto w-full print:p-0 print:max-w-full">
                {/* Mobile Back Button */}
                <button 
                  onClick={() => setSelectedOrder(null)}
                  className="lg:hidden mb-4 flex items-center gap-2 text-blue-600 font-bold"
                >
                  <ArrowLeft className="w-5 h-5 rotate-180" /> العودة للقائمة
                </button>
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden print:border-none print:shadow-none">
                  {/* Header */}
                  <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start gap-4 bg-slate-800 text-white print:bg-white print:text-black print:border-b-2 print:border-black">
                    <div>
                      <h1 className="text-xl sm:text-2xl font-bold mb-1">فاتورة مبيعات - Carpet Land</h1>
                      <div className="text-slate-300 text-sm print:text-slate-600">
                        {selectedOrder.createdAt ? format(selectedOrder.createdAt, 'yyyy-MM-dd HH:mm') : ''}
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="text-sm text-slate-300 print:text-slate-600">البائع</div>
                      <div className="font-bold text-lg">{selectedOrder.salespersonName}</div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-wrap gap-2 sm:gap-3 print:hidden">
                    <button 
                      onClick={handlePrint}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 text-xs sm:text-sm font-medium transition"
                    >
                      <Printer className="w-4 h-4" /> طباعة
                    </button>
                    <button 
                      onClick={() => handleCopyInvoice(selectedOrder)}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 text-xs sm:text-sm font-medium transition"
                    >
                      <Copy className="w-4 h-4" /> نسخ
                    </button>
                    
                    {selectedOrder.status === 'pending' && !isEditing && (
                      <button 
                        onClick={() => setIsEditing(true)}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 text-xs sm:text-sm font-medium transition"
                      >
                        <Edit className="w-4 h-4" /> تعديل
                      </button>
                    )}
                    {isEditing && (
                      <button 
                        onClick={() => setIsEditing(false)}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 text-xs sm:text-sm font-medium transition"
                      >
                        <X className="w-4 h-4" /> إلغاء
                      </button>
                    )}

                    {selectedOrder.status === 'completed' && (
                      <button 
                        onClick={() => handleReturnOrder(selectedOrder.id!)}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-white border border-purple-200 text-purple-600 rounded-lg hover:bg-purple-50 text-xs sm:text-sm font-medium transition"
                      >
                        <RotateCcw className="w-4 h-4" /> إرجاع
                      </button>
                    )}

                    {selectedOrder.status !== 'cancelled' && selectedOrder.status !== 'returned' && (
                      <button 
                        onClick={() => handleDeleteOrder(selectedOrder.id!)}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 text-xs sm:text-sm font-medium transition mr-auto"
                      >
                        <X className="w-4 h-4" /> إلغاء
                      </button>
                    )}
                  </div>

                  {/* Items */}
                  <div className="p-4 sm:p-6">
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-right">
                        <thead>
                          <tr className="text-sm text-slate-500 border-b border-slate-200">
                            <th className="pb-3 font-medium">كود المنتج</th>
                            <th className="pb-3 font-medium">الاسم</th>
                            <th className="pb-3 font-medium text-center">الكمية</th>
                            <th className="pb-3 font-medium text-center">السعر الأصلي</th>
                            <th className="pb-3 font-medium text-center">الخصم</th>
                            <th className="pb-3 font-medium text-left">الصافي</th>
                            {isEditing && <th className="pb-3 font-medium">إجراء</th>}
                          </tr>
                        </thead>
                        <tbody className="text-sm">
                          {(isEditing ? editItems : selectedOrder.items).map((item, idx) => (
                            <tr key={item.id || idx} className="border-b border-slate-100 last:border-0">
                              <td className="py-4 font-bold text-slate-800">{item.productCode}</td>
                              <td className="py-4 text-slate-600">{item.productName}</td>
                              <td className="py-4 text-slate-600 text-center">{item.quantity}</td>
                              <td className="py-4 text-slate-600 text-center">
                                {isEditing ? (
                                  <input 
                                    type="number" 
                                    value={item.originalPrice}
                                    onChange={(e) => {
                                      const newPrice = parseFloat(e.target.value) || 0;
                                      setEditItems(editItems.map(i => i.id === item.id ? { ...i, originalPrice: newPrice, finalPrice: (newPrice - (newPrice * (i.discountPercentage / 100))) * i.quantity } : i));
                                    }}
                                    className="w-20 p-1 border rounded text-center"
                                  />
                                ) : (
                                  `${item.originalPrice} ج.م`
                                )}
                              </td>
                              <td className="py-4 text-red-500 text-center">
                                {isEditing ? (
                                  <input 
                                    type="number" 
                                    value={item.discountPercentage}
                                    onChange={(e) => {
                                      const newDiscount = parseFloat(e.target.value) || 0;
                                      setEditItems(editItems.map(i => i.id === item.id ? { ...i, discountPercentage: newDiscount, finalPrice: (i.originalPrice - (i.originalPrice * (newDiscount / 100))) * i.quantity } : i));
                                    }}
                                    className="w-16 p-1 border rounded text-center"
                                  />
                                ) : (
                                  `${item.discountPercentage}%`
                                )}
                              </td>
                              <td className="py-4 font-bold text-green-600 text-left">{item.finalPrice.toFixed(2)} ج.م</td>
                              {isEditing && (
                                <td className="py-4">
                                  <button onClick={() => handleRemoveEditItem(item.id!)} className="text-red-500 hover:bg-red-50 p-1.5 rounded">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-4">
                      {(isEditing ? editItems : selectedOrder.items).map((item, idx) => (
                        <div key={item.id || idx} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-bold text-slate-800">{item.productCode}</span>
                            <span className="font-bold text-green-600">{item.finalPrice.toFixed(2)} ج.م</span>
                          </div>
                          <p className="text-sm text-slate-600 mb-3">{item.productName}</p>
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="bg-white p-2 rounded-lg border border-slate-100 flex flex-col items-center">
                              <span className="text-slate-400 mb-1 font-medium italic">الكمية</span>
                              <span className="font-bold text-slate-700">{item.quantity}</span>
                            </div>
                            <div className="bg-white p-2 rounded-lg border border-slate-100 flex flex-col items-center">
                              <span className="text-slate-400 mb-1 font-medium italic">السعر</span>
                              {isEditing ? (
                                <input 
                                  type="number" 
                                  value={item.originalPrice}
                                  onChange={(e) => {
                                    const newPrice = parseFloat(e.target.value) || 0;
                                    setEditItems(editItems.map(i => i.id === item.id ? { ...i, originalPrice: newPrice, finalPrice: (newPrice - (newPrice * (i.discountPercentage / 100))) * i.quantity } : i));
                                  }}
                                  className="w-full p-1 border rounded text-center mt-1"
                                />
                              ) : (
                                <span className="font-bold text-slate-700">{item.originalPrice}</span>
                              )}
                            </div>
                            <div className="bg-white p-2 rounded-lg border border-slate-100 flex flex-col items-center">
                              <span className="text-slate-400 mb-1 font-medium italic">الخصم</span>
                              {isEditing ? (
                                <input 
                                  type="number" 
                                  value={item.discountPercentage}
                                  onChange={(e) => {
                                    const newDiscount = parseFloat(e.target.value) || 0;
                                    setEditItems(editItems.map(i => i.id === item.id ? { ...i, discountPercentage: newDiscount, finalPrice: (i.originalPrice - (i.originalPrice * (newDiscount / 100))) * i.quantity } : i));
                                  }}
                                  className="w-full p-1 border rounded text-center mt-1"
                                />
                              ) : (
                                <span className="font-bold text-red-500">{item.discountPercentage}%</span>
                              )}
                            </div>
                            {isEditing && (
                              <div className="bg-red-50 flex items-center justify-center rounded-lg">
                                <button onClick={() => handleRemoveEditItem(item.id!)} className="text-red-500 p-2 w-full h-full flex items-center justify-center">
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {isEditing && (
                      <div className="mt-4 flex justify-end">
                        <button 
                          onClick={handleSaveEdit}
                          className="w-full sm:w-auto bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 transition shadow-sm"
                        >
                          حفظ التعديلات
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Totals */}
                  <div className="bg-slate-50 p-4 sm:p-6 border-t border-slate-200">
                    <div className="flex justify-between text-slate-600 mb-2 text-sm sm:text-base">
                      <span>إجمالي السعر قبل الخصم:</span>
                      <span className="font-medium">
                        {(isEditing ? editItems : selectedOrder.items).reduce((sum, item) => sum + item.originalPrice * item.quantity, 0).toFixed(2)} ج.م
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-800 font-bold text-xl sm:text-2xl mt-4 pt-4 border-t border-slate-200">
                      <span>الصافي المطلوب:</span>
                      <span className="text-green-600">
                        {(isEditing ? editItems : selectedOrder.items).reduce((sum, item) => sum + item.finalPrice, 0).toFixed(2)} ج.م
                      </span>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  {selectedOrder.status === 'pending' && !isEditing && (
                    <div className="p-6 bg-white border-t border-slate-200 print:hidden">
                      {selectedOrder.requiresManagerApproval && userRole !== 'manager' && userRole !== 'admin' ? (
                        <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl text-orange-800 flex items-center gap-3 mb-4">
                          <Clock className="w-6 h-6 text-orange-500" />
                          <div>
                            <p className="font-bold">يتطلب موافقة الإدارة</p>
                            <p className="text-sm">هذا الطلب يحتوي على خصم يتجاوز 25%. يرجى التواصل مع الإدارة للموافقة.</p>
                          </div>
                        </div>
                      ) : (
                        <button 
                          onClick={() => handleMarkCompleted(selectedOrder.id!)}
                          className="w-full bg-green-600 text-white font-bold py-4 rounded-xl hover:bg-green-700 transition flex items-center justify-center gap-2 text-lg shadow-sm"
                        >
                          <CheckCircle className="w-6 h-6" />
                          تأكيد الدفع وإنهاء الطلب
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400 flex-col gap-4">
                <ShoppingCart className="w-16 h-16 opacity-20" />
                <p className="text-lg">اختر طلباً من القائمة لعرض التفاصيل</p>
              </div>
            )}
          </div>
        </div>

      {/* Thermal Receipt Print Layout (Hidden on screen) */}
      {selectedOrder && (
        <div className="hidden print:block print-receipt" dir="rtl">
          <div className="text-center mb-4">
            <h2 className="font-bold text-xl mb-1">Carpet Land</h2>
            <p className="text-sm text-gray-600">
              فرع: {BRANCHES.find(b => b.id === selectedOrder.branchId)?.name || 'غير معروف'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              التاريخ: {selectedOrder.createdAt ? format(selectedOrder.createdAt, 'yyyy-MM-dd HH:mm') : ''}
            </p>
          </div>
          
          <div className="border-t border-b border-dashed border-gray-400 py-2 mb-2 text-sm">
            <div className="flex justify-between mb-1">
              <span>رقم الطلب:</span>
              <span className="font-mono">{selectedOrder.id?.slice(-6).toUpperCase()}</span>
            </div>
            <div className="flex justify-between">
              <span>البائع:</span>
              <span>{selectedOrder.salespersonName}</span>
            </div>
          </div>

          <table className="w-full text-sm mb-2">
            <thead>
              <tr className="border-b border-dashed border-gray-400">
                <th className="text-right py-1">الصنف</th>
                <th className="text-center py-1">الكمية</th>
                <th className="text-left py-1">السعر</th>
              </tr>
            </thead>
            <tbody>
              {selectedOrder.items.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-1 text-right">{item.productName || item.productCode}</td>
                  <td className="py-1 text-center">{item.quantity || 1}</td>
                  <td className="py-1 text-left">{item.finalPrice.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t border-dashed border-gray-400 pt-2 mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span>الإجمالي قبل الخصم:</span>
              <span>{selectedOrder.totalOriginalPrice.toFixed(2)} ج.م</span>
            </div>
            <div className="flex justify-between font-bold text-base mt-1 pt-1 border-t border-gray-300">
              <span>الصافي المطلوب:</span>
              <span>{selectedOrder.totalFinalPrice.toFixed(2)} ج.م</span>
            </div>
          </div>

          <div className="text-center text-sm mt-4">
            <p>شكراً لزيارتكم!</p>
            <p className="text-xs mt-1">Powered by Carpet Land POS</p>
          </div>
        </div>
      )}
    </div>
  );
}
