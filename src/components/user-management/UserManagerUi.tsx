import React from 'react';
import {
  Building2,
  CheckCircle2,
  Edit2,
  Mail,
  Trash2,
  UserCheck,
  UserX,
} from 'lucide-react';

import type { Branch, Profile, UserRole } from '../../types';

type UserStats = {
  total: number;
  pending: number;
  active: number;
  admins: number;
};

type UserFilter = 'all' | 'unapproved' | 'active';

type UserStatsCardsProps = {
  stats: UserStats;
};

type UserFilterTabsProps = {
  activeFilter: UserFilter;
  onChange: (filter: UserFilter) => void;
};

type BranchSelectProps = {
  value: string | null | undefined;
  branches: Branch[];
  onChange: (value: string) => void;
};

type UserCardProps = {
  user: Profile;
  currentUserId: string | null;
  branchFeatureEnabled: boolean;
  branchLookup: Record<string, string>;
  roleLabels: Record<UserRole, string>;
  onEdit: (user: Profile) => void;
  onToggleApproval: (user: Profile) => void;
  onToggleStatus: (user: Profile) => void;
  onDelete: (user: Profile) => void;
};

const FILTER_OPTIONS: Array<{ value: UserFilter; label: string; activeClassName: string }> = [
  { value: 'all', label: 'الكل', activeClassName: 'bg-white shadow text-slate-800' },
  { value: 'unapproved', label: 'بانتظار التفعيل', activeClassName: 'bg-amber-500 text-white' },
  { value: 'active', label: 'نشط', activeClassName: 'bg-emerald-500 text-white' },
];

export const UserStatsCards: React.FC<UserStatsCardsProps> = ({ stats }) => (
  <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
    <div className="rounded-[1.6rem] border border-slate-200 bg-white p-4 shadow-sm">
      <p className="mb-2 text-[11px] font-black text-slate-400">إجمالي المستخدمين</p>
      <p className="text-2xl font-black text-slate-900">{stats.total}</p>
    </div>
    <div className="rounded-[1.6rem] border border-amber-100 bg-amber-50 p-4 shadow-sm">
      <p className="mb-2 text-[11px] font-black text-amber-700">بانتظار التفعيل</p>
      <p className="text-2xl font-black text-amber-900">{stats.pending}</p>
    </div>
    <div className="rounded-[1.6rem] border border-emerald-100 bg-emerald-50 p-4 shadow-sm">
      <p className="mb-2 text-[11px] font-black text-emerald-700">نشط حاليًا</p>
      <p className="text-2xl font-black text-emerald-900">{stats.active}</p>
    </div>
    <div className="rounded-[1.6rem] border border-red-100 bg-red-50 p-4 shadow-sm">
      <p className="mb-2 text-[11px] font-black text-red-700">مديرون</p>
      <p className="text-2xl font-black text-red-900">{stats.admins}</p>
    </div>
  </div>
);

export const UserFilterTabs: React.FC<UserFilterTabsProps> = ({ activeFilter, onChange }) => (
  <div className="flex w-full gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 hide-scrollbar md:grid md:w-auto md:grid-cols-3">
    {FILTER_OPTIONS.map((filter) => (
      <button
        key={filter.value}
        onClick={() => onChange(filter.value)}
        className={`min-w-[6.75rem] shrink-0 rounded-lg px-3 py-2 text-xs font-bold transition-all sm:px-4 ${
          activeFilter === filter.value ? filter.activeClassName : 'text-slate-400'
        }`}
      >
        {filter.label}
      </button>
    ))}
  </div>
);

export const BranchSelect: React.FC<BranchSelectProps> = ({ value, branches, onChange }) => (
  <select
    value={value || ''}
    onChange={(event) => onChange(event.target.value)}
    className="w-full appearance-none rounded-xl border bg-slate-50 px-4 py-3 font-bold outline-none"
  >
    <option value="">اختر الفرع</option>
    {branches.map((branch) => (
      <option key={branch.id} value={branch.id}>
        {branch.name}
      </option>
    ))}
  </select>
);

export const UserCard: React.FC<UserCardProps> = ({
  user,
  currentUserId,
  branchFeatureEnabled,
  branchLookup,
  roleLabels,
  onEdit,
  onToggleApproval,
  onToggleStatus,
  onDelete,
}) => (
  <div className="motion-fade-up motion-soft-lift motion-glow relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm transition-all hover:shadow-lg sm:p-6">
    <div className={`absolute inset-x-0 top-0 h-1 ${user.is_approved ? 'bg-emerald-500' : 'animate-pulse bg-amber-500'}`}></div>
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0 flex items-center gap-3">
        <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white">
          <UserCheck className={`h-6 w-6 ${user.is_approved ? 'text-emerald-400' : 'text-amber-400'}`} />
          {user.is_active && <div className="absolute -left-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-500"></div>}
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-lg font-black text-slate-800">{user.full_name}</h3>
          <p className="flex items-center gap-1 truncate text-[10px] font-bold text-slate-400">
            <Mail className="h-3 w-3 shrink-0" />
            <span className="truncate">{user.email}</span>
          </p>
        </div>
      </div>
      <span
        className={`rounded-lg px-2 py-1 text-[9px] font-black uppercase ${
          user.role === 'admin'
            ? 'bg-red-50 text-red-600'
            : user.role === 'cashier'
              ? 'bg-blue-50 text-blue-600'
              : 'bg-slate-50 text-slate-600'
        }`}
      >
        {roleLabels[user.role] || user.role}
      </span>
    </div>

    <div className="mb-4 space-y-2 rounded-xl bg-slate-50 p-3 text-[10px]">
      <div className="flex justify-between gap-3">
        <span className="shrink-0 font-bold text-slate-400">الحالة</span>
        <span className={`text-left font-black ${user.is_approved ? 'text-emerald-600' : 'text-amber-600'}`}>
          {user.is_approved ? 'مفعّل' : 'بانتظار التفعيل'}
        </span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="shrink-0 font-bold text-slate-400">كود الموظف</span>
        <span className="text-left font-black text-slate-700">{user.employee_code || '—'}</span>
      </div>
      {branchFeatureEnabled && (
        <div className="flex items-center justify-between gap-3">
          <span className="shrink-0 font-bold text-slate-400">الفرع</span>
          <span className="flex items-center gap-1 text-left font-black text-slate-700">
            <Building2 className="h-3 w-3" />
            {user.branch_id ? branchLookup[user.branch_id] || 'غير معروف' : user.role === 'admin' ? 'الإدارة العامة' : 'غير محدد'}
          </span>
        </div>
      )}
    </div>

    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {!user.is_approved ? (
        <button
          onClick={() => onToggleApproval(user)}
          className="col-span-2 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-amber-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-amber-500/20 active:scale-95 hover:bg-amber-600"
        >
          <CheckCircle2 className="h-4 w-4" /> تفعيل الحساب
        </button>
      ) : (
        <>
          <button
            onClick={() => onEdit(user)}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-900 py-3.5 text-sm font-bold text-white active:scale-95 hover:bg-slate-800"
          >
            <Edit2 className="h-4 w-4" /> تعديل
          </button>
          <button
            onClick={() => onToggleStatus(user)}
            className={`flex min-h-12 items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold active:scale-95 ${
              user.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
            }`}
          >
            {user.is_active ? <><UserX className="h-4 w-4" /> تجميد</> : <><UserCheck className="h-4 w-4" /> تفعيل</>}
          </button>
        </>
      )}
    </div>

    {user.id !== currentUserId && (
      <button
        onClick={() => onDelete(user)}
        className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-bold text-red-600 transition hover:bg-red-100 active:scale-95"
      >
        <Trash2 className="h-4 w-4" /> حذف نهائي آمن
      </button>
    )}
  </div>
);
