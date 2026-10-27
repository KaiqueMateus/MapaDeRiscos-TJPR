const SENHA_PADRAO = "SEPREC2026";

// 🔑 Senhas específicas por matrícula (substituem a senha padrão)
const SENHAS_ESPECIFICAS = {
  "TCE2026": "TCE2026"
  "TESTE": "TESTE"
};

// 👁️ Matrículas somente leitura (reforço caso a coluna não venha do banco)
const MATRICULAS_SOMENTE_LEITURA_LOGIN = ["TCE2026"];

const form       = document.getElementById("loginForm");
const btnLogin   = document.getElementById("btnLogin");
const btnText    = document.querySelector(".btn-text");
const btnLoading = document.querySelector(".btn-loading");
const errorMsg   = document.getElementById("errorMsg");
const errorText  = document.getElementById("errorText");

/* ============================================================
   RESET AO VOLTAR
   ============================================================ */
window.addEventListener("pageshow", (event) => {
  setLoading(false);
  errorMsg.style.display = "none";
  form.reset();

  if (event.persisted) {
    sessionStorage.removeItem("mapa_user");
  }
});

/* ============================================================
   MOSTRAR / OCULTAR SENHA
   ============================================================ */
document
  .getElementById("togglePassword")
  .addEventListener("click", () => {
    const senhaInput = document.getElementById("senha");
    const icon = document.querySelector("#togglePassword i");

    if (senhaInput.type === "password") {
      senhaInput.type = "text";
      icon.classList.replace("bi-eye", "bi-eye-slash");
    } else {
      senhaInput.type = "password";
      icon.classList.replace("bi-eye-slash", "bi-eye");
    }
  });

/* ============================================================
   SUBMIT DO FORMULÁRIO
   ============================================================ */
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  errorMsg.style.display = "none";

  // Aceita "tce2026" ou "TCE2026" (matrículas numéricas não mudam)
  const matricula = document
    .getElementById("matricula")
    .value
    .trim()
    .toUpperCase();

  const senha = document
    .getElementById("senha")
    .value;

  if (!matricula || !senha) {
    showError("Preencha todos os campos.");
    return;
  }

  setLoading(true);

  try {
    // 1. Valida a senha
    //    - TCE2026 usa a senha própria (TCE2026)
    //    - Demais usuários continuam com a senha padrão
    const senhaEsperada = Object.prototype.hasOwnProperty.call(SENHAS_ESPECIFICAS, matricula)
      ? SENHAS_ESPECIFICAS[matricula]
      : SENHA_PADRAO;

    if (senha !== senhaEsperada) {
      throw new Error("Senha incorreta.");
    }

    // 2. Confirma se o cliente Supabase foi carregado
    if (!window.sb) {
      throw new Error(
        "Cliente Supabase não inicializado. Recarregue a página."
      );
    }

    if (typeof window.sbBuscarUsuario !== "function") {
      throw new Error(
        "A função de busca de usuário não foi carregada."
      );
    }

    // 3. Busca o usuário no Supabase
    const usuario = await window.sbBuscarUsuario(matricula);

    console.log("[LOGIN] Usuário retornado:", usuario);

    if (!usuario) {
      throw new Error(
        "Matrícula não encontrada ou usuário inativo."
      );
    }

    // 4. Define se é somente leitura (coluna do banco OU lista fixa)
    const somenteLeitura =
      usuario.somente_leitura === true ||
      MATRICULAS_SOMENTE_LEITURA_LOGIN.indexOf(
        String(usuario.matricula).toUpperCase()
      ) >= 0;

    // 5. Normaliza os dados do usuário
    const usuarioSessao = {
      id: usuario.id,
      matricula: usuario.matricula,
      nome: usuario.nome,
      divisao: usuario.divisao_sigla,
      is_gestor: usuario.is_gestor === true,
      somente_leitura: somenteLeitura,
      login_at: new Date().toISOString()
    };

    // 6. Salva na sessão do navegador
    sessionStorage.setItem(
      "mapa_user",
      JSON.stringify(usuarioSessao)
    );

    // 7. Registra o log sem impedir o acesso
    if (typeof window.sbRegistrarLog === "function") {
      try {
        await window.sbRegistrarLog(
          usuario.id,
          usuario.divisao_sigla,
          "login",
          "sessao",
          null,
          somenteLeitura
            ? "Login realizado (somente leitura)"
            : "Login realizado"
        );
      } catch (logError) {
        console.warn(
          "[LOGIN] Usuário autenticado, mas o log não foi registrado:",
          logError
        );
      }
    } else {
      console.warn(
        "[LOGIN] Função sbRegistrarLog não encontrada."
      );
    }

    // 8. Redireciona conforme permissão
    const destino = usuarioSessao.is_gestor
      ? "dashboard.html"
      : "index.html";

    window.location.replace(destino);

  } catch (err) {
    console.error("[LOGIN] Falha na autenticação:", err);

    showError(
      err.message || "Falha ao autenticar."
    );

    setLoading(false);
  }
});

/* ============================================================
   HELPERS
   ============================================================ */
function showError(msg) {
  errorText.textContent = msg;
  errorMsg.style.display = "flex";
}

function setLoading(loading) {
  btnLogin.disabled = loading;
  btnText.style.display = loading ? "none" : "inline";
  btnLoading.style.display = loading
    ? "inline-flex"
    : "none";
}

/* ============================================================
   CONTROLE DE TEMA
   ============================================================ */
(function () {
  const themeToggle = document.getElementById("themeToggle");
  const themeIcon = document.getElementById("themeIcon");
  const STORAGE_KEY = "mapa_theme";

  function applyTheme(theme) {
    document.documentElement.setAttribute(
      "data-theme",
      theme
    );

    themeIcon.className = theme === "light"
      ? "bi bi-moon-stars-fill"
      : "bi bi-sun-fill";
  }

  const savedTheme =
    localStorage.getItem(STORAGE_KEY) || "dark";

  applyTheme(savedTheme);

  themeToggle.addEventListener("click", () => {
    const current =
      document.documentElement.getAttribute("data-theme")
      || "dark";

    const next =
      current === "dark"
        ? "light"
        : "dark";

    themeToggle.classList.add("rotating");

    setTimeout(() => {
      themeToggle.classList.remove("rotating");
    }, 500);

    applyTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
  });
})();
