import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  Download,
  Filter,
  History,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldAlert,
  SlidersHorizontal,
  Upload,
  UserRound,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  ASSIGNMENT_STATUSES,
  COVERAGE_STATUS,
  EMPLOYEE_STATUSES,
  LEAVE_STATUSES,
  LEAVE_TYPES,
  PERMISSION_LEVELS,
  ROLES,
  SECTORS,
  SHIFT_GROUPS,
  STATUS_COLORS,
  SWAP_STATUSES,
  getCoverageStatus,
  type ChangeHistoryRecord,
  type CoverageRequirement,
  type Employee,
  type LeaveRecord,
  type OperationalAlert,
  type ShiftAssignment,
  type ShiftScale,
  type ShiftSwap,
} from '@/types';
import { dateToISO, formatDate, formatDateShort, getMonthDates, getWeekdayName, getWeekdayShort, MONTHS_PT } from '@/lib/dateUtils';
import { validateEmployeeAvailability } from '@/lib/availability';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Badge, RoleBadge, ShiftBadge, StatusBadge } from '@/components/ui/Badge';
import { Input, SearchInput, Select, Textarea } from '@/components/ui/Form';
import { EmptyState, PageHeader, StatCard, TableSkeleton } from '@/components/ui/Layout';
import { EquipesTab } from '@/components/EquipesTab';
import { Escala2x2Tab } from '@/components/Escala2x2Tab';
import { RelatoriosTab } from '@/components/RelatoriosTab';
import { VacationTab } from '@/components/VacationTab';

type TabKey = 'escala' | 'escala2x2' | 'equipes' | 'colaboradores' | 'calendario' | 'trocas' | 'afastamentos' | 'ferias-programacao' | 'cobertura' | 'historico' | 'relatorios';
type ViewMode = 'diaria' | 'semanal' | 'mensal';

interface Filters {
  period: string;
  shift: string;
  role: string;
  employee: string;
  status: string;
  sector: string;
  search: string;
}

const defaultFilters: Filters = { period: '2026-10-01', shift: '', role: '', employee: '', status: '', sector: '', search: '' };
const blankAssignment: Partial<ShiftAssignment> = { date: '2026-10-01', shift_group: 'D1', shift_type: 'Diurno', start_time: '06:00', end_time: '18:00', role: 'TRAB PORT CAPATAZIA', team: 'Equipe D1', status: 'Escalado', notes: '' };

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('escala');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [swaps, setSwaps] = useState<ShiftSwap[]>([]);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [coverage, setCoverage] = useState<CoverageRequirement[]>([]);
  const [history, setHistory] = useState<ChangeHistoryRecord[]>([]);
  const [alerts, setAlerts] = useState<OperationalAlert[]>([]);
  const [scales, setScales] = useState<ShiftScale[]>([]);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [viewMode, setViewMode] = useState<ViewMode>('diaria');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [alertPanelOpen, setAlertPanelOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedDate, setSelectedDate] = useState('2026-10-01');
  const [showNewScale, setShowNewScale] = useState(false);
  const [showNewSwap, setShowNewSwap] = useState(false);
  const [showNewLeave, setShowNewLeave] = useState(false);
  const [showAssignment, setShowAssignment] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<ShiftAssignment | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [toast, setToast] = useState('');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const results = await Promise.all([
        supabase.from('employees').select('*').order('name'),
        supabase.from('shift_assignments').select('*, employee:employees(*)').order('date').order('employee_id'),
        supabase.from('shift_swaps').select('*, requester:employees!requester_id(*), substitute:employees!substitute_id(*)').order('created_at', { ascending: false }),
        supabase.from('leave_records').select('*, employee:employees(*)').order('start_date'),
        supabase.from('coverage_requirements').select('*').order('date').order('shift_group'),
        supabase.from('change_history').select('*').order('created_at', { ascending: false }),
        supabase.from('operational_alerts').select('*').eq('is_resolved', false).order('created_at', { ascending: false }),
        supabase.from('shift_scales').select('*').order('shift_group'),
      ]);
      const errors = results.filter((result) => result.error);
      if (errors.length > 0) {
        setError('Não foi possível carregar todos os dados operacionais. Tente atualizar a tela.');
      }
      setEmployees(results[0].data || []);
      setAssignments(results[1].data || []);
      setSwaps(results[2].data || []);
      setLeaves(results[3].data || []);
      setCoverage(results[4].data || []);
      setHistory(results[5].data || []);
      setAlerts(results[6].data || []);
      setScales(results[7].data || []);
    } catch (reason) {
      setError(`Falha ao carregar os dados operacionais: ${reason instanceof Error ? reason.message : 'erro inesperado'}.`);
      setEmployees([]);
      setAssignments([]);
      setSwaps([]);
      setLeaves([]);
      setCoverage([]);
      setHistory([]);
      setAlerts([]);
      setScales([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const activeEmployees = employees.filter((employee) => employee.status === 'Ativo').length;
  const vacationEmployees = employees.filter((employee) => employee.status === 'Férias').length;
  const absentEmployees = employees.filter((employee) => employee.status === 'Afastado').length;
  const pendingSwaps = swaps.filter((swap) => swap.status === 'Pendente').length;
  const criticalAlerts = alerts.filter((alert) => alert.severity === 'danger').length;

  const updateFilters = (patch: Partial<Filters>) => setFilters((current) => ({ ...current, ...patch }));
  const clearFilters = () => setFilters(defaultFilters);
  const goToTab = (tab: TabKey) => { setActiveTab(tab); setAlertPanelOpen(false); setSidebarOpen(false); };

  const handleAssignmentSave = async (data: Partial<ShiftAssignment>) => {
    const employee = employees.find((item) => item.id === data.employee_id);
    if (!employee) return;
    let availabilityAlert = '';
    if (data.status === 'Escalado' && data.date) {
      const availability = validateEmployeeAvailability(employee, data.date);
      const leave = leaves.find((item) => item.employee_id === employee.id && data.date && data.date >= item.start_date && data.date <= item.end_date && ['Férias', 'Afastamento', 'Licença'].includes(item.leave_type));
      if (leave) {
        setToast(`Não é possível escalar durante ${leave.leave_type.toLowerCase()}.`);
        return;
      }
      if (!availability.available) {
        setToast(`Escala bloqueada: ${availability.reason}.`);
        return;
      }
      availabilityAlert = availability.alert || '';
    }
    if (editingAssignment) {
      const { data: updated, error: updateError } = await supabase.from('shift_assignments').update(data).eq('id', editingAssignment.id).select('*, employee:employees(*)').maybeSingle();
      if (updateError || !updated) { setToast('Não foi possível salvar a alteração.'); return; }
      setAssignments((current) => current.map((item) => item.id === updated.id ? updated : item));
      await supabase.from('change_history').insert({ user_name: 'Administrador', employee_name: employee.name, field_changed: 'Escala', old_value: editingAssignment.status, new_value: data.status || editingAssignment.status, reason: 'Edição rápida na escala', change_time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) });
      setToast(`Escala atualizada e histórico registrado.${availabilityAlert ? ` ${availabilityAlert}.` : ''}`);
    } else {
      const { data: created, error: createError } = await supabase.from('shift_assignments').insert({ ...blankAssignment, ...data }).select('*, employee:employees(*)').maybeSingle();
      if (createError || !created) { setToast('Não foi possível criar a escala.'); return; }
      setAssignments((current) => [...current, created]);
      setToast(`Nova escala adicionada.${availabilityAlert ? ` ${availabilityAlert}.` : ''}`);
    }
    setShowAssignment(false); setEditingAssignment(null); loadData();
  };

  const resolveAlert = async (alert: OperationalAlert) => {
    await supabase.from('operational_alerts').update({ is_resolved: true }).eq('id', alert.id);
    setAlerts((current) => current.filter((item) => item.id !== alert.id));
    setToast('Alerta marcado como resolvido.');
  };

  const handleSwapStatus = async (swap: ShiftSwap, status: string) => {
    await supabase.from('shift_swaps').update({ status, approver: 'Administrador' }).eq('id', swap.id);
    setSwaps((current) => current.map((item) => item.id === swap.id ? { ...item, status, approver: 'Administrador' } : item));
    setToast(`Troca ${status.toLowerCase()}.`);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200">
      <header className="h-16 bg-[#0b2538] text-white flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30 shadow-lg">
        <div className="flex items-center gap-3">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-2 hover:bg-white/10 rounded-lg"><Menu size={20} /></button>
          <div className="w-9 h-9 bg-[#e3a62f] rounded-lg flex items-center justify-center shadow-inner"><span className="text-[#0b2538] font-black text-lg">S</span></div>
          <div><p className="text-sm font-bold tracking-[0.2em]">SGO</p><p className="text-[10px] text-slate-300 tracking-wider">UNILINK · OPERAÇÕES</p></div>
        </div>
        <div className="hidden md:flex items-center gap-4"><div className="text-right"><p className="text-xs text-slate-400">Operações Portuárias</p><p className="text-sm font-medium">2026 · Turno atual</p></div><div className="h-8 w-px bg-white/20" /><button onClick={() => setAlertPanelOpen(!alertPanelOpen)} className="relative p-2 hover:bg-white/10 rounded-lg transition-colors"><Bell size={20} /><span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-rose-500 rounded-full text-[10px] flex items-center justify-center">{alerts.length}</span></button><div className="w-8 h-8 rounded-full bg-[#2d5d7e] flex items-center justify-center text-sm font-semibold">AD</div></div>
      </header>

      <div className="flex">
        <aside className={`fixed lg:sticky top-16 left-0 z-20 h-[calc(100vh-4rem)] w-64 bg-slate-850 text-slate-300 flex-shrink-0 transform transition-transform lg:transform-none ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
          <div className="p-4 border-b border-slate-700/50"><div className="flex items-center gap-2 text-[#e3a62f]"><LayoutDashboard size={16} /><span className="text-xs font-semibold tracking-wider uppercase">Módulo operacional</span></div><p className="text-slate-100 font-semibold mt-2">SHIFT MASTER</p><p className="text-[11px] text-slate-500 mt-0.5">Gestão integrada de escalas</p></div>
          <nav className="p-3 space-y-1">
            {[['escala', ClipboardList, 'Escala'], ['escala2x2', CalendarDays, 'Escala 2x2'], ['equipes', UserRound, 'Equipes por coordenador'], ['colaboradores', Users, 'Colaboradores'], ['calendario', CalendarDays, 'Calendário'], ['trocas', ArrowRightLeft, 'Trocas de plantão'], ['afastamentos', Clock3, 'Férias / Afastamentos'], ['ferias-programacao', CalendarDays, 'Programação de férias'], ['cobertura', ShieldAlert, 'Cobertura operacional'], ['relatorios', Download, 'Relatórios Operacionais'], ['historico', History, 'Histórico']].map(([key, Icon, label]) => <button key={key as string} onClick={() => goToTab(key as TabKey)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${activeTab === key ? 'bg-[#e3a62f] text-[#0b2538] font-semibold shadow-md' : 'hover:bg-white/10 hover:text-white'}`}><Icon size={17} /><span>{label as string}</span>{key === 'trocas' && pendingSwaps > 0 && <span className="ml-auto text-[10px] font-bold bg-amber-400 text-amber-950 rounded-full px-1.5 py-0.5">{pendingSwaps}</span>}</button>)}
          </nav>
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-700/50"><button onClick={() => setShowConfig(true)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-slate-700/50 transition-colors"><Settings2 size={17} /><span>Configuração da escala</span></button><div className="mt-3 flex items-center gap-2 text-[10px] text-slate-500"><span className="w-2 h-2 bg-emerald-400 rounded-full" /> Sistema operacional</div></div>
        </aside>

        <main className="flex-1 min-w-0">
          <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1700px] mx-auto">
            <div className="flex items-center justify-between mb-6"><div><p className="text-xs text-slate-400 mb-1">Visão operacional · 2026</p><h1 className="text-2xl font-bold text-slate-100 tracking-tight">SHIFT MASTER</h1><p className="text-sm text-slate-400 mt-1">Central de gestão de escalas, equipes e cobertura operacional.</p></div><div className="flex items-center gap-2"><button onClick={() => setAlertPanelOpen(true)} className="md:hidden relative p-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-300"><Bell size={18} /><span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full text-[10px] text-white flex items-center justify-center">{alerts.length}</span></button><button onClick={loadData} className="p-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 transition-colors" title="Atualizar dados"><RefreshCw size={17} /></button><button onClick={() => setShowAssignment(true)} className="hidden sm:flex items-center gap-2 px-3.5 py-2.5 bg-[#e3a62f] text-[#0b2538] rounded-lg text-sm font-bold hover:bg-[#f0b83e] transition-colors shadow-sm"><Plus size={16} /> Nova escala</button></div></div>

            {error && <div className="mb-5 flex items-center gap-3 p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm"><AlertTriangle size={17} />{error}<button onClick={loadData} className="ml-auto underline">Tentar novamente</button></div>}

            <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 mb-6"><StatCard label="Efetivo total" value={employees.length} meta="cadastrados" icon={<Users size={20} />} accent="blue" /><StatCard label="Ativos" value={activeEmployees} meta="em operação" icon={<CheckCircle2 size={20} />} accent="emerald" /><StatCard label="Em férias" value={vacationEmployees} meta="afastamento programado" icon={<CalendarDays size={20} />} accent="amber" /><StatCard label="Afastados" value={absentEmployees} meta="licença / atestado" icon={<Clock3 size={20} />} accent="rose" /><StatCard label="Alertas abertos" value={alerts.length} meta={`${criticalAlerts} críticos`} icon={<ShieldAlert size={20} />} accent="slate" /></div>

            <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-sm mb-5 p-3"><div className="flex items-center gap-2 mb-3"><Filter size={15} className="text-slate-400" /><span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Filtros globais</span><button onClick={clearFilters} className="ml-auto text-xs text-amber-400 hover:text-amber-300">Limpar filtros</button></div><div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2"><Input type="date" value={filters.period} onChange={(e) => updateFilters({ period: e.target.value })} /><Select value={filters.shift} onChange={(e) => updateFilters({ shift: e.target.value })} options={SHIFT_GROUPS.map((shift) => ({ value: shift, label: shift }))} placeholder="Todos os plantões" /><Select value={filters.role} onChange={(e) => updateFilters({ role: e.target.value })} options={ROLES.map((role) => ({ value: role, label: role }))} placeholder="Todas as funções" /><Select value={filters.sector} onChange={(e) => updateFilters({ sector: e.target.value })} options={SECTORS.map((sector) => ({ value: sector, label: sector }))} placeholder="Todos os setores" /><Select value={filters.status} onChange={(e) => updateFilters({ status: e.target.value })} options={[...EMPLOYEE_STATUSES.map((status) => ({ value: `employee:${status}`, label: `Colaborador · ${status}` })), ...ASSIGNMENT_STATUSES.map((status) => ({ value: `assignment:${status}`, label: `Escala · ${status}` }))]} placeholder="Todos os status" /><SearchInput value={filters.search} onChange={(e) => updateFilters({ search: e.target.value })} placeholder="Pesquisar colaborador" className="col-span-2 sm:col-span-1" /><button onClick={() => setToast('Filtros salvos com sucesso.')} className="hidden lg:flex items-center justify-center gap-2 px-3 py-2 text-sm text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-700"><SlidersHorizontal size={15} /> Salvar filtro</button></div></div>

            <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-700 mb-5">{[['escala','Escala',ClipboardList],['escala2x2','Escala 2x2',CalendarDays],['equipes','Equipes',UserRound],['colaboradores','Colaboradores',Users],['calendario','Calendário',CalendarDays],['trocas','Trocas',ArrowRightLeft],['afastamentos','Férias / Afastamentos',Clock3],['ferias-programacao','Programação de férias',CalendarDays],['cobertura','Cobertura',ShieldAlert],['relatorios','Relatórios',Download],['historico','Histórico',History]].map(([key,label,Icon]) => <button key={key as string} onClick={() => setActiveTab(key as TabKey)} className={`flex items-center gap-2 px-3.5 py-3 text-sm whitespace-nowrap border-b-2 transition-colors ${activeTab === key ? 'border-[#e3a62f] text-amber-400 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-300'}`}><Icon size={16} />{label as string}{key === 'trocas' && pendingSwaps > 0 && <span className="bg-amber-100 text-amber-700 px-1.5 rounded text-[10px] font-bold">{pendingSwaps}</span>}</button>)}</div>

            {isLoading ? <div className="bg-slate-800 border border-slate-700 rounded-xl"><TableSkeleton rows={8} columns={7} /></div> : <>{activeTab === 'escala' && <ScaleTab assignments={assignments} employees={employees} filters={filters} viewMode={viewMode} setViewMode={setViewMode} onEdit={(assignment) => { setEditingAssignment(assignment); setShowAssignment(true); }} onNew={() => setShowAssignment(true)} />}{activeTab === 'escala2x2' && <Escala2x2Tab employees={employees} filters={filters} />}{activeTab === 'equipes' && <EquipesTab employees={employees} assignments={assignments} leaves={leaves} filters={filters} onSelect={setSelectedEmployee} />}{activeTab === 'colaboradores' && <EmployeesTab employees={employees} assignments={assignments} leaves={leaves} filters={filters} onSelect={setSelectedEmployee} onNew={() => setToast('Cadastro de colaborador será disponibilizado em breve.')} />}{activeTab === 'calendario' && <CalendarTab assignments={assignments} employees={employees} leaves={leaves} selectedDate={selectedDate} setSelectedDate={setSelectedDate} onEdit={(assignment) => { setEditingAssignment(assignment); setShowAssignment(true); }} />}{activeTab === 'trocas' && <SwapsTab swaps={swaps} employees={employees} onNew={() => setShowNewSwap(true)} onStatus={handleSwapStatus} />}{activeTab === 'afastamentos' && <LeaveTab leaves={leaves} employees={employees} onNew={() => setShowNewLeave(true)} />}{activeTab === 'ferias-programacao' && <VacationTab employees={employees} shiftScales={scales} onDataChanged={loadData} />}{activeTab === 'cobertura' && <CoverageTab coverage={coverage} />}{activeTab === 'historico' && <HistoryTab history={history} />}{activeTab === 'relatorios' && <RelatoriosTab employees={employees} />}</>}
          </div>
        </main>
      </div>

      {alertPanelOpen && <AlertPanel alerts={alerts} onClose={() => setAlertPanelOpen(false)} onResolve={resolveAlert} onNavigate={(alert) => { setFilters((current) => ({ ...current, shift: alert.shift_group })); goToTab('escala'); }} />}
      <EmployeeModal employee={selectedEmployee} assignments={assignments} leaves={leaves} onClose={() => setSelectedEmployee(null)} />
      <AssignmentModal open={showAssignment} assignment={editingAssignment} employees={employees} onClose={() => { setShowAssignment(false); setEditingAssignment(null); }} onSave={handleAssignmentSave} />
      <SwapModal open={showNewSwap} employees={employees} onClose={() => setShowNewSwap(false)} onSaved={() => { setShowNewSwap(false); loadData(); setToast('Solicitação de troca criada.'); }} />
      <LeaveModal open={showNewLeave} employees={employees} onClose={() => setShowNewLeave(false)} onSaved={() => { setShowNewLeave(false); loadData(); setToast('Registro de afastamento criado.'); }} />
      <ScaleConfigModal open={showConfig} scales={scales} onClose={() => setShowConfig(false)} onSaved={() => { setShowConfig(false); loadData(); setToast('Configuração atualizada.'); }} />
      {toast && <div className="fixed bottom-5 right-5 z-[60] flex items-center gap-3 px-4 py-3 bg-slate-800 text-slate-100 border border-slate-700 rounded-lg shadow-xl text-sm"><CheckCircle2 size={17} className="text-emerald-400" />{toast}<button onClick={() => setToast('')} className="text-slate-500 hover:text-slate-300"><X size={15} /></button></div>}
    </div>
  );
}

function getDateRangePreset(preset: string): { start: string; end: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  if (preset === 'today') return { start: fmt(today), end: fmt(today) };
  if (preset === 'week') {
    const day = today.getDay();
    const monday = new Date(today); monday.setDate(today.getDate() - day + (day === 0 ? -6 : 0));
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    return { start: fmt(monday), end: fmt(sunday) };
  }
  if (preset === 'month') {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { start: fmt(first), end: fmt(last) };
  }
  return { start: fmt(today), end: fmt(today) };
}

function ScaleTab({ assignments, employees, filters, viewMode, setViewMode, onEdit, onNew }: { assignments: ShiftAssignment[]; employees: Employee[]; filters: Filters; viewMode: ViewMode; setViewMode: (mode: ViewMode) => void; onEdit: (assignment: ShiftAssignment) => void; onNew: () => void }) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [rangePreset, setRangePreset] = useState<'hoje' | 'semana' | 'mes' | 'custom'>('hoje');
  const [customStart, setCustomStart] = useState(getDateRangePreset('today').start);
  const [customEnd, setCustomEnd] = useState(getDateRangePreset('today').end);

  const activeRange = useMemo(() => {
    if (rangePreset === 'hoje') return getDateRangePreset('today');
    if (rangePreset === 'semana') return getDateRangePreset('week');
    if (rangePreset === 'mes') return getDateRangePreset('month');
    return { start: customStart, end: customEnd };
  }, [rangePreset, customStart, customEnd]);

  const filtered = useMemo(() => assignments.filter((assignment) => {
    const employee = assignment.employee || employees.find((item) => item.id === assignment.employee_id);
    const inRange = assignment.date >= activeRange.start && assignment.date <= activeRange.end;
    const statusMatches = !filters.status ||
      (filters.status.startsWith('employee:') && employee?.status === filters.status.slice('employee:'.length)) ||
      (filters.status.startsWith('assignment:') && assignment.status === filters.status.slice('assignment:'.length));
    const search = filters.search.trim().toLocaleLowerCase('pt-BR');
    const employeeMatches = !filters.employee || employee?.id === filters.employee || employee?.registration === filters.employee;
    const textMatches = !search || Boolean(employee && `${employee.name} ${employee.registration}`.toLocaleLowerCase('pt-BR').includes(search));
    return inRange &&
      (!filters.shift || assignment.shift_group === filters.shift || employee?.shift_group === filters.shift) &&
      (!filters.role || assignment.role === filters.role || employee?.role === filters.role) &&
      statusMatches &&
      (!filters.sector || employee?.sector === filters.sector) &&
      employeeMatches &&
      textMatches;
  }), [assignments, employees, filters, activeRange]);

  const sorted = [...filtered].sort((a, b) => (a.employee?.name || '').localeCompare(b.employee?.name || ''));

  return <div><PageHeader title="Escala operacional" description="Visualização e gerenciamento diário do efetivo escalado." actions={<><div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">{(['diaria','semanal','mensal'] as ViewMode[]).map((mode) => <button key={mode} onClick={() => setViewMode(mode)} className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize ${viewMode === mode ? 'bg-slate-700 shadow-sm text-amber-400' : 'text-slate-400'}`}>{mode}</button>)}</div><button onClick={onNew} className="flex items-center gap-2 px-3 py-2 bg-[#e3a62f] text-[#0b2538] rounded-lg text-sm font-bold hover:bg-[#f0b83e]"><Plus size={16} /> Nova escala</button></>} />

    <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-sm mb-5 p-4">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <CalendarDays size={15} className="text-slate-400" />
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Período</span>
        <div className="flex gap-1 ml-2">
          {([['hoje','Hoje'],['semana','Esta Semana'],['mes','Este Mês'],['custom','Personalizado']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setRangePreset(key)} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${rangePreset === key ? 'bg-[#e3a62f] text-[#0b2538]' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>{label}</button>
          ))}
        </div>
        {rangePreset === 'custom' && (
          <div className="flex items-center gap-2 ml-2">
            <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-auto" />
            <span className="text-slate-500 text-xs">até</span>
            <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-auto" />
          </div>
        )}
      </div>
    </div>

    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">{SHIFT_GROUPS.map((shift) => { const count = filtered.filter((a) => a.shift_group === shift && a.status === 'Escalado').length; return <div key={shift} className="bg-slate-800 border border-slate-700 rounded-lg p-3"><div className="flex items-center gap-2 mb-1"><span className="w-2 h-2 rounded-full bg-slate-500" /><span className="text-xs text-slate-400">{shift}</span></div><p className="text-xl font-bold text-slate-100">{count}</p><p className="text-[11px] text-slate-500">colaboradores</p></div>; })}</div>
    <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-sm overflow-hidden"><div className="flex items-center justify-between px-4 py-3 border-b border-slate-700"><div><p className="font-semibold text-sm text-slate-200">Escala de {formatDate(activeRange.start)}{activeRange.start !== activeRange.end ? ` — ${formatDate(activeRange.end)}` : ''}</p><p className="text-xs text-slate-400">{filtered.length} registros encontrados</p></div><div className="flex items-center gap-2 text-xs text-slate-400"><button className="p-1.5 border border-slate-600 rounded hover:bg-slate-700"><Download size={15} /></button><button className="p-1.5 border border-slate-600 rounded hover:bg-slate-700"><Upload size={15} /></button></div></div>{sorted.length === 0 ? <EmptyState message="Nenhum colaborador encontrado com os filtros atuais" action={<button onClick={onNew} className="text-sm text-amber-400">Adicionar escala</button>} /> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-850 text-xs text-slate-400 uppercase tracking-wide"><tr><th className="text-left px-4 py-3 font-semibold">Data</th><th className="text-left px-4 py-3 font-semibold">Plantão</th><th className="text-left px-4 py-3 font-semibold">Coordenador</th><th className="text-left px-4 py-3 font-semibold">Horário</th><th className="text-left px-4 py-3 font-semibold">Equipe</th><th className="text-left px-4 py-3 font-semibold">Colaborador</th><th className="text-left px-4 py-3 font-semibold">Função</th><th className="text-left px-4 py-3 font-semibold">Status</th><th className="text-left px-4 py-3 font-semibold">Obs.</th><th className="px-4 py-3" /></tr></thead><tbody className="divide-y divide-slate-700">{sorted.map((assignment) => <tr key={assignment.id} className="hover:bg-slate-750 transition-colors"><td className="px-4 py-3 whitespace-nowrap"><p className="font-medium text-slate-300">{formatDateShort(assignment.date)}</p><p className="text-[11px] text-slate-500">{getWeekdayShort(assignment.date)}</p></td><td className="px-4 py-3"><ShiftBadge shift={assignment.shift_group} /></td><td className="px-4 py-3 text-slate-400">{assignment.coordinator || '—'}</td><td className="px-4 py-3 text-slate-400 whitespace-nowrap"><span className="flex items-center gap-1.5"><Clock3 size={13} className="text-slate-500" />{assignment.start_time} — {assignment.end_time}</span></td><td className="px-4 py-3 text-slate-400">{assignment.team}</td><td className="px-4 py-3"><p className="font-medium text-slate-200">{assignment.employee?.name || '—'}</p><p className="text-[11px] text-slate-500">Mat. {assignment.employee?.registration}</p></td><td className="px-4 py-3"><RoleBadge role={assignment.role} /></td><td className="px-4 py-3"><button onClick={() => onEdit(assignment)}><StatusBadge status={assignment.status} /></button></td><td className="px-4 py-3 max-w-[160px] truncate text-xs text-slate-500">{assignment.notes || '—'}</td><td className="px-4 py-3 relative"><button onClick={() => setOpenMenu(openMenu === assignment.id ? null : assignment.id)} className="p-1.5 rounded hover:bg-slate-700 text-slate-500"><MoreHorizontal size={17} /></button>{openMenu === assignment.id && <div className="absolute right-4 top-10 z-10 w-48 bg-slate-800 border border-slate-600 rounded-lg shadow-xl py-1 text-xs"><button onClick={() => { onEdit(assignment); setOpenMenu(null); }} className="w-full text-left px-3 py-2 text-slate-300 hover:bg-slate-700">Editar escala</button><button onClick={() => { onEdit(assignment); setOpenMenu(null); }} className="w-full text-left px-3 py-2 text-slate-300 hover:bg-slate-700">Alterar plantão</button><button onClick={() => setOpenMenu(null)} className="w-full text-left px-3 py-2 text-slate-300 hover:bg-slate-700">Registrar folga</button><button onClick={() => setOpenMenu(null)} className="w-full text-left px-3 py-2 text-slate-300 hover:bg-slate-700">Adicionar observação</button><button onClick={() => setOpenMenu(null)} className="w-full text-left px-3 py-2 text-slate-300 hover:bg-slate-700">Visualizar histórico</button></div>}</td></tr>)}</tbody></table></div>}</div>
  </div>;
}

function EmployeesTab({ employees, assignments, leaves, filters, onSelect, onNew }: { employees: Employee[]; assignments: ShiftAssignment[]; leaves: LeaveRecord[]; filters: Filters; onSelect: (employee: Employee) => void; onNew: () => void }) {
  const [search, setSearch] = useState('');
  const globalSearch = filters.search.trim().toLocaleLowerCase('pt-BR');
  const localSearch = search.trim().toLocaleLowerCase('pt-BR');
  const list = employees.filter((employee) => {
    const status = filters.status.startsWith('employee:')
      ? employee.status === filters.status.slice('employee:'.length)
      : !filters.status || assignments.some((assignment) =>
        assignment.employee_id === employee.id &&
        assignment.date === filters.period &&
        assignment.status === filters.status.slice('assignment:'.length));
    const text = `${employee.name} ${employee.registration}`.toLocaleLowerCase('pt-BR');
    return (!filters.shift || employee.shift_group === filters.shift) &&
      (!filters.role || employee.role === filters.role) &&
      (!filters.sector || employee.sector === filters.sector) &&
      status &&
      (!globalSearch || text.includes(globalSearch)) &&
      (!localSearch || text.includes(localSearch));
  });
  return <div><PageHeader title="Colaboradores" description={`${list.length} colaboradores vinculados ao SHIFT MASTER.`} actions={<button onClick={onNew} className="flex items-center gap-2 px-3 py-2 bg-[#e3a62f] text-[#0b2538] rounded-lg text-sm font-bold"><Plus size={16} /> Novo colaborador</button>} /><div className="bg-slate-800 border border-slate-700 rounded-xl shadow-sm overflow-hidden"><div className="p-3 border-b border-slate-700 flex items-center gap-3"><SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar por nome ou matrícula" className="max-w-sm" /><span className="text-xs text-slate-500">Clique em uma linha para abrir os detalhes</span></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-850 text-xs text-slate-400 uppercase tracking-wide"><tr><th className="text-left px-4 py-3">Nome</th><th className="text-left px-4 py-3">Matrícula</th><th className="text-left px-4 py-3">Função</th><th className="text-left px-4 py-3">Setor</th><th className="text-left px-4 py-3">Plantão atual</th><th className="text-left px-4 py-3">Horário</th><th className="text-left px-4 py-3">Status</th><th className="text-left px-4 py-3">Situação na escala</th></tr></thead><tbody className="divide-y divide-slate-700">{list.map((employee) => { const next = assignments.find((a) => a.employee_id === employee.id && a.date >= filters.period && a.status === 'Escalado'); const leave = leaves.find((l) => l.employee_id === employee.id && filters.period >= l.start_date && filters.period <= l.end_date); return <tr key={employee.id} onClick={() => onSelect(employee)} className="hover:bg-slate-750 cursor-pointer transition-colors"><td className="px-4 py-3"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-slate-700 text-amber-400 flex items-center justify-center text-xs font-bold">{employee.name.split(' ').map((n) => n[0]).slice(0,2).join('')}</div><span className="font-medium text-slate-200">{employee.name}</span></div></td><td className="px-4 py-3 text-slate-400">{employee.registration}</td><td className="px-4 py-3"><RoleBadge role={employee.role} /></td><td className="px-4 py-3 text-slate-400">{employee.sector}</td><td className="px-4 py-3"><ShiftBadge shift={employee.shift_group} /></td><td className="px-4 py-3 text-slate-400">{employee.schedule_start} — {employee.schedule_end}</td><td className="px-4 py-3"><StatusBadge status={employee.status} /></td><td className="px-4 py-3">{leave ? <Badge className="bg-sky-500/15 text-sky-400 border-sky-500/30">{leave.leave_type}</Badge> : next ? <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">{next.status}</Badge> : <span className="text-xs text-slate-500">Sem escala</span>}</td></tr>; })}</tbody></table></div>{list.length === 0 && <EmptyState message="Nenhum colaborador encontrado" />}</div></div>;
}

function CalendarTab({ assignments, employees, leaves, selectedDate, setSelectedDate, onEdit }: { assignments: ShiftAssignment[]; employees: Employee[]; leaves: LeaveRecord[]; selectedDate: string; setSelectedDate: (date: string) => void; onEdit: (assignment: ShiftAssignment) => void }) {
  const base = new Date(selectedDate + 'T00:00:00'); const [month, setMonth] = useState(base.getMonth()); const [year, setYear] = useState(base.getFullYear()); const dates = getMonthDates(year, month); const leading = new Date(year, month, 1).getDay(); const cells = [...Array(leading).fill(null), ...dates];
  const moveMonth = (direction: number) => { const next = new Date(year, month + direction, 1); setMonth(next.getMonth()); setYear(next.getFullYear()); };
  const selected = assignments.filter((a) => a.date === selectedDate); const selectedLeaves = leaves.filter((l) => selectedDate >= l.start_date && selectedDate <= l.end_date);
  return <div><PageHeader title="Calendário operacional" description="Selecione uma data para visualizar e editar a escala do dia." /><div className="grid lg:grid-cols-[1fr_380px] gap-5"><div className="bg-slate-800 border border-slate-700 rounded-xl shadow-sm overflow-hidden"><div className="flex items-center justify-between px-5 py-4 border-b border-slate-700"><button onClick={() => moveMonth(-1)} className="p-2 hover:bg-slate-700 rounded-lg text-slate-300"><ChevronLeft size={18} /></button><h3 className="font-semibold text-slate-200">{MONTHS_PT[month]} {year}</h3><button onClick={() => moveMonth(1)} className="p-2 hover:bg-slate-700 rounded-lg text-slate-300"><ChevronRight size={18} /></button></div><div className="grid grid-cols-7 border-b border-slate-700">{['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map((day) => <div key={day} className="py-2 text-center text-[11px] font-semibold text-slate-500 uppercase">{day}</div>)}</div><div className="grid grid-cols-7">{cells.map((date, index) => { const count = date ? assignments.filter((a) => a.date === date && a.status === 'Escalado').length : 0; const isToday = date === new Date().toISOString().slice(0,10); const isSelected = date === selectedDate; return <button key={`${date}-${index}`} disabled={!date} onClick={() => date && setSelectedDate(date)} className={`min-h-[92px] p-2 border-r border-b border-slate-700/50 text-left transition-colors ${!date ? 'bg-slate-850' : isSelected ? 'bg-amber-500/10' : 'hover:bg-slate-750'}`}><div className={`w-7 h-7 flex items-center justify-center rounded-full text-sm ${isToday ? 'bg-[#e3a62f] text-[#0b2538] font-bold' : isSelected ? 'bg-amber-500 text-slate-900 font-semibold' : 'text-slate-400'}`}>{date ? Number(date.slice(-2)) : ''}</div>{date && count > 0 && <div className="mt-2 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /><span className="text-[10px] text-slate-500">{count} escalados</span></div>}{date && leaves.filter((l) => date >= l.start_date && date <= l.end_date).length > 0 && <div className="mt-1 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-sky-500 rounded-full" /><span className="text-[10px] text-sky-400">Afastamentos</span></div>}</button>; })}</div></div><div className="bg-slate-800 border border-slate-700 rounded-xl shadow-sm overflow-hidden"><div className="px-5 py-4 border-b border-slate-700"><p className="text-xs text-slate-500 uppercase tracking-wide">Escala do dia</p><h3 className="font-semibold text-slate-200 mt-1">{formatDate(selectedDate)}</h3><p className="text-xs text-slate-400">{getWeekdayName(selectedDate)} · {selected.length} escalados</p></div><div className="p-4 space-y-3 max-h-[520px] overflow-y-auto">{selected.length === 0 ? <EmptyState message="Nenhum colaborador escalado" /> : selected.map((assignment) => <div key={assignment.id} className="p-3 rounded-lg border border-slate-700 hover:border-amber-500/30 hover:bg-amber-500/5 cursor-pointer" onClick={() => onEdit(assignment)}><div className="flex items-start justify-between gap-2"><div><p className="text-sm font-semibold text-slate-200">{assignment.employee?.name || 'Colaborador'}</p><p className="text-xs text-slate-400 mt-0.5">{assignment.role} · {assignment.team}</p></div><StatusBadge status={assignment.status} /></div><div className="flex items-center gap-2 mt-2"><ShiftBadge shift={assignment.shift_group} /><span className="text-xs text-slate-400">{assignment.start_time} — {assignment.end_time}</span></div></div>)}{selectedLeaves.length > 0 && <div className="pt-3 border-t border-slate-700"><p className="text-xs font-semibold text-slate-500 mb-2">Afastamentos na data</p>{selectedLeaves.map((leave) => <div key={leave.id} className="text-xs text-sky-400 bg-sky-500/10 rounded p-2 mb-1">{leave.employee?.name} · {leave.leave_type}</div>)}</div>}</div></div></div></div>;
}

function SwapsTab({ swaps, employees, onNew, onStatus }: { swaps: ShiftSwap[]; employees: Employee[]; onNew: () => void; onStatus: (swap: ShiftSwap, status: string) => void }) {
  return <div><PageHeader title="Trocas de plantão" description="Controle de solicitações, conflitos e aprovações de troca." actions={<button onClick={onNew} className="flex items-center gap-2 px-3 py-2 bg-[#e3a62f] text-[#0b2538] rounded-lg text-sm font-bold"><Plus size={16} /> Nova troca</button>} /><div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">{SWAP_STATUSES.map((status) => <div key={status} className="bg-slate-800 border border-slate-700 rounded-lg p-3"><p className="text-xs text-slate-400">{status}</p><p className="text-xl font-bold text-slate-100 mt-1">{swaps.filter((s) => s.status === status).length}</p></div>)}</div><div className="bg-slate-800 border border-slate-700 rounded-xl shadow-sm overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-850 text-xs text-slate-400 uppercase"><tr><th className="text-left px-4 py-3">Solicitante</th><th className="text-left px-4 py-3">Substituto</th><th className="text-left px-4 py-3">Data original</th><th className="text-left px-4 py-3">Data da troca</th><th className="text-left px-4 py-3">Plantões</th><th className="text-left px-4 py-3">Motivo</th><th className="text-left px-4 py-3">Status</th><th className="px-4 py-3">Ações</th></tr></thead><tbody className="divide-y divide-slate-700">{swaps.map((swap) => <tr key={swap.id} className="hover:bg-slate-750"><td className="px-4 py-3 font-medium text-slate-200">{swap.requester?.name || employees.find((e) => e.id === swap.requester_id)?.name || '—'}</td><td className="px-4 py-3 text-slate-400">{swap.substitute?.name || employees.find((e) => e.id === swap.substitute_id)?.name || 'A definir'}</td><td className="px-4 py-3 text-slate-400">{formatDate(swap.original_date)}</td><td className="px-4 py-3 text-slate-400">{formatDate(swap.swap_date)}</td><td className="px-4 py-3"><div className="flex items-center gap-1"><ShiftBadge shift={swap.original_shift} /><ArrowRightLeft size={13} className="text-slate-500" /><ShiftBadge shift={swap.new_shift} /></div></td><td className="px-4 py-3 text-slate-400 max-w-[160px] truncate">{swap.reason || '—'}{swap.conflict_flags && <p className="text-[10px] text-rose-400 mt-1">{swap.conflict_flags}</p>}</td><td className="px-4 py-3"><StatusBadge status={swap.status} /></td><td className="px-4 py-3">{swap.status === 'Pendente' && <div className="flex items-center gap-1"><button onClick={() => onStatus(swap, 'Aprovada')} className="p-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded" title="Aprovar"><CheckCircle2 size={16} /></button><button onClick={() => onStatus(swap, 'Recusada')} className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded" title="Recusar"><XCircle size={16} /></button></div>}</td></tr>)}</tbody></table></div>{swaps.length === 0 && <EmptyState message="Nenhuma troca registrada" />}</div></div>;
}

function LeaveTab({ leaves, employees, onNew }: { leaves: LeaveRecord[]; employees: Employee[]; onNew: () => void }) {
  return <div><PageHeader title="Férias e afastamentos" description="Férias, licenças, afastamentos e folgas programadas refletidos na escala." actions={<button onClick={onNew} className="flex items-center gap-2 px-3 py-2 bg-[#e3a62f] text-[#0b2538] rounded-lg text-sm font-bold"><Plus size={16} /> Novo afastamento</button>} /><div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">{LEAVE_TYPES.map((type) => <div key={type} className="bg-slate-800 border border-slate-700 rounded-lg p-3"><p className="text-xs text-slate-400">{type}</p><p className="text-xl font-bold text-slate-100 mt-1">{leaves.filter((l) => l.leave_type === type).length}</p><p className="text-[11px] text-slate-500">registros</p></div>)}</div><div className="bg-slate-800 border border-slate-700 rounded-xl shadow-sm overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-850 text-xs text-slate-400 uppercase"><tr><th className="text-left px-4 py-3">Colaborador</th><th className="text-left px-4 py-3">Tipo</th><th className="text-left px-4 py-3">Data inicial</th><th className="text-left px-4 py-3">Data final</th><th className="text-left px-4 py-3">Duração</th><th className="text-left px-4 py-3">Observação</th><th className="text-left px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-700">{leaves.map((leave) => { const start = new Date(leave.start_date + 'T00:00:00'); const end = new Date(leave.end_date + 'T00:00:00'); const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1; return <tr key={leave.id} className="hover:bg-slate-750"><td className="px-4 py-3 font-medium text-slate-200">{leave.employee?.name || employees.find((e) => e.id === leave.employee_id)?.name || '—'}</td><td className="px-4 py-3"><Badge className={leave.leave_type === 'Férias' ? 'bg-sky-500/15 text-sky-400 border-sky-500/30' : 'bg-rose-500/15 text-rose-400 border-rose-500/30'}>{leave.leave_type}</Badge></td><td className="px-4 py-3 text-slate-400">{formatDate(leave.start_date)}</td><td className="px-4 py-3 text-slate-400">{formatDate(leave.end_date)}</td><td className="px-4 py-3 text-slate-400">{days} dias</td><td className="px-4 py-3 text-slate-400 max-w-[220px] truncate">{leave.notes || '—'}</td><td className="px-4 py-3"><StatusBadge status={leave.status} /></td></tr>; })}</tbody></table></div>{leaves.length === 0 && <EmptyState message="Nenhum afastamento registrado" />}</div></div>;
}

function CoverageTab({ coverage }: { coverage: CoverageRequirement[] }) {
  const [date, setDate] = useState('2026-10-01'); const [shift, setShift] = useState(''); const filtered = coverage.filter((item) => item.date === date && (!shift || item.shift_group === shift)); const summary = SHIFT_GROUPS.map((group) => { const items = coverage.filter((item) => item.date === date && item.shift_group === group); return { group, required: items.reduce((sum, item) => sum + item.required_count, 0), assigned: items.reduce((sum, item) => sum + item.assigned_count, 0) }; });
  return <div><PageHeader title="Cobertura operacional" description="Análise de cobertura por plantão e função, sem indicadores gráficos." actions={<><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /><Select value={shift} onChange={(e) => setShift(e.target.value)} options={SHIFT_GROUPS.map((s) => ({ value: s, label: s }))} placeholder="Todos os plantões" /></>} /><div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">{summary.map((item) => { const status = getCoverageStatus(item.required, item.assigned); return <div key={item.group} className="bg-slate-800 border border-slate-700 rounded-lg p-3"><div className="flex items-center justify-between"><p className="text-xs font-medium text-slate-400">{item.group}</p><span className={`w-2 h-2 rounded-full ${status === 'covered' ? 'bg-emerald-500' : status === 'attention' ? 'bg-amber-500' : 'bg-rose-500'}`} /></div><p className="text-lg font-bold text-slate-100 mt-1">{item.assigned} <span className="text-xs font-normal text-slate-500">/ {item.required}</span></p><span className={`text-[10px] font-semibold ${COVERAGE_STATUS[status].class.split(' ')[1]}`}>{COVERAGE_STATUS[status].label}</span></div>; })}</div><div className="bg-slate-800 border border-slate-700 rounded-xl shadow-sm overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-850 text-xs text-slate-400 uppercase"><tr><th className="text-left px-4 py-3">Data</th><th className="text-left px-4 py-3">Plantão</th><th className="text-left px-4 py-3">Função</th><th className="text-left px-4 py-3">Previsto</th><th className="text-left px-4 py-3">Escalado</th><th className="text-left px-4 py-3">Diferença</th><th className="text-left px-4 py-3">Status</th><th className="px-4 py-3">Ação</th></tr></thead><tbody className="divide-y divide-slate-700">{filtered.map((item) => { const diff = item.assigned_count - item.required_count; const status = getCoverageStatus(item.required_count, item.assigned_count); return <tr key={item.id} className="hover:bg-slate-750"><td className="px-4 py-3 text-slate-400">{formatDate(item.date)}</td><td className="px-4 py-3"><ShiftBadge shift={item.shift_group} /></td><td className="px-4 py-3"><RoleBadge role={item.role} /></td><td className="px-4 py-3 font-medium text-slate-200">{item.required_count}</td><td className="px-4 py-3 font-medium text-slate-200">{item.assigned_count}</td><td className={`px-4 py-3 font-semibold ${diff < 0 ? 'text-rose-400' : diff > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>{diff > 0 ? `+${diff}` : diff}</td><td className="px-4 py-3"><span className={`inline-flex px-2 py-1 rounded text-[10px] font-bold border ${COVERAGE_STATUS[status].class}`}>{COVERAGE_STATUS[status].label}</span></td><td className="px-4 py-3">{status !== 'covered' && <button className="text-xs text-amber-400 hover:underline">Ver substitutos</button>}</td></tr>; })}</tbody></table></div>{filtered.length === 0 && <EmptyState message="Nenhum dado de cobertura para os filtros selecionados" />}</div></div>;
}

function HistoryTab({ history }: { history: ChangeHistoryRecord[] }) { return <div><PageHeader title="Histórico de alterações" description="Registro completo de mudanças realizadas no SHIFT MASTER." actions={<button className="flex items-center gap-2 px-3 py-2 border border-slate-600 bg-slate-800 text-slate-300 rounded-lg text-sm hover:bg-slate-700"><Download size={16} /> Exportar</button>} /><div className="bg-slate-800 border border-slate-700 rounded-xl shadow-sm overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-850 text-xs text-slate-400 uppercase"><tr><th className="text-left px-4 py-3">Data / Hora</th><th className="text-left px-4 py-3">Usuário</th><th className="text-left px-4 py-3">Colaborador</th><th className="text-left px-4 py-3">Campo alterado</th><th className="text-left px-4 py-3">Informação anterior</th><th className="text-left px-4 py-3">Nova informação</th><th className="text-left px-4 py-3">Motivo</th></tr></thead><tbody className="divide-y divide-slate-700">{history.map((item) => <tr key={item.id} className="hover:bg-slate-750"><td className="px-4 py-3 whitespace-nowrap"><p className="font-medium text-slate-300">{formatDate(item.change_date)}</p><p className="text-xs text-slate-500">{item.change_time}</p></td><td className="px-4 py-3"><div className="flex items-center gap-2 text-slate-400"><div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center"><UserRound size={13} /></div>{item.user_name}</div></td><td className="px-4 py-3 font-medium text-slate-200">{item.employee_name}</td><td className="px-4 py-3"><Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30">{item.field_changed}</Badge></td><td className="px-4 py-3 text-slate-500">{item.old_value || '—'}</td><td className="px-4 py-3 font-medium text-slate-300">{item.new_value || '—'}</td><td className="px-4 py-3 text-slate-500 max-w-[220px] truncate">{item.reason || '—'}</td></tr>)}</tbody></table></div>{history.length === 0 && <EmptyState message="Nenhuma alteração registrada" />}</div></div>; }

function AlertPanel({ alerts, onClose, onResolve, onNavigate }: { alerts: OperationalAlert[]; onClose: () => void; onResolve: (alert: OperationalAlert) => void; onNavigate: (alert: OperationalAlert) => void }) { return <div className="fixed inset-0 z-40" onClick={onClose}><div className="absolute inset-0 bg-black/50" /><div className="absolute right-0 top-16 bottom-0 w-full max-w-md bg-slate-800 shadow-2xl border-l border-slate-700 flex flex-col" onClick={(e) => e.stopPropagation()}><div className="flex items-center justify-between px-5 py-4 border-b border-slate-700"><div><h2 className="font-semibold text-slate-100">Alertas operacionais</h2><p className="text-xs text-slate-400 mt-0.5">{alerts.length} alertas aguardando ação</p></div><button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400"><X size={18} /></button></div><div className="flex-1 overflow-y-auto p-4 space-y-3">{alerts.length === 0 ? <EmptyState message="Nenhum alerta pendente" /> : alerts.map((alert) => { const colors = alert.severity === 'danger' ? 'border-rose-500/30 bg-rose-500/10' : alert.severity === 'warning' ? 'border-amber-500/30 bg-amber-500/10' : 'border-blue-500/30 bg-blue-500/10'; return <div key={alert.id} className={`p-4 rounded-lg border ${colors}`}><div className="flex items-start gap-3"><AlertTriangle size={18} className={alert.severity === 'danger' ? 'text-rose-400' : alert.severity === 'warning' ? 'text-amber-400' : 'text-blue-400'} /><div className="flex-1 min-w-0"><p className="text-sm font-semibold text-slate-200">{alert.title}</p><p className="text-xs text-slate-400 mt-1 leading-relaxed">{alert.description}</p><div className="flex items-center gap-2 mt-3"><button onClick={() => onNavigate(alert)} className="text-xs font-medium text-amber-400 hover:underline">Abrir ação</button><span className="text-slate-600">·</span><button onClick={() => onResolve(alert)} className="text-xs text-slate-400 hover:text-slate-200">Marcar resolvido</button></div></div></div></div>; })}</div></div></div>; }

function EmployeeModal({ employee, assignments, leaves, onClose }: { employee: Employee | null; assignments: ShiftAssignment[]; leaves: LeaveRecord[]; onClose: () => void }) { if (!employee) return null; const employeeAssignments = assignments.filter((a) => a.employee_id === employee.id).slice(0, 8); const employeeLeaves = leaves.filter((l) => l.employee_id === employee.id); return <Modal open={!!employee} onClose={onClose} title="Detalhes do colaborador" subtitle={`Matrícula ${employee.registration}`} size="lg"><div className="flex items-center gap-4 pb-5 border-b border-slate-700"><div className="w-16 h-16 rounded-2xl bg-slate-700 text-amber-400 flex items-center justify-center text-xl font-bold">{employee.name.split(' ').map((n) => n[0]).slice(0,2).join('')}</div><div><h3 className="text-xl font-semibold text-slate-100">{employee.name}</h3><div className="flex items-center gap-2 mt-1"><RoleBadge role={employee.role} /><StatusBadge status={employee.status} /></div></div></div><div className="grid md:grid-cols-2 gap-6 mt-5"><div><h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Dados do colaborador</h4><div className="space-y-2 text-sm"><p className="flex justify-between"><span className="text-slate-400">Setor</span><span className="font-medium text-slate-200">{employee.sector}</span></p><p className="flex justify-between"><span className="text-slate-400">Plantão</span><ShiftBadge shift={employee.shift_group} /></p><p className="flex justify-between"><span className="text-slate-400">Horário</span><span className="font-medium text-slate-200">{employee.schedule_start} — {employee.schedule_end}</span></p><p className="flex justify-between"><span className="text-slate-400">Admissão</span><span className="font-medium text-slate-200">{employee.hire_date ? formatDate(employee.hire_date) : '—'}</span></p><p className="flex justify-between"><span className="text-slate-400">Situação</span><span className="font-medium text-slate-200">{employee.scale_status}</span></p></div></div><div><h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Ocorrências</h4>{employeeLeaves.length === 0 ? <p className="text-sm text-slate-500">Nenhuma ocorrência registrada.</p> : <div className="space-y-2">{employeeLeaves.map((leave) => <div key={leave.id} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-750"><span className="text-sm text-slate-300">{leave.leave_type}</span><span className="text-xs text-slate-400">{formatDateShort(leave.start_date)} — {formatDateShort(leave.end_date)}</span></div>)}</div>}</div></div><div className="mt-6"><h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Escala recente</h4><div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{employeeAssignments.slice(0, 8).map((assignment) => <div key={assignment.id} className="p-2.5 rounded-lg border border-slate-700"><p className="text-xs font-medium text-slate-300">{formatDateShort(assignment.date)}</p><p className="text-[11px] text-slate-400 mt-1">{assignment.status}</p><span className="text-[10px] text-slate-500">{assignment.start_time} — {assignment.end_time}</span></div>)}</div></div></Modal>; }

function AssignmentModal({ open, assignment, employees, onClose, onSave }: { open: boolean; assignment: ShiftAssignment | null; employees: Employee[]; onClose: () => void; onSave: (data: Partial<ShiftAssignment>) => void }) { const [form, setForm] = useState<Partial<ShiftAssignment>>(blankAssignment); useEffect(() => { setForm(assignment ? { ...assignment } : { ...blankAssignment, employee_id: employees[0]?.id }); }, [assignment, employees, open]); const update = (patch: Partial<ShiftAssignment>) => setForm((current) => ({ ...current, ...patch })); const coordinators = useMemo(() => employees.filter((e) => e.role === 'COORDENADOR OPERACIONAL' || e.role === 'COORDENADOR ADMINISTRATIVO' || e.role === 'LIDER DE OPERAÇÕES'), [employees]); return <Modal open={open} onClose={onClose} title={assignment ? 'Editar escala' : 'Nova escala'} subtitle="Preencha os dados da escala operacional." size="lg" footer={<><button onClick={onClose} className="px-4 py-2 text-sm text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-700">Cancelar</button><button onClick={() => onSave(form)} className="px-4 py-2 text-sm text-[#0b2538] bg-[#e3a62f] rounded-lg font-semibold hover:bg-[#f0b83e]">Salvar escala</button></>}><div className="grid sm:grid-cols-2 gap-4"><Input label="Data da escala" type="date" value={form.date || ''} onChange={(e) => update({ date: e.target.value })} /><Select label="Colaborador" value={form.employee_id || ''} onChange={(e) => { const employee = employees.find((item) => item.id === e.target.value); update({ employee_id: e.target.value, role: employee?.role, shift_group: employee?.shift_group, start_time: employee?.schedule_start, end_time: employee?.schedule_end, coordinator: employee?.coordinator || '' }); }} options={employees.map((employee) => ({ value: employee.id, label: `${employee.name} · ${employee.registration}` }))} /><Select label="Plantão Diurno" value={form.shift_group?.startsWith('D') ? form.shift_group : ''} onChange={(e) => update({ shift_group: e.target.value, shift_type: e.target.value ? 'Diurno' : form.shift_type })} options={SHIFT_GROUPS.filter((s) => s.startsWith('D')).map((s) => ({ value: s, label: s }))} placeholder="Selecionar diurno" /><Select label="Plantão Noturno" value={form.shift_group?.startsWith('N') ? form.shift_group : ''} onChange={(e) => update({ shift_group: e.target.value, shift_type: e.target.value ? 'Noturno' : form.shift_type })} options={SHIFT_GROUPS.filter((s) => s.startsWith('N')).map((s) => ({ value: s, label: s }))} placeholder="Selecionar noturno" /><Select label="Coordenador responsável" value={form.coordinator || ''} onChange={(e) => update({ coordinator: e.target.value })} options={coordinators.map((c) => ({ value: c.name, label: c.name }))} placeholder="Atribuir coordenador" /><Select label="Tipo de turno" value={form.shift_type || ''} onChange={(e) => update({ shift_type: e.target.value })} options={['Diurno','Noturno','Comercial','Folga','Férias','Afastado'].map((s) => ({ value: s, label: s }))} /><Input label="Horário inicial" type="time" value={form.start_time || ''} onChange={(e) => update({ start_time: e.target.value })} /><Input label="Horário final" type="time" value={form.end_time || ''} onChange={(e) => update({ end_time: e.target.value })} /><Input label="Equipe" value={form.team || ''} onChange={(e) => update({ team: e.target.value })} /><Select label="Status" value={form.status || ''} onChange={(e) => update({ status: e.target.value })} options={ASSIGNMENT_STATUSES.map((s) => ({ value: s, label: s }))} /><div className="sm:col-span-2"><Textarea label="Observação sobre a operação do dia" value={form.notes || ''} onChange={(e) => update({ notes: e.target.value })} placeholder="Adicione uma observação operacional..." /></div></div></Modal>; }

function SwapModal({ open, employees, onClose, onSaved }: { open: boolean; employees: Employee[]; onClose: () => void; onSaved: () => void }) { const [form, setForm] = useState({ requester_id: '', substitute_id: '', original_date: '2026-10-01', swap_date: '2026-10-02', original_shift: 'D1', new_shift: 'D1', reason: '' }); const [saving, setSaving] = useState(false); const update = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch })); const save = async () => { if (!form.requester_id || !form.substitute_id) return; setSaving(true); const { error } = await supabase.from('shift_swaps').insert({ ...form, status: 'Pendente', approver: '', conflict_flags: '' }); setSaving(false); if (!error) onSaved(); }; return <Modal open={open} onClose={onClose} title="Nova troca de plantão" subtitle="O sistema verificará conflitos antes de enviar." footer={<><button onClick={onClose} className="px-4 py-2 text-sm text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-700">Cancelar</button><button onClick={save} disabled={saving} className="px-4 py-2 text-sm text-[#0b2538] bg-[#e3a62f] rounded-lg font-semibold disabled:opacity-50">{saving ? 'Salvando...' : 'Solicitar troca'}</button></>}><div className="grid sm:grid-cols-2 gap-4"><Select label="Colaborador solicitante" value={form.requester_id} onChange={(e) => update({ requester_id: e.target.value })} options={employees.map((e) => ({ value: e.id, label: e.name }))} placeholder="Selecione o colaborador" /><Select label="Colaborador substituto" value={form.substitute_id} onChange={(e) => update({ substitute_id: e.target.value })} options={employees.map((e) => ({ value: e.id, label: e.name }))} placeholder="Selecione o substituto" /><Input label="Data original" type="date" value={form.original_date} onChange={(e) => update({ original_date: e.target.value })} /><Input label="Data da troca" type="date" value={form.swap_date} onChange={(e) => update({ swap_date: e.target.value })} /><Select label="Plantão original" value={form.original_shift} onChange={(e) => update({ original_shift: e.target.value })} options={SHIFT_GROUPS.map((s) => ({ value: s, label: s }))} /><Select label="Novo plantão" value={form.new_shift} onChange={(e) => update({ new_shift: e.target.value })} options={SHIFT_GROUPS.map((s) => ({ value: s, label: s }))} /><div className="sm:col-span-2"><Textarea label="Motivo da troca" value={form.reason} onChange={(e) => update({ reason: e.target.value })} placeholder="Descreva o motivo da solicitação..." /></div></div><div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-400 flex gap-2"><AlertTriangle size={15} className="shrink-0" />Conflitos de escala, folga, férias, afastamento ou jornada incompatível serão sinalizados para análise.</div></Modal>; }

function LeaveModal({ open, employees, onClose, onSaved }: { open: boolean; employees: Employee[]; onClose: () => void; onSaved: () => void }) { const [form, setForm] = useState({ employee_id: '', leave_type: 'Férias', start_date: '2026-10-01', end_date: '2026-10-30', notes: '', status: 'Pendente' }); const [saving, setSaving] = useState(false); const update = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch })); const save = async () => { if (!form.employee_id) return; setSaving(true); const { error } = await supabase.from('leave_records').insert(form); setSaving(false); if (!error) onSaved(); }; return <Modal open={open} onClose={onClose} title="Novo afastamento" subtitle="O período será refletido automaticamente na escala." footer={<><button onClick={onClose} className="px-4 py-2 text-sm text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-700">Cancelar</button><button onClick={save} disabled={saving} className="px-4 py-2 text-sm text-[#0b2538] bg-[#e3a62f] rounded-lg font-semibold disabled:opacity-50">{saving ? 'Salvando...' : 'Registrar afastamento'}</button></>}><div className="grid sm:grid-cols-2 gap-4"><Select label="Colaborador" value={form.employee_id} onChange={(e) => update({ employee_id: e.target.value })} options={employees.map((e) => ({ value: e.id, label: e.name }))} placeholder="Selecione o colaborador" /><Select label="Tipo" value={form.leave_type} onChange={(e) => update({ leave_type: e.target.value })} options={LEAVE_TYPES.map((t) => ({ value: t, label: t }))} /><Input label="Data inicial" type="date" value={form.start_date} onChange={(e) => update({ start_date: e.target.value })} /><Input label="Data final" type="date" value={form.end_date} onChange={(e) => update({ end_date: e.target.value })} /><Select label="Status" value={form.status} onChange={(e) => update({ status: e.target.value })} options={LEAVE_STATUSES.map((s) => ({ value: s, label: s }))} /><div className="sm:col-span-2"><Textarea label="Observação" value={form.notes} onChange={(e) => update({ notes: e.target.value })} placeholder="Informe detalhes do afastamento..." /></div></div></Modal>; }

function ScaleConfigModal({ open, scales, onClose, onSaved }: { open: boolean; scales: ShiftScale[]; onClose: () => void; onSaved: () => void }) { const [form, setForm] = useState({ name: '', type: '12x36', shift_group: 'D1', start_time: '06:00', end_time: '18:00', break_minutes: '120', work_days: '1', off_days: '1', start_date: '2026-01-01', end_date: '' }); const [saving, setSaving] = useState(false); const update = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch })); const save = async () => { setSaving(true); const { error } = await supabase.from('shift_scales').insert({ ...form, break_minutes: Number(form.break_minutes), work_days: Number(form.work_days), off_days: Number(form.off_days), end_date: form.end_date || null }); setSaving(false); if (!error) onSaved(); }; return <Modal open={open} onClose={onClose} title="Configuração da escala" subtitle="Defina padrões operacionais sem alterar o sistema." size="lg" footer={<><button onClick={onClose} className="px-4 py-2 text-sm text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-700">Fechar</button><button onClick={save} disabled={saving} className="px-4 py-2 text-sm text-[#0b2538] bg-[#e3a62f] rounded-lg font-semibold">{saving ? 'Salvando...' : 'Salvar configuração'}</button></>}><div className="mb-5"><h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Escalas cadastradas</h4><div className="grid sm:grid-cols-2 gap-2">{scales.map((scale) => <div key={scale.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-700"><div><p className="text-sm font-medium text-slate-200">{scale.name}</p><p className="text-xs text-slate-400 mt-0.5">{scale.start_time} — {scale.end_time} · {scale.type}</p></div><ShiftBadge shift={scale.shift_group} /></div>)}</div></div><div className="border-t border-slate-700 pt-5"><h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Nova configuração</h4><div className="grid sm:grid-cols-2 gap-4"><Input label="Nome da escala" value={form.name} onChange={(e) => update({ name: e.target.value })} placeholder="Ex.: Escala equipe especial" /><Select label="Tipo de escala" value={form.type} onChange={(e) => update({ type: e.target.value })} options={['12x36','5x2','Rotativo','Personalizado'].map((v) => ({ value: v, label: v }))} /><Select label="Plantão" value={form.shift_group} onChange={(e) => update({ shift_group: e.target.value })} options={SHIFT_GROUPS.map((s) => ({ value: s, label: s }))} /><Input label="Horário inicial" type="time" value={form.start_time} onChange={(e) => update({ start_time: e.target.value })} /><Input label="Horário final" type="time" value={form.end_time} onChange={(e) => update({ end_time: e.target.value })} /><Input label="Intervalo (minutos)" type="number" value={form.break_minutes} onChange={(e) => update({ break_minutes: e.target.value })} /><Input label="Dias trabalhados" type="number" value={form.work_days} onChange={(e) => update({ work_days: e.target.value })} /><Input label="Dias de folga" type="number" value={form.off_days} onChange={(e) => update({ off_days: e.target.value })} /><Input label="Data de início" type="date" value={form.start_date} onChange={(e) => update({ start_date: e.target.value })} /><Input label="Data de término (opcional)" type="date" value={form.end_date} onChange={(e) => update({ end_date: e.target.value })} /></div></div></Modal>; }

export default App;
