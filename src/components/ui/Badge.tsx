import { type ReactNode } from 'react';
import { SHIFT_COLORS, STATUS_COLORS } from '@/types';

interface BadgeProps {
  children: ReactNode;
  className?: string;
}

export function Badge({ children, className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border whitespace-nowrap ${className}`}>
      {children}
    </span>
  );
}

export function ShiftBadge({ shift }: { shift: string }) {
  const colors = SHIFT_COLORS[shift] || { bg: 'bg-slate-700', text: 'text-slate-300', border: 'border-slate-600', dot: 'bg-slate-500' };
  return (
    <Badge className={`${colors.bg} ${colors.text} ${colors.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
      {shift}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const colorClass = STATUS_COLORS[status] || 'bg-slate-700 text-slate-300 border-slate-600';
  return <Badge className={colorClass}>{status}</Badge>;
}

export function RoleBadge({ role }: { role: string }) {
  return (
    <Badge className="bg-slate-700 text-slate-300 border-slate-600">
      {role}
    </Badge>
  );
}
