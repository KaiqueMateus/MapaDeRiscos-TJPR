// ============================================================
//  MAPA / TJPR - Plano de Tratamento v3
//  Sistema de 4 status: Pendente / Planejado / Em Atraso / Concluido
// ============================================================

console.log("[Tratamento] Script v3 carregado - sistema 4 status");

const OPCOES_TRATAMENTO = ["Evitar", "Transferir", "Mitigar", "Aceitar"];

console.log("Modal existe?", !!document.getElementById("modalAnexos"));
console.log("Lista existe?", !!document.getElementById("listaAnexos"));
console.log("abrirModalAnexos?", typeof abrirModalAnexos);

// ============ MIGRAÇÃO E HELPERS DE ETAPAS ============
function migrarTratamentoSeNecessario(risco) {
  const trat = risco.tratamento;
  if (!trat) return;
  if (Array.isArray(trat.historico)) return; // já novo formato

  // Formato antigo: converte para histórico com 1 etapa
  if (trat.opcao || trat.descricao) {
    const etapaAntiga = {
      id: 1,
      opcao: trat.opcao || "",
      custoBeneficio: trat.custoBeneficio || "",
      responsavel: trat.responsavel || "",
      prazo: trat.prazo || "",
      descricao: trat.descricao || "",
      monitoramento: trat.monitoramento || "",
      concluido: !!trat.concluido,
      concluidoEm: trat.concluidoEm || null,
      concluidoPor: trat.concluidoPor || null,
      criadoEm: trat.atualizadoEm || new Date().toISOString(),
      criadoPor: trat.atualizadoPor || "Legado",
      reaberta: false
    };
    risco.tratamento = { historico: [etapaAntiga] };
  } else {
    risco.tratamento = { historico: [] };
  }
}

// Retorna a última etapa (a "atual") ou null
function obterEtapaAtual(risco) {
  if (!risco.tratamento || !Array.isArray(risco.tratamento.historico)) return null;
  const h = risco.tratamento.historico;
  return h.length > 0 ? h[h.length - 1] : null;
  
}

// Cria etapa nova vazia (pra quando reabrir)
function criarNovaEtapa() {
  return {
    id: Date.now(),
    opcao: "", custoBeneficio: "", responsavel: "",
    prazo: "", descricao: "", monitoramento: "",
    concluido: false, concluidoEm: null, concluidoPor: null,
    criadoEm: new Date().toISOString(),
    criadoPor: user.nome,
    reaberta: true
  };
}

// Formata data ISO -> dd/mm/aaaa hh:mm
function formatarDataHora(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR").substring(0,5);
}

function calcularStatusTratamento(risco) {
  migrarTratamentoSeNecessario(risco);
  const etapa = obterEtapaAtual(risco);

  if (!etapa || !etapa.opcao || !etapa.descricao) {
    return { label: "Pendente", classe: "badge-pendente", icon: "bi-hourglass-split", estado: "pendente" };
  }
  if (etapa.concluido) {
    return { label: "Concluído", classe: "badge-concluido", icon: "bi-check-circle-fill", estado: "concluido" };
  }
  if (etapa.prazo) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dp = new Date(etapa.prazo + "T00:00:00");
    if (dp < hoje) {
      const dias = Math.floor((hoje - dp) / 86400000);
      return { label: "Em Atraso", classe: "badge-atraso", icon: "bi-alarm-fill", estado: "atraso", diasAtraso: dias };
    }
  }
  return { label: "Planejado", classe: "badge-planejado", icon: "bi-clipboard-check", estado: "planejado" };
}

// ============ INICIALIZACAO ============
document.addEventListener("DOMContentLoaded", async function() {
  setTimeout(async function() {
    // Aguarda Supabase carregar
    let tentativas = 0;
    while (!window.sb && tentativas < 30) {
      await new Promise(r => setTimeout(r, 100));
      tentativas++;
    }
    console.log(atualizarKPIsTratamento.toString());
console.log(aplicarAlertaAtraso.toString());
console.log("=== ANÁLISE ===");
processos.forEach(p => {
  const todos = riscos.filter(r => String(r.processoId) === String(p.id));
  const comSim = riscos.filter(r =>
    String(r.processoId) === String(p.id) &&
    String(r.tratar || "").trim().toLowerCase() === "sim"
  );
  console.log("📁", p.processo, "(id:", p.id + ")");
  console.log("   Total riscos:", todos.length);
  console.log("   Com Tratar=Sim:", comSim.length);
  todos.forEach(r => console.log("   → Risco:", r.evento, "| tratar:", "'" + r.tratar + "'"));
});
    renderizarFiltroMultiDivisao(async function() {

await carregarProcessos();

await carregarRiscos();

popularDropdownTratamento();

atualizarKPIsTratamento();

});
    // Carrega dados do Supabase
    await carregarProcessos();
    await carregarRiscos();

    console.log("[Tratamento] Após carregar:", riscos.length, "riscos,", processos.length, "processos");

    popularDropdownTratamento();
    atualizarKPIsTratamento();

    // 🎯 Auto-seleciona processo com tratamento
    const ultimoId = localStorage.getItem(chaveUltimoProc());

    // Tenta pelo último salvo
    if (ultimoId && processoTemTratamento(ultimoId)) {
      const sel = document.getElementById("seletorProcesso");
      if (sel) sel.value = String(ultimoId);
      selecionarProcessoTratamento(ultimoId);
      return;
    }

    // Se não achou, pega o primeiro que tem tratamento
    const primeiroComTratamento = processos.find(p => processoTemTratamento(p.id));
    if (primeiroComTratamento) {
      const sel = document.getElementById("seletorProcesso");
      if (sel) sel.value = String(primeiroComTratamento.id);
      selecionarProcessoTratamento(primeiroComTratamento.id);
      console.log("[Tratamento] Auto-selecionou:", primeiroComTratamento.processo);
    } else {
      console.warn("[Tratamento] Nenhum processo tem risco com Tratar=Sim");
    }
  }, 200);
});
// ============ HELPERS DE FILTRO ============
function processoTemTratamento(procId) {
  return riscos.some(function(r) {
    return String(r.processoId) === String(procId) &&
           String(r.tratar).toLowerCase() === "sim";
  });
  
}

function riscosATratar(procId) {
  return riscos.filter(function(r) {
    return String(r.processoId) === String(procId) &&
           String(r.tratar).toLowerCase() === "sim";
  });
}

// ============ DROPDOWN ============
function popularDropdownTratamento() {
  const sel = document.getElementById("seletorProcesso");
  if (!sel) return;

  // 🎯 Aplica filtro de divisão do card
  const filtro = document.getElementById("filtroDivisaoTrat");
  const divisaoAtiva = filtro ? filtro.value : "";

  console.log("[popularDropdownTratamento] Filtro:", divisaoAtiva, "| Total:", processos.length);

  let procs = processos.slice();

  if (divisaoAtiva) {
    procs = procs.filter(function(p) {
      const div = String(p.divisao || p.unidade || "").toUpperCase();
      return div === divisaoAtiva.toUpperCase();
    });
  }

  console.log("[popularDropdownTratamento] Após filtro:", procs.length);

  procs.sort(function(a, b) {
    return String(a.processo || "").localeCompare(String(b.processo || ""));
  });

  if (procs.length === 0) {
    sel.innerHTML = '<option value="">-- Nenhum registro nesta divisão --</option>';
  } else {
    sel.innerHTML = '<option value="">-- Selecione um registro --</option>' +
      procs.map(function(p) {
        const sigla = p.divisao || p.unidade || "?";
        return '<option value="' + p.id + '">[' + sigla + '] ' + escapeHTML(p.processo || "?") + '</option>';
      }).join("");
  }

  if (processoAtualId) {
    const aindaVisivel = procs.find(function(p) { return String(p.id) === String(processoAtualId); });
    if (aindaVisivel) {
      sel.value = String(processoAtualId);
    }
  }
}

// ============ SELECIONAR PROCESSO ============
function selecionarProcessoTratamento(id) {
  const infoDiv = document.getElementById("registroInfo");
  const emptyRegistro = document.getElementById("emptyRegistro");
  const secTratamentos = document.getElementById("secTratamentos");
  const btnPDF = document.getElementById("btnPDF");

  if (!id || id === "") {
    processoAtualId = null;
    if (infoDiv) infoDiv.style.display = "none";
    if (secTratamentos) secTratamentos.style.display = "none";
    if (btnPDF) btnPDF.disabled = true;
    return;
  }

  const idNum = Number(id);
  processoAtualId = isNaN(idNum) ? id : idNum;
  localStorage.setItem(chaveUltimoProc(), String(processoAtualId));

  const p = processos.find(function(x) {
    return String(x.id) === String(processoAtualId);
  });

  if (!p) {
    showToast("Erro ao carregar registro.", "error");
    return;
  }

  if (infoDiv) infoDiv.style.display = "block";
  if (emptyRegistro) emptyRegistro.style.display = "none";
  if (btnPDF) btnPDF.disabled = false;

  setText("infoEquipe",    p.equipe    || "-");
  setText("infoProcesso",  p.processo  || "-");
  setText("infoObjetivo",  p.objetivo  || "-");
  setText("infoCompilado", p.compilado || "-");
  setText("infoAnalisado", p.analisado || "-");
  setText("infoData",      p.data ? formatarData(p.data) : "-");

  if (secTratamentos) secTratamentos.style.display = "block";
  renderizarTratamentos();
  atualizarKPIsTratamento();

  setTimeout(function() {
    if (secTratamentos) {
      secTratamentos.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, 150);
}

// ============ RENDERIZAR CARDS ============
// ============ HELPER: Calcula Risco Final da etapa ============
function calcularRiscoFinal(risco, etapa) {
  const nivel = risco.prob * risco.imp;
  const residual = nivel * (risco.nivelControle || 1);
  const monitor = etapa && etapa.nivelMonitoramento
    ? parseFloat(etapa.nivelMonitoramento)
    : 1;
  return residual * monitor;
}

// ============ HELPER: Cor baseada no valor de risco ============
function corDoRisco(valor) {
  if (valor >= 16) return { cor: "#e05a5a", classe: "risco-alto", label: "Alto" };
  if (valor >= 7)  return { cor: "#f5c94a", classe: "risco-medio", label: "Médio" };
  return { cor: "#3ad48a", classe: "risco-baixo", label: "Baixo" };
}

// ============ HELPER: Mini-matriz 5x5 no card ============
function gerarMiniMatriz(risco) {
  const nivel = risco.prob * risco.imp;
  let html = '<div class="mini-matriz" title="Posição na Matriz de Risco">';
  for (let i = 5; i >= 1; i--) {
    for (let p = 1; p <= 5; p++) {
      const val = p * i;
      let cor = "#3ad48a";
      if (val >= 20) cor = "#e05a5a";
      else if (val >= 7) cor = "#f5c94a";
      const ativo = (p === risco.prob && i === risco.imp) ? ' mini-cell-ativo' : '';
      html += '<div class="mini-cell' + ativo + '" style="background:' + cor + ';"></div>';
    }
  }
  html += '</div>';
  return html;
}

// ============ HELPER: Comparação com etapa anterior ============
function badgeComparacao(risco, etapaAtualIdx) {
  const historico = (risco.tratamento && risco.tratamento.historico) || [];
  if (etapaAtualIdx <= 0 || historico.length <= 1) return "";

  const atual = calcularRiscoFinal(risco, historico[etapaAtualIdx]);
  const anterior = calcularRiscoFinal(risco, historico[etapaAtualIdx - 1]);
  const diff = atual - anterior;

  if (Math.abs(diff) < 0.1) {
    return '<span class="badge-cmp badge-cmp-igual" title="Estável"><i class="bi bi-arrow-right"></i></span>';
  }
  if (diff < 0) {
    return '<span class="badge-cmp badge-cmp-baixou" title="Melhorou ' + Math.abs(diff).toFixed(1) + '"><i class="bi bi-arrow-down"></i> ' + Math.abs(diff).toFixed(1) + '</span>';
  }
  return '<span class="badge-cmp badge-cmp-subiu" title="Piorou ' + diff.toFixed(1) + '"><i class="bi bi-arrow-up"></i> ' + diff.toFixed(1) + '</span>';
}

// ============ HELPER: Sparkline da evolução ============
function gerarSparkline(risco) {
  const historico = (risco.tratamento && risco.tratamento.historico) || [];
  if (historico.length < 2) return "";

  const valores = historico.map(function(et) { return calcularRiscoFinal(risco, et); });
  const max = Math.max.apply(null, valores);
  const min = Math.min.apply(null, valores);
  const range = max - min || 1;
  const width = 200, height = 50;
  const stepX = width / (valores.length - 1);

  let path = "";
  let pontos = "";
  valores.forEach(function(v, i) {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - 10) - 5;
    path += (i === 0 ? "M" : "L") + x + "," + y + " ";
    const c = corDoRisco(v);
    pontos += '<circle cx="' + x + '" cy="' + y + '" r="3" fill="' + c.cor + '" stroke="#fff" stroke-width="1"/>';
  });

  return '<div class="sparkline-container">' +
    '<div class="sparkline-title">Evolução do Risco Final</div>' +
    '<svg viewBox="0 0 ' + width + ' ' + height + '" style="width:100%;height:50px;">' +
      '<path d="' + path + '" fill="none" stroke="#4dd0e1" stroke-width="2"/>' +
      pontos +
    '</svg>' +
  '</div>';
}

// ============ RENDERIZAR CARDS (VERSÃO INCREMENTADA) ============
function renderizarTratamentos() {
  const container = document.getElementById("tratamentosLista");
  const empty = document.getElementById("emptyTratamentos");
  if (!container) return;

  const filtrados = riscosATratar(processoAtualId);
  filtrados.forEach(migrarTratamentoSeNecessario);

  if (filtrados.length === 0) {
    container.innerHTML = "";
    if (empty) empty.style.display = "block";
    return;
  }
  if (empty) empty.style.display = "none";

  // 🎯 Ordenação: Risco Final decrescente > Prioritário > Nível
  const ordenados = filtrados.slice().sort(function(a, b) {
    const finalA = calcularRiscoFinal(a, obterEtapaAtual(a));
    const finalB = calcularRiscoFinal(b, obterEtapaAtual(b));
    if (Math.abs(finalA - finalB) > 0.1) return finalB - finalA;
    if (a.prioritario === "Sim" && b.prioritario !== "Sim") return -1;
    if (a.prioritario !== "Sim" && b.prioritario === "Sim") return 1;
    return (b.prob * b.imp) - (a.prob * a.imp);
  });

  container.innerHTML = ordenados.map(function(r) {
    const numero = obterNumeroRisco(r.id);
    const historico = (r.tratamento && r.tratamento.historico) || [];
    const etapa = obterEtapaAtual(r) || {};
    const isPrioritario = r.prioritario === "Sim";
    const status = calcularStatusTratamento(r);
    const numEtapa = historico.length;

    const nivelRisco = r.prob * r.imp;
    const residual = nivelRisco * (r.nivelControle || 1);
    const riscoFinal = calcularRiscoFinal(r, etapa);
    const corFinal = corDoRisco(riscoFinal);
    const corResid = corDoRisco(residual);

    let opcoesHtml = '<option value="">Selecione...</option>';
    OPCOES_TRATAMENTO.forEach(function(o) {
      opcoesHtml += '<option value="' + o + '"' + (etapa.opcao === o ? ' selected' : '') + '>' + o + '</option>';
    });
    const cbFav = etapa.custoBeneficio === "Favorável" ? ' checked' : '';
    const cbDesf = etapa.custoBeneficio === "Desfavorável" ? ' checked' : '';

    const nivMon = etapa.nivelMonitoramento || "";
    const monOpt = function(v, label) {
      return '<option value="' + v + '"' + (nivMon === v ? ' selected' : '') + '>' + label + '</option>';
    };

    // Classes do card + cor dinâmica
    let html = '<div class="tratamento-card';
    if (isPrioritario) html += ' prioritario';
    if (status.estado === "planejado") html += ' planejado';
    if (status.estado === "concluido") html += ' concluido';
    if (status.estado === "atraso") html += ' em-atraso';
    html += ' cor-' + corFinal.classe;
    html += '" data-risco-id="' + r.id + '" style="--cor-risco:' + corFinal.cor + ';">';

    // ============ HEADER COM MINI MATRIZ ============
    html += '<div class="tratamento-header" onclick="toggleCard(' + r.id + ')">';
    html += '<div class="tratamento-header-content">';
    html += '<div class="tratamento-title">';
    html += '<span class="risco-id">' + numero + '</span>';
    if (isPrioritario) html += '<span class="badge-prioritario">Prioritário</span>';
    html += '<span class="' + status.classe + '"><i class="bi ' + status.icon + '"></i> ' + status.label.toUpperCase() + '</span>';
    html += '<span class="badge-residual" title="Risco Residual (Nível × Controle)"><i class="bi bi-shield"></i> Residual: ' + residual.toFixed(1) + '</span>';
    html += '<span class="badge-risco-final" title="Risco Final (Residual × Monitoramento)" style="background:' + corFinal.cor + '20;color:' + corFinal.cor + ';border-color:' + corFinal.cor + '60;"><i class="bi bi-bullseye"></i> Final: ' + riscoFinal.toFixed(1) + '</span>';
    if (numEtapa > 1) html += '<span class="badge-etapa">Etapa ' + numEtapa + '</span>';
    if (status.estado === "atraso") html += '<span class="dias-atraso">' + status.diasAtraso + ' dia(s) atraso</span>';
    html += '</div>';
    html += '<div class="tratamento-evento">' + escapeHTML(r.evento) + '</div>';
    html += '</div>';
    html += gerarMiniMatriz(r);
    html += '<i class="bi bi-chevron-right tratamento-toggle-icon"></i>';
    html += '</div>';

    // ============ BODY 2 COLUNAS ============
    html += '<div class="tratamento-body tratamento-2col" onclick="event.stopPropagation()">';
    html += '<div class="col-form">';

    // Opção + Custo-Benefício
    html += '<div class="row g-3">';
    html += '<div class="col-md-6"><label>Opções de Tratamento *</label><select class="form-control-dark" id="opcao-' + r.id + '">' + opcoesHtml + '</select></div>';
    html += '<div class="col-md-6"><label>Relação Custo-Benefício *</label><div class="custo-beneficio-row">';
    html += '<label class="cb-option"><input type="radio" name="cb-' + r.id + '" value="Favorável"' + cbFav + '><span class="cb-favoravel">Favorável</span></label>';
    html += '<label class="cb-option"><input type="radio" name="cb-' + r.id + '" value="Desfavorável"' + cbDesf + '><span class="cb-desfavoravel">Desfavorável</span></label>';
    html += '</div></div></div>';

    // Implementação
    html += '<div class="row g-3 mt-1">';
    html += '<div class="col-12"><h5 class="tratamento-subhead"><i class="bi bi-gear"></i> Implementação</h5></div>';
html += '<div class="col-md-8"><label>Responsável <span style="color:var(--accent-red);">*</span></label>' +
  '<input type="text" ' +
    'class="form-control-dark input-responsavel" ' +
    'id="resp-' + r.id + '" ' +
    'value="' + escapeHTML(etapa.responsavel || "") + '" ' +
    'placeholder="Ex: Kaique Mateus (nome + sobrenome)" ' +
    'oninput="validarCampoResponsavel(this)" ' +
    'onblur="formatarResponsavel(this)" ' +
    'required>' +
  '</div>';
      html += '<div class="col-md-4"><label>Prazo</label><input type="date" class="form-control-dark' + (status.estado === "atraso" ? ' prazo-atrasado' : '') + '" id="prazo-' + r.id + '" value="' + (etapa.prazo || "") + '"></div>';
    html += '</div>';

    // Descrição
    html += '<div class="row g-3 mt-1"><div class="col-12"><label>Descrição do Tratamento *</label>';
    html += '<textarea class="form-control-dark" id="desc-' + r.id + '" rows="2">' + escapeHTML(etapa.descricao || "") + '</textarea></div></div>';

    // 🎯 MONITORAMENTO EXPANDIDO
    html += '<div class="row g-3 mt-1">';
    html += '<div class="col-12"><h5 class="tratamento-subhead"><i class="bi bi-eye"></i> Monitoramento do Risco</h5></div>';
    html += '<div class="col-md-6">';
    html += '<label>Nível do Monitoramento <span class="info-tooltip" title="Fraco=1.0 | Médio=0.75 | Alto=0.5. Quanto melhor, mais reduz o risco final."><i class="bi bi-info-circle"></i></span></label>';
    html += '<select class="form-control-dark" id="monitorNivel-' + r.id + '" onchange="atualizarRiscoFinal(' + r.id + ', ' + residual + ')">';
    html += '<option value="">Selecione...</option>';
    html += monOpt("1", "Fraco (1,0)");
    html += monOpt("0.75", "Médio (0,75)");
    html += monOpt("0.5", "Alto (0,5)");
    html += '</select>';
    html += '</div>';
    html += '<div class="col-md-6">';
    html += '<label>Risco Final <span class="info-tooltip" title="Cálculo: Residual × Nível de Monitoramento. Se residual = ' + residual.toFixed(1) + ' e monitoramento = Alto (0.5), então Final = ' + (residual * 0.5).toFixed(1) + '"><i class="bi bi-info-circle"></i></span></label>';
    html += '<div class="risco-final-box" id="finalBox-' + r.id + '" style="background:' + corFinal.cor + '15;border-color:' + corFinal.cor + '60;color:' + corFinal.cor + ';">';
    html += '<span class="rf-numero" id="finalNum-' + r.id + '">' + riscoFinal.toFixed(1) + '</span>';
    html += '<span class="rf-label" id="finalLab-' + r.id + '">' + corFinal.label + '</span>';
    html += '</div>';
    html += '</div>';
    html += '<div class="col-12"><label>Observações do Monitoramento</label>';
    html += '<textarea class="form-control-dark" id="monit-' + r.id + '" rows="2" placeholder="Como o risco será monitorado, indicadores, frequência...">' + escapeHTML(etapa.monitoramento || "") + '</textarea></div>';
    html += '</div>';

    // Footer
    html += '<div class="tratamento-footer">';
    if (status.estado === "concluido") {
      html += '<button class="btn btn-desconcluir" onclick="desmarcarConcluido(' + r.id + ')"><i class="bi bi-arrow-counterclockwise"></i> Reabrir (nova etapa)</button>';
    } else if (status.estado === "planejado" || status.estado === "atraso") {
      html += '<button class="btn btn-concluir" onclick="marcarConcluido(' + r.id + ')"><i class="bi bi-check-circle-fill"></i> Marcar como Concluído</button>';
    } else {
      html += '<span></span>';
    }
    html += '<button class="btn btn-save" onclick="salvarTratamento(' + r.id + ')"><i class="bi bi-check-circle-fill"></i> Salvar Etapa</button>';
    html += '</div>';
    html += '</div>'; // fim col-form

    // ============ COLUNA TIMELINE ============
    html += '<div class="col-timeline">';
    html += '<div class="timeline-header"><i class="bi bi-clock-history"></i> Histórico de Etapas</div>';

    // 🎯 SPARKLINE se tem histórico
    html += gerarSparkline(r);

    html += '<div class="timeline-lateral">';
    if (historico.length === 0) {
      html += '<div class="timeline-empty">Nenhuma etapa ainda</div>';
    } else {
      historico.slice().reverse().forEach(function(et, idxRev) {
        const numEt = historico.length - idxRev;
        const idxReal = historico.length - 1 - idxRev;
        const isAtual = idxRev === 0;
        const rfEtapa = calcularRiscoFinal(r, et);
        const corEtapa = corDoRisco(rfEtapa);

        let ico = "bi-circle", classe = "etapa-pendente";
        if (et.concluido) { ico = "bi-check-circle-fill"; classe = "etapa-concluida"; }
        else if (isAtual) { ico = "bi-hourglass-split"; classe = "etapa-atual"; }
        if (et.reaberta && !et.concluido) { ico = "bi-arrow-counterclockwise"; classe = "etapa-reaberta"; }

        html += '<div class="timeline-etapa ' + classe + (isAtual ? ' atual' : '') + '">';
        html += '<div class="etapa-icon"><i class="bi ' + ico + '"></i></div>';
        html += '<div class="etapa-content">';
        html += '<div class="etapa-titulo">Etapa ' + numEt + (et.reaberta ? ' <span class="badge-reab">reaberta</span>' : '') + ' ' + badgeComparacao(r, idxReal) + '</div>';
        if (et.opcao) html += '<div class="etapa-info"><strong>' + escapeHTML(et.opcao) + '</strong></div>';
        html += '<div class="etapa-info"><i class="bi bi-bullseye"></i> Risco Final: <strong style="color:' + corEtapa.cor + ';">' + rfEtapa.toFixed(1) + '</strong></div>';
        if (et.responsavel) html += '<div class="etapa-info"><i class="bi bi-person"></i> ' + escapeHTML(et.responsavel) + '</div>';
        if (et.prazo) html += '<div class="etapa-info"><i class="bi bi-calendar"></i> ' + formatarData(et.prazo) + '</div>';
        html += '<div class="etapa-meta">Criado ' + formatarDataHora(et.criadoEm) + ' por <strong>' + escapeHTML(et.criadoPor || "-") + '</strong></div>';
        if (et.concluido) {
          html += '<div class="etapa-meta etapa-meta-verde">✓ Concluído ' + formatarDataHora(et.concluidoEm) + ' por <strong>' + escapeHTML(et.concluidoPor || "-") + '</strong></div>';
        }
        html += '</div></div>';
      });
    }
    html += '</div>'; // fim timeline-lateral
    html += '</div>'; // fim col-timeline

    html += '</div>'; // fim body
    html += '</div>'; // fim card
    return html;
  }).join("");

  // Alerta crítico
  const totalAtrasados = document.querySelectorAll(".tratamento-card.em-atraso").length;
  if (totalAtrasados > 0 && !window._atrasoAvisado && typeof dispararAlertaCritico === "function") {
    dispararAlertaCritico(totalAtrasados);
    window._atrasoAvisado = true;
  }
}

// ============ ATUALIZA RISCO FINAL AO VIVO ============
function atualizarRiscoFinal(riscoId, residual) {
  const sel = document.getElementById("monitorNivel-" + riscoId);
  const box = document.getElementById("finalBox-" + riscoId);
  const num = document.getElementById("finalNum-" + riscoId);
  const lab = document.getElementById("finalLab-" + riscoId);
  if (!sel || !box || !num || !lab) return;

  const mon = parseFloat(sel.value) || 1;
  const final = residual * mon;
  const c = corDoRisco(final);

  num.textContent = final.toFixed(1);
  lab.textContent = c.label;
  box.style.background = c.cor + "15";
  box.style.borderColor = c.cor + "60";
  box.style.color = c.cor;

  tocarSom("click");
}

// ============ EXPAND / COLLAPSE ============
function toggleCard(riscoId) {
  const card = document.querySelector('.tratamento-card[data-risco-id="' + riscoId + '"]');
  if (!card) return;
  card.classList.toggle("expanded");
  tocarSom("click");
  atualizarBotaoExpandirTodos();
}

function toggleTodosCards() {
  const cards = document.querySelectorAll(".tratamento-card");
  if (cards.length === 0) return;
  const algumFechado = Array.from(cards).some(function(c) {
    return !c.classList.contains("expanded");
  });
  cards.forEach(function(c) {
    if (algumFechado) c.classList.add("expanded");
    else c.classList.remove("expanded");
  });
  tocarSom("click");
  atualizarBotaoExpandirTodos();
}

function atualizarBotaoExpandirTodos() {
  const btn = document.getElementById("btnExpandAll");
  if (!btn) return;
  const cards = document.querySelectorAll(".tratamento-card");
  if (cards.length === 0) return;
  const todosAbertos = Array.from(cards).every(function(c) {
    return c.classList.contains("expanded");
  });
  btn.innerHTML = todosAbertos
    ? '<i class="bi bi-arrows-collapse"></i> Recolher todos'
    : '<i class="bi bi-arrows-expand"></i> Expandir todos';
}

// ============ MARCAR CONCLUIDO ============
// SALVAR — grava na etapa atual
async function salvarTratamento(riscoId) {
  const idx = riscos.findIndex(r => r.id === riscoId);
  if (idx < 0) return;

  const risco = riscos[idx];
  migrarTratamentoSeNecessario(risco);

  const opcao = document.getElementById("opcao-" + riscoId).value;
  const cbEl = document.querySelector('input[name="cb-' + riscoId + '"]:checked');
  const cb = cbEl ? cbEl.value : "";
  const responsavelInput = document.getElementById("resp-" + riscoId);  // 🎯 declara
  const responsavel = responsavelInput ? responsavelInput.value.trim() : "";
  const prazo = document.getElementById("prazo-" + riscoId).value;
  const descricao = document.getElementById("desc-" + riscoId).value.trim();
  const monitoramento = document.getElementById("monit-" + riscoId).value.trim();
  const nivelMonitoramento = document.getElementById("monitorNivel-" + riscoId).value;

  // 🎯 Validação do responsável
  const validacao = validarNomeResponsavel(responsavel);
  if (!validacao.valido) {
    showToast(validacao.mensagem, "error");
    tocarSom("error");
    if (responsavelInput) {
      responsavelInput.focus();
      responsavelInput.classList.add("input-invalido");
      if (typeof mostrarMensagemResponsavel === "function") {
        mostrarMensagemResponsavel(responsavelInput, validacao.mensagem, "erro");
      }
    }
    return;
  }

  const responsavelFormatado = validacao.nomeFormatado;

  if (!opcao || !cb || !descricao) {
    showToast("Preencha Opção, Custo-Benefício e Descrição.", "error");
    tocarSom("error");
    return;
  }

  const dados = {
    opcao,
    custoBeneficio: cb,
    responsavel: responsavelFormatado,
    prazo,
    descricao,
    monitoramento,
    nivelMonitoramento
  };

  showToast("Salvando...", "success");

  try {
    let etapaAtual = obterEtapaAtual(risco);

    let etapaSalva;
    if (etapaAtual && etapaAtual.id) {
      etapaSalva = await sbAtualizarEtapa(etapaAtual.id, dados);
    } else {
      etapaSalva = await sbCriarEtapa(riscoId, dados);
    }

    if (!etapaSalva) throw new Error("Falha ao salvar etapa");

    const etapas = await sbListarEtapasDoRisco(riscoId);
    risco.tratamento.historico = etapas.map(sbConverterEtapa);

    registrarLog("tratamento", riscoId, "Plano salvo: " + obterNumeroRisco(riscoId) + " → " + opcao);
    showToast("Plano de tratamento salvo!", "success");
    tocarSom("success");

    renderizarTratamentos();
    atualizarKPIsTratamento();

  } catch (e) {
    console.error("[salvarTratamento]", e);
    showToast("Erro ao salvar: " + e.message, "error");
    tocarSom("error");
  }
}

// MARCAR COMO CONCLUÍDO
async function marcarConcluido(riscoId) {
  const risco = riscos.find(r => r.id === riscoId);
  if (!risco) return;

  const etapaAtual = obterEtapaAtual(risco);
  if (!etapaAtual || !etapaAtual.opcao) {
    showToast("Salve o plano antes de concluir.", "error");
    tocarSom("error");
    return;
  }

  if (!confirm("Marcar este tratamento como concluído?")) return;

  try {
    // Salva alterações pendentes primeiro
    const opcaoEl = document.getElementById("opcao-" + riscoId);
    const cbEl = document.querySelector('input[name="cb-' + riscoId + '"]:checked');
    const respEl = document.getElementById("resp-" + riscoId);
    const prazoEl = document.getElementById("prazo-" + riscoId);
    const descEl = document.getElementById("desc-" + riscoId);
    const monitEl = document.getElementById("monit-" + riscoId);
    const monNivEl = document.getElementById("monitorNivel-" + riscoId);

    const dadosSalvar = {
      opcao: opcaoEl ? opcaoEl.value : etapaAtual.opcao,
      custoBeneficio: cbEl ? cbEl.value : etapaAtual.custoBeneficio,
      responsavel: respEl ? respEl.value.trim() : etapaAtual.responsavel,
      prazo: prazoEl ? prazoEl.value : etapaAtual.prazo,
      descricao: descEl ? descEl.value.trim() : etapaAtual.descricao,
      monitoramento: monitEl ? monitEl.value.trim() : etapaAtual.monitoramento,
      nivelMonitoramento: monNivEl ? monNivEl.value : etapaAtual.nivelMonitoramento
    };

    await sbAtualizarEtapa(etapaAtual.id, dadosSalvar);

    // Marca como concluída
    const resultado = await sbConcluirEtapa(etapaAtual.id);
    if (!resultado) throw new Error("Falha ao concluir");

    // Recarrega etapas
    const etapas = await sbListarEtapasDoRisco(riscoId);
    risco.tratamento.historico = etapas.map(sbConverterEtapa);

    registrarLog("concluir_tratamento", riscoId, "Etapa concluída: " + obterNumeroRisco(riscoId));
    showToast("Tratamento concluído!", "success");
    tocarSom("success");
    dispararConfetti("verde");
    setTimeout(() => dispararConfetti("verde"), 300);
    setTimeout(() => dispararConfetti("verde"), 600);

    renderizarTratamentos();
    atualizarKPIsTratamento();

  } catch (e) {
    console.error("[marcarConcluido]", e);
    showToast("Erro: " + e.message, "error");
    tocarSom("error");
  }
}

// REABRIR — cria NOVA etapa (prazo zerado)
async function desmarcarConcluido(riscoId) {
  const risco = riscos.find(r => r.id === riscoId);
  if (!risco) return;

  if (!confirm("Reabrir tratamento?\n\nUma nova etapa será criada com o prazo zerado.")) return;

  try {
    // Cria nova etapa reaberta
    const novaEtapa = await sbReabrirRisco(riscoId);
    if (!novaEtapa) throw new Error("Falha ao reabrir");

    // Recarrega
    const etapas = await sbListarEtapasDoRisco(riscoId);
    risco.tratamento.historico = etapas.map(sbConverterEtapa);

    registrarLog("reabrir_tratamento", riscoId,
      "Nova etapa criada (etapa " + risco.tratamento.historico.length + ")");
    showToast("Tratamento reaberto — nova etapa criada!", "success");
    tocarSom("click");

    renderizarTratamentos();
    atualizarKPIsTratamento();

  } catch (e) {
    console.error("[desmarcarConcluido]", e);
    showToast("Erro: " + e.message, "error");
    tocarSom("error");
  }
}
// ============ KPIs (4 status) ============
function atualizarKPIsTratamento() {
  let total = 0, planejados = 0, concluidos = 0, atrasados = 0, pendentes = 0;

  if (processoAtualId) {
    const lista = riscosATratar(processoAtualId);
    total = lista.length;
    lista.forEach(function(r) {
      const s = calcularStatusTratamento(r);
      if (s.estado === "planejado") planejados++;
      else if (s.estado === "concluido") concluidos++;
      else if (s.estado === "atraso") atrasados++;
      else pendentes++;
    });
  }

  animarContador("kpiTotal",        total);
  animarContador("kpiTratados",     concluidos);
  animarContador("kpiPendentes",    pendentes + planejados);
  animarContador("kpiPrioritarios", atrasados);

  aplicarAlertaAtraso(atrasados);
}

function aplicarAlertaAtraso(atrasados) {
  const cardAtraso = document.querySelector(".kpi-card.kpi-atraso, .kpi-card.kpi-em-atraso, .kpi-card:nth-child(4)");
  if (!cardAtraso) return;

  if (atrasados > 0) {
    cardAtraso.classList.add("kpi-alerta");
    console.log("[KPI] Pulsação vermelha ativada — " + atrasados + " em atraso");
  } else {
    cardAtraso.classList.remove("kpi-alerta");
    console.log("[KPI] Pulsação vermelha desativada");
  }
}

function atualizarLabelsKPIs(atrasados) {
  const labels = document.querySelectorAll(".kpi-label");
  if (labels.length >= 4) {
    labels[0].textContent = "Total a Tratar";
    labels[1].textContent = "Conclu\u00eddos";
    labels[2].textContent = "Em Andamento";
    labels[3].textContent = "Em Atraso";
  }

  // Se tem atrasados, adiciona pulsacao no card de Em Atraso
  const kpiAtrasoCard = document.querySelector(".kpi-card.kpi-baixo");
  if (kpiAtrasoCard) {
    if (atrasados > 0) {
      kpiAtrasoCard.classList.add("kpi-alerta");
    } else {
      kpiAtrasoCard.classList.remove("kpi-alerta");
    }
  }
}

// ============ HELPER ESCAPE ============
function escapeHTML(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ============ EXPORT PDF (mantem versao anterior - reutiliza) ============
async function exportarTratamentoPDF() {
  if (!processoAtualId) {
    showToast("Selecione um registro primeiro.", "error");
    tocarSom("error");
    return;
  }
  if (typeof html2canvas === "undefined" || typeof window.jspdf === "undefined") {
    showToast("Bibliotecas de PDF não carregadas.", "error");
    return;
  }

  showToast("Gerando PDF... aguarde", "success");

  try {
    const proc = processos.find(function(p) { return p.id === processoAtualId; });
    const todosRiscos = riscosDoProcesso();

    // 🎯 Só riscos com Tratar=Sim
    const riscosT = todosRiscos.filter(function(r) {
      return String(r.tratar).toLowerCase() === "sim";
    });

    if (riscosT.length === 0) {
      showToast("Nenhum risco marcado para tratamento neste registro.", "error");
      tocarSom("error");
      return;
    }

    const dataHoje = new Date().toLocaleDateString("pt-BR");
    const LARGURA_PX = 1400;
    const LINHAS_POR_PAGINA = 10;

    // ==========================================
    // HELPER: renderiza HTML em canvas
    // ==========================================
    async function renderizarBlocoParaCanvas(htmlStr, padding) {
      padding = padding || 15;
      const bloco = document.createElement("div");
      bloco.style.cssText =
        "position:absolute;left:-99999px;top:0;width:" + LARGURA_PX + "px;" +
        "background:#ffffff;color:#1a2b3d;font-family:'Segoe UI',Tahoma,sans-serif;" +
        "padding:" + padding + "px 35px;box-sizing:border-box;display:block;";
      bloco.innerHTML = htmlStr;
      document.body.appendChild(bloco);
      await new Promise(function(r) { setTimeout(r, 100); });

      const canvas = await html2canvas(bloco, {
        scale: 2, backgroundColor: "#ffffff",
        useCORS: true, logging: false,
        width: LARGURA_PX, windowWidth: LARGURA_PX
      });
      document.body.removeChild(bloco);
      return canvas;
    }

    // ==========================================
    // 1) HEADER
    // ==========================================
    const headerContainer = document.createElement("div");
    headerContainer.style.cssText =
      "position:absolute;left:-99999px;top:0;width:" + LARGURA_PX + "px;" +
      "background:#ffffff;color:#1a2b3d;font-family:'Segoe UI',Tahoma,sans-serif;" +
      "padding:30px 35px 15px;box-sizing:border-box;display:block;";
    headerContainer.appendChild(criarCabecalho(proc, {
      nome: user.nome,
      matricula: user.matricula,
      divisao: user.divisao
    }, dataHoje));
    document.body.appendChild(headerContainer);
    await new Promise(function(r) { setTimeout(r, 200); });

    const headerCanvas = await html2canvas(headerContainer, {
      scale: 2, backgroundColor: "#ffffff",
      useCORS: true, logging: false,
      width: LARGURA_PX, windowWidth: LARGURA_PX
    });
    document.body.removeChild(headerContainer);
    const headerImg = headerCanvas.toDataURL("image/png");

    // ==========================================
    // 2) INFO DO PROCESSO
    // ==========================================
    const areasArr = (proc.areas || "")
      .split(",")
      .map(function(a) { return a.trim(); })
      .filter(function(a) { return a; });

    const areasHtml = areasArr.length > 0
      ? areasArr.map(function(a) {
          return '<span style="display:inline-block;background:rgba(77,208,225,0.12);color:#0e9aa7;' +
                 'padding:3px 10px;margin:1px 4px 1px 0;border-radius:12px;' +
                 'border:1px solid rgba(77,208,225,0.35);font-size:12px;font-weight:700;vertical-align:middle;">' +
                 escapeHTML(a) + '</span>';
        }).join("")
      : '<span style="color:#8a9ba8;">—</span>';

    function campo(label, valor) {
      return '<div>' +
               '<div style="color:#0e9aa7;font-size:11px;font-weight:700;text-transform:uppercase;' +
                           'letter-spacing:0.6px;margin-bottom:4px;">' + label + '</div>' +
               '<div style="color:#1a2b3d;font-size:13px;font-weight:500;word-wrap:break-word;line-height:1.5;">' +
                 valor +
               '</div>' +
             '</div>';
    }

    const dashOrValue = function(v) {
      return v ? escapeHTML(v) : '<span style="color:#8a9ba8;">—</span>';
    };

    const infoProcessoHTML =
      '<div style="padding:18px 22px;background:#f9fbfc;border-radius:10px;border:1px solid #e6ecf1;' +
                  'font-size:13px;line-height:1.6;">' +
        '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:20px 28px;align-items:start;">' +
          campo("Unidade",       dashOrValue(proc.unidade || proc.equipe)) +
          campo("Processo",      dashOrValue(proc.processo)) +
          campo("Objetivo",      dashOrValue(proc.objetivo)) +
          campo("Macroprocesso", dashOrValue(proc.macroprocesso)) +
          campo("Resultado",     dashOrValue(proc.resultado)) +
          campo("Clientes / Demandantes", dashOrValue(proc.clientes)) +
          campo("Áreas Envolvidas", areasHtml) +
          campo("Data", proc.data ? formatarData(proc.data) : '<span style="color:#8a9ba8;">—</span>') +
        '</div>' +
      '</div>';

    // ==========================================
    // 3) LINHAS DA TABELA "RISCOS A TRATAR" (só Tratar=Sim)
    // ==========================================
    const ordenados = riscosT.slice().sort(function(a, b) {
      return (b.prob * b.imp) - (a.prob * a.imp);
    });

    const headerTabelaRiscos =
      '<thead style="background:#f5f8fa;color:#0e9aa7;"><tr>' +
        '<th style="padding:8px;border:1px solid #d4dde3;" rowspan="2">Registro</th>' +
        '<th style="padding:8px;border:1px solid #d4dde3;" colspan="3">Riscos Identificados</th>' +
        '<th style="padding:8px;border:1px solid #d4dde3;" colspan="3">Análise</th>' +
        '<th style="padding:8px;border:1px solid #d4dde3;" colspan="2">Controles</th>' +
        '<th style="padding:8px;border:1px solid #d4dde3;" rowspan="2">Residual</th>' +
        '<th style="padding:8px;border:1px solid #d4dde3;" rowspan="2">Prioritário?</th>' +
      '</tr><tr>' +
        '<th style="padding:6px;border:1px solid #d4dde3;">Evento</th>' +
        '<th style="padding:6px;border:1px solid #d4dde3;">Causa</th>' +
        '<th style="padding:6px;border:1px solid #d4dde3;">Consequência</th>' +
        '<th style="padding:6px;border:1px solid #d4dde3;">Prob</th>' +
        '<th style="padding:6px;border:1px solid #d4dde3;">Imp</th>' +
        '<th style="padding:6px;border:1px solid #d4dde3;">Nível</th>' +
        '<th style="padding:6px;border:1px solid #d4dde3;">Descrição</th>' +
        '<th style="padding:6px;border:1px solid #d4dde3;">Nível</th>' +
      '</tr></thead>';

    const linhasRiscos = ordenados.map(function(r, idx) {
      const nivel = r.prob * r.imp;
      const cn = classificar(nivel);
      const residual = (nivel * r.nivelControle).toFixed(1);
      const cr = classificar(parseFloat(residual));
      const numero = obterNumeroRisco(r.id);
      const bgRow = idx % 2 === 0 ? "#ffffff" : "#f9fbfc";
      const corN = cn.classe === "badge-alto" ? "#c04040" : cn.classe === "badge-medio" ? "#d4a017" : "#2eb87a";
      const corR = cr.classe === "badge-alto" ? "#c04040" : cr.classe === "badge-medio" ? "#d4a017" : "#2eb87a";

      return '<tr style="background:' + bgRow + ';">' +
        '<td style="padding:8px;border:1px solid #d4dde3;text-align:center;font-weight:700;color:#0e9aa7;">' + numero + '</td>' +
        '<td style="padding:8px;border:1px solid #d4dde3;">' + escapeHTML(r.evento) + '</td>' +
        '<td style="padding:8px;border:1px solid #d4dde3;">' + escapeHTML(r.causa) + '</td>' +
        '<td style="padding:8px;border:1px solid #d4dde3;">' + escapeHTML(r.consequencia) + '</td>' +
        '<td style="padding:8px;border:1px solid #d4dde3;text-align:center;">' + r.prob + '</td>' +
        '<td style="padding:8px;border:1px solid #d4dde3;text-align:center;">' + r.imp + '</td>' +
        '<td style="padding:8px;border:1px solid #d4dde3;text-align:center;font-weight:700;">' + nivel + ' <span style="color:' + corN + ';">(' + cn.label + ')</span></td>' +
        '<td style="padding:8px;border:1px solid #d4dde3;">' + escapeHTML(r.descControle || "-") + '</td>' +
        '<td style="padding:8px;border:1px solid #d4dde3;text-align:center;">' + rotuloControle(r.nivelControle) + '</td>' +
        '<td style="padding:8px;border:1px solid #d4dde3;text-align:center;font-weight:700;">' + residual + ' <span style="color:' + corR + ';">(' + cr.label + ')</span></td>' +
        '<td style="padding:8px;border:1px solid #d4dde3;text-align:center;">' + (r.prioritario === "Sim" ? "Sim" : "—") + '</td>' +
      '</tr>';
    });

    // ==========================================
    // 4) LINHAS DO PLANO DE TRATAMENTO
    // ==========================================
    const ordenadosPlano = riscosT.slice().sort(function(a, b) {
      function calcularOrdemRisco(r) {
        const residual = r.prob * r.imp * (r.nivelControle || 1);
        const etapas = (r.tratamento && r.tratamento.historico)
          || (r.tratamento && r.tratamento.opcao ? [r.tratamento] : []);
        const trat = etapas.length > 0 ? etapas[etapas.length - 1] : {};
        const fatorMon = parseFloat(trat.nivelMonitoramento) || 0;
        return fatorMon > 0 ? residual * fatorMon : residual;
      }
      return calcularOrdemRisco(b) - calcularOrdemRisco(a);
    });

    const headerTabelaTrat =
      '<thead style="background:#e6f5f0;color:#2eb87a;"><tr>' +
        '<th style="padding:8px;border:1px solid #b7e0d3;">Registro</th>' +
        '<th style="padding:8px;border:1px solid #b7e0d3;">Evento</th>' +
        '<th style="padding:8px;border:1px solid #b7e0d3;">Status</th>' +
        '<th style="padding:8px;border:1px solid #b7e0d3;">Opção</th>' +
        '<th style="padding:8px;border:1px solid #b7e0d3;">Custo-Benef.</th>' +
        '<th style="padding:8px;border:1px solid #b7e0d3;">Responsável</th>' +
        '<th style="padding:8px;border:1px solid #b7e0d3;">Prazo</th>' +
        '<th style="padding:8px;border:1px solid #b7e0d3;">Descrição</th>' +
        '<th style="padding:8px;border:1px solid #b7e0d3;">Monitoramento</th>' +
        '<th style="padding:8px;border:1px solid #b7e0d3;">Risco Final</th>' +
      '</tr></thead>';

    const linhasTratamento = ordenadosPlano.map(function(r, idx) {
      const etapas = (r.tratamento && r.tratamento.historico)
        || (r.tratamento && r.tratamento.opcao ? [r.tratamento] : []);
      const trat = etapas.length > 0 ? etapas[etapas.length - 1] : {};
      const numero = obterNumeroRisco(r.id);

      const nivelResidual = r.prob * r.imp * (r.nivelControle || 1);
      const fatorMon = parseFloat(trat.nivelMonitoramento) || 0;
      const riscoFinal = fatorMon > 0 ? nivelResidual * fatorMon : nivelResidual;
      const cRF = classificar(riscoFinal);
      const corRF = cRF.classe === "badge-alto" ? "#c04040" : cRF.classe === "badge-medio" ? "#d4a017" : "#2eb87a";

      let statusLabel = "Pendente", statusColor = "#c04040", bgRow = idx % 2 === 0 ? "#ffffff" : "#fef5f5";
      if (trat.opcao && trat.descricao) {
        if (trat.concluido) {
          statusLabel = "Concluído"; statusColor = "#2eb87a"; bgRow = "#f0faf5";
        } else if (trat.prazo) {
          const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
          const dp = new Date(trat.prazo + "T00:00:00");
          if (dp < hoje) { statusLabel = "Em Atraso"; statusColor = "#d47116"; bgRow = "#fef3e6"; }
          else { statusLabel = "Planejado"; statusColor = "#2c74b3"; bgRow = "#f0f6fc"; }
        } else {
          statusLabel = "Planejado"; statusColor = "#2c74b3"; bgRow = "#f0f6fc";
        }
      }

      const marcaPrioritario = r.prioritario === "Sim"
        ? '<br><span style="color:#d4a017;font-size:9px;font-weight:800;">PRIORITÁRIO</span>'
        : '';

      return '<tr style="background:' + bgRow + ';">' +
        '<td style="padding:8px;border:1px solid #d4dde3;text-align:center;font-weight:700;color:#0e9aa7;">' + numero + marcaPrioritario + '</td>' +
        '<td style="padding:8px;border:1px solid #d4dde3;max-width:150px;">' + escapeHTML(r.evento) + '</td>' +
        '<td style="padding:8px;border:1px solid #d4dde3;text-align:center;font-weight:700;color:' + statusColor + ';">' + statusLabel + '</td>' +
        '<td style="padding:8px;border:1px solid #d4dde3;text-align:center;">' + (trat.opcao || "—") + '</td>' +
        '<td style="padding:8px;border:1px solid #d4dde3;text-align:center;">' +
          (trat.custoBeneficio === "Favorável"
            ? '<span style="color:#2eb87a;font-weight:700;">Favorável</span>'
            : (trat.custoBeneficio === "Desfavorável"
                ? '<span style="color:#c04040;font-weight:700;">Desfavorável</span>'
                : "—")) + '</td>' +
        '<td style="padding:8px;border:1px solid #d4dde3;">' + escapeHTML(trat.responsavel || "—") + '</td>' +
        '<td style="padding:8px;border:1px solid #d4dde3;text-align:center;">' + (trat.prazo ? formatarData(trat.prazo) : "—") + '</td>' +
        '<td style="padding:8px;border:1px solid #d4dde3;max-width:180px;">' + escapeHTML(trat.descricao || "—") + '</td>' +
        '<td style="padding:8px;border:1px solid #d4dde3;max-width:180px;">' + escapeHTML(trat.monitoramento || "—") + '</td>' +
        '<td style="padding:8px;border:1px solid #d4dde3;text-align:center;font-weight:700;">' +
          (fatorMon > 0 ? riscoFinal.toFixed(1) + ' <span style="color:' + corRF + ';">(' + cRF.label + ')</span>' : '—') +
        '</td>' +
      '</tr>';
    });

    // ==========================================
    // 5) MATRIZ (com tratamento aplicado)
    // ==========================================
    const riscosParaMatriz = riscosT.map(function(r) {
      const clone = Object.assign({}, r);
      const etapas = (r.tratamento && r.tratamento.historico)
        || (r.tratamento && r.tratamento.opcao ? [r.tratamento] : []);
      const trat = etapas.length > 0 ? etapas[etapas.length - 1] : null;
      if (trat && trat.nivelMonitoramento) {
        const fatorMon = parseFloat(trat.nivelMonitoramento);
        clone.nivelControle = (r.nivelControle || 1) * fatorMon;
      }
      return clone;
    });

    const matrizHTML =
      '<h2 style="font-size:16px;color:#0e9aa7;margin:0 0 15px;padding-bottom:8px;border-bottom:2px solid #0e9aa7;">Matriz de Risco (com Tratamento)</h2>' +
      '<div style="max-width:100%;margin:0 auto;padding:15px;">' +
        construirMatrizHTMLClara(riscosParaMatriz) +
      '</div>';

    // ==========================================
    // 6) MONTA BLOCOS
    // ==========================================
    const blocos = [];

    // Info do processo
    blocos.push({ html: infoProcessoHTML, isolada: false });

    // Chunks da tabela "Riscos a Tratar" (10 por vez)
    for (let i = 0; i < linhasRiscos.length; i += LINHAS_POR_PAGINA) {
      const chunk = linhasRiscos.slice(i, i + LINHAS_POR_PAGINA);
      const titulo = i === 0
        ? '<h2 style="font-size:16px;color:#0e9aa7;margin:0 0 12px;padding-bottom:8px;border-bottom:2px solid #0e9aa7;">Riscos a Tratar</h2>'
        : '<div style="font-size:11px;color:#8a9ba8;margin-bottom:6px;">(continuação — Riscos a Tratar)</div>';

      blocos.push({
        html: titulo +
          '<table style="width:100%;border-collapse:collapse;font-size:13px;background:#ffffff;">' +
            headerTabelaRiscos +
            '<tbody>' + chunk.join("") + '</tbody>' +
          '</table>',
        isolada: false
      });
    }

    // Chunks do Plano de Tratamento (10 por vez)
    for (let i = 0; i < linhasTratamento.length; i += LINHAS_POR_PAGINA) {
      const chunk = linhasTratamento.slice(i, i + LINHAS_POR_PAGINA);
      const titulo = i === 0
        ? '<h2 style="font-size:16px;color:#2eb87a;margin:0 0 12px;padding-bottom:8px;border-bottom:2px solid #2eb87a;">Plano de Tratamento</h2>'
        : '<div style="font-size:11px;color:#8a9ba8;margin-bottom:6px;">(continuação — Plano de Tratamento)</div>';

      blocos.push({
        html: titulo +
          '<table style="width:100%;border-collapse:collapse;font-size:13px;background:#ffffff;">' +
            headerTabelaTrat +
            '<tbody>' + chunk.join("") + '</tbody>' +
          '</table>',
        isolada: false
      });
    }

    // 🎯 MATRIZ isolada em página própria
    blocos.push({
      html: matrizHTML,
      isolada: true,
      forcaNovaPagina: true
    });

    // ==========================================
    // 7) RENDERIZA BLOCOS EM CANVAS
    // ==========================================
    showToast("Renderizando blocos... (" + blocos.length + ")", "success");
    for (let i = 0; i < blocos.length; i++) {
      blocos[i].canvas = await renderizarBlocoParaCanvas(blocos[i].html, 10);
    }

    // ==========================================
    // 8) MONTA PDF
    // ==========================================
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
      compress: true
    });

    const pageWidth = 297;
    const pageHeight = 210;
    const margem = 5;
    const larguraDisponivel = pageWidth - (margem * 2);
    const headerAlturaMM = (headerCanvas.height * larguraDisponivel) / headerCanvas.width;
    const espacoInicial = margem + headerAlturaMM + 5;

    function adicionarHeader(pdf) {
      pdf.addImage(headerImg, "PNG", margem, margem, larguraDisponivel, headerAlturaMM, undefined, "FAST");
    }

    let currentY = espacoInicial;
    adicionarHeader(pdf);

    for (let i = 0; i < blocos.length; i++) {
      const bloco = blocos[i];
      const alturaBlocoMM = (bloco.canvas.height * larguraDisponivel) / bloco.canvas.width;

      // Nova página forçada (matriz)
      if (bloco.forcaNovaPagina && currentY > espacoInicial) {
        pdf.addPage("a4", "landscape");
        adicionarHeader(pdf);
        currentY = espacoInicial;
      }

      // Se não cabe, nova página
      if (currentY + alturaBlocoMM > pageHeight - margem) {
        pdf.addPage("a4", "landscape");
        adicionarHeader(pdf);
        currentY = espacoInicial;
      }

      // Adiciona bloco (sem centralização vertical)
      pdf.addImage(
        bloco.canvas.toDataURL("image/png"), "PNG",
        margem, currentY,
        larguraDisponivel, alturaBlocoMM,
        undefined, "FAST"
      );

      currentY += alturaBlocoMM + 5;
    }

    // Numeração
    const totalPaginas = pdf.internal.getNumberOfPages();
    for (let p = 1; p <= totalPaginas; p++) {
      pdf.setPage(p);
      pdf.setFontSize(8);
      pdf.setTextColor(120, 120, 120);
      pdf.text(
        "Página " + p + " de " + totalPaginas,
        pageWidth / 2,
        pageHeight - 2,
        { align: "center" }
      );
    }

    const nomeArq = "SEPREC_Tratamento_" + (proc.processo || "riscos").replace(/[^\w]/g, "_").substring(0, 40) +
                    "_" + new Date().toISOString().substring(0, 10) + ".pdf";
    pdf.save(nomeArq);

    registrarLog("exportar_pdf_tratamento", processoAtualId, "Exportou PDF do tratamento");
    showToast("PDF gerado com sucesso!", "success");
    tocarSom("success");

  } catch (e) {
    console.error(e);
    showToast("Erro ao gerar PDF: " + e.message, "error");
    tocarSom("error");
  }
}

// ============ MATRIZ HTML ============
function construirMatrizHTML(riscosFiltrados) {
  const mapaNiveis = {};
  for (let p = 1; p <= 5; p++) {
    for (let i = 1; i <= 5; i++) {
      mapaNiveis[nivelMatriz(p, i)] = { prob: p, imp: i };
    }
  }
  const porCelula = {};
  const ordenados = riscosFiltrados.slice().sort(function(a, b) {
    return (b.prob * b.imp) - (a.prob * a.imp);
  });
  ordenados.forEach(function(r) {
    const nivel = r.prob * r.imp;
    const residual = nivel * r.nivelControle;
    let residualInt = Math.max(1, Math.min(25, Math.round(residual)));
    const coord = mapaNiveis[residualInt];
    if (!coord) return;
    const chave = coord.prob + "-" + coord.imp;
    if (!porCelula[chave]) porCelula[chave] = [];
    porCelula[chave].push(obterNumeroRisco(r.id));
  });

  const yLabels = ["Muito Alto", "Alto", "M\u00e9dio", "Baixo", "Muito Baixo"];
  const xLabels = ["Raro", "Pouco Prov.", "Prov\u00e1vel", "Muito Prov.", "Quase Certo"];

  let html = '<div style="display:grid;grid-template-columns:100px repeat(5,1fr);gap:3px;">';
  html += '<div></div>';
  for (let p = 1; p <= 5; p++) {
    html += '<div style="background:#0f1f27;padding:6px 3px;border-radius:4px;text-align:center;font-size:9px;font-weight:600;color:#e6f1f5;">' + xLabels[p-1] + '</div>';
  }
  for (let i = 5; i >= 1; i--) {
    html += '<div style="background:#0f1f27;padding:6px 3px;border-radius:4px;text-align:center;font-size:9px;font-weight:600;color:#e6f1f5;display:flex;align-items:center;justify-content:center;">' + yLabels[5-i] + '</div>';
    for (let p = 1; p <= 5; p++) {
      const nivel = nivelMatriz(p, i);
      let cor = "#3ad48a";
      if (nivel >= 20) cor = "#e05a5a";
      else if (nivel >= 7) cor = "#f5c94a";
      const chave = p + "-" + i;
      const chips = porCelula[chave] || [];
      html += '<div style="background:' + cor + ';padding:6px 3px;border-radius:4px;text-align:center;color:#0a1929;font-weight:700;min-height:50px;display:flex;flex-direction:column;justify-content:center;">' +
        '<span style="font-size:12px;opacity:0.7;">' + nivel + '</span>';
      if (chips.length > 0) {
        html += '<div style="display:flex;flex-wrap:wrap;gap:2px;justify-content:center;margin-top:3px;">';
        chips.forEach(function(c) {
          html += '<span style="display:inline-block;background:#0a1929;color:#fff;padding:1px 5px;border-radius:6px;font-size:8px;font-weight:700;border:1px solid rgba(255,255,255,0.4);">' + c + '</span>';
        });
        html += '</div>';
      }
      html += '</div>';
    }
  }
  html += '</div>';
  html += '<div style="text-align:center;color:#4dd0e1;font-weight:700;font-size:10px;letter-spacing:2px;margin-top:8px;">\u2192 PROBABILIDADE</div>';
  html += '<div style="display:flex;gap:20px;justify-content:center;margin-top:10px;padding-top:8px;border-top:1px solid #1e5f7a;font-size:10px;">' +
    '<span><span style="display:inline-block;width:12px;height:12px;background:#3ad48a;border-radius:2px;vertical-align:middle;margin-right:4px;"></span>Baixo 1-6</span>' +
    '<span><span style="display:inline-block;width:12px;height:12px;background:#f5c94a;border-radius:2px;vertical-align:middle;margin-right:4px;"></span>M\u00e9dio 7-19</span>' +
    '<span><span style="display:inline-block;width:12px;height:12px;background:#e05a5a;border-radius:2px;vertical-align:middle;margin-right:4px;"></span>Alto 20-25</span>' +
  '</div>';
  return html;
}

// ============ ALERTA CRÍTICO VISUAL ============
function dispararAlertaCritico(quantidade) {
  // 1. Flash vermelho na página
  const overlay = document.createElement("div");
  overlay.className = "critical-alert-overlay";
  document.body.appendChild(overlay);
  setTimeout(function() { overlay.remove(); }, 2500);

  // 2. Banner de aviso no topo
  const bannerExistente = document.querySelector(".critical-alert-banner");
  if (bannerExistente) bannerExistente.remove();

  const banner = document.createElement("div");
  banner.className = "critical-alert-banner";
  banner.innerHTML =
    '<i class="bi bi-exclamation-triangle-fill"></i>' +
    '<span>ATENÇÃO: ' + quantidade + ' risco' + (quantidade !== 1 ? 's' : '') +
    ' com prazo vencido!</span>' +
    '<button class="close-alert" onclick="fecharAlertaCritico()">×</button>';
  document.body.appendChild(banner);

  // 3. Som de alerta
  if (typeof tocarSom === "function") tocarSom("alert");

  // 4. Auto-fecha após 8 segundos
  setTimeout(function() {
    if (banner && !banner.classList.contains("exiting")) {
      fecharAlertaCritico();
    }
  }, 8000);
}

function fecharAlertaCritico() {
  const banner = document.querySelector(".critical-alert-banner");
  if (!banner) return;
  banner.classList.add("exiting");
  setTimeout(function() { banner.remove(); }, 400);
}

// ============ FILTRO DE DIVISÃO (mesma lógica do index) ============
const MATRICULAS_GESTORES_TRAT = ["20145", "295816", "15280", "51587", "293898"];

function usuarioEhGestorTrat() {
  const matricula = String(user.matricula || "").trim();
  return MATRICULAS_GESTORES_TRAT.indexOf(matricula) >= 0;
}

function inicializarFiltroDivisaoTrat() {
  const select = document.getElementById("filtroDivisao");
  const lockIcon = document.getElementById("divisaoLockIcon");
  const label = document.getElementById("divisaoAtualLabel");
  if (!select) return;

  // Popula com todas as divisões
  const todas = Object.keys(NOMES_DIVISOES);
  select.innerHTML = todas.map(function(sigla) {
    const nome = NOMES_DIVISOES[sigla];
    const selected = sigla === user.divisao ? " selected" : "";
    return '<option value="' + sigla + '"' + selected + '>' + sigla + ' — ' + nome + '</option>';
  }).join("");

  if (usuarioEhGestorTrat()) {
    select.disabled = false;
    if (lockIcon) lockIcon.style.display = "none";
    if (label) {
      label.textContent = "🔓 Você é gestor — pode filtrar por qualquer divisão";
      label.style.color = "var(--accent-green)";
    }
  } else {
    select.disabled = true;
    if (lockIcon) lockIcon.style.display = "inline-flex";
    if (label) {
      label.textContent = "🔒 Filtro restrito a gestores autorizados";
      label.style.color = "var(--text-muted)";
    }
  }
}

function mudarDivisaoTratamento(novaDivisao) {
  if (!usuarioEhGestorTrat()) {
    showToast("Você não tem permissão para alterar a divisão.", "error");
    return;
  }
  if (!novaDivisao) return;

  // Muda a "divisão ativa" para carregar dados de outra divisão
  user.divisao = novaDivisao;   // temporário só nesta sessão
  showToast("Filtro alterado para: " + (NOMES_DIVISOES[novaDivisao] || novaDivisao), "success");
  tocarSom("click");

  processoAtualId = null;
  carregarProcessos();
  carregarRiscos();
  popularDropdownTratamento();

  const infoDiv = document.getElementById("registroInfo");
  const secTrat = document.getElementById("secTratamentos");
  const btnPDF  = document.getElementById("btnPDF");
  if (infoDiv) infoDiv.style.display = "none";
  if (secTrat) secTrat.style.display = "none";
  if (btnPDF)  btnPDF.disabled = true;

  atualizarKPIsTratamento();
  registrarLog("filtro_divisao_trat", null, "Filtrou tratamento para divisão " + novaDivisao);
}

console.log("=== DIAGNÓSTICO TRATAMENTO ===");
console.log("Total riscos carregados:", riscos.length);
console.log("Total processos:", processos.length);

// Ver quantos têm tratar=Sim
const comTratar = riscos.filter(r => String(r.tratar).toLowerCase() === "sim");
console.log("Riscos com tratar=Sim:", comTratar.length);

if (comTratar.length > 0) {
  console.log("Exemplo:", {
    id: comTratar[0].id,
    evento: comTratar[0].evento,
    tratar: comTratar[0].tratar,
    processoId: comTratar[0].processoId,
    tipoProcessoId: typeof comTratar[0].processoId
  });
}

// Ver processos
if (processos.length > 0) {
  console.log("Exemplo processo:", {
    id: processos[0].id,
    tipoId: typeof processos[0].id
  });
}

// Testa a função
if (comTratar.length > 0 && typeof processoTemTratamento === "function") {
  const procId = comTratar[0].processoId;
  console.log("processoTemTratamento(" + procId + "):", processoTemTratamento(procId));
}

// ============ VALIDAÇÃO DO CAMPO RESPONSÁVEL ============

/**
 * Valida em tempo real enquanto o usuário digita
 */
function validarCampoResponsavel(input) {
  if (!input) return;
  const valor = input.value.trim();

  // Remove mensagens antigas
  removerMensagemResponsavel(input);

  if (valor === "") {
    input.classList.remove("input-invalido");
    return;
  }

  // Valida
  const validacao = validarNomeResponsavel(valor);

  if (validacao.valido) {
    input.classList.remove("input-invalido");
    input.classList.add("input-valido");
    mostrarMensagemResponsavel(input, "✓ Nome válido", "sucesso");
  } else {
    input.classList.remove("input-valido");
    input.classList.add("input-invalido");
    mostrarMensagemResponsavel(input, validacao.mensagem, "erro");
  }
}

/**
 * Formata automaticamente quando sai do campo (blur)
 */
function formatarResponsavel(input) {
  if (!input || !input.value) return;

  const validacao = validarNomeResponsavel(input.value);
  if (validacao.valido) {
    // Auto-corrige capitalização
    input.value = validacao.nomeFormatado;
    validarCampoResponsavel(input);
  }
}

/**
 * Lógica de validação — retorna { valido, mensagem, nomeFormatado }
 */
function validarNomeResponsavel(bruto) {
  if (!bruto || !bruto.trim()) {
    return {
      valido: false,
      mensagem: "⚠️ Campo obrigatório"
    };
  }

  const limpo = String(bruto).trim().replace(/\s+/g, " ");

  // Bloqueia inválidos
  const inv = ["teste", "test", "asdf", "abc", "abcd", "xyz", "aaaa", "1234", "-", "n/a", "na"];
  if (inv.indexOf(limpo.toLowerCase()) >= 0) {
    return {
      valido: false,
      mensagem: "⚠️ Nome inválido — informe seu nome real"
    };
  }

  // Verifica se tem números
  if (/\d/.test(limpo)) {
    return {
      valido: false,
      mensagem: "⚠️ Nome não pode conter números"
    };
  }

  // Verifica caracteres especiais (permite acentos e espaços)
  if (!/^[a-zA-ZáéíóúâêîôûàèìòùãõçÁÉÍÓÚÂÊÎÔÛÀÈÌÒÙÃÕÇ\s]+$/.test(limpo)) {
    return {
      valido: false,
      mensagem: "⚠️ Use apenas letras"
    };
  }

  // Separa em palavras
  const preposicoes = ["de", "da", "do", "dos", "das", "e"];
  const partes = limpo.split(" ").filter(function(p) {
    return p.length >= 2 && preposicoes.indexOf(p.toLowerCase()) < 0;
  });

  // Precisa ter pelo menos 2 nomes (nome + sobrenome)
  if (partes.length < 2) {
    return {
      valido: false,
      mensagem: "⚠️ Informe nome E sobrenome (Ex: João Silva)"
    };
  }

  // Cada parte precisa ter pelo menos 2 letras
  const temPartesCurta = partes.some(function(p) { return p.length < 2; });
  if (temPartesCurta) {
    return {
      valido: false,
      mensagem: "⚠️ Cada nome deve ter no mínimo 2 letras"
    };
  }

  // Tudo OK! Formata capitalizando
  const capitalizado = limpo.split(" ").map(function(palavra) {
    if (preposicoes.indexOf(palavra.toLowerCase()) >= 0) {
      return palavra.toLowerCase();  // preposições em minúsculo
    }
    return palavra.charAt(0).toUpperCase() + palavra.slice(1).toLowerCase();
  }).join(" ");

  return {
    valido: true,
    mensagem: "✓ Nome válido",
    nomeFormatado: capitalizado
  };
}

/**
 * Mostra mensagem embaixo do input
 */
function mostrarMensagemResponsavel(input, mensagem, tipo) {
  removerMensagemResponsavel(input);

  const div = document.createElement("div");
  div.className = "msg-validacao msg-" + tipo;
  div.setAttribute("data-input-id", input.id);
  div.textContent = mensagem;

  input.parentNode.insertBefore(div, input.nextSibling);
}

/**
 * Remove mensagem existente
 */
function removerMensagemResponsavel(input) {
  const existente = input.parentNode.querySelector('[data-input-id="' + input.id + '"]');
  if (existente) existente.remove();
}

// ============ FILTRO DE DIVISÃO NO CARD (Tratamento) ============

function inicializarFiltroDivisaoCardTrat() {
  const filtro = document.getElementById("filtroDivisaoTrat");
  const status = document.getElementById("divisaoAtualLabelTrat");
  const cadeado = document.getElementById("divisaoLockIconTrat");
  const user = JSON.parse(sessionStorage.getItem("mapa_user") || "{}");

  if (!filtro) {
    console.warn("[Filtro Trat] Elemento #filtroDivisaoTrat não encontrado");
    return;
  }

  console.log("[Filtro Trat] Init. Gestor?", user.is_gestor, "| Divisão:", user.divisao);

  if (user.is_gestor) {
    filtro.disabled = false;
    filtro.value = user.divisao || "";

    if (status) {
      status.innerHTML = '<i class="bi bi-unlock"></i> Você é gestor — pode filtrar por qualquer divisão';
      status.style.color = "var(--accent-green, #3ad48a)";
    }
    if (cadeado) cadeado.style.display = "none";

    // 🎯 Ao trocar divisão, refiltra dropdown de processos
    filtro.onchange = function() {
      console.log("[Filtro Trat] Divisão mudou para:", this.value);
      processoAtualId = null;
      popularDropdownTratamento();
      selecionarProcessoTratamento(null);
    };

  } else {
    filtro.value = user.divisao || "";
    filtro.disabled = true;

    if (status) {
      status.innerHTML = '<i class="bi bi-lock-fill"></i> Restrito à sua divisão';
      status.style.color = "var(--accent-yellow, #f5c94a)";
    }
    if (cadeado) cadeado.style.display = "inline";
  }
}