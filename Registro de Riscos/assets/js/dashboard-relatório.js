// ============================================================
//  MAPA / TJPR - Relatório Executivo v5 (complemento)
// ------------------------------------------------------------
//  CARREGAR LOGO DEPOIS do dashboard.js no HTML:
//    <script src="assets/js/dashboard.js"></script>
//    <script src="assets/js/dashboard-relatorio-v5.js"></script>
//
//  O que muda no PDF (somente a 1ª página e os KPIs):
//   1) Termômetro de Exposição ao Risco no lugar do KPI
//      "Média de Nível de Riscos" (mesmo cálculo do termômetro
//      da tela: calcularExposicaoGlobal do dashboard.js).
//   2) Unidade/Processo com mais e menos riscos em painéis
//      visuais (número grande, cores e barra de participação).
//   3) Dispersão com TODOS os riscos filtrados, só pontos,
//      uma linha por divisão, eixo X = nível atual
//      (final se tratado; residual se não).
//   4) KPIs Baixo/Médio/Alto pelo nível atual, batendo com
//      os pontos do gráfico.
//  As demais páginas continuam iguais.
// ============================================================
(function () {
  "use strict";

  if (typeof window.montarDadosRelatorioExecutivo !== "function" ||
      typeof window.exportarRelatorioExecutivoPDF !== "function") {
    console.warn("[Relatório v5] dashboard.js não encontrado. Carregue este arquivo DEPOIS do dashboard.js.");
    return;
  }

  const VERMELHO = "#d64545", VERDE = "#2eb87a";

  // ---------------------------------------------------------
  // 1) Dados: KPIs recalculados pelo nível atual (_final)
  // ---------------------------------------------------------
  const montarOriginal = window.montarDadosRelatorioExecutivo;

  function recontar(k, lista) {
    k.baixo = 0; k.medio = 0; k.alto = 0; k.somaNivel = 0;
    lista.forEach(function (r) {
      k[relFaixa(r._final)]++;
      k.somaNivel += Number(r._final) || 0;
    });
    return k;
  }

  window.montarDadosRelatorioExecutivo = function () {
    const d = montarOriginal.apply(this, arguments);
    (d.divisoes || []).forEach(function (div) { recontar(div.kpi, div.riscos); });
    recontar(d.totais, d.riscos || []);
    return d;
  };

  // ---------------------------------------------------------
  // 2) Termômetro (mesmo cálculo da tela)
  // ---------------------------------------------------------
  function exposicao(lista) {
    if (typeof calcularExposicaoGlobal === "function") {
      return calcularExposicaoGlobal({ todosRiscos: lista });
    }
    if (!lista.length) return { percent: 0, label: "SEM DADOS" };
    const soma = lista.reduce(function (a, r) {
      return a + (Number(r.prob) || 0) * (Number(r.imp) || 0) * (Number(r.nivelControle) || 1);
    }, 0);
    const pct = soma / (lista.length * 25) * 100;
    let label = "BAIXA";
    if (pct >= 75) label = "CRÍTICA"; else if (pct >= 50) label = "ALTA"; else if (pct >= 25) label = "MÉDIA";
    return { percent: pct, label: label };
  }

  function corExposicao(label) {
    if (label === "CRÍTICA") return VERMELHO;
    if (label === "ALTA") return "#e8853a";
    if (label === "MÉDIA") return "#e0a800";
    if (label === "BAIXA") return VERDE;
    return REL_CINZA;
  }

  function relTermometro(ctx, x, y, w, h, lista) {
    const exp = exposicao(lista);
    const pct = Math.max(0, Math.min(100, Number(exp.percent) || 0));
    const cor = corExposicao(exp.label);
    relRet(ctx, x, y, w, h, 10, "#f5f8fa", "#e3eaee");
    relRet(ctx, x, y, 6, h, 3, cor);
    ctx.textAlign = "left";
    ctx.fillStyle = REL_CINZA; ctx.font = "bold 11px Arial";
    ctx.fillText("EXPOSIÇÃO AO RISCO", x + 18, y + 20);
    // percentual + selo
    ctx.textAlign = "right";
    ctx.fillStyle = cor; ctx.font = "bold 28px Arial";
    ctx.fillText(Math.round(pct) + "%", x + w - 14, y + 32);
    ctx.font = "bold 11px Arial";
    const tl = ctx.measureText(exp.label).width + 18;
    relRet(ctx, x + w - 14 - tl, y + h - 26, tl, 18, 9, cor);
    ctx.fillStyle = "#ffffff"; ctx.textAlign = "center";
    ctx.fillText(exp.label, x + w - 14 - tl / 2, y + h - 13);
    // barra degradê
    const bx = x + 18, bw = w - 18 - 14 - Math.max(tl, 70) - 18, by = y + 42, bh = 14;
    const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    g.addColorStop(0, VERDE); g.addColorStop(0.35, "#e0a800");
    g.addColorStop(0.65, "#e8853a"); g.addColorStop(1, VERMELHO);
    relRet(ctx, bx, by, bw, bh, 7, "#e3eaee");
    ctx.save(); relRet(ctx, bx, by, bw, bh, 7); ctx.clip();
    ctx.fillStyle = g; ctx.fillRect(bx, by, bw, bh);
    ctx.restore();
    // marcador
    const px = bx + bw * pct / 100;
    ctx.fillStyle = REL_AZUL;
    ctx.beginPath(); ctx.moveTo(px, by - 2); ctx.lineTo(px - 7, by - 11); ctx.lineTo(px + 7, by - 11);
    ctx.closePath(); ctx.fill();
    ctx.fillRect(px - 1.5, by - 2, 3, bh + 4);
    // escala
    ctx.fillStyle = REL_CINZA; ctx.font = "bold 10px Arial"; ctx.textAlign = "left";
    ctx.fillText("0%", bx, by + bh + 14);
    ctx.textAlign = "right"; ctx.fillText("100%", bx + bw, by + bh + 14);
    ctx.textAlign = "left";
  }


  // Termômetro em faixa larga, de lateral a lateral (1ª página),
  // no mesmo estilo do card "Exposição Global ao Risco" da tela.
  function relTermometroLargo(ctx, x, y, w, h, lista) {
    const exp = exposicao(lista);
    const pct = Math.max(0, Math.min(100, Number(exp.percent) || 0));
    const cor = corExposicao(exp.label);
    relRet(ctx, x, y, w, h, 12, "#f5f8fa", "#e3eaee");
    ctx.textAlign = "left"; ctx.fillStyle = REL_AZUL; ctx.font = "bold 15px Arial";
    ctx.fillText("EXPOSIÇÃO GLOBAL AO RISCO", x + 22, y + 28);
    // selo à direita
    ctx.font = "bold 13px Arial";
    const tl = ctx.measureText(exp.label).width + 28;
    relRet(ctx, x + w - 22 - tl, y + 12, tl, 26, 13, "#ffffff", cor);
    ctx.lineWidth = 2; ctx.strokeStyle = cor; ctx.stroke(); ctx.lineWidth = 1;
    ctx.fillStyle = cor; ctx.textAlign = "center";
    ctx.fillText(exp.label, x + w - 22 - tl / 2, y + 30);
    // percentual ao lado do selo
    ctx.textAlign = "right"; ctx.font = "bold 22px Arial";
    ctx.fillText(Math.round(pct) + "%", x + w - 34 - tl, y + 33);
    // trilho + preenchimento degradê até o percentual
    const bx = x + 22, bw = w - 44, by = y + 48, bh = 18;
    relRet(ctx, bx, by, bw, bh, 9, "#e3eaee");
    if (pct > 0) {
      const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      g.addColorStop(0, VERDE); g.addColorStop(0.35, "#e0a800");
      g.addColorStop(0.65, "#e8853a"); g.addColorStop(1, VERMELHO);
      ctx.save(); relRet(ctx, bx, by, Math.max(bh, bw * pct / 100), bh, 9); ctx.clip();
      ctx.fillStyle = g; ctx.fillRect(bx, by, bw, bh); ctx.restore();
    }
    // marcador
    const px = bx + bw * pct / 100;
    ctx.beginPath(); ctx.arc(px, by + bh / 2, 11, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff"; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = cor; ctx.stroke();
    ctx.lineWidth = 1;
    // escala 0 / 25 / 50 / 75 / 100
    ctx.fillStyle = REL_CINZA; ctx.font = "bold 11px Arial";
    [0, 25, 50, 75, 100].forEach(function (v, i) {
      ctx.textAlign = i === 0 ? "left" : i === 4 ? "right" : "center";
      ctx.fillText(v + "%", bx + bw * v / 100, by + bh + 18);
    });
    ctx.textAlign = "left";
  }

  // ---------------------------------------------------------
  // 3) KPIs sem o card de média (o termômetro ocupa o lugar)
  // ---------------------------------------------------------
  window.relKPIs = function (ctx, k, x, y, largura, vertical) {
    const itens = [
      ["PROCESSOS", k.processos, REL_AZUL],
      ["RISCOS", k.riscos, REL_TEAL],
      ["BAIXO", k.baixo, REL_COR_NIVEL.baixo.cor],
      ["MÉDIO", k.medio, REL_COR_NIVEL.medio.cor],
      ["ALTO", k.alto, REL_COR_NIVEL.alto.cor],
      ["A TRATAR", k.aTratar, "#7e57c2"]
    ];
    const gap = 14;
    const w = vertical ? largura : (largura - gap * (itens.length - 1)) / itens.length;
    const h = vertical ? 72 : 82;
    itens.forEach(function (it, i) {
      const cx = vertical ? x : x + i * (w + gap);
      const cy = vertical ? y + i * (h + gap) : y;
      relRet(ctx, cx, cy, w, h, 10, "#f5f8fa", "#e3eaee");
      relRet(ctx, cx, cy, 6, h, 3, it[2]);
      ctx.textAlign = "left";
      ctx.fillStyle = it[2]; ctx.font = "bold " + (vertical ? 30 : 32) + "px Arial";
      ctx.fillText(String(it[1]), cx + 17, cy + (vertical ? 42 : 40));
      ctx.fillStyle = REL_CINZA; ctx.font = "bold 10px Arial";
      ctx.fillText(it[0], cx + 17, cy + h - 12, w - 26);
    });
  };

  // ---------------------------------------------------------
  // 4) Painéis visuais: mais / menos riscos
  // ---------------------------------------------------------
  function blocoDestaque(ctx, x, y, w, h, tipo, reg, total) {
    const mais = tipo === "mais";
    const cor = mais ? VERMELHO : VERDE;
    const fundo = mais ? "#fdeeee" : "#eaf7f0";
    relRet(ctx, x, y, w, h, 12, fundo);
    relRet(ctx, x, y, 7, h, 3, cor);
    ctx.textAlign = "left";
    ctx.fillStyle = cor; ctx.font = "bold 12px Arial";
    ctx.fillText((mais ? "▲  MAIS RISCOS" : "▼  MENOS RISCOS"), x + 20, y + 22);
    if (!reg) {
      ctx.fillStyle = REL_CINZA; ctx.font = "italic 14px Arial";
      ctx.fillText("Sem dados", x + 20, y + 60);
      return;
    }
    // número grande
    ctx.fillStyle = cor; ctx.font = "bold 46px Arial";
    ctx.fillText(String(reg.quantidade), x + 20, y + 72);
    const nw = ctx.measureText(String(reg.quantidade)).width;
    const pct = total ? Math.round(reg.quantidade / total * 100) : 0;
    ctx.fillStyle = REL_CINZA; ctx.font = "bold 13px Arial";
    ctx.fillText(reg.quantidade === 1 ? "risco" : "riscos", x + 28 + nw, y + 56);
    ctx.font = "12px Arial";
    ctx.fillText(pct + "% do total", x + 28 + nw, y + 72);
    // sigla em selo + nome
    ctx.font = "bold 12px Arial";
    const sw = ctx.measureText(reg.sigla).width + 16;
    relRet(ctx, x + 20, y + 84, sw, 20, 10, REL_AZUL);
    ctx.fillStyle = "#ffffff"; ctx.textAlign = "center";
    ctx.fillText(reg.sigla, x + 20 + sw / 2, y + 98);
    ctx.textAlign = "left"; ctx.fillStyle = REL_AZUL; ctx.font = "bold 14px Arial";
    ctx.fillText(relCorta(ctx, reg.nome, w - sw - 50), x + 28 + sw, y + 99);
    // barra de participação
    const bx = x + 20, bw = w - 40, by = y + h - 20;
    relRet(ctx, bx, by, bw, 8, 4, "#ffffff");
    if (pct > 0) relRet(ctx, bx, by, Math.max(8, bw * pct / 100), 8, 4, cor);
  }

  function painelDestaques(ctx, x, y, w, h, titulo, icone, par, total) {
    relRet(ctx, x, y, w, h, 14, "#ffffff", "#dbe5ea");
    ctx.textAlign = "left"; ctx.fillStyle = REL_AZUL; ctx.font = "bold 16px Arial";
    ctx.fillText(icone + "  " + titulo, x + 18, y + 26);
    const gap = 14, bw = (w - 36 - gap) / 2, by = y + 38, bh = h - 50;
    blocoDestaque(ctx, x + 18, by, bw, bh, "mais", par.maior, total);
    blocoDestaque(ctx, x + 18 + bw + gap, by, bw, bh, "menos", par.menor, total);
  }

  // ---------------------------------------------------------
  // 5) Dispersão com todos os riscos (só pontos)
  // ---------------------------------------------------------
  function dispersaoTodos(ctx, dados, op) {
    const divs = dados.divisoes || [];
    const x0 = op.x + 120, y0 = op.y, pw = op.w - 120 - 10, ph = op.h - 46;
    const maxX = 25, linhas = Math.max(divs.length, 1), rowH = ph / linhas;
    const total = (dados.riscos || []).length;
    // Raio adaptado à altura de cada linha, para os pontos caberem empilhados.
    const raio = Math.min(total > 120 ? 4.5 : total > 60 ? 5.5 : 7, rowH / 7);
    // faixas
    [[0, 7, "baixo"], [7, 20, "medio"], [20, 25, "alto"]].forEach(function (f) {
      ctx.fillStyle = REL_COR_NIVEL[f[2]].fundo;
      ctx.fillRect(x0 + pw * f[0] / maxX, y0, pw * (f[1] - f[0]) / maxX, ph);
    });
    // eixo X
    ctx.font = "13px Arial"; ctx.textAlign = "center";
    for (let v = 0; v <= maxX; v += 5) {
      const px = x0 + pw * v / maxX;
      ctx.strokeStyle = "rgba(25,52,81,.10)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px, y0); ctx.lineTo(px, y0 + ph); ctx.stroke();
      ctx.fillStyle = REL_CINZA; ctx.fillText(String(v), px, y0 + ph + 18);
    }
    ctx.fillStyle = REL_AZUL; ctx.font = "bold 13px Arial";
    ctx.fillText("Nível atual do risco (final se tratado; residual se não)", x0 + pw / 2, y0 + ph + 38);
    // linhas por divisão
    divs.forEach(function (div, i) {
      const ry = y0 + rowH * i, cy = ry + rowH / 2;
      if (i > 0) {
        ctx.strokeStyle = "rgba(25,52,81,.18)"; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(x0, ry); ctx.lineTo(x0 + pw, ry); ctx.stroke(); ctx.setLineDash([]);
      }
      ctx.textAlign = "right"; ctx.fillStyle = REL_AZUL; ctx.font = "bold 14px Arial";
      ctx.fillText(div.sigla, x0 - 14, cy + 1);
      ctx.fillStyle = REL_CINZA; ctx.font = "11px Arial";
      ctx.fillText(div.riscos.length + (div.riscos.length === 1 ? " risco" : " riscos"), x0 - 14, cy + 15);
      // beeswarm simples dentro da linha
      const meia = rowH / 2 - raio - 2, passo = raio * 2 + 1;
      const pts = div.riscos.map(function (r) {
        return { r: r, x: x0 + pw * Math.max(0, Math.min(maxX, r._final)) / maxX };
      }).sort(function (a, b) { return a.x - b.x; });
      const colocados = [];
      pts.forEach(function (p) {
        let dy = 0;
        for (let k = 0; k < 60; k++) {
          const cand = (k === 0) ? 0 : (k % 2 ? 1 : -1) * Math.ceil(k / 2) * passo;
          if (Math.abs(cand) > meia) { dy = (k % 2 ? 1 : -1) * meia * Math.random(); break; }
          const bate = colocados.some(function (q) {
            return Math.abs(q.x - p.x) < passo && Math.abs(q.dy - cand) < passo;
          });
          if (!bate) { dy = cand; break; }
        }
        p.dy = dy; colocados.push(p);
      });
      colocados.forEach(function (p) {
        ctx.beginPath(); ctx.arc(p.x, cy + p.dy, raio, 0, Math.PI * 2);
        ctx.globalAlpha = 0.92;
        ctx.fillStyle = REL_COR_NIVEL[relFaixa(p.r._final)].cor; ctx.fill();
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1.5; ctx.strokeStyle = "#ffffff"; ctx.stroke();
      });
    });
    ctx.strokeStyle = "#8fa2ae"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0, y0 + ph); ctx.lineTo(x0 + pw, y0 + ph); ctx.stroke();
    ctx.textAlign = "left";
  }

  function legendaDispersao(ctx, x, y, k) {
    ctx.textAlign = "left"; ctx.font = "bold 13px Arial";
    let lx = x;
    [["baixo", k.baixo], ["medio", k.medio], ["alto", k.alto]].forEach(function (it) {
      ctx.beginPath(); ctx.arc(lx + 7, y - 4, 7, 0, Math.PI * 2);
      ctx.fillStyle = REL_COR_NIVEL[it[0]].cor; ctx.fill();
      const t = REL_COR_NIVEL[it[0]].label + " · " + it[1];
      ctx.fillStyle = REL_AZUL; ctx.fillText(t, lx + 20, y);
      lx += ctx.measureText(t).width + 50;
    });
    ctx.fillStyle = REL_CINZA; ctx.font = "italic 12px Arial"; ctx.textAlign = "right";
    ctx.fillText("Cada ponto é um risco. Pontos próximos são afastados para não se sobrepor.", 1360, y);
    ctx.textAlign = "left";
  }

  // ---------------------------------------------------------
  // 6) Página 1 (visão geral)
  // ---------------------------------------------------------
  window.relPaginaGeral = function (dados, escopo) {
    const c = relCanvas(REL_W, REL_H), ctx = c.ctx;
    const ano = String(escopo || "").match(/\b(?:19|20)\d{2}\b/);
    relTitulo(ctx, "Visão geral", ano ? ano[0] : "Período selecionado");
    // Termômetro de lateral a lateral; KPIs logo abaixo.
    relTermometroLargo(ctx, 40, 80, 1320, 94, dados.riscos || []);
    window.relKPIs(ctx, dados.totais, 40, 184, 1320, false);
    const total = (dados.riscos || []).length, d = dados.destaques;
    painelDestaques(ctx, 40, 278, 652, 186, "UNIDADES", "■", d.unidades, total);
    painelDestaques(ctx, 708, 278, 652, 186, "PROCESSOS DE TRABALHO", "■", d.processos, total);
    ctx.fillStyle = REL_AZUL; ctx.font = "bold 17px Arial"; ctx.textAlign = "left";
    ctx.fillText("Dispersão de todos os riscos (" + total + ")", 40, 488);
    dispersaoTodos(ctx, dados, { x: 40, y: 498, w: 1320, h: 256 });
    legendaDispersao(ctx, 160, 772, dados.totais);
    return c.canvas;
  };

  // ---------------------------------------------------------
  // 7) Página da divisão: termômetro no lugar da média
  // ---------------------------------------------------------
  window.relPaginaDivisao = function (div) {
    const c = relCanvas(REL_W, REL_H), ctx = c.ctx;
    const top = relTop10(div.riscos);
    relTitulo(ctx, div.sigla + "  ·  " + div.nome, "Detalhamento da divisão");
    relTermometro(ctx, 40, 90, 230, 92, div.riscos);
    window.relKPIs(ctx, div.kpi, 40, 196, 230, true);
    ctx.fillStyle = REL_AZUL; ctx.font = "bold 20px Arial"; ctx.textAlign = "left";
    ctx.fillText("Maiores níveis de risco da divisão", 300, 112);
    relGrafico(ctx, top, { x: 290, y: 126, w: 1070, h: 610 });
    relLegenda(ctx, 360, 764, div.riscos.length, top.length);
    return c.canvas;
  };

  console.log("%c[Relatório v5] ativo: termômetro, destaques visuais e dispersão completa.",
    "background:#0e9aa7;color:#fff;padding:2px 8px;border-radius:4px;");
})();
