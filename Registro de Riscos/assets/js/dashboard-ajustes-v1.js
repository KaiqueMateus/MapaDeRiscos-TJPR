// ============================================================
//  MAPA / TJPR - Dashboard Executivo
//  AJUSTES V2  —  COMPLEMENTO SEGURO
// ------------------------------------------------------------
//  POR QUE A V1 QUEBRAVA O FILTRO:
//
//  A versao anterior deste arquivo criava um filtro de processo
//  PROPRIO, com outro Set (processosSelecionadosDash). Isso
//  causava tres problemas ao mesmo tempo:
//
//    1. desenhava um SEGUNDO filtro na tela — o clique ia para
//       ele, e nao para o dropdown do dashboard.js;
//    2. envelopava aplicarFiltrosInterativos() e filtrava DE
//       NOVO, por cima do filtro que ja havia rodado;
//    3. envelopava atualizarTudo() e chamava sem cache, o que
//       disparava uma busca nova no Supabase a cada clique. As
//       respostas voltavam fora de ordem e sobrescreviam a tela
//       com o resultado de uma selecao anterior.
//
//  Resultado: os KPIs, graficos e matriz congelavam no primeiro
//  valor selecionado.
//
// ------------------------------------------------------------
//  O QUE MUDOU NA V2:
//
//  Este arquivo NAO implementa filtro nenhum. Ele virou uma
//  camada de VERIFICACAO e REDE DE SEGURANCA:
//
//    - nunca envelopa funcoes do pipeline de dados;
//    - nunca cria elementos de filtro na tela;
//    - aplica uma correcao visual SOMENTE se o dashboard.js
//      ainda nao tiver aquela correcao;
//    - limpa restos da V1, caso ela tenha carregado antes.
//
//  Com o dashboard.js atual (que ja traz todas as correcoes),
//  este arquivo nao altera nada — apenas confirma no console.
//  Ele e seguro de carregar, e seguro de NAO carregar.
//
//  COMO USAR - sempre DEPOIS do dashboard.js:
//      <script src="assets/js/dashboard.js"></script>
//      <script src="assets/js/dashboard-ajustes-v2.js"></script>
// ============================================================

(function () {
  "use strict";

  // ==========================================================
  // TRAVA DE SEGURANCA
  // ----------------------------------------------------------
  // Lista do que este arquivo esta PROIBIDO de tocar. Serve
  // como documentacao viva: se alguem tentar reintroduzir um
  // wrapper aqui no futuro, o console avisa na hora.
  // ==========================================================
  const PIPELINE_INTOCAVEL = [
    "atualizarTudo",
    "agregar",
    "aplicarFiltrosInterativos",
    "filtrarDadosPorMesAno",
    "filtrarDadosPorProcesso",
    "adicionarDataReferencia",
    "sincronizarProcessosDisponiveis",
    "alternarProcessoDashboard",
    "selecionarTodosProcessosDashboard"
  ];

  // Guarda as referencias ORIGINAIS para conferir no final.
  //
  // Atencao: so vale como "original" o que NAO estiver marcado
  // com __ajusteV1. Se a V1 carregou antes deste arquivo, a
  // funcao ja chega envelopada — e o original ficou preso no
  // closure dela, fora do nosso alcance. Nesse caso a unica
  // saida e remover o script antigo do HTML.
  const _assinaturaPipeline = {};
  const _pipelineComprometido = [];

  PIPELINE_INTOCAVEL.forEach(function (nome) {
    // 1a opcao: a referencia publicada pelo dashboard.js
    const oficial = (window.__pipelineDashboard || {})[nome];
    if (typeof oficial === "function" && !oficial.__ajusteV1) {
      _assinaturaPipeline[nome] = oficial;
      return;
    }

    // 2a opcao: o que estiver em window agora
    const fn = window[nome];
    if (typeof fn !== "function") return;

    if (fn.__ajusteV1) {
      _pipelineComprometido.push(nome);
    } else {
      _assinaturaPipeline[nome] = fn;
    }
  });

  /** Confirma que nenhuma funcao do pipeline foi trocada. */
  function auditarPipeline() {
    const alteradas = _pipelineComprometido.slice();

    PIPELINE_INTOCAVEL.forEach(function (nome) {
      if (!_assinaturaPipeline[nome]) return;
      if (alteradas.indexOf(nome) >= 0) return;
      if (window[nome] !== _assinaturaPipeline[nome]) {
        alteradas.push(nome);
      }
    });

    if (alteradas.length) {
      console.error(
        "%c[Ajustes V2] PIPELINE ALTERADO",
        "background:#c04040;color:#fff;padding:2px 8px;border-radius:4px;font-weight:700;"
      );
      console.error(
        "Estas funções foram substituídas por outro script: " +
        alteradas.join(", ") + ".\n" +
        "Isso trava o filtro de processos. Verifique se ainda há " +
        "um dashboard-ajustes-v1.js carregado no HTML."
      );
      return false;
    }

    return true;
  }

  // ==========================================================
  // PALETA UNICA DAS DIVISOES
  // ==========================================================
  const CORES_DIVISOES_REL = {
    DPROC: "#1f4e8c",
    DC:    "#7e57c2",
    DPP:   "#00796b",
    CJ:    "#8e2b45",
    AA:    "#d4700f",
    AT:    "#0e9aa7",
    DCGA:  "#2c74b3"
  };

  const COR_PADRAO = "#5a6b7a";

  function corDivisao(sigla) {
    return CORES_DIVISOES_REL[String(sigla || "").trim().toUpperCase()] || COR_PADRAO;
  }

  function esc(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // ==========================================================
  // LIMPEZA DE RESTOS DA V1
  // ----------------------------------------------------------
  // Se o arquivo antigo ainda estiver no HTML e tiver carregado
  // antes deste, desfazemos o que ele instalou. Isso evita o
  // filtro duplicado e os wrappers no pipeline.
  // ==========================================================
  function limparResiduosV1() {
    const acoes = [];

    // 1) Filtro duplicado na tela
    const filtroDuplicado = document.getElementById("filtroProcessosDash");
    if (filtroDuplicado) {
      filtroDuplicado.remove();
      acoes.push("filtro duplicado removido da tela");
    }

    // 2) Estilos exclusivos da V1
    const estiloV1 = document.getElementById("estilosFiltroProcessoDash");
    const temDropdownNovo = !!document.getElementById("procDropdownMenu");
    if (estiloV1 && !temDropdownNovo) {
      // So remove se o dropdown novo nao existir, para nao
      // apagar estilos que o dashboard.js esteja usando.
      estiloV1.remove();
      acoes.push("CSS órfão removido");
    }

    // 3) Handlers globais da V1
    if (typeof window.alternarProcessoDash === "function") {
      window.alternarProcessoDash = function () {
        console.warn("[Ajustes V2] alternarProcessoDash() desativado — " +
                     "use o filtro do dashboard.js.");
      };
      acoes.push("alternarProcessoDash desativado");
    }

    if (typeof window.selecionarTodosProcessosDash === "function") {
      window.selecionarTodosProcessosDash = function () {
        console.warn("[Ajustes V2] selecionarTodosProcessosDash() desativado.");
      };
      acoes.push("selecionarTodosProcessosDash desativado");
    }

    // 4) Wrappers no pipeline.
    //    So da para restaurar quando temos a referencia limpa,
    //    ou seja, quando a V1 carregou DEPOIS deste arquivo.
    PIPELINE_INTOCAVEL.forEach(function (nome) {
      const fn = window[nome];
      if (typeof fn !== "function" || !fn.__ajusteV1) return;

      // Fonte mais confiavel: o proprio dashboard.js publica
      // suas referencias originais em window.__pipelineDashboard.
      let limpa = (window.__pipelineDashboard || {})[nome];

      // Sem isso, usa o que capturamos na carga deste arquivo.
      if (!limpa || limpa.__ajusteV1) limpa = _assinaturaPipeline[nome];

      if (limpa && !limpa.__ajusteV1) {
        window[nome] = limpa;
        acoes.push(nome + "() restaurado");
      } else if (_pipelineComprometido.indexOf(nome) < 0) {
        _pipelineComprometido.push(nome);
      }
    });

    if (acoes.length) {
      console.warn(
        "%c[Ajustes V2] Resíduos da V1 removidos",
        "background:#d47116;color:#fff;padding:2px 8px;border-radius:4px;font-weight:700;"
      );
      acoes.forEach(function (a) { console.warn("   • " + a); });
    }

    // Caso grave: a V1 carregou ANTES deste arquivo. O pipeline
    // nao pode ser desfeito por codigo — o wrapper guardou a
    // funcao original em um closure inacessivel.
    if (_pipelineComprometido.length) {
      console.error(
        "%c[Ajustes V2] AÇÃO NECESSÁRIA NO HTML",
        "background:#c04040;color:#fff;padding:3px 10px;border-radius:4px;font-weight:700;"
      );
      console.error(
        "Estas funções continuam envelopadas pela V1 e NÃO podem ser\n" +
        "restauradas por código: " + _pipelineComprometido.join(", ") + ".\n\n" +
        "Enquanto o arquivo antigo estiver carregado, os KPIs e gráficos\n" +
        "vão continuar travando no primeiro valor filtrado.\n\n" +
        "👉 Remova esta linha do HTML:\n" +
        '   <script src=".../dashboard-ajustes-v1.js"></script>'
      );

      if (typeof showToast === "function") {
        showToast("Remova dashboard-ajustes-v1.js do HTML para o filtro funcionar.", "error");
      }
    } else if (acoes.length) {
      console.warn("👉 Remova o <script> do dashboard-ajustes-v1.js do HTML.");
    }

    return acoes.length;
  }

  // ==========================================================
  // DETECCAO: a correcao ja existe no dashboard.js?
  // ----------------------------------------------------------
  // Em vez de sobrescrever as funcoes sempre, cada correcao e
  // verificada pelo RESULTADO que a funcao produz. Se o
  // dashboard.js ja gera a saida correta, nada e alterado.
  // ==========================================================

  /** Executa a funcao com dados falsos e devolve o HTML. */
  function amostra(nomeFn, args) {
    if (typeof window[nomeFn] !== "function") return null;
    try {
      return String(window[nomeFn].apply(null, args || []));
    } catch (e) {
      return null;
    }
  }

  const VERIFICACOES = [
    {
      id: "matriz-chip-solido",
      rotulo: "Chip sólido na matriz da divisão",
      testar: function () {
        const html = amostra("relMontarMatrizHTML", [[], { mostrarSigla: false }]);
        if (html === null) return null;                    // funcao ausente
        // A versao antiga desenhava chip BRANCO com borda.
        return html.indexOf("background:#ffffff;color:#1a2b3d") < 0;
      }
    },
    {
      id: "capa-sem-atraso",
      rotulo: "Capa do PDF sem 'EM ATRASO'",
      testar: function () {
        const dados = {
          totais: { divisoes: 0, processos: 0, riscos: 0, alto: 0, medio: 0,
                    baixo: 0, prioritarios: 0, aTratar: 0, atraso: 0, concluido: 0 },
          divisoes: []
        };
        const html = amostra("relMontarCapaHTML", [dados, ""]);
        if (html === null) return null;
        return html.indexOf("EM ATRASO") < 0;
      }
    },
    {
      id: "quadrante-sem-situacao",
      rotulo: "Quadrantes sem coluna 'Situação'",
      testar: function () {
        const html = amostra("relCabecalhoTabelaQuadrante");
        if (html === null) return null;
        return html.indexOf("Situação") < 0;
      }
    },
    {
      id: "indice-sem-situacao",
      rotulo: "Índice mestre sem coluna 'Situação'",
      testar: function () {
        const html = amostra("relCabecalhoIndiceHTML");
        if (html === null) return null;
        return html.indexOf("Situação") < 0;
      }
    },
    {
      id: "tratamento-sem-status",
      rotulo: "Plano de tratamento sem coluna 'Status'",
      testar: function () {
        const html = amostra("relCabecalhoTabelaTratamento");
        if (html === null) return null;
        return html.indexOf(">Status<") < 0;
      }
    },
    {
      id: "kpi-divisao-sem-atraso",
      rotulo: "KPIs da divisão sem 'EM ATRASO'",
      testar: function () {
        const div = {
          kpi: { processos: 0, riscos: 0, baixo: 0, medio: 0, alto: 0,
                 prioritarios: 0, aTratar: 0, atraso: 0 }
        };
        const html = amostra("relResumoDivisaoHTML", [div]);
        if (html === null) return null;
        return html.indexOf("EM ATRASO") < 0;
      }
    }
  ];

  // ==========================================================
  // CORRECOES DE RESERVA
  // ----------------------------------------------------------
  // So entram em acao se a verificacao acima apontar que a
  // correcao NAO esta presente — ou seja, se o dashboard.js
  // for uma versao antiga. Nenhuma delas toca o pipeline.
  // ==========================================================

  /**
   * Remove uma celula <td> de uma linha de tabela.
   *
   * @param {string} html  linha completa (<tr>...</tr>)
   * @param {number} pos   1 = primeira celula; -1 = ultima
   *
   * Usa contagem de <td> em vez de um regex "esperto": celulas
   * podem conter <span>, <br> e ate colchetes, e uma expressao
   * nao-gulosa acabava removendo a celula errada.
   */
  function removerCelula(html, pos) {
    const celulas = [];
    const re = /<td\b[^>]*>[\s\S]*?<\/td>/gi;
    let m;

    while ((m = re.exec(html)) !== null) {
      celulas.push({ texto: m[0], inicio: m.index, fim: m.index + m[0].length });
    }

    if (!celulas.length) return html;

    const idx = pos < 0 ? celulas.length + pos : pos - 1;
    if (idx < 0 || idx >= celulas.length) return html;

    const alvo = celulas[idx];
    return html.slice(0, alvo.inicio) + html.slice(alvo.fim);
  }

  const CORRECOES = {

    "matriz-chip-solido": function () {
      if (typeof window.relMontarMatrizHTML !== "function") return false;

      const original = window.relMontarMatrizHTML;

      window.relMontarMatrizHTML = function (listaRiscos, opcoes) {
        let html = original.apply(this, arguments);

        // Troca o chip branco pelo chip solido, mantendo o resto.
        // A cor da divisao ja esta no proprio HTML, na borda.
        html = html.replace(
          /<span style="display:inline-block;background:#ffffff;color:#1a2b3d;border:1\.5px solid (#[0-9a-f]{6});border-left:5px solid #[0-9a-f]{6};padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700;white-space:nowrap;">/gi,
          function (_m, cor) {
            return '<span style="display:inline-block;background:' + cor + ';' +
                   'color:#ffffff;padding:2px 8px;border-radius:10px;' +
                   'font-size:10.5px;font-weight:800;white-space:nowrap;' +
                   'line-height:1.35;">';
          }
        );

        return html;
      };

      window.relMontarMatrizHTML.__ajusteV2 = true;
      return true;
    },

    "capa-sem-atraso": function () {
      if (typeof window.relMontarCapaHTML !== "function") return false;

      const original = window.relMontarCapaHTML;

      window.relMontarCapaHTML = function () {
        let html = original.apply(this, arguments);

        // Remove o card "EM ATRASO" inteiro
        html = html.replace(
          /<div style="flex:1;background:#f9fbfc;[^"]*border-top:5px solid #d47116;[\s\S]*?EM ATRASO<\/div>\s*<\/div>/gi,
          ""
        );

        // Remove a coluna "Em atraso" do cabecalho
        html = html.replace(
          /<th style="[^"]*">Em atraso<\/th>/gi,
          ""
        );

        return html;
      };

      window.relMontarCapaHTML.__ajusteV2 = true;
      return true;
    },

    "quadrante-sem-situacao": function () {
      if (typeof window.relCabecalhoTabelaQuadrante !== "function") return false;
      if (typeof window.relLinhaQuadrante !== "function") return false;

      const origHead = window.relCabecalhoTabelaQuadrante;
      const origLinha = window.relLinhaQuadrante;

      window.relCabecalhoTabelaQuadrante = function () {
        return String(origHead.apply(this, arguments))
          .replace(/<th style="[^"]*">Situação<\/th>/gi, "");
      };

      window.relLinhaQuadrante = function () {
        // Remove a ULTIMA celula da linha (a coluna "Situacao").
        return removerCelula(String(origLinha.apply(this, arguments)), -1);
      };

      window.relCabecalhoTabelaQuadrante.__ajusteV2 = true;
      window.relLinhaQuadrante.__ajusteV2 = true;
      return true;
    },

    "indice-sem-situacao": function () {
      if (typeof window.relCabecalhoIndiceHTML !== "function") return false;
      if (typeof window.relLinhaIndice !== "function") return false;

      const origHead = window.relCabecalhoIndiceHTML;
      const origLinha = window.relLinhaIndice;

      window.relCabecalhoIndiceHTML = function () {
        return String(origHead.apply(this, arguments))
          .replace(/<th style="[^"]*">Situação<\/th>/gi, "");
      };

      window.relLinhaIndice = function () {
        // Remove a ULTIMA celula da linha (a coluna "Situacao").
        return removerCelula(String(origLinha.apply(this, arguments)), -1);
      };

      window.relCabecalhoIndiceHTML.__ajusteV2 = true;
      window.relLinhaIndice.__ajusteV2 = true;
      return true;
    },

    "tratamento-sem-status": function () {
      if (typeof window.relCabecalhoTabelaTratamento !== "function") return false;
      if (typeof window.relLinhaTratamento !== "function") return false;

      const origHead = window.relCabecalhoTabelaTratamento;
      const origLinha = window.relLinhaTratamento;

      window.relCabecalhoTabelaTratamento = function () {
        return String(origHead.apply(this, arguments))
          .replace(/<th style="[^"]*">Status<\/th>/i, "");
      };

      window.relLinhaTratamento = function () {
        // A coluna "Status" e a 3a celula da linha.
        return removerCelula(String(origLinha.apply(this, arguments)), 3);
      };

      window.relCabecalhoTabelaTratamento.__ajusteV2 = true;
      window.relLinhaTratamento.__ajusteV2 = true;
      return true;
    },

    "kpi-divisao-sem-atraso": function () {
      if (typeof window.relResumoDivisaoHTML !== "function") return false;

      const original = window.relResumoDivisaoHTML;

      window.relResumoDivisaoHTML = function () {
        return String(original.apply(this, arguments))
          .replace(
            /<div style="flex:1;background:#f9fbfc;[^"]*border-top:4px solid #d47116;[\s\S]*?EM ATRASO<\/div>\s*<\/div>/gi,
            ""
          );
      };

      window.relResumoDivisaoHTML.__ajusteV2 = true;
      return true;
    }
  };

  // ==========================================================
  // EXECUCAO
  // ==========================================================

  function aplicar() {
    const resultado = {
      jaOk: [],
      aplicadas: [],
      ausentes: []
    };

    VERIFICACOES.forEach(function (v) {
      const estado = v.testar();

      if (estado === null) {
        // A funcao nem existe nesta pagina.
        resultado.ausentes.push(v.rotulo);
        return;
      }

      if (estado === true) {
        // O dashboard.js ja faz certo: nao mexe.
        resultado.jaOk.push(v.rotulo);
        return;
      }

      // Falta a correcao: aplica a de reserva.
      const fn = CORRECOES[v.id];
      if (fn && fn()) {
        resultado.aplicadas.push(v.rotulo);
      }
    });

    return resultado;
  }

  function relatar(r, residuos) {
    const total = r.jaOk.length + r.aplicadas.length;

    if (r.aplicadas.length === 0 && residuos === 0) {
      console.log(
        "%c[Ajustes V2] Nada a fazer — dashboard.js já está completo (" +
        total + " verificações)",
        "color:#2eb87a;font-weight:700;"
      );
      return;
    }

    console.log(
      "%c[Ajustes V2] Complemento aplicado",
      "background:#0e9aa7;color:#fff;padding:2px 8px;border-radius:4px;font-weight:700;"
    );

    if (r.jaOk.length) {
      console.log("   ✓ já presentes no dashboard.js: " + r.jaOk.length);
    }
    if (r.aplicadas.length) {
      console.log("   + aplicadas por este arquivo:");
      r.aplicadas.forEach(function (a) { console.log("      • " + a); });
    }
    if (r.ausentes.length) {
      console.log("   ? funções não encontradas (normal fora do dashboard): " +
                  r.ausentes.length);
    }
  }

  function iniciar() {
    // 1) Limpa restos da V1, se houver
    const residuos = limparResiduosV1();

    // 2) Aplica somente o que falta
    const r = aplicar();

    // 3) Confirma que o pipeline segue intacto
    const pipelineOk = auditarPipeline();

    // 4) Relata
    relatar(r, residuos);

    if (pipelineOk) {
      console.log(
        "%c[Ajustes V2] Pipeline de filtros intacto ✓",
        "color:#2eb87a;font-weight:600;"
      );
    }

    // Guarda o diagnostico para consulta no console
    window._ajustesV2 = {
      jaPresentes: r.jaOk,
      aplicadas: r.aplicadas,
      naoEncontradas: r.ausentes,
      residuosV1Removidos: residuos,
      pipelineIntacto: pipelineOk
    };
  }

  // ==========================================================
  // DIAGNOSTICO MANUAL
  // ----------------------------------------------------------
  // Rode diagnosticarDashboard() no console para ver o estado
  // do filtro de processos a qualquer momento.
  // ==========================================================
  window.diagnosticarDashboard = function () {
    console.log(
      "%c═══ DIAGNÓSTICO DO DASHBOARD ═══",
      "background:#1a3352;color:#fff;padding:3px 10px;border-radius:4px;font-weight:700;"
    );

    // --- Filtro de processos ---
    const temDropdown = !!document.getElementById("procDropdownMenu");
    const temDuplicado = !!document.getElementById("filtroProcessosDash");

    console.log("\n▸ Filtro de processos");
    console.log("   dropdown (dashboard.js):", temDropdown ? "presente ✓" : "AUSENTE ✗");
    console.log("   filtro duplicado (V1)  :", temDuplicado ? "PRESENTE ✗" : "ausente ✓");

    if (typeof window.dashProcessosSelecionados === "function") {
      const sel = window.dashProcessosSelecionados();
      const dis = typeof window.dashProcessosDisponiveis === "function"
        ? window.dashProcessosDisponiveis() : [];
      console.log("   selecionados           :", sel.length + " de " + dis.length);
    }

    // --- Pipeline ---
    console.log("\n▸ Pipeline de dados");
    PIPELINE_INTOCAVEL.forEach(function (nome) {
      const fn = window[nome];
      if (typeof fn !== "function") {
        console.log("   " + nome.padEnd(32) + "ausente");
        return;
      }
      const marca = fn.__ajusteV1 ? "⚠️ envelopado pela V1"
                  : fn.__ajusteV2 ? "envelopado pela V2"
                  : "original ✓";
      console.log("   " + nome.padEnd(32) + marca);
    });

    // --- Cache ---
    console.log("\n▸ Cache");
    console.log("   invalidarCacheDashboard:",
                typeof window.invalidarCacheDashboard === "function" ? "disponível ✓" : "ausente");

    // --- Conclusao ---
    const problema = temDuplicado ||
      PIPELINE_INTOCAVEL.some(function (n) {
        return typeof window[n] === "function" && window[n].__ajusteV1;
      });

    console.log("\n▸ Conclusão");
    if (problema) {
      console.log(
        "%c   ✗ dashboard-ajustes-v1.js ainda está ativo. Remova-o do HTML.",
        "color:#c04040;font-weight:700;"
      );
    } else {
      console.log("%c   ✓ Tudo certo — filtro operando normalmente.",
                  "color:#2eb87a;font-weight:700;");
    }

    return window._ajustesV2;
  };

  // ==========================================================
  // INICIALIZACAO
  // ----------------------------------------------------------
  // Roda apos o dashboard.js ter definido as funcoes do PDF.
  // ==========================================================
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(iniciar, 600);
    });
  } else {
    setTimeout(iniciar, 600);
  }

  // Segunda passagem: pega o caso de a V1 carregar depois desta.
  setTimeout(function () {
    const residuos = limparResiduosV1();
    if (residuos) auditarPipeline();
  }, 2500);

  console.log("[Ajustes V2] Carregado — complemento seguro, sem filtro próprio.");
})();
