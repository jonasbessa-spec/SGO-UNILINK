# Programação de férias — DP/Operações Pecém

## Preparação

1. Aplique as migrations em ordem, incluindo `supabase/migrations/20261002170000_align_vacation_schema_and_rbac.sql`. Ela cria `vacation_schedules` e `vacation_coverage_bases`, copia os dados das tabelas legadas sem apagá-las e restringe suas políticas.
2. Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` para o app web. `.env.example` mostra apenas nomes e valores ilustrativos; não substitua a chave pública por `service_role`.
3. Provisione no Supabase Auth a conta DP `jonas.bessa@unilinktransportes.com.br`. O módulo autentica usando a senha cadastrada no Auth (nunca embutida no frontend). A migration libera escrita nas tabelas de férias somente ao JWT desse endereço; usuários sem sessão ou com outra conta podem consultar.
4. Para importar pela linha de comando, configure `SUPABASE_URL` e `SUPABASE_KEY` no ambiente Node server-side e rode `node scripts/import-real-data.mjs caminho\para\exportacao.csv`. A chave nunca é impressa nem colocada no bundle do navegador.
5. Configure os mínimos por função e plantão/turno e mantenha a escala operacional diária atualizada antes de gerar um plano.

O schema operacional deste projeto armazena colaboradores em `employees` (não existe a tabela `colaboradores` nas migrations-base); por isso `vacation_schedules.employee_id` referencia `employees(id)`. Os demais módulos existentes mantêm suas próprias políticas de acesso, mas as duas tabelas de férias e suas cópias legadas aplicam leitura pública e escrita exclusiva pelo usuário DP autenticado.

## Exportação de DP e importação

O módulo recebe CSV, TSV ou texto delimitado por vírgula, ponto e vírgula ou tabulação, em UTF-8 ou Windows-1252. XLSX não é lido diretamente; exporte a planilha para CSV/TSV. Cabeçalhos são normalizados (espaços, caixa, acentos e variantes); valores importados são limpos e colocados em maiúsculas.

Obrigatórios: `matricula`, `nome`, `funcao`, `status`, `periodo_aquisitivo_inicio` e `periodo_aquisitivo_fim`, além de `plantao` ou `turno`. São aceitos aliases como `REGISTRATION`, `NOME DO COLABORADOR`, `CARGO`, `AREA`, `GRUPO`, `ADMISSAO` e `DATA_ADMISSAO`. Campos opcionais mapeados incluem `dt_limite_maxima`, `dias_gozo`, `data_inicio_programada`, `data_fim_programada`, `ferias_2026` e `ferias_2027`; também `horario_inicio`/`horario_fim` para novas matrículas quando não houver escala ativa cadastrada.

Matrícula é a chave de conciliação (`employees.registration`, já única). Nenhuma associação é feita pelo nome, nem se inventam matrículas. Matrícula/período duplicado ou registro incompleto é rejeitado antes da gravação. Colaboradores existentes conservam campos não fornecidos; novos exigem setor/área e horário explícito ou obtido de uma única escala ativa compatível. Períodos são idempotentes por colaborador + início/fim aquisitivos. Reimportação preserva datas e observações que já estejam marcadas como ajuste manual. Datas antigas de `ferias_2026/ferias_2027` são preservadas, mas não substituem uma data programada explicitamente. Como essas duas colunas registram somente o início, qualquer data sem fim em `leave_records` ou programação completa bloqueia novas alocações desse colaborador até DP registrar o intervalo; a duração não é inferida.

`dias_gozo` não tem valor padrão. Se houver início e fim programados na origem, a duração é calculada como quantidade de dias-calendário inclusiva; caso contrário, a duração deve ser informada na revisão antes da geração. Um `dt_limite_maxima` recebido que seja anterior ao limite calculado é respeitado como regra mais restritiva; um prazo importado posterior nunca amplia o limite seguro.

Os arquivos `DADOS_GERAIS_2X2*.txt` presentes no projeto não contêm matrícula nem período aquisitivo e não devem ser usados para vincular colaboradores ou calcular vencimentos. O importador atual não executa exclusões em massa, não gera matrículas sequenciais e não cria mínimos aleatórios.

## Interpretação dos prazos

`periodo_aquisitivo_fim` é a referência; `periodo_aquisitivo_inicio` identifica o período, mas não inicia a contagem do prazo. A adição de meses usa calendário: preserva o dia quando existe e, caso contrário, limita ao último dia do mês de destino (por exemplo, 31 de janeiro + 1 mês resulta no último dia de fevereiro).

O limite seguro é calculado a partir de `periodo_aquisitivo_inicio`: soma-se 21 meses-calendário, antecipando em 30 dias o teto de 22 meses informado pelo DP. Meses são somados no calendário; se o dia não existir no mês-alvo, usa-se o último dia desse mês (por exemplo, 31/jan + 1 mês = 28/29/fev). O resultado é `dt_limite_maxima`; um prazo anterior importado pelo DP é preservado como limite ainda mais restritivo, mas um prazo posterior nunca amplia o limite seguro. `periodo_aquisitivo_fim` define o primeiro dia em que o gozo pode começar (dia seguinte ao fim do período aquisitivo), não a origem do cálculo do limite.

O gozo termina, inclusive, até `dt_limite_maxima`. Sem agendamento salvo, a sugestão parte de 30 dias-calendário antes desse limite, de modo que um período padrão de 30 dias termine até a data limite. A janela de programação começa no dia seguinte ao fim aquisitivo ou na data local de hoje, o que for posterior. A data final do gozo é inclusiva e não pode ultrapassar `dt_limite_maxima`. Verifique a convenção legal/coletiva vigente com DP/Jurídico antes de usar como cálculo oficial.

O padrão de gozo é 30 dias. Como a tabela comporta um intervalo por período aquisitivo, a programação representada exige que esse intervalo tenha ao menos 14 dias (e no máximo 30); fracionamentos adicionais devem ser registrados/validados pelo DP fora deste registro.

## Algoritmo e cobertura

1. Ordena períodos por limite seguro crescente; desempata pelo fim aquisitivo e id do colaborador.
2. A sugestão automática ordena os períodos pelo prazo mais próximo e começa 30 dias antes do limite seguro. Se a cobertura impedir a alocação, tenta datas em blocos de 15 dias antes/depois do alvo, sempre respeitando a janela aquisitiva, a duração e o limite; os extremos válidos da janela também são testados. Entre as datas viáveis, prefere meses ainda sem início programado, menor sobreposição diária no mesmo grupo função × plantão e proximidade do alvo; ajustes manuais e sugestões já registradas continuam reservados.
3. Em cada dia usa a escala existente `shift_assignments` com status Escalado/Cobertura/Trabalho para formar o efetivo-base por função × plantão/turno. Subtrai uma única vez colaboradores em afastamentos pendentes/aprovados e férias já reservadas.
4. Aceita a sequência somente se cada dia mantiver pelo menos o mínimo configurado para a função e grupo. Sem mínimo explícito, colaborador ativo, período ou duração válidos, o registro fica pendente/bloqueado. Para mínimo maior que zero, também é exigida escala diária do grupo; mínimo zero só é aceito quando configurado explicitamente. A alteração de datas recalcula essa validação imediatamente e indica o conflito no campo e no status do período.
5. Ajustes manuais são validados com as mesmas regras de prazo, intervalo e cobertura; `ajuste_manual_flag` não é um bypass. `observacao_dp` registra a justificativa e o plano só persiste quando DP aciona Salvar.

O painel apresenta contadores de prazos vencidos/críticos, atenção nos próximos 31–60 dias, gargalos encontrados na escala diária, programações validadas e totalizadores separados de ajustes manuais e projeções automáticas. A lista pode ser filtrada por situação (crítico, regular ou projetado), plantão/turno, função e busca de nome/matrícula. Alterações de DP são recalculadas em memória, exibem conflitos antes de persistir e pedem confirmação de salvamento.

Não são presumidos quantitativos, jornadas ou ciclos para D1/D2/N1/N2, Rotativo, 5x1 ou Comercial. Se a escala diária não estiver carregada para a janela, o algoritmo não extrapola um padrão e mantém a programação pendente.

## Testes

`npm test` cobre o cálculo de meses-limite, parsing de CSV/TSV e bloqueios/alocações por cobertura. `npm run typecheck`, `npm run lint` e `npm run build` verificam a aplicação.
