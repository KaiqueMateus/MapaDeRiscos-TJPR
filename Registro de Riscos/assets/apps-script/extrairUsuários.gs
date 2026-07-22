/**
 * Lê todas as planilhas da pasta do Drive e gera users.json
 * Padrão do nome: Divisao_NomeCompleto (ex.: DPP_Vanessa Schon)
 * Matrícula lida da célula D3
 */

const FOLDER_ID        = "1E0cHVCO1Or--OJx2e8FY7Yv2gkhpmzYJ"; // sua pasta
const CELULA_MATRICULA = "D3";  // ajuste se necessário
const ABA_INDEX        = 0;     // primeira aba

function gerarUsuariosJson() {
  const folder = DriveApp.getFolderById(FOLDER_ID);
  const files  = folder.getFilesByType(MimeType.GOOGLE_SHEETS);

  const users = [];
  let processados = 0, ignorados = 0;

  while (files.hasNext()) {
    const file = files.next();
    const nomeArquivo = file.getName();

    const match = nomeArquivo.match(/^([^_]+)_(.+)$/);
    if (!match) {
      Logger.log("Ignorado (fora do padrão): " + nomeArquivo);
      ignorados++;
      continue;
    }

    const divisao = match[1].trim();
    const nome    = match[2].trim();

    try {
      const ss    = SpreadsheetApp.open(file);
      const sheet = ss.getSheets()[ABA_INDEX];
      const matricula = String(sheet.getRange(CELULA_MATRICULA).getValue()).trim();

      if (!matricula) { ignorados++; continue; }

      users.push({ matricula: matricula, nome: nome, divisao: divisao });
      processados++;
    } catch (e) {
      Logger.log("Erro em " + nomeArquivo + ": " + e);
      ignorados++;
    }
  }

  users.sort((a, b) => (a.divisao + a.nome).localeCompare(b.divisao + b.nome));

  const blob = Utilities.newBlob(
    JSON.stringify(users, null, 2),
    "application/json",
    "users.json"
  );

  // Remove arquivo antigo
  const existentes = folder.getFilesByName("users.json");
  while (existentes.hasNext()) existentes.next().setTrashed(true);

  folder.createFile(blob);

  Logger.log("✅ Processados: " + processados + " | Ignorados: " + ignorados);
  return users;
}