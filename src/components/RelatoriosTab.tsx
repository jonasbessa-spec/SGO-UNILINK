import { useMemo, useState } from 'react';
import { Download, FileText, Filter, FileSpreadsheet } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { EMPLOYEE_STATUSES, ROLES, SECTORS, SHIFT_GROUPS, type Employee } from '@/types';
import { formatDateShort } from '@/lib/dateUtils';
import { PageHeader, EmptyState, StatCard } from '@/components/ui/Layout';
import { Select, SearchInput } from '@/components/ui/Form';
import { ShiftBadge, StatusBadge, RoleBadge } from '@/components/ui/Badge';

interface RelatoriosTabProps {
  employees: Employee[];
}

type ShiftFilter = string;
type StatusFilter = string;
type SectorFilter = string;

export function RelatoriosTab({ employees }: RelatoriosTabProps) {
  const [shiftFilter, setShiftFilter] = useState<ShiftFilter>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [sectorFilter, setSectorFilter] = useState<SectorFilter>('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);

  const filtered = useMemo(() => {
    return employees.filter((emp) => {
      if (shiftFilter && emp.shift_group !== shiftFilter) return false;
      if (statusFilter && emp.status !== statusFilter) return false;
      if (sectorFilter && emp.sector !== sectorFilter) return false;
      if (roleFilter && emp.role !== roleFilter) return false;
      if (search && !emp.name.toLowerCase().includes(search.toLowerCase()) && !emp.registration.includes(search)) return false;
      return true;
    });
  }, [employees, shiftFilter, statusFilter, sectorFilter, roleFilter, search]);

  const metrics = useMemo(() => {
    const total = filtered.length;
    const ativos = filtered.filter((e) => e.status === 'Ativo').length;
    const ferias = filtered.filter((e) => e.status === 'Férias').length;
    const afastados = filtered.filter((e) => e.status === 'Afastado').length;
    const byShift: Record<string, number> = {};
    for (const group of SHIFT_GROUPS) {
      byShift[group] = filtered.filter((e) => e.shift_group === group).length;
    }
    return { total, ativos, ferias, afastados, byShift };
  }, [filtered]);

  const exportCSV = () => {
    const headers = ['Matrícula', 'Nome', 'Função', 'Setor', 'Plantão', 'Status', 'Admissão', 'Horário Início', 'Horário Fim', 'Coordenador', 'Líder', 'Gestor'];
    const rows = filtered.map((e) => [
      e.registration,
      e.name,
      e.role,
      e.sector,
      e.shift_group,
      e.status,
      e.hire_date || '',
      e.schedule_start,
      e.schedule_end,
      e.coordinator || '',
      e.leader || '',
      e.manager || '',
    ]);
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio_operacional_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    setExporting(true);
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setExporting(false);
      return;
    }
    const dateStr = new Date().toLocaleDateString('pt-BR');
    const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"><title>Relatório Operacional</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; padding: 32px; }
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0b2538; padding-bottom: 16px; margin-bottom: 24px; }
  .header h1 { font-size: 22px; color: #0b2538; }
  .header .meta { text-align: right; font-size: 12px; color: #64748b; }
  .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
  .metric-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; }
  .metric-card .label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
  .metric-card .value { font-size: 24px; font-weight: 700; color: #0f172a; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { background: #f1f5f9; color: #475569; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; padding: 8px 10px; text-align: left; border-bottom: 2px solid #e2e8f0; }
  td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; }
  tr:nth-child(even) { background: #f8fafc; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; }
  .footer { margin-top: 32px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
  @media print { body { padding: 0; } .no-print { display: none; } }
</style></head><body>
  <div class="header">
    <div>
      <h1>SHIFT MASTER — Relatório Operacional</h1>
      <p style="font-size:13px;color:#64748b;margin-top:4px;">Filtros: ${shiftFilter || 'Todos os plantões'} · ${statusFilter || 'Todos os status'} · ${sectorFilter || 'Todos os setores'}</p>
    </div>
    <div class="meta">
      <p>Gerado em: ${dateStr}</p>
      <p>Total de registros: ${filtered.length}</p>
    </div>
  </div>
  <div class="metrics">
    <div class="metric-card"><div class="label">Total</div><div class="value">${metrics.total}</div></div>
    <div class="metric-card"><div class="label">Ativos</div><div class="value">${metrics.ativos}</div></div>
    <div class="metric-card"><div class="label">Férias</div><div class="value">${metrics.ferias}</div></div>
    <div class="metric-card"><div class="label">Afastados</div><div class="value">${metrics.afastados}</div></div>
  </div>
  <table>
    <thead><tr><th>Matrícula</th><th>Nome</th><th>Função</th><th>Setor</th><th>Plantão</th><th>Status</th><th>Admissão</th><th>Horário</th><th>Coordenador</th></tr></thead>
    <tbody>
      ${filtered.map((e) => `<tr><td>${e.registration}</td><td>${e.name}</td><td>${e.role}</td><td>${e.sector}</td><td>${e.shift_group}</td><td>${e.status}</td><td>${e.hire_date ? formatDateShort(e.hire_date) : '—'}</td><td>${e.schedule_start}—${e.schedule_end}</td><td>${e.coordinator || '—'}</td></tr>`).join('')}
    </tbody>
  </table>
  <div class="footer">SHIFT MASTER · Sistema de Gestão Operacional · Documento gerado automaticamente em ${dateStr}</div>
</body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); setExporting(false); }, 500);
  };

  return (
    <div>
      <PageHeader
        title="Relatórios Operacionais"
        description="Filtre e exporte dados operacionais em PDF ou CSV."
        actions={
          <>
            <button onClick={exportCSV} className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm">
              <FileSpreadsheet size={16} /> Exportar CSV
            </button>
            <button onClick={exportPDF} disabled={exporting} className="flex items-center gap-2 px-3.5 py-2.5 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 transition-colors shadow-sm disabled:opacity-50">
              <FileText size={16} /> {exporting ? 'Gerando...' : 'Exportar PDF'}
            </button>
          </>
        }
      />

      <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-sm mb-5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={15} className="text-slate-400" />
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Filtros dinâmicos</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <Select
            value={shiftFilter}
            onChange={(e) => setShiftFilter(e.target.value)}
            options={SHIFT_GROUPS.map((s) => ({ value: s, label: s }))}
            placeholder="Todos os plantões"
          />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={EMPLOYEE_STATUSES.map((s) => ({ value: s, label: s }))}
            placeholder="Todos os status"
          />
          <Select
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
            options={SECTORS.map((s) => ({ value: s, label: s }))}
            placeholder="Todos os setores"
          />
          <Select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            options={ROLES.map((r) => ({ value: r, label: r }))}
            placeholder="Todas as funções"
          />
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar nome ou matrícula"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard label="Total filtrado" value={metrics.total} meta="colaboradores" accent="blue" />
        <StatCard label="Ativos" value={metrics.ativos} meta="em operação" accent="emerald" />
        <StatCard label="Em férias" value={metrics.ferias} meta="programadas" accent="amber" />
        <StatCard label="Afastados" value={metrics.afastados} meta="licença/atestado" accent="rose" />
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-5">
        {SHIFT_GROUPS.map((group) => (
          <div key={group} className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">{group}</p>
            <p className="text-xl font-bold text-slate-100 mt-1">{metrics.byShift[group] || 0}</p>
          </div>
        ))}
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm text-slate-200">Dados filtrados</p>
            <p className="text-xs text-slate-400">{filtered.length} registros</p>
          </div>
          <Download size={16} className="text-slate-400" />
        </div>
        {filtered.length === 0 ? (
          <EmptyState message="Nenhum registro encontrado com os filtros atuais" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-750 text-xs text-slate-400 uppercase tracking-wide border-b border-slate-700">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Matrícula</th>
                  <th className="text-left px-4 py-3 font-semibold">Nome</th>
                  <th className="text-left px-4 py-3 font-semibold">Função</th>
                  <th className="text-left px-4 py-3 font-semibold">Setor</th>
                  <th className="text-left px-4 py-3 font-semibold">Plantão</th>
                  <th className="text-left px-4 py-3 font-semibold">Status</th>
                  <th className="text-left px-4 py-3 font-semibold">Horário</th>
                  <th className="text-left px-4 py-3 font-semibold">Coordenador</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filtered.slice(0, 100).map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-750 transition-colors">
                    <td className="px-4 py-3 text-slate-300">{emp.registration}</td>
                    <td className="px-4 py-3 font-medium text-slate-100">{emp.name}</td>
                    <td className="px-4 py-3"><RoleBadge role={emp.role} /></td>
                    <td className="px-4 py-3 text-slate-300">{emp.sector}</td>
                    <td className="px-4 py-3"><ShiftBadge shift={emp.shift_group} /></td>
                    <td className="px-4 py-3"><StatusBadge status={emp.status} /></td>
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{emp.schedule_start} — {emp.schedule_end}</td>
                    <td className="px-4 py-3 text-slate-400">{emp.coordinator || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {filtered.length > 100 && (
          <div className="px-4 py-3 border-t border-slate-700 text-xs text-slate-400 text-center">
            Exibindo os primeiros 100 de {filtered.length} registros. Exporte para ver todos.
          </div>
        )}
      </div>
    </div>
  );
}
