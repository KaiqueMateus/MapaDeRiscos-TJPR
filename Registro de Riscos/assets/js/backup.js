// ============================================================
//  BACKUP / RESTORE - Gerencia dados do localStorage em JSON
// ============================================================

const BACKUP_VERSION = "1.0";
const CHAVE_ULTIMO_BACKUP = "mapa_ultimo_backup";

// ============ MODAL - abrir/fechar ============
function abrirModalBackup() {
  const modal = document.getElementById("modalBackup");
  if (!modal) return;
  atualizarEstatisticasBackup();
  atualizarStatusUltimoBackup();
  modal.style.display = "flex";
}

function fecharModalBackup() {
  const modal = document.getElementById("modalBackup");
  if (modal) modal.style.display = "none";
}

// ============ COLETA DE DADOS DO LOCALSTORAGE ============
function coletarDadosBackup() {
  const dados = {
    _versao: BACKUP_VERSION,
    _exportadoEm: new Date().toISOString(),
    _exportadoPor: (JSON.parse(sessionStorage.getItem("mapa_user")) || {}).nome || "-",
    _divisao: (JSON.parse(sessionStorage.getItem("mapa_user")) || {}).divisao || "-",
    processos: {},
    riscos: {},
    logs: {},
    ultimos_processos: {},
    tema: localStorage.getItem("mapa_theme") || "dark",
    som: localStorage.getItem("mapa_som") || "on"
  };

  // Varre localStorage completo
  for (let i = 0; i < localStorage.length; i++) {
    const chave = localStorage.key(i);

    if (chave.startsWith("processos_")) {
      dados.processos[chave] = JSON.parse(localStorage.getItem(chave));
    }
    else if (chave.startsWith("riscos_")) {
      dados.riscos[chave] = JSON.parse(localStorage.getItem(chave));
    }
    else if (chave.startsWith("logs_riscos_")) {
      dados.logs[chave] = JSON.parse(localStorage.getItem(chave));
    }
    else if (chave.startsWith("ultimo_proc_")) {
      dados.ultimos_processos[chave] = localStorage.getItem(chave);
    }
  }

  return dados;
}

// ============ EXPORTAR JSON ============
function exportarBackup() {
  try {
    const dados = coletarDadosBackup();

    // Estatísticas pro nome do arquivo
    const totalProc = Object.values(dados.processos).reduce((a, arr) => a + arr.length, 0);
    const totalRisc = Object.values(dados.riscos).reduce((a, arr) => a + arr.length, 0);

    const json = JSON.stringify(dados, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    // Nome: mapa-tjpr-DPP-2026-07-13.json
    const user = JSON.parse(sessionStorage.getItem("mapa_user") || "{}");
    const div = (user.divisao || "geral").toLowerCase();
    const data = new Date().toISOString().substring(0, 10);
    const nomeArq = `mapa-tjpr-${div}-${data}.json`;

    const a = document.createElement("a");
    a.href = url;
    a.download = nomeArq;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Marca timestamp do último backup
    localStorage.setItem(CHAVE_ULTIMO_BACKUP, new Date().toISOString());

    if (typeof showToast === "function") {
      showToast(`✅ Backup exportado! ${totalProc} processos, ${totalRisc} riscos`, "success");
    }
    if (typeof tocarSom === "function") tocarSom("success");

    // Registra no log
    if (typeof registrarLog === "function") {
      registrarLog("exportar_backup", null, `Backup exportado: ${nomeArq}`);
    }

    atualizarStatusUltimoBackup();
  } catch (e) {
    console.error("[Backup]", e);
    if (typeof showToast === "function") showToast("Erro ao exportar backup", "error");
  }
}

// ============ IMPORTAR JSON ============
function abrirSeletorArquivoBackup() {
  const input = document.getElementById("inputArquivoBackup");
  if (input) input.click();
}

function processarArquivoBackup(event) {
  const arquivo = event.target.files[0];
  if (!arquivo) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const dados = JSON.parse(e.target.result);

      if (!dados._versao) {
        if (typeof showToast === "function") showToast("Arquivo inválido — não é um backup MAPA", "error");
        return;
      }

      // Confirmação
      const totalProc = Object.values(dados.processos || {}).reduce((a, arr) => a + arr.length, 0);
      const totalRisc = Object.values(dados.riscos || {}).reduce((a, arr) => a + arr.length, 0);
      const dataExp = new Date(dados._exportadoEm).toLocaleDateString("pt-BR");

      const msg =
        `📤 Importar Backup?\n\n` +
        `📅 Exportado em: ${dataExp}\n` +
        `👤 Por: ${dados._exportadoPor}\n` +
        `🏢 Divisão: ${dados._divisao}\n` +
        `📋 Processos: ${totalProc}\n` +
        `⚠️ Riscos: ${totalRisc}\n\n` +
        `⚠️ ATENÇÃO: Isso vai SOBRESCREVER seus dados atuais.\n\n` +
        `Deseja continuar?`;

      if (!confirm(msg)) return;

      // Restaura
      restaurarDadosBackup(dados);

      if (typeof showToast === "function") showToast("✅ Backup restaurado! Recarregando...", "success");
      setTimeout(() => location.reload(), 1500);
    } catch (err) {
      console.error("[Backup import]", err);
      if (typeof showToast === "function") showToast("Arquivo JSON inválido", "error");
    }
  };
  reader.readAsText(arquivo);
  event.target.value = ""; // permite reimportar mesmo arquivo
}

function restaurarDadosBackup(dados) {
  // Limpa apenas dados MAPA (mantém login e outros)
  const chavesRemover = [];
  for (let i = 0; i < localStorage.length; i++) {
    const c = localStorage.key(i);
    if (c.startsWith("processos_") || c.startsWith("riscos_") ||
        c.startsWith("logs_riscos_") || c.startsWith("ultimo_proc_")) {
      chavesRemover.push(c);
    }
  }
  chavesRemover.forEach(c => localStorage.removeItem(c));

  // Restaura processos
  Object.keys(dados.processos || {}).forEach(k => {
    localStorage.setItem(k, JSON.stringify(dados.processos[k]));
  });

  // Restaura riscos
  Object.keys(dados.riscos || {}).forEach(k => {
    localStorage.setItem(k, JSON.stringify(dados.riscos[k]));
  });

  // Restaura logs
  Object.keys(dados.logs || {}).forEach(k => {
    localStorage.setItem(k, JSON.stringify(dados.logs[k]));
  });

  // Restaura últimos processos
  Object.keys(dados.ultimos_processos || {}).forEach(k => {
    localStorage.setItem(k, dados.ultimos_processos[k]);
  });

  // Restaura preferências
  if (dados.tema) localStorage.setItem("mapa_theme", dados.tema);
  if (dados.som) localStorage.setItem("mapa_som", dados.som);

  localStorage.setItem(CHAVE_ULTIMO_BACKUP, new Date().toISOString());
}

// ============ ESTATÍSTICAS ============
function atualizarEstatisticasBackup() {
  let totalProc = 0, totalRisc = 0, totalLogs = 0, tamanho = 0;
  const divisoes = new Set();

  for (let i = 0; i < localStorage.length; i++) {
    const c = localStorage.key(i);
    const val = localStorage.getItem(c) || "";
    tamanho += val.length;

    if (c.startsWith("processos_")) {
      divisoes.add(c.replace("processos_", ""));
      try { totalProc += JSON.parse(val).length; } catch (e) {}
    }
    else if (c.startsWith("riscos_")) {
      try { totalRisc += JSON.parse(val).length; } catch (e) {}
    }
    else if (c.startsWith("logs_riscos_")) {
      try { totalLogs += JSON.parse(val).length; } catch (e) {}
    }
  }

  const el = document.getElementById("estatisticasBackup");
  if (!el) return;

  const kb = (tamanho / 1024).toFixed(1);
  el.innerHTML =
    `<div class="stat-item"><i class="bi bi-folder2-open"></i> <strong>${totalProc}</strong> processos</div>` +
    `<div class="stat-item"><i class="bi bi-exclamation-triangle"></i> <strong>${totalRisc}</strong> riscos</div>` +
    `<div class="stat-item"><i class="bi bi-journal-text"></i> <strong>${totalLogs}</strong> logs</div>` +
    `<div class="stat-item"><i class="bi bi-diagram-3"></i> <strong>${divisoes.size}</strong> divisão(ões)</div>` +
    `<div class="stat-item"><i class="bi bi-hdd"></i> <strong>${kb} KB</strong> ocupados</div>`;
}

function atualizarStatusUltimoBackup() {
  const el = document.getElementById("statusUltimoBackup");
  if (!el) return;

  const ultimo = localStorage.getItem(CHAVE_ULTIMO_BACKUP);
  if (!ultimo) {
    el.innerHTML = '<span class="alerta-backup">⚠️ Nunca foi feito backup!</span>';
    return;
  }

  const dt = new Date(ultimo);
  const dias = Math.floor((Date.now() - dt.getTime()) / 86400000);
  const dataStr = dt.toLocaleDateString("pt-BR") + " às " + dt.toLocaleTimeString("pt-BR").substring(0, 5);

  if (dias > 30) {
    el.innerHTML = `<span class="alerta-backup">⚠️ Último backup há ${dias} dias (${dataStr}). Faça um novo!</span>`;
  } else if (dias > 7) {
    el.innerHTML = `<span class="aviso-backup">💡 Último backup há ${dias} dias (${dataStr}).</span>`;
  } else {
    el.innerHTML = `<span class="ok-backup">✅ Último backup: ${dataStr} (há ${dias} dia(s))</span>`;
  }
}

// ============ LIMPAR DADOS ============
function limparTodosDados() {
  const msg =
    "⚠️ APAGAR TODOS OS DADOS?\n\n" +
    "Isso vai remover:\n" +
    "• Todos os processos (registros)\n" +
    "• Todos os riscos\n" +
    "• Todos os logs\n" +
    "• Todas as preferências\n\n" +
    "Digite EXCLUIR (em maiúsculas) para confirmar:";

  const resp = prompt(msg);
  if (resp !== "EXCLUIR") {
    if (typeof showToast === "function") showToast("Cancelado", "success");
    return;
  }

  // Sugere fazer backup antes
  if (confirm("🎯 Antes de excluir, quer fazer um backup?\n\nOK = Fazer backup e sair\nCancelar = Excluir sem backup")) {
    exportarBackup();
    return;
  }

  // Limpa dados MAPA
  const chavesRemover = [];
  for (let i = 0; i < localStorage.length; i++) {
    const c = localStorage.key(i);
    if (c.startsWith("processos_") || c.startsWith("riscos_") ||
        c.startsWith("logs_riscos_") || c.startsWith("ultimo_proc_")) {
      chavesRemover.push(c);
    }
  }
  chavesRemover.forEach(c => localStorage.removeItem(c));

  if (typeof showToast === "function") showToast("🗑️ Dados apagados! Recarregando...", "success");
  setTimeout(() => location.reload(), 1200);
}

// ============ ALERTA AUTOMÁTICO (30 dias) ============
function verificarAlertaBackup() {
  const ultimo = localStorage.getItem(CHAVE_ULTIMO_BACKUP);
  if (!ultimo) return; // primeira vez, não avisa

  const dias = Math.floor((Date.now() - new Date(ultimo).getTime()) / 86400000);
  const jaAvisouHoje = sessionStorage.getItem("mapa_alerta_backup_hoje");

  if (dias >= 30 && !jaAvisouHoje) {
    sessionStorage.setItem("mapa_alerta_backup_hoje", "1");
    setTimeout(() => {
      if (typeof showToast === "function") {
        showToast(`💾 Faça backup! Último foi há ${dias} dias`, "error");
      }
    }, 3000);
  }
}

// Roda ao carregar
document.addEventListener("DOMContentLoaded", verificarAlertaBackup);