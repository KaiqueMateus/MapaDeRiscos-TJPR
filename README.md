# 🛡️ Mapa de Riscos — Sistema de Gestão de Riscos Corporativos

> Sistema web **full-stack** desenvolvido do zero para **registro, análise, tratamento e monitoramento de riscos organizacionais**, seguindo as metodologias **ISO 31000** e **COSO ERM**. Aplicado ao contexto de gestão pública, com dashboard executivo interativo, matriz de risco dinâmica, relatórios em PDF e controle de acesso multiusuário por divisão.

![License](https://img.shields.io/badge/License-MIT-blue)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?logo=supabase&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?logo=vercel&logoColor=white)
![Chart.js](https://img.shields.io/badge/Chart.js-FF6384?logo=chartdotjs&logoColor=white)
![ISO 31000](https://img.shields.io/badge/ISO_31000-Gestão_de_Riscos-orange)

🔗 **Demo ao vivo:** [mapa-riscos.vercel.app](#) &nbsp;•&nbsp; 💻 **Código:** [github.com/kaique/mapa-riscos](#)

---

## 🖼️ Preview do Sistema

<!-- Substitua pelas suas capturas de tela -->

> 🔑 **Credenciais de demonstração:**
>
> | Perfil | Matrícula | Senha |
> |--------|-----------|-------|
> | 👩‍💼 Gestora (acesso total) | `10001` | `DEMO2026` |
> | 👤 Usuário comum | `10002` | `DEMO2026` |
> | 🔧 Admin | `99999` | `DEMO2026` |

---

## 📌 Sumário

- [🎯 Visão Geral](#-visão-geral)
- [💼 Problema de Negócio](#-problema-de-negócio)
- [✅ Solução Desenvolvida](#-solução-desenvolvida)
- [🛠️ Stack Utilizada](#️-stack-utilizada)
- [🏗️ Arquitetura da Aplicação](#️-arquitetura-da-aplicação)
- [🧩 Módulos do Sistema](#-módulos-do-sistema)
- [📈 Metodologia de Cálculo de Risco](#-metodologia-de-cálculo-de-risco)
- [🔒 Segurança e Governança](#-segurança-e-governança)
- [💡 Impacto e Resultados](#-impacto-e-resultados)

---

## 🎯 Visão Geral

Este projeto é uma solução completa de **Governança, Risco e Compliance (GRC)** construída para digitalizar e automatizar todo o ciclo de vida da gestão de riscos de uma organização pública — desde o **registro do processo de trabalho**, passando pela **identificação e análise quantitativa dos riscos**, até o **plano de tratamento** e o **monitoramento contínuo** da exposição residual.

O sistema substitui planilhas manuais e fragmentadas por uma plataforma web centralizada, multiusuário e multi-divisão, com **dashboard executivo em tempo real** que permite aos gestores visualizar a concentração de riscos, priorizar ações e acompanhar a eficiência do tratamento — tudo em uma interface responsiva com **dark mode**, **filtros cruzados estilo Power BI** e **exportação profissional em PDF**.

Toda a solução foi arquitetada para ser **escalável e auditável**, com backend serverless (Supabase), autenticação por matrícula, políticas de segurança em nível de linha (RLS) e trilha de auditoria completa (quem fez o quê e quando).

---

## 💼 Problema de Negócio

Antes da implementação, a gestão de riscos da secretaria era conduzida em **planilhas isoladas por divisão**, gerando uma série de gargalos:

- **Ausência de padronização** na identificação e análise dos riscos entre as diferentes divisões;
- **Cálculo manual e inconsistente** do nível de risco (probabilidade × impacto), do risco residual e do risco final pós-tratamento;
- **Falta de visão consolidada** — os gestores não conseguiam enxergar a concentração de riscos da secretaria como um todo, nem comparar divisões;
- **Nenhum acompanhamento sistemático** dos planos de tratamento: prazos vencidos, responsáveis e eficiência ficavam invisíveis;
- **Zero rastreabilidade / auditoria** — não havia registro de quem criou, editou ou tratou cada risco;
- **Relatórios trabalhosos**, montados manualmente a cada reunião de comitê.

> **Pergunta de negócio:** *Como padronizar, centralizar e automatizar a gestão de riscos multi-divisão, garantindo cálculo consistente conforme ISO 31000, visibilidade executiva em tempo real e rastreabilidade completa para fins de auditoria e compliance no setor público?*

---

## ✅ Solução Desenvolvida

Foi construída uma **aplicação web full-stack** que digitaliza todo o framework de gestão de riscos em quatro módulos integrados:

- **Registro de Processos**: cadastro estruturado do processo de trabalho (unidade, objetivo, resultado, clientes/demandantes, áreas envolvidas e macroprocesso da cadeia de valor), com anexos de fluxogramas/organogramas;
- **Identificação e Análise de Riscos**: registro de eventos de risco com causa, consequência, probabilidade e impacto, calculando automaticamente o **nível de risco**, o **risco residual** (após controles) e a classificação (Baixo / Médio / Alto);
- **Plano de Tratamento**: definição da estratégia (Evitar / Transferir / Mitigar / Aceitar), custo-benefício, responsável, prazo, nível de monitoramento e cálculo do **risco final**, com controle de status (Planejado / Em Atraso / Concluído);
- **Dashboard Executivo**: KPIs em tempo real, matriz de risco 5×5 com concentração visual, ranking de responsáveis, eficiência de tratamento e filtros interativos cruzados.

A solução ainda entrega **relatórios em PDF padronizados** (com cabeçalho institucional repetido em todas as páginas, paginação inteligente e matriz isolada), **controle de permissões** (gestor vê e cria em qualquer divisão; usuário comum é restrito à sua) e **trilha de auditoria** persistida no banco.

---

## 🛠️ Stack Utilizada

| Categoria | Tecnologias |
|---|---|
| **Frontend** | HTML5, CSS3, JavaScript (Vanilla — sem frameworks) |
| **Backend / BaaS** | Supabase (PostgreSQL, Auth, Storage) |
| **Banco de Dados** | PostgreSQL com Row Level Security (RLS) |
| **Visualização** | Chart.js, componentes de UI customizados |
| **Relatórios** | html2canvas + jsPDF (exportação A4 landscape) |
| **Deploy / Hosting** | Vercel / GitHub Pages (CDN global + HTTPS) |
| **Versionamento** | Git + GitHub |
| **Metodologia** | ISO 31000 • COSO ERM |

---

## 🏗️ Arquitetura da Aplicação

```
┌─────────────────────────────────────────────┐
│   FRONTEND (HTML/CSS/JS Vanilla)             │
│   • Registro de Riscos                        │
│   • Plano de Tratamento                       │
│   • Dashboard Executivo                       │
└───────────────────┬─────────────────────────┘
                    ↓  (Supabase JS Client)
┌─────────────────────────────────────────────┐
│   SUPABASE (Backend as a Service)            │
│   • Auth (login por matrícula)                │
│   • PostgreSQL + RLS (8 tabelas)              │
│   • Storage (anexos / organogramas)           │
│   • Trilha de auditoria (logs)                │
└───────────────────┬─────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│   DEPLOY (Vercel / GitHub Pages)             │
│   • CDN global • HTTPS • Deploy automático    │
└─────────────────────────────────────────────┘
```

### 🗄️ Modelo de Dados (8 tabelas relacionais)

```
usuarios ──┬── processos ──┬── riscos ──── tratamento_etapas
           │               └── organogramas
           ├── logs_auditoria
           ├── snapshots_kpi
           └── sessoes
```

---

## 🧩 Módulos do Sistema

### 📋 1. Registro de Processos
- Cadastro estruturado (unidade, objetivo, resultado, clientes, áreas envolvidas)
- Multi-select de áreas com badges visuais
- Upload de anexos (PDF/PNG/JPG) via Supabase Storage
- Macroprocesso institucional fixo ("Prestar Jurisdição")

### ⚠️ 2. Identificação e Análise de Riscos
- Tabela dinâmica com destaque escalonado por criticidade (verde/amarelo/vermelho pulsante)
- Ordenação inteligente: prioridade de tratamento + risco residual
- Cálculo automático de nível, residual e classificação

### 🛡️ 3. Plano de Tratamento
- 4 estratégias (Evitar / Transferir / Mitigar / Aceitar)
- Cálculo de **risco final** após monitoramento
- Controle de status com detecção automática de atraso
- Validação de responsável (nome + sobrenome obrigatórios)

### 📊 4. Dashboard Executivo
- **KPIs em tempo real** (total, baixo, médio, alto)
- **Matriz de Risco 5×5** com concentração visual (heatmap + termômetro por célula)
- **Pódio de riscos** (🥇🥈🥉 células com maior concentração)
- **Filtros cruzados interativos** (clique em qualquer visual filtra os demais — estilo Power BI)
- **Filtro global** por período (mês/ano) e divisão
- **Ranking de responsáveis** com normalização de nomes
- **Indicador de eficiência** (% de tratamentos concluídos no prazo)

### 📄 5. Relatórios em PDF
- Cabeçalho institucional (logos) repetido em todas as páginas
- Paginação inteligente (máx. 10 registros por página)
- Matriz de risco isolada em página própria
- Dois modelos: Registro completo e Plano de Tratamento

---

## 📈 Metodologia de Cálculo de Risco

O sistema implementa o modelo quantitativo alinhado à **ISO 31000**:

| Métrica | Fórmula | Descrição |
|---|---|---|
| **Nível de Risco** | `Probabilidade × Impacto` | Risco inerente (1 a 25) |
| **Risco Residual** | `Nível × Fator de Controle` | Risco após controles existentes |
| **Risco Final** | `Residual × Fator de Monitoramento` | Exposição após o plano de tratamento |

**Classificação por faixa:**
- 🟢 **Baixo** — 1 a 6
- 🟡 **Médio** — 7 a 19
- 🔴 **Alto** — 20 a 25

A matriz de risco plota cada evento na posição **Probabilidade × Impacto**, e riscos tratados "descem" na matriz conforme o fator de monitoramento aplicado — evidenciando visualmente a **redução da exposição**.

---

## 🔒 Segurança e Governança

- **Autenticação por matrícula** com perfis diferenciados (gestor / usuário comum);
- **Row Level Security (RLS)** no PostgreSQL — controle de acesso em nível de linha;
- **Segregação por divisão**: usuário comum acessa apenas a sua divisão; gestor navega por todas;
- **Trilha de auditoria** completa — cada ação (login, criação, edição, exclusão, tratamento) é registrada com usuário, divisão e timestamp;
- **Conformidade LGPD**: dados sensíveis isolados, credenciais fora do versionamento.

---

## 💡 Impacto e Resultados

A entrega do sistema proporcionou à organização:

- ✅ **Centralização total** da gestão de riscos multi-divisão, eliminando planilhas fragmentadas;
- ✅ **Padronização do cálculo** de risco conforme ISO 31000, garantindo consistência entre divisões;
- ✅ **Visibilidade executiva em tempo real** da concentração e evolução dos riscos, com filtros cruzados;
- ✅ **Acompanhamento ativo dos planos de tratamento**, com detecção automática de prazos vencidos;
- ✅ **Rastreabilidade e compliance** por meio de trilha de auditoria completa;
- ✅ **Redução drástica do esforço** de montagem de relatórios — exportação em PDF com um clique;
- ✅ **Base escalável e multiusuário**, pronta para atender toda a secretaria.

---

## 📚 Documentação Técnica

- 🗂️ **[docs/01-modelagem-de-dados.md](docs/01-modelagem-de-dados.md)** — Modelo relacional, tabelas, relacionamentos e RLS
- 📐 **[docs/02-metodologia-de-risco.md](docs/02-metodologia-de-risco.md)** — Fórmulas de cálculo e classificação (ISO 31000)
- 🎨 **[docs/03-arquitetura-frontend.md](docs/03-arquitetura-frontend.md)** — Organização dos módulos e componentes

---

## 📌 Observação

> Este repositório é uma **versão de portfólio** com **dados sintéticos e anonimizados**, mantendo integralmente a estrutura, a modelagem e a lógica analítica do sistema original. Nenhum dado real de servidores ou de operações da organização está presente. As credenciais exibidas são exclusivamente de demonstração.

---

## 👤 Autor

**Kaique Souza** — Analista de Dados e BI
📧 kaique8mateus@gmail.com
🔗 [LinkedIn](https://www.linkedin.com/in/kaique-mateus-de-souza-0baa83238/) • [Portfólio](https://sites.google.com/view/portfolio-kaique-mateus/projetos)
