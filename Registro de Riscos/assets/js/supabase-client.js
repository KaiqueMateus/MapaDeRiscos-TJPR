// ============================================================
//  SUPABASE CLIENT - Conexão global
// ============================================================
 
const SUPABASE_URL =
  "https://scdvgdkxmhchdzgebwwy.supabase.co";
 
const SUPABASE_KEY =
  "sb_publishable_oFK97yikYWOO-c0iXtd3Nw_G0Dua5iW";
 
// Cria cliente global
window.sb = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);
 
console.log("[Supabase] Cliente pronto ✅");
 
// ============================================================
// BUSCAR USUÁRIO
// ============================================================
 
window.sbBuscarUsuario = async function (matricula) {
  const matriculaLimpa = String(matricula ?? "").trim();
 
  console.log("[LOGIN] Consultando matrícula:", matriculaLimpa);
 
  const { data, error, status, statusText } = await window.sb
    .from("usuarios")
    .select("*")
    .eq("matricula", matriculaLimpa)
    .eq("ativo", true)
    .maybeSingle();
 
  console.log("[LOGIN] Resultado da consulta:", {
    data,
    error,
    status,
    statusText
  });
 
  if (error) {
    console.error("[LOGIN] Erro retornado pelo Supabase:", error);
 
    throw new Error(
      `Erro ao consultar usuário: ${error.message || "erro desconhecido"}`
    );
  }
 
  return data;
};
// ============================================================
// REGISTRAR LOG
// ============================================================
 
window.sbRegistrarLog = async function (
  usuarioId,
  divisao,
  acao,
  entidadeTipo,
  entidadeId,
  detalhes
) {
  const { error } = await window.sb
    .from("logs_auditoria")
    .insert({
      usuario_id: usuarioId,
      divisao_sigla: divisao,
      acao: acao,
      entidade_tipo: entidadeTipo,
      entidade_id: entidadeId,
      detalhes: detalhes
    });
 
  if (error) {
    console.error("[sbRegistrarLog]", error);
  }
};
 
// ============================================================
// TESTES TEMPORÁRIOS
// ============================================================
 
window.sb
  .from("usuarios")
  .select("*")
  .then(({ data, error }) => {
    console.log("[Teste] Todos os usuários:", data);
    console.log("[Teste] Erro:", error);
  });
 
window.sb
  .from("usuarios")
  .select("*")
  .eq("matricula", "20145")
  .then(({ data, error }) => {
    console.log("[Teste] Usuário 20145:", data);
    console.log("[Teste] Erro 20145:", error);
  });

  // ============================================================
// PROCESSOS - CRUD via Supabase
// ============================================================

/**
 * Lista processos filtrando por divisão do usuário
 * Se gestor, retorna TODOS os processos
 */
async function sbListarProcessos() {
  const user = JSON.parse(sessionStorage.getItem("mapa_user") || "{}");

  // 🎯 Detecta se está na página de riscos (index) ou tratamento
  const pathname = window.location.pathname.toLowerCase();
  const naPaginaOperacional = pathname.includes("index.html")
                            || pathname.includes("tratamento.html")
                            || pathname === "/"
                            || pathname.endsWith("/");

  // 🎯 Regra:
  // - Gestor + página operacional (index/tratamento) → vê TUDO (ignora filtro)
  // - Gestor + dashboard → respeita o filtro selecionado
  // - Não-gestor → só a divisão dele (sempre)
  let divisoes;
  if (user.is_gestor && naPaginaOperacional) {
    divisoes = null;  // sem filtro = vê tudo
  } else if (user.is_gestor) {
    divisoes = getDivisoesFiltro();  // dashboard aplica filtro
  } else {
    divisoes = [user.divisao];  // não-gestor sempre da própria divisão
  }

  console.log("[sbListarProcessos] Gestor:", user.is_gestor, "| Página operacional:", naPaginaOperacional, "| Divisões:", divisoes);

  let query = sb.from("processos")
    .select("*")
    .order("criado_em", { ascending: false });

  // Só filtra se tem lista de divisões
  if (divisoes && divisoes.length > 0) {
    query = query.in("divisao_sigla", divisoes);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[sbListarProcessos]", error);
    return [];
  }
  return data || [];
}


/**
 * Cria um processo novo
 */
async function sbCriarProcesso(dados) {
  const user = JSON.parse(sessionStorage.getItem("mapa_user") || "{}");

  const unidade = dados.unidade || user.divisao;

  const payload = {
    divisao_sigla:        unidade,     // 🎯 divisão = unidade
    unidade:              unidade,
    processo:             dados.processo,
    objetivo:             dados.objetivo || null,
    resultado:            dados.resultado || null,
    clientes_demandantes: dados.clientes || null,
    areas_envolvidas:     dados.areas || null,
    macroprocesso:        dados.macroprocesso || null,
    data_registro:        dados.data || null,
    criado_por:           user.id
  };

  console.log("[sbCriarProcesso] Payload:", payload);

  const { data, error } = await sb
    .from("processos")
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error("[sbCriarProcesso] ERRO:", error);
    return null;
  }

  return data;
}


/**
 * Atualiza processo existente
 */
async function sbAtualizarProcesso(id, dados) {
  const payload = {
    processo:             dados.processo,
    objetivo:             dados.objetivo || null,
    resultado:            dados.resultado || null,
    clientes_demandantes: dados.clientes || null,
    areas_envolvidas:     dados.areas || null,
    macroprocesso:        dados.macroprocesso || null,
    data_registro:        dados.data || null
  };

  // 🎯 Se veio unidade, atualiza divisão junto
  if (dados.unidade) {
    payload.unidade       = dados.unidade;
    payload.divisao_sigla = dados.unidade;
  }

  const { data, error } = await sb
    .from("processos")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[sbAtualizarProcesso] ERRO:", error);
    return null;
  }

  return data;
}

/**
 * Deleta processo
 */
async function sbDeletarProcesso(id) {
  const { error } = await sb.from("processos").delete().eq("id", id);
  if (error) {
    console.error("[sbDeletarProcesso]", error);
    return false;
  }
  return true;
}

/**
 * Converte formato Supabase (snake_case) para formato antigo (camelCase interno do sistema)
 */
function sbConverterProcesso(p) {
  if (!p) return null;
  return {
    id: p.id,
    equipe: p.equipe || "",
    processo: p.processo,
    objetivo: p.objetivo || "",
    compilado: p.compilado_por || "",
    analisado: p.analisado_por || "",
    data: p.data_registro || "",
    divisao: p.divisao_sigla,
    criadoPor: p.criado_por,
    criadoEm: p.criado_em,
    // organogramas ficam vazios (não migramos)
    organogramas: []
  };
}

// ============================================================
// PROCESSOS - CRUD via Supabase
// ============================================================

async function sbListarProcessos() {
  const user = JSON.parse(sessionStorage.getItem("mapa_user") || "{}");

  // 🎯 Detecta se está na página de riscos (index) ou tratamento
  const pathname = window.location.pathname.toLowerCase();
  const naPaginaOperacional = pathname.includes("index.html")
                            || pathname.includes("tratamento.html")
                            || pathname === "/"
                            || pathname.endsWith("/");

  // 🎯 Regra:
  // - Gestor + página operacional (index/tratamento) → vê TUDO (ignora filtro)
  // - Gestor + dashboard → respeita o filtro selecionado
  // - Não-gestor → só a divisão dele (sempre)
  let divisoes;
  if (user.is_gestor && naPaginaOperacional) {
    divisoes = null;  // sem filtro = vê tudo
  } else if (user.is_gestor) {
    divisoes = getDivisoesFiltro();  // dashboard aplica filtro
  } else {
    divisoes = [user.divisao];  // não-gestor sempre da própria divisão
  }

  console.log("[sbListarProcessos] Gestor:", user.is_gestor, "| Página operacional:", naPaginaOperacional, "| Divisões:", divisoes);

  let query = sb.from("processos")
    .select("*")
    .order("criado_em", { ascending: false });

  // Só filtra se tem lista de divisões
  if (divisoes && divisoes.length > 0) {
    query = query.in("divisao_sigla", divisoes);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[sbListarProcessos]", error);
    return [];
  }
  return data || [];
}

async function sbAtualizarProcesso(id, dados) {
  const payload = {
    equipe: dados.equipe || null,
    processo: dados.processo,
    objetivo: dados.objetivo || null,
    compilado_por: dados.compilado || null,
    analisado_por: dados.analisado || null,
    data_registro: dados.data || null
  };

  const { data, error } = await sb
    .from("processos")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[sbAtualizarProcesso]", error);
    return null;
  }
  return data;
}

async function sbDeletarProcesso(id) {
  const { error } = await sb.from("processos").delete().eq("id", id);
  if (error) {
    console.error("[sbDeletarProcesso]", error);
    return false;
  }
  return true;
}

function sbConverterProcesso(p) {
  if (!p) return null;
  return {
    id: p.id,
    equipe: p.equipe || "",
    processo: p.processo,
    objetivo: p.objetivo || "",
    compilado: p.compilado_por || "",
    analisado: p.analisado_por || "",
    data: p.data_registro || "",
    divisao: p.divisao_sigla,
    criadoPor: p.criado_por,
    criadoEm: p.criado_em,
    organogramas: []
  };
}

// ============================================================
// RISCOS - CRUD via Supabase
// ============================================================

async function sbListarRiscosDoProcesso(processoId) {
  if (!processoId) return [];
  const { data, error } = await sb
    .from("riscos")
    .select("*")
    .eq("processo_id", processoId)
    .order("criado_em", { ascending: true });
  if (error) {
    console.error("[sbListarRiscosDoProcesso]", error);
    return [];
  }
  return data || [];
}

async function sbListarTodosRiscos() {
  const user = JSON.parse(sessionStorage.getItem("mapa_user") || "{}");

  const pathname = window.location.pathname.toLowerCase();
  const naPaginaOperacional = pathname.includes("index.html")
                            || pathname.includes("tratamento.html")
                            || pathname === "/"
                            || pathname.endsWith("/");

  let divisoes;
  if (user.is_gestor && naPaginaOperacional) {
    divisoes = null;
  } else if (user.is_gestor) {
    divisoes = getDivisoesFiltro();
  } else {
    divisoes = [user.divisao];
  }

  console.log("[sbListarTodosRiscos] Gestor:", user.is_gestor, "| Página operacional:", naPaginaOperacional, "| Divisões:", divisoes);

  // 1) Busca processos (com ou sem filtro de divisão)
  let queryProcs = sb.from("processos").select("id");
  if (divisoes && divisoes.length > 0) {
    queryProcs = queryProcs.in("divisao_sigla", divisoes);
  }

  const { data: procs, error: eProcs } = await queryProcs;
  if (eProcs) {
    console.error("[sbListarTodosRiscos] procs:", eProcs);
    return [];
  }

  const ids = (procs || []).map(function(p) { return p.id; });
  if (ids.length === 0) return [];

  // 2) Riscos desses processos
  const { data, error } = await sb
    .from("riscos")
    .select("*")
    .in("processo_id", ids)
    .order("criado_em", { ascending: false });

  if (error) {
    console.error("[sbListarTodosRiscos] riscos:", error);
    return [];
  }

  console.log("[sbListarTodosRiscos] Retornou:", data.length, "riscos");
  return data || [];

}

async function sbCriarRisco(dados) {
  const user = JSON.parse(sessionStorage.getItem("mapa_user") || "{}");

  const payload = {
    processo_id: dados.processoId,
    evento: dados.evento,
    causa_fonte: dados.causaFonte || null,
    causa_vulnerabilidade: dados.causaVulnerabilidade || null,
    consequencia: dados.consequencia || null,
    prob: parseInt(dados.prob) || 1,
    imp: parseInt(dados.imp) || 1,
    desc_controle: dados.descControle || null,
    nivel_controle: parseFloat(dados.nivelControle) || 1,
    tratar: dados.tratar || "Não",
    prioritario: dados.prioritario || "Não",
    justificativa_nao_tratar: dados.justificativaNaoTratar || null,
    criado_por: user.id
  };

  const { data, error } = await sb
    .from("riscos")
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error("[sbCriarRisco]", error);
    return null;
  }
  return data;
}

async function sbAtualizarRisco(id, dados) {
  const payload = {
    evento: dados.evento,
    causa_fonte: dados.causaFonte || null,
    causa_vulnerabilidade: dados.causaVulnerabilidade || null,
    consequencia: dados.consequencia || null,
    prob: parseInt(dados.prob) || 1,
    imp: parseInt(dados.imp) || 1,
    desc_controle: dados.descControle || null,
    nivel_controle: parseFloat(dados.nivelControle) || 1,
    tratar: dados.tratar || "Não",
    prioritario: dados.prioritario || "Não",
    justificativa_nao_tratar: dados.justificativaNaoTratar || null
  };

  const { data, error } = await sb
    .from("riscos")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[sbAtualizarRisco]", error);
    return null;
  }
  return data;
}

async function sbDeletarRisco(id) {
  const { error } = await sb.from("riscos").delete().eq("id", id);
  if (error) {
    console.error("[sbDeletarRisco]", error);
    return false;
  }
  return true;
}

function sbConverterRisco(r) {
  if (!r) return null;
  return {
    id: r.id,
    processoId: r.processo_id,
    evento: r.evento,
    causaFonte: r.causa_fonte || "",
    causaVulnerabilidade: r.causa_vulnerabilidade || "",
    causa: (r.causa_fonte || "") + (r.causa_vulnerabilidade ? " • " + r.causa_vulnerabilidade : ""),
    consequencia: r.consequencia || "",
    prob: r.prob,
    imp: r.imp,
    descControle: r.desc_controle || "",
    nivelControle: parseFloat(r.nivel_controle) || 1,
    tratar: r.tratar || "Não",
    prioritario: r.prioritario || "Não",
    justificativaNaoTratar: r.justificativa_nao_tratar || "",
    // 🎯 Valores calculados vindo do Postgres
    nivel: r.nivel || (r.prob * r.imp),
    residual: parseFloat(r.residual) || (r.prob * r.imp * (parseFloat(r.nivel_controle) || 1)),
    classificacaoNivel: r.classificacao_nivel || "",
    classificacaoResidual: r.classificacao_residual || "",
    criadoPor: r.criado_por,
    criadoEm: r.criado_em,
    tratamento: { historico: [] }
  };
}

console.log("=== IDs dos campos do modal ===");
document.querySelectorAll("#modalRisco select, #modalRisco input, #modalRisco textarea").forEach(el => {
  console.log(el.id, "=", el.value || "(vazio)");
});

// ============================================================
// TRATAMENTO ETAPAS - CRUD via Supabase
// ============================================================

async function sbListarEtapasDoRisco(riscoId) {
  const { data, error } = await sb
    .from("tratamento_etapas")
    .select("*")
    .eq("risco_id", riscoId)
    .order("numero_etapa", { ascending: true });

  if (error) {
    console.error("[sbListarEtapasDoRisco]", error);
    return [];
  }
  return data || [];
}

async function sbListarTodasEtapas() {
  const user = JSON.parse(sessionStorage.getItem("mapa_user") || "{}");

  let query = sb
    .from("tratamento_etapas")
    .select("*, riscos!inner(processo_id, processos!inner(divisao_sigla))");

  if (!user.is_gestor) {
    query = query.eq("riscos.processos.divisao_sigla", user.divisao);
  }

  const { data, error } = await query.order("criado_em", { ascending: false });
  if (error) {
    console.error("[sbListarTodasEtapas]", error);
    return [];
  }
  return data || [];
}

async function sbCriarEtapa(riscoId, dados) {
  const user = JSON.parse(sessionStorage.getItem("mapa_user") || "{}");

  // Descobre próximo número de etapa
  const { data: existentes } = await sb
    .from("tratamento_etapas")
    .select("numero_etapa")
    .eq("risco_id", riscoId)
    .order("numero_etapa", { ascending: false })
    .limit(1);

  const proximoNum = existentes && existentes.length > 0
    ? existentes[0].numero_etapa + 1
    : 1;

  const payload = {
    risco_id: riscoId,
    numero_etapa: proximoNum,
    opcao: dados.opcao || null,
    custo_beneficio: dados.custoBeneficio || null,
    responsavel: dados.responsavel || null,
    prazo: dados.prazo || null,
    descricao: dados.descricao || null,
    nivel_monitoramento: parseFloat(dados.nivelMonitoramento) || null,
    monitoramento_obs: dados.monitoramento || null,
    reaberta: !!dados.reaberta,
    concluido: !!dados.concluido,
    concluido_em: dados.concluidoEm || null,
    concluido_por: dados.concluidoPor || null,
    criado_por: user.id
  };

  const { data, error } = await sb
    .from("tratamento_etapas")
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error("[sbCriarEtapa]", error);
    return null;
  }
  return data;
}

async function sbAtualizarEtapa(etapaId, dados) {
  const payload = {
    opcao: dados.opcao || null,
    custo_beneficio: dados.custoBeneficio || null,
    responsavel: dados.responsavel || null,
    prazo: dados.prazo || null,
    descricao: dados.descricao || null,
    nivel_monitoramento: parseFloat(dados.nivelMonitoramento) || null,
    monitoramento_obs: dados.monitoramento || null
  };

  const { data, error } = await sb
    .from("tratamento_etapas")
    .update(payload)
    .eq("id", etapaId)
    .select()
    .single();

  if (error) {
    console.error("[sbAtualizarEtapa]", error);
    return null;
  }
  return data;
}

async function sbConcluirEtapa(etapaId) {
  const user = JSON.parse(sessionStorage.getItem("mapa_user") || "{}");

  const { data, error } = await sb
    .from("tratamento_etapas")
    .update({
      concluido: true,
      concluido_em: new Date().toISOString(),
      concluido_por: user.id
    })
    .eq("id", etapaId)
    .select()
    .single();

  if (error) {
    console.error("[sbConcluirEtapa]", error);
    return null;
  }
  return data;
}

async function sbReabrirRisco(riscoId) {
  // Cria etapa nova com reaberta=true
  return await sbCriarEtapa(riscoId, { reaberta: true });
}

async function sbDeletarEtapa(etapaId) {
  const { error } = await sb
    .from("tratamento_etapas")
    .delete()
    .eq("id", etapaId);
  return !error;
}

function sbConverterEtapa(e) {
  if (!e) return null;
  return {
    id: e.id,
    numeroEtapa: e.numero_etapa,
    opcao: e.opcao || "",
    custoBeneficio: e.custo_beneficio || "",
    responsavel: e.responsavel || "",
    prazo: e.prazo || "",
    descricao: e.descricao || "",
    nivelMonitoramento: parseFloat(e.nivel_monitoramento) || 0,
    monitoramento: e.monitoramento_obs || "",
    reaberta: !!e.reaberta,
    concluido: !!e.concluido,
    concluidoEm: e.concluido_em || null,
    concluidoPor: e.concluido_por || null,
    emAtraso: !!e.em_atraso,
    criadoEm: e.criado_em,
    criadoPor: e.criado_por
  };
}
// Agrupa etapas por risco (pra popular risco.tratamento.historico)
async function sbCarregarEtapasNosRiscos(listaRiscos) {
  if (!listaRiscos || listaRiscos.length === 0) return;

  const ids = listaRiscos.map(r => r.id).filter(x => x);
  if (ids.length === 0) return;

  const { data, error } = await sb
    .from("tratamento_etapas")
    .select("*")
    .in("risco_id", ids)
    .order("numero_etapa", { ascending: true });

  if (error) {
    console.error("[sbCarregarEtapasNosRiscos]", error);
    return;
  }

  // Agrupa por risco_id
  const porRisco = {};
  (data || []).forEach(e => {
    if (!porRisco[e.risco_id]) porRisco[e.risco_id] = [];
    porRisco[e.risco_id].push(sbConverterEtapa(e));
  });

  // Coloca nos riscos
  listaRiscos.forEach(r => {
    r.tratamento = { historico: porRisco[r.id] || [] };
  });
}

// ============================================================
// LOGS AUDITORIA - Leitura via Supabase
// ============================================================

async function sbListarLogs(limite) {
  const user = JSON.parse(sessionStorage.getItem("mapa_user") || "{}");
  limite = limite || 200;

  let query = sb
    .from("logs_auditoria")
    .select("*, usuarios(matricula, nome, divisao_sigla)")
    .order("criado_em", { ascending: false })
    .limit(limite);

  // Não-gestor só vê logs da sua divisão
  if (!user.is_gestor) {
    query = query.eq("divisao_sigla", user.divisao);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[sbListarLogs]", error);
    return [];
  }
  return data || [];
}

function sbConverterLog(l) {
  if (!l) return null;
  return {
    id: l.id,
    acao: l.acao,
    entidadeTipo: l.entidade_tipo,
    entidadeId: l.entidade_id,
    detalhes: l.detalhes,
    usuario: l.usuarios ? l.usuarios.nome : "-",
    matricula: l.matricula || (l.usuarios ? l.usuarios.matricula : "-"),  // 🆕 prioriza coluna direta
    divisao: l.divisao_sigla || "-",
    quando: l.criado_em
  };
}
// ============================================================
// ORGANOGRAMAS - Storage + Metadados (bucket "organogramas_v1")
// ============================================================

async function sbUploadOrganograma(processoId, file) {
  const user = JSON.parse(sessionStorage.getItem("mapa_user") || "{}");

  const ext = file.name.split(".").pop();
  const storagePath = "processo_" + processoId + "/" + Date.now() + "_" +
                      Math.random().toString(36).substring(7) + "." + ext;

  const { data: upData, error: upError } = await sb.storage
    .from("organogramas_v1")
    .upload(storagePath, file, {
      cacheControl: "3600",
      upsert: false
    });

  if (upError) {
    console.error("[sbUploadOrganograma] Upload:", upError);
    return null;
  }

  const { data: dbData, error: dbError } = await sb
    .from("organogramas")
    .insert({
      processo_id: processoId,
      nome_original: file.name,
      tipo_mime: file.type,
      tamanho_bytes: file.size,
      storage_path: storagePath,
      upload_por: user.id
    })
    .select()
    .single();

  if (dbError) {
    console.error("[sbUploadOrganograma] DB:", dbError);
    await sb.storage.from("organogramas_v1").remove([storagePath]);
    return null;
  }

  console.log("✅ Organograma salvo:", file.name);
  return dbData;
}

async function sbListarOrganogramas(processoId) {
  const { data, error } = await sb
    .from("organogramas")
    .select("*")
    .eq("processo_id", processoId)
    .order("criado_em", { ascending: true });

  if (error) {
    console.error("[sbListarOrganogramas]", error);
    return [];
  }
  return data || [];
}

function sbGetUrlOrganograma(storagePath) {
  const result = sb.storage.from("organogramas_v1").getPublicUrl(storagePath);
  return result.data.publicUrl;
}

function sbConverterOrganograma(o) {
  if (!o) return null;
  return {
    id: o.id,
    nome: o.nome_original,
    tipo: o.tipo_mime,
    tamanho: o.tamanho_bytes,
    storagePath: o.storage_path,
    url: sbGetUrlOrganograma(o.storage_path),
    uploadPor: o.upload_por,
    criadoEm: o.criado_em
  };
}

async function sbDeletarOrganograma(id, storagePath) {
  const { error: sErr } = await sb.storage
    .from("organogramas_v1")
    .remove([storagePath]);
  if (sErr) console.warn("[sbDeletarOrganograma] Storage:", sErr);

  const { error: dbErr } = await sb
    .from("organogramas")
    .delete()
    .eq("id", id);

  return !dbErr;
}

// ============================================================
// DASHBOARD - Agregações via Supabase
// ============================================================

/**
 * Busca TODOS os dados necessários pro dashboard de uma vez
 * (múltiplas queries em paralelo pra ser rápido)
 */
async function sbCarregarDadosDashboard() {
  const divisoes = getDivisoesFiltro();
  console.log("[Dashboard] Divisões:", divisoes);

  try {
    const { data: procsData } = await sb
      .from("processos")
      .select("*")
      .in("divisao_sigla", divisoes);

    const procs = procsData || [];
    if (procs.length === 0) return { todosProcessos: [], todosRiscos: [] };

    const procIds = procs.map(function(p) { return p.id; });
    const { data: riscosData } = await sb
      .from("riscos")
      .select("*")
      .in("processo_id", procIds);
    const riscosRaw = riscosData || [];

    let etapasRaw = [];
    if (riscosRaw.length > 0) {
      const riscoIds = riscosRaw.map(function(r) { return r.id; });
      const { data: etapasData } = await sb
        .from("tratamento_etapas")
        .select("*")
        .in("risco_id", riscoIds)
        .order("numero_etapa", { ascending: true });
      etapasRaw = etapasData || [];
    }

    const divPorProc = {};
    procs.forEach(function(p) { divPorProc[p.id] = p.divisao_sigla; });

    const etapasPorRisco = {};
    etapasRaw.forEach(function(e) {
      if (!etapasPorRisco[e.risco_id]) etapasPorRisco[e.risco_id] = [];
      etapasPorRisco[e.risco_id].push(sbConverterEtapa(e));
    });

    const riscos = riscosRaw.map(function(r) {
      const conv = sbConverterRisco(r);
      conv._divisao = divPorProc[r.processo_id] || null;
      conv.tratamento = { historico: etapasPorRisco[r.id] || [] };
      return conv;
    });

    const processos = procs.map(function(p) {
      const conv = sbConverterProcesso(p);
      conv._divisao = p.divisao_sigla;
      return conv;
    });

    console.log("[Dashboard] Total:", processos.length, "procs,", riscos.length, "riscos");
    return { todosProcessos: processos, todosRiscos: riscos };
  } catch (e) {
    console.error("[Dashboard]", e);
    return { todosProcessos: [], todosRiscos: [] };
  }
}

// Helper: calcula nível atualizado do risco (residual × monitoramento)
function calcularNivelAtualizado(risco, etapa) {
  const nivel = risco.prob * risco.imp;
  const residual = nivel * (risco.nivelControle || 1);

  if (!etapa || !etapa.nivelMonitoramento) return residual;

  const fatorMon = parseFloat(etapa.nivelMonitoramento) || 1;
  return residual * fatorMon;
}

// ============================================================
// FILTRO MULTI-DIVISÃO COMPARTILHADO
// ============================================================

const NOMES_DIVISOES_MULTI = {
  "DA":   "Divisão Administrativa",
  "DC":   "Divisão de Cálculos",
  "DPP":  "Divisão de Pagamento de Precatórios",
  "CJ":   "Consultoria Jurídica",
  "AA":   "Assessoria de Atendimento",
  "AT":   "Assessoria Técnica",
  "DCGA": "Divisão de Controle e Gestão de Aportes"
};

const MATRICULAS_ADMIN_MULTI = ["20145", "295816", "15280", "51587", "293898", "8406", "17222", "15343", "17691", "14929", "17904", "52176", "11018", "52201", "7289"];

function isGestorMulti() {
  const user = JSON.parse(sessionStorage.getItem("mapa_user") || "{}");
  return MATRICULAS_ADMIN_MULTI.indexOf(String(user.matricula)) >= 0 || user.is_gestor === true;
}

/**
 * Retorna array de divisões que devem ser exibidas ao usuário atual
 */
function getDivisoesFiltro() {
  const user = JSON.parse(sessionStorage.getItem("mapa_user") || "{}");

  // Se não é gestor, sempre retorna só a divisão dele
  if (!isGestorMulti()) {
    return [user.divisao];
  }

  // Gestor: pega do sessionStorage ou padrão
  const raw = sessionStorage.getItem("mapa_filtro_divisoes");
  if (raw) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length > 0) return arr;
    } catch (e) {}
  }

  // Default: divisão do gestor
  return [user.divisao];
}

/**
 * Salva as divisões filtradas
 */
function setDivisoesFiltro(divisoes) {
  const arr = Array.isArray(divisoes) ? divisoes : Array.from(divisoes);
  sessionStorage.setItem("mapa_filtro_divisoes", JSON.stringify(arr));
}

/**
 * Renderiza o filtro em qualquer container (id: "chipsDivisoes")
 * onChange: callback ao mudar seleção
 */
function renderizarFiltroMultiDivisao(onChange) {
  const container = document.querySelector(".divisao-filter-multi");
  const chipsCont = document.getElementById("chipsDivisoes");
  const lockIcon = document.getElementById("divisaoLockIcon");
  const label = document.getElementById("divisaoAtualLabel");
  if (!chipsCont) return;

  const user = JSON.parse(sessionStorage.getItem("mapa_user") || "{}");
  const gestor = isGestorMulti();
  const selecionadas = new Set(getDivisoesFiltro());

  if (!gestor) {
    if (lockIcon) lockIcon.style.display = "inline-flex";
    if (container) container.classList.add("locked");
  } else {
    if (lockIcon) lockIcon.style.display = "none";
    if (container) container.classList.remove("locked");
  }

  chipsCont.innerHTML = "";

  // Botões de atalho (só pra gestor)
  if (gestor) {
    // 🌍 Todas
    const chipTodas = document.createElement("span");
    chipTodas.className = "chip-todas chip-todas-primary";
    chipTodas.innerHTML = '<i class="bi bi-check2-all"></i> Todas';
    chipTodas.onclick = function() {
      setDivisoesFiltro(Object.keys(NOMES_DIVISOES_MULTI));
      renderizarFiltroMultiDivisao(onChange);
      if (typeof onChange === "function") onChange();
    };
    chipsCont.appendChild(chipTodas);

    // 🗑️ Limpar TUDO
    const chipLimpar = document.createElement("span");
    chipLimpar.className = "chip-todas chip-todas-danger";
    chipLimpar.innerHTML = '<i class="bi bi-trash"></i> Limpar tudo';
    chipLimpar.onclick = function() {
      setDivisoesFiltro([]);
      renderizarFiltroMultiDivisao(onChange);
      if (typeof onChange === "function") onChange();
    };
    chipsCont.appendChild(chipLimpar);

    // 🏠 Só minha divisão
    const chipMinha = document.createElement("span");
    chipMinha.className = "chip-todas";
    chipMinha.innerHTML = '<i class="bi bi-house"></i> Só ' + user.divisao;
    chipMinha.onclick = function() {
      setDivisoesFiltro([user.divisao]);
      renderizarFiltroMultiDivisao(onChange);
      if (typeof onChange === "function") onChange();
    };
    chipsCont.appendChild(chipMinha);
  }

  // Chips das divisões
  Object.keys(NOMES_DIVISOES_MULTI).forEach(function(sigla) {
    const chip = document.createElement("span");
    chip.className = "chip-divisao";
    chip.setAttribute("data-div", sigla);
    chip.title = NOMES_DIVISOES_MULTI[sigla];
    chip.innerHTML = '<i class="bi bi-check chip-check"></i> ' + sigla;

    if (selecionadas.has(sigla)) chip.classList.add("active");

    chip.onclick = function() {
      if (!gestor) return;

      const atual = new Set(getDivisoesFiltro());

      // 🎯 Agora deixa desmarcar QUALQUER uma (inclusive a última)
      if (atual.has(sigla)) {
        atual.delete(sigla);
      } else {
        atual.add(sigla);
      }

      setDivisoesFiltro(Array.from(atual));
      renderizarFiltroMultiDivisao(onChange);
      if (typeof onChange === "function") onChange();
    };

    chipsCont.appendChild(chip);
  });

  // Label de status
  if (label) {
    const arr = getDivisoesFiltro();
    const total = arr.length;
    const totalPossivel = Object.keys(NOMES_DIVISOES_MULTI).length;

    if (!gestor) {
      label.innerHTML = '🔒 Restrito à sua divisão: <strong>' + user.divisao + '</strong>';
      label.style.color = "";
    } else if (total === 0) {
      label.innerHTML = '⚠️ <strong>Nenhuma divisão selecionada</strong> — nenhum dado exibido';
      label.style.color = "var(--accent-red)";
    } else if (total === totalPossivel) {
      label.innerHTML = '🌍 Vendo <strong>todas as divisões</strong>';
      label.style.color = "";
    } else if (total === 1) {
      label.innerHTML = '👀 Vendo: <strong>' + arr[0] + '</strong> (' + (NOMES_DIVISOES_MULTI[arr[0]] || arr[0]) + ')';
      label.style.color = "";
    } else {
      label.innerHTML = '📊 Vendo <strong>' + total + ' divisões</strong>: ' + arr.join(", ");
      label.style.color = "";
    }
  }
}

// ============================================================
// PROCESSOS - CRUD via Supabase (VERSÃO ATUALIZADA COM CAMPOS NOVOS)
// ============================================================

async function sbListarProcessos() {
  const user = JSON.parse(sessionStorage.getItem("mapa_user") || "{}");

  // 🎯 Detecta se está no dashboard (única página que aplica filtro global)
  const noDashboard = window.location.pathname.toLowerCase().includes("dashboard");

  // 🎯 Regra:
  // - Não-gestor → sempre só a divisão dele
  // - Gestor no dashboard → respeita filtro
  // - Gestor em qualquer OUTRA página → vê tudo
  let divisoes;
  if (!user.is_gestor) {
    divisoes = [user.divisao];
  } else if (noDashboard) {
    divisoes = getDivisoesFiltro();
  } else {
    divisoes = null;  // 🎯 gestor fora do dashboard → sem filtro
  }

  console.log("[sbListarProcessos] Gestor:", user.is_gestor, "| noDashboard:", noDashboard, "| Divisões:", divisoes);

  let query = sb.from("processos")
    .select("*")
    .order("criado_em", { ascending: false });

  if (divisoes && divisoes.length > 0) {
    query = query.in("divisao_sigla", divisoes);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[sbListarProcessos]", error);
    return [];
  }
  return data || [];
}

async function sbAtualizarProcesso(id, dados) {
  const payload = {
    unidade:              dados.unidade || null,
    processo:             dados.processo,
    objetivo:             dados.objetivo || null,
    resultado:            dados.resultado || null,
    clientes_demandantes: dados.clientes || null,
    areas_envolvidas:     dados.areas || null,
    macroprocesso:        dados.macroprocesso || null,
    data_registro:        dados.data || null
  };

  // 🎯 Se veio divisão nos dados (gestor editando), atualiza também
  if (dados.divisao) {
    payload.divisao_sigla = dados.divisao;
  }

  console.log("[sbAtualizarProcesso] Payload:", payload);

  const { data, error } = await sb
    .from("processos")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[sbAtualizarProcesso] ERRO:", error);
    return null;
  }

  return data;
}

async function sbDeletarProcesso(id) {
  const { error } = await sb.from("processos").delete().eq("id", id);
  if (error) {
    console.error("[sbDeletarProcesso]", error);
    return false;
  }
  return true;
}

function sbConverterProcesso(p) {
  if (!p) return null;
  return {
    id:            p.id,
    unidade:       p.unidade || p.equipe || "",      // 🎯 fallback pra equipe antiga (retrocompatibilidade)
    processo:      p.processo,
    objetivo:      p.objetivo || "",
    resultado:     p.resultado || "",
    clientes:      p.clientes_demandantes || "",
    areas:         p.areas_envolvidas || "",
    macroprocesso: p.macroprocesso || "",
    data:          p.data_registro || "",
    divisao:       p.divisao_sigla,
    criadoPor:     p.criado_por,
    criadoEm:      p.criado_em,
    organogramas:  []
  };
}