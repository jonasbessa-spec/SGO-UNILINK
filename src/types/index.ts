export interface ShiftScale {
  id: string;
  name: string;
  type: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  work_days: number;
  off_days: number;
  shift_group: string;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Employee {
  id: string;
  name: string;
  registration: string;
  role: string;
  sector: string;
  shift_group: string;
  shift_type?: string;
  schedule_start: string;
  schedule_end: string;
  status: string;
  hire_date: string | null;
  scale_status: string;
  notes: string;
  coordinator?: string;
  leader?: string;
  manager?: string;
  vacation_2026?: string | null;
  vacation_2027?: string | null;
  absence_reason?: string;
  is_absent?: boolean;
  created_at: string;
  updated_at: string;
}

export interface ShiftAssignment {
  id: string;
  employee_id: string;
  date: string;
  shift_group: string;
  coordinator?: string;
  shift_type: string;
  start_time: string;
  end_time: string;
  role: string;
  team: string;
  status: string;
  notes: string;
  created_at: string;
  updated_at: string;
  employee?: Employee;
}

export interface ShiftSwap {
  id: string;
  requester_id: string;
  substitute_id: string | null;
  original_date: string;
  swap_date: string;
  original_shift: string;
  new_shift: string;
  reason: string;
  approver: string;
  status: string;
  conflict_flags: string;
  created_at: string;
  updated_at: string;
  requester?: Employee;
  substitute?: Employee | null;
}

export interface LeaveRecord {
  id: string;
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  notes: string;
  status: string;
  created_at: string;
  updated_at: string;
  employee?: Employee;
}

export interface CoverageRequirement {
  id: string;
  date: string;
  shift_group: string;
  role: string;
  required_count: number;
  assigned_count: number;
  created_at: string;
}

export interface ChangeHistoryRecord {
  id: string;
  user_name: string;
  change_date: string;
  change_time: string;
  employee_name: string;
  field_changed: string;
  old_value: string;
  new_value: string;
  reason: string;
  created_at: string;
}

export interface OperationalAlert {
  id: string;
  alert_type: string;
  severity: string;
  title: string;
  description: string;
  employee_id: string | null;
  shift_group: string;
  date: string | null;
  is_resolved: boolean;
  created_at: string;
}

export interface Escala2x2 {
  id: string;
  colaborador_id: string;
  data: string;
  tipo_escala: string;
  status_dia: string;
  shift_group: string;
  coordenador: string;
  observacao: string;
  created_at: string;
  employee?: Employee;
}

export interface SavedFilter {
  id: string;
  name: string;
  filter_config: Record<string, unknown>;
  created_at: string;
}

export const SHIFT_GROUPS = ['D1', 'D2', 'N1', 'N2', 'ROTATIVO', 'COMERCIAL'] as const;
export const SHIFT_TYPES = ['Diurno', 'Noturno', 'Comercial', 'Folga', 'Férias', 'Afastado'] as const;
export const ASSIGNMENT_STATUSES = ['Escalado', 'Folga', 'Férias', 'Afastado', 'Falta', 'Cobertura', 'Troca'] as const;
export const EMPLOYEE_STATUSES = ['Ativo', 'Férias', 'Afastado', 'Inativo'] as const;
export const SWAP_STATUSES = ['Pendente', 'Aprovada', 'Recusada', 'Cancelada'] as const;
export const LEAVE_TYPES = ['Férias', 'Afastamento', 'Licença', 'Folga Programada'] as const;
export const LEAVE_STATUSES = ['Pendente', 'Aprovado', 'Recusado'] as const;
export const ALERT_SEVERITIES = ['danger', 'warning', 'info'] as const;
export const ROLES = ['TRAB PORT CAPATAZIA', 'OPERADOR EMPILHADEIRA', 'MOTORISTA PORTUÁRIO', 'CONFERENTE CARGA/DESCARGA', 'GUINDASTEIRO', 'SINALEIRO', 'LIDER DE OPERAÇÕES', 'ENCARREGADO CAPATAZIA', 'COORDENADOR OPERACIONAL', 'COORDENADOR ADMINISTRATIVO', 'ASSISTENTE ADMNISTRATIVO', 'ESPECIALISTA DE PLANEJAMENTO', 'LIDER DE FROTA E EQUIPAMENTOS'] as const;
export const SECTORS = ['TMUT/NAVIO', 'PATIO', 'ARMAZÉM/PÁTIO', 'GATE', 'AMBOS'] as const;
export const PERMISSION_LEVELS = ['Administrador', 'Gestor', 'Supervisor', 'Consulta'] as const;

export const SHIFT_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  'D1': { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30', dot: 'bg-amber-500' },
  'D2': { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30', dot: 'bg-orange-500' },
  'N1': { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30', dot: 'bg-blue-500' },
  'N2': { bg: 'bg-slate-500/15', text: 'text-slate-300', border: 'border-slate-500/30', dot: 'bg-slate-500' },
  'ROTATIVO': { bg: 'bg-teal-500/15', text: 'text-teal-400', border: 'border-teal-500/30', dot: 'bg-teal-500' },
  'COMERCIAL': { bg: 'bg-cyan-500/15', text: 'text-cyan-400', border: 'border-cyan-500/30', dot: 'bg-cyan-500' },
};

export const STATUS_COLORS: Record<string, string> = {
  'Escalado': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  'Folga': 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  'Férias': 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  'Afastado': 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  'Falta': 'bg-red-500/15 text-red-400 border-red-500/30',
  'Cobertura': 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  'Troca': 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  'Ativo': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  'Inativo': 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  'Pendente': 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  'Aprovada': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  'Aprovado': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  'Recusada': 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  'Recusado': 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  'Cancelada': 'bg-slate-500/15 text-slate-400 border-slate-500/30',
};

export const SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  danger: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30', icon: 'text-rose-400' },
  warning: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', icon: 'text-amber-400' },
  info: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30', icon: 'text-blue-400' },
};

export const COVERAGE_STATUS: Record<string, { label: string; class: string }> = {
  covered: { label: 'COBERTO', class: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  attention: { label: 'ATENÇÃO', class: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  shortfall: { label: 'DESFALQUE', class: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
};

export function getCoverageStatus(required: number, assigned: number): string {
  if (assigned >= required) return 'covered';
  if (assigned >= required * 0.8) return 'attention';
  return 'shortfall';
}
