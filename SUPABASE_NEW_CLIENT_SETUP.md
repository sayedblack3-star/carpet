# Supabase New Client Setup (Carpet Land)

هذا الملف هو الخطوات الرسمية لإنشاء **Backend جديد** لأي عميل جديد على Supabase.
اتبع الترتيب بالضبط لتفادي تضارب الـ schema أو الـ RLS.

## 1) إنشاء مشروع Supabase جديد
1. أنشئ مشروع جديد.
2. احفظ القيم التالية من Settings > API:
   - `SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

## 2) تشغيل ملفات الـ SQL بالترتيب

### (A) القاعدة الأساسية
نفّذ:
`supabase_migration.sql`

هذا الملف ينشئ الجداول الأساسية، الـ triggers، والـ RLS العامة.

### (B) توافق أعمدة الطلبات مع التطبيق
نفّذ:
`supabase_orders_compat_fix.sql`

الفرونت يستخدم `salesperson_id` و `salesperson_name`. هذا الملف يضمن وجودها.

### (C) الفروع وعزل البيانات بين الفروع
نفّذ:
`supabase_branch_isolation.sql`

هذا الملف:
- ينشئ جدول `branches`
- يضيف `branch_id` للجداول المهمة
- يضبط RLS على أساس الفرع

### (D) تحسين الأداء (مستحسن جدًا)
نفّذ:
`supabase_profiles_timeout_fix.sql`

هذا يضيف Indexes ضرورية لتسريع الاستعلامات.

### (E) تقوية الـ RLS (اختياري بعد التأكد من التشغيل)
نفّذ:
`supabase_security_hardening.sql`

هذا يضيّق الصلاحيات أكثر. استخدمه **بعد** التأكد أن النظام يعمل كما هو.

### (F) بيانات المنتجات (اختياري)
نفّذ:
`import_products.sql`

هذا الملف يضيف منتجات جاهزة للتجربة.

## 3) تصحيح حالة الورديات (مهم)
النظام يستخدم `open/closed` لحالة الورديات.
لو الـ shifts تم إنشاؤها بحالة `active` من ملف قديم، نفّذ هذا مرة واحدة:

```sql
ALTER TABLE public.shifts
  ALTER COLUMN status SET DEFAULT 'open';

ALTER TABLE public.shifts
  DROP CONSTRAINT IF EXISTS shifts_status_check;

ALTER TABLE public.shifts
  ADD CONSTRAINT shifts_status_check
  CHECK (status IN ('open', 'closed'));

UPDATE public.shifts
SET status = 'open'
WHERE status = 'active';

NOTIFY pgrst, 'reload schema';
```

## 4) ملفات قديمة لا تستخدمها للعميل الجديد
الملفات التالية تخص نسخة قديمة (`public.users`) ولا يجب استخدامها الآن:
- `fix_users_table.sql`
- `fix_delete_cascade.sql`

وكذلك `schema_update.sql` قديم ويحتوي على تعريفات `shortages` قديمة.

## 5) إعدادات البيئة في المشروع
ضع القيم في `.env.local` داخل نسخة العميل:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## 6) اختبار سريع بعد الإعداد
1. سجّل دخول أدمن.
2. أنشئ مستخدم بائع + كاشير.
3. أنشئ طلب من البائع وأرسله للكاشير.
4. أكّد التحصيل من الكاشير.
5. جرّب فتح/إغلاق وردية.

لو كل ذلك نجح، المشروع جاهز.

