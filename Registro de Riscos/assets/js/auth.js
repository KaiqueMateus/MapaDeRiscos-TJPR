// ============ VALIDAÇÃO DE SESSÃO E PERMISSÕES ============

// 🔒 Lista de matrículas com acesso ao dashboard
const MATRICULAS_ADMIN = ["20145", "295816", "15280", "51587", "293898", "8406", "17222", "15343", "17691", "14929", "17904", "52176", "11018", "52201", "7289", "10001"];

(function() {
  const raw = sessionStorage.getItem("mapa_user");
  if (!raw) {
    window.location.replace("login.html");
    return;
  }
  try {
    const user = JSON.parse(raw);
    if (!user.matricula) throw new Error("Sessão inválida");
    window.MAPA_USER = user;

    // 🎯 Verifica se está tentando acessar o dashboard sem permissão
    const paginaAtual = window.location.pathname.split("/").pop() || "";
    const isAdmin = MATRICULAS_ADMIN.indexOf(String(user.matricula)) >= 0;

    if (paginaAtual === "dashboard.html" && !isAdmin) {
      window.location.replace("index.html");
      return;
    }
  } catch (e) {
    sessionStorage.removeItem("mapa_user");
    window.location.replace("login.html");
  }
})();

function logout() {
  if (!confirm("Deseja realmente sair?")) return;
  sessionStorage.removeItem("mapa_user");
  window.location.replace("login.html");
}

// 🔒 Helper global para verificar se é admin
function ehAdmin() {
  const user = window.MAPA_USER || {};
  return MATRICULAS_ADMIN.indexOf(String(user.matricula)) >= 0;
}

(function() {
  const raw = sessionStorage.getItem("mapa_user");
  if (!raw) {
    window.location.replace("login.html");
    return;
  }
  try {
    const user = JSON.parse(raw);
    if (!user.matricula) throw new Error("Sessão inválida");
    window.MAPA_USER = user;
  } catch (e) {
    sessionStorage.removeItem("mapa_user");
    window.location.replace("login.html");
  }
})();

function logout() {
  if (!confirm("Deseja realmente sair?")) return;
  sessionStorage.removeItem("mapa_user");
  window.location.replace("login.html");
}
