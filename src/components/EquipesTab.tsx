import { useMemo, useState } from 'react';
import { Search, Users, UserRound, CalendarDays, Clock3 } from 'lucide-react';
import { Employee, LeaveRecord, ShiftAssignment } from '@/types';
import { Badge, RoleBadge, ShiftBadge, StatusBadge } from '@/components/ui/Badge';
import { EmptyState, PageHeader, StatCard } from '@/components/ui/Layout';

interface EquipesTabProps {
  employees: Employee[];
  assignments: ShiftAssignment[];
  leaves: LeaveRecord[];
  filters: {
    period: string;
    shift: string;
    role: string;
    status: string;
    sector: string;
    search: string;
  };
  onSelect: (employee: Employee) => void;
}

const coordinatorOrder = ['ROMULO DIAS', 'FCO. AGILEU', 'MARCOS PETÓ', 'RENATO ARLES', 'COORDENADORES', 'ADAUTO JUNIOR'];

function coordinatorLabel(coordinator: string): string {
  const shiftLabels: Record<string, string> = {
    'ROMULO DIAS': 'D2',
    'FCO. AGILEU': 'D1',
    'MARCOS PETÓ': 'N2',
    'RENATO ARLES': 'N1',
    COORDENADORES: 'Rotativo / 5x1',
    'ADAUTO JUNIOR': 'Comercial',
  };
  return shiftLabels[coordinator] || 'Equipe operacional';
}

export function EquipesTab({ employees, assignments, leaves, filters, onSelect }: EquipesTabProps) {
  const availableCoordinators = useMemo(() => {
    const names = [...new Set(employees.map((employee) => employee.coordinator).filter((coordinator): coordinator is string => Boolean(coordinator)))];
    return [...coordinatorOrder.filter((coordinator) => names.includes(coordinator)), ...names.filter((coordinator) => !coordinatorOrder.includes(coordinator)).sort()];
  }, [employees]);
  const [selectedCoordinator, setSelectedCoordinator] = useState('');
  const [search, setSearch] = useState('');
  const activeCoordinator = selectedCoordinator || availableCoordinators[0] || '';

  const team = useMemo(() => employees.filter((employee) => {
    const matchesCoordinator = !activeCoordinator || employee.coordinator === activeCoordinator;
    const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR');
    const globalSearch = filters.search.trim().toLocaleLowerCase('pt-BR');
    const text = `${employee.name} ${employee.registration}`.toLocaleLowerCase('pt-BR');
    const statusMatches = !filters.status ||
      (filters.status.startsWith('employee:') && employee.status === filters.status.slice('employee:'.length)) ||
      (filters.status.startsWith('assignment:') && assignments.some((assignment) =>
        assignment.employee_id === employee.id &&
        assignment.date === filters.period &&
        assignment.status === filters.status.slice('assignment:'.length)));
    return matchesCoordinator &&
      (!normalizedSearch || text.includes(normalizedSearch)) &&
      (!globalSearch || text.includes(globalSearch)) &&
      (!filters.shift || employee.shift_group === filters.shift) &&
      (!filters.role || employee.role === filters.role) &&
      (!filters.sector || employee.sector === filters.sector) &&
      statusMatches;
  }), [activeCoordinator, assignments, employees, filters, search]);

  const activeCount = team.filter((employee) => employee.status === 'Ativo').length;
  const awayCount = team.filter((employee) => employee.status !== 'Ativo').length;
  const scheduledCount = team.filter((employee) => assignments.some((assignment) => assignment.employee_id === employee.id && assignment.date === filters.period && assignment.status === 'Escalado')).length;

  return <div>
    <PageHeader title="Equipes por coordenador" description="Acompanhe a composição e a situação operacional de cada equipe." />
    <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-sm p-4 mb-5">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <label htmlFor="coordinator-select" className="text-sm font-semibold text-slate-300">Selecione o coordenador</label>
        <select id="coordinator-select" value={activeCoordinator} onChange={(event) => setSelectedCoordinator(event.target.value)} className="w-full lg:max-w-sm border border-slate-600 rounded-lg px-3 py-2.5 text-sm bg-slate-800 text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30">
          {availableCoordinators.map((coordinator) => <option key={coordinator} value={coordinator}>{coordinator} · {coordinatorLabel(coordinator)}</option>)}
        </select>
        <div className="relative w-full lg:max-w-xs lg:ml-auto">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar por nome ou matrícula" className="w-full border border-slate-600 rounded-lg pl-9 pr-3 py-2.5 text-sm bg-slate-800 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30" />
        </div>
      </div>
    </div>

    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
      <StatCard label="Total na equipe" value={team.length} meta={activeCoordinator || 'Sem coordenador'} icon={<Users size={20} />} accent="blue" />
      <StatCard label="Ativos" value={activeCount} meta="em operação" icon={<UserRound size={20} />} accent="emerald" />
      <StatCard label="Afastados / ausentes" value={awayCount} meta="fora da operação" icon={<Clock3 size={20} />} accent="rose" />
      <StatCard label="Escalados em 01/10" value={scheduledCount} meta="na escala do dia" icon={<CalendarDays size={20} />} accent="amber" />
    </div>

    <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between gap-3">
        <div><p className="font-semibold text-sm text-slate-200">Membros da equipe</p><p className="text-xs text-slate-400 mt-0.5">Clique em uma pessoa para ver os detalhes.</p></div>
        <Badge className="bg-slate-700 text-slate-300 border-slate-600">{team.length} pessoas</Badge>
      </div>
      {team.length === 0 ? <EmptyState message="Nenhum colaborador encontrado para os filtros atuais" /> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-850 text-xs text-slate-400 uppercase tracking-wide"><tr><th className="text-left px-4 py-3">Colaborador</th><th className="text-left px-4 py-3">Função</th><th className="text-left px-4 py-3">Setor</th><th className="text-left px-4 py-3">Plantão</th><th className="text-left px-4 py-3">Líder direto</th><th className="text-left px-4 py-3">Status</th><th className="text-left px-4 py-3">Ocorrência atual</th></tr></thead><tbody className="divide-y divide-slate-700">{team.map((employee) => { const leave = leaves.find((item) => item.employee_id === employee.id && filters.period >= item.start_date && filters.period <= item.end_date); return <tr key={employee.id} onClick={() => onSelect(employee)} className="hover:bg-slate-750 cursor-pointer transition-colors"><td className="px-4 py-3"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-slate-700 text-amber-400 flex items-center justify-center text-xs font-bold">{employee.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div><div><p className="font-medium text-slate-200">{employee.name}</p><p className="text-[11px] text-slate-500">Mat. {employee.registration}</p></div></div></td><td className="px-4 py-3"><RoleBadge role={employee.role} /></td><td className="px-4 py-3 text-slate-400">{employee.sector}</td><td className="px-4 py-3"><ShiftBadge shift={employee.shift_group} /></td><td className="px-4 py-3 text-slate-400">{employee.leader || '—'}</td><td className="px-4 py-3"><StatusBadge status={employee.status} /></td><td className="px-4 py-3">{leave ? <Badge className="bg-sky-500/15 text-sky-400 border-sky-500/30">{leave.leave_type}</Badge> : <span className="text-xs text-slate-500">Nenhuma</span>}</td></tr>; })}</tbody></table></div>}
    </div>
  </div>;
}
