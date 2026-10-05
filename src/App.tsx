import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './lib/supabase';
import { VacationTab } from './components/VacationTab';
import { 
  Users, CheckCircle2, Calendar, Clock, 
  Search, RefreshCw, Plus, SlidersHorizontal,
  Layers, UserCheck, CalendarDays, ArrowLeftRight, FileText, History, Settings,
  Menu, X, Lock, Trash2, Download, ShieldCheck
} from 'lucide-react';

export default function App() {
  const [colaboradores, setColaboradores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [abaAtiva, setAbaAtiva] = useState('Escala');
  const [sidebarAberta, setSidebarAberta] = useState(false);

  // --- Autenticação / Permissões ---
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [usuarioInput, setUsuarioInput] = useState('');
  const [senhaInput, setSenhaInput] = useState('');
  const [loginErro, setLoginErro] = useState('');

  // --- Modais ---
  const [modalAberta, setModalAberta] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novaFuncao, setNovaFuncao] = useState('');
  const [novoPlantao, setNovoPlantao] = useState('07:00 AS 19:00');

  // --- Filtros Globais ---
  const [busca, setBusca] = useState('');
  const [dataFiltro, setDataFiltro] = useState('2026-10-01');
  const [filtroPlantao, setFiltroPlantao] = useState('TODOS');
  const [filtroFuncao, setFiltroFuncao] = useState('TODAS');
  const [filtroSetor, setFiltroSetor] = useState('TODOS');
  const [filtroStatus, setFiltroStatus] = useState('TODOS');

  // Carregar Dados do Supabase
  const carregarDados = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('colaboradores').select('*');
    if (error) {
      console.error('Erro Supabase:', error);
    } else {
      setColaboradores(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    carregarDados();
  }, []);

  // Lógica de Sincronização Dinâmica ao Selecionar Menu
  const selecionarMenu = (label: string) => {
    setAbaAtiva(label);
    setSidebarAberta(false);

    if (label === 'Férias / Afastamentos') {
      setFiltroStatus('FÉRRIAS_AFASTADO');
    } else {
      setFiltroStatus('TODOS');
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (usuarioInput.trim() === 'Jonas Bessa' && senhaInput === '081324') {
      setIsAdmin(true);
      setShowLoginModal(false);
      setLoginErro('');
      setUsuarioInput('');
      setSenhaInput('');
    } else {
      setLoginErro('Usuário ou senha incorretos.');
    }
  };

  const handleLogout = () => {
    setIsAdmin(false);
  };

  const getValor = (item: any, chaves: string[]) => {
    for (const k of chaves) {
      if (item[k] !== undefined && item[k] !== null && item[k] !== '') {
        return String(item[k]).trim();
      }
    }
    return '';
  };

  const getStatus = (item: any) => {
    const statusCol = getValor(item, ['STATUS', 'status']).toUpperCase();
    if (statusCol) return statusCol;
    const texto = JSON.stringify(item).toLowerCase();
    if (texto.includes('f rias') || texto.includes('ferias')) return 'FÉRRIAS';
    if (texto.includes('afastad') || texto.includes('inss') || texto.includes('atestado') || texto.includes('licen a') || texto.includes('licenca')) {
      return 'AFASTADO';
    }
    return 'ATIVO';
  };

  const handleDeletarColaborador = async (id: any) => {
    if (!isAdmin) return alert('Acesso negado. Ative o modo edição.');
    if (!confirm('Deseja realmente remover este colaborador?')) return;
    
    const { error } = await supabase.from('colaboradores').delete().eq('id', id);
    if (error) {
      alert('Erro ao remover: ' + error.message);
    } else {
      carregarDados();
    }
  };

  const handleExportar = () => {
    const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(colaboradoresFiltrados, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", jsonStr);
    downloadAnchor.setAttribute("download", `escala_${abaAtiva.toLowerCase().replace(/\s+/g, '_')}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const plantoesUnicos = useMemo(() => 
    Array.from(new Set(colaboradores.map(c => getValor(c, ['PLANT O', 'PLANTAO', 'plantao'])).filter(Boolean))), 
    [colaboradores]
  );
  const funcoesUnicas = useMemo(() => 
    Array.from(new Set(colaboradores.map(c => getValor(c, ['FUNCAO', 'FUN O', 'funcao'])).filter(Boolean))), 
    [colaboradores]
  );
  const setoresUnicos = useMemo(() => 
    Array.from(new Set(colaboradores.map(c => getValor(c, ['AREA', ' REA', 'area', 'SETOR'])).filter(Boolean))), 
    [colaboradores]
  );

  // Filtragem Inteligente
  const colaboradoresFiltrados = useMemo(() => {
    return colaboradores.filter(item => {
      const nome = getValor(item, ['NOME DO COLABORADOR', 'NOME', 'nome']).toLowerCase();
      const funcao = getValor(item, ['FUNCAO', 'FUN O', 'funcao']);
      const plantao = getValor(item, ['PLANT O', 'PLANTAO', 'plantao']);
      const setor = getValor(item, ['AREA', ' REA', 'area', 'SETOR']);
      const status = getStatus(item);

      const bateBusca = nome.includes(busca.toLowerCase());
      const batePlantao = filtroPlantao === 'TODOS' || plantao === filtroPlantao;
      const bateFuncao = filtroFuncao === 'TODAS' || funcao === filtroFuncao;
      const bateSetor = filtroSetor === 'TODOS' || setor === filtroSetor;
      
      let bateStatus = true;
      if (filtroStatus === 'FÉRRIAS_AFASTADO') {
        bateStatus = status.includes('FÉR') || status.includes('FER') || status.includes('AFAST');
      } else if (filtroStatus !== 'TODOS') {
        bateStatus = status === filtroStatus;
      }

      return bateBusca && batePlantao && bateFuncao && bateSetor && bateStatus;
    });
  }, [colaboradores, busca, filtroPlantao, filtroFuncao, filtroSetor, filtroStatus]);

  const limparFiltros = () => {
    setBusca('');
    setFiltroPlantao('TODOS');
    setFiltroFuncao('TODAS');
    setFiltroSetor('TODOS');
    setFiltroStatus('TODOS');
  };

  const metricas = useMemo(() => {
    let ativos = 0;
    let ferias = 0;
    let afastados = 0;
    colaboradores.forEach(c => {
      const st = getStatus(c);
      if (st === 'ATIVO') ativos++;
      else if (st.includes('FÉR') || st.includes('FER')) ferias++;
      else if (st.includes('AFAST')) afastados++;
    });
    return { 
      total: colaboradores.length, 
      ativos, 
      ferias, 
      afastados 
    };
  }, [colaboradores]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0b0f19', color: '#f1f5f9', fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      {/* Botão Hambúrguer para Mobile */}
      <button 
        onClick={() => setSidebarAberta(!sidebarAberta)}
        style={{
          position: 'fixed',
          top: '16px',
          left: '16px',
          zIndex: 50,
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
          color: '#f1f5f9',
          padding: '10px',
          borderRadius: '8px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        {sidebarAberta ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Backdrop Mobile */}
      {sidebarAberta && (
        <div 
          onClick={() => setSidebarAberta(false)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 30 }}
        />
      )}

      {/* Painel Lateral Responsivo */}
      <aside style={{ 
        width: '260px', 
        backgroundColor: '#0f172a', 
        borderRight: '1px solid #1e293b', 
        padding: '20px 16px', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '20px',
        position: 'fixed',
        top: 0,
        bottom: 0,
        left: sidebarAberta ? 0 : '-280px',
        zIndex: 40,
        transition: 'left 0.3s ease'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '16px', borderBottom: '1px solid #1e293b', marginTop: '40px' }}>
          <div style={{ backgroundColor: '#2563eb', color: '#ffffff', fontWeight: '900', borderRadius: '8px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>S</div>
          <div>
            <h2 style={{ fontSize: '16px', margin: 0, fontWeight: '800' }}>S G O</h2>
            <p style={{ margin: 0, fontSize: '10px', color: '#64748b', fontWeight: '700' }}>UNILINK · OPERAÇÕES</p>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          <span style={{ fontSize: '11px', fontWeight: '800', color: '#3b82f6', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>MÓDULO OPERACIONAL</span>
          <h3 style={{ fontSize: '16px', margin: '0 0 2px 0', fontWeight: '800' }}>SHIFT MASTER</h3>
          <p style={{ margin: '0 0 16px 0', fontSize: '11px', color: '#64748b' }}>Gestão integrada de escalas</p>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {[
              { label: 'Escala', icon: Layers },
              { label: 'Escala 2x2', icon: CalendarDays },
              { label: 'Equipes por coordenador', icon: UserCheck },
              { label: 'Colaboradores', icon: Users },
              { label: 'Calendário', icon: Calendar },
              { label: 'Trocas de plantão', icon: ArrowLeftRight },
              { label: 'Férias / Afastamentos', icon: Clock },
              { label: 'Cobertura operacional', icon: CheckCircle2 },
              { label: 'Relatórios Operacionais', icon: FileText },
              { label: 'Histórico', icon: History }
            ].map((item) => {
              const Icon = item.icon;
              const isSelected = abaAtiva === item.label;
              return (
                <button
                  key={item.label}
                  onClick={() => selecionarMenu(item.label)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: '600',
                    textAlign: 'left',
                    cursor: 'pointer',
                    backgroundColor: isSelected ? '#2563eb' : 'transparent',
                    color: isSelected ? '#ffffff' : '#94a3b8',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Icon size={16} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div style={{ paddingTop: '16px', borderTop: '1px solid #1e293b' }}>
          <button style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'none', border: 'none', color: '#94a3b8', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
            <Settings size={16} /> Configuração da escala
          </button>
        </div>
      </aside>

      {/* Conteúdo Central Responsivo */}
      <main style={{ flex: 1, padding: '24px 16px 24px 16px', marginLeft: '0px', display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto', width: '100%' }}>
        
        {/* Cabeçalho */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginTop: '40px' }}>
          <div>
            <span style={{ fontSize: '12px', color: '#64748b' }}>Visão operacional · {abaAtiva}</span>
            <h1 style={{ fontSize: '26px', margin: '2px 0 4px 0', fontWeight: '900' }}>{abaAtiva.toUpperCase()}</h1>
            <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>Central de gestão e controle de disponibilidade.</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {isAdmin ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(34, 197, 94, 0.1)', border: '1px solid #22c55e', padding: '6px 12px', borderRadius: '8px', color: '#4ade80', fontSize: '12px', fontWeight: '700' }}>
                <ShieldCheck size={14} /> Admin: Jonas Bessa
                <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#ef4444', marginLeft: '8px', cursor: 'pointer', fontSize: '11px', textDecoration: 'underline' }}>Sair</button>
              </div>
            ) : (
              <button 
                onClick={() => setShowLoginModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
              >
                <Lock size={14} /> Modo Edição
              </button>
            )}

            <button onClick={carregarDados} title="Atualizar dados" style={{ backgroundColor: '#1e293b', border: '1px solid #334155', padding: '10px', borderRadius: '8px', color: '#f1f5f9', cursor: 'pointer' }}>
              <RefreshCw size={16} className={loading ? 'spin' : ''} />
            </button>
            
            <button onClick={handleExportar} title="Exportar visão atual" style={{ backgroundColor: '#1e293b', border: '1px solid #334155', padding: '10px', borderRadius: '8px', color: '#f1f5f9', cursor: 'pointer' }}>
              <Download size={16} />
            </button>
          </div>
        </header>

        {/* Modal de Autenticação */}
        {showLoginModal && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px', width: '320px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>Acesso Restrito</h3>
              {loginErro && <p style={{ margin: 0, color: '#ef4444', fontSize: '12px' }}>{loginErro}</p>}
              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input 
                  type="text" 
                  placeholder="Usuário" 
                  value={usuarioInput}
                  onChange={e => setUsuarioInput(e.target.value)}
                  style={{ backgroundColor: '#0b0f19', border: '1px solid #334155', color: '#fff', padding: '10px', borderRadius: '6px', fontSize: '13px' }}
                />
                <input 
                  type="password" 
                  placeholder="Senha" 
                  value={senhaInput}
                  onChange={e => setSenhaInput(e.target.value)}
                  style={{ backgroundColor: '#0b0f19', border: '1px solid #334155', color: '#fff', padding: '10px', borderRadius: '6px', fontSize: '13px' }}
                />
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
                  <button type="button" onClick={() => setShowLoginModal(false)} style={{ backgroundColor: '#1e293b', border: 'none', color: '#94a3b8', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer' }}>Cancelar</button>
                  <button type="submit" style={{ backgroundColor: '#2563eb', border: 'none', color: '#fff', fontWeight: '700', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer' }}>Entrar</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Renderização Condicional: Aba de Férias/Cobertura vs Escala Normal */}
        {abaAtiva === 'Férias / Afastamentos' || abaAtiva === 'Cobertura operacional' ? (
          <VacationTab isAdmin={isAdmin} />
        ) : (
          <>
            {/* Cards Métricas Interativos */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
              <div 
                onClick={() => setFiltroStatus('TODOS')} 
                style={{ backgroundColor: '#0f172a', padding: '20px', borderRadius: '12px', border: filtroStatus === 'TODOS' ? '1px solid #2563eb' : '1px solid #1e293b', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '11px', fontWeight: '800' }}>
                  EFETIVO TOTAL <Users size={18} color="#3b82f6" />
                </div>
                <h2 style={{ fontSize: '32px', margin: '8px 0 2px 0', fontWeight: '900' }}>{metricas.total}</h2>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Clique para exibir todos</span>
              </div>

              <div 
                onClick={() => setFiltroStatus('ATIVO')} 
                style={{ backgroundColor: '#0f172a', padding: '20px', borderRadius: '12px', border: filtroStatus === 'ATIVO' ? '1px solid #22c55e' : '1px solid #1e293b', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '11px', fontWeight: '800' }}>
                  ATIVOS <CheckCircle2 size={18} color="#22c55e" />
                </div>
                <h2 style={{ fontSize: '32px', margin: '8px 0 2px 0', fontWeight: '900', color: '#22c55e' }}>{metricas.ativos}</h2>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Filtrar apenas ativos</span>
              </div>

              <div 
                onClick={() => setFiltroStatus('FÉRRIAS')} 
                style={{ backgroundColor: '#0f172a', padding: '20px', borderRadius: '12px', border: filtroStatus === 'FÉRRIAS' ? '1px solid #3b82f6' : '1px solid #1e293b', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '11px', fontWeight: '800' }}>
                  EM FÉRIAS <Calendar size={18} color="#3b82f6" />
                </div>
                <h2 style={{ fontSize: '32px', margin: '8px 0 2px 0', fontWeight: '900', color: '#60a5fa' }}>{metricas.ferias}</h2>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Filtrar em férias</span>
              </div>

              <div 
                onClick={() => setFiltroStatus('AFASTADO')} 
                style={{ backgroundColor: '#0f172a', padding: '20px', borderRadius: '12px', border: filtroStatus === 'AFASTADO' ? '1px solid #ef4444' : '1px solid #1e293b', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '11px', fontWeight: '800' }}>
                  AFASTADOS <Clock size={18} color="#ef4444" />
                </div>
                <h2 style={{ fontSize: '32px', margin: '8px 0 2px 0', fontWeight: '900', color: '#ef4444' }}>{metricas.afastados}</h2>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Filtrar afastados</span>
              </div>
            </div>

            {/* Filtros Globais */}
            <div style={{ backgroundColor: '#0f172a', padding: '16px 20px', borderRadius: '12px', border: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <SlidersHorizontal size={14} /> FILTROS GLOBAIS
                </span>
                <button onClick={limparFiltros} style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                  Limpar filtros
                </button>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
                <input 
                  type="date" 
                  value={dataFiltro} 
                  onChange={e => setDataFiltro(e.target.value)} 
                  style={{ backgroundColor: '#0b0f19', border: '1px solid #334155', color: '#f1f5f9', padding: '8px 12px', borderRadius: '6px', fontSize: '12px' }} 
                />
                <select value={filtroPlantao} onChange={e => setFiltroPlantao(e.target.value)} style={{ backgroundColor: '#0b0f19', border: '1px solid #334155', color: '#f1f5f9', padding: '8px 12px', borderRadius: '6px', fontSize: '12px' }}>
                  <option value="TODOS">Todos os plantões</option>
                  {plantoesUnicos.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <select value={filtroFuncao} onChange={e => setFiltroFuncao(e.target.value)} style={{ backgroundColor: '#0b0f19', border: '1px solid #334155', color: '#f1f5f9', padding: '8px 12px', borderRadius: '6px', fontSize: '12px' }}>
                  <option value="TODAS">Todas as funções</option>
                  {funcoesUnicas.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <select value={filtroSetor} onChange={e => setFiltroSetor(e.target.value)} style={{ backgroundColor: '#0b0f19', border: '1px solid #334155', color: '#f1f5f9', padding: '8px 12px', borderRadius: '6px', fontSize: '12px' }}>
                  <option value="TODOS">Todos os setores</option>
                  {setoresUnicos.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={{ backgroundColor: '#0b0f19', border: '1px solid #334155', color: '#f1f5f9', padding: '8px 12px', borderRadius: '6px', fontSize: '12px' }}>
                  <option value="TODOS">Todos os status</option>
                  <option value="ATIVO">Ativos</option>
                  <option value="FÉRRIAS">Férias</option>
                  <option value="AFASTADO">Afastados</option>
                </select>
                <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#0b0f19', border: '1px solid #334155', borderRadius: '6px', padding: '0 10px' }}>
                  <Search size={14} color="#64748b" />
                  <input 
                    type="text" 
                    placeholder="Pesquisar por nome..." 
                    value={busca} 
                    onChange={e => setBusca(e.target.value)} 
                    style={{ backgroundColor: 'transparent', border: 'none', color: '#f1f5f9', padding: '8px', fontSize: '12px', outline: 'none', width: '100%' }} 
                  />
                </div>
              </div>
            </div>

            {/* Tabela de Colaboradores / Escalas */}
            <div style={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', minWidth: '600px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1e293b', color: '#64748b', fontSize: '11px', fontWeight: '800' }}>
                    <th style={{ padding: '14px 18px' }}>COLABORADOR</th>
                    <th style={{ padding: '14px 18px' }}>FUNÇÃO</th>
                    <th style={{ padding: '14px 18px' }}>SETOR / ÁREA</th>
                    <th style={{ padding: '14px 18px' }}>PLANTÃO</th>
                    <th style={{ padding: '14px 18px' }}>STATUS OPERACIONAL</th>
                    {isAdmin && <th style={{ padding: '14px 18px', textAlign: 'right' }}>AÇÕES</th>}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={isAdmin ? 6 : 5} style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>Carregando dados...</td>
                    </tr>
                  ) : colaboradoresFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 6 : 5} style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>Nenhum registro encontrado.</td>
                    </tr>
                  ) : (
                    colaboradoresFiltrados.map((item, idx) => {
                      const status = getStatus(item);
                      const nome = getValor(item, ['NOME DO COLABORADOR', 'NOME', 'nome']) || 'N/A';
                      const funcao = getValor(item, ['FUNCAO', 'FUN O', 'funcao']) || 'N/A';
                      const setor = getValor(item, ['AREA', ' REA', 'area', 'SETOR']) || 'N/A';
                      const plantao = getValor(item, ['PLANT O', 'PLANTAO', 'plantao']) || 'N/A';

                      let badgeBg = 'rgba(34, 197, 94, 0.1)';
                      let badgeFg = '#22c55e';
                      if (status.includes('FÉR') || status.includes('FER')) {
                        badgeBg = 'rgba(59, 130, 246, 0.15)';
                        badgeFg = '#60a5fa';
                      } else if (status.includes('AFAST')) {
                        badgeBg = 'rgba(239, 68, 68, 0.1)';
                        badgeFg = '#ef4444';
                      }

                      return (
                        <tr key={item.id || idx} style={{ borderBottom: '1px solid #1e293b' }}>
                          <td style={{ padding: '14px 18px', fontWeight: '600' }}>{nome}</td>
                          <td style={{ padding: '14px 18px', color: '#94a3b8' }}>{funcao}</td>
                          <td style={{ padding: '14px 18px', color: '#94a3b8' }}>{setor}</td>
                          <td style={{ padding: '14px 18px', color: '#94a3b8' }}>{plantao}</td>
                          <td style={{ padding: '14px 18px' }}>
                            <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', backgroundColor: badgeBg, color: badgeFg }}>
                              {status}
                            </span>
                          </td>
                          {isAdmin && (
                            <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                              <button onClick={() => handleDeletarColaborador(item.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }} title="Excluir Registro">
                                <Trash2 size={16} />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}