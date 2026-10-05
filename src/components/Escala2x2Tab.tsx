import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Filter, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { SHIFT_COLORS, type Employee, type Escala2x2 } from '@/types';
import { MONTHS_PT, getMonthDates, getWeekdayShort } from '@/lib/dateUtils';
import { PageHeader, EmptyState, TableSkeleton } from '@/components/ui/Layout';
import { Select, SearchInput } from '@/components/ui/Form';
import { ShiftBadge } from '@/components/ui/Badge';

const TWO_BY_TWO_GROUPS = ['D1', 'D2', 'N1', 'N2'] as const;

type GlobalFilters = Pick<Filters, 'shift' | 'role' | 'sector' | 'status' | 'search'>;

interface Filters {
  shift: string;
  role: string;
  sector: string;
  status: string;
  search: string;
}

export function Escala2x2Tab({ employees, filters }: { employees: Employee[]; filters: GlobalFilters }) {
  const [escalas, setEscalas] = useState<Escala2x2[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [search, setSearch] = useState('');
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const monthDates = useMemo(() => getMonthDates(year, month), [year, month]);
  const startDate = monthDates[0];
  const endDate = monthDates[monthDates.length - 1];

  const loadEscalas = useCallback(async () => {
    setIsLoading(true);
    let query = supabase
      .from('escalas_2x2')
      .select('*, employee:employees(*)')
      .gte('data', startDate)
      .lte('data', endDate);
    if (selectedEmployee) {
      query = query.eq('colaborador_id', selectedEmployee);
    } else if (selectedGroup) {
      query = query.eq('shift_group', selectedGroup);
    }
    const { data, error } = await query.order('data').order('shift_group');
    if (error) {
      console.error('Error loading escalas:', error);
    }
    setEscalas((data || []) as Escala2x2[]);
    setIsLoading(false);
  }, [startDate, endDate, selectedEmployee, selectedGroup]);

  useEffect(() => { loadEscalas(); }, [loadEscalas]);

  const moveMonth = (direction: number) => {
    const next = new Date(year, month + direction, 1);
    setMonth(next.getMonth());
    setYear(next.getFullYear());
  };

  const employeesById = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees]);
  const filteredEmployees = useMemo(() => employees.filter((employee) => {
    const globalSearch = filters.search.trim().toLocaleLowerCase('pt-BR');
    const localSearch = search.trim().toLocaleLowerCase('pt-BR');
    const identity = `${employee.name} ${employee.registration}`.toLocaleLowerCase('pt-BR');
    const statusMatches = !filters.status ||
      (filters.status.startsWith('employee:') && employee.status === filters.status.slice('employee:'.length)) ||
      (filters.status.startsWith('assignment:') && escalas.some((assignment) =>
        assignment.colaborador_id === employee.id &&
        ((filters.status === 'assignment:Escalado' && assignment.status_dia === 'Trabalho') ||
          (filters.status === 'assignment:Folga' && assignment.status_dia === 'Folga'))));
    return TWO_BY_TWO_GROUPS.includes(employee.shift_group as typeof TWO_BY_TWO_GROUPS[number]) &&
      (!selectedEmployee || employee.id === selectedEmployee) &&
      (!selectedGroup || employee.shift_group === selectedGroup) &&
      (!filters.shift || employee.shift_group === filters.shift) &&
      (!filters.role || employee.role === filters.role) &&
      (!filters.sector || employee.sector === filters.sector) &&
      statusMatches &&
      (!globalSearch || identity.includes(globalSearch)) &&
      (!localSearch || identity.includes(localSearch));
  }), [employees, escalas, filters, search, selectedEmployee, selectedGroup]);

  const visibleEscalas = useMemo(() => escalas.filter((assignment) => {
    const employee = assignment.employee || employeesById.get(assignment.colaborador_id);
    if (!employee) return false;
    const globalSearch = filters.search.trim().toLocaleLowerCase('pt-BR');
    const localSearch = search.trim().toLocaleLowerCase('pt-BR');
    const identity = `${employee.name} ${employee.registration}`.toLocaleLowerCase('pt-BR');
    const statusMatches = !filters.status ||
      (filters.status.startsWith('employee:') && employee.status === filters.status.slice('employee:'.length)) ||
      (filters.status === 'assignment:Escalado' && assignment.status_dia === 'Trabalho') ||
      (filters.status === 'assignment:Folga' && assignment.status_dia === 'Folga');
    return (!filters.shift || employee.shift_group === filters.shift) &&
      (!filters.role || employee.role === filters.role) &&
      (!filters.sector || employee.sector === filters.sector) &&
      statusMatches &&
      (!globalSearch || identity.includes(globalSearch)) &&
      (!localSearch || identity.includes(localSearch));
  }), [employeesById, escalas, filters, search]);

  const employeesInData = useMemo(() => {
    const map = new Map<string, Employee>();
    for (const esc of visibleEscalas) {
      const employee = esc.employee || employeesById.get(esc.colaborador_id);
      if (employee && !map.has(esc.colaborador_id)) {
        map.set(esc.colaborador_id, employee);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [employeesById, visibleEscalas]);

  const escalasByEmployee = useMemo(() => {
    const map = new Map<string, Map<string, Escala2x2>>();
    for (const esc of visibleEscalas) {
      if (!map.has(esc.colaborador_id)) map.set(esc.colaborador_id, new Map());
      map.get(esc.colaborador_id)!.set(esc.data, esc);
    }
    return map;
  }, [visibleEscalas]);

  const leading = new Date(year, month, 1).getDay();
  const cells: (string | null)[] = [...Array(leading).fill(null), ...monthDates];

  const workCount = visibleEscalas.filter((e) => e.status_dia === 'Trabalho').length;
  const offCount = visibleEscalas.filter((e) => e.status_dia === 'Folga').length;

  return (
    <div>
      <PageHeader
        title="Escala 2x2"
        description="Visualização do ciclo de 2 dias de trabalho e 2 dias de folga por colaborador."
      />

      <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-sm mb-5 p-3">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={15} className="text-slate-400" />
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Filtros</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Select
            value={selectedEmployee}
            onChange={(e) => { setSelectedEmployee(e.target.value); setSelectedGroup(''); }}
            options={filteredEmployees.map((e) => ({ value: e.id, label: `${e.name} · ${e.shift_group}` }))}
            placeholder="Todos os colaboradores"
          />
          <Select
            value={selectedGroup}
            onChange={(e) => { setSelectedGroup(e.target.value); setSelectedEmployee(''); }}
            options={TWO_BY_TWO_GROUPS.map((g) => ({ value: g, label: `Plantão ${g}` }))}
            placeholder="Todos os plantões"
          />
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar colaborador"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1"><Users size={14} className="text-slate-500" /><span className="text-xs text-slate-400">Colaboradores 2x2</span></div>
          <p className="text-xl font-bold text-slate-100">{filteredEmployees.length}</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-xs text-slate-400">Dias de trabalho</span></div>
          <p className="text-xl font-bold text-emerald-400">{workCount}</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1"><span className="w-2 h-2 rounded-full bg-slate-600" /><span className="text-xs text-slate-400">Dias de folga</span></div>
          <p className="text-xl font-bold text-slate-400">{offCount}</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1"><CalendarDays size={14} className="text-slate-500" /><span className="text-xs text-slate-400">Período</span></div>
          <p className="text-sm font-bold text-slate-200">{MONTHS_PT[month]}/{year}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-slate-800 border border-slate-700 rounded-xl"><TableSkeleton rows={6} columns={7} /></div>
      ) : employeesInData.length === 0 ? (
        <div className="bg-slate-800 border border-slate-700 rounded-xl"><EmptyState message="Nenhum colaborador encontrado com os filtros atuais" /></div>
      ) : (
        <>
          <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-sm overflow-hidden mb-5">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
              <button onClick={() => moveMonth(-1)} className="p-2 hover:bg-slate-700 rounded-lg text-slate-300"><ChevronLeft size={18} /></button>
              <h3 className="font-semibold text-slate-200">{MONTHS_PT[month]} {year}</h3>
              <button onClick={() => moveMonth(1)} className="p-2 hover:bg-slate-700 rounded-lg text-slate-300"><ChevronRight size={18} /></button>
            </div>
            <div className="grid grid-cols-7 border-b border-slate-700">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
                <div key={day} className="py-2 text-center text-[11px] font-semibold text-slate-500 uppercase">{day}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((date, index) => {
                if (!date) return <div key={`empty-${index}`} className="min-h-[64px] bg-slate-850 border-r border-b border-slate-700/50" />;
                const dayEscalas = visibleEscalas.filter((e) => e.data === date);
                const working = dayEscalas.filter((e) => e.status_dia === 'Trabalho');
                const groupsWorking = new Set(working.map((e) => e.shift_group));
                return (
                  <div key={date} className="min-h-[64px] p-1.5 border-r border-b border-slate-700/50">
                    <div className="text-xs font-medium text-slate-400 mb-1">{Number(date.slice(-2))}</div>
                    <div className="flex flex-wrap gap-1">
                      {TWO_BY_TWO_GROUPS.map((group) => {
                        const isWork = groupsWorking.has(group);
                        const colors = SHIFT_COLORS[group];
                        return (
                          <span
                            key={group}
                            className={`text-[9px] font-bold px-1 py-0.5 rounded ${isWork ? `${colors.bg} ${colors.text} ${colors.border} border` : 'bg-slate-850 text-slate-600 border border-slate-700'}`}
                            title={`${group}: ${isWork ? 'Trabalho' : 'Folga'}`}
                          >
                            {group}
                          </span>
                        );
                      })}
                    </div>
                    {working.length > 0 && <p className="text-[10px] text-slate-500 mt-1">{working.length} escalados</p>}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-700">
              <p className="text-xs text-slate-400 uppercase tracking-wide">Detalhamento por colaborador</p>
              <h3 className="font-semibold text-slate-200 mt-1">{MONTHS_PT[month]} {year}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-850 text-xs text-slate-400 uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold sticky left-0 bg-slate-850">Colaborador</th>
                    <th className="text-left px-4 py-3 font-semibold">Plantão</th>
                    {monthDates.map((date) => (
                      <th key={date} className="px-1 py-3 text-center font-medium text-[10px]">
                        {Number(date.slice(-2))}
                        <div className="text-[9px] font-normal text-slate-500">{getWeekdayShort(date)}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {employeesInData.slice(0, 50).map((emp) => {
                    const empEscalas = escalasByEmployee.get(emp.id);
                    return (
                      <tr key={emp.id} className="hover:bg-slate-750">
                        <td className="px-4 py-2.5 sticky left-0 bg-slate-800">
                          <p className="font-medium text-slate-200 text-xs">{emp.name}</p>
                          <p className="text-[10px] text-slate-500">{emp.role}</p>
                        </td>
                        <td className="px-4 py-2.5"><ShiftBadge shift={emp.shift_group} /></td>
                        {monthDates.map((date) => {
                          const esc = empEscalas?.get(date);
                          const isWork = esc?.status_dia === 'Trabalho';
                          const colors = SHIFT_COLORS[emp.shift_group];
                          return (
                            <td key={date} className="px-1 py-2.5 text-center">
                              <div
                                className={`w-5 h-5 mx-auto rounded ${isWork ? `${colors.dot}` : 'bg-slate-700'}`}
                                title={isWork ? 'Trabalho' : 'Folga'}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {employeesInData.length > 50 && (
              <div className="px-4 py-3 border-t border-slate-700 text-xs text-slate-400 text-center">
                Exibindo os primeiros 50 colaboradores. Use os filtros para refinar a visualização.
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center gap-4 text-xs text-slate-400 flex-wrap">
            {TWO_BY_TWO_GROUPS.map((group) => {
              const colors = SHIFT_COLORS[group];
              return (
                <div key={group} className="flex items-center gap-1.5">
                  <span className={`w-3 h-3 rounded ${colors.dot}`} />
                  <span>{group} — Trabalho</span>
                </div>
              );
            })}
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-slate-700" />
              <span>Folga</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
