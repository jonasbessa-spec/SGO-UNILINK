import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CalendarDays, RefreshCw } from 'lucide-react';
import { VacationTab } from '@/components/VacationTab';
import { getEmployees, getVacations } from '@/services/employeesService';
import type { Employee } from '@/types';
import type { VacationSchedule } from '@/types/vocation';

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'erro inesperado';
}

export default function App() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [vacations, setVacations] = useState<VacationSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [employeeData, vacationData] = await Promise.all([
        getEmployees(),
        getVacations(),
      ]);
      setEmployees(employeeData);
      setVacations(vacationData);
    } catch (reason) {
      setError(`Não foi possível carregar colaboradores, férias e plantões: ${errorMessage(reason)}.`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-700 bg-[#0b2538] px-4 text-white shadow-lg lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e3a62f] text-lg font-black text-[#0b2538]">S</div>
          <div>
            <p className="text-sm font-bold tracking-[0.16em]">SGO UNILINK</p>
            <p className="text-[10px] text-slate-300">PLANEJAMENTO DE FÉRIAS E PLANTÕES</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { void loadData(); }}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10 disabled:opacity-50"
        >
          <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          Atualizar cadastros
        </button>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-300">
            <CalendarDays size={15} /> Gestão de prazos CLT e cobertura operacional
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-100">Férias e resumo de plantões</h1>
          <p className="mt-1 text-sm text-slate-400">Prioridade eSocial, alocação validada pelo mínimo operacional e ajustes interativos pelo DP.</p>
        </div>

        {error && (
          <div role="alert" className="mb-5 flex items-start gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
            <AlertTriangle size={17} className="mt-0.5 shrink-0" />
            <span>{error}</span>
            <button type="button" onClick={() => { void loadData(); }} className="ml-auto shrink-0 underline">Tentar novamente</button>
          </div>
        )}

        {isLoading ? (
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-12 text-center text-sm text-slate-400">Carregando dados...</div>
        ) : (
          <>
            {employees.length === 0 && (
              <div role="status" className="mb-5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
                Conexão com o Supabase estabelecida, mas a tabela colaboradores está sem registros cadastrados.
              </div>
            )}
            {vacations.length === 0 && (
              <div role="status" className="mb-5 rounded-lg border border-slate-700 bg-slate-800 p-3 text-sm text-slate-300">
                Nenhuma programação de férias cadastrada ainda. Os períodos aparecerão aqui após serem cadastrados.
              </div>
            )}
            <VacationTab employees={employees} vacations={vacations} onDataChanged={loadData} />
          </>
        )}
      </main>
    </div>
  );
}
