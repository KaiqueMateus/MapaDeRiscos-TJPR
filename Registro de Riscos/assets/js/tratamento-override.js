
// ============================================================
//  MAPA / TJPR - Plano de Tratamento v4
//  Sistema de 4 status: Pendente / Planejado / Em Atraso / Concluido
// ------------------------------------------------------------
//  NOVIDADES DESTA VERSÃO:
//   1) VERIFICAÇÃO DE ETAPA — alterar o prazo de uma etapa já
//      salva e completa exige justificativa em modal.
//   2) CORREÇÃO TEMA CLARO — checkboxes e radios voltaram a
//      exibir a marcação (ver comentário no bloco de CSS).
// ============================================================
console.log("[Tratamento] Script v4 carregado - 4 status + controle de prazo");
// Ordem oficial das opções de tratamento do risco.
const OPCOES_TRATAMENTO = ["Mitigar", "Compartilhar", "Aceitar", "Evitar"];
// ============================================================
// DETALHAMENTO DAS OPÇÕES DE TRATAMENTO
// ------------------------------------------------------------
// Texto exibido abaixo do campo "Opções de Tratamento" e também
// no title de cada <option>, para orientar quem preenche.
// ============================================================
const DETALHE_TRATAMENTO = {
  "Mitigar": {
    icone: "bi-shield-shaded",
    cor: "#2c74b3",
    resumo: "Reduzir a probabilidade e/ou o impacto do risco.",
    texto: "Mantém-se a atividade, mas são implementados controles, rotinas, " +
           "sistemas ou revisões que diminuam a chance do evento ocorrer ou o " +
           "tamanho do prejuízo caso ele ocorra. É a opção mais comum."
  },
  "Compartilhar": {
    icone: "bi-people-fill",
    cor: "#7e57c2",
    resumo: "Dividir ou transferir parte do risco com outra área ou terceiro.",
    texto: "O risco continua existindo, mas a responsabilidade ou o impacto " +
           "financeiro passa a ser dividido — por exemplo, por meio de contrato, " +
           "seguro, terceirização ou atuação conjunta com outra unidade."
  },
  "Aceitar": {
    icone: "bi-hand-thumbs-up",
    cor: "#2eb87a",
    resumo: "Conviver com o risco, sem ação adicional de tratamento.",
    texto: "Escolhida quando o risco está em nível tolerado ou quando o custo " +
           "do tratamento supera o benefício. Exige justificativa e " +
           "monitoramento, pois o risco permanece ativo."
  },
  "Evitar": {
    icone: "bi-x-octagon-fill",
    cor: "#e05a5a",
    resumo: "Eliminar a causa: a atividade deixa de ser executada.",
    texto: "O risco é eliminado porque a atividade que o origina deixa de " +
           "existir ou o processo deixa de ser executado daquela forma. " +
           "Tem impacto direto no fluxo de trabalho e deve ser decidida com o gestor."
  }
};
// Aviso obrigatório ao escolher "Evitar".
const AVISO_EVITAR =
  "Atenção: ao selecionar Evitar, a atividade que origina o risco será " +
  "eliminada ou o processo deixará de ser executado. Deseja continuar?";
// Guarda a última opção válida de cada risco, para reverter o <select>
// caso o usuário cancele o aviso do "Evitar".
const _ultimaOpcaoTrat = {};
/**
 * Monta o painel explicativo exibido abaixo do select de tratamento.
 */
function htmlDetalheTratamento(opcao) {
  const d = DETALHE_TRATAMENTO[opcao];
  if (!d) {
    return '<div class="trat-detalhe trat-detalhe-vazio">' +
             '<i class="bi bi-info-circle"></i> ' +
             'Selecione uma opção para ver a explicação.' +
           '</div>';
  }
  return '<div class="trat-detalhe" style="--det-cor:' + d.cor + ';">' +
           '<div class="trat-detalhe-titulo">' +
             '<i class="bi ' + d.icone + '"></i> ' + escapeHTML(opcao) +
             ' <span class="trat-detalhe-resumo">' + escapeHTML(d.resumo) + '</span>' +
           '</div>' +
           '<div class="trat-detalhe-texto">' + escapeHTML(d.texto) + '</div>' +
           (opcao === "Evitar"
             ? '<div class="trat-detalhe-alerta">' +
                 '<i class="bi bi-exclamation-triangle-fill"></i> ' +
                 'A atividade que origina o risco será eliminada ou o processo ' +
                 'deixará de ser executado.' +
               '</div>'
             : '') +
         '</div>';
}
/**
 * Chamada no onchange do select de opção.
 * - Atualiza o painel explicativo.
 * - Pede confirmação quando a opção escolhida é "Evitar".
 */
function confirmarOpcaoTratamento(sel, riscoId) {
  if (!sel) return;
  const escolhida = sel.value;
  const chave = String(riscoId);
  if (escolhida === "Evitar") {
    if (!confirm(AVISO_EVITAR)) {
      // Reverte para a opção anterior e não altera o painel.
      sel.value = _ultimaOpcaoTrat[chave] || "";
      atualizarDetalheTratamento(riscoId);
      if (typeof tocarSom === "function") tocarSom("click");
      return;
    }
    if (typeof showToast === "function") {
      showToast("Opção \"Evitar\" confirmada. Justifique na descrição do tratamento.", "success");
    }
  }
  _ultimaOpcaoTrat[chave] = escolhida;
  atualizarDetalheTratamento(riscoId);
  if (typeof tocarSom === "function") tocarSom("click");
}
/**
 * Redesenha somente o painel explicativo do card.
 */
function atualizarDetalheTratamento(riscoId) {
  const sel = document.getElementById("opcao-" + riscoId);
  const box = document.getElementById("detalheOpcao-" + riscoId);
  if (!sel || !box) return;
  box.innerHTML = htmlDetalheTratamento(sel.value);
}
// ============================================================
// CONTROLE DE ALTERAÇÃO DE PRAZO
// ------------------------------------------------------------
// Regra: se a etapa JÁ ESTÁ SALVA e COMPLETA (opção, custo-benefício,
// responsável, descrição e prazo preenchidos) e alguém altera o
// PRAZO, é obrigatório justificar o motivo. Sem justificativa, o
// campo volta ao valor anterior e o "Salvar Etapa" é bloqueado.
// ============================================================
const MIN_JUSTIFICATIVA_PRAZO = 15;
// Textos genéricos que não servem como justificativa
const JUSTIFICATIVAS_INVALIDAS = [
  "teste", "test", "mudanca", "mudança", "alteracao", "alteração",
  "prazo", "novo prazo", "mudei", "alterei", "correcao", "correção",
  "ajuste", "atraso", "erro", "-", "n/a", "na", "xxx", "asdf"
];
// Prazo que está salvo no banco, por risco
const _prazoOriginalTrat = {};
// Justificativas confirmadas, aguardando o clique em "Salvar Etapa"
const _justificativaPrazoPendente = {};
// Histórico local (a exibição na timeline depende disto)
const CHAVE_HIST_PRAZO = "mapa_historico_prazos";
let _modalPrazoAtual = null;
function lerHistoricoPrazo() {
  try { return JSON.parse(localStorage.getItem(CHAVE_HIST_PRAZO) || "{}") || {}; }
  catch (e) { return {}; }
}
function gravarHistoricoPrazo(etapaId, registro) {
  if (!etapaId) return;
  const h = lerHistoricoPrazo();
  const chave = String(etapaId);
  if (!h[chave]) h[chave] = [];
  h[chave].push(registro);
  try { localStorage.setItem(CHAVE_HIST_PRAZO, JSON.stringify(h)); } catch (e) {}
}
/**
 * Grava o motivo da alteração de prazo direto na etapa (Supabase).
 *
 * Colunas usadas (criadas por 01_criar_coluna_motivo_prazo.sql):
 *     motivo_alteracao_prazo
 *     prazo_anterior
 *     prazo_alterado_em
 *     prazo_alterado_por
 *
 * Se as colunas ainda não existirem, o erro é apenas registrado no
 * console — o salvamento da etapa não é interrompido por isso.
 */
async function sbRegistrarMotivoPrazo(etapaId, info) {
  if (!etapaId || !info || !info.motivo) return false;
  if (!window.sb) return false;
  let usuarioId = null;
  try {
    usuarioId = (JSON.parse(sessionStorage.getItem("mapa_user") || "{}") || {}).id || null;
  } catch (e) {}
  const payload = {
    motivo_alteracao_prazo: info.motivo,
    prazo_anterior: info.prazoAnterior || null,
    prazo_alterado_em: new Date().toISOString(),
    prazo_alterado_por: usuarioId
  };
  try {
    const { error } = await window.sb
      .from("tratamento_etapas")
      .update(payload)
      .eq("id", etapaId);
    if (error) {
      console.error("[sbRegistrarMotivoPrazo]", error);
      // Coluna inexistente: avisa que falta rodar a migração.
      if (String(error.message || "").indexOf("column") >= 0) {
        if (typeof showToast === "function") {
          showToast("Motivo não gravado no banco: execute a migração " +
                    "01_criar_coluna_motivo_prazo.sql.", "error");
        }
      }
      return false;
    }
    console.log("[Tratamento] Motivo do prazo gravado na etapa", etapaId);
    return true;
  } catch (e) {
    console.error("[sbRegistrarMotivoPrazo]", e);
    return false;
  }
}
function historicoPrazoDaEtapa(etapaId) {
  if (!etapaId) return [];
  return lerHistoricoPrazo()[String(etapaId)] || [];
}
// ============================================================
// 🎯 AUDITORIA DE EDIÇÃO DE ETAPAS FECHADAS (colunas do Supabase:
// edicao / editado_por / editado_em / edicao_detalhes)
// ------------------------------------------------------------
// Requer a migração 02_criar_colunas_edicao_etapa.sql, que cria
// essas 4 colunas na tabela tratamento_etapas.
// ============================================================
/**
 * Grava a marca de edição direto na etapa (Supabase), seguindo o
 * mesmo padrão de sbRegistrarMotivoPrazo — atualização direta via
 * window.sb, sem depender de sbAtualizarEtapa (que só conhece os
 * campos "de negócio" da etapa).
 */
async function sbRegistrarEdicaoEtapa(etapaId, info) {
  if (!etapaId || !window.sb) return false;
  let usuarioId = null;
  try {
    usuarioId = (JSON.parse(sessionStorage.getItem("mapa_user") || "{}") || {}).id || null;
  } catch (e) {}
  const payload = {
    edicao: true,
    editado_por: usuarioId,
    editado_em: new Date().toISOString(),
    edicao_detalhes: (info && info.detalhes) || null
  };
  try {
    const { error } = await window.sb
      .from("tratamento_etapas")
      .update(payload)
      .eq("id", etapaId);
    if (error) {
      console.error("[sbRegistrarEdicaoEtapa]", error);
      if (String(error.message || "").indexOf("column") >= 0) {
        if (typeof showToast === "function") {
          showToast("Edição não registrada no banco: execute a migração " +
                    "02_criar_colunas_edicao_etapa.sql.", "error");
        }
      }
      return false;
    }
    console.log("[Tratamento] Marca de edição gravada na etapa", etapaId);
    return true;
  } catch (e) {
    console.error("[sbRegistrarEdicaoEtapa]", e);
    return false;
  }
}
/**
 * Envolve sbConverterEtapa(row) e acrescenta os campos de edição
 * (edicao, editadoPor, editadoEm, edicaoDetalhes), lidos diretamente
 * da linha bruta do Supabase — pois sbConverterEtapa (definida em
 * supabase-client.js) ainda não conhece essas colunas novas.
 */
function converterEtapaComEdicao(row) {
  const et = sbConverterEtapa(row);
  if (et) {
    et.edicao = !!(row && row.edicao);
    et.editadoPor = (row && row.editado_por) || null;
    et.editadoEm = (row && row.editado_em) || null;
    et.edicaoDetalhes = (row && row.edicao_detalhes) || "";
  }
  return et;
}
/**
 * Compara os valores antigos de uma etapa com os novos valores do
 * formulário de edição e devolve uma lista de textos "Campo: de → para"
 * apenas para os campos que realmente mudaram.
 */
function descreverAlteracoesEtapa(antiga, novos) {
  const mudancas = [];
  const nivMonLabel = function(v) {
    return { "1": "Fraco (1,0)", "0.75": "Médio (0,75)", "0.5": "Alto (0,5)" }[v] || (v || "—");
  };
  function cmp(label, valorAntigo, valorNovo, formatador) {
    const a = (valorAntigo === undefined || valorAntigo === null) ? "" : String(valorAntigo);
    const b = (valorNovo === undefined || valorNovo === null) ? "" : String(valorNovo);
    if (a === b) return;
    const fa = formatador ? formatador(valorAntigo) : (a || "—");
    const fb = formatador ? formatador(valorNovo) : (b || "—");
    mudancas.push(label + ": " + fa + " → " + fb);
  }
  cmp("Opção", antiga.opcao, novos.opcao);
  cmp("Custo-Benefício", antiga.custoBeneficio, novos.custoBeneficio);
  cmp("Responsável", antiga.responsavel, novos.responsavel);
  cmp("Prazo", antiga.prazo, novos.prazo, function(v) { return v ? formatarDataSegura(v) : "—"; });
  cmp("Descrição", antiga.descricao, novos.descricao);
  cmp("Monitoramento (obs.)", antiga.monitoramento, novos.monitoramento);
  cmp("Nível de Monitoramento", antiga.nivelMonitoramento, novos.nivelMonitoramento, nivMonLabel);
  return mudancas;
}
/**
 * A etapa está SALVA e COMPLETA?
 * Só nesse caso a troca de prazo exige justificativa — uma etapa
 * ainda em preenchimento pode ter o prazo ajustado livremente.
 */
function etapaCompletaSalva(etapa) {
  if (!etapa) return false;
  if (!etapa.id) return false;        // ainda não existe no banco
  if (etapa.concluido) return false;  // concluída: reabrir cria etapa nova
  return !!(etapa.opcao && etapa.descricao && etapa.responsavel && etapa.prazo);
}
function diferencaDiasPrazo(de, para) {
  if (!de || !para) return 0;
  const a = new Date(de + "T00:00:00");
  const b = new Date(para + "T00:00:00");
  return Math.round((b - a) / 86400000);
}
function validarJustificativaPrazo(texto) {
  const t = String(texto || "").trim().replace(/\s+/g, " ");
  if (t.length === 0) {
    return { ok: false, msg: "Informe o motivo da alteração do prazo." };
  }
  if (t.length < MIN_JUSTIFICATIVA_PRAZO) {
    return { ok: false, msg: "Descreva melhor: mínimo de " + MIN_JUSTIFICATIVA_PRAZO + " caracteres." };
  }
  if (JUSTIFICATIVAS_INVALIDAS.indexOf(t.toLowerCase()) >= 0) {
    return { ok: false, msg: "Justificativa genérica. Explique o que motivou a mudança." };
  }
  if (!/\s/.test(t)) {
    return { ok: false, msg: "Escreva uma frase explicando o motivo." };
  }
  return { ok: true, texto: t };
}
/**
 * Abre o modal de justificativa.
 * Chama aoConfirmar(motivo) ou aoCancelar().
 */
function abrirModalPrazo(info, aoConfirmar, aoCancelar) {
  fecharModalPrazo();
  const dias = diferencaDiasPrazo(info.de, info.para);
  const adiou = dias > 0;
  const rotuloDelta = dias === 0
    ? ""
    : '<span class="prazo-delta ' + (adiou ? "adia" : "antecipa") + '">' +
        '<i class="bi bi-' + (adiou ? "arrow-right-circle" : "arrow-left-circle") + '"></i> ' +
        (adiou ? "Adiado em " : "Antecipado em ") + Math.abs(dias) + " dia(s)" +
      '</span>';
  const overlay = document.createElement("div");
  overlay.className = "modal-prazo-overlay";
  overlay.innerHTML =
    '<div class="modal-prazo-box" role="dialog" aria-modal="true">' +
      '<div class="modal-prazo-head">' +
        '<i class="bi bi-calendar-event"></i> Alteração de Prazo' +
      '</div>' +
      '<div class="modal-prazo-body">' +
        '<p style="margin:0 0 4px;">' +
          'O risco <strong>' + escapeHTML(info.numero) + '</strong> — ' +
          escapeHTML(info.evento) + ' — já possui uma etapa salva com prazo ' +
          'definido. Registre o motivo da alteração.' +
        '</p>' +
        '<div class="prazo-compara">' +
          '<div class="prazo-caixa prazo-de">' +
            '<div class="prazo-caixa-rotulo">Prazo atual</div>' +
            '<div class="prazo-caixa-valor">' + formatarDataSegura(info.de) + '</div>' +
          '</div>' +
          '<div class="prazo-seta"><i class="bi bi-arrow-right"></i></div>' +
          '<div class="prazo-caixa prazo-para">' +
            '<div class="prazo-caixa-rotulo">Novo prazo</div>' +
            '<div class="prazo-caixa-valor">' + formatarDataSegura(info.para) + '</div>' +
          '</div>' +
          (rotuloDelta ? '<div style="width:100%;text-align:center;">' + rotuloDelta + '</div>' : '') +
        '</div>' +
        '<label for="campoJustificativaPrazo">Motivo da alteração *</label>' +
        '<textarea id="campoJustificativaPrazo" ' +
                  'placeholder="Ex.: Aguardando retorno da unidade demandante sobre a documentação necessária."></textarea>' +
        '<div class="prazo-contador" id="contadorJustPrazo">0 caractere(s)</div>' +
        '<div class="prazo-erro" id="erroJustPrazo"></div>' +
      '</div>' +
      '<div class="modal-prazo-foot">' +
        '<button type="button" class="btn-prazo btn-prazo-cancelar" id="btnPrazoCancelar">' +
          '<i class="bi bi-x-lg"></i> Cancelar alteração' +
        '</button>' +
        '<button type="button" class="btn-prazo btn-prazo-confirmar" id="btnPrazoConfirmar" disabled>' +
          '<i class="bi bi-check-lg"></i> Confirmar novo prazo' +
        '</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);
  _modalPrazoAtual = overlay;
  const campo    = overlay.querySelector("#campoJustificativaPrazo");
  const contador = overlay.querySelector("#contadorJustPrazo");
  const erro     = overlay.querySelector("#erroJustPrazo");
  const btnOk    = overlay.querySelector("#btnPrazoConfirmar");
  const btnNao   = overlay.querySelector("#btnPrazoCancelar");
  setTimeout(function() { campo.focus(); }, 60);
  campo.addEventListener("input", function() {
    const n = campo.value.trim().length;
    contador.textContent = n + " caractere(s)";
    contador.className = "prazo-contador" + (n >= MIN_JUSTIFICATIVA_PRAZO ? " ok" : "");
    btnOk.disabled = n < MIN_JUSTIFICATIVA_PRAZO;
    erro.style.display = "none";
  });
  function confirmar() {
    const v = validarJustificativaPrazo(campo.value);
    if (!v.ok) {
      erro.textContent = v.msg;
      erro.style.display = "block";
      if (typeof tocarSom === "function") tocarSom("error");
      campo.focus();
      return;
    }
    fecharModalPrazo();
    if (typeof aoConfirmar === "function") aoConfirmar(v.texto);
  }
  function cancelar() {
    fecharModalPrazo();
    if (typeof aoCancelar === "function") aoCancelar();
  }
  btnOk.addEventListener("click", confirmar);
  btnNao.addEventListener("click", cancelar);
  overlay.addEventListener("click", function(e) {
    if (e.target === overlay) cancelar();
  });
  overlay.addEventListener("keydown", function(e) {
    if (e.key === "Escape") { e.preventDefault(); cancelar(); }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); confirmar(); }
  });
}
function fecharModalPrazo() {
  if (_modalPrazoAtual) {
    _modalPrazoAtual.remove();
    _modalPrazoAtual = null;
  }
}
function formatarDataSegura(iso) {
  if (!iso) return "—";
  if (typeof formatarData === "function") {
    const f = formatarData(iso);
    if (f) return f;
  }
  const p = String(iso).split("-");
  return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : iso;
}
/**
 * Percorre os cards renderizados, guarda o prazo salvo de cada
 * etapa e liga o listener de alteração.
 */
function prepararCamposPrazo() {
  todosRiscosTrat().forEach(function(r) {
    const input = document.getElementById("prazo-" + r.id);
    if (!input) return;
    const etapa = obterEtapaAtual(r) || {};
    const chave = String(r.id);
    // Prazo que está no banco (não o que está na tela)
    _prazoOriginalTrat[chave] = etapa.prazo || "";
    input.dataset.exigeJust = etapaCompletaSalva(etapa) ? "1" : "0";
    // Restaura o estado visual de uma alteração ainda não salva
    const pend = _justificativaPrazoPendente[chave];
    if (pend && pend.para) {
      input.value = pend.para;
      marcarCampoPrazoAlterado(input, pend);
    }
    if (input.dataset.prazoCheck === "1") return;
    input.dataset.prazoCheck = "1";
    input.addEventListener("change", function() {
      tratarMudancaPrazo(r.id, input);
    });
  });
  injetarJustificativasNaTimeline();
}
function marcarCampoPrazoAlterado(input, pend) {
  input.classList.add("prazo-modificado");
  const pai = input.parentNode;
  if (!pai) return;
  let selo = pai.querySelector(".selo-prazo-alterado");
  if (!selo) {
    selo = document.createElement("div");
    selo.className = "selo-prazo-alterado";
    pai.appendChild(selo);
  }
  selo.innerHTML =
    '<i class="bi bi-info-circle-fill"></i> Prazo alterado (' +
    formatarDataSegura(pend.de) + ' → ' + formatarDataSegura(pend.para) +
    '). Justificativa registrada — clique em <strong>Salvar Etapa</strong>.';
}
function limparMarcaPrazoAlterado(input) {
  if (!input) return;
  input.classList.remove("prazo-modificado");
  const pai = input.parentNode;
  if (!pai) return;
  const selo = pai.querySelector(".selo-prazo-alterado");
  if (selo) selo.remove();
}
/**
 * Núcleo da verificação de etapa.
 */
function tratarMudancaPrazo(riscoId, input) {
  const chave = String(riscoId);
  const risco = todosRiscosTrat().find(function(x) {
    return String(x.id) === String(riscoId);
  });
  if (!risco) return;
  const etapa = obterEtapaAtual(risco) || {};
  const antigo = _prazoOriginalTrat[chave] || "";
  const novo = input.value || "";
  // Voltou ao valor original: descarta a pendência
  if (novo === antigo) {
    delete _justificativaPrazoPendente[chave];
    limparMarcaPrazoAlterado(input);
    return;
  }
  // Etapa nova ou incompleta: pode alterar livremente
  if (!etapaCompletaSalva(etapa)) return;
  // Limpou o campo numa etapa já completa: não permitido
  if (!novo) {
    showToast("A etapa já está com prazo definido. Informe uma nova data.", "error");
    tocarSom("error");
    input.value = antigo;
    return;
  }
  const numero = (typeof obterNumeroRisco === "function")
    ? obterNumeroRisco(riscoId)
    : ("#" + riscoId);
  abrirModalPrazo(
    { de: antigo, para: novo, numero: numero, evento: risco.evento || "" },
    function confirmou(motivo) {
      _justificativaPrazoPendente[chave] = {
        de: antigo,
        para: novo,
        motivo: motivo,
        etapaId: etapa.id,
        quando: new Date().toISOString()
      };
      marcarCampoPrazoAlterado(input, _justificativaPrazoPendente[chave]);
      showToast("Justificativa registrada. Clique em Salvar Etapa para confirmar.", "success");
      tocarSom("success");
    },
    function cancelou() {
      input.value = antigo;
      delete _justificativaPrazoPendente[chave];
      limparMarcaPrazoAlterado(input);
      showToast("Alteração de prazo cancelada.", "error");
    }
  );
}
/**
 * Exibe na timeline as justificativas já registradas.
 */
function injetarJustificativasNaTimeline() {
  todosRiscosTrat().forEach(function(r) {
    const card = document.querySelector('.tratamento-card[data-risco-id="' + r.id + '"]');
    if (!card) return;
    const historico = (r.tratamento && r.tratamento.historico) || [];
    const etapasDOM = card.querySelectorAll(".timeline-etapa .etapa-content");
    if (!etapasDOM.length) return;
    // A timeline é renderizada da etapa mais recente para a mais antiga
    etapasDOM.forEach(function(bloco, idxRev) {
      const etapa = historico[historico.length - 1 - idxRev];
      if (!etapa || !etapa.id) return;
      if (bloco.querySelector(".etapa-just-prazo")) return;
      const regs = historicoPrazoDaEtapa(etapa.id);
      if (!regs.length) return;
      regs.forEach(function(reg) {
        const div = document.createElement("div");
        div.className = "etapa-just-prazo";
        div.innerHTML =
          '<i class="bi bi-calendar-event"></i> <strong>Prazo alterado</strong> ' +
          formatarDataSegura(reg.de) + ' → ' + formatarDataSegura(reg.para) +
          '<br><em>' + escapeHTML(reg.motivo) + '</em>' +
          (reg.por ? '<br><span style="opacity:.8">por ' + escapeHTML(reg.por) + '</span>' : '');
        bloco.appendChild(div);
      });
    });
  });
}
// ============================================================
// 🎯 NÍVEL DE MONITORAMENTO - normalização
// ------------------------------------------------------------
// O <select> usa os value "1", "0.75" e "0.5" (STRING) e compara com
// ===. Se o valor vier como número (0.75) ou com vírgula, a opção
// nunca fica marcada e o campo volta para "Selecione...".
// Esta função devolve SEMPRE um dos value do <select> (ou "").
// ============================================================
function nivelMonitoramentoStr(valor) {
  if (typeof window.sbNormalizarNivelMonitoramento === "function") {
    return window.sbNormalizarNivelMonitoramento(valor);
  }
  if (valor === null || valor === undefined || valor === "") return "";
  const n = parseFloat(String(valor).replace(",", "."));
  if (isNaN(n) || n <= 0) return "";
  const validos = [1, 0.75, 0.5];
  let melhor = validos[0], menorDif = Infinity;
  validos.forEach(function (v) {
    const dif = Math.abs(v - n);
    if (dif < menorDif) { menorDif = dif; melhor = v; }
  });
  return String(melhor);
}
// ============================================================
// 🎯 NOME DO USUÁRIO (em vez do UUID) na timeline de etapas
// ============================================================
function ehUUIDTrat(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    .test(String(v || "").trim());
}
function nomeUsuarioTrat(valor) {
  if (!valor) return "—";
  if (!ehUUIDTrat(valor)) return valor;           // já é nome (ex.: "Legado")
  if (typeof window.sbNomeUsuario === "function") {
    const n = window.sbNomeUsuario(valor);
    if (n && !ehUUIDTrat(n)) return n;
  }
  // último recurso: se for o próprio usuário logado
  try {
    const u = JSON.parse(sessionStorage.getItem("mapa_user") || "{}");
    if (u && String(u.id) === String(valor) && u.nome) return u.nome;
  } catch (e) {}
  return "—";
}
// ============ SELECAO MULTIPLA PARA O RELATORIO ============
// Estado exclusivo da pagina de tratamento. Nao altera o cadastro,
// as tabelas, a matriz ou a logica de edicao ja estabelecida.
let divisoesSelecionadasTrat = new Set();
let processosSelecionadosTrat = new Set();
let processoVisualizadoTrat = null;
function normalizarDivTrat(v) {
  return String(v || "").trim().toUpperCase();
}
function divisaoDoProcessoTrat(p) {
  return normalizarDivTrat(p && (p.divisao || p.divisao_sigla || p.divisaoSigla));
}
function todosProcessosTrat() {
  if (typeof processosTodos !== "undefined" && Array.isArray(processosTodos) && processosTodos.length) {
    return processosTodos.slice();
  }
  return Array.isArray(processos) ? processos.slice() : [];
}
function todosRiscosTrat() {
  if (typeof riscosTodos !== "undefined" && Array.isArray(riscosTodos) && riscosTodos.length) {
    return riscosTodos.slice();
  }
  return Array.isArray(riscos) ? riscos.slice() : [];
}
function riscoEhTratavelTrat(r) {
  return String(r && r.tratar || "").trim().toLowerCase() === "sim";
}
function processosDisponiveisTrat() {
  const todasDiv = divisoesSelecionadasTrat;
  return todosProcessosTrat().filter(function(p) {
    return todasDiv.has(divisaoDoProcessoTrat(p)) &&
      todosRiscosTrat().some(function(r) {
        return String(r.processoId) === String(p.id) && riscoEhTratavelTrat(r);
      });
  });
}
function riscosDasDivisoesTrat(listaProcessos) {
  const ids = new Set((listaProcessos || []).map(function(p) { return String(p.id); }));
  return todosRiscosTrat().filter(function(r) { return ids.has(String(r.processoId)); });
}
function garantirEstilosSelecaoTrat() {
  if (document.getElementById("estilosSelecaoMultiplaTrat")) return;
  const style = document.createElement("style");
  style.id = "estilosSelecaoMultiplaTrat";
  style.textContent = `
    .trat-multi-wrap{position:relative;width:100%}
    .trat-multi-btn{width:100%;min-height:44px;display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:left;cursor:pointer}
    .trat-multi-btn .trat-multi-resumo{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .trat-multi-menu{position:absolute;z-index:3000;left:0;right:0;top:calc(100% + 5px);background:var(--card-bg,#fff);border:1px solid var(--border-color,#d8e2e8);border-radius:10px;box-shadow:0 16px 35px rgba(15,40,60,.18);padding:8px;max-height:300px;overflow:auto}
    .trat-multi-acoes{display:flex;gap:6px;padding:4px 4px 8px;border-bottom:1px solid var(--border-color,#e5edf1);margin-bottom:4px}
    .trat-multi-acao{border:0;border-radius:7px;padding:6px 10px;background:rgba(14,154,167,.1);color:#0e9aa7;font-size:12px;font-weight:700;cursor:pointer}
    /* Não usar var(--text-primary): a variável não existe no riscos.css e o
       fallback escuro (#1a2b3d) sumia sobre o fundo do tema escuro. */
    .trat-multi-opt{display:flex;align-items:flex-start;gap:9px;padding:8px;border-radius:7px;cursor:pointer;color:#e6f1f5}
    .trat-multi-opt strong{color:#ffffff;font-weight:700}
    [data-theme="light"] .trat-multi-opt{color:#1a2b3d}
    [data-theme="light"] .trat-multi-opt strong{color:#0e2233}
    .trat-multi-opt:hover{background:rgba(14,154,167,.08)}
    /* CHECKBOX
       O accent-color sozinho mantinha o "check" na cor padrão do sistema e
       o quadrado sem contraste. Aqui a caixa é desenhada manualmente:
       fundo teal quando marcada e símbolo em BRANCO. */
    .trat-multi-opt input[type="checkbox"]{
      margin-top:3px;
      -webkit-appearance:none;appearance:none;
      width:18px;height:18px;flex:0 0 18px;
      border:2px solid rgba(120,190,205,.75);
      border-radius:5px;
      background:rgba(255,255,255,.06);
      cursor:pointer;position:relative;
      transition:.15s ease;
    }
    .trat-multi-opt input[type="checkbox"]:hover{border-color:#4dd0e1}
    .trat-multi-opt input[type="checkbox"]:focus-visible{outline:2px solid #4dd0e1;outline-offset:2px}
    .trat-multi-opt input[type="checkbox"]:checked{
      background:#0e9aa7;border-color:#0e9aa7;
    }
    .trat-multi-opt input[type="checkbox"]:checked::after{
      content:"";position:absolute;
      left:5px;top:1px;width:5px;height:10px;
      border:solid #ffffff;border-width:0 2.5px 2.5px 0;
      transform:rotate(45deg);
    }
    .trat-multi-opt input[type="checkbox"]:disabled{opacity:.45;cursor:not-allowed}
    /* ⚠️ CORREÇÃO DO TEMA CLARO — não remover a parte ":checked"
       A regra abaixo repinta a caixa de branco no tema claro. Ela tem a
       MESMA especificidade (0-3-1) da regra ".trat-multi-opt input:checked"
       e vem DEPOIS no arquivo, então vencia o empate e apagava o fundo
       teal. Como o "check" também é branco, a caixa ficava SEM MARCAÇÃO.
       Por isso, logo abaixo, repetimos as regras :checked com o seletor
       do tema claro (0-4-1) para restaurar a marcação. */
    [data-theme="light"] .trat-multi-opt input[type="checkbox"]{
      border-color:rgba(14,154,167,.55);background:#ffffff;
    }
    [data-theme="light"] .trat-multi-opt input[type="checkbox"]:checked{
      background:#0e9aa7 !important;border-color:#0e9aa7 !important;
    }
    [data-theme="light"] .trat-multi-opt input[type="checkbox"]:checked::after{
      content:"";position:absolute;
      left:5px;top:1px;width:5px;height:10px;
      border:solid #ffffff;border-width:0 2.5px 2.5px 0;
      transform:rotate(45deg);opacity:1;
    }
    .trat-multi-opt small{display:block;color:var(--text-muted,#8395a1);font-size:11px;margin-top:2px}
    .trat-selecao-grid{display:grid;grid-template-columns:minmax(280px,1fr) minmax(340px,1.35fr);gap:14px;align-items:end}
    .trat-selecao-campo>label{display:block;margin-bottom:7px;font-size:12px;font-weight:700;color:var(--text-muted,#647887);text-transform:uppercase;letter-spacing:.4px}
    .trat-selecao-contador{margin-top:6px;color:var(--text-muted,#8395a1);font-size:11px}
    .trat-selecao-grid{background:rgba(14,154,167,.035);border:1px solid rgba(14,154,167,.20);border-radius:11px;padding:14px 16px;margin:12px 0 16px}
    .trat-multi-btn{border:1px solid rgba(14,154,167,.34)!important;border-radius:9px!important;background:var(--card-bg,#fff)!important;box-shadow:0 2px 7px rgba(14,154,167,.05);padding:10px 13px!important;transition:.18s ease}
    .trat-multi-btn:hover,.trat-multi-btn:focus{border-color:#0e9aa7!important;box-shadow:0 0 0 3px rgba(14,154,167,.10)}
    .trat-multi-btn i{color:#0e9aa7}
    .trat-multi-menu{border-color:rgba(14,154,167,.35)!important;box-shadow:0 14px 35px rgba(18,53,71,.18)!important}
    .trat-multi-opt input{width:17px;height:17px}
    .trat-processo-grupo{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:20px 0 10px;padding:10px 14px;background:linear-gradient(90deg,rgba(14,154,167,.12),rgba(14,154,167,.025));border-left:4px solid #0e9aa7;border-radius:8px;color:#e6f1f5}
    .trat-processo-grupo strong{font-size:14px;color:#ffffff}.trat-processo-grupo span{font-size:11px;color:var(--text-muted,#8395a1)}
    [data-theme="light"] .trat-processo-grupo{color:#1a2b3d}
    [data-theme="light"] .trat-processo-grupo strong{color:#0e2233}
    @media(max-width:900px){.trat-selecao-grid{grid-template-columns:1fr}}
    /* ---------- PAINEL EXPLICATIVO DAS OPÇÕES DE TRATAMENTO ---------- */
    .trat-detalhe{margin-top:8px;padding:10px 12px;border-radius:8px;
      background:rgba(255,255,255,.04);
      border:1px solid rgba(255,255,255,.09);
      border-left:4px solid var(--det-cor,#0e9aa7);
      font-size:12px;line-height:1.55;color:#d9e6ec}
    .trat-detalhe-titulo{font-weight:800;color:var(--det-cor,#0e9aa7);
      font-size:12.5px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
    .trat-detalhe-resumo{font-weight:600;color:#e6f1f5;font-size:11.5px}
    .trat-detalhe-texto{margin-top:5px;color:#b9cdd6}
    .trat-detalhe-alerta{margin-top:7px;padding:7px 9px;border-radius:6px;
      background:rgba(224,90,90,.14);border:1px solid rgba(224,90,90,.4);
      color:#ffb4b4;font-weight:700;font-size:11.5px}
    .trat-detalhe-vazio{color:#8fa3ad;border-left-color:#5d7681;font-style:italic}
    [data-theme="light"] .trat-detalhe{background:#f7fafb;border-color:#e2eaee;color:#3d525e}
    [data-theme="light"] .trat-detalhe-resumo{color:#1a2b3d}
    [data-theme="light"] .trat-detalhe-texto{color:#546673}
    [data-theme="light"] .trat-detalhe-alerta{background:#fdecec;color:#a93434}
    /* Opção Evitar destacada dentro do próprio select */
    #tratamentosLista select option[value="Evitar"]{color:#e05a5a;font-weight:700}
    /* ---------- RADIO CUSTO-BENEFÍCIO ---------- */
    .custo-beneficio-row input[type="radio"]{
      -webkit-appearance:none;appearance:none;
      width:17px;height:17px;flex:0 0 17px;
      border:2px solid rgba(120,190,205,.75);
      border-radius:50%;
      background:rgba(255,255,255,.06);
      cursor:pointer;position:relative;vertical-align:middle;
      transition:.15s ease;
    }
    .custo-beneficio-row input[type="radio"]:hover{border-color:#4dd0e1}
    .custo-beneficio-row input[type="radio"]:checked{background:#0e9aa7;border-color:#0e9aa7}
    .custo-beneficio-row input[type="radio"]:checked::after{
      content:"";position:absolute;left:50%;top:50%;
      width:7px;height:7px;border-radius:50%;background:#ffffff;
      transform:translate(-50%,-50%);
    }
    /* ⚠️ Mesma correção do checkbox: a regra clara vinha depois e
       apagava o preenchimento do radio marcado. */
    [data-theme="light"] .custo-beneficio-row input[type="radio"]{
      border-color:rgba(14,154,167,.55);background:#ffffff;
    }
    [data-theme="light"] .custo-beneficio-row input[type="radio"]:checked{
      background:#0e9aa7 !important;border-color:#0e9aa7 !important;
    }
    [data-theme="light"] .custo-beneficio-row input[type="radio"]:checked::after{
      content:"";position:absolute;left:50%;top:50%;
      width:7px;height:7px;border-radius:50%;background:#ffffff;
      transform:translate(-50%,-50%);opacity:1;
    }
    /* Rede de segurança para qualquer check/radio nativo do módulo */
    [data-theme="light"] #tratamentosLista input[type="checkbox"]:checked,
    [data-theme="light"] #tratamentosLista input[type="radio"]:checked,
    [data-theme="light"] #selecaoMultiplaTrat input[type="checkbox"]:checked{
      accent-color:#0e9aa7;
    }
    /* ---------- MINI-MATRIZ: célula da ETAPA ATUAL ---------- */
    .mini-cell-ativo{
      box-shadow:0 0 0 2px #ffffff, 0 0 9px 2px var(--cor-pulso,#4dd0e1);
      animation:pulsoMiniMatriz 1.35s ease-in-out infinite;
      z-index:2;position:relative;
    }
    @keyframes pulsoMiniMatriz{
      0%,100%{box-shadow:0 0 0 2px #ffffff, 0 0 4px 1px var(--cor-pulso,#4dd0e1);transform:scale(1)}
      50%    {box-shadow:0 0 0 2px #ffffff, 0 0 12px 4px var(--cor-pulso,#4dd0e1);transform:scale(1.22)}
    }
    @media (prefers-reduced-motion: reduce){
      .mini-cell-ativo{animation:none}
    }
    /* ---------- MODAL DE JUSTIFICATIVA DE PRAZO ---------- */
    .modal-prazo-overlay{
      position:fixed;inset:0;z-index:9000;
      background:rgba(6,20,28,.72);backdrop-filter:blur(3px);
      display:flex;align-items:center;justify-content:center;padding:20px;
      animation:prazoFadeIn .18s ease;
    }
    @keyframes prazoFadeIn{from{opacity:0}to{opacity:1}}
    .modal-prazo-box{
      width:100%;max-width:560px;background:var(--card-bg,#12222c);
      border:1px solid rgba(255,255,255,.12);border-radius:14px;
      box-shadow:0 26px 70px rgba(0,0,0,.5);overflow:hidden;
      animation:prazoSobe .22s cubic-bezier(.2,.9,.3,1.2);
    }
    @keyframes prazoSobe{from{transform:translateY(14px);opacity:0}to{transform:translateY(0);opacity:1}}
    [data-theme="light"] .modal-prazo-box{background:#ffffff;border-color:#dbe6ec;box-shadow:0 26px 70px rgba(20,60,80,.24)}
    .modal-prazo-head{
      display:flex;align-items:center;gap:10px;padding:16px 20px;
      background:linear-gradient(90deg,rgba(212,160,23,.20),rgba(212,160,23,.04));
      border-bottom:1px solid rgba(255,255,255,.10);
      color:#f5c94a;font-weight:800;font-size:15px;
    }
    [data-theme="light"] .modal-prazo-head{background:linear-gradient(90deg,#fff5dd,#fffdf7);border-bottom-color:#eadfc4;color:#9a6b05}
    .modal-prazo-head i{font-size:19px}
    .modal-prazo-body{padding:18px 20px;color:#dceaf1;font-size:13.5px;line-height:1.6}
    [data-theme="light"] .modal-prazo-body{color:#33505e}
    .prazo-compara{
      display:flex;align-items:center;justify-content:center;gap:14px;
      margin:4px 0 16px;padding:14px;background:rgba(255,255,255,.05);
      border:1px solid rgba(255,255,255,.10);border-radius:10px;flex-wrap:wrap;
    }
    [data-theme="light"] .prazo-compara{background:#f6fafb;border-color:#e2ebef}
    .prazo-caixa{text-align:center;min-width:112px}
    .prazo-caixa-rotulo{font-size:10px;font-weight:800;letter-spacing:.7px;text-transform:uppercase;color:#8fa9b5;margin-bottom:4px}
    [data-theme="light"] .prazo-caixa-rotulo{color:#6a8492}
    .prazo-caixa-valor{font-size:16px;font-weight:800}
    .prazo-de .prazo-caixa-valor{color:#9fb7c1;text-decoration:line-through}
    [data-theme="light"] .prazo-de .prazo-caixa-valor{color:#8ba0ac}
    .prazo-para .prazo-caixa-valor{color:#4dd0e1}
    [data-theme="light"] .prazo-para .prazo-caixa-valor{color:#0b7d8c}
    .prazo-seta{font-size:19px;color:#f5c94a}
    .prazo-delta{display:inline-block;margin-top:8px;padding:4px 11px;border-radius:20px;font-size:11.5px;font-weight:800}
    .prazo-delta.adia{background:rgba(224,90,90,.16);color:#ff9d9d;border:1px solid rgba(224,90,90,.42)}
    .prazo-delta.antecipa{background:rgba(58,212,138,.16);color:#7ce8b4;border:1px solid rgba(58,212,138,.42)}
    [data-theme="light"] .prazo-delta.adia{background:#fdeaea;color:#b03636;border-color:#f3c9c9}
    [data-theme="light"] .prazo-delta.antecipa{background:#e6f8ef;color:#1d7a4f;border-color:#c2e9d5}
    .modal-prazo-body label{display:block;font-size:11.5px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;color:#8fa9b5;margin-bottom:6px}
    [data-theme="light"] .modal-prazo-body label{color:#5d7785}
    #campoJustificativaPrazo{
      width:100%;min-height:92px;resize:vertical;padding:11px 13px;border-radius:9px;
      font-size:13.5px;line-height:1.5;background:rgba(255,255,255,.06);
      border:1.5px solid rgba(255,255,255,.16);color:#eaf4f8;font-family:inherit;transition:.15s ease;
    }
    #campoJustificativaPrazo:focus{outline:none;border-color:#0e9aa7;box-shadow:0 0 0 3px rgba(14,154,167,.18)}
    [data-theme="light"] #campoJustificativaPrazo{background:#ffffff;border-color:#cfdde4;color:#1a2b3d}
    .prazo-contador{margin-top:6px;font-size:11.5px;color:#8fa9b5;text-align:right}
    [data-theme="light"] .prazo-contador{color:#7590a0}
    .prazo-contador.ok{color:#3ad48a}
    .prazo-erro{
      margin-top:9px;padding:8px 11px;border-radius:7px;
      background:rgba(224,90,90,.15);border:1px solid rgba(224,90,90,.42);
      color:#ffb4b4;font-size:12px;font-weight:700;display:none;
    }
    [data-theme="light"] .prazo-erro{background:#fdecec;color:#a93434;border-color:#f2caca}
    .modal-prazo-foot{
      display:flex;justify-content:flex-end;gap:10px;padding:14px 20px;
      border-top:1px solid rgba(255,255,255,.10);background:rgba(0,0,0,.14);
    }
    [data-theme="light"] .modal-prazo-foot{background:#f7fafb;border-top-color:#e4edf1}
    .btn-prazo{border:0;border-radius:8px;padding:9px 17px;font-size:13px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:7px;transition:.15s ease}
    .btn-prazo-cancelar{background:rgba(255,255,255,.10);color:#cfe0e8}
    .btn-prazo-cancelar:hover{background:rgba(255,255,255,.17)}
    [data-theme="light"] .btn-prazo-cancelar{background:#e9eff2;color:#41606f}
    .btn-prazo-confirmar{background:#0e9aa7;color:#fff}
    .btn-prazo-confirmar:hover{background:#0c8996}
    .btn-prazo-confirmar:disabled{opacity:.45;cursor:not-allowed}
    .selo-prazo-alterado{
      display:inline-flex;align-items:center;gap:5px;margin-top:7px;padding:5px 10px;
      border-radius:7px;background:rgba(212,160,23,.15);border:1px solid rgba(212,160,23,.45);
      color:#f5c94a;font-size:11.5px;font-weight:700;
    }
    [data-theme="light"] .selo-prazo-alterado{background:#fff6e0;color:#8a6100;border-color:#ecd9ac}
    .prazo-modificado{border-color:#f5c94a !important;box-shadow:0 0 0 3px rgba(245,201,74,.16) !important}
    .etapa-just-prazo{
      margin-top:5px;padding:6px 9px;border-radius:6px;
      background:rgba(212,160,23,.12);border-left:3px solid #d4a017;
      color:#e3cb8f;font-size:11px;line-height:1.45;
    }
    [data-theme="light"] .etapa-just-prazo{background:#fff8e8;color:#7d5c10}
  `;
  document.head.appendChild(style);
}
function fecharMenusSelecaoTrat(exceto) {
  ["menuDivisoesTrat", "menuProcessosTrat"].forEach(function(id) {
    if (id === exceto) return;
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });
}
function toggleMenuSelecaoTrat(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const abrir = el.style.display === "none";
  fecharMenusSelecaoTrat(abrir ? id : null);
  el.style.display = abrir ? "block" : "none";
}
function montarSeletoresMultiplosTrat() {
  garantirEstilosSelecaoTrat();
  const divContainer = document.querySelector(".divisao-filter");
  const regContainer = document.querySelector(".registro-selector");
  const selectDiv = document.getElementById("filtroDivisao");
  const selectProc = document.getElementById("seletorProcesso");
  if (!divContainer || !regContainer || !selectDiv || !selectProc) return;
  selectDiv.style.display = "none";
  selectProc.style.display = "none";
  let host = document.getElementById("selecaoMultiplaTrat");
  if (!host) {
    host = document.createElement("div");
    host.id = "selecaoMultiplaTrat";
    host.className = "trat-selecao-grid";
    host.innerHTML = `
      <div class="trat-selecao-campo">
        <label><i class="bi bi-diagram-3"></i> Divisões do relatório</label>
        <div class="trat-multi-wrap">
          <button type="button" class="form-control-dark trat-multi-btn" onclick="toggleMenuSelecaoTrat('menuDivisoesTrat')">
            <span id="resumoDivisoesTrat" class="trat-multi-resumo">Selecione...</span><i class="bi bi-chevron-down"></i>
          </button>
          <div id="menuDivisoesTrat" class="trat-multi-menu" style="display:none"></div>
        </div>
        <div id="contadorDivisoesTrat" class="trat-selecao-contador"></div>
      </div>
      <div class="trat-selecao-campo">
        <label><i class="bi bi-folder2-open"></i> Processos</label>
        <div class="trat-multi-wrap">
          <button type="button" class="form-control-dark trat-multi-btn" onclick="toggleMenuSelecaoTrat('menuProcessosTrat')">
            <span id="resumoProcessosTrat" class="trat-multi-resumo">Selecione...</span><i class="bi bi-chevron-down"></i>
          </button>
          <div id="menuProcessosTrat" class="trat-multi-menu" style="display:none"></div>
        </div>
        <div id="contadorProcessosTrat" class="trat-selecao-contador"></div>
      </div>`;
    divContainer.parentNode.insertBefore(host, divContainer);
    divContainer.style.display = "none";
    regContainer.style.display = "none";
  }
  renderizarSeletorDivisoesTrat();
  renderizarSeletorProcessosTrat();
}
function renderizarSeletorDivisoesTrat() {
  const menu = document.getElementById("menuDivisoesTrat");
  if (!menu) return;
  const siglas = Object.keys(NOMES_DIVISOES);
  const podeTodas = usuarioEhGestorTrat();
  const divUsuario = divisaoUsuarioTrat();
  if (!podeTodas) {
    divisoesSelecionadasTrat.clear();
    divisoesSelecionadasTrat.add(divUsuario);
  }
  menu.innerHTML = (podeTodas ? `
    <div class="trat-multi-acoes">
      <button type="button" class="trat-multi-acao" onclick="selecionarTodasDivisoesTrat(true)">Selecionar todas</button>
      <button type="button" class="trat-multi-acao" onclick="selecionarTodasDivisoesTrat(false)">Limpar</button>
    </div>` : "") + siglas.map(function(sigla) {
      const disabled = !podeTodas && sigla !== divUsuario;
      const checked = divisoesSelecionadasTrat.has(sigla);
      return `<label class="trat-multi-opt" style="${disabled ? "display:none" : ""}">
        <input type="checkbox" value="${sigla}" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""}
               onchange="alterarDivisaoSelecionadaTrat('${sigla}', this.checked)">
        <span><strong>${sigla}</strong> - ${escapeHTML(NOMES_DIVISOES[sigla] || sigla)}</span>
      </label>`;
    }).join("");
  atualizarResumoSelecaoTrat();
}
function selecionarTodasDivisoesTrat(marcar) {
  if (!usuarioEhGestorTrat()) return;
  divisoesSelecionadasTrat.clear();
  if (marcar) Object.keys(NOMES_DIVISOES).forEach(function(d) { divisoesSelecionadasTrat.add(d); });
  sincronizarSelecaoDivisoesTrat();
}
function alterarDivisaoSelecionadaTrat(sigla, marcado) {
  sigla = normalizarDivTrat(sigla);
  if (marcado) divisoesSelecionadasTrat.add(sigla);
  else divisoesSelecionadasTrat.delete(sigla);
  sincronizarSelecaoDivisoesTrat();
}
function sincronizarSelecaoDivisoesTrat() {
  const disponiveis = processosDisponiveisTrat();
  const idsValidos = new Set(disponiveis.map(function(p) { return String(p.id); }));
  processosSelecionadosTrat.forEach(function(id) {
    if (!idsValidos.has(String(id))) processosSelecionadosTrat.delete(String(id));
  });
  // Ao escolher novas divisões, seleciona todos os processos disponíveis.
  disponiveis.forEach(function(p) { processosSelecionadosTrat.add(String(p.id)); });
  renderizarSeletorDivisoesTrat();
  renderizarSeletorProcessosTrat();
  aplicarSelecaoTratamentoNaTela();
}
function renderizarSeletorProcessosTrat() {
  const menu = document.getElementById("menuProcessosTrat");
  if (!menu) return;
  const lista = processosDisponiveisTrat();
  menu.innerHTML = `
    <div class="trat-multi-acoes">
      <button type="button" class="trat-multi-acao" onclick="selecionarTodosProcessosTrat(true)">Selecionar todos</button>
      <button type="button" class="trat-multi-acao" onclick="selecionarTodosProcessosTrat(false)">Limpar</button>
    </div>` + (lista.length ? lista.map(function(p) {
      const qtd = todosRiscosTrat().filter(function(r) {
        return String(r.processoId) === String(p.id) && riscoEhTratavelTrat(r);
      }).length;
      const checked = processosSelecionadosTrat.has(String(p.id));
      return `<label class="trat-multi-opt">
        <input type="checkbox" value="${p.id}" ${checked ? "checked" : ""}
               onchange="alterarProcessoSelecionadoTrat('${p.id}', this.checked)">
        <span><strong>${escapeHTML(p.processo || "Processo")}</strong>
          <small>${escapeHTML(divisaoDoProcessoTrat(p))} - ${qtd} risco(s) a tratar</small>
        </span>
      </label>`;
    }).join("") : '<div class="trat-multi-opt">Nenhum processo com riscos a tratar.</div>');
  atualizarResumoSelecaoTrat();
}
function selecionarTodosProcessosTrat(marcar) {
  processosSelecionadosTrat.clear();
  if (marcar) processosDisponiveisTrat().forEach(function(p) {
    processosSelecionadosTrat.add(String(p.id));
  });
  renderizarSeletorProcessosTrat();
  aplicarSelecaoTratamentoNaTela();
}
function alterarProcessoSelecionadoTrat(id, marcado) {
  id = String(id);
  if (marcado) {
    processosSelecionadosTrat.add(id);
    processoVisualizadoTrat = id;
  } else {
    processosSelecionadosTrat.delete(id);
    if (String(processoVisualizadoTrat) === id) processoVisualizadoTrat = null;
  }
  atualizarResumoSelecaoTrat();
  aplicarSelecaoTratamentoNaTela();
}
function atualizarResumoSelecaoTrat() {
  const divs = Array.from(divisoesSelecionadasTrat);
  const procs = processosDisponiveisTrat().filter(function(p) {
    return processosSelecionadosTrat.has(String(p.id));
  });
  const rDiv = document.getElementById("resumoDivisoesTrat");
  const cDiv = document.getElementById("contadorDivisoesTrat");
  const rPro = document.getElementById("resumoProcessosTrat");
  const cPro = document.getElementById("contadorProcessosTrat");
  if (rDiv) rDiv.textContent = divs.length === 0 ? "Nenhuma divisão" :
    divs.length === 1 ? divs[0] + " - " + (NOMES_DIVISOES[divs[0]] || divs[0]) : divs.length + " divisões selecionadas";
  if (cDiv) cDiv.textContent = divs.length + " divisão(ões) no filtro";
  if (rPro) rPro.textContent = procs.length === 0 ? "Nenhum processo" :
    procs.length === 1 ? procs[0].processo : procs.length + " processos selecionados";
  if (cPro) cPro.textContent = procs.length + " processo(s) entrarão no PDF";
  const btnPDF = document.getElementById("btnPDF");
  if (btnPDF) btnPDF.disabled = procs.length === 0;
}
function aplicarSelecaoTratamentoNaTela() {
  const procs = processosDisponiveisTrat();
  const riscosDiv = riscosDasDivisoesTrat(procs);
  processos = procs;
  riscos = riscosDiv;
  const selecionados = procs.filter(function(p) {
    return processosSelecionadosTrat.has(String(p.id));
  });
  const info = document.getElementById("registroInfo");
  const empty = document.getElementById("emptyRegistro");
  const sec = document.getElementById("secTratamentos");
  const btnPDF = document.getElementById("btnPDF");
  if (!selecionados.length) {
    processoAtualId = null;
    if (info) info.style.display = "none";
    if (empty) empty.style.display = "block";
    if (sec) sec.style.display = "none";
    if (btnPDF) btnPDF.disabled = true;
    renderizarTratamentos();
    atualizarKPIsTratamento();
    return;
  }
  if (info) info.style.display = "block";
  if (empty) empty.style.display = "none";
  if (sec) sec.style.display = "block";
  if (btnPDF) btnPDF.disabled = false;
  // Um processo: mantém exatamente o detalhamento já estabelecido.
  if (selecionados.length === 1) {
    processoVisualizadoTrat = String(selecionados[0].id);
    selecionarProcessoTratamento(selecionados[0].id);
    return;
  }
  // Mais de um processo: mostra resumo coletivo no quadro superior.
  processoAtualId = null;
  processoVisualizadoTrat = null;
  const divs = Array.from(new Set(selecionados.map(function(p) {
    return divisaoDoProcessoTrat(p);
  }).filter(Boolean)));
  const unidades = Array.from(new Set(selecionados.map(function(p) {
    return p.unidade || p.equipe || "";
  }).filter(Boolean)));
  const resumoMulti = selecionados.length + " processos selecionados";
  const resumoDivisoes = divs.length > 1
    ? divs.length + " divisões selecionadas"
    : (unidades.length > 1 ? unidades.length + " unidades selecionadas" : (unidades[0] || resumoMulti));
  // Compatibilidade com os IDs usados nas diferentes versões do HTML.
  setText("infoEquipe", resumoMulti);
  setText("infoUnidade", resumoMulti);
  setText("infoProcesso", resumoMulti);
  setText("infoObjetivo", "Mais de um processo selecionado");
  setText("infoCompilado", "Mais de um processo selecionado");
  setText("infoResultado", "Mais de um processo selecionado");
  setText("infoAnalisado", resumoDivisoes);
  setText("infoAreas", resumoDivisoes);
  setText("infoClientes", "Mais de um processo selecionado");
  setText("infoData", "Mais de um processo selecionado");
  renderizarTratamentos();
  atualizarKPIsTratamento();
}
document.addEventListener("click", function(e) {
  if (!e.target.closest(".trat-multi-wrap")) fecharMenusSelecaoTrat();
});
// ============ MIGRAÇÃO E HELPERS DE ETAPAS ============
function migrarTratamentoSeNecessario(risco) {
  const trat = risco.tratamento;
  if (!trat) return;
  if (Array.isArray(trat.historico)) {
    // 🎯 Garante que o nível fique sempre no formato do <select>
    trat.historico.forEach(function(et) {
      if (et) et.nivelMonitoramento = nivelMonitoramentoStr(
        et.nivelMonitoramento !== undefined && et.nivelMonitoramento !== null && et.nivelMonitoramento !== ""
          ? et.nivelMonitoramento
          : et.nivel_monitoramento
      );
    });
    return; // já novo formato
  }
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
      // 🎯 preserva o nível do formato antigo
      nivelMonitoramento: nivelMonitoramentoStr(trat.nivelMonitoramento || trat.nivel_monitoramento),
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
    nivelMonitoramento: "",
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
document.addEventListener("DOMContentLoaded", function() {
  setTimeout(async function() {
    try {
      // 1) Aguarda o cliente Supabase ficar disponivel
      let tentativas = 0;
      while (!window.sb && tentativas < 50) {
        await new Promise(function(r) { setTimeout(r, 100); });
        tentativas++;
      }
      if (!window.sb) {
        console.error("[Tratamento] Supabase nao inicializou.");
        mostrarFalhaCargaTrat("Nao foi possivel conectar ao banco de dados.");
        return;
      }
      // 2) Garante a sessao do usuario nesta pagina.
      //    riscos.js aborta o DOMContentLoaded quando MODO_TRATAMENTO = true,
      //    entao carregarUsuario() nunca rodava e o cabecalho ficava "Carregando...".
      sincronizarUsuarioTrat();
      // 🎯 2.1) Garante o mapa id->nome antes de renderizar a timeline
      if (typeof window.sbGarantirCacheUsuarios === "function") {
        await window.sbGarantirCacheUsuarios();
      }
      // 3) Carrega os dados ANTES de montar os seletores.
      await carregarProcessos();
      await carregarRiscos();
      console.log("[Tratamento] Apos carregar:", riscos.length, "riscos,", processos.length, "processos");
      // 🎯 3.1) Veio do botao "Tratar" da pagina de riscos?
      //     O riscos.js grava a divisao e o processo do risco clicado.
      //     Aplicamos ANTES de montar os filtros, para a tela ja abrir
      //     focada exatamente naquele processo.
      const vindoDoRisco = aplicarFiltroVindoDeRiscos();
      // 4) Agora sim monta o filtro de divisao com dados em memoria.
      inicializarFiltroDivisaoTrat();
      popularDropdownTratamento();
      atualizarKPIsTratamento();
      // 🎯 Se veio do botao Tratar, abre o card do risco e encerra:
      //     nao deixa a auto-selecao padrao sobrescrever o filtro.
      if (vindoDoRisco) {
        abrirRiscoVindoDeRiscos();
        return;
      }
      // 5) Auto-seleciona um processo que tenha tratamento
      const ultimoId = localStorage.getItem(chaveUltimoProc());
      if (ultimoId && processosSelecionadosTrat.has(String(ultimoId)) && processoTemTratamento(ultimoId)) {
        const sel = document.getElementById("seletorProcesso");
        if (sel) sel.value = String(ultimoId);
        selecionarProcessoTratamento(ultimoId);
        return;
      }
      if (processosSelecionadosTrat.size > 1) {
        // Ja renderizado pelo resumo coletivo em aplicarSelecaoTratamentoNaTela().
        return;
      }
      const primeiroComTratamento = processos.find(function(p) {
        return processoTemTratamento(p.id);
      });
      if (primeiroComTratamento) {
        const sel = document.getElementById("seletorProcesso");
        if (sel) sel.value = String(primeiroComTratamento.id);
        selecionarProcessoTratamento(primeiroComTratamento.id);
        console.log("[Tratamento] Auto-selecionou:", primeiroComTratamento.processo);
      } else {
        console.warn("[Tratamento] Nenhum processo tem risco com Tratar=Sim");
      }
    } catch (e) {
      console.error("[Tratamento] Falha na inicializacao:", e);
      mostrarFalhaCargaTrat(e && e.message ? e.message : "Erro inesperado.");
    }
  }, 200);
});
// ============================================================
// 🎯 ENTRADA VINDA DO BOTAO "TRATAR" (pagina de riscos)
// ------------------------------------------------------------
// O riscos.js grava em sessionStorage:
//     filtro_divisao_tratamento   -> sigla da divisao do risco
//     abrir_processo_tratamento   -> id do processo do risco
//     abrir_risco_tratamento      -> id do risco
//
// Aqui esses valores viram FILTRO: a divisao e o processo do
// risco ficam marcados e os demais sao desmarcados, para a
// pessoa cair direto no plano daquele risco.
// ============================================================
// Guarda o id do risco enquanto a pagina termina de montar.
let _riscoAlvoTrat = null;
function aplicarFiltroVindoDeRiscos() {
  let divisao   = "";
  let processoId = "";
  let riscoId    = "";
  try {
    divisao    = sessionStorage.getItem("filtro_divisao_tratamento") || "";
    processoId = sessionStorage.getItem("abrir_processo_tratamento") || "";
    riscoId    = sessionStorage.getItem("abrir_risco_tratamento") || "";
  } catch (e) {
    return false;
  }
  // Consome as chaves: um F5 depois nao deve refazer o filtro.
  try {
    sessionStorage.removeItem("filtro_divisao_tratamento");
    sessionStorage.removeItem("abrir_processo_tratamento");
    sessionStorage.removeItem("abrir_risco_tratamento");
  } catch (e) {}
  if (!processoId && !riscoId) return false;
  // Se so veio o risco, descobre processo e divisao por ele.
  const risco = todosRiscosTrat().find(function(r) {
    return String(r.id) === String(riscoId);
  });
  if (!processoId && risco) processoId = String(risco.processoId || "");
  const proc = todosProcessosTrat().find(function(p) {
    return String(p.id) === String(processoId);
  });
  if (!divisao && proc)  divisao = divisaoDoProcessoTrat(proc);
  if (!divisao && risco) divisao = normalizarDivTrat(risco._divisao || "");
  if (!divisao && !processoId) return false;
  // Nao gestor so enxerga a propria divisao: mantem a regra.
  if (divisao && !usuarioEhGestorTrat() && divisao !== divisaoUsuarioTrat()) {
    divisao = divisaoUsuarioTrat();
  }
  // ---- Aplica o filtro de DIVISAO ----
  if (divisao) {
    divisoesSelecionadasTrat.clear();
    divisoesSelecionadasTrat.add(normalizarDivTrat(divisao));
  }
  // ---- Aplica o filtro de PROCESSO ----
  if (processoId) {
    processosSelecionadosTrat.clear();
    processosSelecionadosTrat.add(String(processoId));
    processoVisualizadoTrat = String(processoId);
  }
  _riscoAlvoTrat = riscoId || null;
  console.log("[Tratamento] Filtro vindo de Riscos — divisão:",
              divisao || "(mantida)", "| processo:", processoId || "(nenhum)");
  return true;
}
/** Abre e destaca o card do risco que originou o redirecionamento. */
function abrirRiscoVindoDeRiscos() {
  const procId = processoVisualizadoTrat;
  if (procId) {
    const sel = document.getElementById("seletorProcesso");
    if (sel) sel.value = String(procId);
    selecionarProcessoTratamento(procId);
  }
  if (!_riscoAlvoTrat) return;
  const alvo = _riscoAlvoTrat;
  _riscoAlvoTrat = null;
  setTimeout(function() {
    const card = document.querySelector(
      '.tratamento-card[data-risco-id="' + alvo + '"]'
    );
    if (!card) {
      console.warn("[Tratamento] Card do risco", alvo, "não encontrado.");
      return;
    }
    // Fecha os demais e abre somente o card alvo
    document.querySelectorAll(".tratamento-card.expanded").forEach(function(c) {
      if (c !== card) c.classList.remove("expanded");
    });
    card.classList.add("expanded");
    setTimeout(function() {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 250);
    if (typeof showToast === "function") {
      showToast("Risco aberto direto do Registro de Riscos.", "success");
    }
    if (typeof tocarSom === "function") tocarSom("success");
  }, 600);
}
// Preenche nome / iniciais / divisao no cabecalho desta pagina.
function sincronizarUsuarioTrat() {
  let u = {};
  try {
    u = JSON.parse(sessionStorage.getItem("mapa_user") || "{}");
  } catch (e) {
    console.error("[Tratamento] Sessao invalida:", e);
  }
  // Reidrata o global compartilhado com riscos.js
  if (typeof user === "object" && user) {
    Object.keys(u).forEach(function(k) { user[k] = u[k]; });
  }
  const savedTheme = localStorage.getItem("mapa_theme") || "dark";
  document.documentElement.setAttribute("data-theme", savedTheme);
  const nameEl = document.getElementById("userName");
  if (nameEl) nameEl.textContent = u.nome || "Usuario";
  const avatarEl = document.getElementById("userAvatar");
  if (avatarEl) {
    const iniciais = String(u.nome || "")
      .split(" ")
      .filter(function(n) { return n.length > 1; })
      .slice(0, 2)
      .map(function(n) { return n[0].toUpperCase(); })
      .join("");
    avatarEl.textContent = iniciais || "??";
  }
  const divEl = document.getElementById("userDivision");
  if (divEl) divEl.textContent = u.divisao || "-";
  // Esconde botoes restritos para nao gestor
  if (!usuarioEhGestorTrat()) {
    const btnLogs = document.querySelector('[onclick*="abrirModalLogs"]');
    if (btnLogs) btnLogs.style.display = "none";
    const btnExportLogs = document.querySelector('[onclick*="exportarLogs"]');
    if (btnExportLogs) btnExportLogs.style.display = "none";
  }
}
// Tira a pagina do estado "Carregando..." quando algo falha.
function mostrarFalhaCargaTrat(msg) {
  const empty = document.getElementById("emptyRegistro");
  const info  = document.getElementById("registroInfo");
  const sec   = document.getElementById("secTratamentos");
  const btn   = document.getElementById("btnPDF");
  if (info) info.style.display = "none";
  if (sec) sec.style.display = "none";
  if (btn) btn.disabled = true;
  if (empty) {
    empty.style.display = "block";
    empty.innerHTML =
      '<div style="text-align:center;padding:40px 20px;">' +
      '<i class="bi bi-exclamation-triangle" style="font-size:38px;color:#e57373;"></i>' +
      '<h3 style="margin:14px 0 6px;">Nao foi possivel carregar o Plano de Tratamento</h3>' +
      '<p style="color:var(--text-muted,#8395a1);">' + escapeHTML(msg || "") + '</p>' +
      '<button class="btn btn-primary" style="margin-top:14px;" onclick="location.reload()">' +
      '<i class="bi bi-arrow-clockwise"></i> Tentar novamente</button>' +
      '</div>';
  }
  const nameEl = document.getElementById("userName");
  if (nameEl && /carregando/i.test(nameEl.textContent || "")) {
    nameEl.textContent = "Usuario";
  }
}
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
  const lista = processosDisponiveisTrat();
  // Na primeira carga, usa a divisão ativa e seleciona todos os processos dela.
  if (divisoesSelecionadasTrat.size === 0) {
    const divInicial = (typeof divisaoAtivaNorm === "function" ? divisaoAtivaNorm() : "")
      || divisaoUsuarioTrat();
    if (divInicial) divisoesSelecionadasTrat.add(divInicial);
  }
  const disponiveis = processosDisponiveisTrat();
  if (processosSelecionadosTrat.size === 0) {
    disponiveis.forEach(function(p) { processosSelecionadosTrat.add(String(p.id)); });
  }
  montarSeletoresMultiplosTrat();
  aplicarSelecaoTratamentoNaTela();
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

  // 🎯 CORRECAO: os ids abaixo (infoEquipe, infoCompilado,
  // infoAnalisado) sao de uma versao antiga do formulario e NAO
  // existem mais no HTML atual -- por isso os campos apareciam
  // sempre como "-" nesta pagina, mesmo com o processo carregado
  // corretamente. Os ids corretos sao os MESMOS que riscos.js usa
  // em selecionarProcesso() (ver riscos.js): infoUnidade,
  // infoProcesso, infoObjetivo, infoResultado, infoClientes,
  // infoMacroprocesso, infoAreas e infoData.
  setText("infoUnidade",       p.unidade || p.equipe || "-");
  setText("infoProcesso",      p.processo || "-");
  setText("infoObjetivo",      p.objetivo || "-");
  setText("infoResultado",     p.resultado || "-");
  setText("infoClientes",      p.clientes || "-");
  setText("infoMacroprocesso", p.macroprocesso || "-");
  setText("infoData",          p.data ? formatarData(p.data) : "-");

  const infoAreasEl = document.getElementById("infoAreas");
  if (infoAreasEl) {
    const areasArr = (p.areas || "")
      .split(",")
      .map(function(a) { return a.trim(); })
      .filter(function(a) { return a; });

    if (areasArr.length === 0) {
      infoAreasEl.innerHTML = "-";
    } else {
      infoAreasEl.innerHTML = areasArr.map(function(a) {
        return '<span class="area-badge">' + escapeHTML(a) + '</span>';
      }).join(" ");
    }
  }

  if (secTratamentos) secTratamentos.style.display = "block";

  // 🆕 Injeta o icone de vinculo (risco -> etapa do processo) no
  // cabecalho "Processo Atual", visivel ao passar o mouse.
  if (typeof garantirEstilosVinculoEtapa === "function") garantirEstilosVinculoEtapa();
  if (typeof vinculoInjetarIconeCabecalho === "function") vinculoInjetarIconeCabecalho();

  renderizarTratamentos();
  atualizarKPIsTratamento();
  setTimeout(function() {
    if (secTratamentos) {
      secTratamentos.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, 150);
}
// ============ HELPER: Calcula Risco Final da etapa ============
function calcularRiscoFinal(risco, etapa) {
  const nivel = risco.prob * risco.imp;
  const residual = nivel * (risco.nivelControle || 1);
  const monitor = etapa && etapa.nivelMonitoramento
    ? (parseFloat(etapa.nivelMonitoramento) || 1)
    : 1;
  return residual * monitor;
}
// ============ HELPER: Cor baseada no valor de risco ============
function corDoRisco(valor) {
  if (valor >= 16) return { cor: "#e05a5a", classe: "risco-alto", label: "Alto" };
  if (valor >= 7)  return { cor: "#f5c94a", classe: "risco-medio", label: "Médio" };
  return { cor: "#3ad48a", classe: "risco-baixo", label: "Baixo" };
}
// ============================================================
// HELPER: posicao do risco na matriz 5x5 para um VALOR alvo
// ------------------------------------------------------------
// A mini-matriz destacava sempre prob x imp (o risco bruto).
// Agora ela destaca o valor da ETAPA ATUAL do tratamento
// (Risco Final = Residual x Nível de Monitoramento).
// Como o valor final é fracionado (ex.: 5.6), procuramos a célula
// cujo produto (prob x imp) fica mais próximo do alvo; em caso de
// empate, escolhemos a célula mais próxima da posição original do
// risco, para o ponto não "saltar" pela matriz sem necessidade.
// ============================================================
function posicaoNaMatriz(valorAlvo, probOriginal, impOriginal) {
  const alvo = Math.max(1, Math.min(25, Number(valorAlvo) || 0));
  const pOri = Math.max(1, Math.min(5, Number(probOriginal) || 1));
  const iOri = Math.max(1, Math.min(5, Number(impOriginal) || 1));
  let melhor = { prob: pOri, imp: iOri };
  let melhorDifValor = Infinity;
  let melhorDifPos = Infinity;
  for (let p = 1; p <= 5; p++) {
    for (let i = 1; i <= 5; i++) {
      const difValor = Math.abs((p * i) - alvo);
      const difPos = Math.abs(p - pOri) + Math.abs(i - iOri);
      if (difValor < melhorDifValor - 0.0001 ||
         (Math.abs(difValor - melhorDifValor) <= 0.0001 && difPos < melhorDifPos)) {
        melhorDifValor = difValor;
        melhorDifPos = difPos;
        melhor = { prob: p, imp: i };
      }
    }
  }
  return melhor;
}
// ============ HELPER: Mini-matriz 5x5 no card ============
// valorDestaque = valor que deve piscar na matriz.
// Quando não informado, usa o Risco Final da etapa atual do risco.
function gerarMiniMatriz(risco, valorDestaque) {
  const residual = (risco.prob * risco.imp) * (risco.nivelControle || 1);
  const alvo = (valorDestaque === undefined || valorDestaque === null || isNaN(valorDestaque))
    ? calcularRiscoFinal(risco, obterEtapaAtual(risco))
    : Number(valorDestaque);
  const pos = posicaoNaMatriz(alvo, risco.prob, risco.imp);
  const corAlvo = corDoRisco(alvo);
  const etapas = (risco.tratamento && risco.tratamento.historico) || [];
  const rotuloEtapa = etapas.length > 0 ? "Etapa " + etapas.length : "Sem etapa";
  const titulo = "Matriz de Risco — " + rotuloEtapa +
                 " | Residual: " + residual.toFixed(1) +
                 " | Risco Final: " + alvo.toFixed(1) +
                 " (" + corAlvo.label + ")";
  let html = '<div class="mini-matriz" data-valor-destaque="' + alvo.toFixed(1) +
             '" title="' + titulo + '">';
  for (let i = 5; i >= 1; i--) {
    for (let p = 1; p <= 5; p++) {
      const val = p * i;
      let cor = "#3ad48a";
      if (val >= 20) cor = "#e05a5a";
      else if (val >= 7) cor = "#f5c94a";
      const ehAtiva = (p === pos.prob && i === pos.imp);
      const ativo = ehAtiva ? ' mini-cell-ativo' : '';
      // A célula ativa recebe a cor do Risco Final da etapa atual,
      // e é essa cor que pulsa.
      const estilo = ehAtiva
        ? 'background:' + corAlvo.cor + ';--cor-pulso:' + corAlvo.cor + ';'
        : 'background:' + cor + ';';
      html += '<div class="mini-cell' + ativo + '" style="' + estilo + '"></div>';
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
  // 🎯 CORREÇÃO DE ESTILO: garante que o CSS da timeline (etapa-clicavel,
  // etapa-ver-mais, modal de detalhe/edição) já exista ANTES de o HTML
  // com essas classes ser inserido no DOM. Antes, esse CSS só era criado
  // dentro de abrirDetalheEtapa() — ou seja, só existia DEPOIS do primeiro
  // clique. Até lá, o link "Ver etapa completa" aparecia sem nenhum estilo
  // (tamanho de fonte e ícone padrão do navegador, texto quebrando em
  // duas linhas), bem diferente do restante da timeline.
  garantirEstilosDetalheEtapa();
  const idsSelecionados = new Set(
    processosDisponiveisTrat()
      .filter(function(p) { return processosSelecionadosTrat.has(String(p.id)); })
      .map(function(p) { return String(p.id); })
  );
  const filtrados = todosRiscosTrat().filter(function(r) {
    return idsSelecionados.has(String(r.processoId)) && riscoEhTratavelTrat(r);
  });
  filtrados.forEach(migrarTratamentoSeNecessario);
  if (filtrados.length === 0) {
    container.innerHTML = "";
    if (empty) empty.style.display = "block";
    return;
  }
  if (empty) empty.style.display = "none";
  // Agrupa por processo; dentro de cada processo mantém a ordenação original.
  const ordemProcessos = processosDisponiveisTrat()
    .filter(function(p) { return processosSelecionadosTrat.has(String(p.id)); })
    .map(function(p) { return String(p.id); });
  const ordenados = filtrados.slice().sort(function(a, b) {
    const ia = ordemProcessos.indexOf(String(a.processoId));
    const ib = ordemProcessos.indexOf(String(b.processoId));
    if (ia !== ib) return ia - ib;
    const finalA = calcularRiscoFinal(a, obterEtapaAtual(a));
    const finalB = calcularRiscoFinal(b, obterEtapaAtual(b));
    if (Math.abs(finalA - finalB) > 0.1) return finalB - finalA;
    if (a.prioritario === "Sim" && b.prioritario !== "Sim") return -1;
    if (a.prioritario !== "Sim" && b.prioritario === "Sim") return 1;
    return (b.prob * b.imp) - (a.prob * a.imp);
  });
  container.innerHTML = ordenados.map(function(r, idxMapa) {
    const processoRisco = processosDisponiveisTrat().find(function(p) {
      return String(p.id) === String(r.processoId);
    });
    const riscosMesmoProcesso = filtrados.filter(function(x) {
      return String(x.processoId) === String(r.processoId);
    }).sort(function(a, b) { return (b.prob * b.imp) - (a.prob * a.imp); });
    const idxNumero = riscosMesmoProcesso.findIndex(function(x) {
      return String(x.id) === String(r.id);
    });
    const numero = formatarIdRisco(idxNumero + 1);
    const anterior = idxMapa > 0 ? ordenados[idxMapa - 1] : null;
    const iniciaGrupo = !anterior || String(anterior.processoId) !== String(r.processoId);
    const cabecalhoGrupo = iniciaGrupo && processoRisco
      ? '<div class="trat-processo-grupo"><strong><i class="bi bi-folder2-open"></i> ' +
          escapeHTML(processoRisco.processo || "Processo") + '</strong><span>' +
          escapeHTML(divisaoDoProcessoTrat(processoRisco)) + ' · ' + riscosMesmoProcesso.length +
          ' risco(s) a tratar</span></div>'
      : '';
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
    // Guarda a opção já salva, usada para reverter se o usuário
    // cancelar o aviso do "Evitar".
    _ultimaOpcaoTrat[String(r.id)] = etapa.opcao || "";
    let opcoesHtml = '<option value="">Selecione...</option>';
    OPCOES_TRATAMENTO.forEach(function(o) {
      const det = DETALHE_TRATAMENTO[o] || {};
      const dica = det.resumo ? ' title="' + escapeHTML(det.resumo) + '"' : '';
      opcoesHtml += '<option value="' + o + '"' + dica +
                    (etapa.opcao === o ? ' selected' : '') + '>' + o + '</option>';
    });
    const cbFav = etapa.custoBeneficio === "Favorável" ? ' checked' : '';
    const cbDesf = etapa.custoBeneficio === "Desfavorável" ? ' checked' : '';
    // 🎯 CORREÇÃO: normaliza antes de comparar com os value do <select>.
    // Antes: etapa.nivelMonitoramento podia ser 0.75 (número) e
    // 0.75 === "0.75" é false → nenhuma opção ficava marcada.
    const nivMon = nivelMonitoramentoStr(etapa.nivelMonitoramento);
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
    html += gerarMiniMatriz(r, riscoFinal);
    html += '<i class="bi bi-chevron-right tratamento-toggle-icon"></i>';
    html += '</div>';
    // ============ BODY 2 COLUNAS ============
    html += '<div class="tratamento-body tratamento-2col" onclick="event.stopPropagation()">';
    html += '<div class="col-form">';
    // Opção + Custo-Benefício
    html += '<div class="row g-3">';
    html += '<div class="col-md-6">' +
      '<label>Opções de Tratamento * ' +
        '<span class="info-tooltip" title="Mitigar: reduz probabilidade/impacto. ' +
        'Compartilhar: divide o risco com outra área ou terceiro. ' +
        'Aceitar: convive com o risco, com justificativa. ' +
        'Evitar: elimina a atividade que origina o risco."' + '>' +
        '<i class="bi bi-info-circle"></i></span>' +
      '</label>' +
      '<select class="form-control-dark" id="opcao-' + r.id + '" ' +
              'onchange="confirmarOpcaoTratamento(this, ' + r.id + ')">' +
        opcoesHtml +
      '</select>' +
      '<div id="detalheOpcao-' + r.id + '">' + htmlDetalheTratamento(etapa.opcao || "") + '</div>' +
    '</div>';
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
    // 🎯 O campo de prazo recebe o controle de alteração em
    //    prepararCamposPrazo(), chamado ao final desta função.
    html += '<div class="col-md-4"><label>Prazo' +
      (etapaCompletaSalva(etapa)
        ? ' <span class="info-tooltip" title="Esta etapa já está salva e completa. Alterar o prazo exigirá justificativa."><i class="bi bi-shield-lock"></i></span>'
        : '') +
      '</label><input type="date" class="form-control-dark' + (status.estado === "atraso" ? ' prazo-atrasado' : '') + '" id="prazo-' + r.id + '" value="' + (etapa.prazo || "") + '"></div>';
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
    html += '<option value="' + (nivMon === "" ? '' : "") + '"' + (nivMon === "" ? ' selected' : '') + '>Selecione...</option>';
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
        // 🎯 AJUSTE: somente etapas JÁ FECHADAS (concluídas) ficam clicáveis.
        // A etapa atual (em aberto/em andamento) permanece só no formulário
        // principal do card — não recebe link nem clique de "ver etapa completa".
        const podeAbrirDetalhe = !!(et && et.id && et.concluido === true);
        let ico = "bi-circle", classe = "etapa-pendente";
        if (et.concluido) { ico = "bi-check-circle-fill"; classe = "etapa-concluida"; }
        else if (isAtual) { ico = "bi-hourglass-split"; classe = "etapa-atual"; }
        if (et.reaberta && !et.concluido) { ico = "bi-arrow-counterclockwise"; classe = "etapa-reaberta"; }
        const atributosClique = podeAbrirDetalhe
          ? ' tabindex="0" role="button" ' +
            'onclick="abrirDetalheEtapa(' + r.id + ', ' + et.id + ')" ' +
            "onkeydown=\"if(event.key==='Enter'||event.key===' '){event.preventDefault();abrirDetalheEtapa(" + r.id + ', ' + et.id + ');}"'
          : '';
        html += '<div class="timeline-etapa ' + classe + (isAtual ? ' atual' : '') +
                 (podeAbrirDetalhe ? ' etapa-clicavel' : '') + '"' + atributosClique + '>';
        html += '<div class="etapa-icon"><i class="bi ' + ico + '"></i></div>';
        html += '<div class="etapa-content">';
        html += '<div class="etapa-titulo">Etapa ' + numEt + (et.reaberta ? ' <span class="badge-reab">reaberta</span>' : '') + (et.edicao ? ' <span class="badge-editado" title="Esta etapa foi editada após ser concluída">editada</span>' : '') + ' ' + badgeComparacao(r, idxReal) + '</div>';
        if (et.opcao) html += '<div class="etapa-info"><strong>' + escapeHTML(et.opcao) + '</strong></div>';
        html += '<div class="etapa-info"><i class="bi bi-bullseye"></i> Risco Final: <strong style="color:' + corEtapa.cor + ';">' + rfEtapa.toFixed(1) + '</strong></div>';
        if (et.responsavel) html += '<div class="etapa-info"><i class="bi bi-person"></i> ' + escapeHTML(et.responsavel) + '</div>';
        if (et.prazo) html += '<div class="etapa-info"><i class="bi bi-calendar"></i> ' + formatarData(et.prazo) + '</div>';
        // 🎯 CORREÇÃO: mostra o NOME do usuário, não o UUID
        html += '<div class="etapa-meta">Criado ' + formatarDataHora(et.criadoEm) + ' por <strong>' + escapeHTML(nomeUsuarioTrat(et.criadoPor)) + '</strong></div>';
        if (et.concluido) {
          html += '<div class="etapa-meta etapa-meta-verde">✓ Concluído ' + formatarDataHora(et.concluidoEm) + ' por <strong>' + escapeHTML(nomeUsuarioTrat(et.concluidoPor)) + '</strong></div>';
        }
        if (podeAbrirDetalhe) {
          html += '<div class="etapa-ver-mais"><i class="bi bi-eye"></i> Ver etapa completa <i class="bi bi-chevron-right"></i></div>';
        }
        html += '</div></div>';
      });
    }
    html += '</div>'; // fim timeline-lateral
    html += '</div>'; // fim col-timeline
    html += '</div>'; // fim body
    html += '</div>'; // fim card
    return cabecalhoGrupo + html;
  }).join("");
  // 🎯 Liga o controle de alteração de prazo nos campos recém-criados
  //    e injeta as justificativas já registradas na timeline.
  prepararCamposPrazo();
  // Alerta crítico
  const totalAtrasados = document.querySelectorAll(".tratamento-card.em-atraso").length;
  if (totalAtrasados > 0 && !window._atrasoAvisado && typeof dispararAlertaCritico === "function") {
    dispararAlertaCritico(totalAtrasados);
    window._atrasoAvisado = true;
  }
}
// ============================================================
// 🎯 DETALHE E EDIÇÃO DE ETAPAS FECHADAS (CONCLUÍDAS)
// ------------------------------------------------------------
// Clicar em uma etapa já concluída da timeline abre um modal com
// a visão completa daquela etapa: opção, custo-benefício,
// responsável, prazo, descrição, monitoramento, risco final,
// comparação com a etapa anterior e o histórico de justificativas
// de prazo. A partir do modal é possível clicar em "Editar esta
// etapa" e alterar os campos registrados nela.
//
// A etapa ATUAL (em aberto) NÃO recebe esse comportamento — ela
// continua sendo editada apenas pelo formulário principal do card,
// exatamente como antes desta funcionalidade existir.
// ============================================================
let _modalEtapaAtual = null;   // overlay do modal aberto no momento
let _etapaEmEdicao   = null;   // { riscoId, etapaId } enquanto o modo edição está ativo

/** Localiza o risco e a etapa (pelo id) dentro do histórico. */
function localizarRiscoEEtapa(riscoId, etapaId) {
  const fonte = (typeof riscos !== "undefined" && Array.isArray(riscos)) ? riscos : [];
  const risco = fonte.find(function(x) { return String(x.id) === String(riscoId); });
  if (!risco) return null;
  migrarTratamentoSeNecessario(risco);
  const historico = (risco.tratamento && risco.tratamento.historico) || [];
  const idx = historico.findIndex(function(e) { return String(e.id) === String(etapaId); });
  if (idx < 0) return null;
  return { risco: risco, etapa: historico[idx], idx: idx, historico: historico };
}

function garantirEstilosDetalheEtapa() {
  if (document.getElementById("estilosDetalheEtapa")) return;
  const style = document.createElement("style");
  style.id = "estilosDetalheEtapa";
  style.textContent = `
    /* Timeline: deixa claro que a etapa CONCLUÍDA é clicável.
       A etapa atual (em aberto) NÃO recebe a classe etapa-clicavel
       e continua com a aparência original, sem cursor de mãozinha. */
    .timeline-etapa.etapa-clicavel{cursor:pointer;transition:.15s ease;border-radius:9px}
    .timeline-etapa.etapa-clicavel:hover{background:rgba(77,208,225,.08);transform:translateX(2px)}
    .timeline-etapa.etapa-clicavel:focus-visible{outline:2px solid #4dd0e1;outline-offset:2px}
    .etapa-ver-mais{
      margin-top:6px;font-size:11px;font-weight:700;color:#4dd0e1;
      display:flex;align-items:center;gap:5px;opacity:.85;
    }
    .timeline-etapa.etapa-clicavel:hover .etapa-ver-mais{opacity:1}
    [data-theme="light"] .etapa-ver-mais{color:#0b7d8c}

    /* ---------- MODAL DE DETALHE / EDIÇÃO DE ETAPA ---------- */
    .modal-etapa-overlay{
      position:fixed;inset:0;z-index:9100;
      background:rgba(6,20,28,.74);backdrop-filter:blur(3px);
      display:flex;align-items:center;justify-content:center;padding:20px;
      animation:etapaFadeIn .18s ease;overflow-y:auto;
    }
    @keyframes etapaFadeIn{from{opacity:0}to{opacity:1}}
    .modal-etapa-box{
      width:100%;max-width:720px;max-height:calc(100vh - 40px);overflow-y:auto;
      background:var(--card-bg,#12222c);border:1px solid rgba(255,255,255,.12);
      border-radius:14px;box-shadow:0 26px 70px rgba(0,0,0,.5);
      animation:etapaSobe .22s cubic-bezier(.2,.9,.3,1.2);
    }
    @keyframes etapaSobe{from{transform:translateY(14px);opacity:0}to{transform:translateY(0);opacity:1}}
    [data-theme="light"] .modal-etapa-box{background:#ffffff;border-color:#dbe6ec;box-shadow:0 26px 70px rgba(20,60,80,.24)}

    .modal-etapa-head{
      position:sticky;top:0;z-index:2;
      display:flex;align-items:center;justify-content:space-between;gap:10px;
      padding:16px 20px;background:linear-gradient(90deg,rgba(14,154,167,.20),rgba(14,154,167,.04));
      border-bottom:1px solid rgba(255,255,255,.10);
    }
    [data-theme="light"] .modal-etapa-head{background:linear-gradient(90deg,#e6f7f9,#ffffff);border-bottom-color:#dceaee}
    .modal-etapa-titulo{display:flex;align-items:center;gap:9px;font-weight:800;font-size:15px;color:#4dd0e1}
    [data-theme="light"] .modal-etapa-titulo{color:#0b7d8c}
    .modal-etapa-fechar{
      border:0;background:rgba(255,255,255,.08);color:#dceaf1;width:30px;height:30px;
      border-radius:8px;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;
    }
    .modal-etapa-fechar:hover{background:rgba(255,255,255,.16)}
    [data-theme="light"] .modal-etapa-fechar{background:#eef4f6;color:#33505e}

    .modal-etapa-body{padding:18px 20px;color:#dceaf1;font-size:13px;line-height:1.55}
    [data-theme="light"] .modal-etapa-body{color:#33505e}

    .etapa-detalhe-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 18px;margin-bottom:14px}
    @media(max-width:560px){.etapa-detalhe-grid{grid-template-columns:1fr}}
    .etapa-detalhe-campo{padding:10px 12px;border-radius:9px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.09)}
    [data-theme="light"] .etapa-detalhe-campo{background:#f7fafb;border-color:#e2eaee}
    .etapa-detalhe-campo.full{grid-column:1 / -1}
    .etapa-detalhe-rotulo{font-size:10.5px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:#8fa9b5;margin-bottom:4px}
    [data-theme="light"] .etapa-detalhe-rotulo{color:#6a8492}
    .etapa-detalhe-valor{font-size:13.5px;font-weight:600;color:#eaf4f8;word-break:break-word}
    [data-theme="light"] .etapa-detalhe-valor{color:#1a2b3d}
    .etapa-detalhe-vazio{color:#7d92a0;font-style:italic;font-weight:400}

    .etapa-detalhe-final{
      display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:10px;
      background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);margin-bottom:14px;
    }
    [data-theme="light"] .etapa-detalhe-final{background:#f7fafb;border-color:#e2eaee}
    .etapa-detalhe-final .valor{font-size:22px;font-weight:800}
    .etapa-detalhe-final .rotulo{font-size:11px;color:#8fa9b5;text-transform:uppercase;letter-spacing:.5px;font-weight:700}
    [data-theme="light"] .etapa-detalhe-final .rotulo{color:#6a8492}

    .etapa-detalhe-metas{font-size:11.5px;color:#9fb7c1;margin-top:2px;line-height:1.6}
    [data-theme="light"] .etapa-detalhe-metas{color:#5d7785}
    .etapa-detalhe-metas strong{color:#dceaf1}
    [data-theme="light"] .etapa-detalhe-metas strong{color:#1a2b3d}

    .etapa-hist-prazo{
      margin-top:10px;padding:9px 11px;border-radius:8px;background:rgba(212,160,23,.12);
      border-left:3px solid #d4a017;font-size:11.5px;color:#e3cb8f;
    }
    [data-theme="light"] .etapa-hist-prazo{background:#fff8e8;color:#7d5c10}
    .etapa-hist-prazo + .etapa-hist-prazo{margin-top:7px}

    /* ---------- BADGE "editada" (etapa alterada após concluída) ---------- */
    .badge-editado{
      display:inline-block;margin-left:6px;padding:2px 8px;border-radius:10px;
      background:rgba(44,116,179,.20);color:#8ec4f2;font-size:10px;font-weight:800;
      text-transform:uppercase;letter-spacing:.3px;vertical-align:middle;
    }
    [data-theme="light"] .badge-editado{background:#e7f1fb;color:#1c5f9e}

    /* ---------- RELATO DE EDIÇÕES DA ETAPA (histórico de mudanças) ---------- */
    .etapa-hist-edicao{
      margin-top:6px;padding:9px 11px;border-radius:8px;background:rgba(44,116,179,.10);
      border-left:3px solid #2c74b3;font-size:11.5px;color:#bcd7ee;line-height:1.6;
      white-space:pre-wrap;
    }
    [data-theme="light"] .etapa-hist-edicao{background:#eef6fc;color:#254a66}

    /* Formulário de edição — reaproveita os inputs do tema geral */
    #formEdicaoEtapa .row-edt{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}
    @media(max-width:560px){#formEdicaoEtapa .row-edt{grid-template-columns:1fr}}
    #formEdicaoEtapa label{display:block;font-size:11.5px;font-weight:800;letter-spacing:.3px;text-transform:uppercase;color:#8fa9b5;margin-bottom:6px}
    [data-theme="light"] #formEdicaoEtapa label{color:#5d7785}
    #formEdicaoEtapa .cb-row{display:flex;gap:16px;align-items:center;padding-top:6px}

    .modal-etapa-foot{
      position:sticky;bottom:0;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;
      padding:14px 20px;border-top:1px solid rgba(255,255,255,.10);background:rgba(0,0,0,.14);
    }
    [data-theme="light"] .modal-etapa-foot{background:#f7fafb;border-top-color:#e4edf1}
    .btn-etapa{border:0;border-radius:8px;padding:9px 17px;font-size:13px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:7px;transition:.15s ease}
    .btn-etapa-fechar{background:rgba(255,255,255,.10);color:#cfe0e8}
    .btn-etapa-fechar:hover{background:rgba(255,255,255,.17)}
    [data-theme="light"] .btn-etapa-fechar{background:#e9eff2;color:#41606f}
    .btn-etapa-editar{background:#2c74b3;color:#fff}
    .btn-etapa-editar:hover{background:#25629a}
    .btn-etapa-salvar{background:#0e9aa7;color:#fff}
    .btn-etapa-salvar:hover{background:#0c8996}
    .btn-etapa-cancelar-edicao{background:rgba(224,90,90,.14);color:#ff9d9d;border:1px solid rgba(224,90,90,.4)}
    [data-theme="light"] .btn-etapa-cancelar-edicao{background:#fdecec;color:#a93434;border-color:#f2caca}
  `;
  document.head.appendChild(style);
}

/** Abre o modal em modo de VISUALIZAÇÃO da etapa clicada (somente etapas concluídas chegam aqui). */
function abrirDetalheEtapa(riscoId, etapaId) {
  garantirEstilosDetalheEtapa();
  const achado = localizarRiscoEEtapa(riscoId, etapaId);
  if (!achado) {
    showToast("Não foi possível localizar os dados desta etapa.", "error");
    return;
  }
  _etapaEmEdicao = null;
  montarModalEtapa(riscoId, etapaId, "visualizar");
  tocarSom("click");
}

function fecharModalDetalheEtapa() {
  if (_modalEtapaAtual) {
    _modalEtapaAtual.remove();
    _modalEtapaAtual = null;
  }
  _etapaEmEdicao = null;
}

/** (Re)constrói o modal inteiro no modo pedido: "visualizar" ou "editar". */
function montarModalEtapa(riscoId, etapaId, modo) {
  const achado = localizarRiscoEEtapa(riscoId, etapaId);
  if (!achado) { fecharModalDetalheEtapa(); return; }
  const scrollAnterior = _modalEtapaAtual
    ? _modalEtapaAtual.querySelector(".modal-etapa-box").scrollTop
    : 0;
  fecharModalDetalheEtapa();

  const risco = achado.risco;
  const etapa = achado.etapa;
  const idx = achado.idx;
  const historico = achado.historico;
  const numEt = idx + 1;
  const isAtual = idx === historico.length - 1;

  const overlay = document.createElement("div");
  overlay.className = "modal-etapa-overlay";
  overlay.innerHTML =
    '<div class="modal-etapa-box" role="dialog" aria-modal="true">' +
      '<div class="modal-etapa-head">' +
        '<div class="modal-etapa-titulo">' +
          '<i class="bi bi-clock-history"></i> Etapa ' + numEt +
          (isAtual ? ' <span class="badge-etapa" style="margin-left:6px;">atual</span>' : '') +
          (etapa.concluido ? ' <span class="badge-concluido" style="margin-left:6px;">Concluído</span>' : '') +
          (etapa.reaberta ? ' <span class="badge-reab">reaberta</span>' : '') +
          (etapa.edicao ? ' <span class="badge-editado">editada</span>' : '') +
        '</div>' +
        '<button type="button" class="modal-etapa-fechar" onclick="fecharModalDetalheEtapa()" aria-label="Fechar"><i class="bi bi-x-lg"></i></button>' +
      '</div>' +
      '<div class="modal-etapa-body" id="corpoModalEtapa"></div>' +
      '<div class="modal-etapa-foot" id="rodapeModalEtapa"></div>' +
    '</div>';
  document.body.appendChild(overlay);
  _modalEtapaAtual = overlay;

  const corpo = overlay.querySelector("#corpoModalEtapa");
  const rodape = overlay.querySelector("#rodapeModalEtapa");

  if (modo === "editar") {
    corpo.innerHTML = htmlFormEdicaoEtapa(risco, etapa, numEt);
    rodape.innerHTML =
      '<button type="button" class="btn-etapa btn-etapa-cancelar-edicao" onclick="cancelarEdicaoEtapa(' + risco.id + ', ' + etapa.id + ')">' +
        '<i class="bi bi-x-lg"></i> Cancelar edição' +
      '</button>' +
      '<button type="button" class="btn-etapa btn-etapa-salvar" onclick="salvarEdicaoEtapa(' + risco.id + ', ' + etapa.id + ')">' +
        '<i class="bi bi-check-lg"></i> Salvar alterações' +
      '</button>';
    // Liga o painel explicativo da opção de tratamento no modo edição
    const selOpcao = overlay.querySelector("#edtOpcao");
    if (selOpcao) {
      selOpcao.addEventListener("change", function() {
        const box = overlay.querySelector("#edtDetalheOpcao");
        if (box) box.innerHTML = htmlDetalheTratamento(selOpcao.value);
      });
    }
  } else {
    corpo.innerHTML = htmlVisualizacaoEtapa(risco, etapa, idx, historico);
    rodape.innerHTML =
      '<button type="button" class="btn-etapa btn-etapa-fechar" onclick="fecharModalDetalheEtapa()">' +
        '<i class="bi bi-x-lg"></i> Fechar' +
      '</button>' +
      '<button type="button" class="btn-etapa btn-etapa-editar" onclick="ativarEdicaoEtapa(' + risco.id + ', ' + etapa.id + ')">' +
        '<i class="bi bi-pencil-square"></i> Editar esta etapa' +
      '</button>';
  }

  overlay.addEventListener("mousedown", function(e) {
    if (e.target === overlay) {
      if (modo === "editar") { cancelarEdicaoEtapa(risco.id, etapa.id); }
      else { fecharModalDetalheEtapa(); }
    }
  });
  overlay.addEventListener("keydown", function(e) {
    if (e.key === "Escape") {
      if (modo === "editar") cancelarEdicaoEtapa(risco.id, etapa.id);
      else fecharModalDetalheEtapa();
    }
  });

  overlay.querySelector(".modal-etapa-box").scrollTop = scrollAnterior;
}

/** Monta o HTML somente-leitura com todos os dados da etapa. */
function htmlVisualizacaoEtapa(risco, etapa, idxReal, historico) {
  const rf = calcularRiscoFinal(risco, etapa);
  const corRF = corDoRisco(rf);
  const residual = (risco.prob * risco.imp) * (risco.nivelControle || 1);
  const cmp = badgeComparacao(risco, idxReal);
  const numero = (typeof obterNumeroRisco === "function") ? obterNumeroRisco(risco.id) : ("#" + risco.id);

  function campo(rotulo, valorHtml, full) {
    return '<div class="etapa-detalhe-campo' + (full ? ' full' : '') + '">' +
             '<div class="etapa-detalhe-rotulo">' + escapeHTML(rotulo) + '</div>' +
             '<div class="etapa-detalhe-valor">' + (valorHtml || '<span class="etapa-detalhe-vazio">Não informado</span>') + '</div>' +
           '</div>';
  }

  const nivMonLabel = { "1": "Fraco (1,0)", "0.75": "Médio (0,75)", "0.5": "Alto (0,5)" }[etapa.nivelMonitoramento] || "";

  let html = '';
  html += '<div style="margin-bottom:12px;color:#9fb7c1;font-size:12.5px;">' +
            '<i class="bi bi-shield-exclamation"></i> Risco <strong style="color:inherit;">' + escapeHTML(numero) + '</strong> — ' +
            escapeHTML(risco.evento || "") +
          '</div>';

  html += '<div class="etapa-detalhe-final">' +
            '<div class="valor" style="color:' + corRF.cor + ';">' + rf.toFixed(1) + '</div>' +
            '<div>' +
              '<div class="rotulo">Risco final desta etapa (' + corRF.label + ')</div>' +
              '<div style="font-size:11.5px;color:#8fa9b5;">Residual: ' + residual.toFixed(1) +
                (cmp ? ' &nbsp;•&nbsp; ' + cmp : '') +
              '</div>' +
            '</div>' +
          '</div>';

  html += '<div class="etapa-detalhe-grid">';
  html += campo("Opção de Tratamento", etapa.opcao ? escapeHTML(etapa.opcao) : "");
  html += campo("Custo-Benefício", etapa.custoBeneficio ? escapeHTML(etapa.custoBeneficio) : "");
  html += campo("Responsável", etapa.responsavel ? escapeHTML(etapa.responsavel) : "");
  html += campo("Prazo", etapa.prazo ? formatarDataSegura(etapa.prazo) : "");
  html += campo("Nível de Monitoramento", nivMonLabel ? escapeHTML(nivMonLabel) : "");
  html += campo("Status", etapa.concluido ? "Concluído" : (idxReal === historico.length - 1 ? "Em andamento (etapa atual)" : "Substituída por etapa posterior"));
  html += campo("Descrição do Tratamento", etapa.descricao ? escapeHTML(etapa.descricao).replace(/\n/g, "<br>") : "", true);
  html += campo("Observações do Monitoramento", etapa.monitoramento ? escapeHTML(etapa.monitoramento).replace(/\n/g, "<br>") : "", true);
  html += '</div>';

  html += '<div class="etapa-detalhe-metas">' +
            '<i class="bi bi-plus-circle"></i> Criada em <strong>' + formatarDataHora(etapa.criadoEm) + '</strong> por <strong>' + escapeHTML(nomeUsuarioTrat(etapa.criadoPor)) + '</strong>';
  if (etapa.concluido) {
    html += '<br><i class="bi bi-check-circle"></i> Concluída em <strong>' + formatarDataHora(etapa.concluidoEm) + '</strong> por <strong>' + escapeHTML(nomeUsuarioTrat(etapa.concluidoPor)) + '</strong>';
  }
  // 🎯 EDIÇÃO — mostra quem editou a etapa (coluna "edicao" + "editado_por" do Supabase)
  if (etapa.edicao) {
    html += '<br><i class="bi bi-pencil-square"></i> Editada em <strong>' + formatarDataHora(etapa.editadoEm) + '</strong> por <strong>' + escapeHTML(nomeUsuarioTrat(etapa.editadoPor)) + '</strong>';
  }
  html += '</div>';

  const regsPrazo = historicoPrazoDaEtapa(etapa.id);
  if (regsPrazo.length) {
    html += '<div style="margin-top:12px;">' +
              '<div class="etapa-detalhe-rotulo" style="margin-bottom:6px;"><i class="bi bi-calendar-event"></i> Histórico de alterações de prazo</div>';
    regsPrazo.forEach(function(reg) {
      html += '<div class="etapa-hist-prazo">' +
                '<strong>' + formatarDataSegura(reg.de) + ' → ' + formatarDataSegura(reg.para) + '</strong><br>' +
                escapeHTML(reg.motivo || "") +
                (reg.por ? '<br><span style="opacity:.8;">por ' + escapeHTML(reg.por) + '</span>' : '') +
              '</div>';
    });
    html += '</div>';
  }

  // 🎯 RELATO DO QUE FOI EDITADO — coluna "edicao_detalhes" do Supabase.
  // Acumula, em texto, cada edição feita nesta etapa após ela ter sido
  // fechada/concluída (data + autor + campos alterados, de → para).
  if (etapa.edicao && etapa.edicaoDetalhes) {
    html += '<div style="margin-top:12px;">' +
              '<div class="etapa-detalhe-rotulo" style="margin-bottom:6px;"><i class="bi bi-journal-text"></i> Relato do que foi editado</div>' +
              '<div class="etapa-hist-edicao">' + escapeHTML(etapa.edicaoDetalhes) + '</div>' +
            '</div>';
  }

  return html;
}

/** Monta o formulário de edição da etapa (reaproveita os campos do card). */
function htmlFormEdicaoEtapa(risco, etapa, numEt) {
  let opcoesHtml = '<option value="">Selecione...</option>';
  OPCOES_TRATAMENTO.forEach(function(o) {
    opcoesHtml += '<option value="' + o + '"' + (etapa.opcao === o ? ' selected' : '') + '>' + o + '</option>';
  });
  const cbFav = etapa.custoBeneficio === "Favorável" ? " checked" : "";
  const cbDesf = etapa.custoBeneficio === "Desfavorável" ? " checked" : "";
  const nivMon = nivelMonitoramentoStr(etapa.nivelMonitoramento);

  let html = '';
  html += '<div style="margin-bottom:14px;color:#9fb7c1;font-size:12px;">' +
            '<i class="bi bi-info-circle"></i> Você está editando a <strong style="color:inherit;">Etapa ' + numEt + '</strong>. ' +
            'As alterações serão gravadas diretamente nesta etapa do histórico.' +
          '</div>';
  html += '<form id="formEdicaoEtapa" onsubmit="return false;">';

  html += '<div class="row-edt">';
  html += '<div><label>Opção de Tratamento *</label>' +
            '<select class="form-control-dark" id="edtOpcao">' + opcoesHtml + '</select>' +
            '<div id="edtDetalheOpcao">' + htmlDetalheTratamento(etapa.opcao || "") + '</div>' +
          '</div>';
  html += '<div><label>Relação Custo-Benefício *</label>' +
            '<div class="custo-beneficio-row">' +
              '<label class="cb-option"><input type="radio" name="edtCB" value="Favorável"' + cbFav + '><span class="cb-favoravel">Favorável</span></label>' +
              '<label class="cb-option"><input type="radio" name="edtCB" value="Desfavorável"' + cbDesf + '><span class="cb-desfavoravel">Desfavorável</span></label>' +
            '</div>' +
          '</div>';
  html += '</div>';

  html += '<div class="row-edt">';
  html += '<div><label>Responsável *</label>' +
            '<input type="text" class="form-control-dark" id="edtResp" value="' + escapeHTML(etapa.responsavel || "") + '" placeholder="Nome e sobrenome">' +
          '</div>';
  html += '<div><label>Prazo</label>' +
            '<input type="date" class="form-control-dark" id="edtPrazo" value="' + (etapa.prazo || "") + '">' +
          '</div>';
  html += '</div>';

  html += '<div style="margin-bottom:12px;"><label>Descrição do Tratamento *</label>' +
            '<textarea class="form-control-dark" id="edtDesc" rows="3">' + escapeHTML(etapa.descricao || "") + '</textarea>' +
          '</div>';

  html += '<div class="row-edt">';
  html += '<div><label>Nível de Monitoramento</label>' +
            '<select class="form-control-dark" id="edtMonitNivel">' +
              '<option value=""' + (nivMon === "" ? " selected" : "") + '>Selecione...</option>' +
              '<option value="1"' + (nivMon === "1" ? " selected" : "") + '>Fraco (1,0)</option>' +
              '<option value="0.75"' + (nivMon === "0.75" ? " selected" : "") + '>Médio (0,75)</option>' +
              '<option value="0.5"' + (nivMon === "0.5" ? " selected" : "") + '>Alto (0,5)</option>' +
            '</select>' +
          '</div>';
  html += '<div><label>&nbsp;</label>' +
            '<div style="font-size:11.5px;color:#8fa9b5;padding-top:10px;"><i class="bi bi-info-circle"></i> O Risco Final é recalculado ao salvar.</div>' +
          '</div>';
  html += '</div>';

  html += '<div style="margin-bottom:4px;"><label>Observações do Monitoramento</label>' +
            '<textarea class="form-control-dark" id="edtMonit" rows="2">' + escapeHTML(etapa.monitoramento || "") + '</textarea>' +
          '</div>';

  html += '</form>';
  return html;
}

function ativarEdicaoEtapa(riscoId, etapaId) {
  _etapaEmEdicao = { riscoId: riscoId, etapaId: etapaId };
  montarModalEtapa(riscoId, etapaId, "editar");
}

function cancelarEdicaoEtapa(riscoId, etapaId) {
  _etapaEmEdicao = null;
  montarModalEtapa(riscoId, etapaId, "visualizar");
  showToast("Edição cancelada.", "success");
}

/**
 * Salva as alterações feitas no formulário de edição de uma etapa
 * já FECHADA (concluída) do histórico.
 * Reaproveita sbAtualizarEtapa(etapaId, dados) — a mesma função já
 * usada para salvar a etapa atual — bastando informar o id da etapa alvo.
 */
async function salvarEdicaoEtapa(riscoId, etapaId) {
  const achado = localizarRiscoEEtapa(riscoId, etapaId);
  if (!achado) return;
  const risco = achado.risco;
  const etapa = achado.etapa;

  const opcaoEl = document.getElementById("edtOpcao");
  const cbEl = document.querySelector('input[name="edtCB"]:checked');
  const respEl = document.getElementById("edtResp");
  const prazoEl = document.getElementById("edtPrazo");
  const descEl = document.getElementById("edtDesc");
  const monitEl = document.getElementById("edtMonit");
  const monNivEl = document.getElementById("edtMonitNivel");
  if (!opcaoEl || !respEl || !prazoEl || !descEl || !monitEl || !monNivEl) return;

  const opcao = opcaoEl.value;
  const cb = cbEl ? cbEl.value : "";
  const responsavel = respEl.value.trim();
  const prazoNovo = prazoEl.value || "";
  const descricao = descEl.value.trim();
  const monitoramento = monitEl.value.trim();
  const nivelMonitoramento = nivelMonitoramentoStr(monNivEl.value);

  const validacao = validarNomeResponsavel(responsavel);
  if (!validacao.valido) {
    showToast(validacao.mensagem, "error");
    tocarSom("error");
    respEl.focus();
    return;
  }
  if (!opcao || !cb || !descricao) {
    showToast("Preencha Opção, Custo-Benefício e Descrição.", "error");
    tocarSom("error");
    return;
  }

  // 🎯 Mesma regra de segurança do card principal: se esta etapa já
  // tinha um prazo definido e ele está sendo alterado, é obrigatório
  // justificar o motivo antes de gravar.
  const prazoAntigo = etapa.prazo || "";
  const prazoMudou = prazoNovo !== prazoAntigo;
  const exigeJustificativa = !!(etapa.id && prazoAntigo);

  async function persistir(motivoPrazo) {
    const dados = {
      opcao: opcao,
      custoBeneficio: cb,
      responsavel: validacao.nomeFormatado,
      prazo: prazoNovo,
      descricao: descricao,
      monitoramento: monitoramento,
      nivelMonitoramento: nivelMonitoramento
    };

    // 🎯 Monta o relato do que foi alterado (colunas edicao/editado_por/
    // editado_em/edicao_detalhes) comparando os valores antigos da etapa
    // com os novos valores do formulário.
    const mudancas = descreverAlteracoesEtapa(etapa, dados);

    showToast("Salvando alterações da etapa...", "success");
    try {
      const resultado = await sbAtualizarEtapa(etapa.id, dados);
      if (!resultado) throw new Error("Falha ao salvar etapa");

      if (motivoPrazo) {
        await sbRegistrarMotivoPrazo(etapa.id, { motivo: motivoPrazo, prazoAnterior: prazoAntigo });
        let autorPrazo = "";
        try { autorPrazo = (JSON.parse(sessionStorage.getItem("mapa_user") || "{}") || {}).nome || ""; } catch (e) {}
        gravarHistoricoPrazo(etapa.id, {
          de: prazoAntigo, para: prazoNovo, motivo: motivoPrazo,
          por: autorPrazo, quando: new Date().toISOString()
        });
      }

      // 🎯 Marca a etapa como editada (X) e acumula o relato das mudanças.
      if (mudancas.length > 0) {
        let autorEdicao = "";
        try { autorEdicao = (JSON.parse(sessionStorage.getItem("mapa_user") || "{}") || {}).nome || ""; } catch (e) {}
        const agora = new Date();
        const quandoStr = agora.toLocaleDateString("pt-BR") + " " + agora.toLocaleTimeString("pt-BR").substring(0, 5);
        const novoRelato = quandoStr + " - " + (autorEdicao || "Usuário") + ":\n  " + mudancas.join("\n  ");
        const relatoAcumulado = (etapa.edicaoDetalhes ? etapa.edicaoDetalhes + "\n\n" : "") + novoRelato;
        await sbRegistrarEdicaoEtapa(etapa.id, { detalhes: relatoAcumulado });
      }

      const etapas = await sbListarEtapasDoRisco(riscoId);
      risco.tratamento.historico = etapas.map(converterEtapaComEdicao);
      migrarTratamentoSeNecessario(risco);

      registrarLog(
        "editar_etapa_historico",
        riscoId,
        "Editou etapa do histórico em " + (typeof obterNumeroRisco === "function" ? obterNumeroRisco(riscoId) : ("#" + riscoId)) +
        (mudancas.length ? " | Alterações: " + mudancas.join("; ") : "") +
        (motivoPrazo ? " | Motivo do prazo: " + motivoPrazo : "")
      );

      showToast("Etapa atualizada com sucesso!", "success");
      tocarSom("success");
      _etapaEmEdicao = null;
      fecharModalDetalheEtapa();
      renderizarTratamentos();
      atualizarKPIsTratamento();
    } catch (e) {
      console.error("[salvarEdicaoEtapa]", e);
      showToast("Erro ao salvar: " + e.message, "error");
      tocarSom("error");
    }
  }

  if (prazoMudou && exigeJustificativa) {
    const numero = (typeof obterNumeroRisco === "function") ? obterNumeroRisco(riscoId) : ("#" + riscoId);
    abrirModalPrazo(
      { de: prazoAntigo, para: prazoNovo, numero: numero, evento: risco.evento || "" },
      function confirmou(motivo) { persistir(motivo); },
      function cancelou() { showToast("Alteração de prazo cancelada — a etapa não foi salva.", "error"); }
    );
    return;
  }

  await persistir(null);
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
  // Atualiza o badge "Final:" do cabeçalho do card
  const card = document.querySelector('.tratamento-card[data-risco-id="' + riscoId + '"]');
  if (card) {
    card.style.setProperty("--cor-risco", c.cor);
    const badge = card.querySelector(".badge-risco-final");
    if (badge) {
      badge.innerHTML = '<i class="bi bi-bullseye"></i> Final: ' + final.toFixed(1);
      badge.style.background = c.cor + "20";
      badge.style.color = c.cor;
      badge.style.borderColor = c.cor + "60";
    }
    // Reposiciona a célula que pisca na mini-matriz, ao vivo
    const mini = card.querySelector(".mini-matriz");
    const risco = (typeof riscos !== "undefined" && Array.isArray(riscos))
      ? riscos.find(function(x) { return String(x.id) === String(riscoId); })
      : null;
    if (mini && risco) {
      const novo = document.createElement("div");
      novo.innerHTML = gerarMiniMatriz(risco, final);
      const substituto = novo.firstChild;
      if (substituto) mini.replaceWith(substituto);
    }
  }
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
// ============ SALVAR — grava na etapa atual ============
async function salvarTratamento(riscoId) {
  const idx = riscos.findIndex(r => r.id === riscoId);
  if (idx < 0) return;
  const risco = riscos[idx];
  migrarTratamentoSeNecessario(risco);
  const opcao = document.getElementById("opcao-" + riscoId).value;
  const cbEl = document.querySelector('input[name="cb-' + riscoId + '"]:checked');
  const cb = cbEl ? cbEl.value : "";
  const responsavelInput = document.getElementById("resp-" + riscoId);
  const responsavel = responsavelInput ? responsavelInput.value.trim() : "";
  const prazoInput = document.getElementById("prazo-" + riscoId);
  const prazo = prazoInput ? prazoInput.value : "";
  const descricao = document.getElementById("desc-" + riscoId).value.trim();
  const monitoramento = document.getElementById("monit-" + riscoId).value.trim();
  // 🎯 normaliza o nível antes de mandar para o banco
  const nivelMonitoramento = nivelMonitoramentoStr(
    document.getElementById("monitorNivel-" + riscoId).value
  );
  // ============================================================
  // 🎯 VERIFICAÇÃO DE ETAPA — alteração de prazo
  // Rede de segurança: se o prazo mudou numa etapa já salva e
  // completa e a justificativa não foi dada (ex.: data colada,
  // autofill), o salvamento é bloqueado e o modal é aberto.
  // ============================================================
  const chavePrazo = String(riscoId);
  const etapaAtualPrazo = obterEtapaAtual(risco) || {};
  const prazoAntigo = _prazoOriginalTrat[chavePrazo] || "";
  const pendentePrazo = _justificativaPrazoPendente[chavePrazo];
  const prazoMudou = prazo !== prazoAntigo;
  const exigeJustificativa = etapaCompletaSalva(etapaAtualPrazo);
  if (prazoMudou && exigeJustificativa && !pendentePrazo) {
    showToast("Justifique a alteração do prazo antes de salvar.", "error");
    tocarSom("error");
    if (prazoInput) tratarMudancaPrazo(riscoId, prazoInput);
    return;
  }
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
    risco.tratamento.historico = etapas.map(converterEtapaComEdicao);
    // 🎯 Garante que o valor recém-salvo já esteja no formato do <select>
    migrarTratamentoSeNecessario(risco);
    // ============================================================
    // 🎯 Persiste o registro da alteração de prazo
    // ============================================================
    if (prazoMudou && pendentePrazo) {
      let autor = "";
      try {
        autor = (JSON.parse(sessionStorage.getItem("mapa_user") || "{}") || {}).nome || "";
      } catch (e) {}
      const etapaAtualizada = obterEtapaAtual(risco) || {};
      const idEtapa = etapaAtualizada.id || pendentePrazo.etapaId;
      // 🎯 AJUSTE: grava o motivo na PROPRIA etapa, no Supabase.
      // Antes ficava so no localStorage e no texto do log — quem
      // abrisse em outra maquina nao via a justificativa.
      // Requer o script 01_criar_coluna_motivo_prazo.sql.
      await sbRegistrarMotivoPrazo(idEtapa, {
        motivo: pendentePrazo.motivo,
        prazoAnterior: pendentePrazo.de
      });
      // Mantido: cache local usado para exibir na timeline offline.
      gravarHistoricoPrazo(idEtapa, {
        de: pendentePrazo.de,
        para: pendentePrazo.para,
        motivo: pendentePrazo.motivo,
        por: autor,
        quando: pendentePrazo.quando
      });
      // Recarrega para a timeline ja mostrar o motivo vindo do banco
      const etapasAtualizadas = await sbListarEtapasDoRisco(riscoId);
      risco.tratamento.historico = etapasAtualizadas.map(converterEtapaComEdicao);
      migrarTratamentoSeNecessario(risco);
      registrarLog(
        "alterar_prazo",
        riscoId,
        "Prazo alterado em " + obterNumeroRisco(riscoId) + ": " +
        formatarDataSegura(pendentePrazo.de) + " → " + formatarDataSegura(pendentePrazo.para) +
        " | Motivo: " + pendentePrazo.motivo
      );
      delete _justificativaPrazoPendente[chavePrazo];
      _prazoOriginalTrat[chavePrazo] = pendentePrazo.para;
      limparMarcaPrazoAlterado(prazoInput);
      showToast("Prazo alterado e justificativa registrada no log.", "success");
    }
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
// ============ MARCAR COMO CONCLUÍDO ============
async function marcarConcluido(riscoId) {
  const risco = riscos.find(r => r.id === riscoId);
  if (!risco) return;
  const etapaAtual = obterEtapaAtual(risco);
  if (!etapaAtual || !etapaAtual.opcao) {
    showToast("Salve o plano antes de concluir.", "error");
    tocarSom("error");
    return;
  }
  // 🎯 Não deixa concluir com alteração de prazo pendente de salvar
  if (_justificativaPrazoPendente[String(riscoId)]) {
    showToast("Salve a etapa antes de concluir — há alteração de prazo pendente.", "error");
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
      // 🎯 normaliza o nível (mantém o que já estava salvo se o campo sumir)
      nivelMonitoramento: nivelMonitoramentoStr(
        monNivEl ? monNivEl.value : etapaAtual.nivelMonitoramento
      )
    };
    await sbAtualizarEtapa(etapaAtual.id, dadosSalvar);
    // Marca como concluída
    const resultado = await sbConcluirEtapa(etapaAtual.id);
    if (!resultado) throw new Error("Falha ao concluir");
    // Recarrega etapas
    const etapas = await sbListarEtapasDoRisco(riscoId);
    risco.tratamento.historico = etapas.map(converterEtapaComEdicao);
    migrarTratamentoSeNecessario(risco);
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
// ============ REABRIR — cria NOVA etapa (prazo zerado) ============
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
    risco.tratamento.historico = etapas.map(converterEtapaComEdicao);
    migrarTratamentoSeNecessario(risco);
    // 🎯 Etapa nova: zera o controle de prazo deste risco
    delete _justificativaPrazoPendente[String(riscoId)];
    _prazoOriginalTrat[String(riscoId)] = "";
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
  const idsSelecionados = new Set(
    processosDisponiveisTrat()
      .filter(function(p) { return processosSelecionadosTrat.has(String(p.id)); })
      .map(function(p) { return String(p.id); })
  );
  const lista = todosRiscosTrat().filter(function(r) {
    return idsSelecionados.has(String(r.processoId)) && riscoEhTratavelTrat(r);
  });
  total = lista.length;
  lista.forEach(function(r) {
    const st = calcularStatusTratamento(r);
    if (st.estado === "planejado") planejados++;
    else if (st.estado === "concluido") concluidos++;
    else if (st.estado === "atraso") atrasados++;
    else pendentes++;
  });
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
    labels[1].textContent = "Concluídos";
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
// ============ EXPORT PDF ============
// IMPORTANTE: este arquivo deve ser carregado DEPOIS de riscos.js.
// Esta versão sobrescreve o PDF geral e aplica Tratar = Sim.
async function exportarTratamentoPDF() {
  if (typeof html2canvas === "undefined" || typeof window.jspdf === "undefined") {
    showToast("Bibliotecas de PDF não carregadas.", "error");
    return;
  }
  // 🆕 Agora percorre TODOS os processos da divisão, e não apenas o selecionado
  // Processos explicitamente selecionados no seletor múltiplo.
  // Se o seletor ainda não foi iniciado, mantém o comportamento anterior.
  const processosDaDivisao = processosDisponiveisTrat().filter(function(p) {
    return processosSelecionadosTrat.size === 0 ||
           processosSelecionadosTrat.has(String(p.id));
  });
  if (processosDaDivisao.length === 0) {
    showToast("Nenhum registro cadastrado nesta divisão.", "error");
    tocarSom("error");
    return;
  }
  showToast("Gerando PDF... aguarde", "success");
  try {
    // 🆕 GARANTE QUE O PLANO DE TRATAMENTO VENHA PREENCHIDO NO PDF.
    // ----------------------------------------------------------------
    // As etapas (opção, responsável, prazo, descrição, monitoramento)
    // ficam na tabela tratamento_etapas. A tela carrega essas etapas ao
    // renderizar os cards, mas a exportação pode ocorrer antes/depois de
    // um refresh parcial -- e então os riscos chegam aqui sem
    // tratamento.historico, fazendo TODA coluna sair como "—" com status
    // "Pendente". Recarregamos risco a risco, com o mesmo converter que
    // a tela usa (é ele que traduz custo_beneficio -> custoBeneficio e
    // nivel_monitoramento -> nivelMonitoramento).
    if (typeof sbListarEtapasDoRisco === "function") {
      try {
        const alvoRecarga = todosRiscosTrat().filter(function (r) {
          return String(r.tratar || "").trim().toLowerCase() === "sim";
        });
        showToast("Carregando planos de tratamento...", "success");

        for (let i = 0; i < alvoRecarga.length; i++) {
          const r = alvoRecarga[i];
          try {
            const linhas = await sbListarEtapasDoRisco(r.id);
            const convertidas = (linhas || []).map(function (row) {
              if (typeof converterEtapaComEdicao === "function") return converterEtapaComEdicao(row);
              if (typeof sbConverterEtapa === "function") return sbConverterEtapa(row);
              return row;
            }).filter(function (e) { return !!e; });

            if (!r.tratamento || typeof r.tratamento !== "object") r.tratamento = {};
            r.tratamento.historico = convertidas;

            if (typeof migrarTratamentoSeNecessario === "function") {
              migrarTratamentoSeNecessario(r);
            }
          } catch (eRisco) {
            console.warn("[PDF] Não consegui carregar as etapas do risco " + r.id + ":", eRisco);
          }
        }

        console.log("[PDF] Planos de tratamento carregados para " + alvoRecarga.length + " risco(s).");

        try {
          const diag = alvoRecarga.map(function (r) {
            const et = (r.tratamento && r.tratamento.historico) || [];
            const ultima = et.length ? et[et.length - 1] : null;
            return {
              risco: (typeof obterNumeroRisco === "function" ? obterNumeroRisco(r.id) : r.id),
              tratar: r.tratar,
              etapas: et.length,
              opcao: ultima ? (ultima.opcao || "(vazio)") : "-",
              responsavel: ultima ? (ultima.responsavel || "(vazio)") : "-",
              prazo: ultima ? (ultima.prazo || "(vazio)") : "-"
            };
          });
          console.log("[PDF] Situacao do tratamento dos riscos que entram no relatorio:");
          if (console.table) console.table(diag); else console.log(diag);
        } catch (eDiag) { /* diagnostico nunca deve travar a exportacao */ }
      } catch (e) {
        console.warn("[PDF] Não foi possível carregar os planos de tratamento:", e);
      }
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
    // HELPER: header
    // ==========================================
    async function renderizarHeader(proc) {
      const headerContainer = document.createElement("div");
      headerContainer.style.cssText =
        "position:absolute;left:-99999px;top:0;width:" + LARGURA_PX + "px;" +
        "background:#ffffff;color:#1a2b3d;font-family:'Segoe UI',Tahoma,sans-serif;" +
        "padding:30px 35px 15px;box-sizing:border-box;display:block;";
      const divisaoRelatorio = divisaoDoProcessoTrat(proc) ||
        (Array.from(divisoesSelecionadasTrat)[0] || normalizarDivTrat(user.divisao));
      headerContainer.appendChild(criarCabecalho(proc, {
        nome: user.nome,
        matricula: user.matricula,
        divisao: divisaoRelatorio
      }, dataHoje));
      document.body.appendChild(headerContainer);
      await new Promise(function(r) { setTimeout(r, 200); });
      const headerCanvas = await html2canvas(headerContainer, {
        scale: 2, backgroundColor: "#ffffff",
        useCORS: true, logging: false,
        width: LARGURA_PX, windowWidth: LARGURA_PX
      });
      document.body.removeChild(headerContainer);
      return headerCanvas;
    }
    // ==========================================
    // HELPER: numeração do risco dentro do processo
    // (substitui obterNumeroRisco, que dependia de processoAtualId)
    // ==========================================
    function numeroDoRiscoNoProcesso(riscoId, riscosDoRegistro) {
      const ordenadosPorNivel = riscosDoRegistro.slice().sort(function(a, b) {
        return (b.prob * b.imp) - (a.prob * a.imp);
      });
      const idx = ordenadosPorNivel.findIndex(function(r) { return r.id === riscoId; });
      // 🎯 Usa o MESMO codigo da tela (P01-R01), quando disponivel.
      if (typeof obterNumeroRisco === "function") {
        const cod = obterNumeroRisco(riscoId);
        if (cod && cod.indexOf("??") < 0) return cod;
      }
      return idx >= 0 ? formatarIdRisco(idx + 1) : "R??";
    }
    // ==========================================
    // 🆕 CAPA: cards de indicadores + lista de processos
    // ==========================================
    function montarCapaHTML(resumo, totais) {
      const cards = [
        { valor: totais.processos, rotulo: "PROCESSOS DE TRABALHO MAPEADOS",   cor: "#0e9aa7" },
        { valor: totais.riscos,    rotulo: "RISCOS IDENTIFICADOS", cor: "#1a2b3d" },
        { valor: totais.aTratar,   rotulo: "RISCOS A TRATAR",      cor: "#d4a017" },
        { valor: totais.altos,     rotulo: "RESIDUAL ALTO",        cor: "#c04040" },
        { valor: totais.planos,    rotulo: "PLANOS DE TRATAMENTO", cor: "#2eb87a" }
      ];
      const cardsHTML = cards.map(function(c) {
        return '<div style="flex:1;background:#f9fbfc;border:1px solid #e6ecf1;border-radius:8px;' +
                           'border-top:5px solid ' + c.cor + ';padding:18px 10px;text-align:center;">' +
                 '<div style="font-size:30px;font-weight:800;color:' + c.cor + ';line-height:1.1;">' +
                   c.valor +
                 '</div>' +
                 '<div style="font-size:11px;color:#8a9ba8;font-weight:600;letter-spacing:0.5px;' +
                             'text-transform:uppercase;margin-top:8px;">' +
                   c.rotulo +
                 '</div>' +
               '</div>';
      }).join("");
      const linhas = resumo.map(function(l, idx) {
        const bg = idx % 2 === 0 ? "#ffffff" : "#f9fbfc";
        return '<tr style="background:' + bg + ';">' +
          '<td style="padding:9px 8px;border:1px solid #d4dde3;text-align:center;font-weight:700;color:#0e9aa7;">' + l.codigo + '</td>' +
          '<td style="padding:9px 8px;border:1px solid #d4dde3;">' + escapeHTML(l.nome) + '</td>' +
          '<td style="padding:9px 8px;border:1px solid #d4dde3;">' + escapeHTML(l.unidade) + '</td>' +
          '<td style="padding:9px 8px;border:1px solid #d4dde3;">' + escapeHTML(l.objetivo) + '</td>' +
          '<td style="padding:9px 8px;border:1px solid #d4dde3;text-align:center;">' + l.qtdRiscos + '</td>' +
          '<td style="padding:9px 8px;border:1px solid #d4dde3;text-align:center;font-weight:700;">' + l.qtdTratar + '</td>' +
          '<td style="padding:9px 8px;border:1px solid #d4dde3;text-align:center;">' + l.qtdPlanos + '</td>' +
        '</tr>';
      }).join("");
      return '<div style="display:flex;gap:12px;margin-bottom:26px;">' + cardsHTML + '</div>' +
        '<div style="display:flex;align-items:flex-start;gap:9px;margin-bottom:6px;">' +
          '<div style="width:5px;height:34px;background:#0e9aa7;border-radius:2px;flex-shrink:0;"></div>' +
          '<div>' +
            '<div style="font-size:17px;font-weight:700;color:#0e9aa7;line-height:1.3;">' +
              'Processos de Trabalho mapeados na divisão' +
            '</div>' +
            '<div style="font-size:12px;color:#8a9ba8;margin-top:3px;">' +
              'Cada processo de trabalho é detalhado nas páginas seguintes, com seus riscos e respectivos planos de tratamento.' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<table style="width:100%;border-collapse:collapse;font-size:13px;background:#ffffff;margin-top:14px;">' +
          '<thead style="background:#0e9aa7;color:#ffffff;"><tr>' +
            '<th style="padding:9px 8px;border:1px solid #0e9aa7;text-align:center;">Código</th>' +
            '<th style="padding:9px 8px;border:1px solid #0e9aa7;text-align:left;">Processo de trabalho</th>' +
            '<th style="padding:9px 8px;border:1px solid #0e9aa7;text-align:left;">Unidade</th>' +
            '<th style="padding:9px 8px;border:1px solid #0e9aa7;text-align:left;">Objetivo</th>' +
            '<th style="padding:9px 8px;border:1px solid #0e9aa7;text-align:center;">Riscos</th>' +
            '<th style="padding:9px 8px;border:1px solid #0e9aa7;text-align:center;">A tratar</th>' +
            '<th style="padding:9px 8px;border:1px solid #0e9aa7;text-align:center;">Planos</th>' +
          '</tr></thead>' +
          '<tbody>' + linhas + '</tbody>' +
        '</table>';
    }
    // ==========================================
    // 🆕 FAIXA DE IDENTIFICAÇÃO DO PROCESSO
    // ==========================================
    function montarFaixaProcessoHTML(codigo, nomeProcesso, indice, total) {
      return '<div style="background:#1a3352;border-radius:4px;padding:12px 18px;' +
                    'display:flex;align-items:center;justify-content:space-between;">' +
          '<div style="font-size:15px;font-weight:700;color:#ffffff;">' +
            codigo + '&nbsp;&nbsp;|&nbsp;&nbsp;' + escapeHTML(nomeProcesso) +
          '</div>' +
          '<div style="font-size:11px;color:#c9d6e0;font-weight:500;">' +
            'Processo de Trabalho ' + indice + ' de ' + total +
          '</div>' +
        '</div>';
    }
    // ==========================================
    // MONTA OS BLOCOS DE UM PROCESSO
    // ==========================================
    function montarBlocosDoProcesso(proc, riscosT) {
      // ---------- INFO DO PROCESSO ----------
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
          // 🆕 O cabeçalho do processo passa a exibir SOMENTE os cinco
          // campos definidos. Saíram: Resultado, Clientes / Demandantes
          // e Data. "Processo" virou "Processo de Trabalho".
          '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px 28px;align-items:start;">' +
            campo("Unidade",                          dashOrValue(proc.unidade || proc.equipe)) +
            campo("Processo de Trabalho",             dashOrValue(proc.processo)) +
            campo("Objetivo",                         dashOrValue(proc.objetivo)) +
            campo("Áreas Envolvidas",                 areasHtml) +
            campo("Macroprocesso da Cadeia de Valor", dashOrValue(proc.macroprocesso)) +
          '</div>' +
        '</div>';
      // ---------- TABELA: RISCOS A TRATAR ----------
      const ordenados = riscosT.slice().sort(function(a, b) {
        return (b.prob * b.imp) - (a.prob * a.imp);
      });
      const headerTabelaRiscos =
        '<thead style="background:#f5f8fa;color:#0e9aa7;"><tr>' +
          '<th style="padding:8px;border:1px solid #d4dde3;" rowspan="2">Código</th>' +
          '<th style="padding:8px;border:1px solid #d4dde3;" colspan="3">Riscos Identificados</th>' +
          '<th style="padding:8px;border:1px solid #d4dde3;" colspan="3">Análise</th>' +
          '<th style="padding:8px;border:1px solid #d4dde3;" colspan="2">Controles</th>' +
          '<th style="padding:8px;border:1px solid #d4dde3;" rowspan="2">Residual</th>' +
          // 🆕 Coluna "Prioritário?" substituída por "Tratar".
          '<th style="padding:8px;border:1px solid #d4dde3;" rowspan="2">Tratar</th>' +
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
        const numero = numeroDoRiscoNoProcesso(r.id, riscosT);
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
          // 🆕 Passa a mostrar o campo "tratar" do risco, e não mais o "prioritario".
          '<td style="padding:8px;border:1px solid #d4dde3;text-align:center;">' +
            (String(r.tratar || "").trim().toLowerCase() === "sim" ? "Sim" : "Não") +
          '</td>' +
        '</tr>';
      });
      // ---------- TABELA: PLANO DE TRATAMENTO ----------
      // 🆕 CRITÉRIO DE ENTRADA: todos os riscos com Tratar = "Sim".
      // Diferente do relatório de riscos (index), aqui NÃO há corte por
      // nível residual nem exceção por divisão -- esta é a tela de
      // tratamento, então todo risco marcado para tratar deve constar,
      // inclusive os que ainda estão pendentes de preenchimento.
      const riscosParaTratamento = riscosT.filter(function (r) {
        return String(r.tratar || "").trim().toLowerCase() === "sim";
      });

      const ordenadosPlano = riscosParaTratamento.slice().sort(function(a, b) {
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
      // 🆕 CABEÇALHO EM DOIS NÍVEIS, no mesmo padrão da tabela de riscos
      // (onde "Riscos Identificados" agrupa Evento/Causa/Consequência).
      // Aqui "Implementação" agrupa Responsável e Prazo, que descem para
      // a segunda linha. As demais colunas ocupam as duas linhas via
      // rowspan. Descrição e Monitoramento ganharam nomes explícitos.
      const headerTabelaTrat =
        '<thead style="background:#e6f5f0;color:#2eb87a;"><tr>' +
          '<th style="padding:8px;border:1px solid #b7e0d3;" rowspan="2">Código</th>' +
          '<th style="padding:8px;border:1px solid #b7e0d3;" rowspan="2">Evento</th>' +
          '<th style="padding:8px;border:1px solid #b7e0d3;" rowspan="2">Status</th>' +
          '<th style="padding:8px;border:1px solid #b7e0d3;" rowspan="2">Opção</th>' +
          '<th style="padding:8px;border:1px solid #b7e0d3;" rowspan="2">Custo-Benef.</th>' +
          '<th style="padding:8px;border:1px solid #b7e0d3;" colspan="2">Implementação</th>' +
          '<th style="padding:8px;border:1px solid #b7e0d3;" rowspan="2">Descrição do Tratamento</th>' +
          '<th style="padding:8px;border:1px solid #b7e0d3;" rowspan="2">Monitoramento do Tratamento</th>' +
          '<th style="padding:8px;border:1px solid #b7e0d3;" rowspan="2">Risco Final</th>' +
        '</tr><tr>' +
          '<th style="padding:6px;border:1px solid #b7e0d3;">Responsável</th>' +
          '<th style="padding:6px;border:1px solid #b7e0d3;">Prazo</th>' +
        '</tr></thead>';
      const linhasTratamento = ordenadosPlano.map(function(r, idx) {
        const etapas = (r.tratamento && r.tratamento.historico)
          || (r.tratamento && r.tratamento.opcao ? [r.tratamento] : []);
        const trat = etapas.length > 0 ? etapas[etapas.length - 1] : {};
        const numero = numeroDoRiscoNoProcesso(r.id, riscosT);
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
        // 🆕 O selo "PRIORITÁRIO" foi removido: o conceito saiu do
        // relatório junto com a coluna equivalente na tabela de riscos
        // (agora "Tratar"). Além disso, todo risco que chega aqui já tem
        // Tratar = "Sim", então o selo não diferenciava nada.
        const marcaPrioritario = "";
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
      // ---------- MATRIZ (com tratamento) ----------
      const riscosParaMatriz = riscosT.map(function(r) {
        const clone = Object.assign({}, r);
        const etapas = (r.tratamento && r.tratamento.historico)
          || (r.tratamento && r.tratamento.opcao ? [r.tratamento] : []);
        const trat = etapas.length > 0 ? etapas[etapas.length - 1] : null;
        if (trat && trat.nivelMonitoramento) {
          const fatorMon = parseFloat(trat.nivelMonitoramento);
          clone.nivelControle = (r.nivelControle || 1) * fatorMon;
        }
        // Numeracao correta do risco DENTRO deste processo
        clone._numeroPDF = numeroDoRiscoNoProcesso(r.id, riscosT);
        return clone;
      });
      const matrizHTML =
        '<h2 style="font-size:16px;color:#0e9aa7;margin:0 0 15px;padding-bottom:8px;border-bottom:2px solid #0e9aa7;">Matriz de Risco (com Tratamento)</h2>' +
        '<div style="max-width:100%;margin:0 auto;padding:15px;">' +
          construirMatrizHTMLClara(riscosParaMatriz) +
        '</div>';
      // ---------- MONTA OS BLOCOS ----------
      const blocos = [];
      // 🆕 Faixa de identificação do processo
      blocos.push({
        // 🆕 A faixa mostra a DIVISÃO antes do código ("AT · P01"). Com
        // várias divisões no mesmo PDF, cada uma tem seu próprio P01 e,
        // sem a sigla, o agrupamento por divisão não ficava visível.
        html: montarFaixaProcessoHTML(
                (proc._divisaoPDF ? proc._divisaoPDF + " · " : "") + proc._codigoPDF,
                proc.processo || "—",
                                      proc._indicePDF, proc._totalPDF),
        isolada: false
      });
      blocos.push({ html: infoProcessoHTML, isolada: false });
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
      blocos.push({
        html: matrizHTML,
        isolada: true,
        forcaNovaPagina: true
      });
      return blocos;
    }
    // ==========================================
    // 🆕 SELECIONA OS PROCESSOS QUE ENTRAM NO PDF
    // ==========================================
    const processosComRisco = [];
    processosDaDivisao.forEach(function(proc) {
      // PAGINA DE TRATAMENTO: somente riscos com Tratar = Sim
      const riscosT = todosRiscosTrat().filter(function(r) {
        return String(r.processoId) === String(proc.id) &&
               riscoEhTratavelTrat(r);
      });
      // Processo sem riscos a tratar nao entra no PDF
      if (riscosT.length === 0) return;
      processosComRisco.push({ proc: proc, riscosT: riscosT });
    });
    if (processosComRisco.length === 0) {
      showToast("Nenhum risco marcado para tratamento nesta divisão.", "error");
      tocarSom("error");
      return;
    }
    // 🎯 Ordena pelo codigo do processo (P01, P02, ... P06),
    // para a capa e as secoes seguirem a sequencia da tela.
    // 🆕 ORDEM POR DIVISÃO: primeiro todos os processos de AA, depois
    // todos de AT, e assim por diante (ordem alfabética da sigla). Dentro
    // de cada divisão, segue o código do processo (P01, P02...).
    // Chave de divisão robusta: usa a sigla do processo; se vier vazia,
    // tenta extrair do campo Unidade ("SEPREC - DPP" -> "DPP"). Processos
    // sem divisão identificável vão para o final.
    function chaveDivisaoPDF(proc) {
      let d = divisaoDoProcessoTrat(proc);
      if (!d) {
        const u = String(proc.unidade || proc.equipe || "");
        const m = u.match(/-\s*([A-Za-z]{2,6})\s*$/);
        if (m) d = m[1].toUpperCase();
      }
      return d || "\uFFFF";
    }

    processosComRisco.sort(function(a, b) {
      const da = chaveDivisaoPDF(a.proc), db = chaveDivisaoPDF(b.proc);
      if (da !== db) return da.localeCompare(db, "pt-BR");
      if (typeof numeroDoProcesso === "function") {
        return numeroDoProcesso(a.proc.id)
          .localeCompare(numeroDoProcesso(b.proc.id), "pt-BR", { numeric: true });
      }
      return String(a.proc.processo || "").localeCompare(String(b.proc.processo || ""), "pt-BR");
    });
    console.log("[PDF] Ordem dos processos no relatório:",
      processosComRisco.map(function (it) {
        return chaveDivisaoPDF(it.proc) + " | " + (it.proc.processo || it.proc.id);
      }));

    // 🆕 Numera os processos e calcula os totais da capa
    const resumoProcessos = [];
    let totalRiscos = 0, totalATratar = 0, totalAltos = 0, totalPlanos = 0;
    processosComRisco.forEach(function(item, i) {
      const proc = item.proc;
      // 🎯 Mesmo codigo da tela e do PDF de riscos: P06 continua P06.
      // Antes era um contador do proprio PDF (P01, P02...), o que gerava
      // conflito com o codigo do risco (P06-R01) na mesma pagina.
      proc._codigoPDF = (typeof numeroDoProcesso === "function")
        ? numeroDoProcesso(proc.id)
        : ("P" + String(i + 1).padStart(2, "0"));
      proc._divisaoPDF = chaveDivisaoPDF(proc) === "\uFFFF" ? "" : chaveDivisaoPDF(proc);
      proc._indicePDF = i + 1;
      proc._totalPDF  = processosComRisco.length;
      // No PDF de tratamento, os totais da capa também consideram
      // somente os riscos marcados com Tratar = Sim.
      const todosDoProcesso = item.riscosT;
      let planosDoProcesso = 0;
      let aTratarDoProcesso = 0;
      todosDoProcesso.forEach(function(r) {
        const residual = r.prob * r.imp * (r.nivelControle || 1);
        if (residual >= 20) totalAltos++;
        if (String(r.tratar).toLowerCase() === "sim") aTratarDoProcesso++;
        const etapas = (r.tratamento && r.tratamento.historico)
          || (r.tratamento && r.tratamento.opcao ? [r.tratamento] : []);
        planosDoProcesso += etapas.length;
      });
      totalRiscos  += todosDoProcesso.length;
      totalATratar += aTratarDoProcesso;
      totalPlanos  += planosDoProcesso;
      resumoProcessos.push({
        codigo: proc._codigoPDF,
        nome: proc.processo || "—",
        unidade: proc.unidade || proc.equipe || "—",
        objetivo: proc.objetivo || "—",
        qtdRiscos: todosDoProcesso.length,
        qtdTratar: aTratarDoProcesso,
        qtdPlanos: planosDoProcesso
      });
    });
    // ==========================================
    // 🆕 RENDERIZA A CAPA
    // ==========================================
    // 🆕 CAPA REMOVIDA. Antes a primeira página trazia os cards de KPI
    // (processos mapeados, riscos identificados, residual alto...) e a
    // tabela "Processos mapeados na divisão". O relatório agora começa
    // direto no primeiro processo de trabalho.
    // montarCapaHTML() permanece definida, mas deixa de ser usada.

    // ==========================================
    // 🆕 RENDERIZA CADA PROCESSO
    // ==========================================
    const secoes = [];
    for (let p = 0; p < processosComRisco.length; p++) {
      const proc = processosComRisco[p].proc;
      const riscosT = processosComRisco[p].riscosT;
      showToast("Preparando " + (p + 1) + " de " + processosComRisco.length + "...", "success");
      const headerCanvas = await renderizarHeader(proc);
      const blocos = montarBlocosDoProcesso(proc, riscosT);
      for (let i = 0; i < blocos.length; i++) {
        blocos[i].canvas = await renderizarBlocoParaCanvas(blocos[i].html, 10);
      }
      secoes.push({
        proc: proc,
        headerCanvas: headerCanvas,
        headerImg: headerCanvas.toDataURL("image/png"),
        blocos: blocos
      });
    }
    // 🆕 Sem capa: o PDF começa no primeiro processo de trabalho.
    // ==========================================
    // MONTA PDF
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
    let primeiraPagina = true;
    for (let s = 0; s < secoes.length; s++) {
      const secao = secoes[s];
      const headerCanvas = secao.headerCanvas;
      const headerImg = secao.headerImg;
      const headerAlturaMM = (headerCanvas.height * larguraDisponivel) / headerCanvas.width;
      const espacoInicial = margem + headerAlturaMM + 5;
      function adicionarHeader() {
        pdf.addImage(headerImg, "PNG", margem, margem, larguraDisponivel, headerAlturaMM, undefined, "FAST");
      }
      // Cada processo começa em uma página nova
      if (!primeiraPagina) {
        pdf.addPage("a4", "landscape");
      }
      primeiraPagina = false;
      let currentY = espacoInicial;
      adicionarHeader();
      for (let i = 0; i < secao.blocos.length; i++) {
        const bloco = secao.blocos[i];
        const alturaBlocoMM = (bloco.canvas.height * larguraDisponivel) / bloco.canvas.width;
        if (bloco.forcaNovaPagina && currentY > espacoInicial) {
          pdf.addPage("a4", "landscape");
          adicionarHeader();
          currentY = espacoInicial;
        }
        if (currentY + alturaBlocoMM > pageHeight - margem) {
          pdf.addPage("a4", "landscape");
          adicionarHeader();
          currentY = espacoInicial;
        }
        pdf.addImage(
          bloco.canvas.toDataURL("image/png"), "PNG",
          margem, currentY,
          larguraDisponivel, alturaBlocoMM,
          undefined, "FAST"
        );
        currentY += alturaBlocoMM + 5;
      }
    }
    // 🆕 RODAPÉ DE TODAS AS PÁGINAS
    //   esquerda ...: Secretaria de Gestão de Precatórios
    //   centro .....: Página X de Y
    //   direita ....: Gerado em / Por / Matrícula
    // As informações de geração saíram do cabeçalho (onde apareciam só no
    // topo de cada seção) e agora constam em todas as páginas.
    const totalPaginas = pdf.internal.getNumberOfPages();
    const rodapeGeracao = "Gerado em: " + dataHoje +
                          "  |  Por: " + user.nome +
                          "  |  Matrícula: " + user.matricula;

    for (let p = 1; p <= totalPaginas; p++) {
      pdf.setPage(p);
      pdf.setFontSize(8);
      pdf.setTextColor(120, 120, 120);

      pdf.text("Secretaria de Gestão de Precatórios", margem, pageHeight - 2, { align: "left" });

      pdf.text(
        "Página " + p + " de " + totalPaginas,
        pageWidth / 2,
        pageHeight - 2,
        { align: "center" }
      );

      pdf.text(rodapeGeracao, pageWidth - margem, pageHeight - 2, { align: "right" });
    }
    // 🆕 NOME DO ARQUIVO PELAS DIVISÕES REALMENTE PRESENTES NO PDF.
    // A sigla vem dos PROCESSOS que entraram no relatório:
    //   - uma única divisão -> usa a sigla dela (ex.: DPP)
    //   - mais de uma       -> usa SEPREC, que as engloba
    // ("MULTIDIVISAO" foi substituído por SEPREC, conforme solicitado.)
    const siglasNoPdf = [];
    processosComRisco.forEach(function (item) {
      const d = divisaoDoProcessoTrat(item.proc);
      if (d && siglasNoPdf.indexOf(d) === -1) siglasNoPdf.push(d);
    });

    let siglaArq;
    if (siglasNoPdf.length === 1) {
      siglaArq = siglasNoPdf[0];
    } else if (siglasNoPdf.length > 1) {
      siglaArq = "SEPREC";
    } else {
      const selecionadas = Array.from(divisoesSelecionadasTrat).sort();
      siglaArq = selecionadas.length === 1 ? selecionadas[0]
               : (selecionadas.length > 1 ? "SEPREC" : "DIVISAO");
    }

    const nomeArq = "Mapa_de_Riscos_" + siglaArq +
                    "_" + new Date().toISOString().substring(0, 10) + ".pdf";
    pdf.save(nomeArq);
    registrarLog("exportar_pdf_tratamento", null,
                 "Exportou PDF do tratamento com " + processosComRisco.length + " processo(s)");
    showToast("PDF gerado com " + processosComRisco.length + " processo(s)!", "success");
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
  const yLabels = ["Muito Alto", "Alto", "Médio", "Baixo", "Muito Baixo"];
  const xLabels = ["Raro", "Pouco Prov.", "Provável", "Muito Prov.", "Quase Certo"];
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
  html += '<div style="text-align:center;color:#4dd0e1;font-weight:700;font-size:10px;letter-spacing:2px;margin-top:8px;">→ PROBABILIDADE</div>';
  html += '<div style="display:flex;gap:20px;justify-content:center;margin-top:10px;padding-top:8px;border-top:1px solid #1e5f7a;font-size:10px;">' +
    '<span><span style="display:inline-block;width:12px;height:12px;background:#3ad48a;border-radius:2px;vertical-align:middle;margin-right:4px;"></span>Baixo 1-6</span>' +
    '<span><span style="display:inline-block;width:12px;height:12px;background:#f5c94a;border-radius:2px;vertical-align:middle;margin-right:4px;"></span>Médio 7-19</span>' +
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
const MATRICULAS_GESTORES_TRAT = ["TCE2026", "20145", "295816", "15280", "51587", "293898"];
function usuarioEhGestorTrat() {
  let matricula = String((typeof user === "object" && user && user.matricula) || "").trim();
  if (!matricula) {
    try {
      matricula = String(JSON.parse(sessionStorage.getItem("mapa_user") || "{}").matricula || "").trim();
    } catch (e) { matricula = ""; }
  }
  return MATRICULAS_GESTORES_TRAT.indexOf(matricula) >= 0;
}
// Divisao do usuario logado, resistente a global "user" vazio.
function divisaoUsuarioTrat() {
  let d = (typeof user === "object" && user && user.divisao) || "";
  if (!d) {
    try {
      d = JSON.parse(sessionStorage.getItem("mapa_user") || "{}").divisao || "";
    } catch (e) { d = ""; }
  }
  return normalizarDivTrat(d);
}
function inicializarFiltroDivisaoTrat() {
  const inicial = (typeof divisaoAtivaNorm === "function" ? divisaoAtivaNorm() : "")
    || divisaoUsuarioTrat();
  if (divisoesSelecionadasTrat.size === 0 && inicial) {
    divisoesSelecionadasTrat.add(inicial);
  }
  montarSeletoresMultiplosTrat();
}
async function mudarDivisaoTratamento(novaDivisao) {
  // Compatibilidade com eventual chamada antiga do select original.
  novaDivisao = normalizarDivTrat(novaDivisao);
  if (!novaDivisao) return;
  divisoesSelecionadasTrat.clear();
  divisoesSelecionadasTrat.add(novaDivisao);
  sincronizarSelecaoDivisoesTrat();
}
// [REMOVIDO] Bloco de diagnostico em escopo global lia "riscos"/"processos"
// antes deles existirem e abortava o restante do script.
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
// ============================================================
// TRATAMENTO - NUMERACAO GLOBAL V2
// Carregar DEPOIS de riscos.js e tratamento-override.js
// ============================================================
(function () {
  "use strict";
  function fonteTratamentoGlobal() {
    const fonte = typeof todosRiscosTrat === "function"
      ? todosRiscosTrat()
      : (typeof riscosTodos !== "undefined" && Array.isArray(riscosTodos) && riscosTodos.length
          ? riscosTodos.slice()
          : (typeof riscos !== "undefined" && Array.isArray(riscos) ? riscos.slice() : []));
    return fonte.filter(function (r) {
      const selecionado = typeof processosSelecionadosTrat === "undefined" ||
        processosSelecionadosTrat.size === 0 ||
        processosSelecionadosTrat.has(String(r.processoId));
      return selecionado && String(r.tratar || "").trim().toLowerCase() === "sim";
    });
  }
  function ordenarGlobalTratamento(lista) {
    return lista.slice().sort(function (a, b) {
      const residualA = (Number(a.prob) || 0) * (Number(a.imp) || 0) * (Number(a.nivelControle) || 1);
      const residualB = (Number(b.prob) || 0) * (Number(b.imp) || 0) * (Number(b.nivelControle) || 1);
      if (Math.abs(residualA - residualB) > 0.0001) return residualB - residualA;
      const nivelA = (Number(a.prob) || 0) * (Number(a.imp) || 0);
      const nivelB = (Number(b.prob) || 0) * (Number(b.imp) || 0);
      if (nivelA !== nivelB) return nivelB - nivelA;
      return String(a.id).localeCompare(String(b.id), "pt-BR", { numeric: true });
    });
  }
  // 🎯 Guarda a versao do riscos.js (codigo P01-R01) ANTES de trocar.
  const _numeroOficial = (typeof window.obterNumeroRisco === "function")
    ? window.obterNumeroRisco
    : null;
  function numeroGlobalTratamento(riscoId) {
    // Prioridade: o MESMO codigo usado na pagina de riscos e no PDF.
    // Assim o card, a timeline e o relatorio citam o mesmo registro.
    if (_numeroOficial) {
      try {
        const cod = _numeroOficial(riscoId);
        if (cod && cod.indexOf("??") < 0) return cod;
      } catch (e) {}
    }
    // Fallback: numeracao sequencial local (comportamento antigo).
    const ordenados = ordenarGlobalTratamento(fonteTratamentoGlobal());
    const idx = ordenados.findIndex(function (r) {
      return String(r.id) === String(riscoId);
    });
    return idx >= 0 ? "R" + String(idx + 1).padStart(2, "0") : "R??";
  }
  window.obterNumeroRisco = numeroGlobalTratamento;
  window.numeroGlobalTratamento = numeroGlobalTratamento;
  // A versão atual de renderizarTratamentos calcula a numeração novamente
  // dentro de cada processo. Esta substituição remove esse reinício local.
  if (typeof window.renderizarTratamentos === "function") {
    let srcRender = window.renderizarTratamentos.toString();
    srcRender = srcRender.replace(
      /const riscosMesmoProcesso =\[\s\S\]*?const numero = formatarIdRisco\(idxNumero \+ 1\);/,
      'const riscosMesmoProcesso = filtrados.filter(function(x) {' +
      ' return String(x.processoId) === String(r.processoId);' +
      '});' +
      'const numero = numeroGlobalTratamento(r.id);'
    );
    try {
      window.renderizarTratamentos = (0, eval)("(" + srcRender + ")");
      console.log("[Tratamento] Cards ajustados para numeração global.");
    } catch (e) {
      console.error("[Tratamento] Falha ao ajustar cards:", e);
    }
  }
  // A função do PDF possui um helper LOCAL chamado numeroDoRiscoNoProcesso.
  // Por ser local, o override antigo em window não o alcançava. Aqui a própria
  // função de exportação é recriada trocando somente o corpo desse helper.
  if (typeof window.exportarTratamentoPDF === "function") {
    let srcPdf = window.exportarTratamentoPDF.toString();
    srcPdf = srcPdf.replace(
      /function numeroDoRiscoNoProcesso\(riscoId, riscosDoRegistro\)\s*\{[\s\S]*?return idx >= 0 \? formatarIdRisco\(idx \+ 1\) : "R\?\?";\s*\}/,
      'function numeroDoRiscoNoProcesso(riscoId, riscosDoRegistro) {' +
      ' return numeroGlobalTratamento(riscoId);' +
      '}'
    );
    try {
      window.exportarTratamentoPDF = (0, eval)("(" + srcPdf + ")");
      console.log("[Tratamento] PDF ajustado para numeração global.");
    } catch (e) {
      console.error("[Tratamento] Falha ao ajustar PDF:", e);
    }
  }
  function atualizarNumeracaoGlobalTratamento() {
    if (typeof window.renderizarTratamentos === "function") {
      window.renderizarTratamentos();
    }
  }
  window.atualizarNumeracaoGlobalTratamento = atualizarNumeracaoGlobalTratamento;
  document.addEventListener("DOMContentLoaded", function () {
    setTimeout(atualizarNumeracaoGlobalTratamento, 700);
  });
  console.log("[Tratamento] Numeração global V2 ativa.");
})();
// ============================================================
// GARANTIA FINAL — controle de prazo
// ------------------------------------------------------------
// O bloco acima recria renderizarTratamentos via eval. A chamada a
// prepararCamposPrazo() está DENTRO do corpo da função, então é
// preservada na recriação. Este listener é apenas uma rede extra
// para o primeiro carregamento da página.
// ============================================================
document.addEventListener("DOMContentLoaded", function () {
  setTimeout(function () {
    if (typeof prepararCamposPrazo === "function") prepararCamposPrazo();
  }, 1200);
  setTimeout(function () {
    if (typeof prepararCamposPrazo === "function") prepararCamposPrazo();
  }, 2400);
});
// Utilitários expostos para depuração
window.abrirModalPrazoTrat = abrirModalPrazo;
window.historicoPrazoEtapa = historicoPrazoDaEtapa;
window.prepararCamposPrazoTrat = prepararCamposPrazo;
console.log("[Tratamento] Controle de alteração de prazo ativo.");
// ============================================================
//  MAPA / TJPR - Gestao de Riscos
//  ACESSO SEPREC - ve todas as divisoes por padrao
// ------------------------------------------------------------
//  Regra: quando a divisao do usuario logado for "SEPREC", o
//  filtro de divisoes ja abre com TODAS as divisoes marcadas,
//  nas tres paginas: Riscos (index), Tratamento e Dashboard.
//
//  POR QUE PRECISA DE MAIS DO QUE "MARCAR TUDO":
//  "SEPREC" nao e uma divisao operacional - nao existe em
//  NOMES_DIVISOES nem na coluna divisao_sigla dos processos.
//  Sem este script, o usuario SEPREC cai no caminho de
//  "nao gestor", que faz:
//        divisoesSelecionadas.clear();
//        divisoesSelecionadas.add("SEPREC");
//  Resultado: nenhum processo casa com a sigla e a tela fica
//  vazia. Por isso, alem de pre-marcar todas as divisoes, o
//  script tambem trata SEPREC como perfil autorizado a filtrar.
//
//  COMO USAR - carregue DEPOIS dos scripts da pagina:
//
//  index.html (Riscos):
//      <script src="assets/js/riscos.js"></script>
//      <script src="assets/js/seprec-todas-divisoes.js"></script>
//
//  tratamento.html:
//      <script src="assets/js/tratamento-override.js"></script>
//      <script src="assets/js/seprec-todas-divisoes.js"></script>
//
//  dashboard.html:
//      <script src="assets/js/dashboard.js"></script>
//      <script src="assets/js/seprec-todas-divisoes.js"></script>
// ============================================================
(function () {
  "use strict";
  // Sigla que concede visao geral. Para liberar outra no futuro,
  // basta acrescentar aqui (ex.: "SEPREC", "GABINETE").
  const SIGLAS_VISAO_GERAL = ["SEPREC"];
  // Fallback caso NOMES_DIVISOES ainda nao esteja disponivel.
  const DIVISOES_PADRAO = ["DPROC", "DC", "DPP", "CJ", "AA", "AT", "DCGA"];
  const CHAVE_FILTRO_DASH = "mapa_filtro_divisoes";
  function norm(v) {
    return String(v == null ? "" : v).trim().toUpperCase();
  }
  function usuarioSessao() {
    try { return JSON.parse(sessionStorage.getItem("mapa_user") || "{}") || {}; }
    catch (e) { return {}; }
  }
  /** O usuario logado tem visao geral (divisao SEPREC)? */
  function temVisaoGeral() {
    const u = usuarioSessao();
    let d = norm(u.divisao);
    // Rede de seguranca: o global "user" pode estar preenchido
    // antes de a sessao ser lida em alguma pagina.
    if (!d && typeof user === "object" && user) d = norm(user.divisao);
    return SIGLAS_VISAO_GERAL.indexOf(d) >= 0;
  }
  /** Lista de siglas reais, lida do mapa da pagina quando existir. */
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
  // Se nao for SEPREC, o arquivo nao altera absolutamente nada.
  if (!temVisaoGeral()) {
    console.log("[SEPREC] Usuario sem visao geral - comportamento padrao mantido.");
    return;
  }
  const DIVISOES = todasAsDivisoes();
  console.log("[SEPREC] Visao geral ativa. Divisoes:", DIVISOES.join(", "));
  // ============================================================
  // 1) PERFIL AUTORIZADO A FILTRAR
  // ------------------------------------------------------------
  // As tres paginas usam uma funcao propria para decidir se o
  // usuario pode escolher divisoes. Sem isso, o SEPREC seria
  // travado na propria sigla (que nao tem processos).
  // ============================================================
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
    liberarPerfil("usuarioEhGestor");      // riscos.js
    liberarPerfil("usuarioEhGestorTrat");  // tratamento-override.js
    liberarPerfil("isGestorMulti");        // supabase-client.js (dashboard)
  }
  // Roda imediatamente e continua tentando, porque a ordem de
  // carga dos scripts varia entre as paginas.
  liberarTodosOsPerfis();
  // ============================================================
  // 2) DASHBOARD - filtro guardado em sessionStorage
  // ------------------------------------------------------------
  // getDivisoesFiltro() le "mapa_filtro_divisoes". Gravamos ANTES
  // de o dashboard inicializar, entao ele ja abre com tudo.
  // ============================================================
  function prepararFiltroDashboard() {
    let atual = null;
    try { atual = JSON.parse(sessionStorage.getItem(CHAVE_FILTRO_DASH) || "null"); }
    catch (e) { atual = null; }
    // Só define na primeira vez da sessao. Assim, se o usuario
    // desmarcar divisoes manualmente, a escolha dele e respeitada.
    const jaDefinido = Array.isArray(atual) && atual.length > 0 &&
                       atual.indexOf("SEPREC") < 0;
    if (jaDefinido) return;
    try {
      sessionStorage.setItem(CHAVE_FILTRO_DASH, JSON.stringify(DIVISOES));
      console.log("[SEPREC] Filtro do dashboard iniciado com todas as divisoes.");
    } catch (e) {}
  }
  prepararFiltroDashboard();
  // ============================================================
  // 3) RISCOS e TRATAMENTO - conjuntos em memoria
  // ------------------------------------------------------------
  // Os dois modulos guardam a selecao em um Set declarado com
  // "let" no escopo global do script. Nao da para reatribuir de
  // fora, mas da para preencher (mutacao), que e o necessario.
  // ============================================================
  function preencherSet(nome) {
    let alvo = null;
    try {
      // eslint-disable-next-line no-eval
      alvo = (0, eval)("typeof " + nome + " !== 'undefined' ? " + nome + " : null");
    } catch (e) {
      alvo = null;
    }
    if (!alvo || typeof alvo.add !== "function") return false;
    // Remove a sigla SEPREC, que nao corresponde a processo algum.
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
    // Repopula processos e redesenha os dois menus.
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
  // ============================================================
  // 4) ORQUESTRACAO
  // ------------------------------------------------------------
  // Cada pagina termina de carregar num momento diferente (o
  // tratamento, por exemplo, so monta os seletores depois de
  // buscar dados no Supabase). Por isso tentamos por alguns
  // segundos, parando assim que a pagina correspondente aceita.
  // ============================================================
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
      if (tentativa() || n > 40) {      // ~12s de tolerancia
        clearInterval(timer);
      }
    }, 300);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }
  // ============================================================
  // Utilitarios para conferencia no console
  // ============================================================
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
//  🆕 VÍNCULO: RISCO → ETAPA DO PROCESSO (mapa de calor por etapa)
// ============================================================
//  Objetivo: permitir dizer "este risco pode acontecer nesta etapa
//  do processo" e, com isso, calcular quantidade/média/máximo de
//  risco por etapa -- a base do futuro mapa de calor sobre o
//  fluxograma.
//
//  Onde aparece: um ícone circular no canto do painel "Processo
//  Atual" (mesmo card usado em cima do Plano de Tratamento), visível
//  só ao passar o mouse -- igual ao ícone de mover risco de divisão.
//
//  Etapas do processo: por enquanto, mantidas manualmente (o usuário
//  cadastra os nomes das etapas uma única vez por processo, reaproveitando
//  para todos os riscos daquele processo). Quando a extração automática
//  de etapas a partir do BPMN/PDF do fluxograma estiver pronta, ela passa
//  a alimentar esta MESMA lista -- a estrutura de dados já está pronta
//  para isso, sem precisar mudar nada do que é construído aqui.
//
//  Valor de risco usado no cálculo (heatmap): NÃO é o risco bruto
//  (prob x imp) e também não é sempre a última etapa de tratamento.
//  Regra pedida:
//    1) Pega a ÚLTIMA etapa de tratamento do risco (o mais recente
//       histórico de tratamento).
//    2) Se essa última etapa estiver CONCLUÍDA, usa o Risco Final dela.
//    3) Se NÃO estiver concluída, procura -- de trás pra frente -- a
//       etapa de tratamento mais recente que já esteja concluída, e
//       usa o Risco Final dela.
//    4) Se nenhuma etapa de tratamento existir ainda, usa o risco bruto
//       (prob x imp) como último recurso.
//
//  ⚠️ REQUISITO NO SUPABASE (rodar uma única vez, mesmo padrão das
//  outras migrações já usadas neste arquivo -- ex.:
//  01_criar_coluna_motivo_prazo.sql, 02_criar_colunas_edicao_etapa.sql):
//
//     create table if not exists processo_etapas (
//       id bigserial primary key,
//       processo_id bigint not null,
//       nome text not null,
//       ordem int not null default 0,
//       criado_em timestamptz not null default now()
//     );
//
//     create table if not exists risco_etapa_vinculo (
//       id bigserial primary key,
//       risco_id bigint not null unique,
//       etapa_id bigint not null references processo_etapas(id) on delete cascade,
//       criado_em timestamptz not null default now(),
//       atualizado_em timestamptz not null default now()
//     );
//
//  Se essas tabelas ainda não existirem, o recurso mostra um aviso
//  claro (toast) explicando exatamente isso, em vez de falhar
//  silenciosamente.
// ============================================================

const VINCULO_TABELA_ETAPAS = "processo_etapas";
const VINCULO_TABELA_VINCULOS = "risco_etapa_vinculo";

let _vinculoModalAtual = null;
let _vinculoEtapasCache = [];   // etapas do processo aberto no modal
let _vinculoVinculosCache = []; // vínculos {risco_id, etapa_id} do processo aberto
let _vinculoRiscoSelecionadoId = null;
let _vinculoAnexosCache = [];   // 🆕 TODOS os anexos candidatos a fluxograma (PDF/PNG/JPG) do processo
let _vinculoAnexoAtual = null;  // 🆕 qual desses anexos está selecionado/em preview agora
let _vinculoAvisouBboxFaltando = false; // 🆕 evita repetir o aviso das colunas bbox_* a cada etapa
let _vinculoMapaExport = null;          // 🆕 imagem + dados do mapa, prontos para exportação

// ---------- 1) Regra de cálculo do valor de risco (heatmap) ----------
function vinculoValorRiscoParaHeatmap(risco) {
  const historico = (risco.tratamento && risco.tratamento.historico) || [];

  if (!historico.length) {
    // Ainda sem nenhuma etapa de tratamento: usa o risco bruto.
    return (risco.prob || 0) * (risco.imp || 0);
  }

  const ultima = historico[historico.length - 1];
  if (ultima && ultima.concluido) {
    return calcularRiscoFinal(risco, ultima);
  }

  // Última etapa ainda aberta: procura, de trás pra frente, a mais
  // recente que já esteja concluída.
  for (let i = historico.length - 2; i >= 0; i--) {
    if (historico[i] && historico[i].concluido) {
      return calcularRiscoFinal(risco, historico[i]);
    }
  }

  // Nenhuma etapa concluída ainda: usa a última mesmo, como melhor
  // estimativa disponível no momento.
  return calcularRiscoFinal(risco, ultima);
}

// ---------- 2) CSS (injetado uma única vez) ----------
function garantirEstilosVinculoEtapa() {
  if (document.getElementById("estilosVinculoEtapa")) return;
  const style = document.createElement("style");
  style.id = "estilosVinculoEtapa";
  style.textContent = `
    /* Ícone que só aparece ao passar o mouse no card "Processo Atual" */
    .vinculo-hover-icone{
      position:absolute; top:14px; right:14px; z-index:5;
      width:34px; height:34px; border-radius:50%;
      background:rgba(77,208,225,.14); border:1px solid rgba(77,208,225,.35);
      color:#4dd0e1; display:flex; align-items:center; justify-content:center;
      font-size:15px; cursor:pointer;
      opacity:0; transform:translateY(-4px);
      transition:opacity .16s ease, transform .16s ease, background .16s ease;
    }
    #registroInfo:hover .vinculo-hover-icone,
    .vinculo-hover-icone:focus-visible{ opacity:1; transform:translateY(0); }
    .vinculo-hover-icone:hover{ background:rgba(77,208,225,.28); }
    [data-theme="light"] .vinculo-hover-icone{
      background:rgba(11,125,140,.10); border-color:rgba(11,125,140,.35); color:#0b7d8c;
    }
    [data-theme="light"] .vinculo-hover-icone:hover{ background:rgba(11,125,140,.22); }

    /* Modal de vínculo (reaproveita a linguagem visual do modal de etapa) */
    .vinculo-overlay{
      position:fixed; inset:0; z-index:9200;
      background:rgba(6,20,28,.74); backdrop-filter:blur(3px);
      display:flex; align-items:center; justify-content:center; padding:20px;
      animation:etapaFadeIn .18s ease; overflow-y:auto;
    }
    .vinculo-box{
      width:100%; max-width:920px; max-height:calc(100vh - 40px); overflow-y:auto;
      background:var(--card-bg,#12222c); border:1px solid rgba(255,255,255,.12);
      border-radius:14px; box-shadow:0 26px 70px rgba(0,0,0,.5);
      animation:etapaSobe .22s cubic-bezier(.2,.9,.3,1.2);
    }
    [data-theme="light"] .vinculo-box{ background:#ffffff; border-color:#dbe6ec; box-shadow:0 26px 70px rgba(20,60,80,.24); }
    /* 🆕 CORREÇÃO DO CABEÇALHO SOBREPOSTO.
       O fundo era um gradiente SEMITRANSPARENTE e o z-index (2) ficava
       na mesma pilha dos chips e da tabela -- então, ao rolar o modal,
       o conteúdo passava POR CIMA do título, deixando-o ilegível.
       Agora o cabeçalho tem fundo SÓLIDO (o gradiente colorido vira
       apenas uma camada sobre ele) e z-index alto o bastante para ficar
       sempre acima do corpo rolável. */
    .vinculo-head{
      position:sticky; top:0; z-index:20;
      display:flex; align-items:center; justify-content:space-between; gap:10px;
      padding:16px 20px;
      background-color:var(--card-bg,#12222c);
      background-image:linear-gradient(90deg,rgba(14,154,167,.20),rgba(14,154,167,.04));
      border-bottom:1px solid rgba(255,255,255,.14);
      box-shadow:0 4px 14px rgba(0,0,0,.28);
    }
    [data-theme="light"] .vinculo-head{
      background-color:#ffffff;
      background-image:linear-gradient(90deg,#e6f7f9,#ffffff);
      border-bottom-color:#dceaee;
      box-shadow:0 4px 14px rgba(20,60,80,.10);
    }
    /* O título é longo (nome do processo) e precisa poder quebrar sem
       empurrar o botão de fechar para fora da caixa. */
    .vinculo-titulo{ min-width:0; }
    .vinculo-titulo span.vinculo-titulo-texto{
      overflow:hidden; text-overflow:ellipsis; display:-webkit-box;
      -webkit-line-clamp:2; -webkit-box-orient:vertical;
    }
    .vinculo-fechar{ flex:0 0 auto; }

    .vinculo-aviso-clicavel{
      cursor:pointer; border-radius:7px; padding:8px 10px;
      background:rgba(224,168,58,.10); border:1px solid rgba(224,168,58,.30);
      color:#e0c07a; transition:.15s ease;
    }
    .vinculo-aviso-clicavel:hover{ background:rgba(224,168,58,.20); }
    [data-theme="light"] .vinculo-aviso-clicavel{ background:#fdf6e6; color:#8a6100; border-color:#ecd9ac; }
    /* 🆕 Só a quantidade, sem ícone. A própria pílula é o alvo do hover
       (cursor:help + title nativo com a lista de riscos). */
    .vinculo-qtd-riscos{
      display:inline-flex; align-items:center; justify-content:center; cursor:help;
      min-width:30px; padding:2px 9px; border-radius:20px;
      background:rgba(77,208,225,.12); border:1px solid rgba(77,208,225,.30);
      color:#dceaf1;
    }
    .vinculo-qtd-riscos:hover{ background:rgba(77,208,225,.24); }
    [data-theme="light"] .vinculo-qtd-riscos{
      background:rgba(11,125,140,.10); border-color:rgba(11,125,140,.28); color:#23414e;
    }

    /* 🆕 ITEM ④ — Painel de revisão das sugestões vindas de OCR. */
    #vinculoSugestoesOcr{
      margin-top:10px; padding:14px 16px; border-radius:10px;
      background:rgba(77,208,225,.06); border:1px solid rgba(77,208,225,.28);
    }
    [data-theme="light"] #vinculoSugestoesOcr{ background:#f2fbfc; border-color:#c9e7ec; }
    .vinculo-sug-cabecalho{ font-size:12.5px; line-height:1.55; margin-bottom:10px; }
    .vinculo-sug-alerta{
      margin-top:6px; padding:6px 9px; border-radius:6px; font-size:11.5px; font-weight:700;
      background:rgba(224,168,58,.14); border:1px solid rgba(224,168,58,.35); color:#e0c07a;
    }
    [data-theme="light"] .vinculo-sug-alerta{ background:#fdf6e6; color:#8a6100; border-color:#ecd9ac; }
    .vinculo-sug-acoes-topo{ display:flex; gap:7px; flex-wrap:wrap; margin-bottom:10px; }
    .vinculo-sug-acoes-topo .vinculo-btn{ padding:5px 10px; font-size:11.5px; }
    .vinculo-sug-lista{ max-height:300px; overflow-y:auto; margin-bottom:12px; }
    .vinculo-sug-item{
      display:flex; align-items:center; gap:9px; padding:6px 8px;
      border-radius:7px; margin-bottom:5px;
    }
    .vinculo-sug-item.suspeita{ background:rgba(224,168,58,.09); }
    [data-theme="light"] .vinculo-sug-item.suspeita{ background:#fdf7ea; }
    .vinculo-sug-item .vinculo-sug-texto{ flex:1; padding:6px 9px; font-size:12.5px; }
    .vinculo-sug-check{
      width:17px; height:17px; flex:0 0 17px; cursor:pointer; accent-color:#0e9aa7;
    }
    .vinculo-sug-flag{ color:#e0a83a; font-size:13px; flex:0 0 auto; cursor:help; }
    .vinculo-sug-rodape{ display:flex; gap:8px; flex-wrap:wrap; }

    /* 🆕 Barra de ações do mapa (exportar). */
    .vinculo-acoes-mapa{
      display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin:10px 0 2px;
    }
    .vinculo-lista-naovinculados{
      margin-top:8px; padding:10px 12px; border-radius:8px;
      background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.10);
      font-size:12px; line-height:1.6;
    }
    [data-theme="light"] .vinculo-lista-naovinculados{ background:#f7fafb; border-color:#e2eaee; }
    .vinculo-titulo{ display:flex; align-items:center; gap:9px; font-weight:800; font-size:15px; color:#4dd0e1; }
    [data-theme="light"] .vinculo-titulo{ color:#0b7d8c; }
    .vinculo-fechar{
      border:0; background:rgba(255,255,255,.08); color:#dceaf1; width:30px; height:30px;
      border-radius:8px; cursor:pointer; font-size:16px; display:flex; align-items:center; justify-content:center;
    }
    .vinculo-fechar:hover{ background:rgba(255,255,255,.16); }
    [data-theme="light"] .vinculo-fechar{ background:#eef4f6; color:#33505e; }

    .vinculo-body{ padding:18px 20px; color:#dceaf1; font-size:13px; line-height:1.55; }
    [data-theme="light"] .vinculo-body{ color:#33505e; }

    .vinculo-campo{ margin-bottom:16px; }
    .vinculo-rotulo{
      font-size:10.5px; font-weight:800; letter-spacing:.5px; text-transform:uppercase;
      color:#8fa9b5; margin-bottom:6px; display:block;
    }
    [data-theme="light"] .vinculo-rotulo{ color:#6a8492; }
    .vinculo-select, .vinculo-input{
      width:100%; padding:10px 12px; border-radius:9px;
      background:rgba(255,255,255,.045); border:1px solid rgba(255,255,255,.14);
      color:#dceaf1; font-size:13px;
    }
    [data-theme="light"] .vinculo-select, [data-theme="light"] .vinculo-input{
      background:#f7fafb; border-color:#d7e2e7; color:#33505e;
    }

    .vinculo-status-atual{
      padding:10px 12px; border-radius:9px; font-size:12.5px; margin-bottom:16px;
      background:rgba(77,208,225,.08); border:1px solid rgba(77,208,225,.25);
    }
    .vinculo-status-atual.vazio{
      background:rgba(255,255,255,.04); border-color:rgba(255,255,255,.12); color:#8fa9b5;
    }
    [data-theme="light"] .vinculo-status-atual.vazio{ background:#f7fafb; border-color:#e2eaee; color:#6a8492; }

    .vinculo-chips{ display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px; }
    .vinculo-chip{
      display:flex; align-items:center; gap:7px;
      padding:8px 12px; border-radius:20px; cursor:pointer;
      background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.16);
      color:#dceaf1; font-size:12.5px; transition:.15s ease;
    }
    [data-theme="light"] .vinculo-chip{ background:#f7fafb; border-color:#d7e2e7; color:#33505e; }
    .vinculo-chip:hover{ border-color:#4dd0e1; }
    .vinculo-chip.selecionada{
      background:rgba(77,208,225,.18); border-color:#4dd0e1; color:#4dd0e1; font-weight:700;
    }
    [data-theme="light"] .vinculo-chip.selecionada{ background:rgba(11,125,140,.12); color:#0b7d8c; }
    .vinculo-chip .vinculo-chip-excluir{
      border:0; background:transparent; color:inherit; opacity:.55; cursor:pointer;
      display:flex; align-items:center; font-size:12px;
    }
    .vinculo-chip .vinculo-chip-excluir:hover{ opacity:1; color:#e05a5a; }

    .vinculo-add-etapa{ display:flex; gap:8px; margin-bottom:18px; }
    .vinculo-add-etapa .vinculo-input{ flex:1; }
    .vinculo-btn{
      border:0; border-radius:9px; padding:9px 14px; cursor:pointer; font-size:12.5px; font-weight:700;
      background:#0e9aa7; color:#fff; display:flex; align-items:center; gap:6px; white-space:nowrap;
    }
    .vinculo-btn:hover{ filter:brightness(1.08); }
    .vinculo-btn.secundario{ background:rgba(255,255,255,.08); color:#dceaf1; }
    [data-theme="light"] .vinculo-btn.secundario{ background:#eef4f6; color:#33505e; }

    .vinculo-secao-titulo{
      font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:.4px;
      color:#8fa9b5; margin:20px 0 10px; display:flex; align-items:center; gap:7px;
    }
    [data-theme="light"] .vinculo-secao-titulo{ color:#6a8492; }

    .vinculo-tabela{ width:100%; border-collapse:collapse; font-size:12.5px; }
    .vinculo-tabela th, .vinculo-tabela td{
      padding:9px 10px; text-align:left; border-bottom:1px solid rgba(255,255,255,.08);
    }
    [data-theme="light"] .vinculo-tabela th, [data-theme="light"] .vinculo-tabela td{
      border-bottom-color:#e2eaee;
    }
    .vinculo-tabela th{ color:#8fa9b5; font-weight:700; text-transform:uppercase; font-size:10.5px; letter-spacing:.4px; }
    [data-theme="light"] .vinculo-tabela th{ color:#6a8492; }
    .vinculo-dot{ display:inline-block; width:10px; height:10px; border-radius:50%; margin-right:6px; vertical-align:middle; }
    .vinculo-vazio-lista{ font-size:12.5px; color:#8fa9b5; padding:8px 0; }
    [data-theme="light"] .vinculo-vazio-lista{ color:#6a8492; }
  `;
  document.head.appendChild(style);
}

// ---------- 3) Ícone no cabeçalho "Processo Atual" ----------
function vinculoInjetarIconeCabecalho() {
  const registroInfo = document.getElementById("registroInfo");
  if (!registroInfo) return;
  if (document.getElementById("vinculoIconeEtapas")) return;

  if (getComputedStyle(registroInfo).position === "static") {
    registroInfo.style.position = "relative";
  }

  const btn = document.createElement("button");
  btn.type = "button";
  btn.id = "vinculoIconeEtapas";
  btn.className = "vinculo-hover-icone";
  btn.title = "Vincular riscos às etapas do processo";
  btn.innerHTML = '<i class="bi bi-diagram-3"></i>';
  btn.addEventListener("click", abrirModalVinculoEtapas);
  registroInfo.appendChild(btn);
}

// ---------- 4) Persistência (Supabase) ----------
// 🆕 SEMPRE registra o erro CRU do Supabase no console (code, details,
// hint) antes de decidir o toast. O Postgres retorna informações muito
// mais precisas do que a .message sozinha -- útil pra diagnosticar se o
// problema é RLS, GRANT faltando, schema errado etc.
function vinculoLogErroCompleto(origem, erro) {
  console.error("[Vinculo][" + origem + "] Erro completo do Supabase:", {
    message: erro && erro.message,
    code: erro && erro.code,
    details: erro && erro.details,
    hint: erro && erro.hint
  });
}

function vinculoAvisarMigracaoFaltando(erro) {
  const msg = String((erro && erro.message) || erro || "");
  const codigo = String((erro && erro.code) || "");

  if (/relation .* does not exist|schema cache/i.test(msg) || codigo === "42P01") {
    showToast(
      "As tabelas do vínculo risco→etapa ainda não existem no banco. " +
      "Peça para rodar a migração que cria processo_etapas e risco_etapa_vinculo.",
      "error"
    );
    return true;
  }

  // 🆕 RLS (Row Level Security) bloqueando o INSERT/UPDATE/DELETE --
  // código 42501 do Postgres. As tabelas existem, mas ainda não têm uma
  // policy liberando a operação (mesmo padrão que outras tabelas do
  // sistema, como processos/riscos/tratamento_etapas, já precisam ter).
  if (/row-level security|row level security|permission denied/i.test(msg) || codigo === "42501") {
    showToast(
      "Bloqueado por segurança (RLS) no Supabase. Confira: (1) se rodou o SQL no projeto CERTO " +
      "(o mesmo que window.sb aponta); (2) rode window.vinculoVerificarBanco() no console (F12) " +
      "para um diagnóstico detalhado; (3) comando de correção: alter table processo_etapas disable row level security; " +
      "alter table risco_etapa_vinculo disable row level security;",
      "error"
    );
    return true;
  }

  return false;
}

// 🆕 Ferramenta de diagnóstico, chamável manualmente do console (F12):
//   window.vinculoVerificarBanco()
// Faz um SELECT, um INSERT de teste e o DELETE desse teste, em cada
// tabela, e imprime exatamente onde trava -- sem depender do fluxo da
// tela. É a forma mais rápida de confirmar se o problema é RLS, GRANT,
// tabela inexistente, ou projeto Supabase errado.
window.vinculoVerificarBanco = async function () {
  if (!window.sb) {
    console.error("[Diagnóstico] window.sb não existe -- Supabase não inicializou nesta página.");
    return;
  }
  console.log("[Diagnóstico] Iniciando verificação de processo_etapas e risco_etapa_vinculo...");

  const testarTabela = async function (tabela, linhaTeste) {
    console.log("--- " + tabela + " ---");

    const leitura = await window.sb.from(tabela).select("*").limit(1);
    if (leitura.error) {
      console.error("  SELECT falhou:", leitura.error);
    } else {
      console.log("  SELECT ok. Linhas de exemplo:", leitura.data);
    }

    const insercao = await window.sb.from(tabela).insert(linhaTeste).select().single();
    if (insercao.error) {
      console.error("  INSERT de teste falhou (isto é o mesmo erro que trava a tela):", insercao.error);
      return;
    }
    console.log("  INSERT de teste OK:", insercao.data);

    const remocao = await window.sb.from(tabela).delete().eq("id", insercao.data.id);
    if (remocao.error) {
      console.error("  DELETE do registro de teste falhou (RLS de DELETE ausente):", remocao.error);
    } else {
      console.log("  DELETE do registro de teste OK -- tabela 100% funcional.");
    }
  };

  await testarTabela("processo_etapas", { processo_id: -1, nome: "__teste_diagnostico__", ordem: 0 });

  // 🆕 Testa TAMBEM risco_etapa_vinculo -- antes so testavamos
  // processo_etapas, entao um RLS bloqueando especificamente esta
  // segunda tabela passava despercebido no diagnostico.
  const etapaTeste = await window.sb
    .from("processo_etapas")
    .insert({ processo_id: -1, nome: "__teste_diagnostico_vinculo__", ordem: 0 })
    .select().single();

  if (etapaTeste.error) {
    console.error("[Diagnostico] Nao foi possivel criar etapa de apoio para testar risco_etapa_vinculo:", etapaTeste.error);
  } else {
    await testarTabela("risco_etapa_vinculo", { risco_id: -1, etapa_id: etapaTeste.data.id });
    await window.sb.from("processo_etapas").delete().eq("id", etapaTeste.data.id);
  }

  console.log("[Diagnóstico] Concluído. Copie os erros acima (se houver) para análise.");
};

async function vinculoSbListarEtapas(processoId) {
  if (!window.sb || !processoId) return [];
  const { data, error } = await window.sb
    .from(VINCULO_TABELA_ETAPAS)
    .select("*")
    .eq("processo_id", processoId)
    .order("ordem", { ascending: true })
    .order("id", { ascending: true });
  if (error) {
    vinculoLogErroCompleto("listarEtapas", error);
    vinculoAvisarMigracaoFaltando(error);
    return [];
  }
  return data || [];
}

// 🆕 Agora aceita um bbox opcional (posicao da caixa no desenho,
// como fracoes 0..1 de largura/altura -- ex.: {xFrac,yFrac,wFrac,hFrac}).
// Isso é o que permite pintar o mapa de calor DE VERDADE em cima do
// fluxograma depois. Se as colunas bbox_* ainda nao existirem no banco
// (migracao nao rodada), tenta de novo SEM elas -- a etapa ainda é
// criada normalmente, so fica sem posicao visual registrada.
// 🆕 Aceita `origem` (ex.: "bpmn") para marcar etapas que vieram de uma
// fonte estruturada e confiável -- elas nunca devem ser sobrescritas por
// detecção automática depois (item ①).
async function vinculoSbCriarEtapa(processoId, nome, bbox, origem) {
  if (!window.sb || !processoId || !nome) return null;
  const ordem = _vinculoEtapasCache.length;
  const payloadBase = { processo_id: processoId, nome: nome.trim(), ordem: ordem };
  if (origem) payloadBase.origem = origem;
  const payloadComBbox = bbox ? Object.assign({}, payloadBase, {
    bbox_x: bbox.xFrac, bbox_y: bbox.yFrac, bbox_w: bbox.wFrac, bbox_h: bbox.hFrac
  }) : payloadBase;

  let resposta = await window.sb.from(VINCULO_TABELA_ETAPAS).insert(payloadComBbox).select().single();

  // Se a coluna 'origem' ainda não existe no banco, regrava sem ela --
  // a etapa é criada normalmente, só perde a proteção contra OCR.
  if (resposta.error && origem &&
      /column .*origem.* does not exist|schema cache/i.test(resposta.error.message || "")) {
    console.warn("[Vinculo] Coluna 'origem' ausente em " + VINCULO_TABELA_ETAPAS + ". " +
      "Rode: alter table " + VINCULO_TABELA_ETAPAS + " add column if not exists origem text;");
    const semOrigem = Object.assign({}, payloadComBbox);
    delete semOrigem.origem;
    resposta = await window.sb.from(VINCULO_TABELA_ETAPAS).insert(semOrigem).select().single();
  }

  if (resposta.error && bbox && /column .* does not exist|schema cache/i.test(resposta.error.message || "")) {
    // 🆕 ANTES esta degradação era SILENCIOSA: só um console.warn. A etapa
    // era gravada sem posição e, lá na frente, o mapa de calor dizia que
    // "nenhuma etapa tem posição registrada", culpando erroneamente o
    // fluxograma (como se fosse narrativo/manual) em vez de apontar a
    // causa real -- as colunas bbox_* não existem na tabela. Agora o
    // aviso aparece na tela, UMA vez por detecção, com o SQL pronto.
    if (!_vinculoAvisouBboxFaltando) {
      _vinculoAvisouBboxFaltando = true;
      console.error("[Vinculo] Colunas bbox_x/bbox_y/bbox_w/bbox_h NÃO existem em " +
        VINCULO_TABELA_ETAPAS + ". A posição de cada etapa no desenho foi calculada, " +
        "mas não pôde ser gravada -- por isso o mapa de calor sobre o fluxograma não aparece.\n" +
        "Rode no Supabase (SQL Editor):\n" +
        "alter table " + VINCULO_TABELA_ETAPAS + "\n" +
        "  add column if not exists bbox_x double precision,\n" +
        "  add column if not exists bbox_y double precision,\n" +
        "  add column if not exists bbox_w double precision,\n" +
        "  add column if not exists bbox_h double precision;");
      showToast(
        "As etapas foram detectadas COM posição, mas o banco não tem as colunas bbox_x/y/w/h — " +
        "por isso o mapa de calor sobre o desenho não vai aparecer. Rode no Supabase: " +
        "alter table " + VINCULO_TABELA_ETAPAS + " add column if not exists bbox_x double precision, " +
        "add column if not exists bbox_y double precision, add column if not exists bbox_w double precision, " +
        "add column if not exists bbox_h double precision;",
        "error"
      );
    }
    resposta = await window.sb.from(VINCULO_TABELA_ETAPAS).insert(payloadBase).select().single();
  }

  if (resposta.error) {
    vinculoLogErroCompleto("criarEtapa", resposta.error);
    if (!vinculoAvisarMigracaoFaltando(resposta.error)) showToast("Erro ao criar etapa: " + resposta.error.message, "error");
    return null;
  }
  return resposta.data;
}
// 🆕 Exclui TODAS as etapas cadastradas para um processo de uma vez --
// usada pelo botão "Limpar e detectar novamente", que dá ao usuário uma
// forma de remover etapas erradas/acumuladas (de detecções anteriores
// feitas em anexos diferentes, por exemplo) antes de rodar a detecção
// de novo, em vez de precisar excluir uma por uma no lixinho.
// 🆕 CORRIGIDO: antes tentávamos apagar as etapas direto, sem remover os
// VÍNCULOS (risco_etapa_vinculo) que apontam pra elas. Como existe chave
// estrangeira de risco_etapa_vinculo -> processo_etapas, o banco recusava
// o delete e as etapas antigas continuavam na tela -- dando a impressão
// de que o botão "Limpar e detectar novamente" não fazia nada.
// Agora apagamos primeiro os filhos (vínculos) e só depois as etapas.
async function vinculoSbExcluirTodasEtapas(processoId) {
  if (!window.sb || !processoId) return false;

  // 1) Descobre as etapas deste processo.
  const { data: etapas, error: erroLista } = await window.sb
    .from(VINCULO_TABELA_ETAPAS)
    .select("id")
    .eq("processo_id", processoId);

  if (erroLista) {
    vinculoLogErroCompleto("excluirTodasEtapas/listar", erroLista);
    if (!vinculoAvisarMigracaoFaltando(erroLista)) showToast("Erro ao listar etapas: " + erroLista.message, "error");
    return false;
  }

  const ids = (etapas || []).map(function (e) { return e.id; });

  // 2) Remove os vínculos risco->etapa ANTES (evita erro de FK).
  if (ids.length) {
    const { error: erroVinc } = await window.sb
      .from(VINCULO_TABELA_VINCULOS)
      .delete()
      .in("etapa_id", ids);
    if (erroVinc) {
      vinculoLogErroCompleto("excluirTodasEtapas/vinculos", erroVinc);
      if (!vinculoAvisarMigracaoFaltando(erroVinc)) showToast("Erro ao remover vínculos: " + erroVinc.message, "error");
      return false;
    }
  }

  // 3) Agora sim, apaga as etapas.
  const { error } = await window.sb
    .from(VINCULO_TABELA_ETAPAS)
    .delete()
    .eq("processo_id", processoId);
  if (error) {
    vinculoLogErroCompleto("excluirTodasEtapas", error);
    if (!vinculoAvisarMigracaoFaltando(error)) showToast("Erro ao limpar etapas: " + error.message, "error");
    return false;
  }

  // 🆕 VERIFICAÇÃO OBRIGATÓRIA. No Supabase, um DELETE bloqueado por
  // Row Level Security NÃO retorna erro -- ele simplesmente apaga ZERO
  // linhas e devolve sucesso. Era exatamente isso que estava acontecendo:
  // o botão dizia "Etapas anteriores removidas", a detecção rodava, mas
  // as linhas antigas continuavam no banco e voltavam na tela iguaizinhas.
  // Agora conferimos se sobrou alguma coisa e avisamos de verdade.
  const { data: restantes, error: erroConf } = await window.sb
    .from(VINCULO_TABELA_ETAPAS)
    .select("id")
    .eq("processo_id", processoId);

  if (!erroConf && restantes && restantes.length) {
    console.error("[Vinculo] DELETE não removeu nada: ainda restam " +
      restantes.length + " etapa(s) no processo " + processoId + ".");
    showToast(
      "Não foi possível apagar as etapas: o banco bloqueou a exclusão (RLS). " +
      "Rode no Supabase: alter table processo_etapas disable row level security; " +
      "alter table risco_etapa_vinculo disable row level security;",
      "error"
    );
    return false;
  }

  console.log("[Vinculo] " + ids.length + " etapa(s) e seus vínculos foram removidos do processo " + processoId + ".");
  return true;
}

async function vinculoSbExcluirEtapa(etapaId) {
  if (!window.sb || !etapaId) return false;
  const { error } = await window.sb
    .from(VINCULO_TABELA_ETAPAS)
    .delete()
    .eq("id", etapaId);
  if (error) {
    showToast("Erro ao excluir etapa: " + error.message, "error");
    return false;
  }
  return true;
}

async function vinculoSbListarVinculos(processoId) {
  if (!window.sb || !processoId) return [];
  const idsEtapas = _vinculoEtapasCache.map(function (e) { return e.id; });
  if (!idsEtapas.length) return [];
  const { data, error } = await window.sb
    .from(VINCULO_TABELA_VINCULOS)
    .select("*")
    .in("etapa_id", idsEtapas);
  if (error) {
    vinculoLogErroCompleto("listarVinculos", error);
    vinculoAvisarMigracaoFaltando(error);
    return [];
  }
  return data || [];
}

async function vinculoSbSalvarVinculo(riscoId, etapaId) {
  if (!window.sb || !riscoId || !etapaId) return false;
  const { error } = await window.sb
    .from(VINCULO_TABELA_VINCULOS)
    .upsert(
      { risco_id: riscoId, etapa_id: etapaId, atualizado_em: new Date().toISOString() },
      { onConflict: "risco_id" }
    );
  if (error) {
    vinculoLogErroCompleto("salvarVinculo", error);
    if (!vinculoAvisarMigracaoFaltando(error)) showToast("Erro ao salvar vínculo: " + error.message, "error");
    return false;
  }
  return true;
}

async function vinculoSbRemoverVinculo(riscoId) {
  if (!window.sb || !riscoId) return false;
  const { error } = await window.sb
    .from(VINCULO_TABELA_VINCULOS)
    .delete()
    .eq("risco_id", riscoId);
  if (error) {
    showToast("Erro ao remover vínculo: " + error.message, "error");
    return false;
  }
  return true;
}

// ---------- 5) Modal: abrir / fechar ----------
function fecharModalVinculoEtapas() {
  if (_vinculoModalAtual) {
    _vinculoModalAtual.remove();
    _vinculoModalAtual = null;
  }
}

// ============================================================
// 🆕 CODIGO DO RISCO COM A ETAPA: P01-R03-E1
// E1, E2, E3... = posicao da etapa na lista de etapas do processo
// (mesma ordem dos chips). Risco sem etapa vinculada fica so P01-R03.
// ============================================================
function vinculoNumeroEtapa(etapaId) {
  const idx = _vinculoEtapasCache.findIndex(function (e) { return String(e.id) === String(etapaId); });
  return idx >= 0 ? "E" + (idx + 1) : "";
}

function vinculoCodigoRiscoComEtapa(riscoId) {
  const base = (typeof obterNumeroRisco === "function") ? obterNumeroRisco(riscoId) : ("#" + riscoId);
  const v = _vinculoVinculosCache.find(function (x) { return String(x.risco_id) === String(riscoId); });
  const e = v ? vinculoNumeroEtapa(v.etapa_id) : "";
  return e ? base + "-" + e : base;
}
window.vinculoCodigoRiscoComEtapa = vinculoCodigoRiscoComEtapa;

/** Atualiza os rotulos do seletor de risco (o codigo muda ao vincular/desvincular). */
function vinculoAtualizarRotulosSelectRisco() {
  const sel = _vinculoModalAtual && _vinculoModalAtual.querySelector("#vinculoSelectRisco");
  if (!sel) return;
  Array.prototype.forEach.call(sel.options, function (opt) {
    const risco = todosRiscosTrat().find(function (r) { return String(r.id) === String(opt.value); });
    if (risco) opt.textContent = vinculoRotuloRisco(risco);
  });
}

function vinculoRotuloRisco(risco) {
  const cod = vinculoCodigoRiscoComEtapa(risco.id);
  const evento = (risco.evento || "Sem descrição").trim();
  const resumido = evento.length > 70 ? evento.slice(0, 70) + "…" : evento;
  return cod + " — " + resumido;
}

async function abrirModalVinculoEtapas() {
  if (!processoAtualId) {
    showToast("Selecione um processo antes de vincular riscos às etapas.", "error");
    return;
  }

  garantirEstilosVinculoEtapa();
  fecharModalVinculoEtapas();

  const riscosDoProcesso = todosRiscosTrat().filter(function (r) {
    return String(r.processoId) === String(processoAtualId);
  });

  if (!riscosDoProcesso.length) {
    showToast("Este processo ainda não possui riscos cadastrados.", "error");
    return;
  }

  const processo = processos.find(function (p) { return String(p.id) === String(processoAtualId); });
  const nomeProcesso = processo ? (processo.processo || "Processo") : "Processo";

  const overlay = document.createElement("div");
  overlay.className = "vinculo-overlay";
  overlay.innerHTML =
    '<div class="vinculo-box" role="dialog" aria-modal="true">' +
      '<div class="vinculo-head">' +
        '<div class="vinculo-titulo"><i class="bi bi-diagram-3"></i> <span class="vinculo-titulo-texto">Vincular Riscos às Etapas — ' + escapeHTML(nomeProcesso) + '</span></div>' +
        '<button type="button" class="vinculo-fechar" id="vinculoBtnFechar" aria-label="Fechar"><i class="bi bi-x-lg"></i></button>' +
      '</div>' +
      '<div class="vinculo-body">' +
        '<div class="vinculo-campo">' +
          '<label class="vinculo-rotulo">Selecione o risco</label>' +
          '<select class="vinculo-select" id="vinculoSelectRisco"></select>' +
        '</div>' +

        '<div class="vinculo-secao-titulo"><i class="bi bi-image"></i> Fluxograma anexado ao processo</div>' +
        '<div class="vinculo-campo" id="vinculoLinhaAnexo" style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;">' +
          '<div style="flex:1;min-width:220px;">' +
            '<label class="vinculo-rotulo">Este processo tem mais de um arquivo anexado. Escolha qual fluxograma usar:</label>' +
            '<select class="vinculo-select" id="vinculoSelectAnexo"></select>' +
          '</div>' +
          '<button type="button" class="vinculo-btn secundario" id="vinculoBtnRedetectar" style="white-space:nowrap;">' +
            '<i class="bi bi-arrow-repeat"></i> Detectar etapas deste arquivo' +
          '</button>' +
          '<button type="button" class="vinculo-btn secundario" id="vinculoBtnLimparRedetectar" style="white-space:nowrap;" title="Apaga TODAS as etapas já cadastradas para este processo e detecta de novo do zero">' +
            '<i class="bi bi-trash3"></i> Limpar e detectar novamente' +
          '</button>' +
        '</div>' +
        '<div id="vinculoFluxogramaPreview" class="vinculo-vazio-lista">Carregando...</div>' +
        '<div id="vinculoStatusExtracao" class="vinculo-vazio-lista" style="margin-top:6px;"></div>' +
        '<div id="vinculoSugestoesOcr" style="display:none;"></div>' +

        '<div id="vinculoStatusAtual" class="vinculo-status-atual vazio">Carregando...</div>' +

        '<div class="vinculo-secao-titulo"><i class="bi bi-diagram-3"></i> Esse risco é possível de acontecer em qual etapa?</div>' +
        '<div id="vinculoListaEtapas" class="vinculo-chips"></div>' +
        '<div class="vinculo-add-etapa">' +
          '<input type="text" class="vinculo-input" id="vinculoNovaEtapaInput" placeholder="Não encontrou a etapa certa? Adicione manualmente..." maxlength="120">' +
          '<button type="button" class="vinculo-btn secundario" id="vinculoBtnAddEtapa"><i class="bi bi-plus-lg"></i> Adicionar</button>' +
        '</div>' +

        '<div class="vinculo-secao-titulo"><i class="bi bi-list-check"></i> Riscos vinculados por etapa</div>' +
        '<div id="vinculoResumoEtapas"></div>' +
        '<div class="vinculo-secao-titulo"><i class="bi bi-image"></i> Mapa de calor sobre o fluxograma</div>' +
        '<div id="vinculoMapaCalorImagem" class="vinculo-vazio-lista"></div>' +
      '</div>' +
    '</div>';

  document.body.appendChild(overlay);
  _vinculoModalAtual = overlay;

  overlay.querySelector("#vinculoBtnFechar").addEventListener("click", fecharModalVinculoEtapas);
  overlay.addEventListener("mousedown", function (e) {
    if (e.target === overlay) fecharModalVinculoEtapas();
  });
  overlay.addEventListener("keydown", function (e) {
    if (e.key === "Escape") fecharModalVinculoEtapas();
  });

  const selectRisco = overlay.querySelector("#vinculoSelectRisco");
  selectRisco.innerHTML = riscosDoProcesso.map(function (r) {
    return '<option value="' + r.id + '">' + escapeHTML(vinculoRotuloRisco(r)) + '</option>';
  }).join("");
  selectRisco.addEventListener("change", function () {
    _vinculoRiscoSelecionadoId = selectRisco.value;
    vinculoRenderStatusEChips();
  });

  overlay.querySelector("#vinculoBtnAddEtapa").addEventListener("click", vinculoAdicionarEtapa);
  overlay.querySelector("#vinculoNovaEtapaInput").addEventListener("keydown", function (e) {
    if (e.key === "Enter") vinculoAdicionarEtapa();
  });

  overlay.querySelector("#vinculoSelectAnexo").addEventListener("change", function (e) {
    vinculoTrocarAnexoSelecionado(e.target.value);
  });
  overlay.querySelector("#vinculoBtnRedetectar").addEventListener("click", function () {
    vinculoDetectarEtapasDoAnexoAtual(true);
  });
  overlay.querySelector("#vinculoBtnLimparRedetectar").addEventListener("click", vinculoLimparERedetectar);

  _vinculoRiscoSelecionadoId = riscosDoProcesso[0].id;

  await vinculoCarregarTudo();
}

// ---------- 6a) Extração automática das etapas a partir do PDF anexado ----------
//  Usa a MESMA lista de anexos de "Mapas do Processo" (orgListarDoStorage,
//  definida em riscos.js -- este arquivo já é carregado DEPOIS dele).
//  Não cria etapas dentro do fluxograma em si: apenas LÊ o texto do PDF
//  já anexado e cadastra, na tabela processo_etapas, as etapas que
//  conseguir identificar (itens numerados e perguntas de decisão).
let _vinculoPdfJsPromise = null;

// 🆕 Cache simples (por URL) do ArrayBuffer do PDF já baixado. Como o
// motor de detecção agora testa página por página (às vezes chamando
// vinculoExtrairItensBrutosPdf várias vezes seguidas pro MESMO arquivo),
// isso evita baixar o mesmo PDF de novo a cada tentativa.
const _vinculoPdfBufferCache = new Map();
async function vinculoBaixarPdfBuffer(url) {
  if (_vinculoPdfBufferCache.has(url)) return _vinculoPdfBufferCache.get(url);
  const promessa = (async function () {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("Não foi possível baixar o PDF (HTTP " + resp.status + ").");
    return resp.arrayBuffer();
  })();
  _vinculoPdfBufferCache.set(url, promessa);
  try {
    return await promessa;
  } catch (e) {
    _vinculoPdfBufferCache.delete(url); // não guarda falha em cache
    throw e;
  }
}

function vinculoInjetarPdfJs() {
  if (_vinculoPdfJsPromise) return _vinculoPdfJsPromise;
  _vinculoPdfJsPromise = new Promise(function (resolve, reject) {
    if (window.pdfjsLib) return resolve();
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.onload = function () {
      try {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        resolve();
      } catch (e) { reject(e); }
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return _vinculoPdfJsPromise;
}

// Encontra, entre os anexos já salvos do processo (Mapas do Processo),
// o que melhor representa o fluxograma: prioriza PDF com "fluxo" no
// nome, depois qualquer PDF, depois imagem com "fluxo" no nome,
// depois qualquer imagem.
// 🆕 Retorna TODOS os anexos candidatos a fluxograma (PDF/PNG/JPG) do
// processo, na mesma ordem em que aparecem em "Mapas do Processo".
// Usada para popular o seletor -- deixa de "adivinhar sozinho" qual é
// o fluxograma certo quando existe mais de um anexo.
// 🆕 Espera orgListarDoStorage existir antes de desistir. Esta função
// é definida em riscos.js -- se, por qualquer motivo (ordem de
// carregamento dos scripts, cache do navegador, etc.), ela ainda não
// tiver sido registrada no momento em que o modal abre, esperamos até
// 5s por ela em vez de desistir na primeira checagem.
async function vinculoAguardarOrgListarDoStorage() {
  let tentativas = 0;
  while (typeof orgListarDoStorage !== "function" && tentativas < 50) {
    await new Promise(function (r) { setTimeout(r, 100); });
    tentativas++;
  }
  return typeof orgListarDoStorage === "function";
}

async function vinculoListarTodosAnexosCandidatos(processoId) {
  const disponivel = await vinculoAguardarOrgListarDoStorage();
  if (!disponivel) {
    console.error("[Vinculo] orgListarDoStorage não encontrada mesmo após esperar. " +
      "Verifique se riscos.js foi carregado ANTES deste arquivo (tratamento-override.js) na página.");
    return [];
  }

  let anexos = [];
  try {
    anexos = await orgListarDoStorage(processoId);
    console.log("[Vinculo] orgListarDoStorage(" + processoId + ") retornou " + (anexos ? anexos.length : 0) + " arquivo(s):",
      (anexos || []).map(function (a) { return a.nome + " (" + a.tipo + ")"; }));
  } catch (e) {
    console.error("[Vinculo] Erro ao listar anexos do processo:", e);
    return [];
  }

  const candidatos = (anexos || []).filter(function (a) {
    // 🆕 ITEM ② — o modelo BPMN entra na lista de candidatos. Ele não é
    // uma imagem, mas é a MELHOR fonte de nomes de etapa quando existe.
    return a.tipo === "application/pdf" || a.tipo === "image/png" ||
           a.tipo === "image/jpeg" || a.tipo === "application/bpmn+xml";
  });
  console.log("[Vinculo] Candidatos a fluxograma (PDF/PNG/JPG):", candidatos.length);
  return candidatos;
}

// Dentro da lista de candidatos, escolhe um "palpite" inicial: prioriza
// PDF com "fluxo" no nome, depois qualquer PDF, depois imagem com
// "fluxo" no nome, depois qualquer imagem. O usuário pode sempre
// trocar manualmente no seletor depois.
function vinculoEscolherAnexoPadrao(candidatos) {
  if (!candidatos || !candidatos.length) return null;

  const normalizar = function (s) {
    try { return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
    catch (e) { return (s || "").toLowerCase(); }
  };

  // 🆕 ITEM ② — o modelo BPMN tem PRIORIDADE MÁXIMA. Se existe, é dele
  // que saem os nomes das etapas: leitura exata, sem OCR e sem heurística.
  const bpmns = candidatos.filter(function (a) { return a.tipo === "application/bpmn+xml"; });
  if (bpmns.length) return bpmns[0];

  const pdfs = candidatos.filter(function (a) { return a.tipo === "application/pdf"; });
  const pdfComNome = pdfs.find(function (a) { return normalizar(a.nome).indexOf("fluxo") !== -1; });
  if (pdfComNome) return pdfComNome;
  if (pdfs.length) return pdfs[0];

  const imagens = candidatos.filter(function (a) { return a.tipo === "image/png" || a.tipo === "image/jpeg"; });
  const imgComNome = imagens.find(function (a) { return normalizar(a.nome).indexOf("fluxo") !== -1; });
  if (imgComNome) return imgComNome;
  if (imagens.length) return imagens[0];

  return null;
}

// Extrai as linhas de texto do PDF (na ordem em que aparecem), usando
// a posição (x, y) de cada fragmento para reconstruir a leitura linha
// a linha -- o texto de um PDF exportado do Bizagi vem fragmentado,
// não como parágrafos prontos.
// 🆕 Agora devolve um ARRAY POR PÁGINA (array de arrays de linhas), em vez
// de uma lista única com o texto de TODAS as páginas misturado. Isso é
// essencial pro bug corrigido em vinculoDetectarEtapasDoAnexoAtual: um PDF
// de processo normalmente tem o DESENHO na página 1 (com números "1, 2, 3"
// dentro/perto de cada caixa) e, nas páginas seguintes, um texto NARRATIVO
// (manual/procedimento) que descreve o mesmo fluxo em parágrafos -- e que
// TAMBÉM costuma vir numerado ("1. Recebimento...", "2. Análise..."). Como
// antes juntávamos tudo numa lista só, a heurística de itens numerados
// capturava os dois ao mesmo tempo e misturava "etapas" de origens
// diferentes (as caixas do desenho E os parágrafos do manual) numa lista
// só -- por isso apareciam nomes em ESTILOS diferentes (caixas em
// MAIÚSCULAS vs. parágrafos com "(DP)" no fim) todos marcados como etapa,
// mesmo sem corresponder aos quadrantes reais do fluxograma.
// 🆕 CORREÇÃO PRINCIPAL desta rodada. Antes, tudo que estava na MESMA
// altura (mesmo Y) da página era colado numa única "linha", sem olhar a
// distância HORIZONTAL entre os pedaços. Em documentos diagramados (como
// o infográfico "Expedição de Alvará"), o título do bloco fica à
// ESQUERDA e o selo da unidade responsável fica à DIREITA, na mesma
// altura -- e os dois viravam um nome só:
//     "ANÁLISE DA DOCUMENTAÇÃO DP — DIVISÃO DE PAGAMENTO"
// Em casos piores, colava selos de blocos VIZINHOS:
//     "DC — DIV. DE CÁLCULOS 5 CJ — CONSULTORIA JURÍDICA"
// Agora, quando o espaço em branco entre dois fragmentos é grande
// (proporcional ao tamanho da fonte), quebramos em SEGMENTOS separados --
// cada coluna/elemento vira uma entrada independente, e os selos de
// unidade caem depois no filtro de ruído.
async function vinculoExtrairLinhasPorPaginaPdf(url) {
  await vinculoInjetarPdfJs();
  const buffer = await vinculoBaixarPdfBuffer(url);
  const pdf = await window.pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;

  const paginas = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const itens = content.items
      .filter(function (it) { return it.str && it.str.trim(); })
      .map(function (it) {
        const t = it.transform;
        const altura = Math.hypot(t[2], t[3]) || 10;
        const largura = it.width || (it.str.length * altura * 0.5);
        return {
          texto: it.str,
          x0: t[4],
          x1: t[4] + largura,
          y: Math.round(t[5]),
          altura: altura
        };
      });

    const porLinha = {};
    itens.forEach(function (it) {
      const chave = Math.round(it.y / 3) * 3; // tolera pequenas variacoes de Y
      if (!porLinha[chave]) porLinha[chave] = [];
      porLinha[chave].push(it);
    });

    const linhas = [];
    Object.keys(porLinha)
      .map(Number)
      .sort(function (a, b) { return b - a; }) // topo da pagina primeiro
      .forEach(function (chave) {
        const daLinha = porLinha[chave].sort(function (a, b) { return a.x0 - b.x0; });

        // Quebra a linha em SEGMENTOS sempre que o vão horizontal for
        // grande demais pra ser um simples espaço entre palavras.
        const segmentos = [];
        let atual = [];
        for (let i = 0; i < daLinha.length; i++) {
          const item = daLinha[i];
          if (atual.length) {
            const anterior = atual[atual.length - 1];
            const vao = item.x0 - anterior.x1;
            const alturaRef = Math.max(anterior.altura, item.altura, 1);
            // Vão > ~2,5x a altura da fonte = colunas/elementos distintos.
            if (vao > alturaRef * 2.5) {
              segmentos.push(atual);
              atual = [];
            }
          }
          atual.push(item);
        }
        if (atual.length) segmentos.push(atual);

        const textos = segmentos.map(function (seg) {
          return seg.map(function (i) { return i.texto; })
            .join(" ").replace(/\s+/g, " ").trim();
        }).filter(function (t) { return !!t; });

        // 🆕 Reanexa numeradores isolados. Em infográficos o número do
        // bloco costuma vir dentro de um círculo, distante o bastante do
        // título pra cair a quebra acima -- viraria o segmento "2" sozinho
        // (descartado por ser curto) e o título perderia sua numeração.
        // Aqui devolvemos o número ao segmento seguinte da mesma linha.
        for (let i = 0; i < textos.length - 1; i++) {
          if (/^\d{1,2}(\.\d{1,2})?[.)\-–]?$/.test(textos[i]) &&
              !vinculoEhRuidoDeInfografico(textos[i + 1])) {
            // Só reanexa se o segmento seguinte for conteúdo de verdade --
            // nunca num selo de unidade, senão inventaríamos uma "etapa
            // numerada" a partir de um simples rótulo lateral.
            textos[i + 1] = textos[i].replace(/[.)\-–]$/, "") + " " + textos[i + 1];
            textos[i] = "";
          }
        }

        textos.forEach(function (t) { if (t) linhas.push(t); });
      });
    paginas.push(linhas);
  }
  return paginas;
}

// 🆕 Ruído típico de documento diagramado/infográfico: selos de unidade
// responsável (DP, DC, CJ, AT...), rótulos de ramificação (SIM/NÃO, VIA
// A/B/C), marcações de sistema e cabeçalho/rodapé. Nada disso é etapa --
// são etiquetas de apoio ao lado ou dentro dos blocos.
function vinculoEhRuidoDeInfografico(texto) {
  const t = (texto || "").trim();
  if (!t) return true;

  // Selo de unidade: "DP — DIVISÃO DE PAGAMENTO", "CJ — CONSULTORIA
  // JURÍDICA", "DC — DIV. DE CÁLCULOS", "AT — ASSESSORIA TÉCNICA"...
  if (/^(DP|DC|CJ|AT|AA|SEPREC|TJPR)\s*[—\-–]/i.test(t)) return true;
  // O mesmo selo sozinho, sem o nome por extenso.
  if (/^(DP|DC|CJ|AT|AA)$/i.test(t)) return true;

  if (/^VIA\s+[A-Z]$/i.test(t)) return true;                 // VIA A / VIA B / VIA C
  if (/^(SIM|N[ÃA]O)$/i.test(t)) return true;                // rótulo de ramificação
  if (/^SISTEMA\s+PROJUDI$/i.test(t)) return true;
  if (/^BASE\s+NORMATIVA$/i.test(t)) return true;
  if (/^CONTINUA\s+NA\s+P[ÁA]GINA/i.test(t)) return true;
  if (/^P[ÁA]GINA\s*\d+(\s*DE\s*\d+)?$/i.test(t)) return true;
  if (/^(TJPR|SEPREC)\b/i.test(t)) return true;
  if (/^(www\.|http)/i.test(t)) return true;
  if (/^(Resolu[çc][ãa]o|Decreto|EC\s*n)/i.test(t)) return true; // base normativa
  if (/^\d+$/.test(t)) return true;

  return false;
}

// Heurística para documentos NUMERADOS (infográficos, manuais, POPs):
// identifica itens como "1 Recebimento...", "2. Registro...", "3.1 Concordância".
//
// 🆕 Esta função agora trata APENAS numeração -- e é exclusiva. Duas
// mudanças importantes em relação à versão anterior:
//
// 1) A regra antiga do "termina em ?" (losango de decisão) rodava JUNTO
//    com a numeração e somava resultados. Num documento numerado como o
//    infográfico de Expedição de Alvará, as perguntas que ficam DENTRO
//    dos blocos ("DOCUMENTAÇÃO COMPLETA?", "HÁ SALDO EM CONTA?",
//    "PAGAMENTO INTEGRAL?") entravam como etapas independentes,
//    duplicando blocos que o título numerado já tinha capturado.
//
// 2) A regra do "?" foi REMOVIDA de vez daqui. Ela existia como um proxy
//    tosco pra "isto é um fluxograma desenhado" -- mas hoje quem cuida
//    desse caso é o caminho VISUAL (vinculoAgruparBlocosVisuais), que lê
//    as CAIXAS e os LOSANGOS pela posição no desenho. Mantê-la aqui era
//    perigoso: num fluxograma Bizagi com 2+ losangos, esta função
//    "vencia" a disputa e cadastrava SÓ os losangos, descartando todas as
//    caixas de tarefa do fluxo.
//
// Quando não há numeração, devolvemos lista vazia de propósito, pra que o
// motor de detecção siga para o caminho visual -- que é o correto para
// fluxogramas desenhados.
function vinculoHeuristicaEtapasDeLinhas(linhas) {
  const numeradas = [];
  const vistosNum = new Set();

  linhas.forEach(function (linhaOriginal) {
    const linha = (linhaOriginal || "").trim();
    if (linha.length < 4) return;
    if (vinculoEhRuidoDeInfografico(linha)) return;

    // "1 Título", "2. Título", "3.1 Título", "3.1) Título"
    const m = linha.match(/^(\d{1,2})(?:\.(\d{1,2}))?\s*[.)\-–]?\s+(.{3,})$/);
    if (!m) return;

    // 🆕 Tira o selo de unidade que possa ter ficado grudado no fim.
    const nome = vinculoLimparSufixoDeSelo(m[3].trim());
    const chave = nome.toLowerCase();
    if (nome.length >= 3 && nome.length <= 160 &&
        !vinculoEhRuidoDeInfografico(nome) && !vistosNum.has(chave)) {
      vistosNum.add(chave);
      const principal = Number(m[1]);
      const sub = m[2] ? Number(m[2]) : 0;  // subetapa 3.1, 3.2...
      numeradas.push({ ordem: principal * 100 + sub, nome: nome });
    }
  });

  numeradas.sort(function (a, b) { return a.ordem - b.ordem; });
  return numeradas.map(function (c) { return c.nome; });
}

// ---------- 6a-2) FALLBACK: fluxogramas SEM numeracao (PDF ou IMAGEM) ----------
// Muitos PDFs do Bizagi (e do nosso proprio editor BPMN, quando salvo como
// PNG) exportam o DESENHO do fluxo -- caixas, losangos e raias -- sem
// nenhum "1.", "2." na frente do texto. Para esses casos, a heuristica
// numerada nao encontra nada. Este fallback reconstroi os rotulos das
// CAIXAS do desenho, usando a posicao (x, y) de cada fragmento de texto:
//  - Em PDF: le o texto real embutido no arquivo (pdf.js).
//  - Em PNG/JPG: nao existe texto embutido -- faz OCR (Tesseract.js),
//    reconhecendo o texto DENTRO dos pixels da imagem.
//  - Nos dois casos, tambem calculamos e guardamos a POSICAO (bbox) de
//    cada etapa detectada, como fracao 0..1 da largura/altura do
//    arquivo. É essa posicao que permite depois pintar o mapa de calor
//    DE VERDADE em cima do desenho, nao so numa tabela.
//  - Ignora texto ROTACIONADO em PDF (raias/swimlanes verticais como
//    "Assessoria Tecnica (AT)" na lateral do desenho).
//  - Agrupa fragmentos de texto proximos entre si (mesma caixa costuma
//    ter 2 ou 3 linhas, ex.: "Realizar o diagnostico" + "(reuniao,
//    requisitos, objetivos, indicadores)").
//  - Descarta ruido comum (Sim/Nao soltos, numero de pagina).
// 🆕 Recebe também `paginasDesejadas` (opcional): quando informado, só
// processa ESSAS páginas em vez do PDF inteiro. Isso é o que permite ao
// motor de detecção (vinculoDetectarEtapasDoAnexoAtual) tentar SÓ a
// página 1 primeiro -- onde normalmente está o DESENHO do fluxograma --
// em vez de misturar suas caixas com o texto de páginas narrativas
// seguintes (manual/procedimento), que geram blocos de texto parecidos
// mas que NÃO são etapas do desenho.
async function vinculoExtrairItensBrutosPdf(url, paginasDesejadas) {
  await vinculoInjetarPdfJs();
  const buffer = await vinculoBaixarPdfBuffer(url);
  const pdf = await window.pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;

  const fontes = [];
  const paginas = paginasDesejadas && paginasDesejadas.length
    ? paginasDesejadas.filter(function (n) { return n >= 1 && n <= pdf.numPages; })
    : Array.from({ length: pdf.numPages }, function (_, i) { return i + 1; });

  for (let idx = 0; idx < paginas.length; idx++) {
    const p = paginas[idx];
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const itens = content.items
      .filter(function (it) { return it.str && it.str.trim(); })
      .map(function (it) {
        const t = it.transform;
        const angulo = Math.atan2(t[1], t[0]);
        const altura = Math.hypot(t[2], t[3]) || 10;
        const largura = it.width || (it.str.length * altura * 0.5);
        // 🆕 Antes descartávamos QUALQUER fragmento com rotação != 0, o que
        // apagava o PDF INTEIRO quando o desenho tinha uma leve inclinação
        // global (ex.: exportação com uma pequena rotação de página) --
        // resultando em "não consegui identificar NENHUM texto". Agora só
        // descartamos texto praticamente VERTICAL (perto de 90°/-90°/270°),
        // que é o padrão real das raias (swimlanes) escritas de lado --
        // texto horizontal com pequena inclinação continua sendo lido.
        const grausAbs = Math.abs(angulo) * 180 / Math.PI;
        const vertical = grausAbs > 75 && grausAbs < 105;
        return {
          texto: it.str,
          x0: t[4],
          x1: t[4] + largura,
          y0: t[5] - altura,
          y1: t[5],
          altura: altura,
          rotacionado: vertical
        };
      })
      .filter(function (it) { return !it.rotacionado; }); // remove raias verticais (texto de lado)
    // coordenadaTopoParaBaixo:false -> PDF cresce PRA CIMA (eixo Y invertido
    // em relação a imagem/canvas, que cresce pra baixo).
    fontes.push({ itens: itens, larguraBase: viewport.width, alturaBase: viewport.height, coordenadaTopoParaBaixo: false });
  }
  return fontes;
}

// Carrega o Tesseract.js (OCR) sob demanda -- só quando o usuário
// realmente tenta detectar etapas de uma IMAGEM, pra não pesar a tela
// à toa nos outros casos (PDF numerado, edição manual etc.).
let _vinculoTesseractPromise = null;
function vinculoInjetarTesseract() {
  if (_vinculoTesseractPromise) return _vinculoTesseractPromise;
  _vinculoTesseractPromise = new Promise(function (resolve, reject) {
    if (window.Tesseract) return resolve();
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return _vinculoTesseractPromise;
}

// Faz OCR de uma imagem (PNG/JPG) e devolve os fragmentos de texto
// reconhecidos com a posição (x, y) de cada palavra -- no MESMO formato
// que vinculoExtrairItensBrutosPdf devolve para PDFs, para poderem ser
// processados pela mesma função de agrupamento em seguida.
//
// 🆕 Reforçado após relatos de que o OCR não extraía NADA de imagens
// reais (0 palavras encontradas). A causa mais provável era o
// Tesseract.js tentar buscar a URL da imagem por conta própria, o que
// pode esbarrar em CORS dependendo de como o navegador trata essa
// requisição. Agora baixamos a imagem com fetch() -- a MESMA técnica
// que já funciona neste arquivo para os PDFs -- e entregamos ao
// Tesseract um Blob local, eliminando essa segunda requisição de rede.
// 🆕 Extraído para uma função própria (antes vivia dentro de
// vinculoExtrairItensBrutosImagem) para poder ser reaproveitada também
// pelo NOVO fallback de OCR sobre PDF (vinculoExtrairItensBrutosPdfViaOcr,
// logo abaixo) -- usado quando o PDF é só um DESENHO/digitalização sem
// nenhum texto embutido (pdf.js não acha nada pra ler) e nem tem itens
// numerados. Recebe um Blob (de imagem PNG/JPG ou de um canvas com a
// página do PDF já renderizada) e devolve os fragmentos reconhecidos no
// formato que vinculoAgruparBlocosVisuais espera.
async function vinculoOcrDeBlob(blob, larguraBase, alturaBase) {
  await vinculoInjetarTesseract();

  console.log("[OCR] Iniciando reconhecimento de texto (isso pode levar alguns segundos)...");
  const resultado = await window.Tesseract.recognize(blob, "por", {
    logger: function (m) {
      if (m && m.status) console.log("[OCR]", m.status, m.progress != null ? Math.round(m.progress * 100) + "%" : "");
    }
  });

  const palavras = (resultado.data.words || []);
  console.log("[OCR] Reconhecimento concluído. Palavras encontradas:", palavras.length);
  if (palavras.length) {
    console.log("[OCR] Amostra:", palavras.slice(0, 15).map(function (w) { return w.text; }).join(" | "));
  }

  const itens = [];
  palavras.forEach(function (w) {
    const texto = (w.text || "").trim();
    if (!texto) return;
    // Descarta reconhecimentos de baixíssima confiança (< 35%), que
    // costumam ser ruído (linhas do desenho confundidas com letras).
    if (typeof w.confidence === "number" && w.confidence < 35) return;
    const bbox = w.bbox || {};
    itens.push({
      texto: texto,
      x0: bbox.x0, x1: bbox.x1,
      y0: bbox.y0, y1: bbox.y1,
      altura: Math.max(1, (bbox.y1 || 0) - (bbox.y0 || 0))
    });
  });

  if (!itens.length && palavras.length) {
    console.warn("[OCR] Todas as " + palavras.length + " palavras foram descartadas por baixa confiança.");
  }

  // coordenadaTopoParaBaixo:true -> imagem/canvas cresce PRA BAIXO
  // (0 no topo), igual ao Tesseract já devolve.
  return { itens: itens, larguraBase: larguraBase, alturaBase: alturaBase, coordenadaTopoParaBaixo: true };
}

// \uD83C\uDD95 Reforçado após relatos de que o OCR não extraía NADA de imagens
// reais (0 palavras encontradas). A causa mais provável era o
// Tesseract.js tentar buscar a URL da imagem por conta própria, o que
// pode esbarrar em CORS dependendo de como o navegador trata essa
// requisição. Agora baixamos a imagem com fetch() -- a MESMA técnica
// que já funciona neste arquivo para os PDFs -- e entregamos ao
// Tesseract um Blob local, eliminando essa segunda requisição de rede.
async function vinculoExtrairItensBrutosImagem(url) {
  console.log("[OCR] Baixando imagem para reconhecimento:", url);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error("Não foi possível baixar a imagem (HTTP " + resp.status + ").");
  const blob = await resp.blob();
  console.log("[OCR] Imagem baixada:", blob.size, "bytes, tipo:", blob.type);

  const dims = await new Promise(function (resolve, reject) {
    const blobUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(blobUrl);
      resolve({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = function () {
      URL.revokeObjectURL(blobUrl);
      reject(new Error("O arquivo baixado não é uma imagem válida."));
    };
    img.src = blobUrl;
  });
  console.log("[OCR] Dimensões da imagem:", dims.w + "x" + dims.h);

  if (dims.w < 50 || dims.h < 50) {
    throw new Error("Imagem parece corrompida ou vazia (" + dims.w + "x" + dims.h + "px).");
  }

  // 🆕 Muitos fluxogramas (principalmente os exportados do editor BPMN
  // embutido no sistema) têm texto de rótulo bem pequeno dentro das
  // caixas. Em imagens pequenas/médias isso faz o Tesseract "perder" as
  // letras. Ampliamos a imagem (até um limite razoável) ANTES do OCR --
  // igual fazemos com as páginas de PDF renderizadas em
  // vinculoExtrairItensBrutosPdfViaOcr -- pra dar mais pixels de fonte
  // pro reconhecimento, sem estourar a memória do navegador.
  const maiorLadoAtual = Math.max(dims.w, dims.h);
  const alvoMaiorLado = 2200;
  const blobParaOcr = maiorLadoAtual < alvoMaiorLado
    ? await vinculoAmpliarImagemParaOcr(blob, dims, alvoMaiorLado / maiorLadoAtual)
    : blob;

  const fonte = await vinculoOcrDeBlob(blobParaOcr, dims.w, dims.h);
  return [fonte];
}

// 🆕 Reescala uma imagem (via canvas) antes do OCR, preservando a mesma
// largura/altura BASE original (dims) para o cálculo das frações de
// posição (bbox) continuar correto -- só a resolução entregue ao
// Tesseract muda.
async function vinculoAmpliarImagemParaOcr(blob, dims, fator) {
  return new Promise(function (resolve, reject) {
    const blobUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = function () {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(dims.w * fator));
        canvas.height = Math.max(1, Math.round(dims.h * fator));
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(blobUrl);
        canvas.toBlob(function (novoBlob) {
          resolve(novoBlob || blob);
        }, "image/png");
      } catch (e) {
        URL.revokeObjectURL(blobUrl);
        resolve(blob); // se der erro ao ampliar, segue com a imagem original
      }
    };
    img.onerror = function () {
      URL.revokeObjectURL(blobUrl);
      resolve(blob);
    };
    img.src = blobUrl;
  });
}

// 🆕 FALLBACK final para PDFs: quando o PDF não tem NENHUM texto embutido
// utilizável (comum em digitalizações/scans ou em fluxogramas exportados
// como PDF "vetorial-imagem", onde o texto virou desenho/curvas em vez de
// caracteres reais) -- renderiza cada página como imagem (igual ao mapa de
// calor já faz) e roda OCR nela, igual fazemos com PNG/JPG. Testa até 3
// páginas, parando na primeira que renda uma quantidade razoável de
// palavras reconhecidas.
// ============================================================================
// OCR EM BLOCOS (fluxogramas largos)
// ----------------------------------------------------------------------------
// Usado quando o PDF não tem caixas vetoriais: renderiza a página em alta
// resolução e lê o desenho em BLOCOS menores com sobreposição, para o texto
// de cada caixa ficar grande o bastante para o OCR.
// ============================================================================
function vinculoStatusOcr(msg) {
  const el = _vinculoModalAtual && _vinculoModalAtual.querySelector("#vinculoStatusExtracao");
  if (el) el.textContent = msg;
}

async function vinculoOcrEmBlocos(canvas, area) {
  await vinculoInjetarTesseract();
  const BLOCO = 1600, SOBRA = 220;
  const passo = BLOCO - SOBRA;
  const blocos = [];
  for (let y = area.y; y < area.y + area.h; y += passo) {
    for (let x = area.x; x < area.x + area.w; x += passo) {
      blocos.push({
        x: x, y: y,
        w: Math.min(BLOCO, area.x + area.w - x),
        h: Math.min(BLOCO, area.y + area.h - y)
      });
      if (x + BLOCO >= area.x + area.w) break;
    }
    if (y + BLOCO >= area.y + area.h) break;
  }
  console.log("[OCR-PDF] Lendo o desenho em " + blocos.length + " bloco(s) de até " + BLOCO + "px.");

  let worker = null;
  try {
    if (typeof window.Tesseract.createWorker === "function") {
      worker = await window.Tesseract.createWorker("por");
    }
  } catch (e) {
    console.warn("[OCR-PDF] createWorker indisponível, usando recognize direto.", e);
    worker = null;
  }

  const itens = [];
  try {
    for (let b = 0; b < blocos.length; b++) {
      const bl = blocos[b];
      if (bl.w < 40 || bl.h < 40) continue;
      vinculoStatusOcr("Lendo o fluxograma por OCR: bloco " + (b + 1) + " de " + blocos.length + "...");
      const c = document.createElement("canvas");
      c.width = bl.w; c.height = bl.h;
      const cx = c.getContext("2d");
      cx.fillStyle = "#ffffff";
      cx.fillRect(0, 0, c.width, c.height);
      cx.drawImage(canvas, bl.x, bl.y, bl.w, bl.h, 0, 0, bl.w, bl.h);

      const amostra = cx.getImageData(0, 0, c.width, c.height).data;
      let escuros = 0;
      for (let k = 0; k < amostra.length; k += 16 * 4) {
        if (amostra[k] < 200 || amostra[k + 1] < 200 || amostra[k + 2] < 200) escuros++;
      }
      if (escuros < 30) continue;

      const blob = await new Promise(function (r) { c.toBlob(r, "image/png"); });
      if (!blob) continue;
      const res = worker
        ? await worker.recognize(blob)
        : await window.Tesseract.recognize(blob, "por");
      (res.data.words || []).forEach(function (w) {
        const texto = (w.text || "").trim();
        if (!texto) return;
        if (typeof w.confidence === "number" && w.confidence < 40) return;
        const bb = w.bbox || {};
        itens.push({
          texto: texto,
          x0: bl.x + bb.x0, x1: bl.x + bb.x1,
          y0: bl.y + bb.y0, y1: bl.y + bb.y1,
          altura: Math.max(1, (bb.y1 || 0) - (bb.y0 || 0))
        });
      });
    }
  } finally {
    if (worker) { try { await worker.terminate(); } catch (e) {} }
  }

  const unicos = [];
  itens.forEach(function (it) {
    const cxA = (it.x0 + it.x1) / 2, cyA = (it.y0 + it.y1) / 2;
    const repetido = unicos.some(function (u) {
      const cxB = (u.x0 + u.x1) / 2, cyB = (u.y0 + u.y1) / 2;
      return u.texto.toLowerCase() === it.texto.toLowerCase() &&
             Math.abs(cxA - cxB) < Math.max(it.altura, u.altura) &&
             Math.abs(cyA - cyB) < Math.max(it.altura, u.altura) * 0.6;
    });
    if (!repetido) unicos.push(it);
  });
  console.log("[OCR-PDF] " + unicos.length + " palavra(s) reconhecida(s) no total.");
  return unicos;
}

// FALLBACK para PDFs sem texto embutido e sem caixas vetoriais:
// renderiza a página em alta resolução e lê por OCR em blocos.
async function vinculoExtrairItensBrutosPdfViaOcr(url) {
  await vinculoInjetarPdfJs();
  const buffer = await vinculoBaixarPdfBuffer(url);
  const pdf = await window.pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;
  const paginasParaTestar = Math.min(pdf.numPages, 3);
  for (let p = 1; p <= paginasParaTestar; p++) {
    const page = await pdf.getPage(p);
    const vp1 = page.getViewport({ scale: 1 });
    const escala = vinculoEscalaSegura(vp1.width, vp1.height, Math.max(3000, vp1.width * 5));
    const viewport = page.getViewport({ scale: escala });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    vinculoStatusOcr("Renderizando a página " + p + " em alta resolução para o OCR...");
    await page.render({ canvasContext: ctx, viewport: viewport }).promise;

    let area = { x: 0, y: 0, w: canvas.width, h: canvas.height };
    try { area = vinculoAreaUtil(canvas); } catch (e) {}

    const itens = await vinculoOcrEmBlocos(canvas, area);
    if (itens.length >= 3) {
      return [{ itens: itens, larguraBase: canvas.width, alturaBase: canvas.height, coordenadaTopoParaBaixo: true }];
    }
  }
  return [];
}
// Agrupa fragmentos proximos (mesma caixa do fluxo) em "blocos" de
// texto, usando um grafo de proximidade simples (sem bibliotecas
// externas): dois fragmentos pertencem ao mesmo bloco se os CENTROS
// horizontais estao proximos E a distancia vertical entre eles é
// pequena (indicando linhas da MESMA caixa, nao caixas diferentes).
// Recebe "fontes" (uma por pagina de PDF, ou uma unica pra imagem) e
// devolve uma lista de {nome, bbox} -- bbox sempre em fracao 0..1,
// com origem no TOPO-ESQUERDA (convencao de imagem/canvas), pronta
// pra desenhar depois, seja a fonte um PDF ou uma imagem.
// 🆕 Rótulos de RAIA/PISCINA (swimlane/pool) -- ex.: "Setor Solicitante",
// "Divisão de Processamento", "Gabinete", "Assessoria Técnica (AT)" -- não
// são etapas, são apenas o nome de QUEM executa aquele trecho do fluxo.
// Alguns PDFs escrevem essa raia na HORIZONTAL (por isso o filtro de
// rotação, sozinho, não pega todos os casos). Descartamos pelo padrão do
// texto: nome curto, começando por uma destas palavras típicas de unidade
// organizacional -- sem cortar etapas legítimas que só CITAM uma divisão
// no meio de uma frase mais longa (ex.: "Encerramento — comum às três
// vias DP — Divisão de Pagamento" continua válido, pois é bem mais longo
// e não começa com a palavra da unidade).
const VINCULO_REGEX_RAIA = /^(setor|div(is[ãa]o)?|ger[êe]ncia|coordenadoria|assessoria|consultoria|diretoria|secretaria|gabinete|departamento)\b/i;
function vinculoPareceRaiaOuPiscina(texto) {
  const limpo = (texto || "").trim();
  if (!limpo) return false;
  if (limpo.length > 45) return false; // raias sao rotulos curtos
  if (limpo.split(/\s+/).length > 6) return false;
  return VINCULO_REGEX_RAIA.test(limpo);
}

// 🆕 Alguns PDFs (o Bizagi entre eles) desenham o MESMO texto mais de uma
// vez, sobrepostos -- às vezes uma passada parcial/truncada por cima da
// completa. Ao juntar os fragmentos, isso produzia nomes com pedaços
// repetidos: "Realizar o diagnósti diagnóstico (reunião, requisitos, ão
// indicadores)". Aqui descartamos o fragmento redundante quando dois se
// sobrepõem na tela E o texto de um está contido no do outro.
function vinculoRemoverFragmentosDuplicados(membros) {
  if (!membros || membros.length < 2) return membros || [];

  const areaDe = function (m) {
    return Math.max(0, m.x1 - m.x0) * Math.max(0, m.y1 - m.y0);
  };
  const sobreposicao = function (a, b) {
    const larg = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
    const alt = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
    if (larg <= 0 || alt <= 0) return 0;
    const inter = larg * alt;
    const menor = Math.min(areaDe(a), areaDe(b)) || 1;
    return inter / menor; // fração do MENOR que está coberta pelo maior
  };
  const norm = function (s) {
    try { return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase(); }
    catch (e) { return (s || "").trim().toLowerCase(); }
  };

  const descartar = new Array(membros.length).fill(false);
  for (let i = 0; i < membros.length; i++) {
    if (descartar[i]) continue;
    for (let j = i + 1; j < membros.length; j++) {
      if (descartar[j]) continue;
      const a = membros[i], b = membros[j];
      if (sobreposicao(a, b) < 0.55) continue;

      const ta = norm(a.texto), tb = norm(b.texto);
      if (!ta || !tb) continue;

      // Mesmo texto sobreposto, ou um contido no outro: fica o mais longo.
      if (ta === tb || ta.indexOf(tb) !== -1) descartar[j] = true;
      else if (tb.indexOf(ta) !== -1) { descartar[i] = true; break; }
    }
  }

  return membros.filter(function (_, i) { return !descartar[i]; });
}

// 🆕 Descarta "texto" que na verdade é lixo de extração. Acontece quando
// o PDF tem fonte sem mapa de caracteres (ToUnicode) legível, ou quando o
// OCR confunde as LINHAS do desenho com letras -- gerando chips como
// `o & õ 8 " E un`, `E) S õ - o o) Z 2 E` ou `v |& g 3 2 E õ o = " o = 3 o e <q`.
// Critério: precisa ter densidade razoável de letras, não pode ser quase
// todo formado por caracteres soltos, e precisa conter ao menos uma
// palavra de verdade (4+ letras seguidas).
function vinculoPareceLixoDeExtracao(texto) {
  const t = (texto || "").trim();
  if (!t) return true;

  const semEspaco = t.replace(/\s/g, "");
  if (!semEspaco) return true;

  const letras = (semEspaco.match(/[A-Za-zÀ-ÿ]/g) || []).length;
  if (letras / semEspaco.length < 0.6) return true; // símbolos/números demais

  const tokens = t.split(/\s+/).filter(Boolean);

  // Caracteres picotados: muitos "tokens" com 0 ou 1 letra ("o", "&", "8",
  // "E", "õ"). Limiar baixado de 0.4 para 0.3 e agora vale a partir de 2
  // tokens -- chips como `o & õ 8 " E un` têm 6 de 7 tokens assim.
  const soltos = tokens.filter(function (w) {
    return w.replace(/[^A-Za-zÀ-ÿ]/g, "").length <= 1;
  }).length;
  if (tokens.length >= 2 && soltos / tokens.length > 0.3) return true;

  // 🆕 Precisa ter uma MASSA MÍNIMA de palavras reais, não só uma. Os
  // chips ruins dos prints (`" Validar e Teste: realizar s Técnicos
  // istênci ência, étricas,`) enganavam o teste antigo porque tinham
  // 1 ou 2 palavras longas no meio do ruído.
  const palavrasReais = (t.match(/[A-Za-zÀ-ÿ]{4,}/g) || []).length;
  if (!palavrasReais) return true;

  // 🆕 Fragmentos órfãos: pedaços de palavra que sobraram de uma extração
  // quebrada e não formam nada legível ("istênci", "icualizaç", "gaç",
  // "apear", "dival"). Se a maioria dos tokens com 3+ caracteres não
  // parece palavra do português, descarta.
  const tokensLongos = tokens.filter(function (w) {
    return w.replace(/[^A-Za-zÀ-ÿ]/g, "").length >= 3;
  });
  if (tokensLongos.length >= 3) {
    const suspeitos = tokensLongos.filter(function (w) {
      const limpo = w.replace(/[^A-Za-zÀ-ÿ]/g, "");
      // Toda palavra do português tem vogal; sequências sem vogal ou
      // terminadas em encontro consonantal estranho são fragmentos.
      if (!/[aeiouáàâãéêíóôõúü]/i.test(limpo)) return true;
      if (/[bcdfgjklmpqtvwxz]{3,}/i.test(limpo)) return true;
      return false;
    }).length;
    if (suspeitos / tokensLongos.length > 0.5) return true;
  }

  return false;
}

// 🆕 Remove o SELO DE UNIDADE que ficou grudado no fim do nome da etapa
// ("ANÁLISE DA DOCUMENTAÇÃO DP — DIVISÃO DE PAGAMENTO" -> "ANÁLISE DA
// DOCUMENTAÇÃO"). Diferente de descartar o chip inteiro, aqui o título é
// legítimo -- só veio com a etiqueta lateral colada. Também corta o caso
// em que dois selos de blocos vizinhos se juntaram.
function vinculoLimparSufixoDeSelo(texto) {
  let t = (texto || "").trim();
  if (!t) return t;

  const UNIDADES = "(?:DP|DC|CJ|AT|AA)";
  // Repete até não haver mais selo no fim (pode vir mais de um grudado).
  for (let i = 0; i < 3; i++) {
    const antes = t;
    // "... DP — DIVISÃO DE PAGAMENTO" / "... CJ - CONSULTORIA JURÍDICA"
    t = t.replace(new RegExp("\\s+\\d*\\s*" + UNIDADES + "\\s*[—\\-–]\\s*[A-ZÀ-Ÿ][A-ZÀ-Ÿ.\\s]{3,}$"), "").trim();
    // Selo sozinho no fim, sem nome por extenso.
    t = t.replace(new RegExp("\\s+" + UNIDADES + "$"), "").trim();
    // Número órfão que sobrou entre dois selos.
    t = t.replace(/\s+\d{1,2}$/, "").trim();
    if (t === antes) break;
  }

  // Se sobrou só o separador no fim, limpa.
  t = t.replace(/[\s—\-–:]+$/, "").trim();
  return t || (texto || "").trim();
}

function vinculoAgruparBlocosVisuais(fontes, nomeProcesso) {
  const candidatos = [];
  const vistos = new Set();
  const ignorarIsolado = new Set(["sim", "nao", "não", "fim", "inicio", "início"]);
  const nomeProcessoNorm = (nomeProcesso || "").trim().toLowerCase();

  fontes.forEach(function (fonte) {
    const itens = fonte.itens || [];
    const larguraBase = fonte.larguraBase || 1;
    const alturaBase = fonte.alturaBase || 1;
    const topoParaBaixo = !!fonte.coordenadaTopoParaBaixo;
    // Proximidade horizontal pelo TAMANHO DA LETRA: num fluxograma muito
    // largo, 3,5% da largura cobria várias caixas vizinhas.
    const alturaTipica = itens.length
      ? itens.map(function (it) { return it.altura; }).sort(function (a, b) { return a - b; })[Math.floor(itens.length / 2)]
      : 10;
    const limiarProxX = Math.min(larguraBase * 0.035, Math.max(alturaTipica * 6, 1));

    const usados = new Array(itens.length).fill(false);
    const adj = itens.map(function () { return []; });

    for (let i = 0; i < itens.length; i++) {
      for (let j = i + 1; j < itens.length; j++) {
        const a = itens[i], b = itens[j];
        const midA = (a.x0 + a.x1) / 2, midB = (b.x0 + b.x1) / 2;
        const proxX = Math.abs(midA - midB) < limiarProxX;
        const gapY = Math.min(Math.abs(a.y1 - b.y0), Math.abs(b.y1 - a.y0));
        const alturaMedia = (a.altura + b.altura) / 2;
        if (proxX && gapY < alturaMedia * 1.7) {
          adj[i].push(j);
          adj[j].push(i);
        }
      }
    }

    for (let i = 0; i < itens.length; i++) {
      if (usados[i]) continue;
      const pilha = [i];
      usados[i] = true;
      const grupo = [];
      while (pilha.length) {
        const atual = pilha.pop();
        grupo.push(atual);
        adj[atual].forEach(function (viz) {
          if (!usados[viz]) { usados[viz] = true; pilha.push(viz); }
        });
      }

      const membros = vinculoRemoverFragmentosDuplicados(
        grupo.map(function (idx) { return itens[idx]; })
      );

      // Ordena as linhas do bloco na ordem de LEITURA (de cima pra
      // baixo, independente da convencao de eixo Y da fonte).
      //
      // 🆕 A tolerância de "mesma linha" agora é PROPORCIONAL ao tamanho
      // da fonte, não mais um valor fixo de 4 pontos. Em fluxogramas
      // densos (como o BPMN de Criação de Painel de BI), as caixas são
      // pequenas e a fonte fica com ~4pt -- então o espaçamento entre
      // DUAS LINHAS da mesma caixa era MENOR que a tolerância fixa. As
      // duas linhas eram tratadas como uma só e reordenadas por X,
      // embaralhando as palavras: "Validar e Teste: realizar s Técnicos
      // istênci ência," em vez de "Validar e realizar Testes Técnicos
      // (consistência, ...)".
      membros.sort(function (a, b) {
        const centroA = (a.y0 + a.y1) / 2, centroB = (b.y0 + b.y1) / 2;
        const diff = topoParaBaixo ? (centroA - centroB) : (centroB - centroA);
        const tolLinha = Math.max(1, Math.min(a.altura, b.altura) * 0.55);
        if (Math.abs(diff) > tolLinha) return diff;
        return a.x0 - b.x0;
      });

      let texto = membros.map(function (m) { return m.texto; })
        .join(" ").replace(/\s+/g, " ").trim();

      // Remove um "Sim"/"Não" (rotulo de ramificacao do losango) que
      // por vezes gruda no final do texto da pergunta de decisao.
      texto = texto.replace(/\s+(Sim|N[ãa]o)$/i, "").trim();

      if (!texto || texto.length < 3 || texto.length > 200) continue;

      const normalizado = texto.toLowerCase();
      if (ignorarIsolado.has(normalizado)) continue;
      if (/^\d+$/.test(texto)) continue;
      if (/^p[áa]gina\s*\d+/i.test(texto)) continue;
      if (nomeProcessoNorm && normalizado === nomeProcessoNorm) continue;
      if (vinculoPareceRaiaOuPiscina(texto)) continue; // 🆕 nome de raia/piscina, não é etapa
      if (vinculoEhRuidoDeInfografico(texto)) continue; // 🆕 selo de unidade, VIA A/B/C, SIM/NÃO, rodapé...
      if (vinculoPareceLixoDeExtracao(texto)) {        // 🆕 fonte ilegível / ruído de OCR
        console.log("[Vinculo] Descartado como lixo de extração:", texto);
        continue;
      }
      if (vistos.has(normalizado)) continue;
      vistos.add(normalizado);

      const xMin = Math.min.apply(null, membros.map(function (m) { return m.x0; }));
      const xMax = Math.max.apply(null, membros.map(function (m) { return m.x1; }));
      const yMin = Math.min.apply(null, membros.map(function (m) { return m.y0; }));
      const yMax = Math.max.apply(null, membros.map(function (m) { return m.y1; }));

      let xFrac, yFrac;
      const wFrac = (xMax - xMin) / larguraBase;
      const hFrac = (yMax - yMin) / alturaBase;
      xFrac = xMin / larguraBase;

      if (topoParaBaixo) {
        yFrac = yMin / alturaBase;
      } else {
        // PDF: Y cresce pra cima. Convertemos pra fracao "topo-para-baixo"
        // (convencao de imagem/canvas usada no resto do sistema).
        yFrac = (alturaBase - yMax) / alturaBase;
      }

      candidatos.push({
        nome: texto,
        yOrdenacao: yFrac,
        xOrdenacao: xFrac,
        bbox: { xFrac: xFrac, yFrac: yFrac, wFrac: wFrac, hFrac: hFrac }
      });
    }
  });

  candidatos.sort(function (a, b) {
    if (Math.abs(a.yOrdenacao - b.yOrdenacao) > 0.01) return a.yOrdenacao - b.yOrdenacao;
    return a.xOrdenacao - b.xOrdenacao;
  });

  return candidatos.map(function (c) { return { nome: c.nome, bbox: c.bbox }; });
}

// ============================================================================
// 🆕 EXTRAÇÃO POR FORMAS (a maneira CERTA de ler um fluxograma)
// ----------------------------------------------------------------------------
// Todas as tentativas anteriores partiam do texto solto e tentavam ADIVINHAR
// quais fragmentos pertenciam à mesma caixa, agrupando por proximidade. Isso
// é frágil por natureza: em diagramas densos (Bizagi, nosso editor BPMN) as
// caixas ficam a poucos pontos umas das outras, e o agrupamento embaralhava
// as palavras ou juntava caixas vizinhas -- gerando chips como
// "M dados apear da: os (fontes...)" ou "o & õ 8 \" E un".
//
// Aqui invertemos a lógica, como você apontou: primeiro lemos as FORMAS
// VETORIAIS que o PDF realmente desenha (os retângulos das tarefas e os
// losangos das decisões) e só depois colocamos cada fragmento de texto
// DENTRO da forma que geometricamente o contém. Não há mais adivinhação:
// - uma forma = uma etapa (exatamente os quadrantes que você quer);
// - texto fora de qualquer forma (raias, rótulos "Sim"/"Não" nas setas,
//   títulos, legendas) simplesmente não vira etapa;
// - o bbox de cada etapa passa a ser o da PRÓPRIA CAIXA, então o mapa de
//   calor encaixa perfeitamente em cima do desenho.
//
// Lemos as formas pelo operatorList do pdf.js (as primitivas de desenho),
// acompanhando a matriz de transformação corrente para converter as
// coordenadas locais de cada path em coordenadas da página.
// ============================================================================

// Multiplica duas matrizes de transformação 2D no formato do PDF
// [a, b, c, d, e, f].
function vinculoMultiplicarMatriz(m1, m2) {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5]
  ];
}

function vinculoAplicarMatriz(m, x, y) {
  return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
}

// Percorre as primitivas de desenho da página e devolve as caixas
// candidatas a etapa, em coordenadas da página (origem embaixo-esquerda,
// como o resto do PDF).
async function vinculoExtrairFormasDaPagina(page) {
  const opList = await page.getOperatorList();
  const OPS = window.pdfjsLib.OPS;

  const formas = [];
  let ctm = [1, 0, 0, 1, 0, 0];
  const pilha = [];
  let pathAtual = null; // {minX, minY, maxX, maxY, pontos}

  const iniciarPath = function () {
    pathAtual = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity, pontos: 0, fechada: false };
  };
  const somarPonto = function (x, y) {
    if (!pathAtual) iniciarPath();
    const p = vinculoAplicarMatriz(ctm, x, y);
    if (p.x < pathAtual.minX) pathAtual.minX = p.x;
    if (p.y < pathAtual.minY) pathAtual.minY = p.y;
    if (p.x > pathAtual.maxX) pathAtual.maxX = p.x;
    if (p.y > pathAtual.maxY) pathAtual.maxY = p.y;
    pathAtual.pontos++;
  };
  // fnPintura informa COMO o caminho foi desenhado:
  //  - preenchida: fill / fillStroke (caixas, losangos, letras desenhadas);
  //  - fechada: tem closePath/rectangle (contorno fechado);
  //  - recorte: endPath (máscara de clip, não aparece na tela);
  //  - aberta e só com stroke = conector/seta (linha em "L" tem área no
  //    bbox, mas NÃO é caixa).
  const fecharPath = function (fnPintura) {
    if (!pathAtual || !isFinite(pathAtual.minX)) { pathAtual = null; return; }
    const w = pathAtual.maxX - pathAtual.minX;
    const h = pathAtual.maxY - pathAtual.minY;
    // Descarta linhas/setas (sem área) e micro-ruído.
    if (w > 6 && h > 6 && pathAtual.pontos >= 3) {
      const preenchida = fnPintura === OPS.fill || fnPintura === OPS.eoFill ||
        fnPintura === OPS.fillStroke || fnPintura === OPS.eoFillStroke ||
        fnPintura === OPS.closeFillStroke || fnPintura === OPS.closeEOFillStroke;
      const fechada = pathAtual.fechada || fnPintura === OPS.closeStroke ||
        fnPintura === OPS.closeFillStroke || fnPintura === OPS.closeEOFillStroke;
      formas.push({
        x0: pathAtual.minX, y0: pathAtual.minY, x1: pathAtual.maxX, y1: pathAtual.maxY, w: w, h: h,
        preenchida: preenchida, fechada: fechada, recorte: fnPintura === OPS.endPath
      });
    }
    pathAtual = null;
  };

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    const args = opList.argsArray[i];

    if (fn === OPS.save) { pilha.push(ctm.slice()); continue; }
    if (fn === OPS.restore) { ctm = pilha.pop() || [1, 0, 0, 1, 0, 0]; continue; }
    if (fn === OPS.transform) { ctm = vinculoMultiplicarMatriz(ctm, args); continue; }

    if (fn === OPS.constructPath) {
      // args = [ops[], coords[]] -- reconstroi o caminho ponto a ponto.
      const ops = args[0], coords = args[1];
      let k = 0;
      for (let o = 0; o < ops.length; o++) {
        const op = ops[o];
        if (op === OPS.moveTo || op === OPS.lineTo) {
          somarPonto(coords[k], coords[k + 1]); k += 2;
        } else if (op === OPS.curveTo) {
          somarPonto(coords[k], coords[k + 1]);
          somarPonto(coords[k + 2], coords[k + 3]);
          somarPonto(coords[k + 4], coords[k + 5]); k += 6;
        } else if (op === OPS.curveTo2 || op === OPS.curveTo3) {
          somarPonto(coords[k], coords[k + 1]);
          somarPonto(coords[k + 2], coords[k + 3]); k += 4;
        } else if (op === OPS.rectangle) {
          const x = coords[k], y = coords[k + 1], w = coords[k + 2], h = coords[k + 3];
          somarPonto(x, y); somarPonto(x + w, y);
          somarPonto(x + w, y + h); somarPonto(x, y + h);
          if (pathAtual) pathAtual.fechada = true;
          k += 4;
        } else if (op === OPS.closePath) {
          if (pathAtual) pathAtual.fechada = true;
        }
      }
      continue;
    }

    // Qualquer operador de pintura encerra o caminho atual.
    if (fn === OPS.fill || fn === OPS.eoFill || fn === OPS.stroke ||
        fn === OPS.fillStroke || fn === OPS.eoFillStroke ||
        fn === OPS.closeFillStroke || fn === OPS.closeEOFillStroke ||
        fn === OPS.closeStroke || fn === OPS.endPath) {
      fecharPath(fn);
    }
  }

  return formas;
}

// Uma forma só é "caixa de etapa" se tiver tamanho plausível: nem a moldura
// da página/raia inteira, nem um micro-ícone.
function vinculoFiltrarFormasDeEtapa(formas, larguraPag, alturaPag) {
  const areaPag = Math.max(1, larguraPag * alturaPag);

  // 🆕 Limiares AFROUXADOS. No fluxograma do Bizagi (Criação de Painel de
  // BI) as caixas são pequenas em relação à página inteira -- várias
  // ficavam abaixo do piso de área antigo (0.0004) ou da largura mínima
  // de 18pt, e o filtro zerava as candidatas. Sem caixas, a detecção caía
  // no último recurso (OCR), que é justamente o que embaralha o texto.
  // Agora aceitamos formas bem menores; o ruído real (linhas/setas) já é
  // barrado antes, em fecharPath(), por não ter área.
  const rejeitadas = { grande: 0, pequena: 0, fina: 0, proporcao: 0 };
  let candidatas = formas.filter(function (f) {
    const area = f.w * f.h;
    if (area / areaPag > 0.35) { rejeitadas.grande++; return false; }    // moldura/raia/pool
    if (area / areaPag < 0.00005) { rejeitadas.pequena++; return false; } // ícone/ruído
    if (f.w < 8 || f.h < 5) { rejeitadas.fina++; return false; }
    const prop = f.w / f.h;
    if (prop > 25 || prop < 0.04) { rejeitadas.proporcao++; return false; } // barra/linha grossa
    return true;
  });

  console.log("[Vinculo][forma] Filtro de formas -- entraram: " + formas.length +
    ", aprovadas: " + candidatas.length +
    " | rejeitadas por: área grande=" + rejeitadas.grande +
    ", área pequena=" + rejeitadas.pequena +
    ", dimensão mínima=" + rejeitadas.fina +
    ", proporção=" + rejeitadas.proporcao);

  // Remove formas praticamente idênticas (contorno + preenchimento
  // desenhados como dois paths sobrepostos).
  candidatas.sort(function (a, b) { return (b.w * b.h) - (a.w * a.h); });
  const finais = [];
  candidatas.forEach(function (f) {
    const repetida = finais.some(function (g) {
      return Math.abs(f.x0 - g.x0) < 3 && Math.abs(f.y0 - g.y0) < 3 &&
             Math.abs(f.x1 - g.x1) < 3 && Math.abs(f.y1 - g.y1) < 3;
    });
    if (!repetida) finais.push(f);
  });

  // Descarta containers que envolvem outras caixas (ex.: o retângulo da
  // raia que contém várias tarefas dentro).
  return finais.filter(function (f) {
    const contidas = finais.filter(function (g) {
      if (g === f) return false;
      return g.x0 >= f.x0 - 2 && g.x1 <= f.x1 + 2 && g.y0 >= f.y0 - 2 && g.y1 <= f.y1 + 2;
    }).length;
    return contidas < 2;
  });
}

// Junta forma + texto: cada fragmento vai para a MENOR forma que contém
// seu centro. Depois montamos o rótulo lendo as linhas de cima para baixo.
function vinculoMontarEtapasPorForma(formas, itens, larguraBase, alturaBase, nomeProcesso) {
  if (!formas.length) return [];

  const caixas = formas.map(function (f) {
    return { forma: f, fragmentos: [], area: f.w * f.h };
  });

  itens.forEach(function (it) {
    const cx = (it.x0 + it.x1) / 2;
    const cy = (it.y0 + it.y1) / 2;
    let escolhida = null;
    caixas.forEach(function (c) {
      const f = c.forma;
      if (cx >= f.x0 && cx <= f.x1 && cy >= f.y0 && cy <= f.y1) {
        if (!escolhida || c.area < escolhida.area) escolhida = c;
      }
    });
    if (escolhida) escolhida.fragmentos.push(it);
  });

  const nomeProcessoNorm = (nomeProcesso || "").trim().toLowerCase();
  const vistos = new Set();
  const etapas = [];

  caixas.forEach(function (c) {
    if (!c.fragmentos.length) return;

    const membros = vinculoRemoverFragmentosDuplicados(c.fragmentos);

    // Ordem de leitura dentro da caixa: topo -> base (PDF cresce pra cima),
    // e esquerda -> direita dentro da mesma linha.
    membros.sort(function (a, b) {
      const cA = (a.y0 + a.y1) / 2, cB = (b.y0 + b.y1) / 2;
      const diff = cB - cA;
      const tol = Math.max(1, Math.min(a.altura, b.altura) * 0.55);
      if (Math.abs(diff) > tol) return diff;
      return a.x0 - b.x0;
    });

    let texto = membros.map(function (m) { return m.texto; })
      .join(" ").replace(/\s+/g, " ").trim();
    texto = texto.replace(/\s+(Sim|N[ãa]o)$/i, "").trim();
    texto = vinculoLimparSufixoDeSelo(texto);

    if (!texto || texto.length < 3 || texto.length > 200) return;

    const norm = texto.toLowerCase();
    if (norm === nomeProcessoNorm) return;
    if (vinculoPareceRaiaOuPiscina(texto)) return;
    if (vinculoEhRuidoDeInfografico(texto)) return;
    if (vinculoPareceLixoDeExtracao(texto)) {
      console.log("[Vinculo][forma] Descartado como lixo:", texto);
      return;
    }
    if (vistos.has(norm)) return;
    vistos.add(norm);

    const f = c.forma;
    etapas.push({
      nome: texto,
      // Converte pra fração 0..1 com origem no TOPO-ESQUERDA (convenção
      // usada pelo mapa de calor). A caixa É o bbox -- encaixe exato.
      bbox: {
        xFrac: f.x0 / larguraBase,
        yFrac: (alturaBase - f.y1) / alturaBase,
        wFrac: f.w / larguraBase,
        hFrac: f.h / alturaBase
      },
      _x: f.x0,
      _y: f.y1
    });
  });

  // Ordem de leitura do fluxo: esquerda -> direita, topo -> base.
  etapas.sort(function (a, b) {
    if (Math.abs(a._x - b._x) > 20) return a._x - b._x;
    return b._y - a._y;
  });

  return etapas.map(function (e) { return { nome: e.nome, bbox: e.bbox }; });
}

// Caminho principal por formas: para cada página pedida, lê as caixas
// desenhadas e o texto, e devolve uma etapa por caixa preenchida.
async function vinculoExtrairEtapasPorFormasPdf(url, nomeProcesso, paginasDesejadas) {
  await vinculoInjetarPdfJs();
  const buffer = await vinculoBaixarPdfBuffer(url);
  const pdf = await window.pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;

  const paginas = paginasDesejadas && paginasDesejadas.length
    ? paginasDesejadas.filter(function (n) { return n >= 1 && n <= pdf.numPages; })
    : Array.from({ length: pdf.numPages }, function (_, i) { return i + 1; });

  for (let idx = 0; idx < paginas.length; idx++) {
    const p = paginas[idx];
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 1 });

    let formas = [];
    try {
      formas = await vinculoExtrairFormasDaPagina(page);
    } catch (e) {
      console.warn("[Vinculo][forma] Não consegui ler as formas da página " + p + ":", e);
      continue;
    }

    const caixas = vinculoFiltrarFormasDeEtapa(formas, viewport.width, viewport.height);
    console.log("[Vinculo][forma] Página " + p + ": " + formas.length +
      " forma(s) desenhada(s), " + caixas.length + " candidata(s) a caixa de etapa.");
    if (!caixas.length) continue;

    const content = await page.getTextContent();
    const itens = content.items
      .filter(function (it) { return it.str && it.str.trim(); })
      .map(function (it) {
        const t = it.transform;
        const angulo = Math.atan2(t[1], t[0]);
        const altura = Math.hypot(t[2], t[3]) || 10;
        const largura = it.width || (it.str.length * altura * 0.5);
        const grausAbs = Math.abs(angulo) * 180 / Math.PI;
        return {
          texto: it.str,
          x0: t[4], x1: t[4] + largura,
          y0: t[5] - altura, y1: t[5],
          altura: altura,
          vertical: grausAbs > 75 && grausAbs < 105
        };
      })
      .filter(function (it) { return !it.vertical; });

    const etapas = vinculoMontarEtapasPorForma(
      caixas, itens, viewport.width, viewport.height, nomeProcesso
    );

    if (etapas.length >= 2) {
      console.log("[Vinculo][forma] Página " + p + ": " + etapas.length + " etapa(s) lida(s) das caixas.",
        etapas.map(function (e) { return e.nome; }));
      return etapas;
    }

    // 🆕 Diagnóstico: se havia caixas mas quase nenhuma virou etapa, o
    // problema não é o filtro de formas e sim o texto não estar caindo
    // DENTRO delas (coordenadas divergentes) ou ter sido barrado pelos
    // filtros de ruído. Sem este log ficava impossível distinguir os casos.
    console.log("[Vinculo][forma] Página " + p + ": apenas " + etapas.length +
      " etapa(s) saíram de " + caixas.length + " caixa(s) e " + itens.length +
      " fragmento(s) de texto. Seguindo para os outros métodos.");
  }

  return [];
}

// ============================================================================
// 🆕 ITEM ② — LEITURA DIRETA DO BPMN 2.0 (Bizagi Modeler)
// ----------------------------------------------------------------------------
// O Bizagi exporta o diagrama em BPMN 2.0 XML (aba Export/Import > BPMN).
// Esse arquivo contém o nome EXATO de cada tarefa e gateway, além das
// coordenadas de cada caixa no bloco BPMNDiagram. Lendo dele, não há OCR,
// não há heurística e não há texto quebrado -- é a mesma qualidade que já
// temos nos fluxogramas criados no editor do próprio sistema.
//
// Usamos DOMParser (nativo do navegador), sem depender do bpmn-js estar
// carregado nesta página. Buscamos os elementos por localName, ignorando
// prefixos de namespace, porque cada ferramenta exporta com um prefixo
// diferente (bpmn:, semantic:, ns0:, ou nenhum).
// ============================================================================
const VINCULO_TIPOS_ETAPA_BPMN = [
  "task", "userTask", "serviceTask", "manualTask", "scriptTask",
  "sendTask", "receiveTask", "businessRuleTask", "callActivity", "subProcess",
  "exclusiveGateway", "inclusiveGateway", "parallelGateway", "eventBasedGateway"
];

async function vinculoExtrairEtapasDoBpmn(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error("Não foi possível baixar o arquivo BPMN (HTTP " + resp.status + ").");
  const texto = await resp.text();

  const doc = new DOMParser().parseFromString(texto, "application/xml");
  const erroParse = doc.getElementsByTagName("parsererror");
  if (erroParse && erroParse.length) {
    throw new Error("O arquivo não é um XML válido.");
  }

  // 1) Elementos de processo: id -> nome, apenas dos tipos que são etapa.
  const porId = {};
  const todos = doc.getElementsByTagName("*");
  for (let i = 0; i < todos.length; i++) {
    const el = todos[i];
    const tipo = el.localName;
    if (VINCULO_TIPOS_ETAPA_BPMN.indexOf(tipo) === -1) continue;
    const id = el.getAttribute("id");
    const nome = (el.getAttribute("name") || "").replace(/\s+/g, " ").trim();
    if (!id || !nome) continue; // sem nome não vira etapa
    porId[id] = { id: id, nome: nome, tipo: tipo };
  }

  if (!Object.keys(porId).length) return [];

  // 2) Posições: BPMNShape referencia o elemento via bpmnElement e traz
  //    um <Bounds x y width height>.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < todos.length; i++) {
    const el = todos[i];
    if (el.localName !== "BPMNShape") continue;
    const ref = el.getAttribute("bpmnElement");
    if (!ref || !porId[ref]) continue;

    let bounds = null;
    for (let k = 0; k < el.children.length; k++) {
      if (el.children[k].localName === "Bounds") { bounds = el.children[k]; break; }
    }
    if (!bounds) continue;

    const x = parseFloat(bounds.getAttribute("x"));
    const y = parseFloat(bounds.getAttribute("y"));
    const w = parseFloat(bounds.getAttribute("width"));
    const h = parseFloat(bounds.getAttribute("height"));
    if (![x, y, w, h].every(function (n) { return isFinite(n); })) continue;

    porId[ref].pos = { x: x, y: y, w: w, h: h };
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x + w > maxX) maxX = x + w;
    if (y + h > maxY) maxY = y + h;
  }

  // 3) Converte as posições para fração 0..1 dentro da extensão do desenho.
  const temExtensao = isFinite(minX) && maxX > minX && maxY > minY;
  const larguraTotal = maxX - minX;
  const alturaTotal = maxY - minY;

  const etapas = Object.keys(porId).map(function (id) {
    const e = porId[id];
    let bbox = null;
    if (temExtensao && e.pos) {
      bbox = {
        xFrac: (e.pos.x - minX) / larguraTotal,
        yFrac: (e.pos.y - minY) / alturaTotal,
        wFrac: e.pos.w / larguraTotal,
        hFrac: e.pos.h / alturaTotal
      };
    }
    return { nome: e.nome, bbox: bbox, _x: e.pos ? e.pos.x : 0, _y: e.pos ? e.pos.y : 0 };
  });

  // Ordem de leitura do fluxo: esquerda -> direita, topo -> base.
  etapas.sort(function (a, b) {
    if (Math.abs(a._x - b._x) > 20) return a._x - b._x;
    return a._y - b._y;
  });

  // Remove nomes repetidos preservando a ordem.
  const vistos = new Set();
  const finais = [];
  etapas.forEach(function (e) {
    const chave = e.nome.toLowerCase();
    if (vistos.has(chave)) return;
    vistos.add(chave);
    finais.push({ nome: e.nome, bbox: e.bbox });
  });

  console.log("[Vinculo][bpmn] " + finais.length + " etapa(s) lidas do modelo BPMN:",
    finais.map(function (e) { return e.nome; }));
  return finais;
}

async function vinculoExtrairEtapasVisuaisPdf(url, nomeProcesso, paginasDesejadas) {
  const fontes = await vinculoExtrairItensBrutosPdf(url, paginasDesejadas);
  return vinculoAgruparBlocosVisuais(fontes, nomeProcesso);
}

// 🆕 Equivalente ao de cima, mas para imagens (PNG/JPG): usa OCR em vez
// de texto embutido de PDF. Mesma função de agrupamento por trás.
async function vinculoExtrairEtapasVisuaisImagem(url, nomeProcesso) {
  const fontes = await vinculoExtrairItensBrutosImagem(url);
  return vinculoAgruparBlocosVisuais(fontes, nomeProcesso);
}

// 🆕 Último recurso para PDF: renderiza a página como imagem e usa OCR
// (Tesseract), igual fazemos com PNG/JPG. Usado só quando o PDF não tem
// NENHUM texto embutido aproveitável -- nem numerado, nem em caixas.
// ============================================================================
// OCR CAIXA A CAIXA (fluxogramas com texto convertido em desenho)
// ----------------------------------------------------------------------------
// Mesmo sem texto, o PDF do Bizagi ainda tem as caixas desenhadas como
// vetores. Então: lemos as caixas direto do PDF, renderizamos a página em
// alta resolução, recortamos CADA caixa e passamos só ela ao OCR.
// Cada caixa vira UMA etapa, com o bbox exato para o mapa de calor.
// Se o PDF não tiver caixas vetoriais, cai no OCR em blocos.
// ============================================================================
function vinculoLimparTextoOcrCaixa(bruto) {
  let t = String(bruto || "");
  t = t.replace(/-\s*\n\s*/g, "");
  t = t.replace(/[\r\n]+/g, " ");
  t = t.replace(/[|_~`^<>{}\[\]\\=+*#@]/g, " ");
  t = t.replace(/[“”"]/g, "");
  t = t.replace(/\s+([,.;:)?!])/g, "$1");
  t = t.replace(/\(\s+/g, "(");
  t = t.replace(/\s+/g, " ").trim();
  t = t.replace(/^[^A-Za-zÀ-ÿ0-9(]+/, "").replace(/[^A-Za-zÀ-ÿ0-9).?]+$/, "");
  return t.trim();
}

// Recorta a caixa, tira o fundo azul-claro e amplia o texto para o OCR.
function vinculoRecortarCaixaParaOcr(canvas, r) {
  const inset = Math.max(2, Math.round(Math.min(r.w, r.h) * 0.06));
  const sx = Math.max(0, Math.round(r.x + inset)), sy = Math.max(0, Math.round(r.y + inset));
  const sw = Math.min(canvas.width - sx, Math.round(r.w - inset * 2));
  const sh = Math.min(canvas.height - sy, Math.round(r.h - inset * 2));
  if (sw < 8 || sh < 8) return null;
  const amp = sh < 160 ? Math.min(4, 160 / sh) : 1;
  const pad = 16;
  const c = document.createElement("canvas");
  c.width = Math.round(sw * amp) + pad * 2;
  c.height = Math.round(sh * amp) + pad * 2;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(canvas, sx, sy, sw, sh, pad, pad, c.width - pad * 2, c.height - pad * 2);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  let escuros = 0;
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = lum > 175 ? 255 : (lum < 95 ? 0 : Math.round((lum - 95) * 255 / 80));
    if (v < 128) escuros++;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  if (escuros < 20) return null; // caixa vazia (losango sem texto, círculo...)
  ctx.putImageData(img, 0, 0);
  return c;
}

// Filtro de caixas para o OCR caixa a caixa.
// O texto convertido em desenho vira FORMAS DENTRO da caixa (uma por linha
// ou por letra). A regra antiga ("descarta quem contém 2+ formas") jogava
// fora a própria caixa e ficava com as linhas de texto -- por isso
// "Ordenar no Projudi" virava "Ordenar no" + "Projudi". Agora:
//   1) tira raias/piscina pelo TAMANHO (ocupam boa parte da página);
//   2) fica só com as formas de FORA (que não estão dentro de outra);
//      as linhas/letras de dentro da caixa são descartadas;
//   3) descarta rótulos soltos ("Sim", "Não", "Dúvida?"), que têm a altura
//      de 1-2 linhas de texto, menores que uma caixa de etapa.
function vinculoFiltrarCaixasParaOcr(formas, larguraPag, alturaPag) {
  const tol = 2;
  const dentro = function (g, f) {
    return g.x0 >= f.x0 - tol && g.x1 <= f.x1 + tol && g.y0 >= f.y0 - tol && g.y1 <= f.y1 + tol;
  };

  // 0) Só formas VISÍVEIS e FECHADAS/PREENCHIDAS. Conectores (linhas em
  //    "L" ou "U" entre as caixas) têm área no bbox e "engoliam" várias
  //    caixas -- as caixas viravam "internas" e eram descartadas (foi o que
  //    bagunçou o fluxograma de Expedição de Alvará). Máscaras de recorte
  //    (clip) também saem.
  const totalAntes = formas.length;
  formas = formas.filter(function (f) {
    if (f.recorte) return false;
    if (f.preenchida === undefined) return true; // versão antiga sem a info: mantém
    return f.preenchida || f.fechada;
  });
  console.log("[OCR-caixa] Conectores/recortes descartados: " + (totalAntes - formas.length));

  // 0.1) Remove repetidas (contorno + preenchimento desenhados separados).
  const ordenadas = formas.slice().sort(function (a, b) { return (b.w * b.h) - (a.w * a.h); });
  const unicas = [];
  ordenadas.forEach(function (f) {
    const rep = unicas.some(function (g) {
      return Math.abs(f.x0 - g.x0) < 3 && Math.abs(f.y0 - g.y0) < 3 &&
             Math.abs(f.x1 - g.x1) < 3 && Math.abs(f.y1 - g.y1) < 3;
    });
    if (!rep) unicas.push(f);
  });

  // 1) Raias, piscina, moldura e ícones minúsculos.
  const semRaias = unicas.filter(function (f) {
    if (f.w > larguraPag * 0.35 || f.h > alturaPag * 0.35) return false;
    if (f.w < 12 || f.h < 8) return false;
    return true;
  });

  // 2) Só as de fora. As de dentro = linhas/letras do texto da caixa.
  const externas = [], internas = [];
  semRaias.forEach(function (f) {
    const estaDentro = semRaias.some(function (g) {
      return g !== f && (g.w * g.h) > (f.w * f.h) && dentro(f, g);
    });
    (estaDentro ? internas : externas).push(f);
  });

  // 3) Altura típica de uma linha de texto (pelas formas internas).
  let alturaLinha = 0;
  if (internas.length) {
    const hs = internas.map(function (f) { return f.h; }).sort(function (a, b) { return a - b; });
    alturaLinha = hs[Math.floor(hs.length / 2)];
  }

  const caixas = externas.filter(function (f) {
    if (f.h > f.w * 1.6) return false;                          // faixa vertical (cabeçalho de raia)
    if (alturaLinha && f.h < alturaLinha * 2.8) return false;   // rótulo solto de seta/decisão
    return true;
  });

  console.log("[OCR-caixa] Formas: " + formas.length + " | únicas: " + unicas.length +
    " | sem raias: " + semRaias.length + " | externas: " + externas.length +
    " | linhas de texto internas: " + internas.length +
    " (altura típica " + alturaLinha.toFixed(1) + ") | caixas finais: " + caixas.length);
  return caixas;
}

async function vinculoExtrairEtapasPorCaixasOcrPdf(url, nomeProcesso) {
  await vinculoInjetarPdfJs();
  const buffer = await vinculoBaixarPdfBuffer(url);
  const pdf = await window.pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;
  const paginas = Math.min(pdf.numPages, 3);

  for (let p = 1; p <= paginas; p++) {
    const page = await pdf.getPage(p);
    const vp1 = page.getViewport({ scale: 1 });

    let formas = [];
    try { formas = await vinculoExtrairFormasDaPagina(page); } catch (e) { formas = []; }
    const caixas = vinculoFiltrarCaixasParaOcr(formas, vp1.width, vp1.height);
    console.log("[OCR-caixa] Página " + p + ": " + caixas.length + " caixa(s) candidata(s).");
    if (caixas.length < 2) continue;

    vinculoStatusOcr("Renderizando o fluxograma em alta resolução...");
    const escala = vinculoEscalaSegura(vp1.width, vp1.height, Math.max(3000, vp1.width * 5));
    const viewport = page.getViewport({ scale: escala });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: viewport }).promise;

    // Coordenadas do PDF -> pixels do canvas (respeita origem e rotação).
    const rects = caixas.map(function (f) {
      const q = viewport.convertToViewportRectangle([f.x0, f.y0, f.x1, f.y1]);
      const x = Math.min(q[0], q[2]), y = Math.min(q[1], q[3]);
      return { x: x, y: y, w: Math.abs(q[2] - q[0]), h: Math.abs(q[3] - q[1]) };
    });

    await vinculoInjetarTesseract();
    let worker = null;
    try {
      worker = await window.Tesseract.createWorker("por");
      try { await worker.setParameters({ tessedit_pageseg_mode: "6", preserve_interword_spaces: "1" }); } catch (e) {}
    } catch (e) {
      console.warn("[OCR-caixa] createWorker indisponível:", e);
      worker = null;
    }

    const nomeProcNorm = String(nomeProcesso || "").trim().toLowerCase();
    const vistos = new Set();
    const etapas = [];
    try {
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        vinculoStatusOcr("Lendo as caixas do fluxograma por OCR: " + (i + 1) + " de " + rects.length + "...");
        const recorte = vinculoRecortarCaixaParaOcr(canvas, r);
        if (!recorte) continue;
        const blob = await new Promise(function (res) { recorte.toBlob(res, "image/png"); });
        if (!blob) continue;
        const res = worker
          ? await worker.recognize(blob)
          : await window.Tesseract.recognize(blob, "por", { tessedit_pageseg_mode: "6" });
        const conf = res && res.data ? Number(res.data.confidence) || 0 : 0;
        const texto = vinculoLimparTextoOcrCaixa(res && res.data ? res.data.text : "");
        if (!texto || texto.length < 3 || texto.length > 200) continue;
        if (conf < 35) { console.log("[OCR-caixa] Baixa confiança (" + Math.round(conf) + "):", texto); continue; }
        if (!/[A-Za-zÀ-ÿ]{3,}/.test(texto)) continue;
        const norm = texto.toLowerCase();
        if (norm === nomeProcNorm || vistos.has(norm)) continue;
        if (vinculoPareceRaiaOuPiscina(texto)) continue;
        if (vinculoEhRuidoDeInfografico(texto)) continue;
        vistos.add(norm);
        etapas.push({
          nome: texto,
          bbox: {
            xFrac: r.x / canvas.width,
            yFrac: r.y / canvas.height,
            wFrac: r.w / canvas.width,
            hFrac: r.h / canvas.height
          },
          _x: r.x, _y: r.y
        });
      }
    } finally {
      if (worker) { try { await worker.terminate(); } catch (e) {} }
    }

    // Ordem do fluxo: esquerda -> direita, topo -> base.
    const tolX = canvas.width * 0.01;
    etapas.sort(function (a, b) {
      if (Math.abs(a._x - b._x) > tolX) return a._x - b._x;
      return a._y - b._y;
    });
    console.log("[OCR-caixa] Página " + p + ": " + etapas.length + " etapa(s) lida(s) caixa a caixa.",
      etapas.map(function (e) { return e.nome; }));
    if (etapas.length >= 2) {
      return etapas.map(function (e) { return { nome: e.nome, bbox: e.bbox }; });
    }
  }
  return [];
}

// Último recurso para PDF sem texto embutido: primeiro tenta caixa a caixa
// (preciso); se o PDF não tiver caixas vetoriais, usa o OCR em blocos.
async function vinculoExtrairEtapasViaOcrPdf(url, nomeProcesso) {
  try {
    const porCaixa = await vinculoExtrairEtapasPorCaixasOcrPdf(url, nomeProcesso);
    if (porCaixa.length >= 2) return porCaixa;
  } catch (e) {
    console.warn("[OCR-caixa] Falhou, usando o OCR em blocos:", e);
  }
  const fontes = await vinculoExtrairItensBrutosPdfViaOcr(url);
  return vinculoAgruparBlocosVisuais(fontes, nomeProcesso);
}

// Mostra o fluxograma dentro do modal: imagem direta (PNG/JPG) ou a
// primeira página do PDF renderizada em canvas (mesma lib pdf.js já
// usada na extração de texto).
// 🆕 Mostra o fluxograma dentro do modal com ZOOM e ROLAGEM.
// Fluxogramas do Bizagi costumam ser páginas muito largas e baixas;
// encaixar na largura do modal deixava o desenho ilegível. Agora:
//  - página larga  -> abre ajustada à ALTURA, com rolagem horizontal;
//  - página normal -> abre ajustada à LARGURA (como antes);
//  - botões: Ajustar, -, 100%, + (e Ctrl + roda do mouse).
// ============================================================
// TELA CHEIA DO FLUXOGRAMA (botão "expandir" no canto da imagem)
// Zoom: roda do mouse, botões + / − ou duplo clique. Arrastar move.
// Esc ou X fecha.
// ============================================================
function vinculoEstiloTelaCheia() {
  if (document.getElementById("estiloVinculoTelaCheia")) return;
  const st = document.createElement("style");
  st.id = "estiloVinculoTelaCheia";
  st.textContent =
    ".vinculo-expand-wrap{position:relative;}" +
    ".vinculo-btn-expandir{position:absolute;top:8px;right:8px;z-index:3;width:36px;height:36px;border-radius:9px;" +
      "border:1px solid rgba(255,255,255,.25);background:rgba(15,40,60,.85);color:#ffffff;font-size:16px;" +
      "display:flex;align-items:center;justify-content:center;cursor:pointer;" +
      "box-shadow:0 4px 12px rgba(0,0,0,.35);transition:transform .15s ease,background .15s ease;}" +
    ".vinculo-btn-expandir:hover{transform:scale(1.08);background:#0b7d8c;}" +
    ".vinculo-tc{position:fixed;inset:0;z-index:2147483000;background:#07121b;display:flex;flex-direction:column;}" +
    ".vinculo-tc-barra{display:flex;align-items:center;gap:8px;padding:10px 14px;background:#0f2333;" +
      "border-bottom:1px solid rgba(255,255,255,.10);color:#e6f1f5;font-size:13px;}" +
    ".vinculo-tc-barra .tit{flex:1;font-weight:700;color:#5fe3f5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
    ".vinculo-tc-barra button{min-width:36px;height:34px;padding:0 10px;border-radius:8px;cursor:pointer;" +
      "border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#e6f1f5;font-size:14px;font-weight:700;}" +
    ".vinculo-tc-barra button:hover{background:#0b7d8c;}" +
    ".vinculo-tc-barra .pct{min-width:52px;text-align:center;font-weight:700;}" +
    ".vinculo-tc-area{flex:1;overflow:hidden;position:relative;cursor:grab;}" +
    ".vinculo-tc-area.arrastando{cursor:grabbing;}" +
    ".vinculo-tc-area canvas{position:absolute;left:0;top:0;transform-origin:0 0;background:#ffffff;image-rendering:auto;" +
      "box-shadow:0 10px 30px rgba(0,0,0,.5);border-radius:6px;}" +
    ".vinculo-tc-dica{padding:6px 14px;font-size:11.5px;color:#8fa9b5;background:#0f2333;}" +
    ".vinculo-tc-carregando{position:absolute;right:14px;bottom:12px;z-index:2;padding:6px 12px;border-radius:8px;" +
      "background:rgba(15,35,51,.9);color:#5fe3f5;font-size:12px;font-weight:700;}";
  document.head.appendChild(st);
}

// Escala máxima segura para o canvas (limite de área/lado dos navegadores).
function vinculoEscalaSegura(largura, altura, larguraDesejada) {
  let esc = larguraDesejada / largura;
  const AREA_MAX = 16000000, LADO_MAX = 15000;
  esc = Math.min(esc, Math.sqrt(AREA_MAX / (largura * altura)), LADO_MAX / largura, LADO_MAX / altura);
  return Math.max(0.5, esc);
}

// Renderiza a 1ª página do PDF em ALTA resolução (para tela cheia / mapa de calor).
async function vinculoRenderizarPdfAlta(url, larguraDesejada) {
  await vinculoInjetarPdfJs();
  const buffer = await vinculoBaixarPdfBuffer(url);
  const pdf = await window.pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;
  const page = await pdf.getPage(1);
  const vp1 = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: vinculoEscalaSegura(vp1.width, vp1.height, larguraDesejada) });
  const c = document.createElement("canvas");
  c.width = Math.floor(viewport.width);
  c.height = Math.floor(viewport.height);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport: viewport }).promise;
  return c;
}

// Coloca o botão de expandir sobre "elemento" (canvas ou img).
// fonteAlta (opcional): função async que devolve uma versão em alta resolução.
function vinculoAdicionarBotaoExpandir(elemento, titulo, fonteAlta) {
  vinculoEstiloTelaCheia();
  const pai = elemento.parentNode;
  if (!pai) return;
  const wrap = document.createElement("div");
  wrap.className = "vinculo-expand-wrap";
  pai.insertBefore(wrap, elemento);
  wrap.appendChild(elemento);
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "vinculo-btn-expandir";
  btn.title = "Expandir fluxograma";
  btn.innerHTML = '<i class="bi bi-arrows-fullscreen"></i>';
  btn.addEventListener("click", function (e) {
    e.stopPropagation();
    vinculoAbrirTelaCheia(elemento, titulo, fonteAlta);
  });
  wrap.appendChild(btn);
}

function vinculoAbrirTelaCheia(origem, titulo, fonteAlta) {
  vinculoEstiloTelaCheia();
  let W = origem.naturalWidth || origem.width, H = origem.naturalHeight || origem.height;
  let cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  cv.getContext("2d").drawImage(origem, 0, 0);

  const tela = document.createElement("div");
  tela.className = "vinculo-tc";
  tela.innerHTML =
    '<div class="vinculo-tc-barra">' +
      '<span class="tit"><i class="bi bi-diagram-3"></i> ' + escapeHTML(titulo || "Fluxograma") + '</span>' +
      '<button type="button" data-a="menos" title="Diminuir">−</button>' +
      '<span class="pct">100%</span>' +
      '<button type="button" data-a="mais" title="Aumentar">+</button>' +
      '<button type="button" data-a="ajustar" title="Ajustar à tela"><i class="bi bi-arrows-angle-contract"></i> Ajustar</button>' +
      '<button type="button" data-a="fechar" title="Fechar (Esc)"><i class="bi bi-x-lg"></i></button>' +
    '</div>' +
    '<div class="vinculo-tc-area"></div>' +
    '<div class="vinculo-tc-dica">Roda do mouse = zoom · arraste para mover · duplo clique = aproximar</div>';
  document.body.appendChild(tela);
  const area = tela.querySelector(".vinculo-tc-area");
  const pct = tela.querySelector(".pct");
  area.appendChild(cv);

  let esc = 1, tx = 0, ty = 0, escMin = 0.1;
  function aplicar() {
    cv.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + esc + ")";
    pct.textContent = Math.round(esc * 100) + "%";
  }
  function ajustar() {
    const aw = area.clientWidth - 40, ah = area.clientHeight - 40;
    esc = Math.min(aw / W, ah / H);
    escMin = Math.min(esc, 1) * 0.5;
    tx = (area.clientWidth - W * esc) / 2;
    ty = (area.clientHeight - H * esc) / 2;
    aplicar();
  }
  function zoomEm(fator, px, py) {
    const novo = Math.max(escMin, Math.min(3, esc * fator));
    tx = px - (px - tx) * (novo / esc);
    ty = py - (py - ty) * (novo / esc);
    esc = novo;
    aplicar();
  }
  function centro() { return [area.clientWidth / 2, area.clientHeight / 2]; }

  area.addEventListener("wheel", function (e) {
    e.preventDefault();
    const r = area.getBoundingClientRect();
    zoomEm(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  area.addEventListener("dblclick", function (e) {
    const r = area.getBoundingClientRect();
    zoomEm(1.6, e.clientX - r.left, e.clientY - r.top);
  });

  let arrasto = null;
  area.addEventListener("pointerdown", function (e) {
    arrasto = { x: e.clientX, y: e.clientY, tx: tx, ty: ty };
    area.classList.add("arrastando");
    area.setPointerCapture(e.pointerId);
  });
  area.addEventListener("pointermove", function (e) {
    if (!arrasto) return;
    tx = arrasto.tx + (e.clientX - arrasto.x);
    ty = arrasto.ty + (e.clientY - arrasto.y);
    aplicar();
  });
  function soltar() { arrasto = null; area.classList.remove("arrastando"); }
  area.addEventListener("pointerup", soltar);
  area.addEventListener("pointercancel", soltar);

  function fechar() {
    document.removeEventListener("keydown", tecla, true);
    window.removeEventListener("resize", ajustar);
    tela.remove();
  }
  function tecla(e) {
    if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); fechar(); }
    else if (e.key === "+" || e.key === "=") { const c = centro(); zoomEm(1.2, c[0], c[1]); }
    else if (e.key === "-") { const c = centro(); zoomEm(1 / 1.2, c[0], c[1]); }
    else if (e.key === "0") ajustar();
  }
  document.addEventListener("keydown", tecla, true);
  window.addEventListener("resize", ajustar);

  tela.querySelector(".vinculo-tc-barra").addEventListener("click", function (e) {
    const b = e.target.closest("button"); if (!b) return;
    const a = b.getAttribute("data-a"), c = centro();
    if (a === "mais") zoomEm(1.25, c[0], c[1]);
    else if (a === "menos") zoomEm(1 / 1.25, c[0], c[1]);
    else if (a === "ajustar") ajustar();
    else if (a === "fechar") fechar();
  });

  requestAnimationFrame(ajustar);

  // Troca pela versão em alta resolução (nítida com zoom), mantendo a posição.
  if (typeof fonteAlta === "function") {
    const aviso = document.createElement("div");
    aviso.className = "vinculo-tc-carregando";
    aviso.innerHTML = '<i class="bi bi-arrow-repeat"></i> Carregando alta resolução...';
    area.appendChild(aviso);
    Promise.resolve().then(fonteAlta).then(function (alta) {
      aviso.remove();
      if (!alta || !document.body.contains(tela)) return;
      const Wn = alta.width, Hn = alta.height;
      if (Wn <= W) return;
      const fator = W / Wn;
      area.replaceChild(alta, cv);
      cv = alta; W = Wn; H = Hn;
      esc = esc * fator;
      escMin = escMin * fator;
      aplicar();
    }).catch(function (e) {
      aviso.remove();
      console.warn("[Vinculo] Alta resolução indisponível:", e);
    });
  }
}

// Recorta as bordas brancas do desenho (PDF com o fluxograma só no topo da
// página, por exemplo). Devolve o retângulo útil + margem.
function vinculoAreaUtil(canvas) {
  const w = canvas.width, h = canvas.height;
  const ctx = canvas.getContext("2d");
  const dados = ctx.getImageData(0, 0, w, h).data;
  const passo = Math.max(1, Math.floor(Math.max(w, h) / 1500)); // amostragem p/ ser rápido
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y += passo) {
    for (let x = 0; x < w; x += passo) {
      const i = (y * w + x) * 4;
      if (dados[i + 3] > 10 && (dados[i] < 235 || dados[i + 1] < 235 || dados[i + 2] < 235)) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return { x: 0, y: 0, w: w, h: h }; // página vazia: mantém
  const margem = Math.round(Math.max(w, h) * 0.012);
  const x = Math.max(0, x0 - margem), y = Math.max(0, y0 - margem);
  return {
    x: x, y: y,
    w: Math.min(w, x1 + passo + margem) - x,
    h: Math.min(h, y1 + passo + margem) - y
  };
}

function vinculoCortarCanvas(canvas, area) {
  if (area.x === 0 && area.y === 0 && area.w === canvas.width && area.h === canvas.height) return canvas;
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(area.w));
  out.height = Math.max(1, Math.round(area.h));
  const ctx = out.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(canvas, area.x, area.y, area.w, area.h, 0, 0, area.w, area.h);
  return out;
}

function vinculoRecortarBranco(canvas) {
  try { return vinculoCortarCanvas(canvas, vinculoAreaUtil(canvas)); }
  catch (e) { return canvas; } // canvas bloqueado por CORS: mostra sem recorte
}

async function vinculoRenderizarPreviewFluxograma(anexo) {
  const alvo = _vinculoModalAtual && _vinculoModalAtual.querySelector("#vinculoFluxogramaPreview");
  if (!alvo) return;

  if (!anexo) {
    alvo.innerHTML = '<div class="vinculo-vazio-lista">Nenhum fluxograma anexado a este processo em "Mapas do Processo".</div>';
    return;
  }

  if (anexo.tipo === "application/bpmn+xml") {
    alvo.innerHTML =
      '<div class="vinculo-vazio-lista" style="padding:12px 14px;border-radius:9px;' +
      'background:rgba(58,212,138,.08);border:1px solid rgba(58,212,138,.28);color:#8fe0b4;">' +
        '<i class="bi bi-file-earmark-code"></i> <strong>Modelo BPMN do Bizagi.</strong> ' +
        'Não é uma imagem — é o modelo estruturado do processo. ' +
        'Dele saem os nomes <strong>exatos</strong> de cada tarefa e decisão, sem OCR e sem texto quebrado.' +
        '<div style="margin-top:6px;opacity:.85;">Para o mapa de calor sobre o desenho, mantenha também o PDF ou a imagem anexada.</div>' +
      '</div>';
    return;
  }

  // Visor que ocupa 100% da largura; a altura acompanha a proporção do desenho.
  function montarVisor(elemento, rodape) {
    alvo.innerHTML =
      '<div class="vinculo-visor" style="width:100%;border-radius:8px;overflow:hidden;' +
      'border:1px solid rgba(255,255,255,.12);background:#ffffff;"></div>';
    const visor = alvo.querySelector(".vinculo-visor");
    elemento.style.cssText = "display:block;width:100%;height:auto;max-width:100%;";
    visor.appendChild(elemento);
    vinculoAdicionarBotaoExpandir(elemento, anexo.nome || "Fluxograma",
      anexo.tipo === "application/pdf"
        ? function () {
            return vinculoRenderizarPdfAlta(anexo.url, 9000).then(vinculoRecortarBranco);
          }
        : null);
    if (rodape) alvo.appendChild(rodape);
  }

  if (anexo.tipo === "image/png" || anexo.tipo === "image/jpeg") {
    const img = new Image();
    img.alt = "Fluxograma";
    img.crossOrigin = "anonymous";
  img.onload = function () {
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const cx = c.getContext("2d");
    cx.fillStyle = "#ffffff";
    cx.fillRect(0, 0, c.width, c.height);
    cx.drawImage(img, 0, 0);
    montarVisor(vinculoRecortarBranco(c), null);
  };
    img.onerror = function () {
      alvo.innerHTML = '<div class="vinculo-vazio-lista">Não foi possível carregar a imagem do fluxograma.</div>';
    };
    img.src = anexo.url;
    return;
  }

  if (anexo.tipo === "application/pdf") {
    alvo.innerHTML = '<div class="vinculo-vazio-lista">Renderizando fluxograma...</div>';
    try {
      await vinculoInjetarPdfJs();
      const buffer = await vinculoBaixarPdfBuffer(anexo.url);
      const pdf = await window.pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;
      const page = await pdf.getPage(1);
      const vp1 = page.getViewport({ scale: 1 });

      // Renderiza na largura real do espaço disponível (x densidade da tela),
      // para o desenho ficar nítido ocupando a largura toda.
      const larguraAlvo = Math.max(300, alvo.clientWidth || 860);
      const dpr = window.devicePixelRatio || 1;
      const escala = Math.max(1, Math.min(4, (larguraAlvo * dpr * 1.25) / vp1.width));
      const viewport = page.getViewport({ scale: escala });

      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport: viewport }).promise;

      let rodape = null;
      if (pdf.numPages > 1) {
        rodape = document.createElement("div");
        rodape.className = "vinculo-vazio-lista";
        rodape.style.marginTop = "6px";
        rodape.textContent = "Mostrando a página 1 de " + pdf.numPages + ".";
      }
      montarVisor(vinculoRecortarBranco(canvas), rodape);
    } catch (e) {
      console.error("[Vinculo] Erro ao renderizar PDF:", e);
      alvo.innerHTML = '<div class="vinculo-vazio-lista">Não foi possível pré-visualizar o PDF. ' +
        '<a href="' + anexo.url + '" target="_blank" rel="noopener">Abrir em nova aba</a>.</div>';
    }
    return;
  }

  alvo.innerHTML = '<div class="vinculo-vazio-lista">Formato de anexo não suportado para pré-visualização.</div>';
}

// ---------- 6a-3) Seletor de fluxograma (quando há mais de um anexo) ----------
// Preenche o <select> com todos os PDFs/imagens candidatos e mostra/esconde
// a linha do seletor conforme a quantidade (some quando só há 0 ou 1 anexo,
// pra não poluir a tela à toa).
// 🆕 AJUSTE: agora o seletor aparece SEMPRE que existir pelo menos
// 1 anexo candidato (mesmo que seja só 1). Antes, com exatamente 1
// anexo, o dropdown ficava oculto por design -- só o botão de
// detectar aparecia. Isso gerava confusão: não dava pra saber, só
// olhando a tela, se o sistema realmente enxergou 1 arquivo (e
// escondeu o seletor de propósito) ou se havia um bug escondendo
// outros anexos que deveriam aparecer. Agora o dropdown sempre
// mostra a lista real encontrada, mesmo com um único item -- só
// esconde a linha inteira se NENHUM anexo foi encontrado.
function vinculoPopularSeletorAnexos() {
  if (!_vinculoModalAtual) return;
  const linha = _vinculoModalAtual.querySelector("#vinculoLinhaAnexo");
  const select = _vinculoModalAtual.querySelector("#vinculoSelectAnexo");
  const rotuloSelect = select ? select.previousElementSibling : null;
  const btnRedetectar = _vinculoModalAtual.querySelector("#vinculoBtnRedetectar");
  const btnLimparRedetectar = _vinculoModalAtual.querySelector("#vinculoBtnLimparRedetectar");
  if (!linha || !select) return;

  if (!_vinculoAnexosCache.length) {
    linha.style.display = "none";
    if (btnRedetectar) btnRedetectar.style.display = "none";
    if (btnLimparRedetectar) btnLimparRedetectar.style.display = "none";
    return;
  }

  linha.style.display = "flex";
  select.style.display = "";
  if (rotuloSelect) {
    rotuloSelect.style.display = "";
    rotuloSelect.textContent = _vinculoAnexosCache.length > 1
      ? "Este processo tem " + _vinculoAnexosCache.length + " arquivos anexados. Escolha qual fluxograma usar:"
      : "Fluxograma detectado neste processo:";
  }

  select.innerHTML = _vinculoAnexosCache.map(function (a, idx) {
    const icone = a.tipo === "application/bpmn+xml" ? "🧩"
      : a.tipo === "application/pdf" ? "📄" : "🖼️";
    const sufixo = a.tipo === "application/bpmn+xml" ? "  (modelo BPMN — nomes exatos)" : "";
    return '<option value="' + idx + '">' + icone + ' ' + escapeHTML(a.nome) + sufixo + '</option>';
  }).join("");

  const idxAtual = _vinculoAnexosCache.indexOf(_vinculoAnexoAtual);
  select.value = String(idxAtual >= 0 ? idxAtual : 0);

  // 🆕 Agora o botao aparece pra PDF (texto real) OU imagem (via
  // OCR) -- as duas fontes suportam deteccao automatica de etapas.
  if (btnRedetectar) {
    btnRedetectar.style.display = _vinculoAnexoAtual ? "" : "none";
  }
  if (btnLimparRedetectar) {
    btnLimparRedetectar.style.display = _vinculoAnexoAtual ? "" : "none";
  }
}

// Chamada quando o usuário troca a opção no seletor. Só atualiza o
// PREVIEW -- não redetecta etapas automaticamente (pra não criar
// etapas repetidas sem o usuário pedir). Para (re)detectar a partir do
// arquivo escolhido, o usuário clica em "Detectar etapas deste arquivo".
async function vinculoTrocarAnexoSelecionado(indexStr) {
  const idx = Number(indexStr);
  const anexo = _vinculoAnexosCache[idx];
  if (!anexo) return;

  _vinculoAnexoAtual = anexo;
  await vinculoRenderizarPreviewFluxograma(anexo);
  vinculoPopularSeletorAnexos();
  vinculoGerarMapaDeCalorImagem(); // 🆕 o mapa de calor depende de qual anexo está selecionado

  const statusExtracao = _vinculoModalAtual && _vinculoModalAtual.querySelector("#vinculoStatusExtracao");
  if (statusExtracao) {
    statusExtracao.textContent =
      anexo.tipo === "application/bpmn+xml"
        ? 'Modelo BPMN selecionado. Clique em "Detectar etapas deste arquivo" para ler os nomes exatos, sem OCR.'
      : anexo.tipo === "application/pdf"
        ? 'Arquivo selecionado. Clique em "Detectar etapas deste arquivo" para ler as etapas dele.'
        : 'Arquivo selecionado. Clique em "Detectar etapas deste arquivo" para ler o texto da imagem via OCR.';
  }
}

// ---------- 6a-4) Motor de detecção (usado tanto no carregamento automático quanto no botão manual) ----------
// forcar=false -> modo automático (só roda se ainda não existir NENHUMA
//   etapa cadastrada pra este processo -- evita reprocessar sozinho).
// forcar=true  -> modo manual, acionado pelo botão "Detectar etapas
//   deste arquivo". Roda mesmo se já existirem etapas, mas pula nomes
//   que já existem (evita duplicar).
//
// 🆕 REESCRITO. Antes, quando o PDF tinha mais de uma página, a
// heurística de itens numerados ("1.", "2." ...) lia TODAS as páginas
// juntas -- então se a página 1 era o DESENHO do fluxograma (com números
// perto das caixas) e a página 2 era um texto NARRATIVO/manual que
// também numerava seus próprios parágrafos, os dois entravam juntos como
// "etapa", misturando nomes em estilos diferentes e sem relação direta
// com os quadrantes reais do desenho -- exatamente o problema relatado.
// Agora cada método é tentado PÁGINA A PÁGINA, sempre começando pela
// página 1, e paramos no primeiro método/página que encontrar uma
// quantidade mínima de candidatos -- em vez de somar o que cada página
// encontrar separadamente.
//
// Além disso, quando NENHUM texto aproveitável é encontrado em nenhuma
// página (nem numerado, nem nas caixas do desenho via texto embutido do
// PDF -- comum em digitalizações ou em PDFs "vetoriais" onde o texto virou
// desenho/curvas), tentamos um último recurso: renderizar a página como
// imagem e ler via OCR, do mesmo jeito que já fazíamos pra PNG/JPG.
async function vinculoDetectarEtapasDoAnexoAtual(forcar) {
  const statusExtracao = _vinculoModalAtual && _vinculoModalAtual.querySelector("#vinculoStatusExtracao");
  const anexo = _vinculoAnexoAtual;

  // 🆕 Toda mensagem também dispara um toast, além do texto inline --
  // assim o usuário sempre vê o resultado, mesmo se o modal estiver
  // rolado para outra parte da tela no momento.
  const avisar = function (msg, tipo) {
    if (statusExtracao) statusExtracao.textContent = msg;
    showToast(msg, tipo || "success");
  };

  if (!forcar && statusExtracao) statusExtracao.textContent = "";

  if (!anexo) {
    avisar('Nenhum fluxograma anexado a este processo ainda. Anexe um PDF/imagem em "Mapas do Processo" ou cadastre as etapas manualmente.', "error");
    return;
  }

  if (!forcar && _vinculoEtapasCache.length) {
    // Modo automático e já existem etapas: não faz nada (evita reprocessar
    // sozinho toda vez que o modal é reaberto).
    return;
  }

  // 🆕 ITEM ① — ETAPAS VINDAS DO MODELO BPMN SÃO DEFINITIVAS.
  // Quando o fluxograma foi criado no editor do sistema, as etapas já
  // foram gravadas a partir do próprio modelo, com nome exato e posição
  // exata de cada caixa. Rodar detecção por cima disso só pode piorar:
  // o OCR leria a MESMA imagem e devolveria variações corrompidas do que
  // já está correto ("Mapear os dados" viraria "M apear os dados"), que
  // entrariam como etapas novas por não baterem na comparação de nomes.
  const temEtapasBpmn = _vinculoEtapasCache.some(function (e) {
    return String(e.origem || "").toLowerCase() === "bpmn";
  });
  if (temEtapasBpmn) {
    const qtd = _vinculoEtapasCache.filter(function (e) {
      return String(e.origem || "").toLowerCase() === "bpmn";
    }).length;
    console.log("[Vinculo] " + qtd + " etapa(s) deste processo vieram do modelo BPMN. " +
      "Detecção automática ignorada para não sobrescrever nomes exatos.");
    avisar(
      "Este processo já tem " + qtd + " etapa(s) lidas diretamente do fluxograma criado no sistema " +
      "(nomes exatos, sem OCR). A detecção não foi executada para não substituí-las. " +
      "Para recomeçar do zero, use \"Limpar e detectar novamente\".",
      "success"
    );
    return;
  }

  const processoObjAtual = processos.find(function (p) { return String(p.id) === String(processoAtualId); });
  const nomeProcessoAtual = processoObjAtual ? (processoObjAtual.processo || "") : "";

  // Quantidade mínima de candidatos pra considerar uma página/método
  // "confiável" o bastante pra parar de procurar em outro lugar (evita
  // parar numa página que só achou 1 fragmento solto de ruído).
  const MIN_CANDIDATOS_CONFIAVEL = 2;

  let candidatos = []; // sempre no formato [{ nome, bbox }], bbox pode ser null
  let melhorParcial = []; // 🆕 guarda o melhor resultado ABAIXO do mínimo, caso nada melhor apareça
  let origemDeteccao = "";
  let melhorParcialOrigem = "";

  const registrarParcial = function (lista, origem) {
    if (lista.length > melhorParcial.length) { melhorParcial = lista; melhorParcialOrigem = origem; }
  };

  try {
    // ---- 🆕 ITEM ② — MODELO BPMN: caminho preferencial absoluto ----
    // Quando o anexo é um .bpmn/.xml exportado do Bizagi, lemos os nomes
    // direto do modelo. Não há OCR envolvido, então o resultado é gravado
    // sem passar pela revisão (que só existe para sugestões de OCR).
    if (anexo.tipo === "application/bpmn+xml") {
      if (statusExtracao) statusExtracao.textContent = "Lendo as etapas do modelo BPMN (nomes exatos, sem OCR)...";
      const doBpmn = await vinculoExtrairEtapasDoBpmn(anexo.url);
      if (doBpmn.length) {
        candidatos = doBpmn;
        origemDeteccao = "bpmn";
      } else {
        avisar("O arquivo BPMN foi lido, mas não contém tarefas/gateways com nome. " +
               "Confira se o diagrama foi exportado completo do Bizagi.", "error");
        return;
      }
    } else if (anexo.tipo === "application/pdf") {
      if (statusExtracao) statusExtracao.textContent = "Lendo etapas do fluxograma anexado...";

      // ---- Tentativa 0 (PREFERENCIAL): ler as CAIXAS/LOSANGOS desenhados ----
      // 🆕 Este é agora o primeiro caminho para fluxogramas. Em vez de
      // adivinhar quais fragmentos de texto formam uma etapa, lemos as
      // formas vetoriais que o PDF desenha e pegamos o texto DENTRO de
      // cada uma. Uma caixa = uma etapa, exatamente como no desenho.
      // Só vale quando o arquivo realmente tem formas (fluxograma); em
      // documentos textuais/infográficos não há caixas e caímos adiante.
      try {
        const porFormas = await vinculoExtrairEtapasPorFormasPdf(anexo.url, nomeProcessoAtual);
        if (porFormas.length >= MIN_CANDIDATOS_CONFIAVEL) {
          candidatos = porFormas;
          origemDeteccao = "formas-pdf";
          console.log("[Vinculo] Usando leitura por FORMAS: " + candidatos.length + " etapa(s).");
        } else if (porFormas.length) {
          registrarParcial(porFormas, "formas-pdf");
        }
      } catch (e) {
        console.warn("[Vinculo] Leitura por formas falhou; seguindo pelos outros métodos.", e);
      }

      // ---- Tentativa 1: itens NUMERADOS, testados PÁGINA A PÁGINA ----
      const paginasDeLinhas = candidatos.length ? [] : await vinculoExtrairLinhasPorPaginaPdf(anexo.url);
      for (let i = 0; i < paginasDeLinhas.length && !candidatos.length; i++) {
        const nomesNumerados = vinculoHeuristicaEtapasDeLinhas(paginasDeLinhas[i]);
        if (!nomesNumerados.length) continue;
        const lista = nomesNumerados.map(function (n) { return { nome: n, bbox: null }; });
        registrarParcial(lista, "numerada");
        if (nomesNumerados.length >= MIN_CANDIDATOS_CONFIAVEL) {
          candidatos = lista;
          origemDeteccao = "numerada";
          console.log("[Vinculo] Página " + (i + 1) + ": " + candidatos.length + " item(ns) numerado(s) -- usando esta página.");
        }
      }

      // ---- Tentativa 2 (fallback): rótulos das caixas do desenho (texto
      // embutido do PDF), também testados página a página ----
      if (!candidatos.length) {
        if (statusExtracao) statusExtracao.textContent = "Nenhum item numerado encontrado. Lendo os rótulos das caixas do desenho...";
        for (let p = 1; p <= paginasDeLinhas.length && !candidatos.length; p++) {
          const visuais = await vinculoExtrairEtapasVisuaisPdf(anexo.url, nomeProcessoAtual, [p]);
          if (!visuais.length) continue;
          registrarParcial(visuais, "visual-pdf");
          if (visuais.length >= MIN_CANDIDATOS_CONFIAVEL) {
            candidatos = visuais;
            origemDeteccao = "visual-pdf";
            console.log("[Vinculo] Página " + p + ": " + candidatos.length + " caixa(s) detectada(s) pelo texto do PDF -- usando esta página.");
          }
        }
      }

      // ---- Tentativa 3 (último recurso): OCR sobre a página renderizada
      // como imagem -- cobre PDFs digitalizados/"achatados" sem NENHUM
      // texto real embutido (nem numerado, nem nas caixas) ----
      if (!candidatos.length) {
        if (statusExtracao) statusExtracao.textContent = "Não encontrei texto legível no PDF. Tentando ler o desenho via OCR (pode levar alguns segundos)...";
        showToast("Não encontrei texto legível no PDF. Tentando ler o desenho via OCR...", "success");
        const viaOcr = await vinculoExtrairEtapasViaOcrPdf(anexo.url, nomeProcessoAtual);
        if (viaOcr.length) {
          registrarParcial(viaOcr, "visual-pdf-ocr");
          if (viaOcr.length >= MIN_CANDIDATOS_CONFIAVEL) {
            candidatos = viaOcr;
            origemDeteccao = "visual-pdf-ocr";
          }
        }
      }
    } else {
      // 🆕 Arquivo é IMAGEM (PNG/JPG): usa OCR pra ler o texto de DENTRO
      // dos pixels -- é assim que outros sistemas "leem" fluxogramas
      // desenhados/exportados como imagem (inclusive os criados no
      // próprio editor BPMN do sistema). Pode levar alguns segundos,
      // principalmente na primeira vez (baixa a biblioteca de OCR).
      if (statusExtracao) statusExtracao.textContent = "Lendo o texto da imagem (OCR)... isso pode levar alguns segundos. Veja o console (F12) para acompanhar.";
      showToast("Lendo o texto da imagem (OCR)... isso pode levar alguns segundos.", "success");
      const visuaisImagem = await vinculoExtrairEtapasVisuaisImagem(anexo.url, nomeProcessoAtual);
      registrarParcial(visuaisImagem, "visual-imagem");
      if (visuaisImagem.length >= MIN_CANDIDATOS_CONFIAVEL) {
        candidatos = visuaisImagem;
        origemDeteccao = "visual-imagem";
      }
    }
  } catch (e) {
    console.error("[Vinculo] Erro na extração automática:", e);
    avisar("Não foi possível ler o arquivo automaticamente: " + e.message + ". Cadastre as etapas manualmente abaixo.", "error");
    return;
  }

  // 🆕 Se nenhuma tentativa bateu o mínimo de confiança, mas alguma achou
  // ALGO (mesmo que pouco), usamos o melhor resultado parcial em vez de
  // desistir -- é melhor sugerir 1 etapa encontrada do que nenhuma.
  if (!candidatos.length && melhorParcial.length) {
    candidatos = melhorParcial;
    origemDeteccao = melhorParcialOrigem;
    console.log("[Vinculo] Nenhuma página bateu o mínimo de confiança (" + MIN_CANDIDATOS_CONFIAVEL + "). Usando o melhor resultado parcial encontrado: " + candidatos.length + " item(ns), origem \"" + origemDeteccao + "\".");
  }

  // Evita duplicar: pula nomes que já existem no cache atual de etapas
  // (comparação sem acento/maiúsculas, pra não duplicar por diferença
  // de formatação).
  const normalizar = function (s) {
    try { return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase(); }
    catch (e) { return (s || "").trim().toLowerCase(); }
  };
  const jaExistentes = new Set(_vinculoEtapasCache.map(function (e) { return normalizar(e.nome); }));
  const novos = candidatos.filter(function (c) { return c.nome && !jaExistentes.has(normalizar(c.nome)); });

  // 🆕 ITEM ④ — OCR NÃO GRAVA DIRETO NO BANCO.
  // Quando a origem é OCR (imagem ou PDF sem texto legível), o resultado
  // é reconhecidamente instável: o Tesseract quebra palavras pequenas em
  // pedaços ("Mapear" -> "M" + "apear") e o agrupamento por proximidade
  // não tem como saber que eram uma palavra só. Gravar isso direto em
  // processo_etapas contaminava o banco com nomes corrompidos que depois
  // apareciam nos chips, na tabela e no mapa de calor.
  //
  // Agora o OCR devolve SUGESTÕES: o usuário revisa, corrige o texto,
  // descarta o que for lixo e só então grava. Os caminhos confiáveis
  // (formas vetoriais e numeração) continuam gravando direto, porque
  // deles o nome sai exato.
  const origemEhOcr = (origemDeteccao === "visual-imagem" || origemDeteccao === "visual-pdf-ocr");

  if (novos.length && origemEhOcr) {
    vinculoAbrirRevisaoSugestoes(novos, origemDeteccao, statusExtracao);
    return;
  }

  if (novos.length) {
    for (let i = 0; i < novos.length; i++) {
      // 🆕 Etapas vindas do modelo BPMN são gravadas com origem "bpmn",
      // o que as protege de detecções futuras por OCR (item ①).
      const criada = await vinculoSbCriarEtapa(
        processoAtualId, novos[i].nome, novos[i].bbox,
        origemDeteccao === "bpmn" ? "bpmn" : null
      );
      if (criada) _vinculoEtapasCache.push(criada);
    }
    const explicacao =
      origemDeteccao === "bpmn" ? " (lidas do modelo BPMN do Bizagi -- nomes exatos, sem OCR)." :
      origemDeteccao === "formas-pdf" ? " (lidas das próprias caixas/losangos do fluxograma)." :
      origemDeteccao === "visual-pdf" ? " (lidas pelos rótulos das caixas do desenho -- confira e ajuste se algo vier errado)." :
      origemDeteccao === "visual-pdf-ocr" ? " (lidas por OCR sobre o desenho do PDF -- confira e ajuste se algo vier errado)." :
      origemDeteccao === "visual-imagem" ? " (lidas por reconhecimento de texto na imagem/OCR -- confira e ajuste se algo vier errado)." :
      ".";
    if (statusExtracao) {
      statusExtracao.innerHTML = '<i class="bi bi-check-circle-fill" style="color:#3ad48a;"></i> ' +
        novos.length + ' etapa(s) nova(s) identificada(s) neste arquivo' + explicacao;
    }
    showToast(novos.length + " etapa(s) nova(s) identificada(s)" + explicacao, "success");
    vinculoRenderStatusEChips();
    vinculoRenderResumo();
  } else {
    const msg = candidatos.length
      ? "As etapas deste arquivo já estavam todas cadastradas."
      : "Não consegui identificar NENHUM texto automaticamente neste arquivo (veja o console F12 para detalhes técnicos). Cadastre as etapas manualmente abaixo.";
    avisar(msg, candidatos.length ? "success" : "error");
  }
}

// ============================================================================
// 🆕 ITEM ④ — REVISÃO DE SUGESTÕES VINDAS DE OCR
// ----------------------------------------------------------------------------
// Exibe as etapas que o OCR "achou" como uma LISTA EDITÁVEL, logo abaixo do
// fluxograma, antes de qualquer gravação. Cada linha traz:
//   - um checkbox (aproveitar ou descartar)
//   - o texto em um input (corrigir o que o OCR quebrou)
//   - um aviso quando o texto parece suspeito
// Só o que o usuário aprovar vai para processo_etapas.
// ============================================================================
let _vinculoSugestoesPendentes = [];

// Heurística de confiança: marca o que provavelmente veio quebrado, para o
// usuário olhar primeiro. Não descarta nada sozinho -- apenas sinaliza.
function vinculoSugestaoSuspeita(texto) {
  const t = String(texto || "").trim();
  if (!t) return true;
  const tokens = t.split(/\s+/).filter(Boolean);

  // Palavras curtas LEGÍTIMAS do português e siglas usuais do processo.
  // Sem esta lista, nomes corretos como "Registrar a penhora no SGP" ou
  // "Comunicar juízo penhorante e de execução" eram sinalizados à toa,
  // só por conterem "a", "no", "e", "de", "SGP".
  const CURTAS_OK = new Set([
    "a", "o", "e", "à", "ao", "as", "os", "da", "de", "do", "das", "dos",
    "na", "no", "nas", "nos", "em", "um", "uma", "ou", "se", "por", "com",
    "sem", "sob", "até", "pra", "para", "the"
  ]);
  const ehSigla = function (w) {
    const limpo = w.replace(/[^A-Za-zÀ-ÿ]/g, "");
    // Sigla: 2-5 letras TODAS maiúsculas (SGP, TJPR, DP, CJ, BI, QVD).
    return limpo.length >= 2 && limpo.length <= 5 && limpo === limpo.toUpperCase();
  };

  // Pedaço solto de palavra ("M" em "M apear", "u" em "u (produção").
  const picotados = tokens.filter(function (w) {
    const limpo = w.replace(/[^A-Za-zÀ-ÿ]/g, "");
    if (!limpo) return false;                       // pontuação isolada
    if (limpo.length > 2) return false;
    if (CURTAS_OK.has(limpo.toLowerCase())) return false;
    if (ehSigla(w)) return false;
    return true;
  }).length;
  if (picotados >= 1 && tokens.length >= 3) return true;

  // Fragmentos sem vogal ou com encontro consonantal improvável --
  // ignorando siglas, que legitimamente não têm vogal (SGP, TJPR).
  if (tokens.some(function (w) {
    const limpo = w.replace(/[^A-Za-zÀ-ÿ]/g, "");
    if (limpo.length < 3) return false;
    if (ehSigla(w)) return false;
    return !/[aeiouáàâãéêíóôõúü]/i.test(limpo) || /[bcdfgjklmpqtvwxz]{3,}/i.test(limpo);
  })) return true;

  // Caractere estranho no meio do texto: o OCR costuma trocar acentos e
  // aspas por símbolos (»,  «, |, ~, ^) que não aparecem em nome de etapa.
  if (/[«»|~^¬×÷°]/.test(t)) return true;

  // Início de palavra impossível em português. Quando o OCR corta o
  // começo de uma palavra, sobra um pedaço que nenhuma palavra real
  // teria: "icualizaçõ" (de "visualizações"), "fasb" (de "fase"),
  // "istênci" (de "consistência"), "gaç" (de "divulgação").
  if (tokens.some(function (w) {
    const limpo = w.replace(/[^A-Za-zÀ-ÿ]/g, "").toLowerCase();
    if (limpo.length < 3) return false;
    if (ehSigla(w)) return false;
    // Encontro consonantal inicial válido: pr, br, tr, dr, cr, gr, fr, vr,
    // pl, bl, cl, gl, fl, ch, lh, nh, qu, gu, ps, sc, tm...
    if (/^[bcdfgjklmpqstvz][bcdfgjklmnpqrstvwxz]/.test(limpo) &&
        !/^(pr|br|tr|dr|cr|gr|fr|vr|pl|bl|cl|gl|fl|ch|lh|nh|qu|gu|ps|pn|sc|sp|st|tm|mn|gn)/.test(limpo)) {
      return true;
    }
    // Terminação truncada: consoante final que o português não usa
    // sozinha no fim de palavra (exceto l, m, n, r, s, x, z).
    if (/[bcdfgjkpqtvw]$/.test(limpo)) return true;
    return false;
  })) return true;

  return false;
}

function vinculoAbrirRevisaoSugestoes(sugestoes, origem, statusExtracao) {
  _vinculoSugestoesPendentes = sugestoes.slice();

  const alvo = _vinculoModalAtual && _vinculoModalAtual.querySelector("#vinculoSugestoesOcr");
  if (!alvo) {
    console.warn("[Vinculo] Área de sugestões não encontrada no modal.");
    return;
  }

  const rotuloOrigem = origem === "visual-imagem"
    ? "reconhecimento de texto na imagem (OCR)"
    : "OCR sobre o desenho do PDF";

  const suspeitas = sugestoes.filter(function (s) { return vinculoSugestaoSuspeita(s.nome); }).length;

  let html =
    '<div class="vinculo-sug-cabecalho">' +
      '<div>' +
        '<strong>' + sugestoes.length + ' etapa(s) sugerida(s)</strong> por ' + rotuloOrigem + '. ' +
        'Nada foi salvo ainda — revise, corrija o texto e confirme.' +
        (suspeitas ? '<div class="vinculo-sug-alerta"><i class="bi bi-exclamation-triangle-fill"></i> ' +
          suspeitas + ' item(ns) parecem ter sido quebrados pelo OCR (destacados abaixo).</div>' : '') +
      '</div>' +
    '</div>' +
    '<div class="vinculo-sug-acoes-topo">' +
      '<button type="button" class="vinculo-btn secundario" id="vinculoSugMarcarTodas">Marcar todas</button>' +
      '<button type="button" class="vinculo-btn secundario" id="vinculoSugDesmarcarTodas">Desmarcar todas</button>' +
      '<button type="button" class="vinculo-btn secundario" id="vinculoSugSoConfiaveis">Só as confiáveis</button>' +
    '</div>' +
    '<div class="vinculo-sug-lista">';

  sugestoes.forEach(function (s, i) {
    const suspeita = vinculoSugestaoSuspeita(s.nome);
    html +=
      '<div class="vinculo-sug-item' + (suspeita ? ' suspeita' : '') + '" data-idx="' + i + '">' +
        '<input type="checkbox" class="vinculo-sug-check" data-idx="' + i + '"' +
          (suspeita ? '' : ' checked') + '>' +
        '<input type="text" class="vinculo-input vinculo-sug-texto" data-idx="' + i + '" ' +
          'value="' + escapeHTML(s.nome) + '" maxlength="160">' +
        (suspeita ? '<span class="vinculo-sug-flag" title="Texto possivelmente quebrado pelo OCR — confira antes de salvar"><i class="bi bi-exclamation-triangle-fill"></i></span>' : '') +
      '</div>';
  });

  html +=
    '</div>' +
    '<div class="vinculo-sug-rodape">' +
      '<button type="button" class="vinculo-btn" id="vinculoSugConfirmar">' +
        '<i class="bi bi-check-lg"></i> Salvar etapas selecionadas' +
      '</button>' +
      '<button type="button" class="vinculo-btn secundario" id="vinculoSugCancelar">' +
        '<i class="bi bi-x-lg"></i> Descartar sugestões' +
      '</button>' +
    '</div>';

  alvo.innerHTML = html;
  alvo.style.display = "block";

  if (statusExtracao) {
    statusExtracao.innerHTML = '<i class="bi bi-info-circle" style="color:#4dd0e1;"></i> ' +
      sugestoes.length + ' sugestão(ões) aguardando sua revisão abaixo — nada foi salvo ainda.';
  }
  showToast(sugestoes.length + " etapa(s) sugerida(s) pelo OCR. Revise antes de salvar.", "success");

  const marcar = function (fn) {
    alvo.querySelectorAll(".vinculo-sug-check").forEach(function (cb) {
      cb.checked = fn(Number(cb.getAttribute("data-idx")));
    });
  };
  alvo.querySelector("#vinculoSugMarcarTodas").addEventListener("click", function () { marcar(function () { return true; }); });
  alvo.querySelector("#vinculoSugDesmarcarTodas").addEventListener("click", function () { marcar(function () { return false; }); });
  alvo.querySelector("#vinculoSugSoConfiaveis").addEventListener("click", function () {
    marcar(function (i) { return !vinculoSugestaoSuspeita(_vinculoSugestoesPendentes[i].nome); });
  });

  alvo.querySelector("#vinculoSugConfirmar").addEventListener("click", vinculoConfirmarSugestoes);
  alvo.querySelector("#vinculoSugCancelar").addEventListener("click", function () {
    vinculoFecharSugestoes();
    showToast("Sugestões descartadas. Nenhuma etapa foi criada.", "success");
  });
}

function vinculoFecharSugestoes() {
  _vinculoSugestoesPendentes = [];
  const alvo = _vinculoModalAtual && _vinculoModalAtual.querySelector("#vinculoSugestoesOcr");
  if (alvo) { alvo.innerHTML = ""; alvo.style.display = "none"; }
}

// Grava somente as sugestões marcadas, já com o texto editado pelo usuário.
async function vinculoConfirmarSugestoes() {
  const alvo = _vinculoModalAtual && _vinculoModalAtual.querySelector("#vinculoSugestoesOcr");
  if (!alvo) return;

  const aprovadas = [];
  alvo.querySelectorAll(".vinculo-sug-check").forEach(function (cb) {
    if (!cb.checked) return;
    const idx = Number(cb.getAttribute("data-idx"));
    const campo = alvo.querySelector('.vinculo-sug-texto[data-idx="' + idx + '"]');
    const nome = campo ? campo.value.trim() : "";
    if (!nome) return;
    aprovadas.push({ nome: nome, bbox: _vinculoSugestoesPendentes[idx].bbox });
  });

  if (!aprovadas.length) {
    showToast("Nenhuma etapa marcada. Selecione ao menos uma ou descarte as sugestões.", "error");
    return;
  }

  showToast("Salvando " + aprovadas.length + " etapa(s)...", "success");

  let gravadas = 0;
  for (let i = 0; i < aprovadas.length; i++) {
    const criada = await vinculoSbCriarEtapa(processoAtualId, aprovadas[i].nome, aprovadas[i].bbox);
    if (criada) { _vinculoEtapasCache.push(criada); gravadas++; }
  }

  vinculoFecharSugestoes();

  const statusExtracao = _vinculoModalAtual && _vinculoModalAtual.querySelector("#vinculoStatusExtracao");
  if (statusExtracao) {
    statusExtracao.innerHTML = '<i class="bi bi-check-circle-fill" style="color:#3ad48a;"></i> ' +
      gravadas + ' etapa(s) salva(s) após revisão.';
  }
  showToast(gravadas + " etapa(s) salva(s) após revisão.", "success");
  tocarSom("success");

  vinculoRenderStatusEChips();
  vinculoRenderResumo();
}

// 🆕 Apaga TODAS as etapas já cadastradas para o processo atual (e os
// vínculos risco->etapa associados a elas) e roda a detecção de novo,
// do zero. Serve pra limpar etapas erradas/acumuladas de detecções
// anteriores (ex.: feitas em cima de um anexo diferente, ou de uma
// versão mais antiga do arquivo) sem precisar excluir uma a uma no
// lixinho de cada chip.
async function vinculoLimparERedetectar() {
  if (!processoAtualId) return;
  if (!confirm(
    "Isso vai APAGAR todas as etapas já cadastradas para este processo " +
    "(e desvincular os riscos que apontam pra elas) e detectar tudo de novo " +
    "a partir do arquivo selecionado.\n\nContinuar?"
  )) return;

  const ok = await vinculoSbExcluirTodasEtapas(processoAtualId);
  if (!ok) return;

  _vinculoEtapasCache = [];
  _vinculoVinculosCache = [];
  vinculoRenderStatusEChips();
  vinculoRenderResumo();

  showToast("Etapas anteriores removidas. Detectando novamente...", "success");
  await vinculoDetectarEtapasDoAnexoAtual(true);

  // 🆕 Relê do banco antes de redesenhar. Antes confiávamos só no cache
  // local montado durante a detecção -- se algum insert tivesse sido
  // recusado (RLS, constraint), a tela mostrava etapas que na verdade
  // não foram gravadas, ou mantinha as antigas sem o usuário perceber.
  _vinculoEtapasCache = await vinculoSbListarEtapas(processoAtualId);
  _vinculoVinculosCache = await vinculoSbListarVinculos(processoAtualId);
  vinculoRenderStatusEChips();
  vinculoRenderResumo();
  vinculoGerarMapaDeCalorImagem();
}

// ---------- 6b) Carregar dados e desenhar tudo ----------
async function vinculoCarregarTudo() {
  _vinculoEtapasCache = await vinculoSbListarEtapas(processoAtualId);
  _vinculoVinculosCache = await vinculoSbListarVinculos(processoAtualId);

  // 🆕 Carrega TODOS os anexos candidatos e popula o seletor -- se
  // houver mais de um, o usuário escolhe qual usar em vez do sistema
  // "adivinhar" sozinho.
  _vinculoAnexosCache = await vinculoListarTodosAnexosCandidatos(processoAtualId);
  _vinculoAnexoAtual = vinculoEscolherAnexoPadrao(_vinculoAnexosCache);
  vinculoPopularSeletorAnexos();

  await vinculoRenderizarPreviewFluxograma(_vinculoAnexoAtual);

  // Só tenta extrair automaticamente se este processo AINDA NÃO tem
  // nenhuma etapa cadastrada -- evita reprocessar/duplicar toda vez
  // que o modal é reaberto. Se já existirem etapas, o usuário pode
  // usar o botão "Detectar etapas deste arquivo" pra rodar de novo
  // manualmente (inclusive trocando de anexo antes).
  await vinculoDetectarEtapasDoAnexoAtual(false);

  vinculoRenderStatusEChips();
  vinculoRenderResumo();
}

function vinculoEtapaVinculadaAoRisco(riscoId) {
  const v = _vinculoVinculosCache.find(function (x) { return String(x.risco_id) === String(riscoId); });
  if (!v) return null;
  return _vinculoEtapasCache.find(function (e) { return String(e.id) === String(v.etapa_id); }) || null;
}

function vinculoRenderStatusEChips() {
  if (!_vinculoModalAtual) return;
  vinculoAtualizarRotulosSelectRisco();
  const status = _vinculoModalAtual.querySelector("#vinculoStatusAtual");
  const lista = _vinculoModalAtual.querySelector("#vinculoListaEtapas");
  if (!status || !lista) return;

  const etapaAtual = vinculoEtapaVinculadaAoRisco(_vinculoRiscoSelecionadoId);

  if (etapaAtual) {
    status.className = "vinculo-status-atual";
    status.innerHTML = '<i class="bi bi-check-circle-fill" style="color:#3ad48a;"></i> Risco <strong>' + escapeHTML(vinculoCodigoRiscoComEtapa(_vinculoRiscoSelecionadoId)) +
      '</strong> vinculado à etapa <strong>' + vinculoNumeroEtapa(etapaAtual.id) + ' — ' +
      escapeHTML(etapaAtual.nome) + '</strong>' +
      ' &nbsp;<button type="button" class="vinculo-btn secundario" id="vinculoBtnDesvincular" style="padding:4px 10px;font-size:11px;"><i class="bi bi-x-lg"></i> Remover vínculo</button>';
    const btnDes = status.querySelector("#vinculoBtnDesvincular");
    if (btnDes) btnDes.addEventListener("click", vinculoRemoverVinculoAtual);
  } else {
    status.className = "vinculo-status-atual vazio";
    status.innerHTML = '<i class="bi bi-info-circle"></i> Este risco ainda não está vinculado a nenhuma etapa.';
  }

  if (!_vinculoEtapasCache.length) {
    lista.innerHTML = '<div class="vinculo-vazio-lista">Nenhuma etapa cadastrada ainda para este processo. Adicione a primeira abaixo.</div>';
    return;
  }

  lista.innerHTML = _vinculoEtapasCache.map(function (etapa) {
    const selecionada = etapaAtual && String(etapaAtual.id) === String(etapa.id);
    return '<span class="vinculo-chip' + (selecionada ? " selecionada" : "") + '" data-etapa-id="' + etapa.id + '">' +
      '<span class="vinculo-chip-num" style="font-weight:800;opacity:.85;">' + vinculoNumeroEtapa(etapa.id) + '</span>' +
      '<span class="vinculo-chip-nome">' + escapeHTML(etapa.nome) + '</span>' +
      '<button type="button" class="vinculo-chip-excluir" data-excluir-etapa="' + etapa.id + '" title="Excluir etapa"><i class="bi bi-trash"></i></button>' +
    '</span>';
  }).join("");

  lista.querySelectorAll(".vinculo-chip").forEach(function (chip) {
    chip.addEventListener("click", function (e) {
      if (e.target.closest("[data-excluir-etapa]")) return; // clique foi no lixinho
      vinculoVincularRiscoAEtapa(chip.getAttribute("data-etapa-id"));
    });
  });

  lista.querySelectorAll("[data-excluir-etapa]").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      vinculoExcluirEtapa(btn.getAttribute("data-excluir-etapa"));
    });
  });
}

async function vinculoVincularRiscoAEtapa(etapaId) {
  if (!_vinculoRiscoSelecionadoId || !etapaId) return;
  const ok = await vinculoSbSalvarVinculo(_vinculoRiscoSelecionadoId, etapaId);
  if (!ok) return;

  const idx = _vinculoVinculosCache.findIndex(function (v) {
    return String(v.risco_id) === String(_vinculoRiscoSelecionadoId);
  });
  const registro = { risco_id: _vinculoRiscoSelecionadoId, etapa_id: etapaId };
  if (idx >= 0) _vinculoVinculosCache[idx] = registro;
  else _vinculoVinculosCache.push(registro);

  showToast("Risco vinculado à etapa!", "success");
  tocarSom("success");
  vinculoRenderStatusEChips();
  vinculoRenderResumo();
}

async function vinculoRemoverVinculoAtual() {
  if (!_vinculoRiscoSelecionadoId) return;
  const ok = await vinculoSbRemoverVinculo(_vinculoRiscoSelecionadoId);
  if (!ok) return;

  _vinculoVinculosCache = _vinculoVinculosCache.filter(function (v) {
    return String(v.risco_id) !== String(_vinculoRiscoSelecionadoId);
  });

  showToast("Vínculo removido.", "success");
  tocarSom("delete");
  vinculoRenderStatusEChips();
  vinculoRenderResumo();
}

async function vinculoAdicionarEtapa() {
  const input = _vinculoModalAtual && _vinculoModalAtual.querySelector("#vinculoNovaEtapaInput");
  if (!input) return;
  const nome = input.value.trim();
  if (!nome) {
    showToast("Digite um nome para a etapa.", "error");
    return;
  }

  const criada = await vinculoSbCriarEtapa(processoAtualId, nome);
  if (!criada) return;

  _vinculoEtapasCache.push(criada);
  input.value = "";
  showToast("Etapa \"" + nome + "\" adicionada!", "success");
  tocarSom("success");
  vinculoRenderStatusEChips();
  vinculoRenderResumo();
}

async function vinculoExcluirEtapa(etapaId) {
  const etapa = _vinculoEtapasCache.find(function (e) { return String(e.id) === String(etapaId); });
  if (!etapa) return;
  if (!confirm('Excluir a etapa "' + etapa.nome + '"?\n\nOs riscos vinculados a ela ficarão sem vínculo.')) return;

  const ok = await vinculoSbExcluirEtapa(etapaId);
  if (!ok) return;

  _vinculoEtapasCache = _vinculoEtapasCache.filter(function (e) { return String(e.id) !== String(etapaId); });
  _vinculoVinculosCache = _vinculoVinculosCache.filter(function (v) { return String(v.etapa_id) !== String(etapaId); });

  showToast("Etapa excluída.", "success");
  tocarSom("delete");
  vinculoRenderStatusEChips();
  vinculoRenderResumo();
}

// ---------- 7) Resumo / mapa de calor (versão tabular, MVP) ----------
// Observação importante: por enquanto este resumo é textual/tabular.
// Pintar a cor diretamente EM CIMA do desenho do fluxograma (a caixa
// ou losango do PDF/BPMN) é a próxima fase, que depende da extração
// (automática, se vier de BPMN) ou calibração manual (se vier de
// PDF/imagem) das posições de cada etapa -- conforme já conversamos.
// ---------- 8) Mapa de calor PINTADO em cima do desenho do fluxograma ----------
// Diferente da tabela (só números), esta função gera uma IMAGEM: pega o
// fluxograma original (PNG/JPG direto, ou a página 1 do PDF renderizada)
// e desenha, por cima, um retângulo semi-transparente na cor do nível de
// risco de cada etapa -- mas SOMENTE para etapas que têm posição (bbox)
// registrada. Etapas cadastradas manualmente ou vindas da heurística
// NUMERADA (que não tem coordenada, só o texto) não têm como ser
// pintadas -- por isso a mensagem final explica exatamente isso.
async function vinculoCarregarImagemFonte(anexo) {
  if (!anexo) return null;
  if (anexo.tipo === "image/png" || anexo.tipo === "image/jpeg") {
    return new Promise(function (resolve, reject) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error("Não foi possível carregar a imagem do fluxograma.")); };
      img.src = anexo.url;
    });
  }
  if (anexo.tipo === "application/pdf") {
    await vinculoInjetarPdfJs();
    const buffer = await vinculoBaixarPdfBuffer(anexo.url);
    const pdf = await window.pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;
    const page = await pdf.getPage(1);
    const vp1 = page.getViewport({ scale: 1 });
    // Alta resolução (~6000px, dentro do limite do navegador): nítido no modal,
    // na tela cheia com zoom e na imagem baixada.
    const escala = vinculoEscalaSegura(vp1.width, vp1.height, 6000);
    const viewport = page.getViewport({ scale: escala });
    const canvasTemp = document.createElement("canvas");
    canvasTemp.width = viewport.width;
    canvasTemp.height = viewport.height;
    const ctxTemp = canvasTemp.getContext("2d");
    ctxTemp.fillStyle = "#ffffff";
    ctxTemp.fillRect(0, 0, canvasTemp.width, canvasTemp.height);
    await page.render({ canvasContext: ctxTemp, viewport: viewport }).promise;
    return canvasTemp;
  }
  return null;
}



// Corta o texto na largura disponível, acrescentando reticências.
function vinculoTruncarTextoNoCanvas(ctx, texto, larguraMax) {
  const limpo = String(texto || "").replace(/\s+/g, " ").trim();
  if (larguraMax <= 0) return "";
  if (ctx.measureText(limpo).width <= larguraMax) return limpo;

  let baixo = 0, alto = limpo.length;
  while (baixo < alto) {
    const meio = Math.ceil((baixo + alto) / 2);
    if (ctx.measureText(limpo.slice(0, meio) + "…").width <= larguraMax) baixo = meio;
    else alto = meio - 1;
  }
  return baixo > 0 ? limpo.slice(0, baixo) + "…" : "";
}

// 🆕 Tooltip no hover: mostra a lista COMPLETA dos riscos daquele
// quadrante, sem truncagem. Compensa o limite de espaço da imagem.
function vinculoLigarTooltipMapaCalor(canvas, areas, alvo) {
  let dica = alvo.querySelector(".vinculo-mapa-dica");
  if (!dica) {
    dica = document.createElement("div");
    dica.className = "vinculo-mapa-dica";
    dica.style.cssText =
      "position:absolute;z-index:50;display:none;max-width:320px;padding:9px 11px;" +
      "border-radius:8px;background:rgba(6,20,28,.96);border:1px solid rgba(77,208,225,.35);" +
      "color:#dceaf1;font-size:11.5px;line-height:1.5;pointer-events:none;" +
      "box-shadow:0 10px 30px rgba(0,0,0,.45);";
    alvo.appendChild(dica);
  }
  if (getComputedStyle(alvo).position === "static") alvo.style.position = "relative";

  canvas.addEventListener("mousemove", function (ev) {
    const rect = canvas.getBoundingClientRect();
    // A imagem é exibida escalada (max-width:100%): converte para as
    // coordenadas internas do canvas antes de testar as áreas.
    const escalaX = canvas.width / rect.width;
    const escalaY = canvas.height / rect.height;
    const px = (ev.clientX - rect.left) * escalaX;
    const py = (ev.clientY - rect.top) * escalaY;

    const area = areas.find(function (a) {
      return px >= a.x && px <= a.x + a.w && py >= a.y && py <= a.y + a.h;
    });

    if (!area) { dica.style.display = "none"; canvas.style.cursor = "default"; return; }

    canvas.style.cursor = "help";
    dica.innerHTML =
      '<div style="font-weight:800;color:#4dd0e1;margin-bottom:5px;">' +
        escapeHTML(area.nomeEtapa) +
      '</div>' +
      area.riscos.map(function (r) {
        const c = corDoRisco(r.valor).cor;
        return '<div style="margin-bottom:3px;">' +
          '<span class="vinculo-dot" style="background:' + c + ';"></span>' +
          '<strong>' + escapeHTML(r.codigo) + '</strong> — ' + escapeHTML(r.evento) +
          ' <span style="opacity:.75;">(' + r.valor.toFixed(1) + ')</span>' +
        '</div>';
      }).join("");

    dica.style.display = "block";
    const alvoRect = alvo.getBoundingClientRect();
    let left = ev.clientX - alvoRect.left + 14;
    let top = ev.clientY - alvoRect.top + 14;
    if (left + dica.offsetWidth > alvo.clientWidth) left = alvo.clientWidth - dica.offsetWidth - 6;
    dica.style.left = Math.max(0, left) + "px";
    dica.style.top = top + "px";
  });

  canvas.addEventListener("mouseleave", function () {
    dica.style.display = "none";
    canvas.style.cursor = "default";
  });
}

// ============================================================================
// 🆕 EXPORTAÇÃO DO MAPA DE CALOR
// ----------------------------------------------------------------------------
// Gera um material pronto para anexar em relatório/reunião: o fluxograma já
// pintado com o mapa de calor, seguido da relação de riscos por etapa.
// Sem média de risco -- apenas a quantidade e a lista dos riscos, conforme
// definido pela coordenação.
// ============================================================================
function vinculoNomeArquivoExport(extensao) {
  const proc = processos.find(function (p) { return String(p.id) === String(processoAtualId); });
  const nome = (proc && proc.processo) ? proc.processo : "processo";
  const limpo = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "").replace(/\s+/g, "_").slice(0, 60);
  const hoje = new Date();
  const carimbo = hoje.getFullYear() +
    String(hoje.getMonth() + 1).padStart(2, "0") +
    String(hoje.getDate()).padStart(2, "0");
  return "mapa_calor_" + limpo + "_" + carimbo + "." + extensao;
}

// Baixa apenas a imagem do fluxograma com o mapa de calor.
function vinculoExportarMapaPng() {
  if (!_vinculoMapaExport) {
    showToast("Gere o mapa de calor antes de exportar.", "error");
    return;
  }
  const a = document.createElement("a");
  a.href = _vinculoMapaExport.dataUrl;
  a.download = vinculoNomeArquivoExport("png");
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast("Imagem do mapa de calor baixada.", "success");
}





// 🆕 Monta a imagem final: fluxograma + relação de riscos logo abaixo.
// A relação traz Processo / Etapa / Risco / Nível atual, para a imagem
// baixada ser autoexplicativa (no papel não existe hover).
function vinculoMontarImagemComRelacao(canvasBase, areas) {
  const proc = processos.find(function (p) { return String(p.id) === String(processoAtualId); });
  const nomeProcesso = (proc && proc.processo) ? proc.processo : "Processo";

  const linhas = [];
  areas.forEach(function (area) {
    area.riscos.forEach(function (r) {
      linhas.push({
        etapa: area.nomeEtapa,
        maior: !!area.maior,
        codigo: r.codigo,
        evento: r.evento,
        nivel: corDoRisco(r.valor).label,
        cor: corDoRisco(r.valor).cor
      });
    });
  });
  if (!linhas.length) return canvasBase;

  // Etapa com mais riscos primeiro na relação.
  linhas.sort(function (a, b) { return (b.maior ? 1 : 0) - (a.maior ? 1 : 0); });

  const L = canvasBase.width;
  const fonte = Math.max(13, L * 0.013);
  const alturaLinha = fonte * 1.9;
  const padding = fonte * 1.4;
  const alturaCabecalho = fonte * 3.2;
  const alturaRelacao = alturaCabecalho + alturaLinha * (linhas.length + 1) + padding * 1.6;

  const out = document.createElement("canvas");
  out.width = L;
  out.height = Math.ceil(canvasBase.height + alturaRelacao);
  const ctx = out.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(canvasBase, 0, 0);

  let y = canvasBase.height;

  // Faixa de título.
  ctx.fillStyle = "#0b7d8c";
  ctx.fillRect(0, y, L, alturaCabecalho);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold " + Math.round(fonte * 1.15) + "px Arial";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(
    vinculoTruncarTextoNoCanvas(ctx, "Riscos vinculados às etapas — " + nomeProcesso, L - padding * 12),
    padding, y + alturaCabecalho / 2
  );
  ctx.font = Math.round(fonte * 0.9) + "px Arial";
  ctx.textAlign = "right";
  const agora = new Date();
  ctx.fillText(
    agora.toLocaleDateString("pt-BR") + " " +
    agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    L - padding, y + alturaCabecalho / 2
  );
  y += alturaCabecalho;

  const colEtapa = padding;
  const colRisco = padding + L * 0.28;
  const colNivel = L - padding - fonte * 5.4;

  // Cabeçalho das colunas.
  ctx.textAlign = "left";
  ctx.fillStyle = "#eef4f6";
  ctx.fillRect(0, y, L, alturaLinha);
  ctx.fillStyle = "#5a6a75";
  ctx.font = "bold " + Math.round(fonte * 0.85) + "px Arial";
  ctx.fillText("ETAPA", colEtapa, y + alturaLinha / 2);
  ctx.fillText("RISCO", colRisco, y + alturaLinha / 2);
  ctx.fillText("NÍVEL ATUAL", colNivel, y + alturaLinha / 2);
  y += alturaLinha;

  linhas.forEach(function (l, i) {
    if (l.maior) {
      ctx.fillStyle = "rgba(211,47,47,0.08)";
      ctx.fillRect(0, y, L, alturaLinha);
    } else if (i % 2 === 1) {
      ctx.fillStyle = "#f7fafb";
      ctx.fillRect(0, y, L, alturaLinha);
    }
    const meio = y + alturaLinha / 2;

    // Etapa (vermelha e em negrito quando é a de mais riscos).
    ctx.font = (l.maior ? "bold " : "") + Math.round(fonte * 0.92) + "px Arial";
    ctx.fillStyle = l.maior ? VINCULO_COR_DESTAQUE : "#23414e";
    ctx.fillText(
      vinculoTruncarTextoNoCanvas(ctx, l.etapa, colRisco - colEtapa - fonte),
      colEtapa, meio
    );

    ctx.font = Math.round(fonte * 0.92) + "px Arial";
    ctx.fillStyle = "#23414e";
    ctx.fillText(
      vinculoTruncarTextoNoCanvas(ctx, l.codigo + " — " + l.evento, colNivel - colRisco - fonte),
      colRisco, meio
    );

    ctx.beginPath();
    ctx.arc(colNivel + fonte * 0.4, meio, fonte * 0.36, 0, Math.PI * 2);
    ctx.fillStyle = l.cor;
    ctx.fill();
    ctx.fillStyle = "#23414e";
    ctx.font = "bold " + Math.round(fonte * 0.92) + "px Arial";
    ctx.fillText(l.nivel, colNivel + fonte * 1.1, meio);

    ctx.strokeStyle = "#e2eaee";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y + alturaLinha);
    ctx.lineTo(L, y + alturaLinha);
    ctx.stroke();

    y += alturaLinha;
  });

  ctx.fillStyle = "#8fa0ab";
  ctx.font = Math.round(fonte * 0.8) + "px Arial";
  ctx.textAlign = "left";
  ctx.fillText(
    "Número no círculo = quantidade de riscos vinculados à etapa. Círculo vermelho = etapa com mais riscos.",
    padding, y + padding * 0.9
  );
  return out;
}

// Cores dos marcadores do mapa de calor
const VINCULO_COR_DESTAQUE = "#d32f2f";
const VINCULO_COR_MARCADOR = "#0f3554";

function vinculoCaminhoArredondado(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.rect(x, y, w, h);
  }
}

function vinculoDesenharMarcadorRisco(ctx, it, maior, largura, altura) {
  const base = Math.max(14, Math.min(largura * 0.0142, it.h * 0.36));
  const raio = maior ? base * 1.25 : base;

  // Centro no canto superior direito da caixa (fora do texto, que é centralizado).
  let cx = it.x + it.w;
  let cy = it.y;
  cx = Math.min(Math.max(cx, raio + 3), largura - raio - 3);
  cy = Math.min(Math.max(cy, raio + 3), altura - raio - 3);

  ctx.save();

  if (maior) {
    // Contorno vermelho na etapa com mais riscos.
    ctx.lineWidth = Math.max(3, base * 0.2);
    ctx.strokeStyle = VINCULO_COR_DESTAQUE;
    vinculoCaminhoArredondado(ctx, it.x - 4, it.y - 4, it.w + 8, it.h + 8, Math.min(12, it.h * 0.18));
    ctx.stroke();

    // Halo vermelho em volta do círculo.
    ctx.beginPath();
    ctx.arc(cx, cy, raio * 1.6, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(211,47,47,0.22)";
    ctx.fill();
  }

  // Círculo preenchido com sombra.
  ctx.shadowColor = "rgba(0,0,0,0.38)";
  ctx.shadowBlur = raio * 0.55;
  ctx.shadowOffsetY = raio * 0.12;
  ctx.beginPath();
  ctx.arc(cx, cy, raio, 0, Math.PI * 2);
  ctx.fillStyle = maior ? VINCULO_COR_DESTAQUE : VINCULO_COR_MARCADOR;
  ctx.fill();

  // Borda branca grossa (separa do desenho).
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.lineWidth = Math.max(2.5, raio * 0.18);
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();

  // Número.
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold " + Math.round(raio * 1.15) + "px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(it.riscos.length), cx, cy + raio * 0.05);

  ctx.restore();
}

async function vinculoGerarMapaDeCalorImagem() {
  const alvo = _vinculoModalAtual && _vinculoModalAtual.querySelector("#vinculoMapaCalorImagem");
  if (!alvo) return;

  const etapasComPosicao = _vinculoEtapasCache.filter(function (e) {
    return e.bbox_w != null && e.bbox_h != null && e.bbox_x != null && e.bbox_y != null;
  });

  if (!_vinculoAnexoAtual) {
    alvo.innerHTML = '<div class="vinculo-vazio-lista">Anexe um fluxograma para gerar o mapa de calor visual.</div>';
    return;
  }

  if (!etapasComPosicao.length) {
    if (_vinculoAvisouBboxFaltando) {
      alvo.innerHTML = '<div class="vinculo-vazio-lista">' +
        '<i class="bi bi-exclamation-triangle-fill" style="color:#e0a83a;"></i> ' +
        '<strong>A posição das etapas foi detectada, mas não pôde ser salva.</strong> ' +
        'A tabela <code>' + VINCULO_TABELA_ETAPAS + '</code> não tem as colunas de posição. ' +
        'Rode no SQL Editor do Supabase e depois use "Limpar e detectar novamente":' +
        '<pre style="white-space:pre-wrap;margin:8px 0 0;padding:8px;border-radius:6px;' +
        'background:rgba(0,0,0,.25);font-size:11.5px;line-height:1.5;">' +
        'alter table ' + VINCULO_TABELA_ETAPAS + '\n' +
        '  add column if not exists bbox_x double precision,\n' +
        '  add column if not exists bbox_y double precision,\n' +
        '  add column if not exists bbox_w double precision,\n' +
        '  add column if not exists bbox_h double precision;</pre>' +
        '</div>';
    } else {
      alvo.innerHTML = '<div class="vinculo-vazio-lista">' +
        '<i class="bi bi-info-circle"></i> Nenhuma etapa cadastrada aqui tem posição registrada no desenho ainda. ' +
        'Isso acontece com etapas adicionadas manualmente ou lidas de um fluxograma NARRATIVO (lista numerada, sem desenho). ' +
        'Use "Detectar etapas deste arquivo" num fluxograma DESENHADO (com caixas/losangos) para capturar a posição de cada etapa.' +
        '</div>';
    }
    return;
  }

  alvo.innerHTML = '<div class="vinculo-vazio-lista">Gerando mapa de calor...</div>';

  try {
    const fonte = await vinculoCarregarImagemFonte(_vinculoAnexoAtual);
    if (!fonte) {
      alvo.innerHTML = '<div class="vinculo-vazio-lista">Não foi possível carregar a imagem-base do fluxograma.</div>';
      return;
    }

    const largura = fonte.naturalWidth || fonte.width;
    const altura = fonte.naturalHeight || fonte.height;
    const canvas = document.createElement("canvas");
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, largura, altura);
    ctx.drawImage(fonte, 0, 0, largura, altura);

    // Área útil do desenho (sem o branco da página), calculada ANTES dos marcadores.
    let areaUtil = { x: 0, y: 0, w: largura, h: altura };
    try { areaUtil = vinculoAreaUtil(canvas); } catch (e) {}

    const riscosDoProcesso = todosRiscosTrat().filter(function (r) {
      return String(r.processoId) === String(processoAtualId);
    });

    // 1) Etapas com risco e suas posições (na ordem original).
    const itens = [];
    etapasComPosicao.forEach(function (etapa) {
      const ids = _vinculoVinculosCache
        .filter(function (v) { return String(v.etapa_id) === String(etapa.id); })
        .map(function (v) { return String(v.risco_id); });
      const riscosDaEtapa = riscosDoProcesso.filter(function (r) {
        return ids.indexOf(String(r.id)) !== -1;
      });
      if (!riscosDaEtapa.length) return; // etapa sem risco fica como no original
      itens.push({
        etapa: etapa,
        riscos: riscosDaEtapa,
        x: etapa.bbox_x * largura,
        y: etapa.bbox_y * altura,
        w: etapa.bbox_w * largura,
        h: etapa.bbox_h * altura
      });
    });

    // 2) Etapa(s) com mais riscos. Se todas empatam, nenhuma fica vermelha.
    const qtds = itens.map(function (it) { return it.riscos.length; });
    const maxQtd = qtds.length ? Math.max.apply(null, qtds) : 0;
    const todasIguais = qtds.length > 1 && qtds.every(function (q) { return q === maxQtd; });
    itens.forEach(function (it) {
      it.maior = !todasIguais && it.riscos.length === maxQtd;
    });

    // 3) Desenha: comuns primeiro, destaque por último (fica por cima).
    itens.filter(function (it) { return !it.maior; })
      .forEach(function (it) { vinculoDesenharMarcadorRisco(ctx, it, false, largura, altura); });
    itens.filter(function (it) { return it.maior; })
      .forEach(function (it) { vinculoDesenharMarcadorRisco(ctx, it, true, largura, altura); });

    // 4) Recorta o branco, garantindo que os marcadores caibam no recorte.
    const folga = Math.max(30, largura * 0.03);
    itens.forEach(function (it) {
      const ax0 = Math.max(0, it.x - folga), ay0 = Math.max(0, it.y - folga);
      const ax1 = Math.min(largura, it.x + it.w + folga), ay1 = Math.min(altura, it.y + it.h + folga);
      const bx1 = Math.max(areaUtil.x + areaUtil.w, ax1), by1 = Math.max(areaUtil.y + areaUtil.h, ay1);
      areaUtil.x = Math.min(areaUtil.x, ax0);
      areaUtil.y = Math.min(areaUtil.y, ay0);
      areaUtil.w = bx1 - areaUtil.x;
      areaUtil.h = by1 - areaUtil.y;
    });
    const canvasRecortado = vinculoCortarCanvas(canvas, areaUtil);

    // 5) Áreas para o tooltip e para a relação (já no sistema do recorte).
    const areasInterativas = itens.map(function (it) {
      return {
        x: it.x - areaUtil.x, y: it.y - areaUtil.y, w: it.w, h: it.h,
        nomeEtapa: vinculoNumeroEtapa(it.etapa.id) + " — " + it.etapa.nome,
        maior: it.maior,
        riscos: it.riscos.map(function (r) {
          const cod = vinculoCodigoRiscoComEtapa(r.id);
          return { codigo: cod, evento: r.evento || "", valor: vinculoValorRiscoParaHeatmap(r) };
        })
      };
    });

    const canvasFinal = vinculoMontarImagemComRelacao(canvasRecortado, areasInterativas);

    alvo.innerHTML = "";
    const barra = document.createElement("div");
    barra.className = "vinculo-acoes-mapa";
    barra.innerHTML =
      '<button type="button" class="vinculo-btn" id="vinculoBtnExportarPng">' +
        '<i class="bi bi-image"></i> Baixar imagem' +
      '</button>';
    alvo.appendChild(barra);

    canvasFinal.style.cssText =
      "display:block;width:100%;height:auto;max-width:100%;border-radius:8px;" +
      "border:1px solid rgba(255,255,255,.12);";
    alvo.appendChild(canvasFinal);
    vinculoAdicionarBotaoExpandir(canvasFinal, "Mapa de calor — riscos por etapa");

    vinculoLigarTooltipMapaCalor(canvasFinal, areasInterativas, alvo);

    _vinculoMapaExport = {
      dataUrl: canvasFinal.toDataURL("image/png"),
      largura: canvasFinal.width,
      altura: canvasFinal.height,
      areas: areasInterativas
    };
    barra.querySelector("#vinculoBtnExportarPng")
      .addEventListener("click", vinculoExportarMapaPng);

    const legenda = document.createElement("div");
    legenda.style.cssText = "display:flex;gap:14px;flex-wrap:wrap;margin-top:8px;font-size:11.5px;color:#8fa9b5;align-items:center;";
    legenda.innerHTML =
      '<span><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:' +
        VINCULO_COR_MARCADOR + ';border:2px solid #fff;vertical-align:-2px;margin-right:5px;"></span>' +
        'Número no círculo = quantidade de riscos</span>' +
      '<span><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:' +
        VINCULO_COR_DESTAQUE + ';border:2px solid #fff;vertical-align:-2px;margin-right:5px;"></span>' +
        'Vermelho = etapa com mais riscos</span>' +
      '<span><i class="bi bi-cursor"></i> Passe o mouse sobre a etapa para ver quais riscos são</span>';
    alvo.appendChild(legenda);
  } catch (e) {
    console.error("[Vinculo] Erro ao gerar mapa de calor:", e);
    alvo.innerHTML = '<div class="vinculo-vazio-lista">Não foi possível gerar o mapa de calor: ' + escapeHTML(e.message) + '</div>';
  }
}

function vinculoRenderResumo() {
  if (!_vinculoModalAtual) return;
  const alvo = _vinculoModalAtual.querySelector("#vinculoResumoEtapas");
  if (!alvo) return;

  const riscosDoProcesso = todosRiscosTrat().filter(function (r) {
    return String(r.processoId) === String(processoAtualId);
  });

  if (!_vinculoEtapasCache.length) {
    alvo.innerHTML = '<div class="vinculo-vazio-lista">Cadastre pelo menos uma etapa para ver o resumo.</div>';
    return;
  }

  const linhas = _vinculoEtapasCache.map(function (etapa) {
    const idsRiscosDaEtapa = _vinculoVinculosCache
      .filter(function (v) { return String(v.etapa_id) === String(etapa.id); })
      .map(function (v) { return String(v.risco_id); });

    const riscosDaEtapa = riscosDoProcesso.filter(function (r) {
      return idsRiscosDaEtapa.indexOf(String(r.id)) !== -1;
    });

    if (!riscosDaEtapa.length) {
      return { nome: etapa.nome, qtd: 0, riscos: [], semRisco: true };
    }

    // 🆕 A coordenação pediu para NÃO exibir média de risco por etapa.
    // Média de nota de risco é um número enganoso: uma etapa com um
    // risco crítico e três baixos "parece" moderada. Agora guardamos
    // apenas a QUANTIDADE e a lista dos riscos em si, que é o dado
    // concreto -- os nomes aparecem ao passar o mouse.
    return {
      nome: vinculoNumeroEtapa(etapa.id) + " — " + etapa.nome,
      qtd: riscosDaEtapa.length,
      semRisco: false,
      riscos: riscosDaEtapa.map(function (r) {
        return {
          codigo: vinculoCodigoRiscoComEtapa(r.id),
          evento: r.evento || ""
        };
      })
    };
  });

  const idsComEtapa = new Set(_vinculoVinculosCache.map(function (v) { return String(v.risco_id); }));
  const semEtapa = riscosDoProcesso.filter(function (r) { return !idsComEtapa.has(String(r.id)); });

  // 🆕 Ordena por QUANTIDADE de riscos (decrescente) -- antes era por
  // risco máximo, que deixou de ser exibido.
  const comRisco = linhas.filter(function (l) { return !l.semRisco; })
    .sort(function (a, b) {
      if (a.qtd !== b.qtd) return b.qtd - a.qtd;
      return a.nome.localeCompare(b.nome);
    });

  const montarLinha = function (l) {
    // 🆕 Sem ícone (i): a pílula com a quantidade já é o próprio alvo do
    // hover (cursor:help + title nativo com a lista completa).
    const listaTitulo = l.riscos.map(function (r) {
      return "• " + r.codigo + " — " + r.evento;
    }).join("\n");

    return '<tr>' +
      '<td>' + escapeHTML(l.nome) + '</td>' +
      '<td>' +
        '<span class="vinculo-qtd-riscos" title="' + escapeHTML(listaTitulo) + '">' +
          '<strong>' + l.qtd + '</strong>' +
        '</span>' +
      '</td>' +
    '</tr>';
  };

  let html = '<table class="vinculo-tabela"><thead><tr>' +
    '<th>Etapa</th><th>Riscos vinculados</th>' +
    '</tr></thead><tbody>';

  if (!comRisco.length) {
    html += '<tr><td colspan="2" style="color:#8fa9b5;">' +
      'Nenhuma etapa tem risco vinculado ainda.' +
      '</td></tr>';
  }
  // 🆕 A tabela mostra APENAS as etapas que têm risco vinculado. O botão
  // "Mostrar N etapa(s) sem risco vinculado" foi removido: listar etapas
  // zeradas não acrescenta informação -- quem não aparece aqui não tem
  // risco, e o fluxograma já mostra isso visualmente (sem marcador).
  comRisco.forEach(function (l) { html += montarLinha(l); });

  html += '</tbody></table>';

  if (semEtapa.length) {
    // 🆕 O aviso agora é acionável: clicar lista QUAIS riscos estão sem
    // etapa, que é a ação mais provável do usuário nesse momento.
    html += '<div class="vinculo-aviso-clicavel" id="vinculoAvisoNaoVinculados" style="margin-top:10px;">' +
      '<i class="bi bi-exclamation-circle"></i> ' + semEtapa.length +
      ' risco(s) deste processo ainda não foram vinculados a nenhuma etapa. ' +
      '<strong>Clique para ver quais.</strong>' +
    '</div>' +
    '<div class="vinculo-lista-naovinculados" id="vinculoListaNaoVinculados" style="display:none;">' +
      semEtapa.map(function (r) {
        const cod = (typeof obterNumeroRisco === "function") ? obterNumeroRisco(r.id) : ("#" + r.id);
        const valor = vinculoValorRiscoParaHeatmap(r);
        return '<div style="margin-bottom:4px;">' +
          '<span class="vinculo-dot" style="background:' + corDoRisco(valor).cor + ';"></span>' +
          '<strong>' + escapeHTML(cod) + '</strong> — ' + escapeHTML(r.evento || "") +
          ' <span style="opacity:.7;">(' + valor.toFixed(1) + ')</span>' +
        '</div>';
      }).join("") +
    '</div>';
  }

  alvo.innerHTML = html;

  const avisoNV = alvo.querySelector("#vinculoAvisoNaoVinculados");
  const listaNV = alvo.querySelector("#vinculoListaNaoVinculados");
  if (avisoNV && listaNV) {
    avisoNV.addEventListener("click", function () {
      listaNV.style.display = listaNV.style.display === "none" ? "block" : "none";
    });
  }

  // 🆕 Depois de atualizar a tabela, tenta (re)gerar a imagem do mapa
  // de calor pintado em cima do fluxograma.
  vinculoGerarMapaDeCalorImagem();
}


// ============================================================
//  👁️ MODO SOMENTE LEITURA NO PLANO DE TRATAMENTO (TCE2026)
//  - Abre com TODAS as divisões e todos os processos marcados
//  - Filtros de divisão/processo continuam funcionando
//  - Cards abrem normalmente, mas os campos ficam travados
//  - Salvar, concluir, reabrir, editar etapa e vínculo de etapas
//    ficam bloqueados (e os botões escondidos)
//  - Exportar PDF continua liberado
// ============================================================
(function modoSomenteLeituraTratamento() {
  "use strict";

  function ehSomenteLeitura() {
    if (window.MAPA_SOMENTE_LEITURA === true) return true;
    try {
      const u = JSON.parse(sessionStorage.getItem("mapa_user") || "{}") || {};
      return u.somente_leitura === true ||
             String(u.matricula || "").trim().toUpperCase() === "TCE2026";
    } catch (e) { return false; }
  }

  if (!ehSomenteLeitura()) return;
  window.MAPA_SOMENTE_LEITURA = true;

  console.log("%c[Tratamento] MODO SOMENTE LEITURA ATIVO",
    "background:#b45309;color:#fff;padding:2px 6px;border-radius:4px");

  // ---------- 1) Libera o filtro de todas as divisões ----------
  if (typeof window.usuarioEhGestorTrat === "function" && !window.usuarioEhGestorTrat.__somenteLeitura) {
    const original = window.usuarioEhGestorTrat;
    const wrap = function () { return true; };
    wrap.__somenteLeitura = true;
    wrap.__original = original;
    window.usuarioEhGestorTrat = wrap;
  }

  // ---------- 2) Bloqueia todas as ações de escrita ----------
  function avisar() {
    if (typeof showToast === "function") {
      showToast("Usuário somente de visualização: ação não permitida.", "error");
    }
  }

  [
    "salvarTratamento", "marcarConcluido", "desmarcarConcluido",
    "ativarEdicaoEtapa", "salvarEdicaoEtapa",
    "confirmarOpcaoTratamento", "tratarMudancaPrazo",
    "vinculoAdicionarEtapa", "vinculoExcluirEtapa",
    "vinculoVincularRiscoAEtapa", "vinculoRemoverVinculoAtual",
    "vinculoLimparERedetectar",
    "vinculoConfirmarSugestoes", "vinculoSbCriarEtapa",
    "vinculoSbExcluirEtapa", "vinculoSbExcluirTodasEtapas",
    "vinculoSbSalvarVinculo", "vinculoSbRemoverVinculo",
    "sbRegistrarMotivoPrazo", "sbRegistrarEdicaoEtapa"
  ].forEach(function (nome) {
    if (typeof window[nome] === "function") {
      window[nome] = function () { avisar(); return null; };
    }
  });

  // Chamadas automáticas da tela: bloqueia sem mostrar aviso.
  ["vinculoDetectarEtapasDoAnexoAtual"].forEach(function (nome) {
    if (typeof window[nome] === "function") {
      window[nome] = async function () { return null; };
    }
  });

  // ---------- 3) Esconde os botões de ação ----------
  const css = document.createElement("style");
  css.id = "estiloSomenteLeituraTratamento";
  css.textContent = `
    .tratamento-footer .btn-save,
    .tratamento-footer .btn-concluir,
    .tratamento-footer .btn-desconcluir,
    .btn-etapa-editar, .btn-etapa-salvar,
    #vinculoBtnAddEtapa, #vinculoNovaEtapaInput,
    #vinculoBtnRedetectar, #vinculoBtnLimparRedetectar,
    #vinculoBtnDesvincular, .vinculo-chip-excluir,
    #vinculoSugestoesOcr {
      display: none !important;
    }
    .tratamento-body input,
    .tratamento-body select,
    .tratamento-body textarea { cursor: not-allowed !important; opacity: .9; }
    .vinculo-chip { cursor: default !important; }
  `;
  document.head.appendChild(css);

  // ---------- 4) Trava os campos dos cards (sem travar os filtros) ----------
  function travarCampos() {
    document.querySelectorAll(
      "#tratamentosLista input, #tratamentosLista select, #tratamentosLista textarea, " +
      ".modal-etapa-box input, .modal-etapa-box select, .modal-etapa-box textarea"
    ).forEach(function (el) {
      if (el.type === "checkbox" || el.type === "radio" || el.tagName === "SELECT" || el.type === "date") {
        el.disabled = true;
      } else {
        el.readOnly = true;
      }
    });
  }

  // Impede que um clique em chip de etapa no modal de vínculo grave algo.
  document.addEventListener("click", function (e) {
    if (e.target.closest(".vinculo-chip")) {
      e.stopPropagation();
      e.preventDefault();
    }
  }, true);

  let agendado = false;
  new MutationObserver(function () {
    if (agendado) return;
    agendado = true;
    setTimeout(function () { agendado = false; travarCampos(); }, 120);
  }).observe(document.documentElement, { childList: true, subtree: true });

  // ---------- 5) Abre já com todas as divisões selecionadas ----------
  let tentativas = 0;
  const timer = setInterval(function () {
    tentativas++;
    const pronto = document.getElementById("menuDivisoesTrat") &&
                   typeof window.selecionarTodasDivisoesTrat === "function";
    if (pronto) {
      clearInterval(timer);
      try {
        window.selecionarTodasDivisoesTrat(true);
        console.log("[Tratamento] Somente leitura: todas as divisões selecionadas.");
      } catch (e) {
        console.warn("[Tratamento] Falha ao selecionar todas as divisões:", e);
      }
      travarCampos();
    } else if (tentativas > 60) {
      clearInterval(timer);
    }
  }, 250);
})();
