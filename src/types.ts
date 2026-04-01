export type UserRole = 'admin' | 'manager' | 'pricing' | 'cashier' | 'salesperson' | 'audit';

export type AppUser = {
  email: string;
  role: UserRole;
  name?: string;
  branchId?: string;
  isActive: boolean;
  createdAt: any;
};

export type OrderItem = {
  id: string; // local id for editing
  productCode: string;
  productName: string;
  originalPrice: number;
  discountPercentage: number;
  finalPrice: number;
  quantity: number;
};

export type Order = {
  id?: string;
  branchId: string; // Added branch ID
  salespersonId: string;
  salespersonName: string;
  items: OrderItem[];
  totalOriginalPrice: number;
  totalFinalPrice: number;
  status: 'pending' | 'completed' | 'cancelled' | 'returned';
  requiresManagerApproval?: boolean;
  createdAt: any; // Firestore Timestamp
  updatedAt?: any;
};

export type Product = {
  id?: string;
  code: string;
  name: string;
  price?: number; // Legacy
  price_before?: number;
  price_after?: number;
  discountPercentage?: number;
  size?: string;
  inStock?: boolean;
  quantity?: number;
  isDeleted?: boolean;
};

export type Shift = {
  id?: string;
  userId: string;
  userEmail: string;
  userName: string;
  branchId: string;
  role: string;
  startTime: any;
  endTime?: any;
  status: 'active' | 'completed';
  startingCash?: number;
  endingCash?: number;
  notes?: string;
};

export const BRANCHES = [
  { id: 'branch-zayed', name: 'فرع الشيخ زايد داخل سوق المرشدي' },
  { id: 'branch-masr-soudan', name: 'فرع مصر والسودان حدايق القبه' },
  { id: 'branch-helmeya', name: 'فرع الحلميه الجديده امام الاداره العليميه' },
  { id: 'branch-mokattam-2', name: 'فرع المقطم 2 مساكن اطلس' },
  { id: 'branch-tagamoa', name: 'فرع التجمع الاول اعلى لولو ماركت' },
  { id: 'branch-obour', name: 'فرع العبور بداخل مول التقوى والنور' },
  { id: 'branch-gesr-suez', name: 'فرع جسر السويس مصر الجديده' },
  { id: 'branch-mokattam-9', name: 'فرع المقطم شارع 9' },
];
