# Painel Aquícola

Front-end do **Sistema Inteligente de Monitoramento da Qualidade da Água em Tanques de Piscicultura**, Trabalho de Conclusão de Curso de Ciência da Computação (UNIP, 2026).

<p align="center">
  <img src="docs/figuras/pwa-convite-instalacao-390.png" alt="Tela inicial do painel no celular, com o resumo dos tanques e o convite para instalar o aplicativo" width="260">
  &nbsp;&nbsp;
  <img src="docs/figuras/pwa-ultima-leitura-390.png" alt="Painel aberto sem internet, mostrando a última leitura salva de cada tanque" width="260">
</p>
<p align="center"><sub>O painel no celular, com dados de teste: a tela inicial com o convite de instalação e, ao lado, a última leitura salva exibida sem internet.</sub></p>

<details>
<summary>Protótipo da tela inicial no computador (Figma)</summary>
<br>
<img src="home%20page%20tcc.png" alt="Protótipo no Figma da tela inicial do painel no computador, com os cartões dos tanques, o gráfico de qualidade da água e um alerta crítico" width="820">
</details>

## Objetivo

O TCC desenvolve um sistema de monitoramento da qualidade da água para aquários e tanques de piscicultura de pequeno porte. Ele une IoT e Machine Learning para prever condições críticas com 1 a 3 horas de antecedência.

Este repositório reúne a parte que o produtor usa: um painel web (PWA) que mostra os indicadores de cada tanque e o nível de risco (ótimo, atenção ou crítico). Também traz a API HTTP que liga o painel ao banco de dados do sistema.

## Principais funcionalidades

- Login com dois perfis: administrador e produtor (operador).
- Leituras de pH, temperatura, turbidez e oxigênio dissolvido (OD) estimado de cada tanque.
- Previsão de risco para as próximas 1 a 3 horas.
- Histórico em gráfico (24 h, 7 dias, 30 dias ou período personalizado), com exportação em CSV.
- Relatórios para imprimir ou salvar em PDF.
- Alertas e linha do tempo de eventos.
- Cadastro de tanques e dispositivos (UC01), só para administradores.
- Comando do aerador (ligar e desligar) pela tela do tanque.
- Ajustes: tema claro ou escuro, modo avançado, linguagem simples e glossário.
- PWA: pode ser instalado no aparelho e, sem internet, mostra a última leitura salva.
- Modo de demonstração com dados simulados, sem precisar do back-end.

## Onde este repositório se encaixa

```mermaid
flowchart LR
  no["Nó sensor ESP32<br/>pH · temperatura · turbidez"] -- MQTT --> ing["Ingestão MQTT"]
  ing --> db[("PostgreSQL + TimescaleDB")]
  ml["Serviço de ML<br/>OD estimado · risco de 1 a 3 h"] <--> db
  db --> api["API FastAPI"]
  api -- HTTP --> painel["Painel Aquícola<br/>(este repositório)"]
  api -. "comando do aerador (MQTT)" .-> no
```

- A ingestão, o banco e o serviço de ML ficam no repositório do backend, [`gioguedes/sistema-tcc-completo`](https://github.com/gioguedes/sistema-tcc-completo). O firmware do nó sensor fica no repositório `sistema` da equipe.
- A **API FastAPI** (leitura, cadastro do UC01 e comando do aerador) foi escrita para o repositório do backend e está aqui em [`api-backend/`](api-backend/LEIA-ME.md), como patches que a equipe aplica.
- **O painel não classifica risco:** o nível vem pronto do serviço de ML, via API.

## Conteúdo

| Caminho | O que tem |
|---|---|
| [`frontend/`](frontend/README.md) | O painel (React + Vite + TypeScript): como rodar, scripts, estrutura e regras do código |
| [`docs/AUDITORIA_FRONTEND.md`](docs/AUDITORIA_FRONTEND.md) | Auditoria inicial e registro de todas as decisões: fontes, inconsistências, arquitetura, entregas da API e modernização visual (§15) |
| [`docs/CONTRATO_API.md`](docs/CONTRATO_API.md) | Contrato da API que o painel consome, com a origem de cada campo no banco |
| [`docs/TEXTOS_TCC_PAINEL_API.md`](docs/TEXTOS_TCC_PAINEL_API.md) | Textos prontos para atualizar o TCC com o painel, a API e o PWA, seção por seção, com as linhas da Declaração de IA |
| [`docs/figuras/`](docs/figuras/) | Capturas do painel em funcionamento, com dados de teste |
| [`api-backend/`](api-backend/LEIA-ME.md) | API FastAPI e patch do firmware (aerador), prontos para os repositórios do backend e do firmware |
| [`home page tcc.png`](home%20page%20tcc.png), [`fluxo de telas - wireframe tcc.png`](fluxo%20de%20telas%20-%20wireframe%20tcc.png), [`componentes.png`](componentes.png) | Telas do Figma "Painel Aquícola", referência de estrutura e navegação |

Os documentos acadêmicos em Word (TC1, roteiro, entregáveis) ficam fora do repositório.

## Como rodar

Requer Node.js 22.12 ou superior.

```bash
git clone https://github.com/Patokaz/front-end-tcc.git
cd front-end-tcc/frontend
npm install
npm run dev
```

Abra http://localhost:5173. Por padrão o painel usa um **servidor simulado (MSW)** que segue o contrato da API e reproduz as regras do backend; não é preciso subir o backend. Para entrar, use `admin@painelaquicola.test` com a senha `aquicola-demo` (usuário que só existe no modo simulado).

Os testes rodam com `npm test`. O outro usuário de demonstração e o passo a passo para usar a API real estão no [README do front-end](frontend/README.md).

## Tecnologias

- **Painel:** React 18 · Vite · TypeScript (strict) · Tailwind CSS 4 · React Router 7 · TanStack Query 5 · React Hook Form + Zod · Recharts · vite-plugin-pwa (Workbox) · MSW · Vitest + Testing Library.
- **API:** Python · FastAPI · SQLAlchemy · PyJWT · paho-mqtt · pytest.

A identidade visual segue o TC2 §8 (paleta, fonte Public Sans e escala tipográfica), com a estrutura de telas do Figma, tema claro e escuro e alvos de toque de 44 px.

## Situação (10/10/2026)

- **Pronto:**
  - as telas do painel (início, tanques, histórico, relatórios, previsão, alertas, eventos, cadastro e ajustes), funcionando com dados simulados;
  - a API, com testes automatizados, entregue em `api-backend/`;
  - a interface no sistema visual do TC2, com tema escuro;
  - o PWA: instalável e, sem internet, mostra a última leitura salva no aparelho.
- **Pendente:**
  - alertas (orquestração N8N, sub-projeto 4): com a API real, as telas de alertas e eventos ficam vazias até lá;
  - tempo real por WebSocket: por enquanto o painel atualiza a cada 30 s;
  - o patch do firmware do aerador ainda precisa ser compilado e testado na placa;
  - conferir a interface em aparelhos reais.

O detalhamento e as decisões em aberto estão em [`docs/AUDITORIA_FRONTEND.md`](docs/AUDITORIA_FRONTEND.md).

## Autoria

Trabalho de Conclusão de Curso em grupo, Ciência da Computação, Universidade Paulista (UNIP), 2026.

**Equipe:**

- Giovanne Monti Guedes Morgado
- Isabela Cicilio de Andrade
- Raphael Della Torre Gimenes

**Orientador:** Prof. Me. Marco Antonio Gomes

O painel web, a API HTTP e a documentação deste repositório foram desenvolvidos por Raphael Della Torre Gimenes ([@Patokaz](https://github.com/Patokaz)). O desenvolvimento contou com apoio de IA generativa (Claude Code), registrado na Declaração de Uso de IA do TCC; o detalhamento está em [`docs/TEXTOS_TCC_PAINEL_API.md`](docs/TEXTOS_TCC_PAINEL_API.md).
