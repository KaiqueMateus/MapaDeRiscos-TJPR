// ============================================================
//  MAPA / TJPR - Dashboard Executivo v2
//  Correcoes de layout + Streak Banner
// ============================================================

console.log("[Dashboard] Script v2 carregado");

// ============ FILTROS INTERATIVOS TIPO POWER BI ============

const filtrosInterativos = {
  matrizNivel: null,       // Ex: 25, 20, 15... (nível da célula da matriz)
  faixaNivel: null,        // Ex: "Alto", "Médio", "Baixo"
  opcao: null,             // Ex: "Mitigar", "Evitar"...
  divisao: null,           // Ex: "AT", "DC"...
  responsavel: null        // Nome do responsável
};

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
  filtrosInterativos.opcao = null;
  filtrosInterativos.divisao = null;
  filtrosInterativos.responsavel = null;

  // 🎯 Força re-render de tudo
  renderizarBarraFiltrosAtivos();
  atualizarTudo();
}

function alternarFiltro(chave, valor) {
  if (filtrosInterativos[chave] === valor) {
    filtrosInterativos[chave] = null;
  } else {
    filtrosInterativos[chave] = valor;
  }
  renderizarBarraFiltrosAtivos();  // 🎯 força redesenhar chips
  atualizarTudo();
}

function aplicarFiltrosInterativos(dados) {
  if (!dados || !dados.todosRiscos) return dados;

  let riscos = dados.todosRiscos.slice();

  // Filtro por divisão
  if (filtrosInterativos.divisao) {
    riscos = riscos.filter(function(r) {
      return r._divisao === filtrosInterativos.divisao;
    });
  }

  // Filtro por faixa (Baixo/Médio/Alto) baseado no nível FINAL
  if (filtrosInterativos.faixaNivel) {
    riscos = riscos.filter(function(r) {
      const n = obterNivelFinalDashboard(r);
      const cls = classeMatrizDash(n);
      return cls.faixa === filtrosInterativos.faixaNivel.toLowerCase();
    });
  }

  // Filtro por nível específico da matriz TJPR
  if (filtrosInterativos.matrizNivel !== null) {
    riscos = riscos.filter(function(r) {
      const nivelFinal = obterNivelFinalDashboard(r);
      const pos = encontrarCelulaTJPR(nivelFinal);
      const nivelCel = MATRIZ_TJPR[pos.prob + "-" + pos.imp];
      return nivelCel === filtrosInterativos.matrizNivel;
    });
  }

  // Filtro por opção de tratamento
  if (filtrosInterativos.opcao) {
    riscos = riscos.filter(function(r) {
      const etapas = obterEtapasDash(r);
      if (etapas.length === 0) return false;
      const trat = etapas[etapas.length - 1];
      return trat.opcao === filtrosInterativos.opcao;
    });
  }

  // Filtro por responsável
  if (filtrosInterativos.responsavel) {
    riscos = riscos.filter(function(r) {
      const etapas = obterEtapasDash(r);
      if (etapas.length === 0) return false;
      const trat = etapas[etapas.length - 1];
      const nome = normalizarNomeResponsavel(trat.responsavel || "");
      return nome === filtrosInterativos.responsavel;
    });
  }

  // Retorna o objeto com riscos filtrados
  const procIds = new Set(riscos.map(function(r) { return String(r.processoId); }));
  const processos = dados.todosProcessos.filter(function(p) {
    return procIds.has(String(p.id));
  });

  return {
    todosRiscos: riscos,
    todosProcessos: processos
  };
}

const NOMES_DIVISOES_DASH = {
  "DA":"Divisao Administrativa","DC":"Divisao de Calculos",
  "DPP":"Divisao de Pagamento de Precatorios","CJ":"Consultoria Juridica",
  "AA":"Assessoria de Atendimento","AT":"Assessoria Tecnica",
  "DCGA":"Divisao de Controle e Gestao de Aportes"
};

let chartsAtivos = {};

// ============ AGREGA DADOS ============
async function agregar() {
  // 🎯 Agora busca do Supabase (multi-máquina, dados centralizados!)
  if (window.sb && typeof sbCarregarDadosDashboard === "function") {
    return await sbCarregarDadosDashboard();
  }

  // Fallback: se Supabase não estiver disponível, usa localStorage antigo
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
    popularFiltroAno();
    setarMesAtual();

    // Filtro por divisões
    renderizarFiltroMultiDivisao(function() {
      atualizarTudo();
    });

    // 🎯 NOVO FILTRO GLOBAL DE MÊS/ANO
    inicializarFiltroMesAnoDashboard();

    await atualizarTudo();

    setInterval(atualizarTudo, 30000);

  }, 300);

  // ===================================================
  // REDIRECIONAMENTO DO DASHBOARD PARA TRATAMENTO
  // ===================================================

  const procParaAbrir =
    sessionStorage.getItem("abrir_processo_tratamento");

  const riscoParaAbrir =
    sessionStorage.getItem("abrir_risco_tratamento");

  const filtroDiv =
    sessionStorage.getItem("filtro_divisao_tratamento");

  if (procParaAbrir && riscoParaAbrir) {

    sessionStorage.removeItem("abrir_processo_tratamento");
    sessionStorage.removeItem("abrir_risco_tratamento");
    sessionStorage.removeItem("filtro_divisao_tratamento");

    if (
      filtroDiv &&
      typeof usuarioEhGestorTrat === "function" &&
      usuarioEhGestorTrat()
    ) {

      user.divisao = filtroDiv;

      carregarProcessos();
      carregarRiscos();
      popularDropdownTratamento();
    }

    const sel =
      document.getElementById("seletorProcesso");

    if (sel)
      sel.value = procParaAbrir;

    selecionarProcessoTratamento(procParaAbrir);

    setTimeout(function() {

      const card =
        document.querySelector(
          '.tratamento-card[data-risco-id="' +
          riscoParaAbrir +
          '"]'
        );

      if (card) {

        document
          .querySelectorAll(
            ".tratamento-card.expanded"
          )
          .forEach(function(c) {
            if (c !== card)
              c.classList.remove("expanded");
          });

        card.classList.add("expanded");

        setTimeout(function() {

          card.scrollIntoView({
            behavior: "smooth",
            block: "center"
          });

        }, 300);

        showToast(
          "Risco aberto do dashboard!",
          "success"
        );

        tocarSom("success");

      }

    }, 700);

  }

});

function configurarChartJs() {
  if (typeof Chart === "undefined") return;
  Chart.defaults.color = "#9fb7c1";
  Chart.defaults.borderColor = "rgba(255,255,255,0.05)";
  Chart.defaults.font.family = "'Segoe UI', Tahoma, sans-serif";
  Chart.defaults.responsive = true;
  Chart.defaults.maintainAspectRatio = false;
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

async function atualizarTudo() {

  console.log("[Dashboard] Atualizando dados...");

  let dados = await agregar();

  dados = adicionarDataReferencia(dados);
  dados = filtrarDadosPorMesAno(dados);
  
  dados = aplicarFiltrosInterativos(dados);

  window._dadosDashboardAtual = dados;

  renderizarBarraFiltrosAtivos();
  atualizarKPIs(dados);
  renderizarTermometro(dados);

  renderizarMatrizRiscosDashboard(dados);

  renderizarTopRiscos(dados);
  renderizarTopResidual(dados);
  renderizarPorDivisao(dados);
  renderizarOpcoes(dados);
  renderizarNivel(dados);
  renderizarVencendo7Dias(dados);
  renderizarResponsaveis(dados);
  renderizarEficiencia(dados);
  renderizarStreak(dados);
}

function atualizarKPIs(dados) {
  const total = dados.todosRiscos.length;
  let atrasos = 0, planos = 0, concluidos = 0;

  dados.todosRiscos.forEach(function(r) {
    const etapas = obterEtapasDash(r);
    if (etapas.length === 0) return;

    // 🎯 PLANOS: 1 por risco se qualquer etapa tem opção+descrição
    const temPlano = etapas.some(function(et) {
      return et.opcao && et.descricao;
    });
    if (!temPlano) return; // sem plano, não conta em nada

    planos++;

    // 🎯 Verifica se etapa atual está em atraso
    const etapaAtual = etapas[etapas.length - 1];
    let estaEmAtraso = false;

    if (etapaAtual && !etapaAtual.concluido && etapaAtual.prazo && etapaAtual.opcao) {
      const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
      const dp = new Date(etapaAtual.prazo + "T00:00:00");
      if (dp < hoje) estaEmAtraso = true;
    }

    // 🎯 CONCLUÍDOS: tem plano E não está em atraso
    // (agrupa concluídos + planejados que estão dentro do prazo)
    if (!estaEmAtraso) concluidos++;

    // 🎯 EM ATRASO: etapa atual não concluída com prazo vencido
    if (estaEmAtraso) atrasos++;
  });

  console.log("[KPIs] Total:", total, "Planos:", planos, "Concluidos:", concluidos, "Atraso:", atrasos);

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

function animarKpi(id, alvo) {
  const el = document.getElementById(id);
  if (!el) return;
  const atual = parseInt(el.textContent) || 0;
  const dur = 700;
  const inicio = performance.now();
  function step(agora) {
    const t = Math.min((agora - inicio) / dur, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(atual + (alvo - atual) * eased);
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ============ TIMELINE ============
function renderizarTimeline(dados) {
  const ctx = document.getElementById("chartTimeline");
  if (!ctx) return;
  if (!dados) dados = agregar();

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
      // 🎯 Percorre TODAS as etapas (não só a última)
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

  console.log("[Timeline] Mes:", mes + 1, "/", ano, "- Planejados:", planejados.reduce((a,b)=>a+b,0),
              "Concluidos:", concluidos.reduce((a,b)=>a+b,0),
              "Atrasados:", atrasados.reduce((a,b)=>a+b,0));

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
        legend: { position: "top", labels: { usePointStyle: true, padding: 15 } },
        tooltip: { backgroundColor: "rgba(15,45,55,0.95)", padding: 12 }
      },
      scales: {
        x: { grid: { color: "rgba(255,255,255,0.03)" },
             title: { display: true, text: "Dia do Mes", color: "#4dd0e1" } },
        y: { beginAtZero: true, grid: { color: "rgba(255,255,255,0.05)" },
             ticks: { precision: 0 } }
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
    contagem[chave] = { processo: p.processo || "?", divisao: p._divisao, total: 0 };
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
        tooltip: { backgroundColor: "rgba(15,45,55,0.95)" }
      },
      scales: {
        x: { beginAtZero: true, grid: { color: "rgba(255,255,255,0.05)" }, ticks: { precision: 0 } },
        y: { grid: { display: false } }
      },
      onClick: function(evt, elements) {
        if (!elements || elements.length === 0) return;
        const idx = elements[0].index;
        const label = chartsAtivos.topRiscos.data.labels[idx];
        // Extrai divisão do formato "Nome (DIV)"
        const match = label.match(/\(([^)]+)\)$/);
        if (match) alternarFiltro("divisao", match[1]);
      },
      onHover: function(evt, els) {
        evt.native.target.style.cursor = els.length ? "pointer" : "default";
      }
    }
  });
}

// ============ TOP 5 MAIOR RESIDUAL ============
function renderizarTopResidual(dados) {
  const ctx = document.getElementById("chartTopResidual");
  if (!ctx) return;

  const porProc = {};
  dados.todosProcessos.forEach(function(p) {
    porProc[p._divisao + "|" + p.id] = { processo: p.processo || "?", divisao: p._divisao, res: [] };
  });
  dados.todosRiscos.forEach(function(r) {
    const chave = r._divisao + "|" + r.processoId;
    if (porProc[chave]) {
      porProc[chave].res.push(r.prob * r.imp * (r.nivelControle || 1));
    }
  });
  const arr = Object.values(porProc).filter(function(x) { return x.res.length > 0; })
    .map(function(x) {
      const avg = x.res.reduce(function(a, b) { return a + b; }, 0) / x.res.length;
      return { processo: x.processo, divisao: x.divisao, media: avg };
    })
    .sort(function(a, b) { return b.media - a.media; }).slice(0, 5);

  destruirChart("topResidual");
  if (arr.length === 0) return;

  chartsAtivos.topResidual = new Chart(ctx, {
    type: "bar",
    data: {
      labels: arr.map(function(x) { return truncar(x.processo, 25) + " (" + x.divisao + ")"; }),
      datasets: [{
        label: "Residual Medio",
        data: arr.map(function(x) { return x.media.toFixed(2); }),
        backgroundColor: arr.map(function(x) {
          if (x.media >= 20) return "#c04040";
          if (x.media >= 15) return "#e05a5a";
          if (x.media >= 10) return "#e88c3a";
          if (x.media >= 5)  return "#f5c94a";
          return "#3ad48a";
        }),
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: "y",
      plugins: { legend: { display: false }, tooltip: { backgroundColor: "rgba(15,45,55,0.95)" } },
      scales: {
        x: { beginAtZero: true, grid: { color: "rgba(255,255,255,0.05)" } },
        y: { grid: { display: false } }
      },
onClick: function(evt, elements) {

if (!elements || elements.length === 0) return;

const idx = elements[0].index;

const label = chartsAtivos.topResidual.data.labels[idx];

const match = label.match(/\(([^)]+)\)$/);

if (match) alternarFiltro("divisao", match[1]);

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
        tooltip: {
          backgroundColor: "rgba(15,45,55,0.95)",
          callbacks: { title: function(items) { return NOMES_DIVISOES_DASH[items[0].label] || items[0].label; } }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, grid: { color: "rgba(255,255,255,0.05)" }, ticks: { precision: 0 } }
      },
      onClick: function(evt, elements) {
  if (!elements || elements.length === 0) return;
  const idx = elements[0].index;
  const label = chartsAtivos.divisao.data.labels[idx];
  alternarFiltro("divisao", label);
},

onHover: function(evt, elements) {

evt.native.target.style.cursor = elements.length ? "pointer" : "default";

}
    }
  });
}

// ============ OPCOES ============
function renderizarOpcoes(dados) {
  const ctx = document.getElementById("chartOpcoes");
  if (!ctx) return;

  const cont = { "Evitar": 0, "Transferir": 0, "Mitigar": 0, "Aceitar": 0 };

  dados.todosRiscos.forEach(function(r) {
    // 🎯 Pega a etapa MAIS RECENTE que tem opção definida
    // (mesmo se a atual estiver vazia por reabertura)
    const etapas = obterEtapasDash(r);
    let opcaoAtual = null;
    for (let i = etapas.length - 1; i >= 0; i--) {
      if (etapas[i].opcao) {
        opcaoAtual = etapas[i].opcao;
        break;
      }
    }
    if (opcaoAtual && cont.hasOwnProperty(opcaoAtual)) {
      cont[opcaoAtual]++;
    }
  });

  const total = cont.Evitar + cont.Transferir + cont.Mitigar + cont.Aceitar;
  console.log("[Opcoes] Total:", total, "→", cont);

  destruirChart("opcoes");

  // Se nenhum dado, mostra "vazio"
  if (total === 0) {
    const c = ctx.getContext("2d");
    c.clearRect(0, 0, ctx.width, ctx.height);
    c.fillStyle = "#9fb7c1";
    c.font = "14px sans-serif";
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
        backgroundColor: ["#e05a5a", "#7a5cff", "#4dd0e1", "#3ad48a"],
        borderColor: "#122c40",
        borderWidth: 3
      }]
    },
    options: {
      cutout: "60%",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom",
                  labels: { usePointStyle: true, padding: 10, font: { size: 11 } } },
        tooltip: { backgroundColor: "rgba(15,45,55,0.95)" }
      },
      onClick: function(evt, elements) {

if (!elements || elements.length === 0) return;

const idx = elements[0].index;

const label = chartsAtivos.opcoes.data.labels[idx];

alternarFiltro("opcao", label);

},

onHover: function(evt, elements) {

evt.native.target.style.cursor = elements.length ? "pointer" : "default";

}
    }
  });
}

// ============ NIVEL ============
function renderizarNivel(dados) {
  const ctx = document.getElementById("chartNivel");
  if (!ctx) return;
  let alto = 0, medio = 0, baixo = 0;
  dados.todosRiscos.forEach(function(r) {
    const n = r.prob * r.imp;
    if (n >= 20) alto++;
    else if (n >= 7) medio++;
    else baixo++;
  });

  destruirChart("nivel");
  chartsAtivos.nivel = new Chart(ctx, {
    type: "pie",
    data: {
      labels: ["Alto", "Medio", "Baixo"],
      datasets: [{
        data: [alto, medio, baixo],
        backgroundColor: ["#e05a5a", "#f5c94a", "#3ad48a"],
        borderColor: "#122c40", borderWidth: 3
      }]
    },
    options: {
      plugins: {
        legend: { position: "bottom", labels: { usePointStyle: true, padding: 10, font: { size: 11 } } },
        tooltip: { backgroundColor: "rgba(15,45,55,0.95)" }
      },
      onClick: function(evt, elements) {

if (!elements || elements.length === 0) return;

const idx = elements[0].index;

const label = chartsAtivos.nivel.data.labels[idx]; // "Alto", "Médio", "Baixo"

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
    // 🎯 Aceita mesmo se não estiver marcado Tratar=Sim (queremos ver TODOS)
    const etapas = obterEtapasDash(r);
    if (etapas.length === 0) return;

    // Pega a etapa atual (última) — só ela precisa vencer
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
        prazo: et.prazo,
        prioritario: r.prioritario === "Sim"
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
        '<div class="lista-title">' +
          (p.prioritario ? '⭐ ' : '') +
          esc(p.evento) +
        '</div>' +
        '<div class="lista-desc">' + p.divisao + ' • ' + formatarDataBR(p.prazo) + '</div>' +
      '</div>' +
      '<div class="lista-badge">' + label + '</div>' +
    '</div>';
  }).join("");
}

// Helper de formatação
function formatarDataBR(iso) {
  if (!iso) return "";
  const parts = iso.split("-");
  return parts[2] + "/" + parts[1] + "/" + parts[0];
}

// 🎯 Navega para tratamento com o risco selecionado
function irParaTratamentoDireto(divisao, processoId, riscoId) {
  // Salva no sessionStorage para o tratamento saber o que abrir
  sessionStorage.setItem("abrir_processo_tratamento", String(processoId));
  sessionStorage.setItem("abrir_risco_tratamento", String(riscoId));

  // Se for de outra divisão, precisa mudar a "divisão ativa" temporariamente
  const user = JSON.parse(sessionStorage.getItem("mapa_user") || "{}");
  if (String(user.divisao).toUpperCase() !== String(divisao).toUpperCase()) {
    sessionStorage.setItem("filtro_divisao_tratamento", divisao);
  }

  window.location.href = "tratamento.html";
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

  // 🎯 EMPTY STATE limpo
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

/**
 * Normaliza nome do responsável:
 * - Remove espaços extras
 * - Extrai só nome e sobrenome (primeiros 2 nomes válidos)
 * - Capitaliza primeira letra de cada
 * - Filtra nomes inválidos
 *
 * Ex: "  KAIQUE mateus DE souza  " → "Kaique Mateus"
 * Ex: "beatriz outi" → "Beatriz Outi"
 * Ex: "TESTE" → null (inválido)
 */
function normalizarNomeResponsavel(bruto) {
  if (!bruto) return null;

  // Remove espaços extras
  const limpo = String(bruto).trim().replace(/\s+/g, " ");
  if (limpo.length < 4) return null;

  // Bloqueia nomes inválidos comuns
  const inv = ["teste", "test", "asdf", "abc", "abcd", "xyz", "aaaa", "1234", "-", "n/a", "na"];
  if (inv.indexOf(limpo.toLowerCase()) >= 0) return null;

  // Separa em palavras válidas (mínimo 2 letras, ignora "de", "da", "do", etc)
  const preposicoes = ["de", "da", "do", "dos", "das", "e"];
  const partes = limpo.split(" ")
    .filter(function(p) {
      return p.length >= 2 && preposicoes.indexOf(p.toLowerCase()) < 0;
    });

  if (partes.length === 0) return null;

  // Pega os primeiros 2 nomes (nome + sobrenome)
  const doisPrimeiros = partes.slice(0, 2);

  // Capitaliza cada um
  const capitalizado = doisPrimeiros.map(function(p) {
    return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
  }).join(" ");

  return capitalizado;
}

// ============ EFICIENCIA ============
function renderizarEficiencia(dados) {
  let noPrazo = 0, total = 0, atrasados = 0;

  dados.todosRiscos.forEach(function(r) {

    // 🎯 Só conta riscos com Tratar = Sim
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
      // Só considera etapas CONCLUÍDAS
      if (!et.concluido || !et.concluidoEm) return;

      // 🎯 Sem prazo definido = não dá pra medir, ignora
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

  console.log("[Eficiência] Total:", total, "| No prazo:", noPrazo, "| Fora:", atrasados);

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
//  STREAK BANNER - "X DIAS SEM PENDENCIAS"
// ============================================================
function renderizarStreak(dados) {
  // 1. Se ja mostrou nesta sessao, ignora
  if (sessionStorage.getItem("streak_shown")) return;

  // 2. Conta atrasos atuais - se tiver algum, nao mostra
  let atrasos = 0;
  dados.todosRiscos.forEach(function(r) {
    if (calcularStatusTratamentoDash(r) === "atraso") atrasos++;
  });
  if (atrasos > 0) return;

  // 3. Calcula dias sem pendencias
  const streak = calcularStreakDias(dados);
  if (streak < 1) return;   // sem historico, nao mostra

  // 4. Mostra o banner
  criarStreakBanner(streak);
  sessionStorage.setItem("streak_shown", "1");
}

function calcularStreakDias(dados) {
  // Encontra a data mais recente em que algum risco esteve em atraso
  // Se nunca houve atraso, usa a data do primeiro risco criado
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  let ultimoEventoAtraso = null;

  dados.todosRiscos.forEach(function(r) {
    const trat = r.tratamento || {};
    if (!trat.prazo) return;
    const dp = new Date(trat.prazo + "T00:00:00");
    // Se o prazo passou (foi vencido em algum momento) mas depois foi concluido
    if (dp < hoje && trat.concluido && trat.concluidoEm) {
      const dc = new Date(trat.concluidoEm);
      dc.setHours(0, 0, 0, 0);
      // O "atraso" durou do prazo ate a conclusao (ou hoje se ainda nao concluiu)
      // Pegamos a data mais recente entre concluidoEm e prazo
      const dataResolucao = dc > dp ? dc : dp;
      if (!ultimoEventoAtraso || dataResolucao > ultimoEventoAtraso) {
        ultimoEventoAtraso = dataResolucao;
      }
    }
  });

  // Se nunca teve atraso, conta desde o primeiro risco
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
  // Remove banner existente se houver
  const antigo = document.querySelector(".streak-banner");
  if (antigo) antigo.remove();

  // Escolhe emoji baseado nos dias
  let emoji = "🎉", texto = "sem riscos pendentes!";
  if (dias >= 30)      { emoji = "🏆"; texto = "sem riscos pendentes - RECORDE!"; }
  else if (dias >= 14) { emoji = "🌟"; texto = "sem riscos pendentes - excelente!"; }
  else if (dias >= 7)  { emoji = "🎊"; texto = "sem riscos pendentes - continue assim!"; }
  else if (dias >= 3)  { emoji = "✨"; texto = "sem riscos pendentes!"; }
  else if (dias === 0) { emoji = "✅"; texto = "sem riscos pendentes hoje!"; }

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

  // Auto-fecha em 15s
  setTimeout(function() {
    fecharStreak();
  }, 15000);
}

function fecharStreak() {
  const banner = document.querySelector(".streak-banner");
  if (!banner || banner.classList.contains("exiting")) return;
  banner.classList.add("exiting");
  setTimeout(function() {
    if (banner) banner.remove();
  }, 700);
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
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
// ============ TERMÔMETRO DE EXPOSIÇÃO GLOBAL ============
function calcularExposicaoGlobal(dados) {
  if (dados.todosRiscos.length === 0) {
    return { percent: 0, label: "SEM DADOS", classe: "expo-baixa" };
  }

  // Soma dos residuais / máximo possível (25 por risco)
  const soma = dados.todosRiscos.reduce(function(acc, r) {
    const nivel = r.prob * r.imp;
    const residual = nivel * (r.nivelControle || 1);
    return acc + residual;
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
  pointer.style.left = exp.percent + "%";
  pct.textContent = exp.percent.toFixed(0) + "%";
  label.textContent = exp.label;
  badge.className = "termometro-badge " + exp.classe;
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

console.log("=== ANÁLISE DE CADA RISCO ===");
const dados = agregar();

let contA = 0, contB = 0, contC = 0, contD = 0;



console.log("\n=== TESTE DAS FÓRMULAS ===");
console.log("Fórmula A (etapa atual concluída):        " + contA);
console.log("Fórmula B (alguma etapa concluída):       " + contB);
console.log("Fórmula C (tem plano e não em atraso):    " + contC);
console.log("---");
console.log("Você quer que aparece: 5 concluídos");
console.log("Qual fórmula bateu 5?");

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
    const cmpId = mapa[kpiId];
    const el = document.getElementById(cmpId);
    if (!el) return;

    const valorAtual = atual[kpiId] || 0;
    if (!anterior) {
      el.innerHTML = '<i class="bi bi-dot"></i> Primeira medição';
      el.className = "kpi-comparativo equal";
      return;
    }

    const valorAnt = anterior[kpiId] || 0;
    const diff = valorAtual - valorAnt;

    // Para "Em Atraso": subir é ruim (vermelho), descer é bom (verde)
    // Para "Concluídos": subir é bom, descer é ruim
    // Padrão: informativo neutro
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

  // Salva snapshot atual (com timestamp pra 1 vez por dia)
  const hoje = new Date().toISOString().substring(0, 10);
  const salvo = anterior && anterior._data === hoje;
  if (!salvo) {
    const snap = Object.assign({}, atual, { _data: hoje });
    localStorage.setItem(chaveSnap, JSON.stringify(snap));
  }
}

function toggleApresentacao() {
  const body = document.body;

  if (body.classList.contains("modo-apresentacao")) {
    // Sai
    body.classList.remove("modo-apresentacao");
    if (document.fullscreenElement) document.exitFullscreen();
    const btnSair = document.getElementById("btnSairPres");
    if (btnSair) btnSair.remove();
  } else {
    // Entra
    body.classList.add("modo-apresentacao");
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    }
    // Botão pra sair
    const btn = document.createElement("button");
    btn.id = "btnSairPres";
    btn.className = "btn-sair-pres";
    btn.innerHTML = '<i class="bi bi-x-lg"></i> Sair do Modo Apresentação';
    btn.onclick = toggleApresentacao;
    document.body.appendChild(btn);

    showToast("🎯 Modo Apresentação ativado", "success");
    tocarSom("success");
  }
}

// Atalho ESC pra sair
document.addEventListener("keydown", function(e) {
  if (e.key === "Escape" && document.body.classList.contains("modo-apresentacao")) {
    toggleApresentacao();
  }
});

// ============ HELPER: Obter etapas de tratamento ============
function obterEtapasDash(risco) {
  // Formato novo: histórico
  if (risco.tratamento && Array.isArray(risco.tratamento.historico)) {
    return risco.tratamento.historico;
  }
  // Formato antigo: objeto único
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

    // yyyy-mm-dd
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      return new Date(str.substring(0, 10) + "T00:00:00");
    }

    // ISO datetime
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

function obterDataFiltroItem(tipo, item, processosPorId) {
  if (tipo === "processo") {
    // Se é processo, usa a data do próprio processo
    if (item.processo || item.objetivo || item.equipe) {
      return parseDataSegura(item.data || item.dataRegistro || item.criadoEm || item.criado_em);
    }

    // Se é risco, busca processo relacionado
    const proc = processosPorId ? processosPorId[String(item.processoId)] : null;
    return proc ? parseDataSegura(proc.data || proc.dataRegistro || proc.criadoEm || proc.criado_em) : null;
  }

  if (tipo === "tratamento") {
    const etapa = obterUltimaEtapaDash(item);
    if (!etapa) return null;

    return parseDataSegura(
      etapa.criadoEm ||
      etapa.criado_em ||
      etapa.concluidoEm ||
      etapa.concluido_em ||
      etapa.prazo
    );
  }

  // Default: criação do risco
  return parseDataSegura(
    item.criadoEm ||
    item.criado_em ||
    item.dataCriacao ||
    item.data ||
    item.created_at
  );
}

function dentroDoPeriodo(data) {
  if (!data) return false;

  const mes = document.getElementById("filtroMes") ? document.getElementById("filtroMes").value : "";
  const dtIni = document.getElementById("filtroDataIni") ? document.getElementById("filtroDataIni").value : "";
  const dtFim = document.getElementById("filtroDataFim") ? document.getElementById("filtroDataFim").value : "";

  const dataLimpa = new Date(data);
  dataLimpa.setHours(0, 0, 0, 0);

  if (mes) {
    const mesData = dataLimpa.getMonth() + 1;
    if (mesData !== Number(mes)) return false;
  }

  if (dtIni) {
    const ini = new Date(dtIni + "T00:00:00");
    if (dataLimpa < ini) return false;
  }

  if (dtFim) {
    const fim = new Date(dtFim + "T23:59:59");
    if (dataLimpa > fim) return false;
  }

  return true;
}

function filtrosPeriodoAtivos() {
  const mes = document.getElementById("filtroMes") ? document.getElementById("filtroMes").value : "";
  const dtIni = document.getElementById("filtroDataIni") ? document.getElementById("filtroDataIni").value : "";
  const dtFim = document.getElementById("filtroDataFim") ? document.getElementById("filtroDataFim").value : "";
  return !!(mes || dtIni || dtFim);
}


function setPeriodoRapido(tipo) {
  const hoje = new Date();
  const ini = document.getElementById("filtroDataIni");
  const fim = document.getElementById("filtroDataFim");
  const mes = document.getElementById("filtroMes");

  if (!ini || !fim || !mes) return;

  mes.value = "";

  function toISO(d) {
    return d.toISOString().substring(0, 10);
  }

  if (tipo === "mes_atual") {
    const primeiro = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    ini.value = toISO(primeiro);
    fim.value = toISO(ultimo);
  }

  if (tipo === "30") {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    ini.value = toISO(d);
    fim.value = toISO(hoje);
  }

  if (tipo === "90") {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    ini.value = toISO(d);
    fim.value = toISO(hoje);
  }

  if (tipo === "ano") {
    const primeiro = new Date(hoje.getFullYear(), 0, 1);
    const ultimo = new Date(hoje.getFullYear(), 11, 31);
    ini.value = toISO(primeiro);
    fim.value = toISO(ultimo);
  }

  atualizarResumoPeriodo();
  atualizarTudo();
}

function filtrarPorMesAno(lista){

    const mesEl =
document.getElementById("filtroMes");

const mes =
mesEl ? mesEl.value : "";

    const anoEl =
document.getElementById("filtroAno");

const ano =
anoEl ? anoEl.value : "";

    return lista.filter(function(r){

        if (!r.dataReferencia)
            return false;

        const d = r.dataReferencia;

        const mesOk =
            !mes ||
            d.getMonth()+1 === Number(mes);

        const anoOk =
            !ano ||
            d.getFullYear() === Number(ano);

        return mesOk && anoOk;

    });

  }

  // ============ FILTRO GLOBAL DE MÊS/ANO ============

const MESES_DASHBOARD = [
  { id: 1, nome: "Jan" },
  { id: 2, nome: "Fev" },
  { id: 3, nome: "Mar" },
  { id: 4, nome: "Abr" },
  { id: 5, nome: "Mai" },
  { id: 6, nome: "Jun" },
  { id: 7, nome: "Jul" },
  { id: 8, nome: "Ago" },
  { id: 9, nome: "Set" },
  { id: 10, nome: "Out" },
  { id: 11, nome: "Nov" },
  { id: 12, nome: "Dez" }
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
      atualizarTudo();
    };

    cont.appendChild(chip);
  });

  if (anoSelect) {
    popularAnosFiltroGlobal();
    anoSelect.addEventListener("change", function() {
      atualizarResumoMesAno();
      atualizarTudo();
    });
  }

  atualizarResumoMesAno();
}

function popularAnosFiltroGlobal() {

  const anoSelect =
    document.getElementById("filtroAnoGlobal");

  if (!anoSelect) return;

  const anoAtual =
    new Date().getFullYear();

  let html =
    '<option value="">Todos</option>';

  for (
    let a = 2026;
    a <= anoAtual + 1;
    a++
  ) {

    html +=
      '<option value="' + a + '"' +
      (a === anoAtual ? " selected" : "") +
      '>' +
      a +
      '</option>';
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
  atualizarTudo();
}

function atualizarResumoMesAno() {
  const el = document.getElementById("periodoResumo");
  if (!el) return;

  const ano = document.getElementById("filtroAnoGlobal")
    ? document.getElementById("filtroAnoGlobal").value
    : "";

  const meses = Array.from(mesesSelecionadosDashboard).sort(function(a, b) {
    return a - b;
  });

  const nomes = meses.map(function(id) {
    const m = MESES_DASHBOARD.find(function(x) { return x.id === id; });
    return m ? m.nome : id;
  });

  if (meses.length === 0 && !ano) {
    el.innerHTML = 'Período: <strong>Todos</strong>';
    return;
  }

  const partes = [];

  if (meses.length > 0) {
    partes.push("Meses: <strong>" + nomes.join(", ") + "</strong>");
  } else {
    partes.push("Meses: <strong>Todos</strong>");
  }

  if (ano) {
    partes.push("Ano: <strong>" + ano + "</strong>");
  } else {
    partes.push("Ano: <strong>Todos</strong>");
  }

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
  // 1. Prioridade: última etapa de tratamento
  const etapas = obterEtapasDash(risco);

  if (etapas && etapas.length > 0) {
    const ultima = etapas[etapas.length - 1];

    const dataTrat = parseDataDashboard(
      ultima.criadoEm ||
      ultima.criado_em ||
      ultima.concluidoEm ||
      ultima.concluido_em ||
      ultima.prazo
    );

    if (dataTrat) return dataTrat;
  }

  // 2. Criação do risco
  const dataRisco = parseDataDashboard(
    risco.criadoEm ||
    risco.criado_em ||
    risco.dataCriacao ||
    risco.created_at
  );

  if (dataRisco) return dataRisco;

  // 3. Data do processo
  const proc = processosPorId[String(risco.processoId)];

  if (proc) {
    const dataProc = parseDataDashboard(
      proc.data ||
      proc.dataRegistro ||
      proc.data_registro ||
      proc.criadoEm ||
      proc.criado_em
    );

    if (dataProc) return dataProc;
  }

  return null;
}

function adicionarDataReferencia(dados) {
  const processos = dados.todosProcessos || [];
  const riscos = dados.todosRiscos || [];

  const processosPorId = {};

  processos.forEach(function(p) {
    processosPorId[String(p.id)] = p;
  });

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

  // Se não tem filtro, mantém tudo
  if (meses.length === 0 && !ano) {
    return dados;
  }

  const riscosOriginais = dados.todosRiscos || [];
  const processosOriginais = dados.todosProcessos || [];

  const riscosFiltrados = riscosOriginais.filter(function(r) {
    if (!r.dataReferencia) return false;

    const mesRisco = r.dataReferencia.getMonth() + 1;
    const anoRisco = r.dataReferencia.getFullYear();

    if (meses.length > 0 && meses.indexOf(mesRisco) < 0) {
      return false;
    }

    if (ano && anoRisco !== ano) {
      return false;
    }

    return true;
  });

  const procIds = new Set(
    riscosFiltrados.map(function(r) {
      return String(r.processoId);
    })
  );

  const processosFiltrados = processosOriginais.filter(function(p) {
    return procIds.has(String(p.id));
  });

  return {
    todosProcessos: processosFiltrados,
    todosRiscos: riscosFiltrados
  };
}

// ============ MATRIZ DE RISCOS NO DASHBOARD ============

function classeMatrizPorNivelDash(nivel) {
  const n = Math.ceil(Number(nivel) || 0);

  if (n >= 20) {
    return {
      faixa: "alto",
      label: "Alto",
      classeCell: "matriz-alto",
      classeBadge: "matriz-detalhe-alto"
    };
  }

  if (n >= 7) {
    return {
      faixa: "medio",
      label: "Médio",
      classeCell: "matriz-medio",
      classeBadge: "matriz-detalhe-medio"
    };
  }

  return {
    faixa: "baixo",
    label: "Baixo",
    classeCell: "matriz-baixo",
    classeBadge: "matriz-detalhe-baixo"
  };
}

function obterNumeroRiscoDash(risco, lista) {
  if (typeof obterNumeroRisco === "function") {
    return obterNumeroRisco(risco.id);
  }

  const ordenados = lista
    .slice()
    .sort(function(a, b) {
      return Number(a.id) - Number(b.id);
    });

  const idx = ordenados.findIndex(function(x) {
    return String(x.id) === String(risco.id);
  });

  return "R" + String(idx + 1).padStart(2, "0");
}

function agruparRiscosPorMatriz(dados) {
  const grupos = {};

  for (let prob = 1; prob <= 5; prob++) {
    for (let imp = 1; imp <= 5; imp++) {
      grupos[prob + "-" + imp] = [];
    }
  }

  const riscos = dados.todosRiscos || [];

  riscos.forEach(function(r) {
    const prob = Math.max(1, Math.min(5, Number(r.prob) || 1));
    const imp = Math.max(1, Math.min(5, Number(r.imp) || 1));
    const chave = prob + "-" + imp;

    grupos[chave].push(r);
  });

  return grupos;
}

function renderizarMatrizRiscosDashboard(dados) {
  const cont = document.getElementById("matrizDashboard");
  const resumoCont = document.getElementById("resumoMatrizDashboard");
  if (!cont) return;

  const riscos = dados.todosRiscos || [];

  // ==================== AGRUPA POR CÉLULA ====================
  const grupos = {};
  for (let p = 1; p <= 5; p++) {
    for (let i = 1; i <= 5; i++) grupos[p + "-" + i] = [];
  }

  let totalBaixo = 0, totalMedio = 0, totalAlto = 0;

  riscos.forEach(function(r) {
    const nivelFinal = obterNivelFinalDashboard(r);
    const pos = encontrarCelulaTJPR(nivelFinal);
    const chave = pos.prob + "-" + pos.imp;
    if (grupos[chave]) grupos[chave].push(r);

    const cls = classeMatrizDash(MATRIZ_TJPR[chave]);
    if (cls.faixa === "alto") totalAlto++;
    else if (cls.faixa === "medio") totalMedio++;
    else totalBaixo++;
  });

  // ==================== 🏆 TOP 3 (PÓDIO) ====================
  const quantidadesUnicas = [];
  for (const chave in grupos) {
    const q = grupos[chave].length;
    if (q > 0 && quantidadesUnicas.indexOf(q) === -1) {
      quantidadesUnicas.push(q);
    }
  }
  quantidadesUnicas.sort(function(a, b) { return b - a; });

  const qtdOuro   = quantidadesUnicas[0] || 0;
  const qtdPrata  = quantidadesUnicas[1] || 0;
  const qtdBronze = quantidadesUnicas[2] || 0;

  function corGlow(faixa) {
    if (faixa === "alto")  return "192,64,64";
    if (faixa === "medio") return "212,160,23";
    return "46,184,122";
  }

  // ==================== HTML ====================
  let html = '';

  // 🔵 WRAPPER FLEX: eixo Y | grid matriz
  html += '<div style="display:flex;align-items:stretch;gap:12px;">';

  // ==================== EIXO Y (IMPACTO) ====================
  html +=
    '<div style="display:flex;flex-direction:column;align-items:center;' +
                'justify-content:center;padding:20px 0 60px;flex-shrink:0;width:30px;">' +
      '<span style="color:#0e9aa7;font-size:14px;margin-bottom:6px;">▲</span>' +

      // Linha superior
      '<div style="width:2px;background:#0e9aa7;flex:1;"></div>' +

      // Label IMPACTO no meio (sem background)
      '<span style="writing-mode:vertical-rl;transform:rotate(180deg);' +
                   'padding:8px 0;white-space:nowrap;' +
                   'font-weight:700;color:#0e9aa7;letter-spacing:2px;font-size:11px;">' +
        'IMPACTO' +
      '</span>' +

      // Linha inferior
      '<div style="width:2px;background:#0e9aa7;flex:1;"></div>' +
    '</div>';

  // ==================== GRID DA MATRIZ ====================
  html += '<div style="flex:1;">';
  html += '<div class="matriz-grid-dash" style="display:grid;' +
          'grid-template-columns:130px repeat(5, 1fr);' +
          'grid-template-rows:repeat(5, 80px) 45px;gap:8px;">';

  // Linhas de células
  IMPACTOS_MATRIZ_DASH.forEach(function(imp, rowIdx) {
    const row = rowIdx + 1;

    // Label do Impacto (coluna 1)
    html +=
      '<div style="grid-column:1;grid-row:' + row + ';' +
                  'display:flex;align-items:center;justify-content:center;' +
                  'background:#f5f8fa;border:1px solid #d4dde3;border-radius:8px;' +
                  'font-weight:600;color:#1a2b3d;font-size:13px;text-align:center;padding:6px;">' +
        imp.label +
      '</div>';

    // Células (colunas 2 a 6)
    PROBABILIDADES_MATRIZ_DASH.forEach(function(prob, colIdx) {
      const col = colIdx + 2;
      const chave = prob.p + "-" + imp.i;
      const nivelCel = MATRIZ_TJPR[chave];
      const lista = grupos[chave] || [];
      const qtd = lista.length;
      const cls = classeMatrizDash(nivelCel);
      const temRisco = qtd > 0;
      const glow = corGlow(cls.faixa);

      // 🏆 Identifica se essa célula está no pódio
      let medalha = null;
      if (temRisco) {
        if (qtd === qtdOuro && qtdOuro > 0)          medalha = "ouro";
        else if (qtd === qtdPrata && qtdPrata > 0)   medalha = "prata";
        else if (qtd === qtdBronze && qtdBronze > 0) medalha = "bronze";
      }

      // 🎨 Sombra, elevação e borda condicionais
      let sombraCel = "";
      let elevacao = "translateY(0)";
      let bordaCel = "border:1px solid rgba(0,0,0,0.05);";

      if (medalha === "ouro") {
        sombraCel = "box-shadow:0 15px 40px rgba(0,0,0,0.25)," +
                                "0 0 35px rgba(255,193,7,0.85)," +
                                "0 0 60px rgba(255,193,7,0.5);";
        elevacao = "translateY(-8px) scale(1.04)";
        bordaCel = "border:3px solid rgba(255,215,0,0.9);";
      }
      else if (medalha === "prata") {
        sombraCel = "box-shadow:0 12px 30px rgba(0,0,0,0.22)," +
                                "0 0 28px rgba(192,192,192,0.8)," +
                                "0 0 50px rgba(192,192,192,0.4);";
        elevacao = "translateY(-6px) scale(1.02)";
        bordaCel = "border:3px solid rgba(220,220,220,0.9);";
      }
      else if (medalha === "bronze") {
        sombraCel = "box-shadow:0 10px 25px rgba(0,0,0,0.2)," +
                                "0 0 22px rgba(205,127,50,0.8)," +
                                "0 0 40px rgba(205,127,50,0.4);";
        elevacao = "translateY(-5px) scale(1.01)";
        bordaCel = "border:3px solid rgba(205,127,50,0.9);";
      }
      else if (temRisco) {
        // Com risco mas fora do pódio
        sombraCel = "box-shadow:0 6px 18px rgba(0,0,0,0.15), 0 0 15px rgba(" + glow + ",0.45);";
        elevacao = "translateY(-2px)";
        bordaCel = "border:2px solid rgba(255,255,255,0.4);";
      }

      // Filtros interativos (mantém sua lógica original)
      let classesExtras = cls.classe;
      if (filtrosInterativos.matrizNivel !== null) {
        classesExtras += (filtrosInterativos.matrizNivel === nivelCel)
          ? " cell-destacada" : " cell-atenuada";
      } else if (filtrosInterativos.faixaNivel) {
        if (filtrosInterativos.faixaNivel.toLowerCase() !== cls.faixa.toLowerCase()) {
          classesExtras += " cell-atenuada";
        }
      }

      // Estilo final
      const estilo =
        "grid-column:" + col + ";grid-row:" + row + ";" +
        "position:relative;border-radius:10px;cursor:pointer;" +
        "display:flex;align-items:center;justify-content:center;" +
        "transition:all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);overflow:visible;" +
       (temRisco

? "opacity:1;transform:" + elevacao + ";" + bordaCel + sombraCel

: "opacity:1;" +

"filter: saturate(0.65) brightness(0.95);" +

"transform:none;" +

"border:1px solid rgba(0,0,0,0.08);" +

"box-shadow:none;");

      // Badge de medalha
      const badgeMedalha = medalha
        ? '<div style="position:absolute;top:-8px;right:-8px;z-index:5;' +
                      'width:28px;height:28px;border-radius:50%;' +
                      'display:flex;align-items:center;justify-content:center;font-size:14px;' +
                      'background:' + (medalha === "ouro"  ? "linear-gradient(135deg,#FFD700,#FFA500)" :
                                       medalha === "prata" ? "linear-gradient(135deg,#E8E8E8,#A0A0A0)" :
                                                             "linear-gradient(135deg,#CD7F32,#8B4513)") + ';' +
                      'box-shadow:0 3px 8px rgba(0,0,0,0.3);border:2px solid #fff;">' +
            (medalha === "ouro" ? "🥇" : medalha === "prata" ? "🥈" : "🥉") +
          '</div>'
        : '';

      html +=
        '<div class="matriz-cell-dash ' + classesExtras + '" ' +
          'data-prob="' + prob.p + '" data-imp="' + imp.i + '" ' +
          'style="' + estilo + '" ' +
          'onclick="alternarFiltro(\'matrizNivel\', ' + nivelCel + ')" ' +
          'title="Nível ' + nivelCel + ' — ' + qtd + ' risco(s)' +
                 (medalha === "ouro"   ? " 🥇 MAIOR CONCENTRAÇÃO" :
                  medalha === "prata"  ? " 🥈 2º MAIOR" :
                  medalha === "bronze" ? " 🥉 3º MAIOR" : "") + '">' +

            

            // Nível no canto superior esquerdo
            '<span style="position:absolute;top:5px;left:8px;font-size:11px;' +
                         'font-weight:700;color:rgba(0,0,0,0.55);z-index:2;">' +
               nivelCel +
            '</span>' +

            // Contador central — só se tiver risco
            (temRisco
              ? '<div style="display:flex;flex-direction:column;align-items:center;' +
                            'color:#fff;text-shadow:0 1px 3px rgba(0,0,0,0.35);z-index:2;">' +
                  '<span style="font-size:22px;font-weight:800;line-height:1;">' + qtd + '</span>' +
                  '<span style="font-size:9px;font-weight:600;letter-spacing:0.5px;' +
                               'text-transform:uppercase;margin-top:2px;opacity:0.95;">' +
                    (qtd === 1 ? 'risco' : 'riscos') +
                  '</span>' +
                '</div>'
              : '') +

        '</div>';
    });
  });

  // Espaço vazio na coluna 1 da última linha
  html += '<div style="grid-column:1;grid-row:6;"></div>';

  // Labels de probabilidade (linha 6)
  PROBABILIDADES_MATRIZ_DASH.forEach(function(prob, colIdx) {
    const col = colIdx + 2;
    html +=
      '<div style="grid-column:' + col + ';grid-row:6;' +
                  'display:flex;align-items:center;justify-content:center;' +
                  'background:#f5f8fa;border:1px solid #d4dde3;border-radius:8px;' +
                  'font-weight:600;color:#1a2b3d;font-size:12px;text-align:center;padding:6px;">' +
        prob.label +
      '</div>';
  });

  html += '</div>'; // fecha matriz-grid-dash

  // ==================== EIXO X (PROBABILIDADE) ====================
  html +=
    '<div style="display:flex;align-items:center;gap:10px;margin-top:12px;padding:0 5px;">' +
      '<div style="flex:1;height:2px;background:#0e9aa7;"></div>' +
      '<span style="font-weight:700;color:#0e9aa7;letter-spacing:2px;font-size:11px;white-space:nowrap;">' +
        'PROBABILIDADE' +
      '</span>' +
      '<div style="flex:1;height:2px;background:#0e9aa7;"></div>' +
      '<span style="color:#0e9aa7;font-size:14px;line-height:1;">▶</span>' +
    '</div>';

  html += '</div>'; // fecha coluna direita
  html += '</div>'; // fecha wrapper flex

  cont.innerHTML = html;

  // ==================== KPIs DE RESUMO ====================
  if (resumoCont) {
    resumoCont.innerHTML =
      '<div class="resumo-kpi total">' +
        '<div class="resumo-kpi-info">' +
          '<div class="resumo-kpi-label">Total</div>' +
          '<div class="resumo-kpi-valor">' + riscos.length + '</div>' +
        '</div>' +
        '<div class="resumo-kpi-icon"><i class="bi bi-grid-3x3-gap-fill"></i></div>' +
      '</div>' +

      '<div class="resumo-kpi baixo">' +
        '<div class="resumo-kpi-info">' +
          '<div class="resumo-kpi-label">Baixo</div>' +
          '<div class="resumo-kpi-valor">' + totalBaixo + '</div>' +
        '</div>' +
        '<div class="resumo-kpi-icon"><i class="bi bi-shield-check"></i></div>' +
      '</div>' +

      '<div class="resumo-kpi medio">' +
        '<div class="resumo-kpi-info">' +
          '<div class="resumo-kpi-label">Médio</div>' +
          '<div class="resumo-kpi-valor">' + totalMedio + '</div>' +
        '</div>' +
        '<div class="resumo-kpi-icon"><i class="bi bi-exclamation-triangle-fill"></i></div>' +
      '</div>' +

      '<div class="resumo-kpi alto">' +
        '<div class="resumo-kpi-info">' +
          '<div class="resumo-kpi-label">Alto</div>' +
          '<div class="resumo-kpi-valor">' + totalAlto + '</div>' +
        '</div>' +
        '<div class="resumo-kpi-icon"><i class="bi bi-fire"></i></div>' +
      '</div>';
  }
}

function selecionarCelulaMatrizDashboard(prob, imp) {
  const cont = document.getElementById("matrizDashboard");
  const detalhes = document.getElementById("matrizDetalhes");
  if (!cont || !detalhes || !window._dadosDashboardAtual) return;

  document.querySelectorAll(".matriz-cell-dashboard").forEach(function(c) {
    c.classList.remove("active");
  });

  const cell = document.querySelector('.matriz-cell-dashboard[data-prob="' + prob + '"][data-imp="' + imp + '"]');
  if (cell) cell.classList.add("active");

  const riscos = window._dadosDashboardAtual.todosRiscos || [];

  const lista = riscos.filter(function(r) {
    return Number(r.prob) === Number(prob) && Number(r.imp) === Number(imp);
  });

  const nivel = prob * imp;
  const info = classeMatrizPorNivelDash(nivel);

  if (lista.length === 0) {
    detalhes.innerHTML =
      '<div class="matriz-detalhes-empty">Nenhum risco na posição Probabilidade ' + prob + ' × Impacto ' + imp + '.</div>';
    return;
  }

  let html =
    '<div class="matriz-detalhe-titulo">' +
      'Probabilidade ' + prob + ' × Impacto ' + imp +
      ' — Nível ' + nivel + ' (' + info.label + ') • ' + lista.length + ' risco' + (lista.length !== 1 ? 's' : '') +
    '</div>' +
    '<div class="matriz-detalhe-lista">';

  lista.forEach(function(r) {
    const cod = obterNumeroRiscoDash(r, riscos);
    const residual = (Number(r.prob || 0) * Number(r.imp || 0) * (Number(r.nivelControle) || 1));
    const cResidual = classificar(residual);

    html +=
      '<div class="matriz-detalhe-item">' +
        '<div class="matriz-detalhe-cod">' + cod + '</div>' +
        '<div>' +
          '<div class="matriz-detalhe-evento">' + esc(r.evento || "-") + '</div>' +
          '<div class="matriz-detalhe-meta">' +
            'Divisão: ' + esc(r._divisao || "-") +
            ' • Residual: ' + residual.toFixed(1) +
            ' • Tratar: ' + esc(r.tratar || "-") +
          '</div>' +
        '</div>' +
        '<div class="matriz-detalhe-badge ' + info.classeBadge + '">' + info.label + '</div>' +
      '</div>';
  });

  html += '</div>';

  detalhes.innerHTML = html;
}
function obterNivelFinalDashboard(r) {

    const prob =
        Number(r.prob) || 1;

    const imp =
        Number(r.imp) || 1;

    const controle =
        Number(r.nivelControle) || 1;

    const residual =
        prob * imp * controle;

    if (
        String(r.tratar || "")
            .toLowerCase() === "sim"
    ) {

        const etapas =
            obterEtapasDash(r);

        if (etapas.length > 0) {

            const etapa =
                etapas[etapas.length - 1];

            const monitor =
                Number(
                    etapa.nivelMonitoramento
                ) || 0;

            if (monitor > 0) {

                return (
                    residual *
                    monitor
                );

            }
        }
    }

    return residual;
}
function obterPosicaoMatrizDashboard(r) {

    const nivel =
        obterNivelFinalDashboard(r);

    const impacto =
        Math.max(
            1,
            Math.min(
                5,
                Number(r.imp) || 1
            )
        );

    let prob =
        Math.ceil(nivel / impacto);

    prob =
        Math.max(
            1,
            Math.min(5, prob)
        );

    return {
        prob,
        imp: impacto,
        nivel
    };
}

// ============ MATRIZ DE RISCO TJPR NO DASHBOARD ============

/**
 * Tabela oficial TJPR - nível de risco por posição (probabilidade × impacto).
 * Linhas: impacto 5 → 1 (Muito Alto → Muito Baixo)
 * Colunas: probabilidade 1 → 5 (Raro → Quase Certo)
 */



function obterNivelFinalDashboard(r) {

  const prob = Number(r.prob) || 1;
  const imp = Number(r.imp) || 1;
  const controle = Number(r.nivelControle) || 1;

  const residual = prob * imp * controle;

  if (String(r.tratar || "").toLowerCase() === "sim") {

    const etapas = obterEtapasDash(r);

    if (etapas && etapas.length > 0) {

      const etapa = etapas[etapas.length - 1];
      const monitor = Number(etapa.nivelMonitoramento) || 0;

      if (monitor > 0) {
        return residual * monitor;
      }
    }
  }
// Ver as classes aplicadas nas células
document.querySelectorAll(".matriz-cell-dash").forEach(function(cel, idx) {
  console.log(idx, cel.className);
});
  return residual;
}

/**
 * Encontra a célula da matriz TJPR mais próxima do nível final.
 */
function encontrarCelulaTJPR(nivelDesejado) {

  let melhorProb = 1;
  let melhorImp = 1;
  let menorDiff = Infinity;

  for (let p = 1; p <= 5; p++) {
    for (let i = 1; i <= 5; i++) {
      const nivelCel = MATRIZ_TJPR[p + "-" + i];
      const diff = Math.abs(nivelCel - nivelDesejado);

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
    ativos.push({ tipo: "Faixa", valor: filtrosInterativos.faixaNivel, chave: "faixaNivel" });
  }
  if (filtrosInterativos.matrizNivel !== null) {
    ativos.push({ tipo: "Nível Matriz", valor: filtrosInterativos.matrizNivel, chave: "matrizNivel" });
  }
  if (filtrosInterativos.opcao) {
    ativos.push({ tipo: "Opção", valor: filtrosInterativos.opcao, chave: "opcao" });
  }
  if (filtrosInterativos.responsavel) {
    ativos.push({ tipo: "Responsável", valor: filtrosInterativos.responsavel, chave: "responsavel" });
  }

  if (ativos.length === 0) {
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
  }).join("");

  const btnLimpar = barra.querySelector(".btn-limpar-filtros");

if (btnLimpar) {

btnLimpar.onclick = function(e) {

e.preventDefault();

e.stopPropagation();

limparFiltrosInterativos();

};

}
}
