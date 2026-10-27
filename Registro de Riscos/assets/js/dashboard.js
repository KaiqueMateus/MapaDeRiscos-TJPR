// ============================================================
//  MAPA / TJPR - Dashboard Executivo v4
//  - Painel Executivo no dashboard (Informações Gerais,
//    Indicadores de Risco, Matriz Final, Destaques, Nível Médio,
//    Média por Unidade e Distribuição por Faixa) no estilo
//    dos gráficos do dashboard.
//  - KPIs antigos (Total, Planos, Concluídos, Em Atraso) viram
//    dica de ferramenta no card "Riscos com plano de tratamento".
// ============================================================
console.log("[Dashboard] Script v4 carregado");

// ============================================================
// PALETA DOS GRAFICOS - SENSIVEL AO TEMA
// ============================================================
function temaAtualDashboard() {
  const t = document.documentElement.getAttribute("data-theme");
  return t === "light" ? "light" : "dark";
}

function coresGraficoTema() {
  const claro = temaAtualDashboard() === "light";
  return claro
    ? {
        texto:       "#12333f",
        tituloEixo:  "#0b6b78",
        tituloChart: "#0e2233",
        grid:        "rgba(16,58,72,0.13)",
        gridForte:   "rgba(16,58,72,0.20)",
        borda:       "rgba(16,58,72,0.20)",
        tooltipBg:   "rgba(12,40,52,0.96)",
        tooltipTxt:  "#ffffff",
        donutBorda:  "#ffffff",
        vazio:       "#5a7482"
      }
    : {
        texto:       "#e8f4f8",
        tituloEixo:  "#5fe3f5",
        tituloChart: "#ffffff",
        grid:        "rgba(255,255,255,0.10)",
        gridForte:   "rgba(255,255,255,0.16)",
        borda:       "rgba(255,255,255,0.18)",
        tooltipBg:   "rgba(10,32,42,0.97)",
        tooltipTxt:  "#ffffff",
        donutBorda:  "#122c40",
        vazio:       "#c2d6de"
      };
}

/** Bloco padrao de legenda, usado por todos os graficos. */
function legendaPadrao(posicao) {
  const C = coresGraficoTema();
  return {
    position: posicao || "bottom",
    labels: {
      usePointStyle: true,
      padding: 12,
      color: C.texto,
      font: { size: 12, weight: "600" }
    }
  };
}

/** Bloco padrao de tooltip. */
function tooltipPadrao(extra) {
  const C = coresGraficoTema();
  const base = {
    backgroundColor: C.tooltipBg,
    titleColor: C.tooltipTxt,
    bodyColor: C.tooltipTxt,
    borderColor: C.borda,
    borderWidth: 1,
    padding: 11,
    titleFont: { size: 13, weight: "700" },
    bodyFont: { size: 12.5 }
  };
  return extra ? Object.assign(base, extra) : base;
}

/** Titulo do grafico. */
function tituloGrafico(texto) {
  const C = coresGraficoTema();
  return {
    display: true,
    text: texto,
    color: C.tituloChart,
    font: { size: 14, weight: "700" },
    padding: { top: 2, bottom: 12 }
  };
}

/** Eixo com ticks e titulo em cor forte. */
function eixoPadrao(opcoes) {
  const C = coresGraficoTema();
  const o = opcoes || {};
  const eixo = {
    ticks: {
      color: C.texto,
      font: { size: 12, weight: "600" }
    },
    grid: {
      color: o.semGrid ? "transparent" : C.grid,
      display: o.semGrid ? false : true,
      drawBorder: true
    },
    border: { color: C.borda }
  };
  if (o.zero) eixo.beginAtZero = true;
  if (o.precisao) eixo.ticks.precision = 0;
  if (o.titulo) {
    eixo.title = {
      display: true,
      text: o.titulo,
      color: C.tituloEixo,
      font: { size: 12.5, weight: "700" }
    };
  }
  return eixo;
}

// ============ FILTROS INTERATIVOS TIPO POWER BI ============
const filtrosInterativos = {
  matrizNivel: null,
  faixaNivel: null,      // faixa do risco FINAL
  faixaInerente: null,   // faixa do risco INERENTE
  faixaResidual: null,   // faixa do risco RESIDUAL
  comPlano: null,        // somente riscos com Tratar = Sim
  opcao: null,
  divisao: null,
  responsavel: null,
  visao: null            // "Inerente" | "Residual" | "Final" (escolhido no velocimetro)
};

/** Visao escolhida no velocimetro em minusculo (inerente/residual/final) ou null. */
function visaoRiscoDash() {
  return filtrosInterativos.visao ? String(filtrosInterativos.visao).toLowerCase() : null;
}

/** Valor do risco conforme a visao escolhida no velocimetro.
 *  Sem visao: risco final nos tratados + residual nos demais. */
function valorVisaoDash(r) {
  const v = visaoRiscoDash();
  const inerente = (Number(r.prob) || 0) * (Number(r.imp) || 0);
  if (v === "inerente") return inerente;
  if (v === "residual") return inerente * (Number(r.nivelControle) || 1);
  return nivelFinalRegraDash(r);
}

function pexGaugeVisaoReset() {
  if (window.__pexGaugeEstado) window.__pexGaugeEstado.travado = false;
}

const MATRIZ_TJPR = {
  "1-5": 15, "2-5": 19, "3-5": 22, "4-5": 24, "5-5": 25,
  "1-4": 10, "2-4": 14, "3-4": 18, "4-4": 21, "5-4": 23,
  "1-3":  6, "2-3":  9, "3-3": 13, "4-3": 17, "5-3": 20,
  "1-2":  3, "2-2":  5, "3-2":  8, "4-2": 12, "5-2": 16,
  "1-1":  1, "2-1":  2, "3-1":  4, "4-1":  7, "5-1": 11
};

const IMPACTOS_MATRIZ_DASH = [
  { i: 5, label: "Muito Alto" },
  { i: 4, label: "Alto" },
  { i: 3, label: "Médio" },
  { i: 2, label: "Baixo" },
  { i: 1, label: "Muito Baixo" }
];

const PROBABILIDADES_MATRIZ_DASH = [
  { p: 1, label: "Raro" },
  { p: 2, label: "Pouco Provável" },
  { p: 3, label: "Provável" },
  { p: 4, label: "Muito Provável" },
  { p: 5, label: "Praticamente Certo" }
];

function limparFiltrosInterativos() {
  filtrosInterativos.matrizNivel = null;
  filtrosInterativos.faixaNivel = null;
  filtrosInterativos.faixaInerente = null;
  filtrosInterativos.faixaResidual = null;
  filtrosInterativos.comPlano = null;
  filtrosInterativos.opcao = null;
  filtrosInterativos.divisao = null;
  filtrosInterativos.responsavel = null;
  filtrosInterativos.visao = null;
  renderizarBarraFiltrosAtivos();
  atualizarTudo(true);
}

function alternarFiltro(chave, valor) {
  if (filtrosInterativos[chave] === valor) {
    filtrosInterativos[chave] = null;
  } else {
    filtrosInterativos[chave] = valor;
  }
  renderizarBarraFiltrosAtivos();
  atualizarTudo(true);
}

function aplicarFiltrosInterativos(dados) {
  if (!dados || !dados.todosRiscos) return dados;
  let riscos = dados.todosRiscos.slice();

  if (filtrosInterativos.divisao) {
    riscos = riscos.filter(function(r) {
      return r._divisao === filtrosInterativos.divisao;
    });
  }

  function chaveFaixa(txt) {
    return String(txt || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  if (filtrosInterativos.faixaNivel) {
    const alvo = chaveFaixa(filtrosInterativos.faixaNivel);
    riscos = riscos.filter(function(r) {
      // Mesma regra da Matriz Final: somente riscos tratados
      return riscoTratadoDash(r) && faixaFinalDash(r) === alvo;
    });
  }

  if (filtrosInterativos.faixaInerente) {
    const alvo = chaveFaixa(filtrosInterativos.faixaInerente);
    riscos = riscos.filter(function(r) {
      return classeMatrizDash((Number(r.prob) || 0) * (Number(r.imp) || 0)).faixa === alvo;
    });
  }

  if (filtrosInterativos.faixaResidual) {
    const alvo = chaveFaixa(filtrosInterativos.faixaResidual);
    riscos = riscos.filter(function(r) {
      const res = (Number(r.prob) || 0) * (Number(r.imp) || 0) * (Number(r.nivelControle) || 1);
      return classeMatrizDash(res).faixa === alvo;
    });
  }

  // Celula da matriz: mesma regra da Matriz de Risco Final (nivel final arredondado para baixo)
  if (filtrosInterativos.matrizNivel !== null) {
    riscos = riscos.filter(function(r) {
      return nivelCelulaMatrizDash(r) === filtrosInterativos.matrizNivel;
    });
  }

  if (filtrosInterativos.comPlano) {
    riscos = riscos.filter(function(r) {
      return riscoTratadoDash(r);
    });
  }

  // Velocimetro em "Final": painel mostra somente os riscos tratados
  if (visaoRiscoDash() === "final") {
    riscos = riscos.filter(function(r) { return riscoTratadoDash(r); });
  }

  // Mesma regra do grafico "Opcoes de Tratamento": so riscos que exigem
  // tratamento (residual ALTO; na DPP, ALTO ou MEDIO) e a opcao atual.
  if (filtrosInterativos.opcao) {
    riscos = riscos.filter(function(r) {
      if (!riscoEntraNasOpcoesDash(r)) return false;
      return opcaoAtualDash(r) === filtrosInterativos.opcao;
    });
  }

  if (filtrosInterativos.responsavel) {
    riscos = riscos.filter(function(r) {
      const etapas = obterEtapasDash(r);
      if (etapas.length === 0) return false;
      const trat = etapas[etapas.length - 1];
      const nome = normalizarNomeResponsavel(trat.responsavel || "");
      return nome === filtrosInterativos.responsavel;
    });
  }

  const procIds = new Set(riscos.map(function(r) { return String(r.processoId); }));
  const processos = dados.todosProcessos.filter(function(p) {
    return procIds.has(String(p.id));
  });

  return {
    todosRiscos: riscos,
    todosProcessos: processos
  };
}

/** Faixa do risco FINAL (baixo/medio/alto) - mesma regra da Matriz Final. */
function faixaFinalDash(r) {
  const n = nivelCelulaMatrizDash(r);
  if (n >= 20) return "alto";
  if (n >= 7) return "medio";
  return "baixo";
}

/** Faixa do risco RESIDUAL (prob x imp x controle). */
function faixaResidualDash(r) {
  const res = (Number(r.prob) || 0) * (Number(r.imp) || 0) * (Number(r.nivelControle) || 1);
  return classeMatrizDash(res).faixa;
}

/**
 * Riscos que entram em "Opcoes de Tratamento":
 *  - nivel residual ALTO (qualquer divisao);
 *  - DPP: nivel residual ALTO ou MEDIO.
 */
function riscoEntraNasOpcoesDash(r) {
  const faixa = faixaResidualDash(r);
  const div = String(r._divisao || "").trim().toUpperCase();
  if (faixa === "alto") return true;
  if (div === "DPP" && faixa === "medio") return true;
  return false;
}

// Mantem o nome antigo apontando para a regra nova (inclusive se outro
// script tentar sobrescrever depois que a pagina carregar).
window.obterNivelFinalDashboard = nivelFinalRegraDash;
document.addEventListener("DOMContentLoaded", function () {
  [500, 1500, 3000].forEach(function (t) {
    setTimeout(function () { window.obterNivelFinalDashboard = nivelFinalRegraDash; }, t);
  });
});

/**
 * Risco TRATADO = Tratar = Sim E exige tratamento
 * (residual ALTO; na DPP, residual MEDIO ou ALTO).
 * Somente estes usam o valor do plano como risco final.
 */
function riscoTratadoDash(r) {
  if (!r) return false;
  if (String(r.tratar || "").trim().toLowerCase() !== "sim") return false;
  return riscoEntraNasOpcoesDash(r);
}

/** Opcao de tratamento atual do risco (ultima etapa com opcao preenchida). */
function opcaoAtualDash(r) {
  const etapas = obterEtapasDash(r);
  for (let i = etapas.length - 1; i >= 0; i--) {
    if (etapas[i].opcao) {
      return etapas[i].opcao === "Transferir" ? "Compartilhar" : etapas[i].opcao;
    }
  }
  return null;
}

/** Nivel da celula da Matriz Final (1 a 25) em que o risco cai. */
function nivelCelulaMatrizDash(r) {
  return Math.max(1, Math.min(25, Math.floor(Number(valorVisaoDash(r)) || 0)));
}

const NOMES_DIVISOES_DASH = {
  "DPROC":"Divisao de Processamento","DC":"Divisao de Calculos",
  "DPP":"Divisao de Pagamento de Precatorios","CJ":"Consultoria Juridica",
  "AA":"Assessoria de Atendimento","AT":"Assessoria Tecnica",
  "DCGA":"Divisao de Controle e Gestao de Aportes"
};

let chartsAtivos = {};

// ############################################################
// #   FILTRO POR PROCESSO (dropdown multi-selecao)            #
// ############################################################
let processosSelecionadosDashboard = new Set();
let processosDisponiveisDashboard = [];

const CORES_DIVISAO_DASH = {
  DPROC: "#1f4e8c",
  DC:    "#7e57c2",
  DPP:   "#00796b",
  CJ:    "#8e2b45",
  AA:    "#d4700f",
  AT:    "#0e9aa7",
  DCGA:  "#2c74b3"
};

function corDivisaoDash(sigla) {
  return CORES_DIVISAO_DASH[String(sigla || "").trim().toUpperCase()] || "#5a6b7a";
}

function divisaoDoProcessoDash(p) {
  if (!p) return "";
  return String(p._divisao || p.divisao || p.divisao_sigla || p.divisaoSigla || "")
    .trim().toUpperCase();
}

function garantirEstilosFiltroProcesso() {
  if (document.getElementById("estilosFiltroProcessoDash")) return;
  const style = document.createElement("style");
  style.id = "estilosFiltroProcessoDash";
  style.textContent = `
  .proc-filter-dash{
    background:var(--card-bg,#fff);
    border:1px solid rgba(14,154,167,.22);
    border-radius:14px;
    padding:16px 20px;
    margin:12px 0;
  }
  .proc-filter-dash-head{
    display:flex;align-items:center;justify-content:space-between;
    gap:12px;flex-wrap:wrap;margin-bottom:4px;
  }
  .proc-filter-dash-title{
    display:flex;align-items:center;gap:8px;
    font-size:15px;font-weight:800;color:#0e9aa7;
  }
  .proc-filter-dash-sub{
    font-size:12px;color:var(--text-muted,#8395a1);margin-bottom:11px;
  }
  .proc-dd-wrap{position:relative;width:100%}
  .proc-dd-btn{
    width:100%;min-height:46px;
    display:flex;align-items:center;justify-content:space-between;gap:12px;
    background:var(--card-bg,#fff);
    border:1.5px solid rgba(14,154,167,.34);
    border-radius:10px;
    padding:11px 15px;
    font-size:13.5px;font-weight:600;
    color:var(--text-primary,#1a2b3d);
    cursor:pointer;text-align:left;
    transition:.18s ease;
  }
  html:not([data-theme="light"]) .proc-dd-btn{color:#e6f1f5}
  .proc-dd-btn:hover,.proc-dd-btn.aberto{
    border-color:#0e9aa7;
    box-shadow:0 0 0 3px rgba(14,154,167,.12);
  }
  .proc-dd-btn i{color:#0e9aa7;transition:transform .2s ease}
  .proc-dd-btn.aberto i.chev{transform:rotate(180deg)}
  .proc-dd-resumo{
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;
  }
  .proc-dd-menu{
    position:absolute;z-index:4000;left:0;right:0;top:calc(100% + 6px);
    background:var(--card-bg,#fff);
    border:1px solid rgba(14,154,167,.35);
    border-radius:12px;
    box-shadow:0 16px 38px rgba(15,40,60,.20);
    padding:10px;
    max-height:330px;overflow-y:auto;
  }
  .proc-dd-acoes{
    display:flex;gap:8px;padding:2px 2px 10px;
    border-bottom:1px solid var(--border-color,#e5edf1);
    margin-bottom:6px;position:sticky;top:-10px;
    background:var(--card-bg,#fff);z-index:2;
  }
  .proc-dd-acao{
    border:1px solid rgba(14,154,167,.3);
    background:rgba(14,154,167,.09);
    color:#0e9aa7;border-radius:8px;
    padding:6px 13px;font-size:12px;font-weight:700;
    cursor:pointer;transition:.15s ease;
  }
  .proc-dd-acao:hover{background:rgba(14,154,167,.2)}
  .proc-dd-acao.danger{
    border-color:rgba(224,90,90,.35);
    background:rgba(224,90,90,.09);color:#c04040;
  }
  .proc-dd-acao.danger:hover{background:rgba(224,90,90,.2)}
  .proc-dd-item{
    display:flex;align-items:flex-start;gap:11px;
    padding:9px 10px;border-radius:8px;cursor:pointer;
    transition:.13s ease;
  }
  .proc-dd-item:hover{background:rgba(14,154,167,.08)}
  .proc-dd-item input[type="checkbox"]{
    margin-top:2px;flex-shrink:0;
    -webkit-appearance:none;appearance:none;
    width:18px;height:18px;
    border:2px solid rgba(120,190,205,.8);
    border-radius:5px;
    background:rgba(255,255,255,.06);
    cursor:pointer;position:relative;transition:.15s ease;
  }
  .proc-dd-item input[type="checkbox"]:hover{border-color:#0e9aa7}
  .proc-dd-item input[type="checkbox"]:checked{
    background:#0e9aa7;border-color:#0e9aa7;
  }
  .proc-dd-item input[type="checkbox"]:checked::after{
    content:"";position:absolute;
    left:5px;top:1px;width:5px;height:10px;
    border:solid #fff;border-width:0 2.5px 2.5px 0;
    transform:rotate(45deg);
  }
  html[data-theme="light"] .proc-dd-item input[type="checkbox"]{
    border-color:rgba(14,154,167,.55);background:#fff;
  }
  html[data-theme="light"] .proc-dd-item input[type="checkbox"]:checked{
    background:#0e9aa7 !important;border-color:#0e9aa7 !important;
  }
  html[data-theme="light"] .proc-dd-item input[type="checkbox"]:checked::after{
    content:"";position:absolute;left:5px;top:1px;width:5px;height:10px;
    border:solid #fff;border-width:0 2.5px 2.5px 0;
    transform:rotate(45deg);opacity:1;
  }
  .proc-dd-texto{min-width:0;flex:1}
  .proc-dd-nome{
    font-size:13px;font-weight:700;line-height:1.35;
    color:var(--text-primary,#1a2b3d);
    word-break:break-word;
  }
  html:not([data-theme="light"]) .proc-dd-nome{color:#e6f1f5}
  .proc-dd-meta{
    font-size:11px;font-weight:600;margin-top:2px;
    color:var(--text-muted,#8395a1);
    display:flex;align-items:center;gap:6px;
  }
  .proc-dd-sigla{
    display:inline-block;color:#fff;font-weight:800;
    font-size:9.5px;padding:1px 7px;border-radius:8px;
    background:#5a6b7a;letter-spacing:.3px;
  }
  .proc-dd-vazio{
    padding:16px;text-align:center;font-size:12.5px;
    color:var(--text-muted,#8395a1);
  }
  .proc-filter-dash-resumo{
    margin-top:11px;font-size:12px;color:var(--text-muted,#8395a1);
  }
  `;
  document.head.appendChild(style);
}

function montarFiltroProcessosDashboard() {
  if (document.getElementById("procDropdownDashboard")) return true;
  garantirEstilosFiltroProcesso();

  const chipsDiv =
    document.getElementById("chipsDivisoes") ||
    document.querySelector(".divisao-filter-multi");
  if (!chipsDiv) return false;

  const cardDivisoes =
    chipsDiv.closest(".divisao-filter-multi, .filtro-card, .card-filtro, .dash-card, .card, section") ||
    chipsDiv.parentElement;
  if (!cardDivisoes || !cardDivisoes.parentNode) return false;

  const box = document.createElement("div");
  box.id = "filtroProcessosDashboard";
  box.className = "proc-filter-dash";
  box.innerHTML =
    '<div class="proc-filter-dash-head">' +
      '<span class="proc-filter-dash-title">' +
        '<i class="bi bi-folder2-open"></i> Processos de Trabalho' +
      '</span>' +
    '</div>' +
    '<div class="proc-filter-dash-sub">' +
      'Filtre todos os indicadores por processo de trabalho' +
    '</div>' +
    '<div class="proc-dd-wrap">' +
      '<button type="button" id="procDropdownDashboard" class="proc-dd-btn" ' +
              'onclick="toggleDropdownProcessosDashboard(event)">' +
        '<span id="procDropdownResumo" class="proc-dd-resumo">Todos os processos</span>' +
        '<i class="bi bi-chevron-down chev"></i>' +
      '</button>' +
      '<div id="procDropdownMenu" class="proc-dd-menu" style="display:none;"></div>' +
    '</div>' +
    '<div id="resumoProcessosDashboard" class="proc-filter-dash-resumo"></div>';

  cardDivisoes.parentNode.insertBefore(box, cardDivisoes.nextSibling);
  return true;
}

function toggleDropdownProcessosDashboard(ev) {
  if (ev) ev.stopPropagation();
  const menu = document.getElementById("procDropdownMenu");
  const btn  = document.getElementById("procDropdownDashboard");
  if (!menu || !btn) return;
  const abrir = menu.style.display === "none";
  menu.style.display = abrir ? "block" : "none";
  btn.classList.toggle("aberto", abrir);
}

document.addEventListener("click", function (e) {
  const alvo = e.target;
  if (!alvo || !alvo.closest) return;
  if (!document.body.contains(alvo)) return;
  if (alvo.closest(".proc-dd-wrap")) return;
  const menu = document.getElementById("procDropdownMenu");
  const btn  = document.getElementById("procDropdownDashboard");
  if (menu) menu.style.display = "none";
  if (btn)  btn.classList.remove("aberto");
});

function sincronizarProcessosDisponiveis(dados) {
  if (!dados) return;
  const processos = dados.todosProcessos || [];
  const riscos    = dados.todosRiscos || [];

  const contagem = {};
  riscos.forEach(function(r) {
    const k = String(r.processoId);
    contagem[k] = (contagem[k] || 0) + 1;
  });

  processosDisponiveisDashboard = processos
    .map(function(p) {
      return {
        id: String(p.id),
        nome: p.processo || "Processo sem nome",
        divisao: divisaoDoProcessoDash(p),
        qtd: contagem[String(p.id)] || 0
      };
    })
    .filter(function(p) { return p.qtd > 0; })
    .sort(function(a, b) {
      if (a.divisao !== b.divisao) {
        return a.divisao.localeCompare(b.divisao, "pt-BR");
      }
      return a.nome.localeCompare(b.nome, "pt-BR");
    });

  const validos = new Set(processosDisponiveisDashboard.map(function(p) { return p.id; }));
  const disponiveisAntes = _totalDisponivelAnterior;
  const estavaTudoMarcado =
    _filtroProcessoIniciado &&
    disponiveisAntes > 0 &&
    processosSelecionadosDashboard.size === disponiveisAntes;

  Array.from(processosSelecionadosDashboard).forEach(function(id) {
    if (!validos.has(id)) processosSelecionadosDashboard.delete(id);
  });

  const temDisponiveis = processosDisponiveisDashboard.length > 0;
  const selecaoVazia   = processosSelecionadosDashboard.size === 0;

  const deveMarcarTudo =
    !_filtroProcessoIniciado ||
    (selecaoVazia && temDisponiveis && !_limpezaManualProcessos) ||
    estavaTudoMarcado;

  if (deveMarcarTudo) {
    processosDisponiveisDashboard.forEach(function(p) {
      processosSelecionadosDashboard.add(p.id);
    });
    if (processosSelecionadosDashboard.size > 0) {
      _limpezaManualProcessos = false;
    }
  }

  _filtroProcessoIniciado = true;
  _totalDisponivelAnterior = processosDisponiveisDashboard.length;
  salvarSelecaoProcessos();
}

let _filtroProcessoIniciado   = false;
let _totalDisponivelAnterior  = 0;
let _limpezaManualProcessos   = false;

const CHAVE_SELECAO_PROCESSOS = "mapa_dash_processos";

function salvarSelecaoProcessos() {
  try {
    if (processosSelecionadosDashboard.size === 0) {
      sessionStorage.removeItem(CHAVE_SELECAO_PROCESSOS);
      return;
    }
    sessionStorage.setItem(
      CHAVE_SELECAO_PROCESSOS,
      JSON.stringify(Array.from(processosSelecionadosDashboard))
    );
  } catch (e) {}
}

function restaurarSelecaoProcessos() {
  try {
    const raw = sessionStorage.getItem(CHAVE_SELECAO_PROCESSOS);
    if (!raw) return;
    const ids = JSON.parse(raw);
    if (!Array.isArray(ids) || !ids.length) return;
    processosSelecionadosDashboard.clear();
    ids.forEach(function(id) {
      processosSelecionadosDashboard.add(String(id));
    });
    _filtroProcessoIniciado = true;
    _totalDisponivelAnterior = 0;
    console.log("[Dashboard] Seleção de processos restaurada:", ids.length);
  } catch (e) {}
}

function atualizarResumosProcesso() {
  const resumoB = document.getElementById("procDropdownResumo");
  const resumo  = document.getElementById("resumoProcessosDashboard");
  const sel = processosSelecionadosDashboard.size;
  const tot = processosDisponiveisDashboard.length;

  if (resumoB) {
    if (sel === 0) {
      resumoB.textContent = "Nenhum processo selecionado";
    } else if (sel === tot) {
      resumoB.textContent = "Todos os processos (" + tot + ")";
    } else if (sel === 1) {
      const p = processosDisponiveisDashboard.find(function(x) {
        return processosSelecionadosDashboard.has(x.id);
      });
      resumoB.textContent = p ? p.nome : "1 processo selecionado";
    } else {
      resumoB.textContent = sel + " processos selecionados";
    }
  }

  if (resumo) {
    if (sel === 0) {
      resumo.innerHTML =
        '<span style="color:#c04040;font-weight:700;">' +
          '⚠️ Nenhum processo selecionado — nenhum dado exibido</span>';
    } else if (sel === tot) {
      resumo.innerHTML =
        'Processos: <strong>Todos</strong> ' +
        '<span style="opacity:.75;">(' + tot + ')</span>';
    } else {
      const nomes = processosDisponiveisDashboard
        .filter(function(p) { return processosSelecionadosDashboard.has(p.id); })
        .map(function(p) { return p.nome; });
      resumo.innerHTML =
        'Processos: <strong>' + sel + ' de ' + tot + '</strong> — ' +
        esc(nomes.slice(0, 3).join(", ")) +
        (nomes.length > 3 ? " e mais " + (nomes.length - 3) : "");
    }
  }
}

function _assinaturaListaProcessos() {
  return processosDisponiveisDashboard
    .map(function(p) { return p.id + ":" + p.qtd; })
    .join("|");
}
let _assinaturaListaAnterior = null;

function renderizarChipsProcessosDashboard(forcar) {
  const menu = document.getElementById("procDropdownMenu");
  if (!menu) return;

  const tot = processosDisponiveisDashboard.length;

  const assinatura = _assinaturaListaProcessos();
  const mudouLista = forcar === true || assinatura !== _assinaturaListaAnterior;

  if (!mudouLista) {
    processosDisponiveisDashboard.forEach(function(p) {
      const cb = menu.querySelector('input[data-proc-id="' + p.id + '"]');
      if (cb) cb.checked = processosSelecionadosDashboard.has(p.id);
    });
    atualizarResumosProcesso();
    return;
  }
  _assinaturaListaAnterior = assinatura;

  if (!tot) {
    menu.innerHTML =
      '<div class="proc-dd-vazio">Nenhum processo com risco nos filtros atuais.</div>';
  } else {
    const acoes =
      '<div class="proc-dd-acoes">' +
        '<button type="button" class="proc-dd-acao" ' +
                'onclick="selecionarTodosProcessosDashboard(true)">Selecionar todos</button>' +
        '<button type="button" class="proc-dd-acao danger" ' +
                'onclick="selecionarTodosProcessosDashboard(false)">Limpar</button>' +
      '</div>';

    const itens = processosDisponiveisDashboard.map(function(p) {
      const marcado = processosSelecionadosDashboard.has(p.id);
      const cor = corDivisaoDash(p.divisao);
      return '<label class="proc-dd-item" ' +
                    'onclick="event.stopPropagation()">' +
               '<input type="checkbox" data-proc-id="' + p.id + '" ' +
                      (marcado ? "checked " : "") +
                      'onchange="alternarProcessoDashboard(\'' + p.id + '\')">' +
               '<span class="proc-dd-texto">' +
                 '<span class="proc-dd-nome">' + esc(p.nome) + '</span>' +
                 '<span class="proc-dd-meta">' +
                   '<span class="proc-dd-sigla" style="background:' + cor + ';">' +
                     esc(p.divisao) + '</span>' +
                   p.qtd + ' risco(s)' +
                 '</span>' +
               '</span>' +
             '</label>';
    }).join("");

    menu.innerHTML = acoes + itens;
  }

  atualizarResumosProcesso();
}

function alternarProcessoDashboard(id) {
  id = String(id);
  if (processosSelecionadosDashboard.has(id)) {
    processosSelecionadosDashboard.delete(id);
  } else {
    processosSelecionadosDashboard.add(id);
  }
  _limpezaManualProcessos = processosSelecionadosDashboard.size === 0;
  _filtroProcessoIniciado = true;
  _totalDisponivelAnterior = processosDisponiveisDashboard.length;
  salvarSelecaoProcessos();
  atualizarResumosProcesso();
  atualizarTudo(true);
}

/**
 * Clique em grafico/cartao de processo: mostra SOMENTE aquele processo.
 * Clicar de novo no mesmo processo volta a mostrar todos.
 */
function filtrarSomenteProcessoDashboard(id) {
  id = String(id);
  const jaSozinho =
    processosSelecionadosDashboard.size === 1 && processosSelecionadosDashboard.has(id);
  processosSelecionadosDashboard.clear();
  if (jaSozinho) {
    processosDisponiveisDashboard.forEach(function(p) { processosSelecionadosDashboard.add(p.id); });
  } else {
    processosSelecionadosDashboard.add(id);
  }
  _limpezaManualProcessos = false;
  _filtroProcessoIniciado = true;
  _totalDisponivelAnterior = processosDisponiveisDashboard.length;
  salvarSelecaoProcessos();
  const menu = document.getElementById("procDropdownMenu");
  if (menu) {
    processosDisponiveisDashboard.forEach(function(p) {
      const cb = menu.querySelector('input[data-proc-id="' + p.id + '"]');
      if (cb) cb.checked = processosSelecionadosDashboard.has(p.id);
    });
  }
  atualizarResumosProcesso();
  atualizarTudo(true);
}

function selecionarTodosProcessosDashboard(marcar) {
  processosSelecionadosDashboard.clear();
  if (marcar) {
    processosDisponiveisDashboard.forEach(function(p) {
      processosSelecionadosDashboard.add(p.id);
    });
  }
  _limpezaManualProcessos = !marcar;
  _filtroProcessoIniciado = true;
  _totalDisponivelAnterior = processosDisponiveisDashboard.length;
  salvarSelecaoProcessos();

  const menu = document.getElementById("procDropdownMenu");
  if (menu) {
    processosDisponiveisDashboard.forEach(function(p) {
      const cb = menu.querySelector('input[data-proc-id="' + p.id + '"]');
      if (cb) cb.checked = processosSelecionadosDashboard.has(p.id);
    });
  }
  atualizarResumosProcesso();
  atualizarTudo(true);
}

function filtrarDadosPorProcesso(dados) {
  if (!dados) return dados;
  if (processosSelecionadosDashboard.size === 0) {
    return { todosProcessos: [], todosRiscos: [] };
  }
  const riscos = (dados.todosRiscos || []).filter(function(r) {
    return processosSelecionadosDashboard.has(String(r.processoId));
  });
  const ids = new Set(riscos.map(function(r) { return String(r.processoId); }));
  const processos = (dados.todosProcessos || []).filter(function(p) {
    return ids.has(String(p.id));
  });
  return { todosProcessos: processos, todosRiscos: riscos };
}

// ============ AGREGA DADOS ============
async function agregar() {
  if (window.sb && typeof sbCarregarDadosDashboard === "function") {
    return await sbCarregarDadosDashboard();
  }
  console.warn("[Dashboard] Supabase indisponível, usando localStorage");
  const todosProcessos = [];
  const todosRiscos = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith("processos_")) {
      const div = key.replace("processos_", "");
      try {
        const arr = JSON.parse(localStorage.getItem(key)) || [];
        arr.forEach(p => {
          p._divisao = div;
          todosProcessos.push(p);
        });
      } catch (e) {}
    } else if (key.startsWith("riscos_")) {
      const div = key.replace("riscos_", "");
      try {
        const arr = JSON.parse(localStorage.getItem(key)) || [];
        arr.forEach(r => {
          r._divisao = div;
          todosRiscos.push(r);
        });
      } catch (e) {}
    }
  }
  return { todosProcessos, todosRiscos };
}

// ============ STATUS ============
function calcularStatusTratamentoDash(risco) {
  const trat = risco.tratamento || {};
  if (!trat.opcao || !trat.descricao) return "pendente";
  if (trat.concluido) return "concluido";
  if (trat.prazo) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataPrazo = new Date(trat.prazo + "T00:00:00");
    if (dataPrazo < hoje) return "atraso";
  }
  return "planejado";
}

// ============ INIT ============
document.addEventListener("DOMContentLoaded", function() {
  setTimeout(async function() {
    configurarChartJs();
    observarTrocaDeTema();
    popularFiltroAno();
    setarMesAtual();

    renderizarFiltroMultiDivisao(function() {
      invalidarCacheDashboard();
      atualizarTudo();
    });

    inicializarFiltroMesAnoDashboard();
    verificarConflitoDashboard();

    restaurarSelecaoProcessos();
    montarFiltroProcessosDashboard();

    await atualizarTudo();

    setInterval(function() { invalidarCacheDashboard(); atualizarTudo(); }, 30000);
  }, 300);
});

function configurarChartJs() {
  if (typeof Chart === "undefined") return;
  const C = coresGraficoTema();
  Chart.defaults.color = C.texto;
  Chart.defaults.borderColor = C.grid;
  Chart.defaults.font.family = "'Segoe UI', Tahoma, sans-serif";
  Chart.defaults.font.size = 12;
  Chart.defaults.font.weight = "600";
  Chart.defaults.responsive = true;
  Chart.defaults.maintainAspectRatio = false;
  if (Chart.defaults.plugins) {
    if (Chart.defaults.plugins.legend && Chart.defaults.plugins.legend.labels) {
      Chart.defaults.plugins.legend.labels.color = C.texto;
    }
    if (Chart.defaults.plugins.title) {
      Chart.defaults.plugins.title.color = C.tituloChart;
    }
  }
}

function observarTrocaDeTema() {
  if (window._observerTemaDashboard) return;
  const obs = new MutationObserver(function(mutacoes) {
    const mudouTema = mutacoes.some(function(m) {
      return m.attributeName === "data-theme";
    });
    if (!mudouTema) return;
    configurarChartJs();
    if (typeof atualizarTudo === "function") atualizarTudo(true);
  });
  obs.observe(document.documentElement, { attributes: true });
  window._observerTemaDashboard = obs;
}

function popularFiltroAno() {
  const sel = document.getElementById("filterYear");
  if (!sel) return;
  const atual = new Date().getFullYear();
  for (let y = atual + 1; y >= 2024; y--) {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    if (y === atual) opt.selected = true;
    sel.appendChild(opt);
  }
}

function setarMesAtual() {
  const sel = document.getElementById("filterMonth");
  if (sel) sel.value = new Date().getMonth();
}

// ============================================================
// CACHE + TRAVA CONTRA BUSCAS CONCORRENTES
// ============================================================
let _cacheDadosBrutos = null;
let _execucaoAtual = 0;

function invalidarCacheDashboard() {
  _cacheDadosBrutos = null;
  _limpezaManualProcessos = false;
}

function verificarConflitoDashboard() {
  if (window._conflitoVerificado) return;
  window._conflitoVerificado = true;

  let neutralizou = false;

  if (typeof window.aplicarFiltrosInterativos === "function" &&
      window.aplicarFiltrosInterativos.__ajusteV1) {
    window.aplicarFiltrosInterativos = aplicarFiltrosInterativos;
    neutralizou = true;
  }
  if (typeof window.atualizarTudo === "function" &&
      window.atualizarTudo.__ajusteV1) {
    window.atualizarTudo = atualizarTudo;
    neutralizou = true;
  }
  const duplicado = document.getElementById("filtroProcessosDash");
  if (duplicado) {
    duplicado.remove();
    neutralizou = true;
  }
  if (typeof window.alternarProcessoDash === "function") {
    window.alternarProcessoDash = function () {};
    neutralizou = true;
  }
  if (typeof window.selecionarTodosProcessosDash === "function") {
    window.selecionarTodosProcessosDash = function () {};
  }

  if (neutralizou) {
    console.warn(
      "%c[Dashboard] dashboard-ajustes-v1.js NEUTRALIZADO",
      "background:#d47116;color:#fff;padding:2px 8px;border-radius:4px;font-weight:700;"
    );
    console.warn(
      "Aquele arquivo criava um SEGUNDO filtro de processos, que " +
      "travava os KPIs no primeiro valor.\n" +
      "Tudo o que ele fazia já está neste dashboard.js.\n" +
      "👉 Remova a linha <script src=\".../dashboard-ajustes-v1.js\"> do HTML."
    );
  }
}

async function atualizarTudo(usarCache) {
  verificarConflitoDashboard();
  const execucao = ++_execucaoAtual;
  let dados;

  if (usarCache === true && _cacheDadosBrutos) {
    dados = {
      todosProcessos: _cacheDadosBrutos.todosProcessos.slice(),
      todosRiscos: _cacheDadosBrutos.todosRiscos.slice()
    };
  } else {
    console.log("[Dashboard] Buscando dados...");
    dados = await agregar();
    if (execucao !== _execucaoAtual) {
      console.log("[Dashboard] Resposta descartada (execução antiga).");
      return;
    }
    _cacheDadosBrutos = {
      todosProcessos: (dados.todosProcessos || []).slice(),
      todosRiscos: (dados.todosRiscos || []).slice()
    };
  }

  dados = adicionarDataReferencia(dados);
  dados = filtrarDadosPorMesAno(dados);

  montarFiltroProcessosDashboard();
  sincronizarProcessosDisponiveis(dados);
  renderizarChipsProcessosDashboard();

  dados = filtrarDadosPorProcesso(dados);
  dados = aplicarFiltrosInterativos(dados);

  window._dadosDashboardAtual = dados;

  renderizarBarraFiltrosAtivos();
  atualizarKPIs(dados);
  renderizarTermometro(dados);
  renderizarPainelExecutivoDash();      // 🆕 substitui a matriz antiga
  renderizarTopRiscos(dados);
  renderizarTopResidual(dados);
  renderizarPorDivisao(dados);
  renderizarOpcoes(dados);
  renderizarNivel(dados);
  ocultarCardsFinaisDashboard();   // Vencendo em 7 dias, Top Responsaveis, Eficiencia Global
  renderizarStreak(dados);
}

// ============================================================
// OCULTA os 3 ultimos cards: Vencendo em 7 dias, Top Responsaveis
// e Eficiencia Global (o HTML continua igual; so ficam escondidos)
// ============================================================
function ocultarCardsFinaisDashboard() {
  const ids = ["listaVencendo", "listaResponsaveis", "eficienciaContainer"];
  const els = ids.map(function(id) { return document.getElementById(id); })
    .filter(function(el) { return !!el; });
  if (!els.length) return;

  const outros = ["chartTopRiscos", "chartTopResidual", "chartDivisoes", "chartOpcoes",
    "chartNivel", "pexMeioDash", "pexTopoDash"];
  function contemOutro(el) {
    return outros.some(function(id) {
      const o = document.getElementById(id);
      return o && el.contains(o);
    });
  }

  // 1) Se os 3 estao numa mesma linha exclusiva deles, oculta a linha inteira
  let comum = els[0];
  while (comum && !els.every(function(e) { return comum.contains(e); })) comum = comum.parentElement;
  if (comum && comum !== document.body && !contemOutro(comum) && els.length === ids.length) {
    comum.style.display = "none";
    return;
  }

  // 2) Senao, oculta card a card
  els.forEach(function(el) {
    let card = el.closest(".card, .dash-card, .chart-card, .panel, .lista-card, section") || el.parentElement;
    if (card && contemOutro(card)) card = el.parentElement;
    if (card) card.style.display = "none";
  });
}

// Os elementos dos 4 KPIs antigos continuam no HTML (escondidos);
// os valores sao atualizados e tambem vao para a dica de ferramenta.
function atualizarKPIs(dados) {
  const total = dados.todosRiscos.length;
  let atrasos = 0, planos = 0, concluidos = 0;

  dados.todosRiscos.forEach(function(r) {
    if (!riscoTratadoDash(r)) return;
    planos++;

    const etapas = obterEtapasDash(r);
    if (etapas.length === 0) return;

    const temPlanoPreenchido = etapas.some(function(et) {
      return et.opcao && et.descricao;
    });
    if (!temPlanoPreenchido) return;

    const etapaAtual = etapas[etapas.length - 1];
    let estaEmAtraso = false;
    if (etapaAtual && !etapaAtual.concluido && etapaAtual.prazo && etapaAtual.opcao) {
      const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
      const dp = new Date(etapaAtual.prazo + "T00:00:00");
      if (dp < hoje) estaEmAtraso = true;
    }

    if (estaEmAtraso) atrasos++;
    else concluidos++;
  });

  window._kpisPlanosDash = { total: total, planos: planos, concluidos: concluidos, atraso: atrasos };

  animarKpi("kpiTotalRiscos", total);
  animarKpi("kpiPlanos", planos);
  animarKpi("kpiConcluidos", concluidos);
  animarKpi("kpiEmAtraso", atrasos);

  const cardAtraso = document.getElementById("kpiCardAtraso");
  if (cardAtraso) {
    if (atrasos > 0) cardAtraso.classList.add("kpi-alerta");
    else cardAtraso.classList.remove("kpi-alerta");
  }
}

const _animacoesKpi = {};

function animarKpi(id, alvo) {
  const el = document.getElementById(id);
  if (!el) return;
  alvo = Number(alvo) || 0;

  if (!_animacoesKpi[id] && parseInt(el.textContent, 10) === alvo) return;

  if (_animacoesKpi[id]) {
    cancelAnimationFrame(_animacoesKpi[id].raf);
  }

  const atual = parseInt(el.textContent, 10) || 0;
  const dur = 500;
  const inicio = performance.now();
  _animacoesKpi[id] = { raf: 0, alvo: alvo };

  function step(agora) {
    if (!_animacoesKpi[id] || _animacoesKpi[id].alvo !== alvo) return;
    const t = Math.min((agora - inicio) / dur, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(atual + (alvo - atual) * eased);
    if (t < 1) {
      _animacoesKpi[id].raf = requestAnimationFrame(step);
    } else {
      el.textContent = alvo;
      delete _animacoesKpi[id];
    }
  }
  _animacoesKpi[id].raf = requestAnimationFrame(step);
}

// ============ TIMELINE ============
function renderizarTimeline(dados) {
  const ctx = document.getElementById("chartTimeline");
  if (!ctx || !dados) return;

  const mesEl = document.getElementById("filterMonth");
  const anoEl = document.getElementById("filterYear");
  const mes = mesEl ? parseInt(mesEl.value) : new Date().getMonth();
  const ano = anoEl ? parseInt(anoEl.value) : new Date().getFullYear();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();

  const labels = [], planejados = [], concluidos = [], atrasados = [];
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);

  for (let d = 1; d <= diasNoMes; d++) {
    labels.push(String(d).padStart(2, "0"));
    let p = 0, c = 0, a = 0;
    dados.todosRiscos.forEach(function(r) {
      const etapas = obterEtapasDash(r);
      etapas.forEach(function(et) {
        if (!et.prazo) return;
        const dp = new Date(et.prazo + "T00:00:00");
        if (dp.getFullYear() === ano && dp.getMonth() === mes && dp.getDate() === d) {
          if (et.concluido) c++;
          else if (dp < hoje) a++;
          else p++;
        }
      });
    });
    planejados.push(p);
    concluidos.push(c);
    atrasados.push(a);
  }

  destruirChart("timeline");
  chartsAtivos.timeline = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        { label: "Planejado", data: planejados, borderColor: "#4a90d9",
          backgroundColor: "rgba(74,144,217,0.2)", tension: 0.35, fill: true,
          borderWidth: 3, pointRadius: 4 },
        { label: "Concluido", data: concluidos, borderColor: "#3ad48a",
          backgroundColor: "rgba(58,212,138,0.2)", tension: 0.35, fill: true,
          borderWidth: 3, pointRadius: 4 },
        { label: "Em Atraso", data: atrasados, borderColor: "#e05a5a",
          backgroundColor: "rgba(224,90,90,0.2)", tension: 0.35, fill: true,
          borderWidth: 3, pointRadius: 4 }
      ]
    },
    options: {
      interaction: { intersect: false, mode: "index" },
      plugins: {
        legend: legendaPadrao("top"),
        tooltip: tooltipPadrao()
      },
      scales: {
        x: eixoPadrao({ titulo: "Dia do Mês" }),
        y: eixoPadrao({ zero: true, precisao: true, titulo: "Quantidade" })
      }
    }
  });
}

// ============ TOP 5 MAIS RISCOS ============
function renderizarTopRiscos(dados) {
  const ctx = document.getElementById("chartTopRiscos");
  if (!ctx) return;

  const contagem = {};
  dados.todosProcessos.forEach(function(p) {
    const chave = p._divisao + "|" + p.id;
    contagem[chave] = { processo: p.processo || "?", divisao: p._divisao, total: 0, id: p.id };
  });
  dados.todosRiscos.forEach(function(r) {
    const chave = r._divisao + "|" + r.processoId;
    if (contagem[chave]) contagem[chave].total++;
  });

  const top5 = Object.values(contagem).sort(function(a, b) { return b.total - a.total; }).slice(0, 5);

  destruirChart("topRiscos");
  if (top5.length === 0) return;

  chartsAtivos.topRiscos = new Chart(ctx, {
    type: "bar",
    data: {
      labels: top5.map(function(x) { return truncar(x.processo, 25) + " (" + x.divisao + ")"; }),
      datasets: [{
        label: "Riscos",
        data: top5.map(function(x) { return x.total; }),
        backgroundColor: ["#4dd0e1", "#3ad48a", "#f5c94a", "#e88c3a", "#e05a5a"],
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: "y",
      plugins: {
        legend: { display: false },
        tooltip: tooltipPadrao()
      },
      scales: {
        x: eixoPadrao({ zero: true, precisao: true, titulo: "Quantidade de Riscos" }),
        y: eixoPadrao({ semGrid: true })
      },
      onClick: function(evt, elements) {
        if (!elements || elements.length === 0) return;
        const proc = top5[elements[0].index];
        if (proc && proc.id !== undefined) {
          filtrarSomenteProcessoDashboard(String(proc.id));
        }
      },
      onHover: function(evt, els) {
        evt.native.target.style.cursor = els.length ? "pointer" : "default";
      }
    }
  });
}

// ============ TOP 5 MAIOR RISCO FINAL MEDIO ============
// Risco final = valor do plano de tratamento quando preenchido; senao, residual.
function ajustarTituloTopFinal(ctx) {
  const card = ctx.closest(".card, .dash-card, .chart-card, .panel, section") || ctx.parentElement;
  if (!card) return;
  const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT, null);
  let n;
  while ((n = walker.nextNode())) {
    if (/Risco (Residual|Final) M[eé]dio/i.test(n.nodeValue)) {
      n.nodeValue = n.nodeValue.replace(/Risco (Residual|Final) M[eé]dio/i, "Risco Final");
    }
  }
}

function renderizarTopResidual(dados) {
  const ctx = document.getElementById("chartTopResidual");
  if (!ctx) return;
  ajustarTituloTopFinal(ctx);

  // Valor BRUTO por processo: MAIOR risco final entre os riscos dele.
  const porProc = {};
  dados.todosProcessos.forEach(function(p) {
    porProc[p._divisao + "|" + p.id] = {
      processo: p.processo || "?", divisao: p._divisao, fin: [], id: p.id
    };
  });
  dados.todosRiscos.forEach(function(r) {
    const chave = r._divisao + "|" + r.processoId;
    if (!riscoTratadoDash(r)) return;   // risco final: somente riscos tratados
    if (porProc[chave]) porProc[chave].fin.push(Number(nivelFinalRegraDash(r)) || 0);
  });

  const arr = Object.values(porProc).filter(function(x) { return x.fin.length > 0; })
    .map(function(x) {
      const maior = Math.max.apply(null, x.fin);
      return { processo: x.processo, divisao: x.divisao, maior: maior, id: x.id };
    })
    .sort(function(a, b) { return b.maior - a.maior; }).slice(0, 5);

  destruirChart("topResidual");
  if (arr.length === 0) return;

  function fmt(v) { return (Math.round(v * 10) / 10).toLocaleString("pt-BR"); }

  chartsAtivos.topResidual = new Chart(ctx, {
    type: "bar",
    data: {
      labels: arr.map(function(x) { return truncar(x.processo, 25) + " (" + x.divisao + ")"; }),
      datasets: [{
        label: "Risco Final",
        data: arr.map(function(x) { return Number(x.maior.toFixed(2)); }),
        // Cor pela faixa do maior risco final do processo
        backgroundColor: arr.map(function(x) {
          if (x.maior >= 20) return "#e05a5a";
          if (x.maior >= 7)  return "#f5c94a";
          return "#3ad48a";
        }),
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: "y",
      plugins: {
        legend: { display: false },
        tooltip: tooltipPadrao({
          callbacks: {
            label: function(it) {
              return " Maior risco final: " + fmt(arr[it.dataIndex].maior);
            }
          }
        })
      },
      scales: {
        x: eixoPadrao({ zero: true, titulo: "Maior Risco Final" }),
        y: eixoPadrao({ semGrid: true })
      },
      onClick: function(evt, elements) {
        if (!elements || elements.length === 0) return;
        const proc = arr[elements[0].index];
        if (proc && proc.id !== undefined) filtrarSomenteProcessoDashboard(String(proc.id));
      },
      onHover: function(evt, els) {
        evt.native.target.style.cursor = els.length ? "pointer" : "default";
      }
    }
  });
}

// ============ POR DIVISAO ============
function renderizarPorDivisao(dados) {
  const ctx = document.getElementById("chartDivisoes");
  if (!ctx) return;

  const cont = {};
  dados.todosRiscos.forEach(function(r) {
    cont[r._divisao] = (cont[r._divisao] || 0) + 1;
  });
  const labels = Object.keys(cont);
  const values = labels.map(function(d) { return cont[d]; });

  destruirChart("divisoes");
  chartsAtivos.divisoes = new Chart(ctx, {
    type: "bar",
    data: { labels: labels, datasets: [{ label: "Riscos", data: values, backgroundColor: "#4dd0e1", borderRadius: 6 }] },
    options: {
      plugins: {
        legend: { display: false },
        tooltip: tooltipPadrao({
          callbacks: { title: function(items) { return NOMES_DIVISOES_DASH[items[0].label] || items[0].label; } }
        })
      },
      scales: {
        x: eixoPadrao({ semGrid: true, titulo: "Divisão" }),
        y: eixoPadrao({ zero: true, precisao: true, titulo: "Quantidade de Riscos" })
      },
      onClick: function(evt, elements) {
        if (!elements || elements.length === 0) return;
        const label = chartsAtivos.divisoes.data.labels[elements[0].index];
        alternarFiltro("divisao", label);
      },
      onHover: function(evt, elements) {
        evt.native.target.style.cursor = elements.length ? "pointer" : "default";
      }
    }
  });
}

// ============ OPCOES DE TRATAMENTO ============
function renderizarOpcoes(dados) {
  const ctx = document.getElementById("chartOpcoes");
  if (!ctx) return;

  const cont = { "Mitigar": 0, "Compartilhar": 0, "Aceitar": 0, "Evitar": 0 };

  // Somente riscos que exigem tratamento:
  // nivel residual ALTO (todas as divisoes) e, na DPP, ALTO ou MEDIO.
  dados.todosRiscos.forEach(function(r) {
    if (!riscoEntraNasOpcoesDash(r)) return;
    const opcaoAtual = opcaoAtualDash(r);
    if (!opcaoAtual) return;
    if (cont.hasOwnProperty(opcaoAtual)) {
      cont[opcaoAtual]++;
    }
  });

  const total = cont.Mitigar + cont.Compartilhar + cont.Aceitar + cont.Evitar;

  destruirChart("opcoes");
  const C = coresGraficoTema();

  if (total === 0) {
    const c = ctx.getContext("2d");
    c.clearRect(0, 0, ctx.width, ctx.height);
    c.fillStyle = C.vazio;
    c.font = "600 14px 'Segoe UI', sans-serif";
    c.textAlign = "center";
    c.fillText("Sem opções definidas", ctx.width / 2, ctx.height / 2);
    return;
  }

  chartsAtivos.opcoes = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: Object.keys(cont),
      datasets: [{
        data: Object.values(cont),
        backgroundColor: ["#4dd0e1", "#7a5cff", "#3ad48a", "#e05a5a"],
        borderColor: C.donutBorda,
        borderWidth: 3
      }]
    },
    options: {
      cutout: "60%",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: legendaPadrao("bottom"),
        tooltip: tooltipPadrao()
      },
      onClick: function(evt, elements) {
        if (!elements || elements.length === 0) return;
        const label = chartsAtivos.opcoes.data.labels[elements[0].index];
        alternarFiltro("opcao", label);
      },
      onHover: function(evt, elements) {
        evt.native.target.style.cursor = elements.length ? "pointer" : "default";
      }
    }
  });
}

// ============ NIVEL DO RISCO ============
function renderizarNivel(dados) {
  const ctx = document.getElementById("chartNivel");
  if (!ctx) return;

  // Risco FINAL (valor do plano quando preenchido; senao, residual) -
  // mesma regra da Matriz de Risco Final.
  let alto = 0, medio = 0, baixo = 0;
  dados.todosRiscos.forEach(function(r) {
    if (!riscoTratadoDash(r)) return;   // risco final: somente riscos tratados
    const f = faixaFinalDash(r);
    if (f === "alto") alto++;
    else if (f === "medio") medio++;
    else baixo++;
  });

  destruirChart("nivel");
  const C = coresGraficoTema();
  chartsAtivos.nivel = new Chart(ctx, {
    type: "pie",
    data: {
      labels: ["Alto", "Médio", "Baixo"],
      datasets: [{
        data: [alto, medio, baixo],
        backgroundColor: ["#e05a5a", "#f5c94a", "#3ad48a"],
        borderColor: C.donutBorda, borderWidth: 3
      }]
    },
    options: {
      plugins: {
        legend: legendaPadrao("bottom"),
        tooltip: tooltipPadrao()
      },
      onClick: function(evt, elements) {
        if (!elements || elements.length === 0) return;
        const label = chartsAtivos.nivel.data.labels[elements[0].index];
        alternarFiltro("faixaNivel", label);
      },
      onHover: function(evt, elements) {
        evt.native.target.style.cursor = elements.length ? "pointer" : "default";
      }
    }
  });
}

// ============ VENCENDO EM 7 DIAS ============
function renderizarVencendo7Dias(dados) {
  const cont = document.getElementById("listaVencendo");
  const badge = document.getElementById("badgeVencendo");
  if (!cont) return;

  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const seteFrente = new Date(hoje.getTime() + 7 * 86400000);

  const proximos = [];
  dados.todosRiscos.forEach(function(r) {
    const etapas = obterEtapasDash(r);
    if (etapas.length === 0) return;
    const et = etapas[etapas.length - 1];
    if (et.concluido || !et.prazo) return;
    const dp = new Date(et.prazo + "T00:00:00");
    if (dp >= hoje && dp <= seteFrente) {
      const dias = Math.floor((dp - hoje) / 86400000);
      proximos.push({
        riscoId: r.id,
        processoId: r.processoId,
        evento: r.evento,
        divisao: r._divisao,
        dias: dias,
        prazo: et.prazo
      });
    }
  });

  proximos.sort(function(a, b) { return a.dias - b.dias; });
  if (badge) badge.textContent = proximos.length;

  if (proximos.length === 0) {
    cont.innerHTML = '<div class="empty-mini"><i class="bi bi-check-circle"></i> Nenhum vencendo em 7 dias</div>';
    return;
  }

  cont.innerHTML = proximos.map(function(p) {
    let urg = "urgente-baixa", icone = "bi-clock";
    if (p.dias <= 1)      { urg = "urgente-alta"; icone = "bi-alarm-fill"; }
    else if (p.dias <= 3) { urg = "urgente-media"; icone = "bi-alarm"; }
    const label = p.dias === 0 ? "Hoje!" : (p.dias === 1 ? "Amanhã" : p.dias + " dias");

    return '<div class="lista-item lista-clickable ' + urg + '" ' +
             'onclick="irParaTratamentoDireto(\'' + p.divisao + '\', ' + p.processoId + ', ' + p.riscoId + ')" ' +
             'title="Clique para ir ao Plano de Tratamento">' +
      '<div class="lista-icon"><i class="bi ' + icone + '"></i></div>' +
      '<div class="lista-content">' +
        '<div class="lista-title">' + esc(p.evento) + '</div>' +
        '<div class="lista-desc">' + p.divisao + ' • ' + formatarDataBR(p.prazo) + '</div>' +
      '</div>' +
      '<div class="lista-badge">' + label + '</div>' +
    '</div>';
  }).join("");
}

function formatarDataBR(iso) {
  if (!iso) return "";
  const parts = String(iso).slice(0, 10).split("-");
  return parts[2] + "/" + parts[1] + "/" + parts[0];
}

// ============ TOP RESPONSAVEIS ============
function renderizarResponsaveis(dados) {
  const cont = document.getElementById("listaResponsaveis");
  if (!cont) return;

  const map = {};
  dados.todosRiscos.forEach(function(r) {
    if (String(r.tratar).toLowerCase() !== "sim") return;
    const etapas = obterEtapasDash(r);
    if (etapas.length === 0) return;
    etapas.forEach(function(et) {
      const nome = normalizarNomeResponsavel(et.responsavel || "");
      if (!nome) return;
      const divisao = r._divisao || "?";
      const chave = nome.toLowerCase() + "|" + divisao;
      if (!map[chave]) {
        map[chave] = { nome: nome, divisao: divisao, total: 0, concluidos: 0, atrasos: 0 };
      }
      map[chave].total++;
      if (et.concluido) map[chave].concluidos++;
      if (et.prazo && !et.concluido) {
        const h = new Date(); h.setHours(0, 0, 0, 0);
        const dp = new Date(et.prazo + "T00:00:00");
        if (dp < h) map[chave].atrasos++;
      }
    });
  });

  const arr = Object.values(map)
    .sort(function(a, b) { return b.total - a.total; })
    .slice(0, 5);

  if (arr.length === 0) {
    cont.innerHTML =
      '<div style="text-align:center;padding:30px 20px;color:var(--text-muted);">' +
        '<i class="bi bi-inbox" style="font-size:36px;color:var(--accent-teal);opacity:0.5;"></i>' +
        '<p style="margin-top:10px;font-size:13px;">Nenhum responsável em riscos tratados</p>' +
        '<p style="margin-top:4px;font-size:11px;opacity:0.7;">' +
          (Object.keys(filtrosInterativos).some(function(k) { return filtrosInterativos[k]; })
            ? 'Ajuste os filtros para ver mais resultados'
            : 'Cadastre planos de tratamento para popular o ranking') +
        '</p>' +
      '</div>';
    return;
  }

  cont.innerHTML = arr.map(function(p, idx) {
    const iniciais = p.nome.split(" ")
      .filter(function(x) { return x.length > 1; })
      .slice(0, 2)
      .map(function(x) { return x[0].toUpperCase(); })
      .join("");

    let det = p.concluidos + ' concluído' + (p.concluidos !== 1 ? 's' : '');
    if (p.atrasos > 0) {
      det += ' <span style="color:var(--accent-red);font-weight:600;">&bull; ' + p.atrasos + ' em atraso</span>';
    }

    const isFiltrado = filtrosInterativos.responsavel === p.nome;
    const classeAtivo = isFiltrado ? 'lista-item-ativo' : '';

    return '<div class="lista-item ' + classeAtivo + '" ' +
                'onclick="alternarFiltro(\'responsavel\', \'' + p.nome.replace(/'/g, "\\'") + '\')" ' +
                'style="cursor:pointer;">' +
      '<div class="lista-avatar rank-' + (idx + 1) + '">' + (iniciais || "??") + '</div>' +
      '<div class="lista-content">' +
        '<div class="lista-title">' +
          esc(p.nome) +
          ' <span class="badge-divisao">' + p.divisao + '</span>' +
        '</div>' +
        '<div class="lista-desc">' + det + '</div>' +
      '</div>' +
      '<div class="lista-badge">' + p.total + '</div>' +
    '</div>';
  }).join("");
}

function normalizarNomeResponsavel(bruto) {
  if (!bruto) return null;
  const limpo = String(bruto).trim().replace(/\s+/g, " ");
  if (limpo.length < 4) return null;
  const inv = ["teste", "test", "asdf", "abc", "abcd", "xyz", "aaaa", "1234", "-", "n/a", "na"];
  if (inv.indexOf(limpo.toLowerCase()) >= 0) return null;

  const preposicoes = ["de", "da", "do", "dos", "das", "e"];
  const partes = limpo.split(" ")
    .filter(function(p) {
      return p.length >= 2 && preposicoes.indexOf(p.toLowerCase()) < 0;
    });
  if (partes.length === 0) return null;

  return partes.slice(0, 2).map(function(p) {
    return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
  }).join(" ");
}

// ============ EFICIENCIA ============
function renderizarEficiencia(dados) {
  let noPrazo = 0, total = 0, atrasados = 0;

  dados.todosRiscos.forEach(function(r) {
    if (String(r.tratar).toLowerCase() !== "sim") return;
    const trat = r.tratamento;
    if (!trat) return;

    let etapas = [];
    if (Array.isArray(trat.historico) && trat.historico.length > 0) {
      etapas = trat.historico;
    } else if (trat.opcao || trat.descricao) {
      etapas = [trat];
    }

    etapas.forEach(function(et) {
      if (!et.concluido || !et.concluidoEm) return;
      if (!et.prazo) return;
      total++;
      const dp = new Date(et.prazo + "T00:00:00");
      dp.setHours(0, 0, 0, 0);
      const dc = new Date(et.concluidoEm);
      dc.setHours(0, 0, 0, 0);
      if (dc <= dp) noPrazo++;
      else atrasados++;
    });
  });

  const pct = total > 0 ? Math.round((noPrazo / total) * 100) : 0;

  const container = document.getElementById("eficienciaContainer");
  const empty = document.getElementById("eficienciaEmpty");
  const svg = document.querySelector(".eficiencia-svg");
  const circulo = document.getElementById("eficienciaCirculo");
  const numero = document.getElementById("eficienciaPct");
  const label = document.getElementById("eficienciaLabel");
  const npEl = document.getElementById("eficienciaNoPrazo");
  const atEl = document.getElementById("eficienciaAtrasados");

  if (npEl) npEl.textContent = noPrazo;
  if (atEl) atEl.textContent = atrasados;

  if (total === 0) {
    if (container) container.style.display = "none";
    if (empty) empty.style.display = "block";
    if (label) { label.textContent = "SEM DADOS"; label.className = "badge-info"; }
    if (numero) numero.textContent = "0%";
    if (circulo) circulo.style.strokeDashoffset = 502.65;
    return;
  }

  if (container) container.style.display = "flex";
  if (empty) empty.style.display = "none";

  let cor = "#4dd0e1", labelText = "SEM DADOS", classeSvg = "", classeBadge = "";
  if (pct >= 80)      { cor = "#3ad48a"; labelText = "EXCELENTE"; classeSvg = "excelente"; classeBadge = "badge-excelente"; }
  else if (pct >= 50) { cor = "#f5c94a"; labelText = "REGULAR";   classeSvg = "regular";   classeBadge = "badge-regular"; }
  else                { cor = "#e05a5a"; labelText = "CRÍTICO";   classeSvg = "critico";   classeBadge = "badge-critico"; }

  const perimetro = 502.65;
  const offset = perimetro - (perimetro * pct / 100);

  if (circulo) {
    circulo.style.stroke = cor;
    circulo.style.strokeDashoffset = offset;
  }
  if (svg) {
    svg.classList.remove("excelente", "regular", "critico");
    if (classeSvg) svg.classList.add(classeSvg);
  }
  if (numero) { numero.textContent = pct + "%"; numero.style.color = cor; }
  if (label)  { label.textContent = labelText; label.className = "badge-info " + classeBadge; }
}

// ============================================================
//  POP-UP DE PLANOS DE TRATAMENTO
// ============================================================
function listarPlanosEmAtrasoDash(dados) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const lista = [];
  (dados.todosRiscos || []).forEach(function(r) {
    if (!riscoTratadoDash(r)) return;
    const etapas = obterEtapasDash(r);
    if (!etapas.length) return;
    const temPlano = etapas.some(function(et) { return et.opcao && et.descricao; });
    if (!temPlano) return;
    const et = etapas[etapas.length - 1];
    if (!et || et.concluido || !et.prazo || !et.opcao) return;
    const dp = new Date(String(et.prazo).slice(0, 10) + "T00:00:00");
    if (isNaN(dp.getTime()) || dp >= hoje) return;
    lista.push({
      riscoId: r.id,
      processoId: r.processoId,
      divisao: r._divisao || "",
      evento: r.evento || "Risco sem descrição",
      prazo: String(et.prazo).slice(0, 10),
      diasAtraso: Math.floor((hoje - dp) / 86400000)
    });
  });
  lista.sort(function(a, b) { return b.diasAtraso - a.diasAtraso; });
  return lista;
}

function renderizarStreak(dados) {
  if (window._popupPlanosMostrado) return;

  const atrasados = listarPlanosEmAtrasoDash(dados);
  if (atrasados.length > 0) {
    window._planosEmAtrasoDash = atrasados;
    criarBannerPlanosAtraso(atrasados);
    window._popupPlanosMostrado = true;
    return;
  }

  if (sessionStorage.getItem("streak_planos_shown")) return;
  const streak = calcularStreakDias(dados);
  if (streak < 1) return;
  criarStreakBanner(streak);
  window._popupPlanosMostrado = true;
  sessionStorage.setItem("streak_planos_shown", "1");
}

function calcularStreakDias(dados) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  let ultimoEventoAtraso = null;

  dados.todosRiscos.forEach(function(r) {
    obterEtapasDash(r).forEach(function(et) {
      if (!et.prazo) return;
      const dp = new Date(String(et.prazo).slice(0, 10) + "T00:00:00");
      if (isNaN(dp.getTime())) return;
      if (dp < hoje && et.concluido && et.concluidoEm) {
        const dc = new Date(et.concluidoEm);
        dc.setHours(0, 0, 0, 0);
        const dataResolucao = dc > dp ? dc : dp;
        if (!ultimoEventoAtraso || dataResolucao > ultimoEventoAtraso) {
          ultimoEventoAtraso = dataResolucao;
        }
      }
    });
  });

  if (!ultimoEventoAtraso) {
    let primeiroRisco = null;
    dados.todosRiscos.forEach(function(r) {
      if (r.criadoEm) {
        const dc = new Date(r.criadoEm);
        if (!primeiroRisco || dc < primeiroRisco) primeiroRisco = dc;
      }
    });
    if (!primeiroRisco) return 0;
    primeiroRisco.setHours(0, 0, 0, 0);
    return Math.floor((hoje - primeiroRisco) / 86400000);
  }

  return Math.floor((hoje - ultimoEventoAtraso) / 86400000);
}

function criarStreakBanner(dias) {
  const antigo = document.querySelector(".streak-banner");
  if (antigo) antigo.remove();

  let emoji = "🎉", texto = "sem planos de tratamento em atraso!";
  if (dias >= 30)      { emoji = "🏆"; texto = "sem planos de tratamento em atraso - RECORDE!"; }
  else if (dias >= 14) { emoji = "🌟"; texto = "sem planos de tratamento em atraso - excelente!"; }
  else if (dias >= 7)  { emoji = "🎊"; texto = "sem planos de tratamento em atraso - continue assim!"; }
  else if (dias >= 3)  { emoji = "✨"; texto = "sem planos de tratamento em atraso!"; }
  else if (dias === 0) { emoji = "✅"; texto = "sem planos de tratamento em atraso hoje!"; }

  const diasTexto = dias === 0 ? "Zerado" : (dias + " dia" + (dias !== 1 ? "s" : ""));

  const banner = document.createElement("div");
  banner.className = "streak-banner";
  banner.innerHTML =
    '<div class="streak-emoji">' + emoji + '</div>' +
    '<div class="streak-content">' +
      '<div class="streak-numero">' + diasTexto + '</div>' +
      '<div class="streak-texto">' + texto + '</div>' +
    '</div>' +
    '<button class="streak-close" onclick="fecharStreak()">&times;</button>';
  document.body.appendChild(banner);

  setTimeout(function() { fecharStreak(); }, 15000);
}

function injetarEstiloBannerAtraso() {
  if (document.getElementById("estiloBannerAtraso")) return;
  const st = document.createElement("style");
  st.id = "estiloBannerAtraso";
  st.textContent =
    "@keyframes paIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}" +
    "@keyframes paOut{to{opacity:0;transform:translateY(14px)}}" +
    ".pa-pop{position:fixed;right:22px;bottom:22px;z-index:9000;width:360px;max-width:calc(100vw - 32px);" +
      "background:#13283a;color:#e6f1f5;border:1px solid rgba(255,255,255,.08);border-left:4px solid #e05a5a;" +
      "border-radius:12px;box-shadow:0 14px 36px rgba(0,0,0,.45);font-family:inherit;animation:paIn .35s ease;}" +
    ".pa-pop.exiting{animation:paOut .3s ease forwards;}" +
    ".pa-head{display:flex;align-items:center;gap:10px;padding:12px 12px 8px 14px;}" +
    ".pa-ico{flex:0 0 32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;" +
      "background:rgba(224,90,90,.16);color:#ff7b7b;font-size:16px;}" +
    ".pa-tit{font-size:14px;font-weight:700;line-height:1.2;}" +
    ".pa-sub{font-size:11.5px;opacity:.7;margin-top:1px;}" +
    ".pa-x{margin-left:auto;align-self:flex-start;background:transparent;border:0;color:inherit;opacity:.55;" +
      "font-size:18px;line-height:1;cursor:pointer;padding:2px 4px;}" +
    ".pa-x:hover{opacity:1;}" +
    ".pa-lista{padding:0 10px;display:flex;flex-direction:column;gap:4px;max-height:168px;overflow-y:auto;}" +
    ".pa-item{display:flex;align-items:center;gap:8px;width:100%;text-align:left;cursor:pointer;" +
      "background:rgba(255,255,255,.04);border:1px solid transparent;border-radius:8px;padding:6px 8px;color:inherit;}" +
    ".pa-item:hover{background:rgba(224,90,90,.12);border-color:rgba(224,90,90,.35);}" +
    ".pa-tag{flex:0 0 auto;font-size:10px;font-weight:700;padding:2px 6px;border-radius:6px;" +
      "background:rgba(224,90,90,.18);color:#ff8a8a;}" +
    ".pa-txt{flex:1;min-width:0;}" +
    ".pa-ev{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
    ".pa-meta{font-size:10.5px;opacity:.65;}" +
    ".pa-dias{flex:0 0 auto;font-size:11px;font-weight:700;color:#ff8a8a;}" +
    ".pa-mais{font-size:11px;opacity:.65;padding:2px 4px;}" +
    ".pa-foot{padding:10px 12px 12px;}" +
    ".pa-btn{width:100%;display:flex;align-items:center;justify-content:center;gap:6px;cursor:pointer;" +
      "border:0;border-radius:8px;padding:8px;font-size:12.5px;font-weight:700;background:#d64b4b;color:#fff;}" +
    ".pa-btn:hover{background:#bd3b3b;}" +
    "html[data-theme=\"light\"] .pa-pop{background:#ffffff;color:#1a2b3d;border-color:#e3e8ee;border-left-color:#d64b4b;" +
      "box-shadow:0 14px 34px rgba(15,40,60,.18);}" +
    "html[data-theme=\"light\"] .pa-item{background:#f6f8fa;}" +
    "html[data-theme=\"light\"] .pa-item:hover{background:#fdeeee;}" +
    "html[data-theme=\"light\"] .pa-tag{background:#fde3e3;color:#b83232;}" +
    "html[data-theme=\"light\"] .pa-dias{color:#c23a3a;}" +
    "html[data-theme=\"light\"] .pa-ico{background:#fde3e3;color:#c23a3a;}";
  document.head.appendChild(st);
}

function criarBannerPlanosAtraso(lista) {
  const antigo = document.querySelector(".pa-pop");
  if (antigo) antigo.remove();
  const streak = document.querySelector(".streak-banner");
  if (streak) streak.remove();

  injetarEstiloBannerAtraso();

  const n = lista.length;
  const max = 4;
  const itens = lista.slice(0, max).map(function(p, i) {
    return '<button type="button" class="pa-item" onclick="abrirPlanoEmAtrasoDash(' + i + ')" ' +
             'title="' + esc(p.evento) + '">' +
             '<span class="pa-tag">' + esc(p.divisao) + '</span>' +
             '<span class="pa-txt">' +
               '<div class="pa-ev">' + esc(p.evento) + '</div>' +
               '<div class="pa-meta">Prazo ' + formatarDataBR(p.prazo) + '</div>' +
             '</span>' +
             '<span class="pa-dias">' + p.diasAtraso + 'd</span>' +
           '</button>';
  }).join("");

  const pop = document.createElement("div");
  pop.className = "pa-pop";
  pop.innerHTML =
    '<div class="pa-head">' +
      '<div class="pa-ico"><i class="bi bi-exclamation-triangle-fill"></i></div>' +
      '<div>' +
        '<div class="pa-tit">' + n + ' plano' + (n !== 1 ? 's' : '') + ' de tratamento em atraso</div>' +
        '<div class="pa-sub">Clique em um plano para abri-lo</div>' +
      '</div>' +
      '<button type="button" class="pa-x" onclick="fecharStreak()" title="Fechar">&times;</button>' +
    '</div>' +
    '<div class="pa-lista">' + itens +
      (n > max ? '<div class="pa-mais">e mais ' + (n - max) + ' plano' + (n - max !== 1 ? 's' : '') + '...</div>' : '') +
    '</div>' +
    '<div class="pa-foot">' +
      '<button type="button" class="pa-btn" onclick="irParaPlanosEmAtrasoDash()">' +
        '<i class="bi bi-box-arrow-up-right"></i> Abrir o plano mais atrasado' +
      '</button>' +
    '</div>';
  document.body.appendChild(pop);
  document.body.classList.add("pa-pop-aberto");
}

function abrirPlanoEmAtrasoDash(idx) {
  const p = (window._planosEmAtrasoDash || [])[idx];
  if (!p) return;
  try {
    ["abrir_processo_tratamento", "abrir_risco_tratamento", "filtro_divisao_tratamento",
     "filtro_status_tratamento", "planos_em_atraso_ids"].forEach(function(k) {
      sessionStorage.removeItem(k);
    });
    sessionStorage.setItem("abrir_processo_tratamento", String(p.processoId));
    sessionStorage.setItem("abrir_risco_tratamento", String(p.riscoId));
    sessionStorage.setItem("filtro_divisao_tratamento", p.divisao);
  } catch (e) {}
  window.location.href = "tratamento.html";
}

function irParaPlanosEmAtrasoDash() {
  abrirPlanoEmAtrasoDash(0);
}

function fecharStreak() {
  [".pa-pop", ".streak-banner"].forEach(function(sel) {
    const el = document.querySelector(sel);
    if (!el || el.classList.contains("exiting")) return;
    el.classList.add("exiting");
    setTimeout(function() {
      if (el) el.remove();
      document.body.classList.toggle("pa-pop-aberto", !!document.querySelector(".pa-pop"));
    }, 700);
  });
}

// ============ HELPERS ============
function destruirChart(nome) {
  if (chartsAtivos[nome]) {
    chartsAtivos[nome].destroy();
    delete chartsAtivos[nome];
  }
}

function truncar(str, max) {
  if (!str) return "";
  str = String(str);
  return str.length > max ? str.substring(0, max) + "..." : str;
}

function esc(str) {
  if (str === null || str === undefined || str === "") return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ============ TERMÔMETRO DE EXPOSIÇÃO GLOBAL ============
function calcularExposicaoGlobal(dados) {
  if (dados.todosRiscos.length === 0) {
    return { percent: 0, label: "SEM DADOS", classe: "expo-baixa" };
  }
  const soma = dados.todosRiscos.reduce(function(acc, r) {
    return acc + r.prob * r.imp * (r.nivelControle || 1);
  }, 0);
  const max = dados.todosRiscos.length * 25;
  const pct = (soma / max) * 100;

  let label = "BAIXA", classe = "expo-baixa";
  if (pct >= 75)      { label = "CRÍTICA"; classe = "expo-critica"; }
  else if (pct >= 50) { label = "ALTA";    classe = "expo-alta"; }
  else if (pct >= 25) { label = "MÉDIA";   classe = "expo-media"; }

  return { percent: pct, label: label, classe: classe };
}

function renderizarTermometro(dados) {
  const exp = calcularExposicaoGlobal(dados);
  const fill    = document.getElementById("termometroFill");
  const pointer = document.getElementById("termometroPointer");
  const pct     = document.getElementById("termometroPercent");
  const badge   = document.getElementById("termometroBadge");
  const label   = document.getElementById("termometroLabel");
  if (!fill) return;
  fill.style.width = exp.percent + "%";
  if (pointer) pointer.style.left = exp.percent + "%";
  if (pct) pct.textContent = exp.percent.toFixed(0) + "%";
  if (label) label.textContent = exp.label;
  if (badge) badge.className = "termometro-badge " + exp.classe;
}

function nomeValido(nome) {
  if (!nome) return false;
  const n = nome.trim().toLowerCase();
  if (n.length < 4) return false;
  const inv = ["teste", "test", "asdf", "abc", "abcd", "xyz", "aaaa", "1234"];
  return inv.indexOf(n) < 0;
}

function irParaTratamentoDireto(divisao, processoId, riscoId) {
  sessionStorage.setItem("abrir_processo_tratamento", String(processoId));
  sessionStorage.setItem("abrir_risco_tratamento", String(riscoId));
  const user = JSON.parse(sessionStorage.getItem("mapa_user") || "{}");
  if (String(user.divisao).toUpperCase() !== String(divisao).toUpperCase()) {
    sessionStorage.setItem("filtro_divisao_tratamento", divisao);
  }
  window.location.href = "tratamento.html";
}

// ============ COMPARATIVO COM SNAPSHOT ANTERIOR ============
function atualizarComparativos(atual) {
  const chaveSnap = "kpi_snapshot_ultimo";
  const raw = localStorage.getItem(chaveSnap);
  let anterior = null;
  try { anterior = raw ? JSON.parse(raw) : null; } catch (e) {}

  const mapa = {
    kpiTotalRiscos: "cmpTotal",
    kpiPlanos:      "cmpPlanos",
    kpiConcluidos:  "cmpConcluidos",
    kpiEmAtraso:    "cmpAtraso"
  };

  Object.keys(mapa).forEach(function(kpiId) {
    const el = document.getElementById(mapa[kpiId]);
    if (!el) return;
    const valorAtual = atual[kpiId] || 0;

    if (!anterior) {
      el.innerHTML = '<i class="bi bi-dot"></i> Primeira medição';
      el.className = "kpi-comparativo equal";
      return;
    }

    const diff = valorAtual - (anterior[kpiId] || 0);
    let classe = "equal", icone = "bi-arrow-right", texto = "estável vs anterior";
    if (diff > 0) {
      icone = "bi-arrow-up";
      texto = "+" + diff + " vs anterior";
      classe = (kpiId === "kpiEmAtraso") ? "up" : (kpiId === "kpiConcluidos" ? "down" : "up");
    } else if (diff < 0) {
      icone = "bi-arrow-down";
      texto = diff + " vs anterior";
      classe = (kpiId === "kpiEmAtraso") ? "down" : (kpiId === "kpiConcluidos" ? "up" : "down");
    }
    el.className = "kpi-comparativo " + classe;
    el.innerHTML = '<i class="bi ' + icone + '"></i> ' + texto;
  });

  const hoje = new Date().toISOString().substring(0, 10);
  if (!(anterior && anterior._data === hoje)) {
    localStorage.setItem(chaveSnap, JSON.stringify(Object.assign({}, atual, { _data: hoje })));
  }
}

function toggleApresentacao() {
  const body = document.body;
  if (body.classList.contains("modo-apresentacao")) {
    body.classList.remove("modo-apresentacao");
    if (document.fullscreenElement) document.exitFullscreen();
    const btnSair = document.getElementById("btnSairPres");
    if (btnSair) btnSair.remove();
  } else {
    body.classList.add("modo-apresentacao");
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    }
    const btn = document.createElement("button");
    btn.id = "btnSairPres";
    btn.className = "btn-sair-pres";
    btn.innerHTML = '<i class="bi bi-x-lg"></i> Sair do Modo Apresentação';
    btn.onclick = toggleApresentacao;
    document.body.appendChild(btn);
    if (typeof showToast === "function") showToast("🎯 Modo Apresentação ativado", "success");
    if (typeof tocarSom === "function") tocarSom("success");
  }
}

document.addEventListener("keydown", function(e) {
  if (e.key === "Escape" && document.body.classList.contains("modo-apresentacao")) {
    toggleApresentacao();
  }
});

// ============ HELPER: Obter etapas de tratamento ============
function obterEtapasDash(risco) {
  if (risco.tratamento && Array.isArray(risco.tratamento.historico)) {
    return risco.tratamento.historico;
  }
  if (risco.tratamento && (risco.tratamento.opcao || risco.tratamento.descricao)) {
    return [risco.tratamento];
  }
  return [];
}

// ============ FILTRO GLOBAL DE PERÍODO ============
function parseDataSegura(valor) {
  if (!valor) return null;
  try {
    if (valor instanceof Date) return valor;
    const str = String(valor);
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      return new Date(str.substring(0, 10) + "T00:00:00");
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d;
    return null;
  } catch (e) {
    return null;
  }
}

function obterUltimaEtapaDash(risco) {
  const etapas = obterEtapasDash(risco);
  if (!etapas || etapas.length === 0) return null;
  return etapas[etapas.length - 1];
}

function setPeriodoRapido(tipo) {
  const hoje = new Date();
  const ini = document.getElementById("filtroDataIni");
  const fim = document.getElementById("filtroDataFim");
  const mes = document.getElementById("filtroMes");
  if (!ini || !fim || !mes) return;
  mes.value = "";

  function toISO(d) { return d.toISOString().substring(0, 10); }

  if (tipo === "mes_atual") {
    ini.value = toISO(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
    fim.value = toISO(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0));
  }
  if (tipo === "30") {
    const d = new Date(); d.setDate(d.getDate() - 30);
    ini.value = toISO(d); fim.value = toISO(hoje);
  }
  if (tipo === "90") {
    const d = new Date(); d.setDate(d.getDate() - 90);
    ini.value = toISO(d); fim.value = toISO(hoje);
  }
  if (tipo === "ano") {
    ini.value = toISO(new Date(hoje.getFullYear(), 0, 1));
    fim.value = toISO(new Date(hoje.getFullYear(), 11, 31));
  }
  if (typeof atualizarResumoPeriodo === "function") atualizarResumoPeriodo();
  atualizarTudo();
}

// ============ FILTRO GLOBAL DE MÊS/ANO ============
const MESES_DASHBOARD = [
  { id: 1, nome: "Jan" }, { id: 2, nome: "Fev" }, { id: 3, nome: "Mar" },
  { id: 4, nome: "Abr" }, { id: 5, nome: "Mai" }, { id: 6, nome: "Jun" },
  { id: 7, nome: "Jul" }, { id: 8, nome: "Ago" }, { id: 9, nome: "Set" },
  { id: 10, nome: "Out" }, { id: 11, nome: "Nov" }, { id: 12, nome: "Dez" }
];

let mesesSelecionadosDashboard = new Set();

function inicializarFiltroMesAnoDashboard() {
  const cont = document.getElementById("chipsMesesDashboard");
  const anoSelect = document.getElementById("filtroAnoGlobal");
  if (!cont) return;

  cont.innerHTML = "";

  MESES_DASHBOARD.forEach(function(m) {
    const chip = document.createElement("span");
    chip.className = "chip-mes-dashboard";
    chip.setAttribute("data-mes", m.id);
    chip.innerHTML = '<i class="bi bi-check check-mes"></i> ' + m.nome;
    chip.onclick = function() {
      if (mesesSelecionadosDashboard.has(m.id)) {
        mesesSelecionadosDashboard.delete(m.id);
        chip.classList.remove("active");
      } else {
        mesesSelecionadosDashboard.add(m.id);
        chip.classList.add("active");
      }
      atualizarResumoMesAno();
      atualizarTudo(true);
    };
    cont.appendChild(chip);
  });

  if (anoSelect) {
    popularAnosFiltroGlobal();
    _anoPadraoDash = String(anoSelect.value);
    anoSelect.addEventListener("change", function() {
      atualizarResumoMesAno();
      atualizarTudo(true);
    });
  }

  atualizarResumoMesAno();
}

function popularAnosFiltroGlobal() {
  const anoSelect = document.getElementById("filtroAnoGlobal");
  if (!anoSelect) return;
  const anoAtual = new Date().getFullYear();
  let html = '<option value="">Todos</option>';
  for (let a = 2026; a <= anoAtual + 1; a++) {
    html += '<option value="' + a + '"' + (a === anoAtual ? " selected" : "") + '>' + a + '</option>';
  }
  anoSelect.innerHTML = html;
}

function limparFiltroMesAno() {
  mesesSelecionadosDashboard.clear();
  document.querySelectorAll(".chip-mes-dashboard").forEach(function(chip) {
    chip.classList.remove("active");
  });
  const anoSelect = document.getElementById("filtroAnoGlobal");
  if (anoSelect) anoSelect.value = "";
  atualizarResumoMesAno();
  atualizarTudo(true);
}

function atualizarResumoMesAno() {
  const el = document.getElementById("periodoResumo");
  if (!el) return;

  const ano = document.getElementById("filtroAnoGlobal")
    ? document.getElementById("filtroAnoGlobal").value
    : "";

  const meses = Array.from(mesesSelecionadosDashboard).sort(function(a, b) { return a - b; });
  const nomes = meses.map(function(id) {
    const m = MESES_DASHBOARD.find(function(x) { return x.id === id; });
    return m ? m.nome : id;
  });

  if (meses.length === 0 && !ano) {
    el.innerHTML = 'Período: <strong>Todos</strong>';
    return;
  }

  const partes = [];
  partes.push("Meses: <strong>" + (meses.length > 0 ? nomes.join(", ") : "Todos") + "</strong>");
  partes.push("Ano: <strong>" + (ano || "Todos") + "</strong>");
  el.innerHTML = "Período: " + partes.join(" • ");
}

function parseDataDashboard(valor) {
  if (!valor) return null;
  try {
    if (valor instanceof Date) {
      return isNaN(valor.getTime()) ? null : valor;
    }
    const str = String(valor);
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      const d = new Date(str.substring(0, 10) + "T00:00:00");
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  } catch (e) {
    return null;
  }
}

function obterDataReferenciaRisco(risco, processosPorId) {
  const etapas = obterEtapasDash(risco);
  if (etapas && etapas.length > 0) {
    const ultima = etapas[etapas.length - 1];
    const dataTrat = parseDataDashboard(
      ultima.criadoEm || ultima.criado_em || ultima.concluidoEm || ultima.concluido_em || ultima.prazo
    );
    if (dataTrat) return dataTrat;
  }

  const dataRisco = parseDataDashboard(
    risco.criadoEm || risco.criado_em || risco.dataCriacao || risco.created_at
  );
  if (dataRisco) return dataRisco;

  const proc = processosPorId[String(risco.processoId)];
  if (proc) {
    const dataProc = parseDataDashboard(
      proc.data || proc.dataRegistro || proc.data_registro || proc.criadoEm || proc.criado_em
    );
    if (dataProc) return dataProc;
  }
  return null;
}

function adicionarDataReferencia(dados) {
  const processos = dados.todosProcessos || [];
  const riscos = dados.todosRiscos || [];
  const processosPorId = {};
  processos.forEach(function(p) { processosPorId[String(p.id)] = p; });
  riscos.forEach(function(r) {
    r.dataReferencia = obterDataReferenciaRisco(r, processosPorId);
  });
  return dados;
}

function filtrarDadosPorMesAno(dados) {
  if (!dados) return dados;

  const meses = Array.from(mesesSelecionadosDashboard);
  const anoEl = document.getElementById("filtroAnoGlobal");
  const ano = anoEl && anoEl.value ? Number(anoEl.value) : 0;

  if (meses.length === 0 && !ano) return dados;

  const riscosFiltrados = (dados.todosRiscos || []).filter(function(r) {
    if (!r.dataReferencia) return false;
    const mesRisco = r.dataReferencia.getMonth() + 1;
    const anoRisco = r.dataReferencia.getFullYear();
    if (meses.length > 0 && meses.indexOf(mesRisco) < 0) return false;
    if (ano && anoRisco !== ano) return false;
    return true;
  });

  const procIds = new Set(riscosFiltrados.map(function(r) { return String(r.processoId); }));
  const processosFiltrados = (dados.todosProcessos || []).filter(function(p) {
    return procIds.has(String(p.id));
  });

  return { todosProcessos: processosFiltrados, todosRiscos: riscosFiltrados };
}

// ============ MATRIZ TJPR - FUNÇÕES DE APOIO ============
function nivelFinalRegraDash(r) {
  const prob = Number(r.prob) || 1;
  const imp = Number(r.imp) || 1;
  const controle = Number(r.nivelControle) || 1;
  const residual = prob * imp * controle;

  // So usa o valor do plano se o risco e de fato tratado:
  // Tratar = Sim e residual ALTO (DPP: residual MEDIO ou ALTO).
  if (riscoTratadoDash(r)) {
    const etapas = obterEtapasDash(r);
    if (etapas && etapas.length > 0) {
      const etapa = etapas[etapas.length - 1];
      const monitor = Number(etapa.nivelMonitoramento) || 0;
      if (monitor > 0) return residual * monitor;
    }
  }
  return residual;
}

function encontrarCelulaTJPR(nivelDesejado) {
  let melhorProb = 1, melhorImp = 1, menorDiff = Infinity;
  for (let p = 1; p <= 5; p++) {
    for (let i = 1; i <= 5; i++) {
      const diff = Math.abs(MATRIZ_TJPR[p + "-" + i] - nivelDesejado);
      if (diff < menorDiff) {
        menorDiff = diff;
        melhorProb = p;
        melhorImp = i;
      }
    }
  }
  return { prob: melhorProb, imp: melhorImp };
}

function classeMatrizDash(nivel) {
  const n = Math.ceil(Number(nivel) || 0);
  if (n >= 20) return { faixa: "alto",  classe: "matriz-cell-alto" };
  if (n >= 7)  return { faixa: "medio", classe: "matriz-cell-medio" };
  return { faixa: "baixo", classe: "matriz-cell-baixo" };
}

function renderizarBarraFiltrosAtivos() {
  const barra = document.getElementById("barraFiltrosAtivos");
  const chips = document.getElementById("chipsFiltrosAtivos");
  if (!barra || !chips) return;

  const ativos = [];
  if (filtrosInterativos.divisao) {
    ativos.push({ tipo: "Divisão", valor: filtrosInterativos.divisao, chave: "divisao" });
  }
  if (filtrosInterativos.faixaNivel) {
    ativos.push({ tipo: "Faixa final", valor: filtrosInterativos.faixaNivel, chave: "faixaNivel" });
  }
  if (filtrosInterativos.faixaInerente) {
    ativos.push({ tipo: "Faixa inerente", valor: filtrosInterativos.faixaInerente, chave: "faixaInerente" });
  }
  if (filtrosInterativos.faixaResidual) {
    ativos.push({ tipo: "Faixa residual", valor: filtrosInterativos.faixaResidual, chave: "faixaResidual" });
  }
  if (filtrosInterativos.matrizNivel !== null) {
    ativos.push({ tipo: "Nível de risco", valor: filtrosInterativos.matrizNivel, chave: "matrizNivel" });
  }
  if (filtrosInterativos.comPlano) {
    ativos.push({ tipo: "Plano", valor: "Com plano de tratamento", chave: "comPlano" });
  }
  if (filtrosInterativos.opcao) {
    ativos.push({ tipo: "Opção", valor: filtrosInterativos.opcao, chave: "opcao" });
  }
  if (filtrosInterativos.visao) {
    ativos.push({ tipo: "Visão do risco", valor: filtrosInterativos.visao, chave: "visao" });
  }
  if (filtrosInterativos.responsavel) {
    ativos.push({ tipo: "Responsável", valor: filtrosInterativos.responsavel, chave: "responsavel" });
  }

  const selecaoParcial =
    processosSelecionadosDashboard.size > 0 &&
    processosSelecionadosDashboard.size < processosDisponiveisDashboard.length;

  const chipsProcesso = !selecaoParcial ? [] :
    Array.from(processosSelecionadosDashboard).map(function(id) {
      const p = processosDisponiveisDashboard.find(function(x) { return x.id === id; });
      const nome = p ? p.nome : ("Processo " + id);
      return '<button class="chip-filtro-ativo" ' +
                     'onclick="alternarProcessoDashboard(\'' + id + '\')">' +
               '<span class="chip-tipo">Processo:</span>' +
               '<span>' + esc(truncar(nome, 28)) + '</span>' +
               '<span class="chip-x"><i class="bi bi-x"></i></span>' +
             '</button>';
    });

  // Botao "Limpar tudo" da barra fica oculto: a limpeza passa a ser pelo botao flutuante (vassoura)
  const btnLimparBarra = barra.querySelector(".btn-limpar-filtros");
  if (btnLimparBarra) btnLimparBarra.style.display = "none";

  window._qtdFiltrosBaseDash = ativos.length + chipsProcesso.length;
  atualizarVassouraPorDivisaoDash();

  if (ativos.length === 0 && chipsProcesso.length === 0) {
    barra.classList.remove("visivel");
    barra.classList.add("oculta");
    chips.innerHTML = "";
    return;
  }

  barra.classList.remove("oculta");
  barra.classList.add("visivel");

  chips.innerHTML = ativos.map(function(a) {
    return '<button class="chip-filtro-ativo" onclick="alternarFiltro(\'' + a.chave + '\', ' +
      (typeof a.valor === "number" ? a.valor : "'" + a.valor + "'") + ')">' +
      '<span class="chip-tipo">' + a.tipo + ':</span>' +
      '<span>' + a.valor + '</span>' +
      '<span class="chip-x"><i class="bi bi-x"></i></span>' +
    '</button>';
  }).concat(chipsProcesso).join("");

  const btnLimpar = barra.querySelector(".btn-limpar-filtros");
  if (btnLimpar) {
    btnLimpar.onclick = function(e) {
      e.preventDefault();
      e.stopPropagation();
      limparTodosFiltrosDashboard();
    };
  }
}

// ============================================================
//  BOTAO FLUTUANTE "LIMPAR FILTROS" (VASSOURA)
//  Fixo no canto inferior direito, acompanha a rolagem da tela.
//  Aparece somente quando ha filtros ativos.
// ============================================================
function limparTodosFiltrosDashboard() {
  processosSelecionadosDashboard.clear();
  processosDisponiveisDashboard.forEach(function (p) {
    processosSelecionadosDashboard.add(p.id);
  });
  _limpezaManualProcessos = false;
  salvarSelecaoProcessos();

  const menu = document.getElementById("procDropdownMenu");
  if (menu) {
    processosDisponiveisDashboard.forEach(function (p) {
      const cb = menu.querySelector('input[data-proc-id="' + p.id + '"]');
      if (cb) cb.checked = true;
    });
  }
  atualizarResumosProcesso();

  const fab = document.getElementById("fabLimparFiltrosDash");
  if (fab) {
    fab.classList.remove("varrendo");
    void fab.offsetWidth;
    fab.classList.add("varrendo");
  }

  restaurarPeriodoDash();
  const mudouDivisao = restaurarTodasDivisoesDash();
  // (as divisoes recarregam pelo proprio filtro; abaixo garante a atualizacao)
  filtrosInterativos.visao = null;
  pexGaugeVisaoReset();
  limparFiltrosInterativos();
  if (mudouDivisao) {
    // recarrega depois que o filtro de divisoes terminar de reagir
    setTimeout(function () {
      invalidarCacheDashboard();
      atualizarTudo();
      atualizarVassouraPorDivisaoDash();
    }, 600);
  }
  if (typeof showToast === "function") showToast("Filtros limpos", "success");
}

// ---------- Filtro de DIVISOES (chips do topo) ----------
function siglasChipsDivisaoDash() {
  const cont = document.getElementById("chipsDivisoes") || document.querySelector(".divisao-filter-multi");
  const siglas = Object.keys(NOMES_DIVISOES_DASH);
  const achadas = [];
  if (cont) {
    cont.querySelectorAll("button, span, label, div").forEach(function (el) {
      if (el.children.length > 2) return;
      const t = String(el.textContent || "").replace(/[^A-Za-z]/g, "").toUpperCase();
      if (siglas.indexOf(t) >= 0 && achadas.indexOf(t) < 0) achadas.push(t);
    });
  }
  return achadas.length ? achadas : siglas;
}

function cardDivisoesDash() {
  const cont = document.getElementById("chipsDivisoes") || document.querySelector(".divisao-filter-multi");
  if (!cont) return null;
  return cont.closest(".divisao-filter-multi, .filtro-card, .card, section") || cont.parentElement;
}

/** Lista {sigla, ativo} lida direto dos chips de divisao na tela. */
function chipsDivisaoDash() {
  const card = cardDivisoesDash();
  if (!card) return [];
  const siglas = Object.keys(NOMES_DIVISOES_DASH);
  const lista = [];
  card.querySelectorAll("button, .chip, [class*='chip'], label, span").forEach(function (el) {
    const sigla = String(el.textContent || "").replace(/[^A-Za-z]/g, "").toUpperCase();
    if (siglas.indexOf(sigla) < 0) return;
    if (lista.some(function (x) { return x.sigla === sigla; })) return;
    const alvo = el.closest("button, [class*='chip']") || el;
    const cls = " " + String(alvo.className || "").toLowerCase() + " ";
    const input = alvo.querySelector("input[type=checkbox]");
    const icone = alvo.querySelector(".bi-check, .bi-check2, .bi-check-lg, .check");
    const iconeVisivel = icone && getComputedStyle(icone).display !== "none" &&
                         getComputedStyle(icone).visibility !== "hidden" &&
                         Number(getComputedStyle(icone).opacity) > 0.2;
    const ativo = (input && input.checked) ||
      /\s(active|ativo|ativa|selected|selecionad[oa]|checked|on)\s/.test(cls) ||
      alvo.getAttribute("aria-pressed") === "true" ||
      !!iconeVisivel;
    lista.push({ sigla: sigla, ativo: !!ativo });
  });
  return lista;
}

/** Siglas atualmente marcadas (null se nao conseguiu ler a tela). */
function divisoesSelecionadasDash() {
  const chips = chipsDivisaoDash();
  if (chips.length) {
    return chips.filter(function (c) { return c.ativo; }).map(function (c) { return c.sigla; });
  }
  try {
    const v = JSON.parse(sessionStorage.getItem("mapa_filtro_divisoes") || "null");
    return Array.isArray(v) ? v.map(function (x) { return String(x).trim().toUpperCase(); }) : null;
  } catch (e) { return null; }
}

/** true quando a selecao de divisoes e diferente do padrao do usuario. */
function divisoesFiltradasDash() {
  const padrao = divisoesPadraoDash().map(function (x) { return String(x).toUpperCase(); });
  let atual = null;
  const chips = chipsDivisaoDash();
  if (chips.length) {
    atual = chips.filter(function (c) { return c.ativo; }).map(function (c) { return c.sigla; });
  } else {
    try {
      const v = JSON.parse(sessionStorage.getItem("mapa_filtro_divisoes") || "null");
      if (Array.isArray(v)) atual = v.map(function (x) { return String(x).trim().toUpperCase(); });
    } catch (e) {}
  }
  if (!atual) return false;
  if (atual.length !== padrao.length) return true;
  return padrao.some(function (d) { return atual.indexOf(d) < 0; });
}

/** Recalcula a vassoura (contagem de filtros) sem redesenhar o dashboard. */
function atualizarVassouraPorDivisaoDash() {
  const base = Number(window._qtdFiltrosBaseDash) || 0;
  atualizarBotaoVassouraDash(base + (divisoesFiltradasDash() ? 1 : 0) + qtdFiltroPeriodoDash());
}

// ---------- Filtro de PERIODO (meses / ano) ----------
let _anoPadraoDash = null;
function anoPadraoDash() {
  if (_anoPadraoDash === null) {
    const el = document.getElementById("filtroAnoGlobal");
    _anoPadraoDash = el ? String(el.value) : "";
  }
  return _anoPadraoDash;
}
function qtdFiltroPeriodoDash() {
  let q = 0;
  if (typeof mesesSelecionadosDashboard !== "undefined" && mesesSelecionadosDashboard.size > 0) q++;
  const el = document.getElementById("filtroAnoGlobal");
  if (el && String(el.value) !== anoPadraoDash()) q++;
  return q;
}
function restaurarPeriodoDash() {
  if (!qtdFiltroPeriodoDash()) return false;
  mesesSelecionadosDashboard.clear();
  document.querySelectorAll(".chip-mes-dashboard").forEach(function (c) { c.classList.remove("active"); });
  const el = document.getElementById("filtroAnoGlobal");
  if (el) el.value = anoPadraoDash();
  if (typeof atualizarResumoMesAno === "function") atualizarResumoMesAno();
  return true;
}

// Observa os chips de divisao: qualquer mudanca na tela atualiza a vassoura
(function observarChipsDivisaoDash() {
  let obs = null, n = 0;
  function ligar() {
    const card = cardDivisoesDash();
    if (!card) { if (++n < 40) setTimeout(ligar, 300); return; }
    if (obs) obs.disconnect();
    let pend = null;
    obs = new MutationObserver(function () {
      clearTimeout(pend);
      pend = setTimeout(atualizarVassouraPorDivisaoDash, 120);
    });
    obs.observe(card, { subtree: true, childList: true, attributes: true, characterData: true,
      attributeFilter: ["class", "aria-pressed", "style"] });
    atualizarVassouraPorDivisaoDash();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ligar);
  else ligar();
})();

/** Procura o botao "Todas" subindo a partir dos chips de divisao. */
function botaoTodasDivisoesDash() {
  let no = document.getElementById("chipsDivisoes") || document.querySelector(".divisao-filter-multi");
  for (let nivel = 0; no && nivel < 6; nivel++, no = no.parentElement) {
    const cands = no.querySelectorAll("button, span, a, label, div");
    for (let i = 0; i < cands.length; i++) {
      const el = cands[i];
      if (el.children.length > 2) continue;
      const t = String(el.textContent || "").replace(/[^A-Za-zÀ-ú]/g, "").toLowerCase();
      if (t === "todas") return el.closest("button, [onclick], [class*='chip'], [class*='btn']") || el;
    }
  }
  return null;
}

// ---------- Divisao do usuario logado ----------
const SIGLAS_VISAO_GERAL_DASH = ["SEPREC"];
function divisaoUsuarioDash() {
  try {
    const u = JSON.parse(sessionStorage.getItem("mapa_user") || "{}") || {};
    return String(u.divisao || "").trim().toUpperCase();
  } catch (e) { return ""; }
}
function usuarioVisaoGeralDash() {
  return SIGLAS_VISAO_GERAL_DASH.indexOf(divisaoUsuarioDash()) >= 0;
}

/** Botao do filtro de divisoes pelo texto ("todas", "so at", ...). */
function botaoFiltroDivisaoPorTextoDash(alvoTexto) {
  const alvo = String(alvoTexto).replace(/[^A-Za-zÀ-ú]/g, "").toLowerCase();
  let no = document.getElementById("chipsDivisoes") || document.querySelector(".divisao-filter-multi");
  for (let nivel = 0; no && nivel < 6; nivel++, no = no.parentElement) {
    const cands = no.querySelectorAll("button, a, span, label, div");
    for (let i = 0; i < cands.length; i++) {
      const el = cands[i];
      if (el.children.length > 2) continue;
      const t = String(el.textContent || "").replace(/[^A-Za-zÀ-ú]/g, "").toLowerCase();
      if (t === alvo) return el.closest("button, [onclick], [class*='chip'], [class*='btn']") || el;
    }
  }
  return null;
}
function botaoTodasDivisoesDash() { return botaoFiltroDivisaoPorTextoDash("todas"); }

/** Divisoes que a vassoura deve deixar: so a do usuario (SEPREC = todas). */
function divisoesPadraoDash() {
  const minha = divisaoUsuarioDash();
  if (usuarioVisaoGeralDash() || !minha) {
    return (typeof window.seprecDivisoes === "function") ? window.seprecDivisoes() : siglasChipsDivisaoDash();
  }
  return [minha];
}

/** Atualiza os Sets globais de divisao do filtro multi (se existirem neste escopo). */
function preencherSetsDivisaoDash(lista) {
  ["divisoesSelecionadasMulti", "divisoesSelecionadas", "divisoesSelecionadasDash",
   "divisoesSelecionadasDashboard", "selecaoDivisoes", "divisoesAtivas"].forEach(function (nome) {
    let alvo = null;
    try {
      // eslint-disable-next-line no-eval
      alvo = (0, eval)("typeof " + nome + " !== 'undefined' ? " + nome + " : null");
    } catch (e) { alvo = null; }
    if (!alvo) return;
    if (typeof alvo.clear === "function" && typeof alvo.add === "function") {
      alvo.clear(); lista.forEach(function (d) { alvo.add(d); });
    } else if (Array.isArray(alvo)) {
      alvo.length = 0; lista.forEach(function (d) { alvo.push(d); });
    }
  });
}

/**
 * Limpar divisoes SEM clicar em botao: grava a selecao padrao na sessao
 * (mesma chave que o filtro de divisoes le) e manda o filtro se redesenhar.
 */
function restaurarTodasDivisoesDash() {
  if (!divisoesFiltradasDash()) return false;
  const padrao = divisoesPadraoDash();

  try { sessionStorage.setItem("mapa_filtro_divisoes", JSON.stringify(padrao)); } catch (e) {}
  preencherSetsDivisaoDash(padrao);

  const recarregar = function () { invalidarCacheDashboard(); atualizarTudo(); };
  if (typeof window.renderizarFiltroMultiDivisao === "function") {
    try { window.renderizarFiltroMultiDivisao(recarregar); }
    catch (e) { console.warn("[Vassoura] Falha ao redesenhar divisões:", e); }
  } else if (typeof renderizarFiltroMultiDivisao === "function") {
    try { renderizarFiltroMultiDivisao(recarregar); } catch (e) {}
  }

  // Conferencia: se os chips nao refletirem, clica nos que estao errados
  setTimeout(function () {
    const card = cardDivisoesDash();
    if (!card) return;
    chipsDivisaoDash().forEach(function (c) {
      const deveFicar = padrao.indexOf(c.sigla) >= 0;
      if (c.ativo === deveFicar) return;
      const el = Array.prototype.find.call(card.querySelectorAll("button, [class*='chip']"), function (x) {
        return x.children.length <= 2 &&
          String(x.textContent || "").replace(/[^A-Za-z]/g, "").toUpperCase() === c.sigla;
      });
      if (el) el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    });
    atualizarVassouraPorDivisaoDash();
  }, 400);

  console.log("[Vassoura] Divisões restauradas para:", padrao.join(", "));
  return true;
}

document.addEventListener("DOMContentLoaded", function () {
  setTimeout(function () { atualizarVassouraPorDivisaoDash(); }, 600);
});

// Clique nos chips de divisao: atualiza a vassoura na hora
document.addEventListener("click", function (e) {
  if (!e.target || !e.target.closest) return;
  if (!e.target.closest("#chipsDivisoes, .divisao-filter-multi")) return;
  [150, 450, 900].forEach(function (t) { setTimeout(atualizarVassouraPorDivisaoDash, t); });
}, true);

// ---------- Esconde o circulo verde que fica colado na borda direita ----------
function esconderCirculoVerdeCantoDash() {
  const W = window.innerWidth, H = window.innerHeight;
  document.querySelectorAll("body *").forEach(function (el) {
    if (el.id === "fabLimparFiltrosDash" || el.closest("#fabLimparFiltrosDash, .pa-pop, .streak-banner")) return;
    const cs = getComputedStyle(el);
    if (cs.position !== "fixed" || cs.display === "none") return;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const noCanto = r.right > W - 30 && r.bottom > H - 220;
    const cortado = r.right > W + 1 || r.left > W - 30;
    if (noCanto && cortado && r.width < 120 && r.height < 120) {
      el.style.display = "none";
      console.log("[Dashboard] Elemento do canto direito ocultado:", el);
    }
  });
}
document.addEventListener("DOMContentLoaded", function () {
  [800, 2000, 4000].forEach(function (t) { setTimeout(esconderCirculoVerdeCantoDash, t); });
});

const SVG_VASSOURA_DASH =
  '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" ' +
       'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M19.5 3.5 12.6 10.4"/>' +
    '<path d="M9.2 9.6c1.6-.9 3.6-.6 4.9.7s1.6 3.3.7 4.9L13.6 17 7 10.4l2.2-.8Z"/>' +
    '<path d="M7 10.4 3.4 14c-.6.6-.6 1.6 0 2.2l4.4 4.4c.6.6 1.6.6 2.2 0l3.6-3.6"/>' +
    '<path d="m5.6 17.4 1.6-1.6"/>' +
    '<path d="m8.2 19.6 1.4-1.4"/>' +
  '</svg>';

function injetarEstiloVassouraDash() {
  if (document.getElementById("estiloFabVassouraDash")) return;
  const st = document.createElement("style");
  st.id = "estiloFabVassouraDash";
  st.textContent = `
  #fabLimparFiltrosDash{
    position:fixed;right:24px;bottom:24px;z-index:8500;
    width:56px;height:56px;border-radius:50%;border:0;cursor:pointer;
    display:flex;align-items:center;justify-content:center;
    color:#ffffff;
    background:linear-gradient(135deg,#e05a5a,#b93a3a);
    box-shadow:0 8px 22px rgba(224,90,90,.40),0 2px 6px rgba(0,0,0,.35);
    opacity:0;transform:scale(.6) translateY(20px);pointer-events:none;
    transition:opacity .25s ease,transform .25s ease,box-shadow .2s ease,bottom .25s ease;
  }
  #fabLimparFiltrosDash.visivel{opacity:1;transform:scale(1) translateY(0);pointer-events:auto;
    animation:fabFlutuar 3s ease-in-out infinite;}
  @keyframes fabFlutuar{
    0%,100%{transform:translateY(0);box-shadow:0 8px 22px rgba(224,90,90,.40),0 0 0 0 rgba(224,90,90,.45);}
    50%{transform:translateY(-6px);box-shadow:0 14px 26px rgba(224,90,90,.45),0 0 0 9px rgba(224,90,90,0);}
  }
  #fabLimparFiltrosDash.visivel:hover{animation-play-state:paused;}
  #fabLimparFiltrosDash.visivel:hover{
    transform:scale(1.08);
    box-shadow:0 12px 28px rgba(224,90,90,.55),0 2px 8px rgba(0,0,0,.35);
  }
  #fabLimparFiltrosDash svg{transform-origin:80% 20%;}
  #fabLimparFiltrosDash:hover svg{animation:fabVarrer .6s ease-in-out infinite;}
  #fabLimparFiltrosDash.varrendo svg{animation:fabVarrer .45s ease-in-out 2;}
  @keyframes fabVarrer{
    0%,100%{transform:rotate(0deg);}
    30%{transform:rotate(-18deg);}
    70%{transform:rotate(14deg);}
  }
  #fabLimparFiltrosDash.sem-filtro{filter:saturate(.75);}
  #fabLimparFiltrosDash .fab-badge{
    position:absolute;top:-3px;right:-3px;min-width:21px;height:21px;padding:0 6px;
    border-radius:11px;background:#f5c94a;color:#2f2600;
    font-size:11.5px;font-weight:800;line-height:17px;text-align:center;
    border:2px solid #0f2333;box-sizing:border-box;
  }
  #fabLimparFiltrosDash .fab-tip{
    position:absolute;right:calc(100% + 12px);top:50%;transform:translateY(-50%);
    white-space:nowrap;font-size:12.5px;font-weight:700;
    background:#0f2333;color:#e8f4f8;border:1px solid rgba(224,90,90,.45);
    border-radius:8px;padding:6px 11px;box-shadow:0 8px 20px rgba(0,0,0,.35);
    opacity:0;pointer-events:none;transition:opacity .15s ease;
  }
  #fabLimparFiltrosDash:hover .fab-tip{opacity:1;}
  html[data-theme="light"] #fabLimparFiltrosDash .fab-badge{border-color:#ffffff;}
  html[data-theme="light"] #fabLimparFiltrosDash .fab-tip{
    background:#ffffff;color:#12333f;box-shadow:0 8px 20px rgba(15,40,60,.18);
  }
  /* Com o pop-up de planos em atraso aberto, o botao sobe para nao ficar por baixo dele */
  body.pa-pop-aberto #fabLimparFiltrosDash{bottom:330px;}
  body.modo-apresentacao #fabLimparFiltrosDash{display:none;}
  @media print{#fabLimparFiltrosDash{display:none !important;}}
  `;
  document.head.appendChild(st);
}

function garantirBotaoVassouraDash() {
  let fab = document.getElementById("fabLimparFiltrosDash");
  if (fab) return fab;
  injetarEstiloVassouraDash();
  fab = document.createElement("button");
  fab.id = "fabLimparFiltrosDash";
  fab.type = "button";
  fab.setAttribute("aria-label", "Limpar filtros");
  fab.innerHTML =
    SVG_VASSOURA_DASH +
    '<span class="fab-badge" id="fabLimparFiltrosQtd">0</span>' +
    '<span class="fab-tip">Limpar filtros</span>';
  fab.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    limparTodosFiltrosDashboard();
  });
  document.body.appendChild(fab);
  return fab;
}

function atualizarBotaoVassouraDash(qtd) {
  const fab = garantirBotaoVassouraDash();
  const badge = document.getElementById("fabLimparFiltrosQtd");
  if (badge) {
    badge.textContent = qtd;
    badge.style.display = qtd > 0 ? "" : "none";
  }
  fab.classList.add("visivel");                 // sempre visivel, igual ao botao de menu
  fab.classList.toggle("sem-filtro", !(qtd > 0));
  const tip = fab.querySelector(".fab-tip");
  if (tip) tip.textContent = qtd > 0 ? "Limpar filtros (" + qtd + ")" : "Limpar filtros";
  document.body.classList.toggle("pa-pop-aberto", !!document.querySelector(".pa-pop"));
}

// ============================================================
//  ACESSO SEPREC - ve todas as divisoes por padrao
// ============================================================
(function () {
  "use strict";

  const SIGLAS_VISAO_GERAL = ["SEPREC"];
  const DIVISOES_PADRAO = ["DPROC", "DC", "DPP", "CJ", "AA", "AT", "DCGA"];
  const CHAVE_FILTRO_DASH = "mapa_filtro_divisoes";

  function norm(v) {
    return String(v == null ? "" : v).trim().toUpperCase();
  }

  function usuarioSessao() {
    try { return JSON.parse(sessionStorage.getItem("mapa_user") || "{}") || {}; }
    catch (e) { return {}; }
  }

  function temVisaoGeral() {
    const u = usuarioSessao();
    let d = norm(u.divisao);
    if (!d && typeof user === "object" && user) d = norm(user.divisao);
    return SIGLAS_VISAO_GERAL.indexOf(d) >= 0;
  }

  function todasAsDivisoes() {
    try {
      if (typeof NOMES_DIVISOES !== "undefined" && NOMES_DIVISOES) {
        const k = Object.keys(NOMES_DIVISOES);
        if (k.length) return k;
      }
    } catch (e) {}
    try {
      if (typeof NOMES_DIVISOES_MULTI !== "undefined" && NOMES_DIVISOES_MULTI) {
        const k = Object.keys(NOMES_DIVISOES_MULTI);
        if (k.length) return k;
      }
    } catch (e) {}
    try {
      if (typeof NOMES_DIVISOES_DASH !== "undefined" && NOMES_DIVISOES_DASH) {
        const k = Object.keys(NOMES_DIVISOES_DASH);
        if (k.length) return k;
      }
    } catch (e) {}
    return DIVISOES_PADRAO.slice();
  }

  if (!temVisaoGeral()) {
    console.log("[SEPREC] Usuario sem visao geral - comportamento padrao mantido.");
    return;
  }

  const DIVISOES = todasAsDivisoes();
  console.log("[SEPREC] Visao geral ativa. Divisoes:", DIVISOES.join(", "));

  function liberarPerfil(nomeFuncao) {
    if (typeof window[nomeFuncao] !== "function") return false;
    if (window[nomeFuncao].__seprec) return true;
    const original = window[nomeFuncao];
    const wrap = function () {
      if (temVisaoGeral()) return true;
      return original.apply(this, arguments);
    };
    wrap.__seprec = true;
    window[nomeFuncao] = wrap;
    return true;
  }

  function liberarTodosOsPerfis() {
    liberarPerfil("usuarioEhGestor");
    liberarPerfil("usuarioEhGestorTrat");
    liberarPerfil("isGestorMulti");
  }

  liberarTodosOsPerfis();

  function prepararFiltroDashboard() {
    let atual = null;
    try { atual = JSON.parse(sessionStorage.getItem(CHAVE_FILTRO_DASH) || "null"); }
    catch (e) { atual = null; }

    const jaDefinido = Array.isArray(atual) && atual.length > 0 &&
                       atual.indexOf("SEPREC") < 0;
    if (jaDefinido) return;

    try {
      sessionStorage.setItem(CHAVE_FILTRO_DASH, JSON.stringify(DIVISOES));
      console.log("[SEPREC] Filtro do dashboard iniciado com todas as divisoes.");
    } catch (e) {}
  }

  prepararFiltroDashboard();

  function preencherSet(nome) {
    let alvo = null;
    try {
      // eslint-disable-next-line no-eval
      alvo = (0, eval)("typeof " + nome + " !== 'undefined' ? " + nome + " : null");
    } catch (e) {
      alvo = null;
    }
    if (!alvo || typeof alvo.add !== "function") return false;

    SIGLAS_VISAO_GERAL.forEach(function (s) { alvo.delete(s); });

    let mudou = false;
    DIVISOES.forEach(function (d) {
      if (!alvo.has(d)) { alvo.add(d); mudou = true; }
    });
    return mudou;
  }

  let _jaAplicouRiscos = false;
  let _jaAplicouTrat = false;

  function aplicarRiscos() {
    if (_jaAplicouRiscos) return true;
    if (typeof window.sincronizarSelecaoDivisoesRiscos !== "function") return false;
    const mudou = preencherSet("divisoesSelecionadasRiscos");
    if (!mudou) return false;
    _jaAplicouRiscos = true;
    try {
      window.sincronizarSelecaoDivisoesRiscos();
      console.log("[SEPREC] Pagina de Riscos: todas as divisoes marcadas.");
    } catch (e) {
      console.warn("[SEPREC] Falha ao sincronizar Riscos:", e);
    }
    return true;
  }

  function aplicarTratamento() {
    if (_jaAplicouTrat) return true;
    if (typeof window.sincronizarSelecaoDivisoesTrat !== "function") return false;
    const mudou = preencherSet("divisoesSelecionadasTrat");
    if (!mudou) return false;
    _jaAplicouTrat = true;
    try {
      window.sincronizarSelecaoDivisoesTrat();
      console.log("[SEPREC] Pagina de Tratamento: todas as divisoes marcadas.");
    } catch (e) {
      console.warn("[SEPREC] Falha ao sincronizar Tratamento:", e);
    }
    return true;
  }

  function aplicarDashboard() {
    if (typeof window.renderizarFiltroMultiDivisao !== "function") return false;
    if (typeof window.atualizarTudo !== "function") return false;
    prepararFiltroDashboard();
    try {
      window.renderizarFiltroMultiDivisao(function () {
        if (typeof window.atualizarTudo === "function") window.atualizarTudo();
      });
      window.atualizarTudo();
      console.log("[SEPREC] Dashboard: todas as divisoes marcadas.");
    } catch (e) {
      console.warn("[SEPREC] Falha ao aplicar no Dashboard:", e);
    }
    return true;
  }

  function tentativa() {
    liberarTodosOsPerfis();

    const ehRiscos = typeof window.sincronizarSelecaoDivisoesRiscos === "function";
    const ehTrat   = typeof window.sincronizarSelecaoDivisoesTrat === "function";
    const ehDash   = typeof window.renderizarFiltroMultiDivisao === "function" &&
                     typeof window.atualizarTudo === "function";

    let pronto = false;
    if (ehTrat)   pronto = aplicarTratamento() || pronto;
    if (ehRiscos) pronto = aplicarRiscos()     || pronto;
    if (ehDash)   pronto = aplicarDashboard()  || pronto;
    return pronto;
  }

  function iniciar() {
    let n = 0;
    const timer = setInterval(function () {
      n++;
      if (tentativa() || n > 40) {
        clearInterval(timer);
      }
    }, 300);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }

  window.seprecVisaoGeral = temVisaoGeral;
  window.seprecDivisoes = function () { return DIVISOES.slice(); };
  window.seprecReaplicar = function () {
    _jaAplicouRiscos = false;
    _jaAplicouTrat = false;
    try { sessionStorage.removeItem(CHAVE_FILTRO_DASH); } catch (e) {}
    tentativa();
  };

  console.log("[SEPREC] Script de visao geral carregado.");
})();

// ============================================================
// PDF EXECUTIVO
// ============================================================
const REL_COR_NIVEL = {
  baixo: { cor: '#2eb87a', fundo: '#eaf7f0', label: 'Baixo (até 6)' },
  medio: { cor: '#e0a800', fundo: '#fdf6e1', label: 'Médio (7 a 19)' },
  alto:  { cor: '#d64545', fundo: '#fbeaea', label: 'Alto (20 a 25)' }
};
const REL_AZUL = '#193451', REL_TEAL = '#0e9aa7', REL_CINZA = '#5b6f7d';

function relFaixa(valor) {
  const n = Number(valor) || 0;
  if (n >= 20) return 'alto';
  if (n >= 7) return 'medio';
  return 'baixo';
}

function relFmt(n) {
  return (Number(n) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}

function montarDadosRelatorioExecutivo() {
  const base = window._dadosDashboardAtual || { todosProcessos: [], todosRiscos: [] };
  const processos = (base.todosProcessos || []).slice();
  const riscos = (base.todosRiscos || []).slice();
  const ordem = Object.keys(NOMES_DIVISOES_DASH);
  const grupos = new Map();

  processos.forEach(function (p) {
    const sigla = divisaoDoProcessoDash(p) || 'SEM DIVISÃO';
    if (!grupos.has(sigla)) grupos.set(sigla, { sigla: sigla, processos: [] });
    grupos.get(sigla).processos.push(p);
  });

  const divisoes = Array.from(grupos.values()).sort(function (a, b) {
    const ia = ordem.indexOf(a.sigla), ib = ordem.indexOf(b.sigla);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.sigla.localeCompare(b.sigla, 'pt-BR');
  });

  const todos = [];
  divisoes.forEach(function (div) {
    div.nome = NOMES_DIVISOES_DASH[div.sigla] || div.sigla;
    div.processos.sort(function (a, b) {
      return String(a.processo || '').localeCompare(String(b.processo || ''), 'pt-BR');
    });
    div.processos.forEach(function (proc, iProc) {
      const codProc = 'P' + String(iProc + 1).padStart(2, '0');
      proc._riscos = riscos.filter(function (r) {
        return String(r.processoId) === String(proc.id) &&
          String(r._divisao || div.sigla).trim().toUpperCase() === div.sigla;
      }).sort(function (a, b) {
        return String(a.id).localeCompare(String(b.id), 'pt-BR', { numeric: true });
      }).map(function (r, i) {
        const c = Object.assign({}, r);
        c._rotulo = div.sigla + ' - ' + codProc + ' - R' + String(i + 1).padStart(2, '0');
        c._divisaoSigla = div.sigla;
        c._nomeProcesso = proc.processo || 'Processo sem nome';
        c._inerente = (Number(r.prob) || 0) * (Number(r.imp) || 0);
        c._residual = c._inerente * (Number(r.nivelControle) || 1);
        c._final = nivelFinalRegraDash(r);
        c._visao = valorVisaoDash(r);   // valor exibido na matriz/destaques/unidades
        todos.push(c);
        return c;
      });
    });
    div.processos = div.processos.filter(function (p) { return p._riscos.length > 0; });
    div.riscos = div.processos.reduce(function (a, p) { return a.concat(p._riscos); }, []);
  });

  function kpi(lista, nProc) {
    const t = { processos: nProc, riscos: lista.length, baixo: 0, medio: 0, alto: 0, aTratar: 0, somaNivel: 0 };
    lista.forEach(function (r) {
      t[relFaixa(r._residual)]++;
      t.somaNivel += Number(r._residual) || 0;
      if (riscoTratadoDash(r)) t.aTratar++;
    });
    return t;
  }

  const presentes = divisoes.filter(function (d) { return d.riscos.length > 0; });
  presentes.forEach(function (d) { d.kpi = kpi(d.riscos, d.processos.length); });

  const unidades = new Map();
  const procResumo = [];
  presentes.forEach(function (div) {
    div.processos.forEach(function (proc) {
      const nomeUnidade = String(div.nome || div.sigla).trim();
      const chaveUnidade = div.sigla + '|' + nomeUnidade;
      if (!unidades.has(chaveUnidade)) unidades.set(chaveUnidade, {
        nome: nomeUnidade, sigla: div.sigla, quantidade: 0
      });
      unidades.get(chaveUnidade).quantidade += proc._riscos.length;
      procResumo.push({
        nome: String(proc.processo || 'Processo sem nome'), sigla: div.sigla,
        quantidade: proc._riscos.length
      });
    });
  });

  function extremos(lista) {
    const b = lista.slice().sort(function (a, c) {
      return a.quantidade - c.quantidade || a.sigla.localeCompare(c.sigla, 'pt-BR') ||
        a.nome.localeCompare(c.nome, 'pt-BR');
    });
    return { menor: b[0] || null, maior: b[b.length - 1] || null };
  }

  return {
    divisoes: presentes, riscos: todos,
    destaques: { unidades: extremos(Array.from(unidades.values())), processos: extremos(procResumo) },
    totais: kpi(todos, presentes.reduce(function (n, d) { return n + d.processos.length; }, 0))
  };
}

function relTop10(lista) {
  return lista.slice().sort(function (a, b) {
    return b._final - a._final ||
      a._rotulo.localeCompare(b._rotulo, 'pt-BR', { numeric: true });
  }).slice(0, 10);
}

// ---------- utilitários de desenho ----------
function relCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível para gerar o relatório.');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
  ctx.textBaseline = 'alphabetic';
  return { canvas: canvas, ctx: ctx };
}

function relRet(ctx, x, y, w, h, r, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
}

function relCorta(ctx, texto, largura) {
  let s = String(texto == null ? '' : texto).replace(/\s+/g, ' ').trim();
  if (ctx.measureText(s).width <= largura) return s;
  while (s.length && ctx.measureText(s + '…').width > largura) s = s.slice(0, -1);
  return s + '…';
}

function relQuebra(ctx, texto, largura, maxLinhas) {
  const palavras = String(texto || '—').replace(/\s+/g, ' ').trim().split(' ');
  const linhas = []; let atual = '';
  palavras.forEach(function (p) {
    const t = atual ? atual + ' ' + p : p;
    if (ctx.measureText(t).width > largura && atual) { linhas.push(atual); atual = p; }
    else atual = t;
  });
  if (atual) linhas.push(atual);
  if (linhas.length > maxLinhas) {
    const v = linhas.slice(0, maxLinhas);
    v[maxLinhas - 1] = relCorta(ctx, v[maxLinhas - 1] + ' ' + linhas.slice(maxLinhas).join(' '), largura);
    return v;
  }
  return linhas;
}

function relTitulo(ctx, titulo, subtitulo) {
  ctx.fillStyle = REL_TEAL; ctx.fillRect(40, 18, 6, 52);
  ctx.fillStyle = REL_AZUL; ctx.font = 'bold 30px Arial';
  ctx.fillText(titulo, 60, 44);
  ctx.fillStyle = REL_CINZA; ctx.font = '17px Arial';
  ctx.fillText(subtitulo, 60, 68);
}

function relKPIs(ctx, k, x, y, largura, vertical) {
  const itens = [
    ['MÉDIA DE NÍVEL DE RISCOS', k.riscos ? relFmt(k.somaNivel / k.riscos) : '—',
      k.riscos ? REL_COR_NIVEL[relFaixa(k.somaNivel / k.riscos)].cor : REL_CINZA],
    ['PROCESSOS', k.processos, REL_AZUL],
    ['RISCOS', k.riscos, REL_TEAL],
    ['BAIXO', k.baixo, REL_COR_NIVEL.baixo.cor],
    ['MÉDIO', k.medio, REL_COR_NIVEL.medio.cor],
    ['ALTO', k.alto, REL_COR_NIVEL.alto.cor],
    ['A TRATAR', k.aTratar, '#7e57c2']
  ];
  const gap = 14;
  const w = vertical ? largura : (largura - gap * (itens.length - 1)) / itens.length;
  const h = vertical ? 72 : 82;
  itens.forEach(function (it, i) {
    const cx = vertical ? x : x + i * (w + gap);
    const cy = vertical ? y + i * (h + gap) : y;
    relRet(ctx, cx, cy, w, h, 10, '#f5f8fa', '#e3eaee');
    ctx.fillStyle = it[2]; relRet(ctx, cx, cy, 6, h, 3, it[2]);
    ctx.fillStyle = it[2]; ctx.font = 'bold ' + (vertical ? 30 : 32) + 'px Arial';
    ctx.fillText(String(it[1]), cx + 17, cy + (vertical ? 42 : 38));
    ctx.fillStyle = REL_CINZA; ctx.font = 'bold 10px Arial';
    const linhasRot = relQuebra(ctx, it[0], w - 26, 2);
    linhasRot.forEach(function (l, j) {
      ctx.fillText(l, cx + 17, cy + h - 12 - (linhasRot.length - 1 - j) * 12);
    });
  });
}

function relGrafico(ctx, itens, op) {
  const x0 = op.x + 70, y0 = op.y + 10;
  const pw = op.w - 70 - 20, ph = op.h - 70;
  const maxX = 25, slots = 10, rowH = ph / slots;

  [[0, 7, 'baixo'], [7, 20, 'medio'], [20, 25, 'alto']].forEach(function (f) {
    ctx.fillStyle = REL_COR_NIVEL[f[2]].fundo;
    ctx.fillRect(x0 + pw * f[0] / maxX, y0, pw * (f[1] - f[0]) / maxX, ph);
  });

  ctx.font = '15px Arial'; ctx.textAlign = 'center';
  for (let v = 0; v <= maxX; v += 5) {
    const px = x0 + pw * v / maxX;
    ctx.strokeStyle = 'rgba(25,52,81,.10)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px, y0); ctx.lineTo(px, y0 + ph); ctx.stroke();
    ctx.fillStyle = REL_CINZA; ctx.fillText(String(v), px, y0 + ph + 24);
  }
  ctx.fillStyle = REL_AZUL; ctx.font = 'bold 16px Arial';
  ctx.fillText('Nível atual do risco (final se tratado; residual se não)', x0 + pw / 2, y0 + ph + 52);

  ctx.textAlign = 'right'; ctx.font = 'bold 15px Arial';
  for (let i = 0; i < slots; i++) {
    const yy = y0 + rowH * (i + .5);
    ctx.strokeStyle = 'rgba(25,52,81,.07)';
    ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x0 + pw, yy); ctx.stroke();
    ctx.fillStyle = i < itens.length ? REL_AZUL : '#b8c4cc';
    ctx.fillText((i + 1) + 'º', x0 - 14, yy + 5);
  }
  ctx.save(); ctx.translate(op.x + 16, y0 + ph / 2); ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center'; ctx.fillStyle = REL_AZUL; ctx.font = 'bold 16px Arial';
  ctx.fillText('Ranking', 0, 0); ctx.restore();

  ctx.strokeStyle = '#8fa2ae'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0, y0 + ph); ctx.lineTo(x0 + pw, y0 + ph); ctx.stroke();

  ctx.textAlign = 'left';
  itens.forEach(function (r, i) {
    const yy = y0 + rowH * (i + .5);
    const px = x0 + pw * Math.max(0, Math.min(maxX, r._final)) / maxX;
    const cor = REL_COR_NIVEL[relFaixa(r._final)].cor;
    const texto = r._rotulo + '  ·  ' + relFmt(r._final);
    ctx.font = 'bold 16px Arial';
    const tw = ctx.measureText(texto).width + 20, th = 28;
    const direita = px + 18 + tw <= x0 + pw;
    const lx = direita ? px + 16 : px - 16 - tw;
    relRet(ctx, lx, yy - th / 2, tw, th, 7, '#ffffff', cor);
    ctx.fillStyle = REL_AZUL; ctx.fillText(texto, lx + 10, yy + 6);
    ctx.beginPath(); ctx.arc(px, yy, 10, 0, Math.PI * 2);
    ctx.fillStyle = cor; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#ffffff'; ctx.stroke();
  });
}

function relLegenda(ctx, x, y, totalRiscos, exibidos) {
  let lx = x;
  ctx.font = 'bold 15px Arial'; ctx.textAlign = 'left';
  ['baixo', 'medio', 'alto'].forEach(function (k) {
    ctx.beginPath(); ctx.arc(lx + 8, y - 5, 8, 0, Math.PI * 2);
    ctx.fillStyle = REL_COR_NIVEL[k].cor; ctx.fill();
    ctx.fillStyle = REL_AZUL; ctx.fillText(REL_COR_NIVEL[k].label, lx + 24, y);
    lx += ctx.measureText(REL_COR_NIVEL[k].label).width + 60;
  });
  if (totalRiscos > exibidos) {
    ctx.fillStyle = REL_CINZA; ctx.font = 'italic 15px Arial'; ctx.textAlign = 'right';
    ctx.fillText('ⓘ Exibindo os ' + exibidos + ' maiores níveis. Os demais ' +
      (totalRiscos - exibidos) + ' risco(s) estão abaixo destes.', 1366, y);
    ctx.textAlign = 'left';
  }
}

const REL_W = 1400, REL_H = 780;

function relPaginaTabela(itens, titulo, subtitulo) {
  const c = relCanvas(REL_W, REL_H), ctx = c.ctx;
  relTitulo(ctx, titulo, subtitulo);
  const cols = [
    { t: 'Nº', x: 40, w: 60 }, { t: 'Código', x: 100, w: 190 },
    { t: 'Processo de Trabalho', x: 290, w: 380 }, { t: 'Risco (evento)', x: 670, w: 560 },
    { t: 'Nível', x: 1230, w: 130 }
  ];
  let y = 96;
  relRet(ctx, 40, y, 1320, 40, 8, REL_AZUL);
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 15px Arial';
  cols.forEach(function (cl) { ctx.fillText(cl.t, cl.x + 14, y + 26); });
  y += 46;
  const rowH = 60;
  itens.forEach(function (r, i) {
    const faixa = relFaixa(r._final);
    relRet(ctx, 40, y, 1320, rowH - 6, 8, i % 2 ? '#ffffff' : '#f5f8fa', '#e3eaee');
    ctx.fillStyle = REL_AZUL; ctx.font = 'bold 16px Arial';
    ctx.fillText((i + 1) + 'º', cols[0].x + 14, y + 33);
    ctx.fillText(r._rotulo, cols[1].x + 14, y + 33);
    ctx.font = '14px Arial'; ctx.fillStyle = '#2b4253';
    relQuebra(ctx, r._nomeProcesso, cols[2].w - 24, 2).forEach(function (l, k, arr) {
      ctx.fillText(l, cols[2].x + 14, y + (arr.length === 1 ? 33 : 24 + k * 18));
    });
    relQuebra(ctx, r.evento || 'Não informado', cols[3].w - 24, 2).forEach(function (l, k, arr) {
      ctx.fillText(l, cols[3].x + 14, y + (arr.length === 1 ? 33 : 24 + k * 18));
    });
    relRet(ctx, cols[4].x + 14, y + 12, 96, 30, 15, REL_COR_NIVEL[faixa].cor);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 16px Arial'; ctx.textAlign = 'center';
    ctx.fillText(relFmt(r._final), cols[4].x + 62, y + 33); ctx.textAlign = 'left';
    y += rowH;
  });
  return c.canvas;
}

function relPaginaDivisao(div) {
  const c = relCanvas(REL_W, REL_H), ctx = c.ctx;
  const top = relTop10(div.riscos);
  relTitulo(ctx, div.sigla + '  ·  ' + div.nome, 'Detalhamento da divisão');
  relKPIs(ctx, div.kpi, 40, 96, 210, true);
  ctx.fillStyle = REL_AZUL; ctx.font = 'bold 20px Arial';
  ctx.fillText('Maiores níveis de risco da divisão', 290, 112);
  relGrafico(ctx, top, { x: 280, y: 126, w: 1080, h: 610 });
  relLegenda(ctx, 350, 764, div.riscos.length, top.length);
  return c.canvas;
}

// ---------- PÁGINAS EXTRAS ----------
function relEtapaAtual(r) {
  const et = (typeof obterEtapasDash === 'function') ? obterEtapasDash(r) : [];
  return et.length ? et[et.length - 1] : null;
}
function relTemPlano(r) {
  const e = relEtapaAtual(r);
  return !!(e && e.opcao && e.descricao);
}
function relDataPrazo(e) {
  if (!e || !e.prazo) return null;
  const d = new Date(String(e.prazo).slice(0, 10) + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}
function relDataBR(d) { return d ? d.toLocaleDateString('pt-BR') : '—'; }
function relHoje() { const h = new Date(); h.setHours(0, 0, 0, 0); return h; }

function relSemDados(ctx, msg) {
  relRet(ctx, 40, 110, 1320, 90, 10, '#f5f8fa', '#e3eaee');
  ctx.fillStyle = REL_CINZA; ctx.font = 'italic 18px Arial'; ctx.textAlign = 'center';
  ctx.fillText(msg, 700, 162); ctx.textAlign = 'left';
}

function relTabela(ctx, y, cols, linhas, rowH) {
  relRet(ctx, 40, y, 1320, 38, 8, REL_AZUL);
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'left';
  cols.forEach(function (c) { ctx.fillText(c.t, c.x + 12, y + 25); });
  y += 44;
  linhas.forEach(function (lin, i) {
    relRet(ctx, 40, y, 1320, rowH - 6, 8, i % 2 ? '#ffffff' : '#f5f8fa', '#e3eaee');
    cols.forEach(function (c, k) {
      const v = lin[k];
      if (v && v.etiqueta) {
        relRet(ctx, c.x + 12, y + (rowH - 6) / 2 - 14, c.w - 24, 28, 14, v.cor);
        ctx.fillStyle = '#ffffff'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center';
        ctx.fillText(v.texto, c.x + c.w / 2, y + (rowH - 6) / 2 + 5); ctx.textAlign = 'left';
        return;
      }
      ctx.fillStyle = c.forte ? REL_AZUL : '#2b4253';
      ctx.font = (c.forte ? 'bold 15px' : '14px') + ' Arial';
      const lns = relQuebra(ctx, String(v == null ? '—' : v), c.w - 24, 2);
      lns.forEach(function (l, j) {
        ctx.fillText(l, c.x + 12, y + (rowH - 6) / 2 + 5 + (j - (lns.length - 1) / 2) * 17);
      });
    });
    y += rowH;
  });
}

function relPaginaDistribuicao(dados) {
  const c = relCanvas(REL_W, REL_H), ctx = c.ctx;
  relTitulo(ctx, 'Distribuição por divisão', 'Quantidade de riscos por nível e ranking pela média de nível');
  const divs = dados.divisoes.slice().sort(function (a, b) {
    return b.riscos.length - a.riscos.length || b.kpi.alto - a.kpi.alto ||
      b.kpi.medio - a.kpi.medio || a.sigla.localeCompare(b.sigla, 'pt-BR');
  });

  const gx = 140, gy = 130, gw = 560, maxQ = Math.max.apply(null, divs.map(function (d) { return d.riscos.length; })) || 1;
  const barH = Math.min(46, 520 / Math.max(divs.length, 1) - 14);
  ctx.fillStyle = REL_AZUL; ctx.font = 'bold 18px Arial';
  ctx.fillText('Riscos por nível', 40, 112);
  divs.forEach(function (d, i) {
    const y = gy + i * (barH + 14);
    ctx.fillStyle = REL_AZUL; ctx.font = 'bold 16px Arial'; ctx.textAlign = 'right';
    ctx.fillText(d.sigla, gx - 14, y + barH / 2 + 6); ctx.textAlign = 'left';
    let x = gx;
    ['baixo', 'medio', 'alto'].forEach(function (f) {
      const q = d.kpi[f]; if (!q) return;
      const w = gw * q / maxQ;
      ctx.fillStyle = REL_COR_NIVEL[f].cor; ctx.fillRect(x, y, w, barH);
      if (w > 24) {
        ctx.fillStyle = '#ffffff'; ctx.font = 'bold 15px Arial'; ctx.textAlign = 'center';
        ctx.fillText(String(q), x + w / 2, y + barH / 2 + 5); ctx.textAlign = 'left';
      }
      x += w;
    });
    ctx.fillStyle = REL_CINZA; ctx.font = 'bold 15px Arial';
    ctx.fillText(String(d.riscos.length), x + 10, y + barH / 2 + 5);
  });
  let lx = gx;
  const ly = gy + divs.length * (barH + 14) + 14;
  ['baixo', 'medio', 'alto'].forEach(function (f) {
    ctx.fillStyle = REL_COR_NIVEL[f].cor; ctx.fillRect(lx, ly, 14, 14);
    ctx.fillStyle = REL_AZUL; ctx.font = 'bold 14px Arial';
    ctx.fillText(REL_COR_NIVEL[f].label, lx + 20, ly + 12);
    lx += ctx.measureText(REL_COR_NIVEL[f].label).width + 50;
  });

  const rk = divs.slice().map(function (d) {
    return { d: d, media: d.kpi.riscos ? d.kpi.somaNivel / d.kpi.riscos : 0 };
  }).sort(function (a, b) { return b.media - a.media; });
  const rx = 760, rw = 600;
  ctx.fillStyle = REL_AZUL; ctx.font = 'bold 18px Arial';
  ctx.fillText('Ranking pela Média de Nível de Riscos', rx, 112);
  relRet(ctx, rx, 128, rw, 36, 8, REL_AZUL);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Arial';
  ctx.fillText('Pos.', rx + 12, 151); ctx.fillText('Divisão', rx + 70, 151);
  ctx.fillText('Riscos', rx + 380, 151); ctx.fillText('Média', rx + 480, 151);
  const rh = Math.min(56, 560 / Math.max(rk.length, 1));
  rk.forEach(function (it, i) {
    const y = 170 + i * rh;
    relRet(ctx, rx, y, rw, rh - 6, 8, i % 2 ? '#ffffff' : '#f5f8fa', '#e3eaee');
    const my = y + (rh - 6) / 2 + 5;
    ctx.fillStyle = REL_AZUL; ctx.font = 'bold 16px Arial';
    ctx.fillText((i + 1) + 'º', rx + 12, my);
    ctx.font = 'bold 15px Arial';
    ctx.fillText(relCorta(ctx, it.d.sigla + ' · ' + it.d.nome, 290), rx + 70, my);
    ctx.font = '15px Arial'; ctx.fillText(String(it.d.riscos.length), rx + 395, my);
    const cor = REL_COR_NIVEL[relFaixa(it.media)].cor;
    relRet(ctx, rx + 470, y + (rh - 6) / 2 - 13, 100, 26, 13, cor);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 15px Arial'; ctx.textAlign = 'center';
    ctx.fillText(relFmt(it.media), rx + 520, my); ctx.textAlign = 'left';
  });
  return c.canvas;
}

function relPaginaAntesDepois(dados) {
  const c = relCanvas(REL_W, REL_H), ctx = c.ctx;
  relTitulo(ctx, 'Efeito do tratamento',
    'Risco residual (antes) → risco final, após o tratamento (depois) · 12 maiores riscos residuais');
  const itens = dados.riscos.slice().sort(function (a, b) {
    return b._residual - a._residual || b._final - a._final;
  }).slice(0, 12);
  const x0 = 260, y0 = 110, pw = 1000, ph = 580, maxX = 25, rowH = ph / Math.max(itens.length, 1);
  const SETA = '#33505e';
  [[0, 7, 'baixo'], [7, 20, 'medio'], [20, 25, 'alto']].forEach(function (f) {
    ctx.fillStyle = REL_COR_NIVEL[f[2]].fundo;
    ctx.fillRect(x0 + pw * f[0] / maxX, y0, pw * (f[1] - f[0]) / maxX, ph);
  });
  ctx.font = '15px Arial'; ctx.textAlign = 'center';
  for (let v = 0; v <= maxX; v += 5) {
    const px = x0 + pw * v / maxX;
    ctx.strokeStyle = 'rgba(25,52,81,.10)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px, y0); ctx.lineTo(px, y0 + ph); ctx.stroke();
    ctx.fillStyle = REL_CINZA; ctx.fillText(String(v), px, y0 + ph + 24);
  }
  ctx.fillStyle = REL_AZUL; ctx.font = 'bold 16px Arial';
  ctx.fillText('Nível do risco', x0 + pw / 2, y0 + ph + 50);
  itens.forEach(function (r, i) {
    const y = y0 + rowH * (i + .5);
    const xa = x0 + pw * Math.min(maxX, r._residual) / maxX;
    const xd = x0 + pw * Math.min(maxX, r._final) / maxX;
    ctx.textAlign = 'right'; ctx.fillStyle = REL_AZUL; ctx.font = 'bold 15px Arial';
    ctx.fillText(r._rotulo, x0 - 16, y + 5); ctx.textAlign = 'left';
    if (Math.abs(xa - xd) > 1) {
      const dir = xd < xa ? 1 : -1;
      ctx.strokeStyle = SETA; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(xa - dir * 10, y); ctx.lineTo(xd + dir * 16, y); ctx.stroke();
      ctx.fillStyle = SETA; ctx.beginPath();
      ctx.moveTo(xd + dir * 11, y); ctx.lineTo(xd + dir * 23, y - 8); ctx.lineTo(xd + dir * 23, y + 8);
      ctx.closePath(); ctx.fill();
    }
    ctx.beginPath(); ctx.arc(xa, y, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.lineWidth = 3.5;
    ctx.strokeStyle = REL_COR_NIVEL[relFaixa(r._residual)].cor; ctx.stroke();
    ctx.beginPath(); ctx.arc(xd, y, 10, 0, Math.PI * 2);
    ctx.fillStyle = REL_COR_NIVEL[relFaixa(r._final)].cor; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#ffffff'; ctx.stroke();
    ctx.font = 'bold 13px Arial'; ctx.fillStyle = REL_AZUL; ctx.textAlign = 'center';
    ctx.fillText(relFmt(r._residual), xa, y - 15);
    if (Math.abs(xa - xd) > 22) ctx.fillText(relFmt(r._final), xd, y - 15);
    ctx.textAlign = 'left';
    const red = r._residual ? (1 - r._final / r._residual) * 100 : 0;
    ctx.fillStyle = red > 0 ? '#21865e' : REL_CINZA; ctx.font = 'bold 14px Arial';
    ctx.fillText(red > 0 ? '−' + Math.round(red) + '%' : 'sem tratamento', x0 + pw + 14, y + 5);
  });
  ctx.lineCap = 'butt';
  ctx.font = 'bold 14px Arial';
  ctx.beginPath(); ctx.arc(268, 760, 8, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = REL_CINZA; ctx.stroke();
  ctx.fillStyle = REL_AZUL; ctx.fillText('Risco residual (antes)', 284, 765);
  ctx.beginPath(); ctx.arc(490, 760, 9, 0, Math.PI * 2); ctx.fillStyle = REL_CINZA; ctx.fill();
  ctx.fillStyle = REL_AZUL; ctx.fillText('Risco final, tratado (depois) · cor pela faixa do nível', 506, 765);
  return c.canvas;
}

function relPaginaAtencao(dados) {
  const c = relCanvas(REL_W, REL_H), ctx = c.ctx;
  relTitulo(ctx, 'Riscos que precisam de atenção',
    'Alto sem plano  ·  plano com prazo vencido  ·  risco sem nenhuma redução (nem por controles, nem por tratamento)');
  const hoje = relHoje();
  const lista = [];
  dados.riscos.forEach(function (r) {
    const motivos = [];
    const e = relEtapaAtual(r), prazo = relDataPrazo(e);
    if (relFaixa(r._residual) === 'alto' && !relTemPlano(r)) motivos.push('Alto sem plano de tratamento');
    if (e && !e.concluido && prazo && prazo < hoje) motivos.push('Plano vencido em ' + relDataBR(prazo));
    if (r._inerente >= 7 && r._final >= r._inerente) motivos.push('Sem redução do risco');
    if (motivos.length) lista.push({ r: r, motivos: motivos });
  });
  lista.sort(function (a, b) { return b.motivos.length - a.motivos.length || b.r._residual - a.r._residual; });
  if (!lista.length) { relSemDados(ctx, 'Nenhum risco nesta condição no filtro atual.'); return c.canvas; }
  const cols = [
    { t: 'Código', x: 40, w: 180, forte: true }, { t: 'Risco (evento)', x: 220, w: 470 },
    { t: 'Motivo(s)', x: 690, w: 540 }, { t: 'Nível', x: 1230, w: 130 }
  ];
  const max = 10, linhas = lista.slice(0, max).map(function (it) {
    return [it.r._rotulo, it.r.evento || 'Não informado', it.motivos.join('  ·  '),
      { etiqueta: true, texto: relFmt(it.r._residual), cor: REL_COR_NIVEL[relFaixa(it.r._residual)].cor }];
  });
  relTabela(ctx, 96, cols, linhas, 60);
  if (lista.length > max) {
    ctx.fillStyle = REL_CINZA; ctx.font = 'italic 15px Arial';
    ctx.fillText('ⓘ Exibindo ' + max + ' de ' + lista.length + ' riscos nesta condição.', 40, 762);
  }
  return c.canvas;
}

function relPaginaPrazos(dados) {
  const c = relCanvas(REL_W, REL_H), ctx = c.ctx;
  relTitulo(ctx, 'Próximos prazos', 'Planos de tratamento que vencem nos próximos 30 dias');
  const hoje = relHoje(), limite = new Date(hoje.getTime() + 30 * 86400000);
  const lista = [];
  dados.riscos.forEach(function (r) {
    const e = relEtapaAtual(r), prazo = relDataPrazo(e);
    if (e && !e.concluido && prazo && prazo >= hoje && prazo <= limite) {
      lista.push({ r: r, e: e, prazo: prazo, dias: Math.round((prazo - hoje) / 86400000) });
    }
  });
  lista.sort(function (a, b) { return a.prazo - b.prazo; });
  if (!lista.length) { relSemDados(ctx, 'Nenhum plano vence nos próximos 30 dias.'); return c.canvas; }
  const cols = [
    { t: 'Prazo', x: 40, w: 130, forte: true }, { t: 'Faltam', x: 170, w: 120 },
    { t: 'Código', x: 290, w: 180, forte: true }, { t: 'Ação de tratamento', x: 470, w: 520 },
    { t: 'Responsável', x: 990, w: 240 }, { t: 'Nível', x: 1230, w: 130 }
  ];
  const max = 10, linhas = lista.slice(0, max).map(function (it) {
    return [relDataBR(it.prazo),
      { etiqueta: true, texto: it.dias === 0 ? 'Hoje' : it.dias + ' dia(s)',
        cor: it.dias <= 7 ? '#d64545' : it.dias <= 15 ? '#e0a800' : '#2eb87a' },
      it.r._rotulo, it.e.descricao || it.e.opcao || '—', it.e.responsavel || '—',
      { etiqueta: true, texto: relFmt(it.r._residual), cor: REL_COR_NIVEL[relFaixa(it.r._residual)].cor }];
  });
  relTabela(ctx, 96, cols, linhas, 60);
  if (lista.length > max) {
    ctx.fillStyle = REL_CINZA; ctx.font = 'italic 15px Arial';
    ctx.fillText('ⓘ Exibindo ' + max + ' de ' + lista.length + ' planos com prazo nos próximos 30 dias.', 40, 762);
  }
  return c.canvas;
}

// ============================================================
// PDF EXECUTIVO - 1ª PÁGINA: "RESUMO EXECUTIVO DE RISCOS"
// ============================================================
const REX_W = 1400, REX_H = 973, REX_ESCALA = 2;
const REX_NAVY = '#0f2f57', REX_TXT = '#1d3550', REX_CINZA = '#5b6f7d';
const REX_COR = {
  baixo: { forte: '#2e9e5b', fundo: '#cfe7d9', bolha: '#1f7a4d', txt: '#ffffff', nome: 'Baixo', plural: 'Baixos' },
  medio: { forte: '#e6c12f', fundo: '#f8f0b4', bolha: '#e0a800', txt: '#2f2600', nome: 'Médio', plural: 'Médios' },
  alto:  { forte: '#d0314a', fundo: '#f4cdd4', bolha: '#c62839', txt: '#ffffff', nome: 'Alto',  plural: 'Altos' }
};
const REX_NOMES_UNIDADES = {
  DPROC: 'Divisão de Processamento',
  DC: 'Divisão de Cálculos',
  DPP: 'Div. de Pagamento de Precatórios',
  CJ: 'Consultoria Jurídica',
  AA: 'Assessoria de Atendimento ao Público',
  AT: 'Assessoria Técnica',
  DCGA: 'Div. de Controle e Gestão de Aportes'
};
const REX_PROB_LABELS = ['Raro', 'Pouco Prov.', 'Provável', 'Muito Prov.', 'Quase Certo'];
const REX_IMP_LABELS = ['Muito Alto', 'Alto', 'Médio', 'Baixo', 'Muito Baixo'];

function rexF1(n) {
  return (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
function rexMedia(lista, campo) {
  if (!lista.length) return 0;
  return lista.reduce(function (a, r) { return a + (Number(r[campo]) || 0); }, 0) / lista.length;
}
function rexFaixaNome(media) {
  const f = relFaixa(media);
  if (f === 'alto') return 'faixa Alta (20-25)';
  if (f === 'medio') return 'faixa Média (7-19)';
  return 'faixa Baixa (1-6)';
}
function rexJuntar(lista) {
  if (lista.length <= 1) return lista.join('');
  return lista.slice(0, -1).join(', ') + ' e ' + lista[lista.length - 1];
}
function rexCodigo(r) {
  return String(r._rotulo || '').replace(/\s*-\s*/g, '-');
}
function rexCodigoProcesso(proc) {
  const r = (proc._riscos || [])[0];
  if (!r) return '';
  return rexCodigo(r).split('-').slice(0, 2).join('-');
}
function rexTemPlanoTratamento(r) {
  return riscoTratadoDash(r);
}
function rexNivelMatriz(r) {
  const v = (r._visao !== undefined) ? r._visao : r._final;
  return Math.max(1, Math.min(25, Math.floor(Number(v) || 0)));
}
function rexNivelFinalPuro(r) {
  return Math.max(1, Math.min(25, Math.floor(Number(r._final) || 0)));
}

function rexCalcular(dados) {
  const riscos = dados.riscos || [];
  const divisoes = (dados.divisoes || []).filter(function (d) { return d.riscos && d.riscos.length; });
  const processos = [];
  divisoes.forEach(function (d) {
    d.processos.forEach(function (p) {
      if (!p._riscos || !p._riscos.length) return;
      processos.push({
        id: p.id,
        codigo: rexCodigoProcesso(p), nome: String(p.processo || 'Processo sem nome'),
        sigla: d.sigla, riscos: p._riscos,
        media: rexMedia(p._riscos, '_visao'),
        maximo: Math.max.apply(null, p._riscos.map(function (r) { return r._visao; }))
      });
    });
  });
  const unidades = divisoes.map(function (d) {
    return {
      codigo: d.sigla, nome: REX_NOMES_UNIDADES[d.sigla] || d.nome || d.sigla,
      sigla: d.sigla, riscos: d.riscos,
      media: rexMedia(d.riscos, '_visao'),
      maximo: Math.max.apply(null, d.riscos.map(function (r) { return r._visao; }))
    };
  });
  const comPlano = riscos.filter(rexTemPlanoTratamento);
  const grupos = {};
  const ordem = [];
  comPlano.forEach(function (r) {
    const partes = rexCodigo(r).split('-');
    const proc = partes.slice(0, 2).join('-');
    if (!grupos[proc]) { grupos[proc] = []; ordem.push(proc); }
    grupos[proc].push(partes[2]);
  });
  const codigosPlano = rexJuntar(ordem.map(function (p) { return p + '-' + grupos[p].join('/'); }));

  // Risco FINAL = somente riscos tratados (Tratar = Sim e residual Alto; DPP: Medio ou Alto)
  const riscosFinais = riscos.filter(riscoTratadoDash);

  function contagem(campo, lista) {
    const c = { baixo: 0, medio: 0, alto: 0 };
    (lista || riscos).forEach(function (r) {
      const v = campo === '_final' ? rexNivelFinalPuro(r) : campo === '_visao' ? rexNivelMatriz(r) : r[campo];
      c[relFaixa(v)]++;
    });
    return c;
  }
  const mi = rexMedia(riscos, '_inerente');
  const mr = rexMedia(riscos, '_residual');
  const mf = rexMedia(riscosFinais, '_final');   // RISCO FINAL: somente riscos tratados
  const mRisco = rexMedia(riscos, '_visao');     // MEDIA DE RISCO: final nos tratados + residual nos demais
  return {
    riscos: riscos, riscosFinais: riscosFinais, divisoes: divisoes, processos: processos, unidades: unidades,
    siglas: divisoes.map(function (d) { return d.sigla; }).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); }),
    mediaInerente: mi, mediaResidual: mr, mediaFinal: mf, mediaRisco: mRisco,
    variacao: mi ? (mr - mi) / mi * 100 : 0,
    comPlano: comPlano, codigosPlano: codigosPlano,
    dist: { inerente: contagem('_inerente'), residual: contagem('_residual'), final: contagem('_final', riscosFinais), matriz: contagem('_visao') }
  };
}

function rexExtremo(lista, maior) {
  if (!lista.length) return null;
  const ord = lista.slice().sort(function (a, b) {
    const ma = Math.round(a.media * 10), mb = Math.round(b.media * 10);
    if (ma !== mb) return maior ? mb - ma : ma - mb;
    if (a.maximo !== b.maximo) return maior ? b.maximo - a.maximo : a.maximo - b.maximo;
    return a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true });
  });
  const venc = ord[0];
  const empatados = ord.slice(1).filter(function (o) {
    return Math.round(o.media * 10) === Math.round(venc.media * 10);
  }).map(function (o) { return o.codigo; });
  return { item: venc, empates: empatados };
}

function rexDescricao(ext, maior) {
  const it = ext.item, lista = it.riscos, n = lista.length;
  let txt = n + (n === 1 ? ' risco' : ' riscos');
  const planos = lista.filter(rexTemPlanoTratamento).length;
  const c = { baixo: [], medio: [], alto: [] };
  lista.forEach(function (r) { c[relFaixa(r._visao)].push(r); });
  let comp;
  if (planos === n) {
    comp = n === 1 ? 'com plano de tratamento' : (n === 2 ? 'ambos' : 'todos') + ' com plano de tratamento';
  } else if (c.alto.length === 1 && n > 1) {
    comp = 'único risco Alto (' + relFmt(c.alto[0]._visao) + ')';
  } else {
    const faixas = ['baixo', 'medio', 'alto'].filter(function (f) { return c[f].length; });
    if (faixas.length === 1) {
      const f = faixas[0];
      comp = n === 1 ? 'risco ' + REX_COR[f].nome : (n === 2 ? 'ambos ' : 'todos ') + REX_COR[f].plural;
    } else {
      comp = rexJuntar(faixas.map(function (f) {
        return c[f].length + ' ' + (c[f].length === 1 ? REX_COR[f].nome : REX_COR[f].plural);
      }));
    }
    if (planos > 0) comp += '; ' + planos + ' com plano de tratamento';
  }
  txt += ' - ' + comp;
  if (ext.empates.length) {
    txt += '; empate de média com ' + rexJuntar(ext.empates.slice(0, 3)) +
      (ext.empates.length > 3 ? ' e outros' : '') +
      '; desempate pelo ' + (maior ? 'maior' : 'menor') + ' risco.';
  }
  return txt;
}

// ---------------- desenho: utilitários ----------------
function rexCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = REX_W * REX_ESCALA; canvas.height = REX_H * REX_ESCALA;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível para gerar o relatório.');
  ctx.scale(REX_ESCALA, REX_ESCALA);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, REX_W, REX_H);
  ctx.textBaseline = 'alphabetic';
  return { canvas: canvas, ctx: ctx };
}

function rexTopoArredondado(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x, y + h); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h); ctx.closePath();
}

function rexSecao(ctx, x, y, w, h, titulo) {
  relRet(ctx, x, y, w, h, 8, '#f2f5f8', '#d9e2ea');
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, '#0d3a6e'); g.addColorStop(1, '#1667b5');
  rexTopoArredondado(ctx, x, y, w, 26, 8);
  ctx.fillStyle = g; ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'left';
  ctx.fillText(titulo, x + 14, y + 18);
  return y + 26;
}

function rexTexto(ctx, txt, x, y, font, cor, align) {
  ctx.font = font; ctx.fillStyle = cor; ctx.textAlign = align || 'left';
  ctx.fillText(txt, x, y);
  ctx.textAlign = 'left';
}

function rexLinhas(ctx, txt, x, y, largura, maxLinhas, font, cor, entre) {
  ctx.font = font; ctx.fillStyle = cor; ctx.textAlign = 'left';
  const ls = relQuebra(ctx, txt, largura, maxLinhas);
  ls.forEach(function (l, i) { ctx.fillText(l, x, y + i * (entre || 12)); });
  return ls.length;
}

function rexIcone(ctx, tipo, x, y, s, cor) {
  ctx.save();
  ctx.fillStyle = cor; ctx.strokeStyle = cor; ctx.lineWidth = Math.max(1.5, s / 12);
  if (tipo === 'predio') {
    ctx.fillRect(x + s * .18, y, s * .64, s);
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
      ctx.fillRect(x + s * (.3 + j * .24), y + s * (.1 + i * .2), s * .14, s * .11);
    }
    ctx.fillRect(x + s * .42, y + s * .86, s * .16, s * .14);
  } else if (tipo === 'engrenagem') {
    const cx = x + s / 2, cy = y + s / 2;
    for (let i = 0; i < 8; i++) {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(i * Math.PI / 4);
      ctx.fillRect(-s * .09, -s * .5, s * .18, s * .22); ctx.restore();
    }
    ctx.beginPath(); ctx.arc(cx, cy, s * .34, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, s * .14, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill();
  } else if (tipo === 'documento') {
    ctx.beginPath();
    ctx.moveTo(x + s * .15, y); ctx.lineTo(x + s * .65, y); ctx.lineTo(x + s * .88, y + s * .24);
    ctx.lineTo(x + s * .88, y + s); ctx.lineTo(x + s * .15, y + s); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff';
    [.42, .58, .74].forEach(function (k, i) { ctx.fillRect(x + s * .3, y + s * k, s * (i === 2 ? .3 : .44), s * .07); });
  } else if (tipo === 'barras') {
    ctx.fillRect(x, y + s * .62, s * .24, s * .38);
    ctx.fillRect(x + s * .36, y + s * .36, s * .24, s * .64);
    ctx.fillRect(x + s * .72, y + s * .08, s * .24, s * .92);
  } else if (tipo === 'seta-baixo' || tipo === 'seta-cima') {
    const baixo = tipo === 'seta-baixo';
    ctx.save();
    if (!baixo) { ctx.translate(x + s / 2, y + s / 2); ctx.rotate(Math.PI); ctx.translate(-(x + s / 2), -(y + s / 2)); }
    ctx.fillRect(x + s * .38, y, s * .24, s * .55);
    ctx.beginPath(); ctx.moveTo(x + s * .08, y + s * .48); ctx.lineTo(x + s * .92, y + s * .48);
    ctx.lineTo(x + s * .5, y + s); ctx.closePath(); ctx.fill();
    ctx.restore();
  } else if (tipo === 'prancheta') {
    relRet(ctx, x + s * .1, y + s * .1, s * .8, s * .9, s * .1, cor);
    relRet(ctx, x + s * .32, y, s * .36, s * .2, s * .06, cor);
    ctx.fillStyle = '#ffffff';
    [.38, .56, .74].forEach(function (k) {
      ctx.fillRect(x + s * .26, y + s * k, s * .08, s * .08);
      ctx.fillRect(x + s * .4, y + s * k, s * .34, s * .08);
    });
  } else if (tipo === 'check') {
    ctx.beginPath(); ctx.arc(x + s / 2, y + s / 2, s / 2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = s * .13; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(x + s * .27, y + s * .52); ctx.lineTo(x + s * .44, y + s * .68);
    ctx.lineTo(x + s * .74, y + s * .36); ctx.stroke();
  } else if (tipo === 'alerta') {
    ctx.beginPath(); ctx.arc(x + s / 2, y + s / 2, s / 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(x + s * .5, y + s * .2); ctx.lineTo(x + s * .8, y + s * .74);
    ctx.lineTo(x + s * .2, y + s * .74); ctx.closePath(); ctx.fill();
    ctx.fillStyle = cor;
    ctx.fillRect(x + s * .465, y + s * .38, s * .07, s * .2);
    ctx.fillRect(x + s * .465, y + s * .62, s * .07, s * .07);
  } else if (tipo === 'triangulo-baixo') {
    ctx.beginPath(); ctx.arc(x + s / 2, y + s / 2, s / 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(x + s * .24, y + s * .3); ctx.lineTo(x + s * .76, y + s * .3);
    ctx.lineTo(x + s * .5, y + s * .76); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function rexFaixaTitulo(ctx) {
  const g = ctx.createLinearGradient(0, 0, REX_W, 0);
  g.addColorStop(0, '#0b2d5c'); g.addColorStop(.65, '#1559a6'); g.addColorStop(1, '#0d3a72');
  relRet(ctx, 10, 4, REX_W - 20, 52, 6, null);
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); relRet(ctx, 10, 4, REX_W - 20, 52, 6); ctx.clip();
  [[1000, .10, 70], [1070, .16, 55], [1150, .10, 45]].forEach(function (f) {
    ctx.fillStyle = 'rgba(255,255,255,' + f[1] + ')';
    ctx.beginPath(); ctx.moveTo(f[0] + 40, 4); ctx.lineTo(f[0] + 40 + f[2], 4);
    ctx.lineTo(f[0] + f[2], 56); ctx.lineTo(f[0], 56); ctx.closePath(); ctx.fill();
  });
  ctx.restore();
  rexTexto(ctx, 'Resumo Executivo de Riscos', 30, 40, 'bold 30px Arial', '#ffffff');
  ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillRect(1238, 16, 1.5, 28);
  rexTexto(ctx, 'GESTÃO DE RISCOS', 1252, 28, 'bold 13px Arial', '#ffffff');
  rexTexto(ctx, 'PAINEL EXECUTIVO', 1252, 45, '12px Arial', '#dbe8f6');
}

function rexCartao(ctx, x, y, w, h) {
  relRet(ctx, x, y, w, h, 7, '#ffffff', '#e0e7ee');
}

function rexInformacoesGerais(ctx, k, x, y, w, h) {
  const top = rexSecao(ctx, x, y, w, h, 'INFORMAÇÕES GERAIS');
  const gap = 8, cw = (w - 20 - gap * 2) / 3, ch = h - 26 - 16, cy = top + 8;
  const itens = [
    { ic: 'predio', n: k.divisoes.length, t: 'Unidades administrativas', s: rexJuntar(k.siglas) },
    { ic: 'engrenagem', n: k.processos.length, t: 'Processos de trabalho', s: 'mapeados nas unidades' },
    { ic: 'documento', n: k.riscos.length, t: 'Riscos identificados',
      s: 'em ' + k.processos.length + ' processo' + (k.processos.length === 1 ? '' : 's') + ' de trabalho' }
  ];
  itens.forEach(function (it, i) {
    const cx = x + 10 + i * (cw + gap);
    rexCartao(ctx, cx, cy, cw, ch);
    rexIcone(ctx, it.ic, cx + 12, cy + 12, 30, REX_NAVY);
    rexTexto(ctx, String(it.n), cx + 54, cy + 33, 'bold 27px Arial', REX_NAVY);
    const nl = rexLinhas(ctx, it.t, cx + 54, cy + 51, cw - 62, 2, 'bold 12px Arial', REX_NAVY, 13);
    rexLinhas(ctx, it.s, cx + 54, cy + 52 + nl * 13, cw - 62, 2, '10.5px Arial', REX_CINZA, 11.5);
  });
}

function rexIndicadores(ctx, k, x, y, w, h) {
  const top = rexSecao(ctx, x, y, w, h, 'INDICADORES DE RISCO');
  const gap = 8, n = 5, cw = (w - 20 - gap * (n - 1)) / n, ch = h - 26 - 16, cy = top + 8;
  const reduziu = k.variacao <= 0;
  const VERDE = '#1f8a4c', VERM = '#c62839';
  const pct = Math.round(k.variacao);
  const itens = [
    { ic: 'barras', cor: '#1667b5', n: rexF1(k.mediaInerente), nc: REX_NAVY,
      t: 'Média do risco inerente', s: 'antes dos controles' },
    { ic: 'barras', cor: '#1667b5', n: rexF1(k.mediaResidual), nc: REX_NAVY,
      t: 'Média do risco residual', s: rexFaixaNome(k.mediaResidual) },
    { ic: reduziu ? 'seta-baixo' : 'seta-cima', cor: reduziu ? VERDE : VERM,
      n: (pct > 0 ? '+' : pct < 0 ? '−' : '') + Math.abs(pct) + '%', nc: reduziu ? VERDE : VERM,
      t: reduziu ? 'Redução pelos controles' : 'Aumento após controles', s: 'do inerente para o residual' },
    { ic: 'prancheta', cor: REX_NAVY, n: String(k.comPlano.length), nc: REX_NAVY,
      t: 'Riscos com plano de tratamento', s: k.codigosPlano || 'nenhum plano cadastrado' },
    { ic: 'check', cor: '#1667b5', n: rexF1(k.mediaFinal), nc: REX_NAVY,
      t: 'Média de risco final', s: k.riscosFinais.length ? k.riscosFinais.length + ' risco(s) tratado(s)' : 'nenhum risco tratado' }
  ];
  itens.forEach(function (it, i) {
    const cx = x + 10 + i * (cw + gap);
    rexCartao(ctx, cx, cy, cw, ch);
    rexIcone(ctx, it.ic, cx + 10, cy + 12, 22, it.cor);
    rexTexto(ctx, it.n, cx + 40, cy + 33, 'bold 25px Arial', it.nc);
    const nl = rexLinhas(ctx, it.t, cx + 10, cy + 51, cw - 16, 2, 'bold 11px Arial', REX_NAVY, 12.5);
    rexLinhas(ctx, it.s, cx + 10, cy + 53 + nl * 12.5, cw - 16, 2, '10px Arial', REX_CINZA, 11);
  });
}

function rexMatriz(ctx, k, x, y, w, h) {
  const top = rexSecao(ctx, x, y, w, h, 'MATRIZ DE RISCO FINAL (APÓS TRATAMENTO) - IMPACTO x PROBABILIDADE');
  rexTexto(ctx, 'Visão geral dos ' + k.riscos.length + ' riscos: risco final nos ' + k.riscosFinais.length + ' tratados e residual nos demais; o círculo indica a quantidade',
    x + 14, top + 15, '11px Arial', REX_TXT);

  const porNivel = {};
  k.riscos.forEach(function (r) { const n = rexNivelMatriz(r); porNivel[n] = (porNivel[n] || 0) + 1; });
  const maxQ = Math.max.apply(null, Object.keys(porNivel).map(function (n) { return porNivel[n]; }).concat([1]));

  const gx = x + 118, gy = top + 42, gw = w - 118 - 16, gh = h - 26 - 42 - 70;
  const cw = gw / 5, ch = gh / 5, gap = 3;
  const rMax = Math.min(ch / 2 - 4, cw / 2 - 6, 22), rMin = 9;
  function raio(q) { return Math.max(rMin, rMax * Math.sqrt(q / maxQ)); }

  REX_PROB_LABELS.forEach(function (l, c) {
    rexTexto(ctx, l, gx + c * cw + cw / 2, gy - 8, 'bold 11.5px Arial', REX_NAVY, 'center');
  });
  ctx.save(); ctx.translate(x + 22, gy + gh / 2); ctx.rotate(-Math.PI / 2);
  rexTexto(ctx, 'IMPACTO', 0, 4, 'bold 11px Arial', '#1667b5', 'center');
  ctx.strokeStyle = '#1667b5'; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(32, 0); ctx.lineTo(62, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(66, 0); ctx.lineTo(60, -4); ctx.lineTo(60, 4); ctx.closePath();
  ctx.fillStyle = '#1667b5'; ctx.fill();
  ctx.restore();

  for (let row = 0; row < 5; row++) {
    const imp = 5 - row;
    const yy = gy + row * ch;
    rexTexto(ctx, REX_IMP_LABELS[row], gx - 12, yy + ch / 2 + 4, 'bold 11.5px Arial', REX_NAVY, 'right');
    for (let col = 0; col < 5; col++) {
      const prob = col + 1;
      const nivel = MATRIZ_TJPR[prob + '-' + imp];
      const f = relFaixa(nivel), cor = REX_COR[f];
      const xx = gx + col * cw;
      ctx.fillStyle = cor.fundo;
      ctx.fillRect(xx + gap / 2, yy + gap / 2, cw - gap, ch - gap);
      rexTexto(ctx, String(nivel), xx + 7, yy + 14, '10px Arial', '#33505e');
      const q = porNivel[nivel] || 0;
      if (q > 0) {
        const r = raio(q), cx = xx + cw / 2, cy = yy + ch / 2 + 2;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = cor.bolha; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.stroke();
        const fs = Math.max(11, Math.min(20, r * .95));
        rexTexto(ctx, String(q), cx, cy + fs * .36, 'bold ' + fs + 'px Arial', cor.txt, 'center');
      }
    }
  }

  const py = gy + gh + 14;
  rexTexto(ctx, 'PROBABILIDADE', gx + gw / 2, py, 'bold 11px Arial', '#1667b5', 'center');
  ctx.strokeStyle = '#1667b5'; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(gx + gw / 2 + 52, py - 4); ctx.lineTo(gx + gw / 2 + 82, py - 4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(gx + gw / 2 + 86, py - 4); ctx.lineTo(gx + gw / 2 + 80, py - 8);
  ctx.lineTo(gx + gw / 2 + 80, py); ctx.closePath(); ctx.fillStyle = '#1667b5'; ctx.fill();

  const ly = py + 22;
  let lx = x + 16;
  [['baixo', 'Baixo (1–6)'], ['medio', 'Médio (7–19)'], ['alto', 'Alto (20–25)']].forEach(function (it) {
    ctx.beginPath(); ctx.arc(lx + 7, ly - 4, 7, 0, Math.PI * 2);
    ctx.fillStyle = REX_COR[it[0]].bolha; ctx.fill();
    const t = it[1] + ': ' + k.dist.matriz[it[0]];
    rexTexto(ctx, t, lx + 19, ly, 'bold 12.5px Arial', REX_NAVY);
    ctx.font = 'bold 12.5px Arial';
    lx += 19 + ctx.measureText(t).width + 22;
  });
  const tamanhos = maxQ >= 3 ? [1, Math.max(2, Math.round(maxQ / 2)), maxQ] : (maxQ === 2 ? [1, 2] : [1]);
  lx += 10;
  rexTexto(ctx, 'Tamanho = nº de riscos:', lx, ly, '11px Arial', REX_CINZA);
  ctx.font = '11px Arial'; lx += ctx.measureText('Tamanho = nº de riscos:').width + 10;
  tamanhos.forEach(function (q) {
    const r = Math.max(4, raio(q) * .7);
    ctx.beginPath(); ctx.arc(lx + r, ly - 4, r, 0, Math.PI * 2);
    ctx.fillStyle = '#b7c3cd'; ctx.fill();
    rexTexto(ctx, String(q), lx + r * 2 + 5, ly, '11px Arial', REX_TXT);
    ctx.font = '11px Arial'; lx += r * 2 + 12 + ctx.measureText(String(q)).width + 6;
  });
  rexLinhas(ctx,
    'Número pequeno na célula = nível do risco (1 a 25). Risco final: os ' + k.comPlano.length +
    ' riscos com Tratar = Sim usam o valor do plano quando já preenchido; os pendentes e os demais mantêm o residual (arredondado para baixo).',
    x + 16, ly + 16, w - 32, 2, 'italic 9px Arial', REX_CINZA, 10.5);
}

function rexEscala(ctx, x, y, w, valor) {
  const max = 25;
  [[0, 7, '#bfe0cd'], [7, 20, '#f3e6a0'], [20, 25, '#f1c2ca']].forEach(function (f, i, arr) {
    const x1 = x + w * f[0] / max, x2 = x + w * f[1] / max;
    relRet(ctx, x1 + (i ? 1 : 0), y, x2 - x1 - (i < arr.length - 1 ? 1 : 0), 6, 3, f[2]);
  });
  const px = x + w * Math.max(0, Math.min(max, valor)) / max;
  ctx.beginPath(); ctx.arc(px, y + 3, 5.5, 0, Math.PI * 2);
  ctx.fillStyle = REX_NAVY; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#ffffff'; ctx.stroke();
  [0, 7, 20, 25].forEach(function (v) {
    rexTexto(ctx, String(v), x + w * v / max, y + 20, '10px Arial', REX_CINZA, 'center');
  });
}

function rexCartaoDestaque(ctx, x, y, w, h, rotulo, ext, maior) {
  const cor = maior ? '#c62839' : '#1f8a4c';
  relRet(ctx, x, y, w, h, 8, '#ffffff');
  relRet(ctx, x + 1, y + 1, w - 2, h - 2, 8, null, cor);
  ctx.lineWidth = 2.2; ctx.strokeStyle = cor; ctx.stroke(); ctx.lineWidth = 1;
  rexIcone(ctx, maior ? 'alerta' : 'triangulo-baixo', x + 10, y + 14, 30, cor);
  rexTexto(ctx, rotulo, x + 50, y + 20, 'bold 10.5px Arial', cor);
  if (!ext) { rexTexto(ctx, 'Sem dados', x + 50, y + 50, 'italic 13px Arial', REX_CINZA); return; }
  const it = ext.item;
  rexTexto(ctx, rexF1(it.media), x + w - 12, y + 40, 'bold 23px Arial', REX_NAVY, 'right');
  rexTexto(ctx, 'média de risco', x + w - 12, y + 53, '9.5px Arial', REX_CINZA, 'right');
  ctx.font = 'bold 20px Arial';
  rexTexto(ctx, relCorta(ctx, it.codigo, w - 150), x + 50, y + 44, 'bold 20px Arial', REX_NAVY);
  ctx.font = 'bold 11.5px Arial';
  rexTexto(ctx, relCorta(ctx, it.nome, w - 62), x + 50, y + 66, 'bold 11.5px Arial', REX_NAVY);
  rexLinhas(ctx, rexDescricao(ext, maior), x + 50, y + 81, w - 62, 3, '10px Arial', REX_CINZA, 11.5);
  rexEscala(ctx, x + 50, y + h - 32, w - 70, it.media);
}

function rexDestaques(ctx, k, x, y, w, h) {
  const top0 = rexSecao(ctx, x, y, w, h, 'PRINCIPAIS PROCESSOS EM DESTAQUE');
  rexTexto(ctx, 'Média de risco = risco final nos riscos tratados + risco residual nos demais.', x + 12, top0 + 12, '10.5px Arial', REX_TXT);
  const top = top0 + 16;
  const gap = 10, cw = (w - 20 - gap) / 2, ch = (h - 26 - 36 - gap) / 2;
  const pMaior = rexExtremo(k.processos, true), pMenor = rexExtremo(k.processos, false);
  const uMaior = rexExtremo(k.unidades, true), uMenor = rexExtremo(k.unidades, false);
  rexCartaoDestaque(ctx, x + 10, top + 10, cw, ch, 'PROCESSO - MAIOR RISCO', pMaior, true);
  rexCartaoDestaque(ctx, x + 10 + cw + gap, top + 10, cw, ch, 'PROCESSO - MENOR RISCO', pMenor, false);
  rexCartaoDestaque(ctx, x + 10, top + 10 + ch + gap, cw, ch, 'UNIDADE - MAIOR RISCO', uMaior, true);
  rexCartaoDestaque(ctx, x + 10 + cw + gap, top + 10 + ch + gap, cw, ch, 'UNIDADE - MENOR RISCO', uMenor, false);
}

function rexTermometro(ctx, k, x, y, w, h) {
  const top = rexSecao(ctx, x, y, w, h, 'NÍVEL MÉDIO DE RISCO');
  rexTexto(ctx, 'Média geral dos ' + k.riscos.length + ' riscos (escala 0 a 25)', x + 14, top + 17, '11.5px Arial', REX_TXT);

  const vals = [k.mediaInerente, k.mediaResidual, k.mediaFinal];
  const ROT = ['Inerente', 'Residual', 'Final'];
  const MAX = 25;
  const faixaF = relFaixa(k.mediaFinal);
  const corF = REX_COR[faixaF].forte;
  const COR_MARCA = ['#8fa2ae', '#1667b5'];   // inerente, residual

  // Legenda das marcações (inerente e residual = marcação; final = ponteiro)
  let lx = x + 14;
  const ly = top + 33;
  [[COR_MARCA[0], 'Inerente ' + rexF1(vals[0])], [COR_MARCA[1], 'Residual ' + rexF1(vals[1])]].forEach(function (it) {
    ctx.beginPath(); ctx.arc(lx + 5, ly - 4, 5, 0, Math.PI * 2);
    ctx.fillStyle = it[0]; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#ffffff'; ctx.stroke();
    rexTexto(ctx, it[1], lx + 14, ly, 'bold 10.5px Arial', REX_TXT);
    ctx.font = 'bold 10.5px Arial'; lx += 14 + ctx.measureText(it[1]).width + 16;
  });
  ctx.fillStyle = REX_NAVY;
  ctx.beginPath(); ctx.moveTo(lx, ly - 4); ctx.lineTo(lx + 11, ly - 7); ctx.lineTo(lx + 11, ly - 1); ctx.closePath(); ctx.fill();
  rexTexto(ctx, 'Final ' + rexF1(vals[2]), lx + 16, ly, 'bold 10.5px Arial', REX_TXT);

  const cx = x + w / 2;
  const R = Math.min(w * 0.27, (h - 26) * 0.31);
  const esp = R * 0.24;
  const cy = top + 50 + R + esp / 2;
  function ang(v) { return Math.PI + Math.PI * Math.max(0, Math.min(MAX, v)) / MAX; }

  ctx.lineCap = 'butt';
  ctx.lineWidth = esp + 6; ctx.strokeStyle = '#e4eaf0';
  ctx.beginPath(); ctx.arc(cx, cy, R, Math.PI, 2 * Math.PI); ctx.stroke();

  [[0, 7, 'baixo'], [7, 20, 'medio'], [20, 25, 'alto']].forEach(function (f) {
    ctx.lineWidth = esp;
    ctx.strokeStyle = REX_COR[f[2]].forte;
    ctx.globalAlpha = f[2] === faixaF ? 1 : 0.35;
    ctx.beginPath(); ctx.arc(cx, cy, R, ang(f[0]) + 0.012, ang(f[1]) - 0.012); ctx.stroke();
  });
  ctx.globalAlpha = 1;

  [0, 7, 20, 25].forEach(function (v) {
    const a = ang(v), rr = R + esp / 2 + 10;
    rexTexto(ctx, String(v), cx + Math.cos(a) * rr, cy + Math.sin(a) * rr + 4, '10.5px Arial', REX_CINZA, 'center');
  });

  // Marcações do inerente e do residual: bolinha sobre a faixa (SEM ponteiro)
  [0, 1].forEach(function (i) {
    const a = ang(vals[i]);
    const px = cx + Math.cos(a) * R, py = cy + Math.sin(a) * R;
    ctx.beginPath(); ctx.arc(px, py, esp * 0.36, 0, Math.PI * 2);
    ctx.fillStyle = COR_MARCA[i]; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#ffffff'; ctx.stroke();
  });

  // Ponteiro somente no risco final
  const aF = ang(k.mediaFinal), lp = R - esp / 2 - 6;
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(aF);
  ctx.fillStyle = REX_NAVY;
  ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(lp, -1.2); ctx.lineTo(lp, 1.2); ctx.lineTo(0, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.fillStyle = REX_NAVY; ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill();

  const selo = 'RISCO FINAL · ' + REX_COR[faixaF].nome.toUpperCase();
  ctx.font = 'bold 24px Arial'; const nw = ctx.measureText(rexF1(k.mediaFinal)).width;
  ctx.font = 'bold 10px Arial'; const sw = ctx.measureText(selo).width + 16;
  const gx = cx - (nw + 8 + sw) / 2;
  rexTexto(ctx, rexF1(k.mediaFinal), gx, cy + 34, 'bold 24px Arial', REX_NAVY);
  relRet(ctx, gx + nw + 8, cy + 17, sw, 20, 10, REX_COR[faixaF].fundo);
  rexTexto(ctx, selo, gx + nw + 8 + sw / 2, cy + 31, 'bold 10px Arial', faixaF === 'medio' ? '#7a5f00' : corF, 'center');

  const ey = cy + 46, eh = y + h - 10 - ey;
  const gap = 34;
  const cw = (w - 28 - 2 * gap) / 3;
  const COR_CARD = [COR_MARCA[0], COR_MARCA[1], corF];
  vals.forEach(function (v, i) {
    const ex = x + 14 + i * (cw + gap);
    relRet(ctx, ex, ey, cw, eh, 7, '#ffffff', '#e0e7ee');
    ctx.fillStyle = COR_CARD[i]; ctx.fillRect(ex + 1, ey + 1, cw - 2, 3);
    rexTexto(ctx, ROT[i].toUpperCase(), ex + cw / 2, ey + 18, 'bold 9.5px Arial', REX_CINZA, 'center');
    rexTexto(ctx, rexF1(v), ex + cw / 2, ey + eh / 2 + 14, 'bold 20px Arial', REX_NAVY, 'center');
    if (i > 0) {
      const ax = ex - gap / 2, ay = ey + eh / 2 - 4;
      const ant = vals[i - 1], d = ant ? (v - ant) / ant * 100 : 0;
      const cor = d <= 0 ? '#1f8a4c' : '#c62839';
      ctx.fillStyle = cor;
      ctx.beginPath(); ctx.moveTo(ax + 5, ay); ctx.lineTo(ax - 4, ay - 7); ctx.lineTo(ax - 4, ay + 7); ctx.closePath(); ctx.fill();
      const txt = (d > 0 ? '+' : d < 0 ? '−' : '') + Math.abs(Math.round(d)) + '%';
      rexTexto(ctx, txt, ax, ay + 20, 'bold 10px Arial', cor, 'center');
    }
  });
}

function rexMediaPorUnidade(ctx, k, x, y, w, h) {
  const top = rexSecao(ctx, x, y, w, h, 'MÉDIA DE RISCO POR UNIDADE');
  rexTexto(ctx, 'Média de risco = risco final nos riscos tratados + risco residual nos demais', x + w - 14, y + 17, '9.5px Arial', REX_CINZA, 'right');
  const itens = k.unidades.slice().sort(function (a, b) {
    return b.media - a.media || b.riscos.length - a.riscos.length || a.sigla.localeCompare(b.sigla, 'pt-BR');
  });
  const gx = x + 62, gy = top + 14, gw = w - 62 - 30, gh = h - 26 - 14 - 34;
  const maxV = Math.max.apply(null, itens.map(function (u) { return u.media; }).concat([k.mediaRisco, 1]));
  const passo = maxV * 1.25 > 16 ? 5 : 2;
  const maxX = Math.max(passo, Math.ceil(maxV * 1.25 / passo) * passo);
  const slot = gh / Math.max(itens.length, 1), barH = Math.min(14, slot * .62);
  function px(v) { return gx + gw * v / maxX; }

  ctx.strokeStyle = '#8fa2ae'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx, gy + gh); ctx.lineTo(gx + gw, gy + gh); ctx.stroke();
  for (let v = 0; v <= maxX; v += passo) {
    ctx.beginPath(); ctx.moveTo(px(v), gy + gh); ctx.lineTo(px(v), gy + gh + 4); ctx.stroke();
    rexTexto(ctx, String(v), px(v), gy + gh + 17, '11px Arial', REX_TXT, 'center');
  }
  itens.forEach(function (u, i) {
    const cy = gy + slot * i + slot / 2;
    rexTexto(ctx, u.sigla, gx - 8, cy + 4, 'bold 11.5px Arial', REX_NAVY, 'right');
    ctx.fillStyle = REX_COR[relFaixa(u.media)].forte;
    ctx.fillRect(gx + 1, cy - barH / 2, Math.max(2, px(u.media) - gx - 1), barH);
    rexTexto(ctx, rexF1(u.media) + ' (' + u.riscos.length + (u.riscos.length === 1 ? ' risco)' : ' riscos)'),
      px(u.media) + 6, cy + 4, '11px Arial', REX_TXT);
  });
  const mx = px(k.mediaRisco);
  ctx.save(); ctx.setLineDash([4, 3]); ctx.strokeStyle = '#33424f'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(mx, gy - 4); ctx.lineTo(mx, gy + gh); ctx.stroke(); ctx.restore();
  rexTexto(ctx, 'média geral ' + rexF1(k.mediaRisco), mx + 5, gy + gh - 4, '11px Arial', REX_TXT);
}

function rexDistribuicao(ctx, k, x, y, w, h) {
  const top = rexSecao(ctx, x, y, w, h, 'DISTRIBUIÇÃO POR FAIXA DE RISCO');
  const linhas = [['Inerente', k.dist.inerente], ['Residual', k.dist.residual], ['Final', k.dist.final]];
  const bx = x + 90, bw = w - 90 - 34, bh = 32;
  const area = h - 26 - 40, passo = area / 3;
  linhas.forEach(function (lin, i) {
    const cy = top + 14 + passo * i + passo / 2;
    rexTexto(ctx, lin[0], x + 16, cy + 5, 'bold 13px Arial', REX_NAVY);
    const tot = lin[1].baixo + lin[1].medio + lin[1].alto || 1;
    let cx = bx;
    ['baixo', 'medio', 'alto'].forEach(function (f) {
      const q = lin[1][f]; if (!q) return;
      const sw = bw * q / tot;
      ctx.fillStyle = REX_COR[f].forte; ctx.fillRect(cx, cy - bh / 2, sw, bh);
      if (sw >= 22) {
        rexTexto(ctx, String(q), cx + sw / 2, cy + 5, 'bold 12.5px Arial',
          f === 'medio' ? '#2f2600' : '#ffffff', 'center');
      } else {
        rexTexto(ctx, String(q), cx + sw + 5, cy + 5, 'bold 12px Arial', REX_COR[f].forte);
      }
      cx += sw;
    });
  });
  let lx = bx;
  const ly = y + h - 14;
  ['baixo', 'medio', 'alto'].forEach(function (f) {
    ctx.fillStyle = REX_COR[f].forte; ctx.fillRect(lx, ly - 10, 11, 11);
    rexTexto(ctx, REX_COR[f].nome, lx + 16, ly, '11.5px Arial', REX_TXT);
    ctx.font = '11.5px Arial'; lx += 16 + ctx.measureText(REX_COR[f].nome).width + 22;
  });
}

function relPaginaResumoExecutivo(dados) {
  const c = rexCanvas(), ctx = c.ctx;
  const k = rexCalcular(dados);
  rexFaixaTitulo(ctx);
  rexInformacoesGerais(ctx, k, 10, 62, 600, 148);
  rexIndicadores(ctx, k, 620, 62, 770, 148);
  rexMatriz(ctx, k, 10, 218, 770, 427);
  rexDestaques(ctx, k, 790, 218, 600, 427);
  rexTermometro(ctx, k, 10, 653, 380, 316);
  rexMediaPorUnidade(ctx, k, 400, 653, 530, 316);
  rexDistribuicao(ctx, k, 940, 653, 450, 316);
  return c.canvas;
}

// Logos embutidos para não depender de caminho de imagem externo.
const REL_LOGO_TJPR = 'data:image/png;base64,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';
const REL_LOGO_INOVA = 'data:image/png;base64,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';

function relCabecalho(pdf) {
  pdf.addImage(REL_LOGO_TJPR, 'PNG', 11, 6, 31, 19, undefined, 'FAST');
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(16); pdf.setTextColor(14, 154, 167);
  pdf.text('RELATÓRIO EXECUTIVO', 148.5, 17, { align: 'center' });
  pdf.setDrawColor(14, 154, 167); pdf.setLineWidth(0.55);
  pdf.line(132, 20, 165, 20);
  pdf.addImage(REL_LOGO_INOVA, 'PNG', 255, 7, 29, 17, undefined, 'FAST');
  pdf.line(11, 29, 286, 29);
}

function relRodape(pdf, pagina, total, usuario, data) {
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5); pdf.setTextColor(95, 105, 118);
  pdf.text('Secretaria de Gestão de Precatórios', 5, 207);
  pdf.text('Página ' + pagina + ' de ' + total, 148.5, 207, { align: 'center' });
  const texto = 'Gerado em: ' + data + '  |  Por: ' +
    (usuario.nome || usuario.name || 'Usuário') + '  |  Matrícula: ' +
    (usuario.matricula || usuario.matriculaUsuario || '-');
  pdf.text(texto, 292, 207, { align: 'right', maxWidth: 106 });
}

// ============================================================
// CAPA DO RELATÓRIO COMPLETO
// ============================================================
const REL_CAPA_SEI = 'SEI nº 0076939-37.2026.8.16.6000';
const REL_CAPA_MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho',
  'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function relCarregarImagem(src) {
  return new Promise(function (ok, erro) {
    const img = new Image();
    img.onload = function () { ok(img); };
    img.onerror = function () { erro(new Error('Falha ao carregar o logo da capa.')); };
    img.src = src;
  });
}

function relLogoBranco(img) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || img.width; c.height = img.naturalHeight || img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < d.data.length; i += 4) {
    const lum = 0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2];
    d.data[i] = d.data[i + 1] = d.data[i + 2] = 255;
    d.data[i + 3] = Math.max(0, Math.min(255, Math.round((255 - lum) * 1.25)));
  }
  ctx.putImageData(d, 0, 0);
  return c;
}

function relVersalete(ctx, texto, x, y, tam, cor, align) {
  const menor = Math.round(tam * 0.78);
  const pecas = [];
  String(texto).split(' ').forEach(function (pal, i) {
    if (i) pecas.push({ t: ' ', s: menor });
    if (!pal) return;
    const ini = pal.charAt(0), resto = pal.slice(1);
    const iniMaiuscula = ini === ini.toUpperCase() && ini !== ini.toLowerCase();
    pecas.push({ t: ini.toUpperCase(), s: iniMaiuscula || /\d/.test(ini) ? tam : menor });
    if (resto) pecas.push({ t: resto.toUpperCase(), s: menor });
  });
  let largura = 0;
  pecas.forEach(function (p) { ctx.font = 'bold ' + p.s + 'px Lato, Arial, sans-serif'; p.w = ctx.measureText(p.t).width; largura += p.w; });
  let cx = align === 'center' ? x - largura / 2 : x;
  ctx.fillStyle = cor; ctx.textAlign = 'left';
  pecas.forEach(function (p) {
    ctx.font = 'bold ' + p.s + 'px Lato, Arial, sans-serif';
    ctx.fillText(p.t, cx, y); cx += p.w;
  });
}

async function relPaginaCapa() {
  const W = 2970, H = 2100;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#15314a'; ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.045)'; ctx.lineWidth = 9;
  for (let k = -H; k < W + H; k += 32) {
    ctx.beginPath(); ctx.moveTo(k, H); ctx.lineTo(k + H, 0); ctx.stroke();
  }
  ctx.restore();

  const logo = relLogoBranco(await relCarregarImagem(REL_LOGO_TJPR));
  const lw = 560, lh = lw * logo.height / logo.width;
  ctx.drawImage(logo, 625, 920 - lh / 2, lw, lh);

  ctx.fillStyle = '#2bb3b1'; ctx.fillRect(1333, 750, 6, 356);

  relVersalete(ctx, 'Mapa de Riscos', 1410, 885, 122, '#ffffff');
  relVersalete(ctx, 'Gestão de Riscos dos Processos de Trabalho', 1410, 975, 52, '#ffffff');
  relVersalete(ctx, 'Inova Setorial 2026', 1410, 1058, 52, '#ffffff');
  ctx.fillStyle = '#ffffff'; ctx.font = '38px Lato, Arial, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(REL_CAPA_SEI, 1422, 1218);

  relVersalete(ctx, 'Secretaria de Gestão de Precatórios', W / 2, 1690, 86, '#ffffff', 'center');
  const hoje = new Date();
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 40px Lato, Arial, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(REL_CAPA_MESES[hoje.getMonth()] + '/' + hoje.getFullYear(), W / 2, 1772);

  ctx.fillStyle = '#2bb3b1'; ctx.fillRect(2630, 1860, W - 2630, H - 1860);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.moveTo(W, 1880); ctx.lineTo(W, H); ctx.lineTo(2700, H); ctx.closePath(); ctx.fill();
  ctx.textAlign = 'left';
  return c;
}

// ============================================================
// EXPORTAÇÃO - 'resumo' ou 'completo'
// ============================================================
// ============================================================
// PREVIA DO RESUMO EXECUTIVO (modal)
// Clique fora / Esc / X fecha e volta ao sistema; "Baixar PDF" salva o arquivo.
// ============================================================
function injetarEstiloPreviaResumoExec() {
  if (document.getElementById("estiloPreviaResumoExec")) return;
  const st = document.createElement("style");
  st.id = "estiloPreviaResumoExec";
  st.textContent = `
  #previaResumoExec{position:fixed;inset:0;z-index:10050;display:flex;align-items:center;justify-content:center;
    padding:24px;background:rgba(4,14,22,.72);backdrop-filter:blur(3px);
    opacity:0;transition:opacity .2s ease;}
  #previaResumoExec.aberta{opacity:1;}
  #previaResumoExec .prv-box{position:relative;width:min(1180px,96vw);max-height:94vh;display:flex;flex-direction:column;
    background:#10273a;border:1px solid rgba(77,208,225,.30);border-radius:16px;
    box-shadow:0 24px 60px rgba(0,0,0,.55);overflow:hidden;
    transform:translateY(14px) scale(.98);transition:transform .22s ease;}
  #previaResumoExec.aberta .prv-box{transform:none;}
  #previaResumoExec .prv-head{display:flex;align-items:center;gap:12px;padding:12px 16px;
    border-bottom:1px solid rgba(255,255,255,.08);}
  #previaResumoExec .prv-tit{flex:1;font-weight:800;font-size:15px;color:#e8f4f8;}
  #previaResumoExec .prv-tit small{display:block;font-weight:600;font-size:11.5px;color:#9fb7c1;}
  #previaResumoExec .prv-btn{border:0;border-radius:10px;padding:9px 16px;font-weight:800;font-size:13px;cursor:pointer;
    display:inline-flex;align-items:center;gap:7px;}
  #previaResumoExec .prv-baixar{background:linear-gradient(135deg,#14a3b3,#0b7f8c);color:#fff;
    box-shadow:0 6px 16px rgba(20,163,179,.35);}
  #previaResumoExec .prv-baixar:hover{filter:brightness(1.08);}
  #previaResumoExec .prv-fechar{background:rgba(255,255,255,.06);color:#e8f4f8;width:38px;height:38px;justify-content:center;padding:0;}
  #previaResumoExec .prv-fechar:hover{background:rgba(224,90,90,.25);}
  #previaResumoExec .prv-corpo{overflow:auto;padding:16px;background:#0b1d2b;}
  #previaResumoExec .prv-corpo img{display:block;width:100%;height:auto;border-radius:6px;background:#fff;
    box-shadow:0 8px 24px rgba(0,0,0,.4);}
  html[data-theme="light"] #previaResumoExec .prv-box{background:#ffffff;border-color:#cfe3ea;}
  html[data-theme="light"] #previaResumoExec .prv-tit{color:#12333f;}
  html[data-theme="light"] #previaResumoExec .prv-corpo{background:#eef4f7;}
  html[data-theme="light"] #previaResumoExec .prv-fechar{background:#eef4f7;color:#12333f;}
  body.prv-aberta{overflow:hidden;}
  `;
  document.head.appendChild(st);
}

function fecharPreviaResumoExecutivo() {
  const m = document.getElementById("previaResumoExec");
  if (!m) return;
  m.classList.remove("aberta");
  document.body.classList.remove("prv-aberta");
  document.removeEventListener("keydown", m.__esc);
  setTimeout(function () { if (m.parentNode) m.remove(); }, 220);
}

function abrirPreviaResumoExecutivo(imagem, aoBaixar) {
  if (!imagem) { if (aoBaixar) aoBaixar(); return; }
  fecharPreviaResumoExecutivo();
  injetarEstiloPreviaResumoExec();
  const m = document.createElement("div");
  m.id = "previaResumoExec";
  m.innerHTML =
    '<div class="prv-box" role="dialog" aria-modal="true" aria-label="Prévia do resumo executivo">' +
      '<div class="prv-head">' +
        '<div class="prv-tit"><i class="bi bi-eye"></i> Prévia do Resumo Executivo' +
          '<small>Confira como o relatório vai ficar. Clique fora para fechar.</small></div>' +
        '<button type="button" class="prv-btn prv-baixar"><i class="bi bi-download"></i> Baixar PDF</button>' +
        '<button type="button" class="prv-btn prv-fechar" title="Fechar"><i class="bi bi-x-lg"></i></button>' +
      '</div>' +
      '<div class="prv-corpo"><img alt="Prévia do resumo executivo" src="' + imagem + '"></div>' +
    '</div>';
  document.body.appendChild(m);
  document.body.classList.add("prv-aberta");

  m.addEventListener("click", function (e) { if (e.target === m) fecharPreviaResumoExecutivo(); });
  m.querySelector(".prv-fechar").addEventListener("click", fecharPreviaResumoExecutivo);
  m.querySelector(".prv-baixar").addEventListener("click", function () {
    try { if (aoBaixar) aoBaixar(); } finally { fecharPreviaResumoExecutivo(); }
  });
  m.__esc = function (e) { if (e.key === "Escape") fecharPreviaResumoExecutivo(); };
  document.addEventListener("keydown", m.__esc);
  requestAnimationFrame(function () { m.classList.add("aberta"); });
}
window.abrirPreviaResumoExecutivo = abrirPreviaResumoExecutivo;
window.fecharPreviaResumoExecutivo = fecharPreviaResumoExecutivo;

async function exportarRelatorioExecutivoPDF(modo) {
  modo = modo === 'resumo' ? 'resumo' : 'completo';
  if (!window.jspdf || !window.jspdf.jsPDF) {
    if (typeof showToast === 'function') showToast('Biblioteca jsPDF não carregada.', 'error');
    return;
  }
  const dados = montarDadosRelatorioExecutivo();
  if (!dados.riscos.length) {
    if (typeof showToast === 'function') showToast('Nenhum risco no filtro atual do dashboard.', 'error');
    return;
  }
  const botao = document.getElementById('btnRelatorioExecutivo');
  if (botao) botao.disabled = true;
  try {
    if (typeof showToast === 'function') {
      showToast(modo === 'resumo' ? 'Gerando prévia do resumo executivo...' : 'Gerando relatório completo...', 'success');
    }
    const pdf = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
    const dataHoje = new Date().toLocaleDateString('pt-BR');
    let usuario = {};
    try { usuario = JSON.parse(sessionStorage.getItem('mapa_user') || '{}') || {}; } catch (e) {}
    const ano = document.getElementById('filtroAnoGlobal');
    const meses = Array.from(mesesSelecionadosDashboard).sort(function(a, b) { return a - b; });
    const escopo = (ano && ano.value ? ano.value : 'Todos os anos') +
      (meses.length ? ' | Meses: ' + meses.join(', ') : ' | Todos os meses');

    const tipos = [];
    function adicionarPagina(canvas, opcoes, tipo) {
      opcoes = opcoes || {};
      if (tipos.length) pdf.addPage('a4', 'landscape');
      tipos.push(tipo || 'normal');
      const topo = opcoes.topo || 34, alturaMax = opcoes.alturaMax || 155;
      const esq = opcoes.esquerda || 11, w = opcoes.largura || 275;
      const h = canvas.height * w / canvas.width;
      if (h > alturaMax) throw new Error('Conteúdo excedeu a área útil do PDF.');
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', esq, topo, w, h, undefined, 'FAST');
    }

    const OPC_RESUMO = { topo: 6, esquerda: 6, largura: 285, alturaMax: 199 };

    if (modo === 'completo') {
      adicionarPagina(await relPaginaCapa(), { topo: 0.01, esquerda: 0.01, largura: 297, alturaMax: 211 }, 'capa');
    }
    const canvasResumo = relPaginaResumoExecutivo(dados);
    window._ultimaImagemResumoExec = canvasResumo.toDataURL('image/png');
    adicionarPagina(canvasResumo, OPC_RESUMO, 'resumo');

    if (modo === 'completo') {
      adicionarPagina(relPaginaTabela(relTop10(dados.riscos),
        'Os 10 maiores riscos', 'Todas as divisões  |  ' + escopo));
      dados.divisoes.forEach(function(div) {
        adicionarPagina(relPaginaDivisao(div));
      });
      adicionarPagina(relPaginaDistribuicao(dados));
      adicionarPagina(relPaginaAntesDepois(dados));
      adicionarPagina(relPaginaAtencao(dados));
      adicionarPagina(relPaginaPrazos(dados));
    }

    const totalPaginas = pdf.internal.getNumberOfPages();
    for (let p = 1; p <= totalPaginas; p++) {
      const tipo = tipos[p - 1];
      if (tipo === 'capa' || tipo === 'resumo') continue;
      pdf.setPage(p);
      relCabecalho(pdf);
      relRodape(pdf, p, totalPaginas, usuario, dataHoje);
    }

    const sigla = dados.divisoes.length === 1 ? dados.divisoes[0].sigla : 'SEPREC';
    const prefixo = modo === 'resumo' ? 'Resumo_Executivo_' : 'Relatorio_Executivo_Completo_';
    const nomeArquivo = prefixo + sigla + '_' + new Date().toISOString().slice(0, 10) + '.pdf';

    if (modo === 'resumo') {
      // Resumo executivo: mostra a previa; o download acontece pelo botao do modal
      abrirPreviaResumoExecutivo(window._ultimaImagemResumoExec, function () {
        pdf.save(nomeArquivo);
        if (typeof showToast === 'function') showToast('Resumo executivo baixado.', 'success');
      });
      if (typeof registrarLog === 'function') {
        registrarLog('exportar_pdf_executivo', null,
          'Resumo executivo (prévia): ' + dados.totais.processos + ' processo(s), ' + dados.totais.riscos + ' risco(s)');
      }
      return;
    }
    pdf.save(nomeArquivo);
    if (typeof registrarLog === 'function') {
      registrarLog('exportar_pdf_executivo', null,
        (modo === 'resumo' ? 'Resumo executivo: ' : 'Relatório executivo completo: ') +
        dados.totais.processos + ' processo(s), ' + dados.totais.riscos + ' risco(s)');
    }
    if (typeof showToast === 'function') {
      showToast(modo === 'resumo' ? 'Resumo executivo gerado.' : 'Relatório completo gerado.', 'success');
    }
  } catch (e) {
    console.error('[Relatório Executivo]', e);
    if (typeof showToast === 'function') showToast('Erro ao gerar relatório: ' + e.message, 'error');
  } finally {
    if (botao) botao.disabled = false;
  }
}

// ============================================================
// BOTAO NA BARRA DO DASHBOARD (com menu de 2 opções)
// ============================================================
function injetarEstiloMenuRelatorioExecutivo() {
  if (document.getElementById('estiloMenuRelExec')) return;
  const st = document.createElement('style');
  st.id = 'estiloMenuRelExec';
  st.textContent =
    '#menuRelatorioExecutivo{position:absolute;right:0;top:calc(100% + 6px);z-index:5000;min-width:270px;' +
    'padding:6px;border-radius:12px;background:#12293a;border:1px solid rgba(43,179,177,.45);' +
    'box-shadow:0 18px 40px rgba(0,0,0,.55);}' +
    '#menuRelatorioExecutivo .rel-exec-item{display:flex;align-items:flex-start;gap:10px;width:100%;' +
    'text-align:left;background:transparent;border:0;border-radius:8px;padding:10px 12px;cursor:pointer;' +
    'transition:background .15s ease;}' +
    '#menuRelatorioExecutivo .rel-exec-item:hover{background:rgba(43,179,177,.16);}' +
    '#menuRelatorioExecutivo .rel-exec-item + .rel-exec-item{margin-top:2px;}' +
    '#menuRelatorioExecutivo .rel-exec-ico{color:#2bd1cc;font-size:18px;margin-top:1px;}' +
    '#menuRelatorioExecutivo .rel-exec-tit{display:block;font-size:13px;font-weight:700;color:#e6f1f5;}' +
    '#menuRelatorioExecutivo .rel-exec-desc{display:block;font-size:11px;margin-top:2px;color:#9fb6c3;}' +
    'html[data-theme="light"] #menuRelatorioExecutivo{background:#ffffff;border-color:rgba(14,154,167,.35);' +
    'box-shadow:0 16px 38px rgba(15,40,60,.18);}' +
    'html[data-theme="light"] #menuRelatorioExecutivo .rel-exec-item:hover{background:rgba(14,154,167,.10);}' +
    'html[data-theme="light"] #menuRelatorioExecutivo .rel-exec-ico{color:#0b7d8c;}' +
    'html[data-theme="light"] #menuRelatorioExecutivo .rel-exec-tit{color:#1a2b3d;}' +
    'html[data-theme="light"] #menuRelatorioExecutivo .rel-exec-desc{color:#5b6f7d;}';
  document.head.appendChild(st);
}

function fecharMenuRelatorioExecutivo() {
  const menu = document.getElementById('menuRelatorioExecutivo');
  if (menu) menu.style.display = 'none';
}

function injetarBotaoRelatorioExecutivo() {
  if (document.getElementById("btnRelatorioExecutivo")) return;

  const alvo =
    document.querySelector(".dashboard-actions") ||
    document.querySelector(".header-actions") ||
    document.querySelector(".page-actions") ||
    document.querySelector(".filtros-header") ||
    document.querySelector(".barra-filtros") ||
    document.getElementById("periodoResumo");
  if (!alvo) return;

  const btn = document.createElement("button");
  btn.id = "btnRelatorioExecutivo";
  btn.type = "button";
  btn.className = "btn btn-primary btn-rel-exec";
  btn.innerHTML = '<i class="bi bi-file-earmark-pdf"></i> Relatório Executivo <i class="bi bi-chevron-down" style="font-size:11px;"></i>';
  btn.style.cssText =
    "display:inline-flex;align-items:center;gap:8px;border:0;border-radius:9px;" +
    "padding:10px 18px;font-size:13px;font-weight:700;cursor:pointer;" +
    "background:linear-gradient(135deg,#0e9aa7,#0b7d8c);color:#fff;" +
    "box-shadow:0 4px 14px rgba(14,154,167,.28);transition:.18s ease;";
  btn.addEventListener("mouseenter", function () {
    btn.style.transform = "translateY(-2px)";
    btn.style.boxShadow = "0 7px 20px rgba(14,154,167,.38)";
  });
  btn.addEventListener("mouseleave", function () {
    btn.style.transform = "translateY(0)";
    btn.style.boxShadow = "0 4px 14px rgba(14,154,167,.28)";
  });

  injetarEstiloMenuRelatorioExecutivo();
  const menu = document.createElement("div");
  menu.id = "menuRelatorioExecutivo";
  menu.style.display = "none";

  function itemMenu(icone, titulo, descricao, modo) {
    const it = document.createElement("button");
    it.type = "button";
    it.className = "rel-exec-item";
    it.innerHTML =
      '<i class="bi ' + icone + ' rel-exec-ico"></i>' +
      '<span><span class="rel-exec-tit">' + titulo + '</span>' +
      '<span class="rel-exec-desc">' + descricao + '</span></span>';
    it.onclick = function (e) {
      e.stopPropagation();
      fecharMenuRelatorioExecutivo();
      exportarRelatorioExecutivoPDF(modo);
    };
    return it;
  }
  menu.appendChild(itemMenu("bi-file-earmark-bar-graph", "Ver resumo executivo",
    "Somente a página do Resumo Executivo de Riscos", "resumo"));
  menu.appendChild(itemMenu("bi-journal-richtext", "Ver relatório completo",
    "Capa + resumo + todas as páginas de análise", "completo"));

  btn.onclick = function (e) {
    e.stopPropagation();
    menu.style.display = menu.style.display === "none" ? "block" : "none";
  };
  document.addEventListener("click", function (e) {
    if (!e.target.closest || !e.target.closest("#wrapRelatorioExecutivo")) fecharMenuRelatorioExecutivo();
  });

  const wrap = document.createElement("div");
  wrap.id = "wrapRelatorioExecutivo";
  wrap.style.cssText = "position:relative;display:inline-block;";
  wrap.appendChild(btn);
  wrap.appendChild(menu);

  const linhaBotao = document.createElement("div");
  linhaBotao.style.cssText =
    "width:100%;display:flex;justify-content:flex-end;align-items:center;margin-top:8px;box-sizing:border-box;";
  linhaBotao.appendChild(wrap);

  if (alvo.id === "periodoResumo" && alvo.parentNode) {
    alvo.parentNode.appendChild(linhaBotao);
  } else {
    alvo.appendChild(linhaBotao);
  }
}

document.addEventListener("DOMContentLoaded", function () {
  setTimeout(injetarBotaoRelatorioExecutivo, 900);
  setTimeout(injetarBotaoRelatorioExecutivo, 2000);
});

// ============================================================
// PAINEL EXECUTIVO NO DASHBOARD (estilo dos graficos)
// ============================================================
  (function () {
    "use strict";

    const PEX_COR = { baixo: "#3ad48a", medio: "#f5c94a", alto: "#e05a5a" };
    const PEX_NOME = { baixo: "Baixo", medio: "Médio", alto: "Alto" };

    // ---------------- CSS ----------------
    function pexEstilos() {
      if (document.getElementById("estiloPainelExecDashV2")) return;
      const st = document.createElement("style");
      st.id = "estiloPainelExecDashV2";
      st.textContent = `
      .pex-wrap{display:flex;flex-direction:column;gap:18px;margin:14px 0 18px;grid-column:1/-1;width:100%;}
      .pex-linha{display:grid;gap:18px;align-items:stretch;}
      .pex-l1{grid-template-columns:3fr 5fr;}
      .pex-l2{grid-template-columns:1.25fr 1fr;}
      .pex-l3{grid-template-columns:1fr 1.4fr 1.2fr;}
      @media (max-width:1150px){.pex-l1,.pex-l2,.pex-l3{grid-template-columns:1fr;}}

      .pex-card{background:var(--card-bg,#132b3e);border:1px solid rgba(255,255,255,.08);
        border-radius:14px;padding:18px 22px;box-shadow:0 6px 18px rgba(0,0,0,.18);min-width:0;}
      .pex-head{display:flex;align-items:center;gap:10px;padding-bottom:12px;margin-bottom:14px;
        border-bottom:1px solid rgba(255,255,255,.10);}
      .pex-head i{color:#4dd0e1;font-size:17px;}
      .pex-head span{font-size:16.5px;font-weight:700;color:#e8f4f8;}
      .pex-sub{font-size:12px;color:#9fb7c1;margin:-6px 0 12px;}

      /* mini cards (KPIs) */
      .pex-kpis{display:grid;gap:12px;}
      .pex-kpis.k3{grid-template-columns:repeat(3,1fr);}
      .pex-kpis.k5{grid-template-columns:repeat(5,1fr);}
      @media (max-width:1400px){.pex-kpis.k5{grid-template-columns:repeat(3,1fr);}}
      .pex-kpi{position:relative;display:flex;gap:12px;align-items:flex-start;
        background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);
        border-radius:12px;padding:12px 14px;min-width:0;}
      .pex-kpi::before{content:"";position:absolute;left:0;right:0;top:0;height:3px;
        border-radius:12px 12px 0 0;background:var(--pex-cor,#4dd0e1);}
      .pex-kpi-ico{flex:0 0 38px;height:38px;border-radius:10px;display:flex;align-items:center;
        justify-content:center;font-size:17px;color:var(--pex-cor,#4dd0e1);
        background:color-mix(in srgb,var(--pex-cor,#4dd0e1) 16%,transparent);}
      .pex-kpi-val{font-size:24px;font-weight:800;line-height:1.1;color:#ffffff;}
      .pex-kpi-tit{font-size:12px;font-weight:700;color:#e8f4f8;margin-top:2px;}
      .pex-kpi-sub{font-size:11px;color:#9fb7c1;margin-top:2px;word-break:break-word;}
      .pex-kpi.tem-tip{cursor:help;}
      .pex-kpi-info{position:absolute;top:8px;right:9px;font-size:12px;color:#4dd0e1;opacity:.8;}

      /* tooltip dos 4 KPIs antigos */
      .pex-tip{display:none;position:absolute;z-index:60;top:calc(100% + 8px);right:0;min-width:260px;
        background:#0f2333;border:1px solid rgba(77,208,225,.40);border-radius:12px;
        box-shadow:0 14px 34px rgba(0,0,0,.45);padding:12px 14px;cursor:default;}
      .pex-kpi.tem-tip:hover .pex-tip{display:block;}
      .pex-tip-tit{font-size:11.5px;font-weight:800;letter-spacing:.5px;color:#4dd0e1;margin-bottom:6px;}
      .pex-tip-lin{display:flex;align-items:center;gap:10px;padding:6px 0;border-top:1px solid rgba(255,255,255,.07);}
      .pex-tip-lin:first-of-type{border-top:0;}
      .pex-tip-lin i{width:26px;height:26px;border-radius:7px;display:flex;align-items:center;justify-content:center;
        font-size:13px;}
      .pex-tip-rot{flex:1;font-size:12.5px;color:#e8f4f8;}
      .pex-tip-val{font-size:17px;font-weight:800;}

      /* matriz */
      .pex-mtz{display:grid;grid-template-columns:26px 92px repeat(5,1fr);
        grid-template-rows:repeat(5,minmax(62px,1fr)) 40px;gap:6px;}
      .pex-mtz-eixoY{grid-column:1;grid-row:1/6;display:flex;align-items:center;justify-content:center;}
      .pex-mtz-eixoY span{writing-mode:vertical-rl;transform:rotate(180deg);font-size:11px;
        font-weight:800;letter-spacing:2px;color:#5fe3f5;}
      .pex-mtz-rot{display:flex;align-items:center;justify-content:center;text-align:center;
        border-radius:8px;font-size:12px;font-weight:700;color:#e8f4f8;
        background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);padding:4px;}
      .pex-cel{position:relative;border-radius:9px;display:flex;align-items:center;justify-content:center;}
      .pex-cel-n{position:absolute;top:4px;left:7px;font-size:10.5px;font-weight:800;color:rgba(0,0,0,.55);}
      .pex-bolha{border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;
        color:#fff;border:2px solid rgba(255,255,255,.9);box-shadow:0 3px 10px rgba(0,0,0,.30);
        text-shadow:0 1px 2px rgba(0,0,0,.35);}
      .pex-mtz-eixoX{display:flex;align-items:center;gap:10px;margin-top:10px;padding-left:124px;}
      .pex-mtz-eixoX div{flex:1;height:2px;background:#5fe3f5;}
      .pex-mtz-eixoX span{font-size:11px;font-weight:800;letter-spacing:2px;color:#5fe3f5;}
      .pex-leg{display:flex;flex-wrap:wrap;align-items:center;gap:16px;margin-top:12px;
        font-size:12px;font-weight:600;color:#e8f4f8;}
      .pex-leg b{display:inline-block;width:11px;height:11px;border-radius:50%;margin-right:6px;vertical-align:-1px;}

      /* destaques */
      .pex-dest{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
      .pex-dc{border-radius:12px;padding:12px 14px;background:rgba(255,255,255,.04);
        border:1px solid rgba(255,255,255,.08);border-left:4px solid var(--pex-cor);display:flex;
        flex-direction:column;min-width:0;}
      .pex-dc-top{display:flex;align-items:flex-start;gap:8px;}
      .pex-dc-rot{font-size:10.5px;font-weight:800;letter-spacing:.4px;color:var(--pex-cor);}
      .pex-dc-cod{font-size:19px;font-weight:800;color:#ffffff;margin-top:2px;}
      .pex-dc-media{margin-left:auto;text-align:right;}
      .pex-dc-media strong{display:block;font-size:20px;font-weight:800;color:#ffffff;}
      .pex-dc-media small{font-size:10px;color:#9fb7c1;}
      .pex-dc-nome{font-size:12.5px;font-weight:700;color:#e8f4f8;margin-top:6px;}
      .pex-dc-desc{font-size:11px;color:#9fb7c1;margin-top:3px;flex:1;}
      .pex-escala{position:relative;height:6px;border-radius:3px;margin-top:12px;
        background:linear-gradient(90deg,#3ad48a 0 28%,#f5c94a 28% 80%,#e05a5a 80% 100%);opacity:.9;}
      .pex-escala i{position:absolute;top:50%;width:12px;height:12px;border-radius:50%;
        background:#ffffff;border:2px solid #0f2333;transform:translate(-50%,-50%);}
      .pex-escala-n{display:flex;justify-content:space-between;font-size:10px;color:#9fb7c1;margin-top:4px;}

      /* gauge */
      .pex-gauge svg{display:block;width:100%;max-width:300px;margin:0 auto;}
      .pex-evo{display:grid;grid-template-columns:1fr auto 1fr auto 1fr;gap:6px;align-items:center;margin-top:6px;}
      .pex-evo-c{text-align:center;border-radius:10px;padding:8px 4px;background:rgba(255,255,255,.04);
        border:1px solid rgba(255,255,255,.08);border-top:3px solid var(--pex-cor);}
      .pex-evo-c small{display:block;font-size:10px;font-weight:800;letter-spacing:.5px;color:#9fb7c1;}
      .pex-evo-c strong{font-size:19px;font-weight:800;color:#ffffff;}
      .pex-evo-s{text-align:center;font-size:10.5px;font-weight:800;}
      .pex-chart{position:relative;height:290px;}
      /* Graficos ao lado do velocimetro ocupam toda a altura do card */
      #pexUnidades,#pexDistrib{display:flex;flex-direction:column;}
      #pexUnidades .pex-body,#pexDistrib .pex-body{flex:1 1 auto;display:flex;flex-direction:column;min-height:0;}
      #pexUnidades .pex-chart,#pexDistrib .pex-chart{flex:1 1 auto;height:auto;min-height:290px;}
      .pex-l3{align-items:stretch;}
      /* velocimetro interativo */
      .pex-g-ponteiro{transform-box:view-box;transform-origin:150px 150px;
        transition:transform 1.8s cubic-bezier(.65,0,.35,1);}
      .pex-gauge{overflow:visible;padding-top:4px;}
      .pex-g-marca-grupo{cursor:pointer;transition:transform .25s ease;transform-box:fill-box;transform-origin:center;}
      .pex-g-marca-grupo:hover{transform:scale(1.12);}
      .pex-g-marca-grupo.pex-g-marca-on .pex-g-marca{stroke:#4dd0e1;stroke-width:3.5;
        filter:drop-shadow(0 0 6px rgba(77,208,225,.9));}
      .pex-g-rotulo{text-align:center;font-size:12.5px;font-weight:700;color:#e8f4f8;
        margin:2px 0 10px;min-height:18px;white-space:normal;}
      html[data-theme="light"] .pex-g-rotulo{color:#12333f;}
      html[data-theme="light"] .pex-g-marca-grupo.pex-g-marca-on .pex-g-marca{stroke:#0b6b78;}
      .pex-g-arco{transition:opacity .9s ease,filter .9s ease;}
      .pex-g-marca{cursor:pointer;transition:r .2s ease;}
      .pex-g-marca:hover{r:11;}
      .pex-g-btn{cursor:pointer;border-radius:10px;padding:2px 7px;transition:background .15s ease,box-shadow .15s ease;}
      .pex-g-btn:hover{background:rgba(77,208,225,.12);}
      .pex-evo-c.pex-g-btn{padding:8px 4px;}
      .pex-g-ativo{box-shadow:0 0 0 2px #4dd0e1,0 0 12px 2px rgba(77,208,225,.45);}
      html[data-theme="light"] .pex-g-ativo{box-shadow:0 0 0 2px #0b6b78,0 0 10px 2px rgba(14,154,167,.35);}
      @media (prefers-reduced-motion:reduce){.pex-g-ponteiro,.pex-g-arco{transition:none;}}

      /* celulas da matriz COM riscos: brilho (2) + pulso leve (4) + elevacao (5) */
      @keyframes pexPulso{
        0%,100%{box-shadow:0 6px 12px rgba(0,0,0,.35),0 0 8px 1px var(--pex-glow);}
        50%{box-shadow:0 6px 12px rgba(0,0,0,.35),0 0 15px 3px var(--pex-glow);}
      }
      .pex-cel.pex-tem{transform:translateY(-2px);z-index:1;
        box-shadow:0 6px 12px rgba(0,0,0,.35),0 0 8px 1px var(--pex-glow);
        animation:pexPulso 3s ease-in-out infinite;}
      .pex-cel.pex-tem.pex-click:hover{transform:translateY(-3px) scale(1.03);}
      .pex-cel.pex-tem.pex-apagada{animation:none;box-shadow:none;transform:none;}
      html[data-theme="light"] .pex-cel.pex-tem{
        box-shadow:0 5px 10px rgba(15,40,60,.18),0 0 8px 1px var(--pex-glow);}
      html[data-theme="light"] .pex-cel.pex-tem{animation-name:pexPulsoClaro;}
      @keyframes pexPulsoClaro{
        0%,100%{box-shadow:0 5px 10px rgba(15,40,60,.18),0 0 7px 1px var(--pex-glow);}
        50%{box-shadow:0 5px 10px rgba(15,40,60,.18),0 0 13px 3px var(--pex-glow);}
      }
      @media (prefers-reduced-motion:reduce){.pex-cel.pex-tem{animation:none;}}

      /* interacao (filtro cruzado) */
      .pex-click{cursor:pointer;transition:transform .12s ease,box-shadow .12s ease,filter .12s ease;}
      .pex-click:hover{filter:brightness(1.08);box-shadow:0 0 0 2px rgba(77,208,225,.55);}
      .pex-cel.pex-click:hover{transform:scale(1.03);}
      .pex-sel{box-shadow:0 0 0 3px #ffffff,0 0 14px 3px rgba(77,208,225,.85) !important;z-index:2;}
      .pex-cel.pex-apagada{opacity:.35;}
      .pex-dica{font-size:11px;color:#9fb7c1;margin-top:8px;}
      .pex-dica i{color:#4dd0e1;margin-right:4px;}
      .pex-lista{margin-top:12px;border-top:1px solid rgba(255,255,255,.10);padding-top:10px;}
      .pex-lista-tit{display:flex;align-items:center;justify-content:space-between;gap:8px;
        font-size:12.5px;font-weight:800;color:#5fe3f5;margin-bottom:8px;}
      .pex-lista-tit button{border:1px solid rgba(224,90,90,.45);background:rgba(224,90,90,.12);color:#ff8a8a;
        border-radius:8px;padding:3px 10px;font-size:11px;font-weight:700;cursor:pointer;}
      .pex-lista-box{max-height:210px;overflow-y:auto;display:flex;flex-direction:column;gap:5px;}
      .pex-lista-it{display:grid;grid-template-columns:150px 1fr 56px;gap:10px;align-items:center;
        background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:6px 10px;}
      .pex-lista-cod{font-size:12px;font-weight:800;color:#ffffff;}
      .pex-lista-ev{font-size:12px;color:#e8f4f8;min-width:0;}
      .pex-lista-ev small{display:block;font-size:10.5px;color:#9fb7c1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .pex-lista-niv{justify-self:end;font-size:12px;font-weight:800;color:#13283a;border-radius:10px;padding:2px 9px;}
      .pex-g-leg{display:flex;flex-wrap:wrap;justify-content:center;gap:14px;font-size:11.5px;font-weight:700;
        color:#e8f4f8;margin:-2px 0 4px;}
      .pex-g-leg b{display:inline-block;width:11px;height:11px;border-radius:50%;margin-right:5px;vertical-align:-1px;
        border:2px solid #ffffff;}
      html[data-theme="light"] .pex-lista{border-top-color:#e3eaee;}
      html[data-theme="light"] .pex-lista-tit{color:#0b6b78;}
      html[data-theme="light"] .pex-lista-it{background:#f5f8fa;border-color:#e3eaee;}
      html[data-theme="light"] .pex-lista-cod{color:#0e2233;}
      html[data-theme="light"] .pex-lista-ev,
      html[data-theme="light"] .pex-g-leg{color:#12333f;}
      html[data-theme="light"] .pex-sel{box-shadow:0 0 0 3px #0b6b78,0 0 12px 2px rgba(14,154,167,.6) !important;}

      /* tema claro */
      html[data-theme="light"] .pex-card{background:var(--card-bg,#ffffff);border-color:#dfe8ed;
        box-shadow:0 6px 18px rgba(15,40,60,.08);}
      html[data-theme="light"] .pex-head{border-bottom-color:#e3eaee;}
      html[data-theme="light"] .pex-head i{color:#0b7d8c;}
      html[data-theme="light"] .pex-head span,
      html[data-theme="light"] .pex-kpi-tit,
      html[data-theme="light"] .pex-dc-nome,
      html[data-theme="light"] .pex-leg,
      html[data-theme="light"] .pex-mtz-rot{color:#12333f;}
      html[data-theme="light"] .pex-kpi-val,
      html[data-theme="light"] .pex-dc-cod,
      html[data-theme="light"] .pex-dc-media strong,
      html[data-theme="light"] .pex-evo-c strong{color:#0e2233;}
      html[data-theme="light"] .pex-sub,
      html[data-theme="light"] .pex-kpi-sub,
      html[data-theme="light"] .pex-dc-desc,
      html[data-theme="light"] .pex-dc-media small,
      html[data-theme="light"] .pex-escala-n,
      html[data-theme="light"] .pex-evo-c small{color:#5b6f7d;}
      html[data-theme="light"] .pex-kpi,
      html[data-theme="light"] .pex-dc,
      html[data-theme="light"] .pex-evo-c{background:#f5f8fa;border-color:#e3eaee;}
      html[data-theme="light"] .pex-dc{border-left-color:var(--pex-cor);}
      html[data-theme="light"] .pex-evo-c{border-top-color:var(--pex-cor);}
      html[data-theme="light"] .pex-mtz-rot{background:#eef4f7;border-color:#c3d2da;}
      html[data-theme="light"] .pex-mtz-eixoY span,
      html[data-theme="light"] .pex-mtz-eixoX span{color:#0b6b78;}
      html[data-theme="light"] .pex-mtz-eixoX div{background:#0b6b78;}
      html[data-theme="light"] .pex-tip{background:#ffffff;border-color:rgba(14,154,167,.35);
        box-shadow:0 14px 34px rgba(15,40,60,.18);}
      html[data-theme="light"] .pex-tip-rot{color:#12333f;}
      html[data-theme="light"] .pex-tip-lin{border-top-color:#e3e8ee;}
      `;
      document.head.appendChild(st);
    }

    // ---------------- estrutura ----------------
    function ancestralComum(a, b) {
      if (!a || !b) return null;
      let n = a;
      while (n && !n.contains(b)) n = n.parentElement;
      return n;
    }
    function subirAteCard(el, proibidos) {
      if (!el) return null;
      const card = el.closest(".card, .dash-card, .chart-card, .panel, .matriz-card, section");
      if (!card) return el;
      const invade = proibidos.some(function (id) {
        const p = document.getElementById(id);
        return p && card.contains(p);
      });
      return invade ? el : card;
    }

    function card(id, icone, titulo, extra) {
      return '<div class="pex-card" id="' + id + '">' +
        '<div class="pex-head"><i class="bi ' + icone + '"></i><span>' + titulo + '</span></div>' +
        '<div class="pex-body">' + (extra || "") + '</div></div>';
    }

    let pexTopo = null, pexMeio = null;

    function pexMontarEstrutura() {
      if (pexTopo && document.body.contains(pexTopo)) return true;
      // remove restos da versao 1, se houver
      ["pexTopoDash", "pexMeioDash"].forEach(function (id) {
        const el = document.getElementById(id); if (el) el.remove();
      });
      pexEstilos();

      const outros = ["chartTopRiscos", "chartTopResidual", "chartDivisoes", "chartOpcoes", "chartNivel"];

      const k1 = document.getElementById("kpiTotalRiscos");
      const k4 = document.getElementById("kpiEmAtraso");
      let linhaKpis = ancestralComum(k1, k4);
      if (linhaKpis && (linhaKpis.contains(document.getElementById("matrizDashboard")) ||
          outros.some(function (id) { const p = document.getElementById(id); return p && linhaKpis.contains(p); }))) {
        linhaKpis = null;
      }

      const m1 = document.getElementById("matrizDashboard");
      const m2 = document.getElementById("resumoMatrizDashboard");
      let cardMatriz = m2 ? ancestralComum(m1, m2) : m1;
      cardMatriz = subirAteCard(cardMatriz, outros.concat(["kpiTotalRiscos"]));
      if (!cardMatriz) return false;

      pexTopo = document.createElement("div");
      pexTopo.id = "pexTopoDash";
      pexTopo.className = "pex-wrap";
      pexTopo.innerHTML =
        '<div class="pex-linha pex-l1">' +
          card("pexInfo", "bi-building", "Informações Gerais") +
          card("pexIndic", "bi-bar-chart-line-fill", "Indicadores de Risco") +
        '</div>';

      pexMeio = document.createElement("div");
      pexMeio.id = "pexMeioDash";
      pexMeio.className = "pex-wrap";
      pexMeio.innerHTML =
        '<div class="pex-linha pex-l2">' +
          card("pexMatriz", "bi-grid-3x3-gap-fill", "Matriz de Risco Final (após tratamento)") +
          card("pexDestaques", "bi-star-fill", "Principais Processos em Destaque") +
        '</div>' +
        '<div class="pex-linha pex-l3">' +
          card("pexGauge", "bi-speedometer2", "Nível Médio de Risco") +
          card("pexUnidades", "bi-diagram-3-fill", "Média de Risco por Unidade",
               '<div class="pex-chart"><canvas id="pexChartUnidades"></canvas></div>') +
          card("pexDistrib", "bi-bar-chart-steps", "Distribuição por Faixa de Risco",
               '<div class="pex-chart"><canvas id="pexChartDistrib"></canvas></div>') +
        '</div>';

      if (linhaKpis && linhaKpis.parentNode) {
        linhaKpis.parentNode.insertBefore(pexTopo, linhaKpis);
        linhaKpis.style.display = "none";
      } else {
        cardMatriz.parentNode.insertBefore(pexTopo, cardMatriz);
        ["kpiTotalRiscos", "kpiPlanos", "kpiConcluidos", "kpiEmAtraso"].forEach(function (id) {
          const el = document.getElementById(id);
          const c = el && (el.closest("[class*='kpi-card'], .kpi, .card") || el.parentElement);
          if (c) c.style.display = "none";
        });
      }
      cardMatriz.parentNode.insertBefore(pexMeio, cardMatriz);
      cardMatriz.style.display = "none";
      pexLigarCliques(pexTopo);
      pexLigarCliques(pexMeio);
      return true;
    }

    // ---------------- cliques = filtro cruzado ----------------
    // Qualquer elemento com data-pex-filtro / data-pex-proc filtra o dashboard inteiro.
    function pexLigarCliques(raiz) {
      if (!raiz || raiz.__pexClique) return;
      raiz.__pexClique = true;
      raiz.addEventListener("click", function (e) {
        const el = e.target.closest("[data-pex-filtro], [data-pex-proc], [data-pex-limpar]");
        if (!el || !raiz.contains(el)) return;
        e.preventDefault();
        if (el.hasAttribute("data-pex-limpar")) {
          const ch = el.getAttribute("data-pex-limpar");
          filtrosInterativos[ch] = null;
          renderizarBarraFiltrosAtivos();
          atualizarTudo(true);
          return;
        }
        if (el.hasAttribute("data-pex-proc")) {
          filtrarSomenteProcessoDashboard(el.getAttribute("data-pex-proc"));
          return;
        }
        const chave = el.getAttribute("data-pex-filtro");
        let valor = el.getAttribute("data-pex-valor");
        if (el.getAttribute("data-pex-num") === "1") valor = Number(valor);
        alternarFiltro(chave, valor);
      });
    }

    function attrFiltro(chave, valor, numero) {
      return ' data-pex-filtro="' + chave + '" data-pex-valor="' + esc(String(valor)) + '"' +
        (numero ? ' data-pex-num="1"' : '');
    }

    function processoUnico() {
      return processosSelecionadosDashboard.size === 1 ? Array.from(processosSelecionadosDashboard)[0] : null;
    }

    function corpo(id) {
      const c = document.getElementById(id);
      return c ? c.querySelector(".pex-body") : null;
    }

    // ---------------- KPIs antigos (tooltip) ----------------
    function pexKpisPlanos(dados) {
      const r = { total: 0, planos: 0, concluidos: 0, atraso: 0 };
      const lista = (dados && dados.todosRiscos) || [];
      r.total = lista.length;
      const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
      lista.forEach(function (risco) {
        if (!riscoTratadoDash(risco)) return;
        r.planos++;
        const etapas = obterEtapasDash(risco);
        if (!etapas.length) return;
        if (!etapas.some(function (et) { return et.opcao && et.descricao; })) return;
        const et = etapas[etapas.length - 1];
        let atraso = false;
        if (et && !et.concluido && et.prazo && et.opcao) {
          const dp = new Date(String(et.prazo).slice(0, 10) + "T00:00:00");
          if (dp < hoje) atraso = true;
        }
        if (atraso) r.atraso++; else r.concluidos++;
      });
      return r;
    }

    function htmlTip(v) {
      function lin(ico, cor, rot, val) {
        return '<div class="pex-tip-lin">' +
          '<i class="bi ' + ico + '" style="color:' + cor + ';background:' + cor + '22;"></i>' +
          '<span class="pex-tip-rot">' + rot + '</span>' +
          '<span class="pex-tip-val" style="color:' + cor + ';">' + val + '</span></div>';
      }
      return '<div class="pex-tip"><div class="pex-tip-tit">PLANOS DE TRATAMENTO</div>' +
        lin("bi-stack", "#4dd0e1", "Total de Riscos", v.total) +
        lin("bi-clipboard-check", "#f5c94a", "Planos de Tratamento", v.planos) +
        lin("bi-check-circle", "#3ad48a", "Planos Concluídos", v.concluidos) +
        lin("bi-alarm", "#e05a5a", "Planos em Atraso", v.atraso) + '</div>';
    }

    function miniKpi(o) {
      return '<div class="pex-kpi' + (o.tip ? " tem-tip" : "") + (o.attrs ? " pex-click" : "") +
        (o.sel ? " pex-sel" : "") + '" style="--pex-cor:' + o.cor + ';"' + (o.attrs || "") +
        (o.title ? ' title="' + esc(o.title) + '"' : "") + '>' +
        '<div class="pex-kpi-ico"><i class="bi ' + o.ico + '"></i></div>' +
        '<div style="min-width:0;">' +
          '<div class="pex-kpi-val" style="' + (o.corVal ? "color:" + o.corVal + ";" : "") + '">' + o.val + '</div>' +
          '<div class="pex-kpi-tit">' + o.tit + '</div>' +
          '<div class="pex-kpi-sub">' + esc(o.sub || "") + '</div>' +
        '</div>' +
        (o.tip ? '<i class="bi bi-info-circle-fill pex-kpi-info"></i>' + o.tip : "") +
      '</div>';
    }

    // ---------------- blocos ----------------
    function renderInfo(k) {
      const b = corpo("pexInfo"); if (!b) return;
      b.innerHTML = '<div class="pex-kpis k3">' +
        miniKpi({ ico: "bi-building", cor: "#4dd0e1", val: k.divisoes.length,
          tit: "Unidades administrativas", sub: rexJuntar(k.siglas) }) +
        miniKpi({ ico: "bi-gear-fill", cor: "#7a5cff", val: k.processos.length,
          tit: "Processos de trabalho", sub: "mapeados nas unidades" }) +
        miniKpi({ ico: "bi-file-earmark-text-fill", cor: "#e88c3a", val: k.riscos.length,
          tit: "Riscos identificados",
          sub: "em " + k.processos.length + " processo" + (k.processos.length === 1 ? "" : "s") + " de trabalho" }) +
      '</div>';
    }

    function renderIndic(k, tip) {
      const b = corpo("pexIndic"); if (!b) return;
      const pct = Math.round(k.variacao), reduziu = k.variacao <= 0;
      const corF = PEX_COR[relFaixa(k.mediaFinal)];
      b.innerHTML = '<div class="pex-kpis k5">' +
        miniKpi({ ico: "bi-bar-chart-fill", cor: "#4dd0e1", val: rexF1(k.mediaInerente),
          tit: "Média do risco inerente", sub: "antes dos controles" }) +
        miniKpi({ ico: "bi-bar-chart-fill", cor: PEX_COR[relFaixa(k.mediaResidual)], val: rexF1(k.mediaResidual),
          tit: "Média do risco residual", sub: rexFaixaNome(k.mediaResidual) }) +
        miniKpi({ ico: reduziu ? "bi-arrow-down" : "bi-arrow-up", cor: reduziu ? "#3ad48a" : "#e05a5a",
          corVal: reduziu ? "#3ad48a" : "#e05a5a",
          val: (pct > 0 ? "+" : pct < 0 ? "−" : "") + Math.abs(pct) + "%",
          tit: reduziu ? "Redução pelos controles" : "Aumento após controles", sub: "do inerente para o residual" }) +
        miniKpi({ ico: "bi-clipboard-check", cor: "#f5c94a", val: k.comPlano.length,
          tit: "Riscos com plano de tratamento", sub: k.codigosPlano || "nenhum plano cadastrado",
          tip: htmlTip(tip),
          attrs: attrFiltro("comPlano", "Com plano de tratamento"),
          sel: !!filtrosInterativos.comPlano,
          title: "Clique para filtrar somente os riscos com plano de tratamento" }) +
        miniKpi({ ico: "bi-check-circle-fill", cor: corF, val: rexF1(k.mediaFinal),
          tit: "Média de risco final",
            sub: k.riscosFinais.length
              ? k.riscosFinais.length + " risco(s) tratado(s) - " + rexFaixaNome(k.mediaFinal).replace(/ \(.*\)/, "")
              : "nenhum risco tratado" }) +
      '</div>';
    }

    function renderMatriz(k) {
      const b = corpo("pexMatriz"); if (!b) return;
      const porNivel = {}, riscosNivel = {};
      k.riscos.forEach(function (r) {
        const n = rexNivelMatriz(r);
        porNivel[n] = (porNivel[n] || 0) + 1;
        (riscosNivel[n] = riscosNivel[n] || []).push(r);
      });
      const maxQ = Math.max.apply(null, Object.values(porNivel).concat([1]));
      const PROB = ["Raro", "Pouco Provável", "Provável", "Muito Provável", "Praticamente Certo"];
      const IMP = ["Muito Alto", "Alto", "Médio", "Baixo", "Muito Baixo"];
      const sel = filtrosInterativos.matrizNivel;

      const vis = visaoRiscoDash();
      let h = '<div class="pex-sub">' + (
        vis === "inerente" ? 'Visão do risco <b>inerente</b> dos ' + k.riscos.length + ' riscos.' :
        vis === "residual" ? 'Visão do risco <b>residual</b> dos ' + k.riscos.length + ' riscos.' :
        vis === "final"    ? 'Somente os ' + k.riscos.length + ' riscos tratados, pelo risco <b>final</b>.' :
        'Visão geral dos ' + k.riscos.length + ' riscos: risco final nos ' + k.riscosFinais.length +
          ' tratados e risco residual nos demais.') +
        ' O tamanho do círculo indica a quantidade.</div>';
      h += '<div class="pex-mtz"><div class="pex-mtz-eixoY"><span>IMPACTO ▲</span></div>';
      for (let row = 0; row < 5; row++) {
        const imp = 5 - row;
        h += '<div class="pex-mtz-rot" style="grid-column:2;grid-row:' + (row + 1) + ';">' + IMP[row] + '</div>';
        for (let col = 0; col < 5; col++) {
          const nivel = MATRIZ_TJPR[(col + 1) + "-" + imp];
          const f = relFaixa(nivel), q = porNivel[nivel] || 0;
          const tam = q ? Math.round(22 + 26 * Math.sqrt(q / maxQ)) : 0;
          const lista = (riscosNivel[nivel] || []).map(function (r) { return rexCodigo(r); });
          const dica = "Nível " + nivel + " — " + q + " risco(s)" +
            (lista.length ? "\n" + lista.slice(0, 12).join("\n") + (lista.length > 12 ? "\n..." : "") : "") +
            (q ? "\nClique para filtrar" : "");
          const glow = f === "baixo" ? "rgba(58,212,138,.65)" : f === "medio" ? "rgba(245,201,74,.65)" : "rgba(224,90,90,.65)";
          const classes = "pex-cel" + (q ? " pex-tem" : "") + (q || sel === nivel ? " pex-click" : "") +
            (sel === nivel ? " pex-sel" : "") + (sel !== null && sel !== nivel ? " pex-apagada" : "");
          h += '<div class="' + classes + '"' + (q || sel === nivel ? attrFiltro("matrizNivel", nivel, true) : "") +
               ' style="grid-column:' + (col + 3) + ';grid-row:' + (row + 1) + ';' +
               (q ? '--pex-glow:' + glow + ';' : '') +
               'background:' + PEX_COR[f] + (q ? "" : "8c") + ';" title="' + esc(dica) + '">' +
               '<span class="pex-cel-n">' + nivel + '</span>' +
               (q ? '<div class="pex-bolha" style="width:' + tam + 'px;height:' + tam + 'px;font-size:' +
                    Math.max(12, Math.round(tam * .42)) + 'px;background:' +
                    (f === "baixo" ? "#1f9d63" : f === "medio" ? "#d39e00" : "#c0392b") + ';">' + q + '</div>' : '') +
               '</div>';
        }
      }
      PROB.forEach(function (p, i) {
        h += '<div class="pex-mtz-rot" style="grid-column:' + (i + 3) + ';grid-row:6;font-size:11px;">' + p + '</div>';
      });
      h += '</div>';
      h += '<div class="pex-mtz-eixoX"><div></div><span>PROBABILIDADE</span><div></div><span>▶</span></div>';
      h += '<div class="pex-leg">' +
        ['baixo', 'medio', 'alto'].map(function (f) {
          const faixa = f === "baixo" ? "1–6" : f === "medio" ? "7–19" : "20–25";
          const ativo = filtrosInterativos.faixaNivel &&
            PEX_NOME[f].toLowerCase() === String(filtrosInterativos.faixaNivel).toLowerCase();
          return '<span class="pex-click' + (ativo ? " pex-sel" : "") + '" style="border-radius:10px;padding:2px 6px;"' +
            attrFiltro("faixaNivel", PEX_NOME[f]) + ' title="Filtrar risco final ' + PEX_NOME[f] + '">' +
            '<b style="background:' + PEX_COR[f] + ';"></b>' + PEX_NOME[f] + ' (' + faixa + '): ' +
            k.dist.matriz[f] + '</span>';
        }).join("") + '</div>';

      // Lista dos riscos da celula selecionada
      if (sel !== null) {
        const riscosSel = (riscosNivel[sel] || []).slice().sort(function (a, c) {
          return c._visao - a._visao || String(a._rotulo).localeCompare(String(c._rotulo), "pt-BR", { numeric: true });
        });
        h += '<div class="pex-lista"><div class="pex-lista-tit"><span><i class="bi bi-funnel-fill"></i> Riscos no nível ' +
          sel + ' (' + riscosSel.length + ')</span>' +
          '<button type="button" data-pex-limpar="matrizNivel"><i class="bi bi-x"></i> Limpar nível</button></div>' +
          '<div class="pex-lista-box">' +
          (riscosSel.length ? riscosSel.map(function (r) {
            const f = relFaixa(r._visao);
            return '<div class="pex-lista-it">' +
              '<span class="pex-lista-cod">' + esc(rexCodigo(r)) + '</span>' +
              '<span class="pex-lista-ev">' + esc(r.evento || "Risco sem descrição") +
                '<small>' + esc(r._nomeProcesso || "") + '</small></span>' +
              '<span class="pex-lista-niv" style="background:' + PEX_COR[f] + ';">' + rexF1(r._visao) + '</span>' +
            '</div>';
          }).join("") : '<div class="pex-dica">Nenhum risco neste nível com os filtros atuais.</div>') +
          '</div></div>';
      } else {
        h += '<div class="pex-dica"><i class="bi bi-hand-index-thumb"></i>Clique em um nível da matriz para filtrar todo o dashboard e ver os riscos dele.</div>';
      }
      b.innerHTML = h;
    }

    function cartaoDestaque(rotulo, ext, maior, tipo) {
      const cor = maior ? "#e05a5a" : "#3ad48a";
      if (!ext) {
        return '<div class="pex-dc" style="--pex-cor:' + cor + ';"><div class="pex-dc-rot">' + rotulo +
          '</div><div class="pex-dc-desc">Sem dados</div></div>';
      }
      const it = ext.item;
      const pos = Math.max(0, Math.min(25, it.media)) / 25 * 100;
      let attrs = "", ativo = false;
      if (tipo === "processo" && it.id !== undefined) {
        attrs = ' data-pex-proc="' + esc(String(it.id)) + '" title="Clique para filtrar somente este processo"';
        ativo = processoUnico() === String(it.id);
      } else if (tipo === "unidade") {
        attrs = attrFiltro("divisao", it.sigla) + ' title="Clique para filtrar somente esta unidade"';
        ativo = filtrosInterativos.divisao === it.sigla;
      }
      return '<div class="pex-dc' + (attrs ? " pex-click" : "") + (ativo ? " pex-sel" : "") +
        '" style="--pex-cor:' + cor + ';"' + attrs + '>' +
        '<div class="pex-dc-top">' +
          '<div><div class="pex-dc-rot"><i class="bi ' + (maior ? "bi-exclamation-triangle-fill" : "bi-caret-down-fill") +
            '"></i> ' + rotulo + '</div>' +
          '<div class="pex-dc-cod">' + esc(it.codigo) + '</div></div>' +
          '<div class="pex-dc-media"><strong>' + rexF1(it.media) + '</strong><small>média de risco</small></div>' +
        '</div>' +
        '<div class="pex-dc-nome">' + esc(it.nome) + '</div>' +
        '<div class="pex-dc-desc">' + esc(rexDescricao(ext, maior)) + '</div>' +
        '<div class="pex-escala"><i style="left:' + pos + '%;"></i></div>' +
        '<div class="pex-escala-n"><span>0</span><span>7</span><span>20</span><span>25</span></div>' +
      '</div>';
    }

    function renderDestaques(k) {
      const b = corpo("pexDestaques"); if (!b) return;
      b.innerHTML = '<div class="pex-sub">Média de risco = risco final nos riscos tratados + risco residual nos demais.</div>' +
        '<div class="pex-dest">' +
        cartaoDestaque("PROCESSO - MAIOR RISCO", rexExtremo(k.processos, true), true, "processo") +
        cartaoDestaque("PROCESSO - MENOR RISCO", rexExtremo(k.processos, false), false, "processo") +
        cartaoDestaque("UNIDADE - MAIOR RISCO", rexExtremo(k.unidades, true), true, "unidade") +
        cartaoDestaque("UNIDADE - MENOR RISCO", rexExtremo(k.unidades, false), false, "unidade") +
      '</div>';
    }

    // ---------------- VELOCIMETRO INTERATIVO ----------------
    // - O ponteiro passeia a cada 5 s por Inerente -> Residual -> Final, parando
    //   exatamente no numero do quadro, e destaca a faixa onde o valor cai.
    // - Clique em Inerente / Residual / Final (legenda, quadros ou marcadores) para
    //   ir direto a ele; o passeio continua a partir dali. Mouse em cima pausa.
    // - O numero central conta gradualmente acompanhando o ponteiro.
    const PEX_G = { cx: 150, cy: 150, R: 105, E: 24, MAX: 25, DUR: 1800 };
    const PEX_G_FAIXAS = [
      { id: "baixo", ini: 0, fim: 7 },
      { id: "medio", ini: 7, fim: 20 },
      { id: "alto",  ini: 20, fim: 25 }
    ];
    const PEX_G_ROT = { inerente: "Inerente", residual: "Residual", final: "Final" };
    const PEX_G_COR_MARCA = { inerente: "#9fb7c1", residual: "#4dd0e1" };
    const pexGaugeEstado = {
      sel: "final", ordem: [], timer: null, pausado: false, vals: null,
      atual: 0, raf: null, travado: false
    };
    window.__pexGaugeEstado = pexGaugeEstado;

    function pexGaugeGraus(v) {
      return 180 * Math.max(0, Math.min(PEX_G.MAX, Number(v) || 0)) / PEX_G.MAX;
    }

    /** Conta o numero central do valor atual ate o alvo, junto com o ponteiro. */
    function pexGaugeContar(alvo) {
      const num = document.getElementById("pexGaugeNumero");
      if (!num) return;
      if (pexGaugeEstado.raf) cancelAnimationFrame(pexGaugeEstado.raf);
      const de = pexGaugeEstado.atual, ini = performance.now();
      function passo(agora) {
        const t = Math.min(1, (agora - ini) / PEX_G.DUR);
        // mesma curva do ponteiro (ease-in-out)
        const e = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        const v = de + (alvo - de) * e;
        pexGaugeEstado.atual = v;
        num.textContent = rexF1(v);
        num.setAttribute("fill", PEX_COR[relFaixa(v)]);
        if (t < 1) pexGaugeEstado.raf = requestAnimationFrame(passo);
        else { pexGaugeEstado.raf = null; pexGaugeEstado.atual = alvo; num.textContent = rexF1(alvo); }
      }
      pexGaugeEstado.raf = requestAnimationFrame(passo);
    }

    /** Vai ate o valor do quadro selecionado. */
    function pexGaugeIr(qual) {
      const v = Number((pexGaugeEstado.vals || {})[qual]) || 0;
      const faixa = relFaixa(v);
      pexGaugeEstado.sel = qual;

      const ponteiro = document.getElementById("pexGaugePonteiro");
      if (ponteiro) ponteiro.style.transform = "rotate(" + pexGaugeGraus(v) + "deg)";

      PEX_G_FAIXAS.forEach(function (f) {
        const arc = document.getElementById("pexGaugeArco_" + f.id);
        if (!arc) return;
        const ativo = f.id === faixa;
        arc.style.opacity = ativo ? "1" : ".28";
        arc.style.filter = ativo ? "drop-shadow(0 0 7px " + PEX_COR[f.id] + ")" : "none";
      });

      document.querySelectorAll("#pexGauge [data-pex-gsel]").forEach(function (el) {
        el.classList.toggle("pex-g-ativo", el.getAttribute("data-pex-gsel") === qual);
      });
      document.querySelectorAll("#pexGauge .pex-g-marca-grupo").forEach(function (g) {
        g.classList.toggle("pex-g-marca-on", g.getAttribute("data-pex-gsel") === qual);
      });

      const rot = document.getElementById("pexGaugeRotulo");
      if (rot) {
        rot.innerHTML = '<span style="color:' + PEX_COR[faixa] + ';">●</span> Risco ' +
          PEX_G_ROT[qual].toLowerCase() + ' · faixa ' + PEX_NOME[faixa] +
          ' (' + (faixa === "baixo" ? "1–6" : faixa === "medio" ? "7–19" : "20–25") + ')';
      }
      pexGaugeContar(v);
    }

    function pexGaugeIniciarPasseio() {
      if (pexGaugeEstado.timer) clearInterval(pexGaugeEstado.timer);
      pexGaugeEstado.timer = setInterval(function () {
        if (!document.getElementById("pexGaugePonteiro")) {
          clearInterval(pexGaugeEstado.timer); pexGaugeEstado.timer = null; return;
        }
        if (pexGaugeEstado.pausado || filtrosInterativos.visao) return;   // filtro ativo: ponteiro fica parado
        const ord = pexGaugeEstado.ordem;
        if (ord.length < 2) return;
        const i = ord.indexOf(pexGaugeEstado.sel);
        pexGaugeIr(ord[(i + 1) % ord.length]);
      }, 5000);
    }

    function pexGaugeSelecionar(qual) {
      if (!PEX_G_ROT[qual]) return;
      // Clique = filtra todo o painel pela visao escolhida (clicar de novo remove)
      const nome = PEX_G_ROT[qual];
      pexGaugeEstado.sel = qual;
      alternarFiltro("visao", nome);
    }
    window.pexGaugeSelecionar = pexGaugeSelecionar;

    function renderGauge(k) {
      const b = corpo("pexGauge"); if (!b) return;
      const C = coresGraficoTema();
      const cx = PEX_G.cx, cy = PEX_G.cy, R = PEX_G.R, E = PEX_G.E, MAX = PEX_G.MAX;
      const nFinais = (k.riscosFinais || []).length;
      pexGaugeEstado.vals = { inerente: k.mediaInerente, residual: k.mediaResidual, final: k.mediaFinal };
      pexGaugeEstado.ordem = nFinais ? ["inerente", "residual", "final"] : ["inerente", "residual"];
      if (visaoRiscoDash()) pexGaugeEstado.sel = visaoRiscoDash();
      if (pexGaugeEstado.ordem.indexOf(pexGaugeEstado.sel) < 0) pexGaugeEstado.sel = "residual";

      function pt(v, r) {
        const a = Math.PI + Math.PI * Math.max(0, Math.min(MAX, v)) / MAX;
        return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
      }
      function arco(f) {
        const p1 = pt(f.ini + (f.ini ? .1 : 0), R), p2 = pt(f.fim - (f.fim < MAX ? .1 : 0), R);
        return '<path id="pexGaugeArco_' + f.id + '" class="pex-g-arco" d="M' + p1[0] + ' ' + p1[1] +
          ' A' + R + ' ' + R + ' 0 0 1 ' + p2[0] + ' ' + p2[1] +
          '" stroke="' + PEX_COR[f.id] + '" stroke-width="' + E + '" fill="none" opacity=".28"/>';
      }
      function corMarca(q) {
        return q === "final" ? PEX_COR[relFaixa(k.mediaFinal)] : PEX_G_COR_MARCA[q];
      }

      // Marcadores: circulo com o NUMERO dentro, sobre o arco.
      // Valores muito proximos sao afastados para fora/dentro para nao se sobreporem.
      const marcas = pexGaugeEstado.ordem.map(function (q) {
        return { q: q, v: pexGaugeEstado.vals[q] };
      }).sort(function (a, b) { return a.v - b.v; });
      const raiosMarca = [R, R, R];
      for (let i = 1; i < marcas.length; i++) {
        if (Math.abs(marcas[i].v - marcas[i - 1].v) < 1.6) {
          raiosMarca[i] = raiosMarca[i - 1] === R ? R - 30 : R;
        }
      }
      let marcasSvg = "";
      marcas.forEach(function (m, i) {
        const p = pt(m.v, raiosMarca[i]);
        const cor = corMarca(m.q);
        marcasSvg += '<g class="pex-g-marca-grupo" data-pex-gsel="' + m.q + '">' +
          '<title>' + PEX_G_ROT[m.q] + ' ' + rexF1(m.v) + ' (clique para selecionar)</title>' +
          '<circle class="pex-g-marca" cx="' + p[0] + '" cy="' + p[1] + '" r="14" fill="' + cor +
            '" stroke="#ffffff" stroke-width="2"/>' +
          '<text x="' + p[0] + '" y="' + (p[1] + 3.6) + '" text-anchor="middle" font-size="10" font-weight="800" ' +
            'fill="' + (m.q === "inerente" || relFaixa(m.v) === "medio" && m.q === "final" ? "#13283a" : "#0b2230") +
            '" pointer-events="none">' + rexF1(m.v) + '</text></g>';
      });

      let svg = '<svg viewBox="0 -12 300 222" style="overflow:visible;">' + PEX_G_FAIXAS.map(arco).join("");
      [0, 7, 20, 25].forEach(function (v) {
        const p = pt(v, R + E / 2 + 12);
        svg += '<text x="' + p[0] + '" y="' + (p[1] + 4) + '" text-anchor="middle" font-size="11" font-weight="700" fill="' +
          C.texto + '" opacity=".75">' + v + '</text>';
      });
      // Ponteiro desenhado apontando para 0 (esquerda) e girado via CSS
      const L = R - E / 2 - 8;
      svg += '<g id="pexGaugePonteiro" class="pex-g-ponteiro" style="transform:rotate(0deg);">' +
          '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx - L) + '" y2="' + cy +
          '" stroke="' + C.texto + '" stroke-width="5" stroke-linecap="round"/></g>' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="10" fill="' + C.texto + '"/>' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="4" fill="#4dd0e1"/>' +
        marcasSvg +
        '<text id="pexGaugeNumero" x="' + cx + '" y="' + (cy + 40) + '" text-anchor="middle" font-size="28" font-weight="800" fill="' +
          C.tituloChart + '">' + rexF1(pexGaugeEstado.atual) + '</text></svg>';

      const ordemTodos = ["inerente", "residual", "final"];
      const vals = ordemTodos.map(function (q) { return pexGaugeEstado.vals[q]; });
      const cores = ["#9fb7c1", "#4dd0e1", PEX_COR[relFaixa(k.mediaFinal)]];
      let evo = '<div class="pex-evo">';
      ordemTodos.forEach(function (q, i) {
        const semDado = q === "final" && !nFinais;
        if (i > 0) {
          const d = vals[i - 1] ? (vals[i] - vals[i - 1]) / vals[i - 1] * 100 : 0;
          const cor = d <= 0 ? "#3ad48a" : "#e05a5a";
          evo += '<div class="pex-evo-s" style="color:' + cor + ';"><i class="bi bi-caret-right-fill"></i><br>' +
            (semDado ? "—" : (d > 0 ? "+" : d < 0 ? "−" : "") + Math.abs(Math.round(d)) + '%') + '</div>';
        }
        evo += '<div class="pex-evo-c pex-g-btn"' + (semDado ? '' : ' data-pex-gsel="' + q + '"') +
          ' style="--pex-cor:' + cores[i] + ';" title="' +
          (semDado ? 'Nenhum risco tratado no filtro atual' : 'Clique para mostrar no velocímetro') + '">' +
          '<small>' + PEX_G_ROT[q].toUpperCase() + '</small><strong>' + (semDado ? "—" : rexF1(vals[i])) + '</strong>' +
          (q === "final" ? '<small style="font-size:9px;letter-spacing:0;">' + nFinais + ' tratado(s)</small>' : '') +
          '</div>';
      });
      evo += '</div>';

      function itemLeg(q, cor, txt) {
        return '<span class="pex-g-btn" data-pex-gsel="' + q + '"><b style="background:' + cor + ';"></b>' + txt + '</span>';
      }
      b.innerHTML = '<div class="pex-sub">Média geral dos ' + k.riscos.length + ' riscos (escala 0 a 25) · ' +
          'final considera só os ' + nFinais + ' risco(s) tratado(s)</div>' +
        '<div class="pex-g-leg">' +
          itemLeg("inerente", "#9fb7c1", "Inerente " + rexF1(k.mediaInerente)) +
          itemLeg("residual", "#4dd0e1", "Residual " + rexF1(k.mediaResidual)) +
          (nFinais ? itemLeg("final", corMarca("final"), "Final " + rexF1(k.mediaFinal)) : "") +
        '</div>' +
        '<div class="pex-gauge" id="pexGaugeBox">' + svg + '</div>' +
        '<div class="pex-g-rotulo" id="pexGaugeRotulo"></div>' + evo +
        '<div class="pex-dica"><i class="bi bi-hand-index-thumb"></i>' +
          (visaoRiscoDash()
            ? 'Painel filtrado pelo risco <b>' + filtrosInterativos.visao.toLowerCase() + '</b>. Clique de novo para voltar.'
            : 'Clique em Inerente, Residual ou Final para filtrar todo o painel.') + '</div>';

      if (!b.__pexGaugeClique) {
        b.__pexGaugeClique = true;
        b.addEventListener("click", function (e) {
          const el = e.target.closest && e.target.closest("[data-pex-gsel]");
          if (!el || !b.contains(el)) return;
          e.preventDefault(); e.stopPropagation();
          pexGaugeSelecionar(el.getAttribute("data-pex-gsel"));
        });
        b.addEventListener("mouseenter", function () { pexGaugeEstado.pausado = true; });
        b.addEventListener("mouseleave", function () { pexGaugeEstado.pausado = false; });
      }

      // Ponteiro parte da posicao atual do numero e anima ate o quadro selecionado
      const pont = document.getElementById("pexGaugePonteiro");
      if (pont) {
        pont.style.transition = "none";
        pont.style.transform = "rotate(" + pexGaugeGraus(pexGaugeEstado.atual) + "deg)";
        void pont.getBoundingClientRect();
        pont.style.transition = "";
      }
      requestAnimationFrame(function () { pexGaugeIr(pexGaugeEstado.sel); });
      pexGaugeIniciarPasseio();
    }

    function renderUnidades(k) {
      const ctx = document.getElementById("pexChartUnidades"); if (!ctx) return;
      const C = coresGraficoTema();
      const itens = k.unidades.slice().sort(function (a, b) {
        return b.media - a.media || b.riscos.length - a.riscos.length;
      });
      const media = k.mediaRisco;
      destruirChart("pexUnidades");
      chartsAtivos.pexUnidades = new Chart(ctx, {
        type: "bar",
        data: {
          labels: itens.map(function (u) { return u.sigla; }),
          datasets: [{
            label: "Média de risco",
            data: itens.map(function (u) { return Number(u.media.toFixed(1)); }),
            backgroundColor: itens.map(function (u) { return PEX_COR[relFaixa(u.media)]; }),
            borderRadius: 6
          }]
        },
        options: {
          indexAxis: "y",
          layout: { padding: { right: 70 } },
          plugins: {
            legend: { display: false },
            tooltip: tooltipPadrao({
              callbacks: {
                title: function (it) { return NOMES_DIVISOES_DASH[it[0].label] || it[0].label; },
                label: function (it) {
                  const u = itens[it.dataIndex];
                  return " Média " + rexF1(u.media) + " · " + u.riscos.length + " risco(s)";
                }
              }
            })
          },
          scales: {
            x: eixoPadrao({ zero: true, titulo: "Média de Risco" }),
            y: eixoPadrao({ semGrid: true })
          },
          onClick: function (evt, els) {
            if (!els || !els.length) return;
            alternarFiltro("divisao", itens[els[0].index].sigla);
          },
          onHover: function (evt, els) {
            evt.native.target.style.cursor = els.length ? "pointer" : "default";
          }
        },
        plugins: [{
          id: "pexRotulosMedia",
          afterDatasetsDraw: function (chart) {
            const c = chart.ctx, meta = chart.getDatasetMeta(0), xs = chart.scales.x, a = chart.chartArea;
            c.save();
            c.font = "600 11.5px 'Segoe UI', sans-serif"; c.fillStyle = C.texto; c.textBaseline = "middle";
            meta.data.forEach(function (bar, i) {
              const u = itens[i];
              c.fillText(rexF1(u.media) + " (" + u.riscos.length + ")", bar.x + 6, bar.y);
            });
            const mx = xs.getPixelForValue(media);
            c.setLineDash([5, 4]); c.strokeStyle = C.tituloEixo; c.lineWidth = 1.5;
            c.beginPath(); c.moveTo(mx, a.top); c.lineTo(mx, a.bottom); c.stroke();
            c.setLineDash([]);
            c.fillStyle = C.tituloEixo; c.font = "700 11px 'Segoe UI', sans-serif"; c.textAlign = "center";
            c.fillText("média " + rexF1(media), mx, a.top - 6);
            c.restore();
          }
        }]
      });
    }

    function renderDistrib(k) {
      const ctx = document.getElementById("pexChartDistrib"); if (!ctx) return;
      const linhas = [k.dist.inerente, k.dist.residual, k.dist.final];
      destruirChart("pexDistrib");
      chartsAtivos.pexDistrib = new Chart(ctx, {
        type: "bar",
        data: {
          labels: ["Inerente", "Residual", "Final"],
          datasets: ["baixo", "medio", "alto"].map(function (f) {
            return {
              label: PEX_NOME[f],
              data: linhas.map(function (l) { return l[f]; }),
              backgroundColor: PEX_COR[f],
              borderRadius: 4,
              barPercentage: .6
            };
          })
        },
        options: {
          indexAxis: "y",
          plugins: {
            legend: legendaPadrao("bottom"),
            tooltip: tooltipPadrao({
              callbacks: { label: function (it) { return " " + it.dataset.label + ": " + it.raw + " risco(s)"; } }
            })
          },
          scales: {
            x: Object.assign(eixoPadrao({ zero: true, precisao: true, titulo: "Quantidade de Riscos" }), { stacked: true }),
            y: Object.assign(eixoPadrao({ semGrid: true }), { stacked: true })
          },
          onClick: function (evt, els) {
            if (!els || !els.length) return;
            const etapa = ["faixaInerente", "faixaResidual", "faixaNivel"][els[0].index];
            alternarFiltro(etapa, chartsAtivos.pexDistrib.data.datasets[els[0].datasetIndex].label);
          },
          onHover: function (evt, els) {
            evt.native.target.style.cursor = els.length ? "pointer" : "default";
          }
        },
        plugins: [{
          id: "pexRotulosDist",
          afterDatasetsDraw: function (chart) {
            const c = chart.ctx;
            c.save();
            c.font = "800 12.5px 'Segoe UI', sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
            chart.data.datasets.forEach(function (ds, di) {
              chart.getDatasetMeta(di).data.forEach(function (bar, i) {
                const v = ds.data[i];
                if (!v || Math.abs(bar.x - bar.base) < 20) return;
                c.fillStyle = di === 1 ? "#2f2600" : "#ffffff";
                c.fillText(String(v), (bar.x + bar.base) / 2, bar.y);
              });
            });
            c.restore();
          }
        }]
      });
    }

    // ---------------- render principal ----------------
    function pexAjustarTitulosVisao() {
      const v = visaoRiscoDash();
      const tit = {
        inerente: "Matriz de Risco Inerente (antes dos controles)",
        residual: "Matriz de Risco Residual (após controles)",
        final:    "Matriz de Risco Final (somente riscos tratados)"
      }[v] || "Matriz de Risco Final (após tratamento)";
      const sp = document.querySelector("#pexMatriz .pex-head span");
      if (sp) sp.textContent = tit;
      const un = document.querySelector("#pexUnidades .pex-head span");
      if (un) un.textContent = v ? "Média de Risco " + filtrosInterativos.visao + " por Unidade" : "Média de Risco por Unidade";
    }

    function renderizarPainelExecutivoDash() {
      if (!pexMontarEstrutura()) return;
      try {
        pexAjustarTitulosVisao();
        const k = rexCalcular(montarDadosRelatorioExecutivo());
        const tip = pexKpisPlanos(window._dadosDashboardAtual);
        renderInfo(k);
        renderIndic(k, tip);
        renderMatriz(k);
        renderDestaques(k);
        renderGauge(k);
        renderUnidades(k);
        renderDistrib(k);
      } catch (e) {
        console.error("[Painel Executivo]", e);
      }
    }

    window.renderizarPainelExecutivoDash = renderizarPainelExecutivoDash;
    console.log("[Dashboard] Painel Executivo v2 ativo (estilo do dashboard).");
  })();

// ============================================================
// EXPORTS / UTILITARIOS
// ============================================================
window.exportarRelatorioExecutivoPDF = exportarRelatorioExecutivoPDF;
window.montarDadosRelatorioExecutivo = montarDadosRelatorioExecutivo;
window.renderizarMatrizRiscosDashboard = function () { renderizarPainelExecutivoDash(); };

window.__pipelineDashboard = {
  atualizarTudo: atualizarTudo,
  agregar: agregar,
  aplicarFiltrosInterativos: aplicarFiltrosInterativos,
  filtrarDadosPorMesAno: filtrarDadosPorMesAno,
  filtrarDadosPorProcesso: filtrarDadosPorProcesso,
  adicionarDataReferencia: adicionarDataReferencia,
  sincronizarProcessosDisponiveis: sincronizarProcessosDisponiveis,
  alternarProcessoDashboard: alternarProcessoDashboard,
  selecionarTodosProcessosDashboard: selecionarTodosProcessosDashboard
};

window.alternarProcessoDashboard        = alternarProcessoDashboard;
window.limparTodosFiltrosDashboard      = limparTodosFiltrosDashboard;
window.selecionarTodosProcessosDashboard = selecionarTodosProcessosDashboard;
window.abrirPlanoEmAtrasoDash = abrirPlanoEmAtrasoDash;
window.irParaPlanosEmAtrasoDash = irParaPlanosEmAtrasoDash;
window.dashProcessosSelecionados = function () { return Array.from(processosSelecionadosDashboard); };
window.dashProcessosDisponiveis = function () { return processosDisponiveisDashboard.slice(); };

console.log("[Dashboard] Relatório Executivo consolidado disponível.");
console.log("[Dashboard] Filtro por Processo ativo.");
