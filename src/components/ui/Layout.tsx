import { type ReactNode } from 'react';
import { Inbox } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
        {description && <p className="text-sm text-slate-400 mt-1">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

export function EmptyState({ message = 'Nenhum registro encontrado', action }: { message?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="w-12 h-12 rounded-full bg-slate-700/50 flex items-center justify-center mb-3">
        <Inbox size={22} className="text-slate-500" />
      </div>
      <p className="text-sm text-slate-400">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function TableSkeleton({ rows = 5, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <div className="animate-pulse space-y-3 p-4">
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="flex gap-4">
          {Array.from({ length: columns }).map((__, col) => (
            <div key={col} className="h-8 bg-slate-700/40 rounded flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

const accentClasses: Record<'blue' | 'emerald' | 'amber' | 'rose' | 'slate', string> = {
  blue: 'bg-blue-500/15 text-blue-400',
  emerald: 'bg-emerald-500/15 text-emerald-400',
  amber: 'bg-amber-500/15 text-amber-400',
  rose: 'bg-rose-500/15 text-rose-400',
  slate: 'bg-slate-500/15 text-slate-400',
};

export function StatCard({ label, value, meta, icon, accent = 'blue' }: { label: string; value: string | number; meta?: string; icon?: ReactNode; accent?: 'blue' | 'emerald' | 'amber' | 'rose' | 'slate' }) {
  const c = accentClasses[accent];
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center justify-between shadow-sm hover:border-slate-600 transition-colors">
      <div>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-slate-100 mt-1">{value}</p>
        {meta && <p className="text-xs text-slate-500 mt-0.5">{meta}</p>}
      </div>
      {icon && <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${c}`}>{icon}</div>}
    </div>
  );
}
