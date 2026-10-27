
// ============================================================
//  👁️ SOMENTE LEITURA: TODAS AS DIVISÕES E PROCESSOS EM TODAS
//  AS PÁGINAS (Riscos, Tratamento e Dashboard)
//  - Libera o filtro de divisões (sem travar na própria sigla)
//  - Marca todas as divisões; os processos de trabalho delas
//    são marcados automaticamente
//  - Mantém a escolha do usuário se ele mudar o filtro depois
// ============================================================
(function filtroTodasDivisoesSomenteLeitura() {
  if (window.MAPA_SOMENTE_LEITURA !== true) return;

  const DIVISOES_PADRAO = ["DPROC", "DC", "DPP", "CJ", "AA", "AT", "DCGA"];
  const CHAVE_FILTRO_DASH = "mapa_filtro_divisoes";

  function todasAsDivisoes() {
    const mapas = ["NOMES_DIVISOES", "NOMES_DIVISOES_MULTI", "NOMES_DIVISOES_DASH"];
    for (let i = 0; i < mapas.length; i++) {
      try {
        const m = (0, eval)("typeof " + mapas[i] + " !== 'undefined' ? " + mapas[i] + " : null");
        if (m && Object.keys(m).length) return Object.keys(m);
      } catch (e) {}
    }
    return DIVISOES_PADRAO.slice();
  }

  // 1) Funções de "é gestor?" das três páginas passam a liberar o filtro
  function liberarPerfil(nome) {
    if (typeof window[nome] !== "function" || window[nome].__leitura) return;
    const wrap = function () { return true; };
    wrap.__leitura = true;
    window[nome] = wrap;
  }
  function liberarTodos() {
    liberarPerfil("usuarioEhGestor");      // riscos.js
    liberarPerfil("usuarioEhGestorTrat");  // tratamento-override.js
    liberarPerfil("isGestorMulti");        // supabase-client.js (dashboard)
  }

  // 2) Dashboard: grava o filtro ANTES de ele inicializar
  (function prepararDashboard() {
    const validas = DIVISOES_PADRAO;
    let atual = null;
    try { atual = JSON.parse(sessionStorage.getItem(CHAVE_FILTRO_DASH) || "null"); } catch (e) {}
    const ok = Array.isArray(atual) && atual.length > 0 &&
      atual.every(function (d) { return validas.indexOf(String(d).toUpperCase()) >= 0; });
    if (!ok) {
      try { sessionStorage.setItem(CHAVE_FILTRO_DASH, JSON.stringify(validas)); } catch (e) {}
    }
  })();

  // 3) Preenche os conjuntos de divisões das páginas de Riscos/Tratamento
  function preencherSet(nome, divisoes) {
    let alvo = null;
    try { alvo = (0, eval)("typeof " + nome + " !== 'undefined' ? " + nome + " : null"); } catch (e) {}
    if (!alvo || typeof alvo.add !== "function") return false;
    alvo.clear();
    divisoes.forEach(function (d) { alvo.add(d); });
    return true;
  }

  // Só aplica depois que os processos foram carregados do banco;
  // senão a seleção de processos ficaria vazia.
  function processosCarregados() {
    try {
      return (0, eval)("typeof processosTodos !== 'undefined' && Array.isArray(processosTodos) && processosTodos.length > 0");
    } catch (e) { return false; }
  }

  let feitoRiscos = false, feitoTrat = false, feitoDash = false;

  function tentar() {
    liberarTodos();
    const divisoes = todasAsDivisoes();

    // Página de Riscos (index)
    if (!feitoRiscos && typeof window.sincronizarSelecaoDivisoesRiscos === "function" &&
        document.getElementById("menuDivisoesRiscos") && processosCarregados()) {
      if (preencherSet("divisoesSelecionadasRiscos", divisoes)) {
        try { window.sincronizarSelecaoDivisoesRiscos(); feitoRiscos = true; } catch (e) {}
      }
    }

    // Página de Tratamento
    if (!feitoTrat && typeof window.sincronizarSelecaoDivisoesTrat === "function" &&
        document.getElementById("menuDivisoesTrat")) {
      if (preencherSet("divisoesSelecionadasTrat", divisoes)) {
        try { window.sincronizarSelecaoDivisoesTrat(); feitoTrat = true; } catch (e) {}
      }
    }

    // Dashboard
    if (!feitoDash && typeof window.renderizarFiltroMultiDivisao === "function" &&
        typeof window.atualizarTudo === "function" &&
        typeof window.sincronizarSelecaoDivisoesRiscos !== "function" &&
        typeof window.sincronizarSelecaoDivisoesTrat !== "function") {
      try {
        window.renderizarFiltroMultiDivisao(function () { window.atualizarTudo(); });
        window.atualizarTudo();
        feitoDash = true;
      } catch (e) {}
    }

    return feitoRiscos || feitoTrat || feitoDash;
  }

  function iniciar() {
    let n = 0;
    const timer = setInterval(function () {
      n++;
      if (tentar() || n > 60) clearInterval(timer);   // até ~18s
    }, 300);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }
})();
