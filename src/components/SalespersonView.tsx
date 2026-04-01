import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { OrderItem, Order, BRANCHES } from '../types';
import { Plus, Trash2, ShoppingCart, User, CheckCircle, Search, Clock, Receipt, Store, XCircle, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import ProductSearch from './ProductSearch';
import ShiftManager from './ShiftManager';

interface SalespersonViewProps {
  userBranchId?: string | null;
}

export default function SalespersonView({ userBranchId }: SalespersonViewProps) {
  const [activeTab, setActiveTab] = useState<'order' | 'search' | 'history'>('order');
  
  const [branchId, setBranchId] = useState(userBranchId || '');
  const [salespersonName, setSalespersonName] = useState('');
  const [sessionUser, setSessionUser] = useState<any>(null);
  
  const [productCode, setProductCode] = useState('');
  const [productName, setProductName] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [discountPercentage, setDiscountPercentage] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [productInStock, setProductInStock] = useState<boolean | null>(null);
  const [availableQuantity, setAvailableQuantity] = useState<number | null>(null);
  
  const [items, setItems] = useState<OrderItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const prevOrdersRef = useRef<Order[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
            setSessionUser(session.user);
            const savedName = localStorage.getItem('salespersonName');
            setSalespersonName(savedName || session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email);
        }
    });

    const savedBranch = localStorage.getItem('branchId');
    if (userBranchId) {
      setBranchId(userBranchId);
    } else if (savedBranch) {
      setBranchId(savedBranch);
    } else if (BRANCHES.length > 0) {
      setBranchId(BRANCHES[0].id);
    }
  }, [userBranchId]);

  // Auto-fetch product details
  useEffect(() => {
    const fetchProductDetails = async () => {
      if (productCode.trim().length >= 2) {
        try {
          const { data, error } = await supabase.from('products').select('*').eq('code', productCode.trim()).single();
          
          if (data && !error) {
            const prod = data;
            if (prod.is_deleted) {
              toast.error('هذا المنتج تمت أرشفته ولا يمكن بيعه');
              setProductInStock(null);
              setAvailableQuantity(null);
              return;
            }
            setProductName(prod.name);
            
            const basePrice = prod.price_before || prod.price || 0;
            setOriginalPrice(basePrice.toString());
            
            if (prod.price_after && basePrice > 0) {
               const calculatedDiscount = Math.round(((basePrice - prod.price_after) / basePrice) * 100);
               setDiscountPercentage(calculatedDiscount.toString());
            } else if (prod.discount_percentage !== undefined && prod.discount_percentage !== null) {
              setDiscountPercentage(prod.discount_percentage.toString());
            } else {
              setDiscountPercentage('');
            }
            
            if (prod.quantity !== undefined && prod.quantity !== null) {
              setAvailableQuantity(prod.quantity);
              setProductInStock(prod.quantity > 0);
            } else {
              setAvailableQuantity(null);
              setProductInStock(prod.in_stock !== false);
            }
          } else {
            setProductInStock(null);
            setAvailableQuantity(null);
          }
        } catch (error) {
          console.error("Error fetching product", error);
        }
      } else {
        setProductInStock(null);
        setAvailableQuantity(null);
      }
    };
    
    const timeoutId = setTimeout(() => {
      fetchProductDetails();
    }, 600);
    
    return () => clearTimeout(timeoutId);
  }, [productCode]);

  // Listen to salesperson's orders
  useEffect(() => {
    if (!sessionUser?.id || !branchId) return;

    let channel: any;

    const fetchOrders = async () => {
        const { data, error } = await supabase.from('orders')
          .select('*')
          .eq('salesperson_id', sessionUser.id)
          .eq('branch_id', branchId)
          .order('created_at', { ascending: false })
          .limit(50);
          
        if (data) {
            const ordersData = data.map((d: any) => ({
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
            }));
            
            // Check newly completed
            ordersData.forEach(newOrder => {
                const oldOrder = prevOrdersRef.current.find(o => o.id === newOrder.id);
                if (oldOrder && oldOrder.status === 'pending' && newOrder.status === 'completed') {
                  toast.success(`الكاشير قام بتأكيد طلبك بقيمة ${newOrder.totalFinalPrice.toFixed(2)} ج.م!`, {
                    duration: 6000,
                    icon: '🎉'
                  });
                }
            });

            prevOrdersRef.current = ordersData;
            setMyOrders(ordersData);
        }
    };

    fetchOrders();

    channel = supabase.channel('orders-changes')
      .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'orders',
          filter: `salesperson_id=eq.${sessionUser.id}` 
      }, (payload) => {
          fetchOrders();
      })
      .subscribe();

    return () => { if (channel) supabase.removeChannel(channel); };
  }, [sessionUser, branchId]);

  const handleSaveSalesperson = () => {
    if (branchId) localStorage.setItem('branchId', branchId);
    if (salespersonName) localStorage.setItem('salespersonName', salespersonName);
    toast.success('تم حفظ بيانات البائع والفرع');
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productCode || !originalPrice) {
      toast.error('يرجى إدخال كود المنتج والسعر');
      return;
    }

    const price = parseFloat(originalPrice);
    const discount = parseFloat(discountPercentage) || 0;
    const qty = parseInt(quantity) || 1;

    // Validation: Max Discount
    if (discount > 25) {
      toast.warning('نسبة الخصم تتجاوز 25%، سيتطلب هذا موافقة الإدارة عند الدفع');
    }

    // Validation: Quantity
    if (availableQuantity !== null && qty > availableQuantity) {
      toast.error(`الكمية المطلوبة (${qty}) غير متوفرة في المخزن. المتاح: ${availableQuantity}`);
      return;
    }

    const finalPrice = (price - (price * (discount / 100))) * qty;

    const newItem: OrderItem = {
      id: Math.random().toString(36).substring(7),
      productCode: productCode.trim(),
      productName: productName || 'سجاد',
      originalPrice: price,
      discountPercentage: discount,
      finalPrice: finalPrice,
      quantity: qty
    };

    setItems([...items, newItem]);
    
    setProductCode('');
    setProductName('');
    setOriginalPrice('');
    setDiscountPercentage('');
    setQuantity('1');
    setProductInStock(null);
    setAvailableQuantity(null);
    
    toast.success('تم إضافة المنتج للفاتورة');
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const totalOriginal = items.reduce((sum, item) => sum + (item.originalPrice * item.quantity), 0);
  const totalFinal = items.reduce((sum, item) => sum + item.finalPrice, 0);

  const handleSubmitOrder = async () => {
    if (!branchId) {
      toast.error('يرجى اختيار الفرع أولاً');
      return;
    }
    if (!sessionUser?.id || !salespersonName) {
      toast.error('يرجى حفظ كود واسم البائع أولاً');
      return;
    }
    if (items.length === 0) {
      toast.error('الفاتورة فارغة');
      return;
    }

    const hasHighDiscount = items.some(item => item.discountPercentage > 25);

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('orders').insert([{
        branch_id: branchId,
        salesperson_id: sessionUser.id,
        salesperson_name: salespersonName,
        items,
        total_original_price: totalOriginal,
        total_final_price: totalFinal,
        status: 'pending',
        requires_manager_approval: hasHighDiscount
      }]);
      
      if (error) throw error;
      
      toast.success('تم إرسال الطلب للكاشير بنجاح!');
      setItems([]);
    } catch (error) {
      console.error('Error adding order: ', error);
      toast.error('حدث خطأ أثناء إرسال الطلب');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pb-24">
      <div className="p-4 max-w-3xl mx-auto">
        <ShiftManager userRole="salesperson" userBranchId={userBranchId || branchId} userName={salespersonName || 'بائع'} />
      </div>

      <div className="flex p-2 bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <button 
          onClick={() => setActiveTab('order')}
          className={`flex-1 py-3 text-sm font-bold rounded-lg transition flex items-center justify-center gap-2 ${activeTab === 'order' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          <Plus className="w-4 h-4" /> إنشاء فاتورة
        </button>
        <button 
          onClick={() => setActiveTab('search')}
          className={`flex-1 py-3 text-sm font-bold rounded-lg transition flex items-center justify-center gap-2 ${activeTab === 'search' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          <Search className="w-4 h-4" /> بحث عن منتج
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-3 text-sm font-bold rounded-lg transition flex items-center justify-center gap-2 ${activeTab === 'history' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          <Receipt className="w-4 h-4" /> متابعة طلباتي
        </button>
      </div>

      <div className="mt-4">
        {activeTab === 'search' ? (
          <ProductSearch />
        ) : activeTab === 'history' ? (
          <div className="max-w-3xl mx-auto p-4 space-y-4">
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Receipt className="w-6 h-6 text-blue-600" />
              سجل طلباتي
            </h2>
            {myOrders.length === 0 ? (
              <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-100 text-center">
                <Clock className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-700 mb-1">لا توجد طلبات سابقة</h3>
                <p className="text-slate-500">الطلبات التي تقوم بإنشائها ستظهر هنا لمتابعة حالتها.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {myOrders.map(order => (
                  <div key={order.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col sm:flex-row justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-bold text-slate-800">
                          {order.createdAt ? format(order.createdAt, 'yyyy-MM-dd HH:mm') : 'جاري التحميل...'}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${order.status === 'completed' ? 'bg-green-100 text-green-700' : order.status === 'cancelled' ? 'bg-red-100 text-red-700' : order.status === 'returned' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>
                          {order.status === 'completed' ? <CheckCircle className="w-3 h-3" /> : order.status === 'cancelled' ? <XCircle className="w-3 h-3" /> : order.status === 'returned' ? <RotateCcw className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          {order.status === 'completed' ? 'تم الدفع (مكتمل)' : order.status === 'cancelled' ? 'ملغي' : order.status === 'returned' ? 'مرتجع' : 'في انتظار الكاشير'}
                        </span>
                      </div>
                      <div className="text-sm text-slate-600">
                        {order.items.length} منتجات: {order.items.map(i => i.productName || i.productCode).join('، ')}
                      </div>
                    </div>
                    <div className="text-right sm:text-left flex flex-col justify-center">
                      <div className="text-xs text-slate-500">الصافي المطلوب</div>
                      <div className="font-bold text-lg text-blue-600">{order.totalFinalPrice.toFixed(2)} ج.م</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-md mx-auto p-4 space-y-6">
            {/* Salesperson Info */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
              <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" />
                بيانات البائع والفرع
              </h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                    <Store className="w-3 h-3" /> الفرع الحالي
                  </label>
                  {userBranchId ? (
                    <div className="w-full p-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-700 font-medium">
                      {BRANCHES.find(b => b.id === userBranchId)?.name || 'فرع غير معروف'}
                    </div>
                  ) : (
                    <select 
                      value={branchId}
                      onChange={(e) => {
                        setBranchId(e.target.value);
                      }}
                      className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50"
                    >
                      <option value="" disabled>اختر الفرع...</option>
                      {BRANCHES.map(branch => (
                        <option key={branch.id} value={branch.id}>{branch.name}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">اسم البائع</label>
                    <input 
                      type="text" 
                      value={salespersonName}
                      onChange={(e) => setSalespersonName(e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="مثال: أحمد"
                    />
                  </div>
                </div>
              </div>
              <button 
                onClick={handleSaveSalesperson}
                className="mt-4 w-full text-xs text-blue-600 font-medium py-2 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
              >
                حفظ البيانات للجلسة القادمة
              </button>
            </div>

            {/* Add Item Form */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
              <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5 text-green-600" />
                إضافة منتج
              </h2>
              <form onSubmit={handleAddItem} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-500 mb-1">كود المنتج</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        value={productCode}
                        onChange={(e) => setProductCode(e.target.value)}
                        className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                        placeholder="اكتب الكود للبحث التلقائي..."
                        required
                      />
                      {productInStock !== null && (
                        <div className={`absolute left-2 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded-full ${productInStock ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {productInStock ? (availableQuantity !== null ? `متوفر (${availableQuantity})` : 'متوفر') : 'غير متوفر'}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-500 mb-1">اسم المنتج</label>
                    <input 
                      type="text" 
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none bg-slate-50"
                      placeholder="سجاد..."
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">السعر الأساسي</label>
                    <input 
                      type="number" 
                      value={originalPrice}
                      onChange={(e) => setOriginalPrice(e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none bg-slate-50"
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">نسبة الخصم %</label>
                    <input 
                      type="number" 
                      value={discountPercentage}
                      onChange={(e) => setDiscountPercentage(e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                      placeholder="0"
                      min="0"
                      max="25"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">الكمية</label>
                    <input 
                      type="number" 
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                      placeholder="1"
                      min="1"
                      required
                    />
                  </div>
                </div>
                {originalPrice && (
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex justify-between items-center">
                    <span className="text-sm font-medium text-blue-800">السعر بعد الخصم:</span>
                    <span className="text-lg font-bold text-blue-600">
                      {((parseFloat(originalPrice) - (parseFloat(originalPrice) * ((parseFloat(discountPercentage) || 0) / 100))) * (parseInt(quantity) || 1)).toFixed(2)} ج.م
                    </span>
                  </div>
                )}
                <button 
                  type="submit"
                  className="w-full bg-green-600 text-white font-medium py-2.5 rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2 mt-2"
                >
                  <Plus className="w-4 h-4" />
                  إضافة للفاتورة
                </button>
              </form>
            </div>

            {/* Cart */}
            {items.length > 0 && (
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-orange-600" />
                  الفاتورة الحالية ({items.length})
                </h2>
                <div className="space-y-3 mb-4">
                  {items.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <div>
                        <div className="font-bold text-sm text-slate-800">{item.productCode} <span className="text-slate-500 font-normal text-xs">(الكمية: {item.quantity})</span></div>
                        <div className="text-xs text-slate-500">
                          {item.originalPrice} ج.م 
                          {item.discountPercentage > 0 && (
                            <span className="text-red-500 ml-1">(-{item.discountPercentage}%)</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="font-bold text-green-600">{item.finalPrice.toFixed(2)} ج.م</div>
                        <button 
                          onClick={() => handleRemoveItem(item.id)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-slate-200 pt-3 mb-4">
                  <div className="flex justify-between text-sm text-slate-600 mb-1">
                    <span>الإجمالي قبل الخصم:</span>
                    <span>{totalOriginal.toFixed(2)} ج.م</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg text-slate-800">
                    <span>الصافي المطلوب:</span>
                    <span className="text-green-600">{totalFinal.toFixed(2)} ج.م</span>
                  </div>
                </div>
                <button 
                  onClick={handleSubmitOrder}
                  disabled={isSubmitting}
                  className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {isSubmitting ? 'جاري الإرسال...' : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      تأكيد وإرسال للكاشير
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
