import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Save } from 'lucide-react';

export function VacationTab({ isAdmin }: { isAdmin: boolean }) {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [coverageBases, setCoverageBases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadVacationData = async () => {
    setLoading(true);
    // Busca programações com os dados dos colaboradores legados
    const { data: schedData, error: schedErr } = await supabase
      .from('vacation_schedules')
      .select('*, colaboradores:employee_id(NOME, FUNCAO, PLANTAO, STATUS)');

    // Busca bases de mínimos operacionais
    const { data: baseData, error: baseErr } = await supabase
      .from('vacation_coverage_bases')
      .select('*');

    if (!schedErr) setSchedules(schedData || []);
    if (!baseErr) setCoverageBases(baseData || []);
    setLoading(false);
  };

  useEffect(() => {
    loadVacationData();
  }, []);

  const handleUpdateSchedule = async (id: string, newStart: string, newEnd: string, obs: string) => {
    if (!isAdmin) return alert('Acesso restrito ao perfil Administrador/DP.');
    const { error } = await supabase
      .from('vacation_schedules')
      .update({
        data_inicio_programada: newStart || null,
        data_fim_programada: newEnd || null,
        observacao_dp: obs,
        ajuste_manual_flag: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      alert('Erro ao atualizar programação: ' + error.message);
    } else {
      alert('Programação atualizada com sucesso!');
      loadVacationData();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0 }}>Programação e Cobertura de Férias</h2>
          <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0 0' }}>
            Controle de datas limite (21 meses) e garantia de cobertura por turno.
          </p>
        </div>
      </header>

      {/* Tabela de Programação de Férias */}
      <div style={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1e293b', color: '#64748b', fontSize: '11px', fontWeight: '800' }}>
              <th style={{ padding: '14px 18px' }}>COLABORADOR</th>
              <th style={{ padding: '14px 18px' }}>FUNÇÃO / PLANTÃO</th>
              <th style={{ padding: '14px 18px' }}>PERÍODO AQUISITIVO</th>
              <th style={{ padding: '14px 18px' }}>DT. LIMITE MÁXIMA</th>
              <th style={{ padding: '14px 18px' }}>INÍCIO PROGRAMADO</th>
              <th style={{ padding: '14px 18px' }}>FIM PROGRAMADO</th>
              <th style={{ padding: '14px 18px' }}>STATUS / AJUSTE</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>Carregando dados de férias...</td></tr>
            ) : schedules.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>Nenhuma programação cadastrada.</td></tr>
            ) : (
              schedules.map((item) => {
                const colab = item.colaboradores || {};
                const isOverdue = item.dt_limite_maxima && new Date().toISOString().split('T')[0] > item.dt_limite_maxima;
                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid #1e293b' }}>
                    <td style={{ padding: '14px 18px', fontWeight: '600' }}>{colab.NOME || 'N/A'}</td>
                    <td style={{ padding: '14px 18px', color: '#94a3b8' }}>{colab.FUNCAO} ({colab.PLANTAO})</td>
                    <td style={{ padding: '14px 18px', color: '#94a3b8' }}>
                      {item.periodo_aquisitivo_inicio} à {item.periodo_aquisitivo_fim}
                    </td>
                    <td style={{ padding: '14px 18px', color: isOverdue ? '#ef4444' : '#f59e0b', fontWeight: '700' }}>
                      {item.dt_limite_maxima} {isOverdue && '⚠️'}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <input 
                        type="date" 
                        defaultValue={item.data_inicio_programada || ''} 
                        disabled={!isAdmin}
                        id={`start-${item.id}`}
                        style={{ backgroundColor: '#0b0f19', border: '1px solid #334155', color: '#fff', padding: '6px', borderRadius: '4px', fontSize: '12px' }}
                      />
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <input 
                        type="date" 
                        defaultValue={item.data_fim_programada || ''} 
                        disabled={!isAdmin}
                        id={`end-${item.id}`}
                        style={{ backgroundColor: '#0b0f19', border: '1px solid #334155', color: '#fff', padding: '6px', borderRadius: '4px', fontSize: '12px' }}
                      />
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      {item.ajuste_manual_flag ? (
                        <span style={{ fontSize: '10px', backgroundColor: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', padding: '4px 8px', borderRadius: '4px', fontWeight: '700' }}>
                          Ajuste Manual DP
                        </span>
                      ) : (
                        <span style={{ fontSize: '10px', backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', padding: '4px 8px', borderRadius: '4px', fontWeight: '700' }}>
                          Automático
                        </span>
                      )}
                      {isAdmin && (
                        <button 
                          onClick={() => {
                            const startVal = (document.getElementById(`start-${item.id}`) as HTMLInputElement)?.value;
                            const endVal = (document.getElementById(`end-${item.id}`) as HTMLInputElement)?.value;
                            handleUpdateSchedule(item.id, startVal, endVal, 'Ajustado via painel');
                          }}
                          style={{ marginLeft: '8px', background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer' }}
                          title="Salvar Alteração"
                        >
                          <Save size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}