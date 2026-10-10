# Auditoria para o Front-end — Painel Aquícola

Sistema Inteligente de Monitoramento da Qualidade da Água em Tanques de Piscicultura (TCC UNIP 2026)

Data da auditoria: 07/10/2026 · Escopo: análise prévia à implementação (nenhum código de front-end foi escrito) · Revisão 2: inclui a análise do Figma

---

## 0. Resumo executivo

1. **O backend do repositório não expõe nenhuma API.** `gioguedes/sistema-tcc-completo` contém apenas um *worker* de ingestão MQTT → PostgreSQL/TimescaleDB. Não há FastAPI, endpoints, autenticação, autorização, CORS nem WebSocket. Nenhum outro repositório público do autor contém essa camada.
2. **Existe um contrato de API proposto** no documento *TC2_Arquitetura_FrontEnd.pdf* (§5.2), que **não foi implementado** — e esse documento **não está na pasta oficial do projeto** (só em Downloads), então sua validade precisa ser confirmada.
3. **Não existem** o serviço de Machine Learning (OD estimado e previsões de risco), a orquestração de alertas (N8N/Evolution API) nem produtores para `previsoes`, `alertas`, `eventos_mortalidade` e `acionamentos_atuador`.
4. **O Figma ("Painel Aquícola") foi analisado** (3 imagens na pasta do projeto). Ele define navegação, telas e identidade visual, mas **introduz funcionalidades sem respaldo no backend nem nos documentos**: comando manual do aerador, recomendações de manejo, "transparência em cm" em vez de turbidez em NTU, faixa de incerteza da previsão, gestão de usuários e faixas ideais pelo admin, e seções sem wireframe (Previsão, Eventos, Relatórios). Também **não contém as telas de cadastro do UC01**, exigidas pelo RF07.
5. Há **inconsistências de regra de negócio** entre documentos, Figma e código (perfis, visibilidade de tanques, sensores, exclusão, espécies, armazenamento do OD, cadência de leitura).

Conclusão: o caminho crítico do front-end é a **API**. Sem ela, só é possível construir o front contra *mocks* do contrato. Várias telas do Figma dependem ainda do ML e dos alertas.

---

## 1. Fontes analisadas

| Fonte | Local | Observação |
|---|---|---|
| `github.com/gioguedes/sistema-tcc-completo` (branch `main`, 23 commits, último em 24/09/2026) | GitHub | Único branch; sem PRs |
| `home page tcc.png` | pasta do projeto | Figma — tela inicial desktop |
| `fluxo de telas - wireframe tcc.png` | pasta do projeto | Figma — 6 telas mobile + "Decisões de UX" |
| `componentes.png` | pasta do projeto | Figma — biblioteca de componentes |
| `TC1_Monitoramento_Piscicultura_FINAL.docx` (25/08) e versões `Metodologia`/`Comparativo` | pasta do projeto | TC1 oficial |
| `ENTREGAVEIS PARA QUALIFICAÇÃO.docx`, `ROTEIRO .docx`, `DECLARACAO DE IA.docx` | pasta do projeto | Exigências da banca |
| `TC2_Arquitetura_FrontEnd.pdf` (23/09) | **somente Downloads** | Arquitetura de front-end e contrato de API — validade a confirmar |
| `TC1_Monitoramento_Piscicultura_corrigido.docx` (11/06) | **somente Downloads** | Única versão com UC01/UC04/UC05/UC06 estendidos e CT05/CT06 |
| Figuras do TC1: DER, casos de uso, arquitetura em camadas, Gantt | extraídas dos .docx | |

Os .docx da pasta do projeto são idênticos (MD5) às cópias de Downloads.

---

## 2. Backend — o que existe

### 2.1 Tecnologias (verificado em `requirements.txt` e no código)
Python 3.11 · paho-mqtt 2.1 · SQLAlchemy 2 · Alembic · psycopg 3 · pydantic 2 / pydantic-settings · pytest · Docker Compose com `timescale/timescaledb:2.27.0-pg18` e `eclipse-mosquitto:2` (apenas para testes).

**Ausentes:** FastAPI, Uvicorn, python-socketio, biblioteca de JWT, biblioteca de hash de senha, qualquer servidor HTTP.

### 2.2 Estrutura
```
backend/
  .env.example            MQTT_* e DB_*
  docker-compose.yml      timescaledb + mosquitto-test (porta 1884)
  db/init/01_apendice_a_ddl.sql   DDL completo (11 tabelas, hypertable, CAGG)
  alembic/                baseline vazio + unique (id_sensor, ts)
  src/config.py           Settings (pydantic-settings)
  src/db/models.py        ORM de 7 das 11 tabelas
  src/db/session.py       engine + sessionmaker
  src/db/seed.py          usuário, espécie, tanque, dispositivo, 3 sensores
  src/mqtt/schemas.py     payload MQTT
  src/mqtt/processor.py   resolve MAC → sensores, "wide → narrow", dedup
  src/mqtt/consumer.py    cliente paho, tópico {prefixo}/+/leituras, QoS 1
  src/main.py             entrypoint da ingestão
  tests/                  10 testes unitários + 9 dependentes de Docker
```
O commit inicial cita pastas `ml`, `alertas`, `dashboard`, `docs` — **nenhuma existe** no repositório.

### 2.3 Fluxo implementado (único fluxo funcional)
1. ESP32 publica JSON em `tcc-piscicultura-morgado/<mac>/leituras` (broker público `broker.hivemq.com:1883` no `.env.example`).
2. Payload: `{ "mac": "a4f00f643c70", "ts": <epoch s>, "ph"?: float, "temperatura"?: float, "turbidez"?: float }`.
3. O MAC é normalizado para `aa:bb:cc:dd:ee:ff` minúsculo; busca dispositivo → sensores por grandeza.
4. Cada grandeza não nula vira uma linha em `leituras` (`id_sensor, valor, unidade, ts`); duplicatas ignoradas por `ON CONFLICT (id_sensor, ts)`.
5. MAC desconhecido ou grandeza sem sensor cadastrado → leitura descartada com log.

### 2.4 Banco de dados (DDL do Apêndice A)

| Tabela | ORM | Produtor atual | Campos relevantes p/ UI | Domínios (CHECK) |
|---|---|---|---|---|
| usuarios | ✅ | seed | nome, email (único), telefone, perfil | perfil ∈ {admin, operador} |
| especies | ✅ | seed (só Tilápia) | nome_comum, nome_cientifico, ph/temp/od min-max | faixas coerentes |
| tanques | ✅ | seed | id_usuario, id_especie (nullable), nome, volume_litros, quantidade_peixes, data_povoamento, status | volume > 0; qtd ≥ 0; status ∈ {ativo, manutencao, inativo} |
| dispositivos | ✅ | seed | id_tanque, nome, modelo_esp32, mac_address (único), versao_firmware, ip_local, status_conexao, ultimo_heartbeat | status_conexao ∈ {online, offline} |
| tipos_sensor | ✅ | seed (pH, temperatura, turbidez) | grandeza, modelo, unidade, faixa_min/max | grandeza ∈ {ph, temperatura, turbidez, od} |
| sensores | ✅ | seed | id_dispositivo, id_tipo, id_tanque, data_instalacao, status | status ∈ {ativo, inativo, em_calibracao} |
| leituras (hypertable) | ✅ | **ingestão MQTT** | id_sensor, valor, unidade, ts | valor ∈ [-50, 3000] |
| previsoes | ❌ | **nenhum** | parametro_critico, valor_previsto, nivel_risco, horizonte_h, confianca, ts_previsao | nivel_risco ∈ {otimo, atencao, critico}; horizonte ∈ {1,2,3} |
| alertas | ❌ | **nenhum** | mensagem, canal, status, workflow_id, ts_envio, criado_em | canal ∈ {whatsapp, email, sms}; status ∈ {pendente, enviado, falha} |
| eventos_mortalidade | ❌ | **nenhum** | quantidade_peixes, causa_provavel, parametros_momento | qtd > 0 |
| acionamentos_atuador | ❌ | **nenhum** | acao, motivo, ts_acionamento | acao ∈ {ligar, desligar} |
| leituras_media_horaria (CAGG) | — | política TimescaleDB | valor_medio/min/max por hora | — |

**Cascatas relevantes:** excluir tanque apaga dispositivos, sensores, **todas as leituras**, previsões e alertas; excluir dispositivo apaga seus sensores e **todas as leituras** deles.

### 2.5 Seed
Usuário `operador@piscicultura.local` com **perfil `admin`** e `senha_hash = "sem-autenticacao-neste-sub-projeto"` (não é hash); espécie Tilápia (pH 6,5–8,5; 20–30 °C; OD 4–8 mg/L); tanque "Tanque bancada TCC" (500 L, 0 peixes); dispositivo `a4:f0:0f:64:3c:70`; sensores de pH, temperatura e turbidez. **Não há tipo de sensor `od`.**

### 2.6 Variáveis de ambiente
`MQTT_BROKER_HOST`, `MQTT_BROKER_PORT`, `MQTT_TOPIC_PREFIX`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`. Não há `JWT_SECRET`, origens de CORS, porta de API etc.

### 2.7 Testes executados nesta auditoria
- `test_config`, `test_schemas`, `test_models`, `test_consumer`: **10/10 passaram**.
- `test_processor`, `test_seed`, `test_conftest_fixtures`, `test_mosquitto_test_broker`: **não executados** (Docker Desktop instalado, mas daemon parado).

### 2.8 O que NÃO existe e o front-end precisa
API REST, endpoints, autenticação JWT/refresh, hash de senha, autorização por perfil, CORS/proxy, formato padronizado de erro e paginação, WebSocket/Socket.IO, atualização de `status_conexao`/`ultimo_heartbeat`, serviço de ML, previsões, alertas, recomendações, comando remoto do atuador, cadastro de usuários.

### 2.9 Riscos no backend (não bloqueiam o front, mas afetam a demonstração)
- **A ingestão pode cair com uma única leitura inválida.** Valor fora de [-50, 3000] (ex.: turbidez saturada) viola o CHECK; a exceção ocorre dentro do callback `on_message` e o paho-mqtt 2.1 a relança por padrão (`suppress_exceptions = False`), encerrando `loop_forever()`. O UC05 exige descartar e registrar em log valores fora da faixa física. O mesmo vale para banco indisponível.
- **Broker público sem autenticação** (`broker.hivemq.com`): qualquer pessoa pode publicar no tópico. A documentação prevê Mosquitto próprio no VPS e tópico `aquasense/{tanque}/leitura` (diagrama de arquitetura), diferente do código.
- Alembic baseline vazio: o schema depende do script de init do Docker; o ORM só cobre 7 tabelas.
- O CAGG tem só bucket de 1 h; janelas de 5 min terão de ser calculadas com `time_bucket` sobre os dados brutos (viável no volume do protótipo).

---

## 3. Documentação — síntese para o front-end

**Objetivo:** monitorar continuamente pH, temperatura e turbidez de aquários/tanques pequenos, estimar OD por ML, prever condições críticas com 1–3 h de antecedência, exibir em dashboard e alertar por WhatsApp.

**Público / stakeholders primários:** aquarista doméstico; pequeno piscicultor. Uso típico: celular, na beira do tanque.

**Atores:** Usuário (piscicultor/aquarista), Administrador, Sistema IoT (ESP32), Serviço de Alertas (N8N + Evolution API).

**Casos de uso que tocam o front:**
| UC | Descrição | Ator | Tela (Figma) |
|---|---|---|---|
| UC01 | Cadastrar tanque e dispositivo | Administrador | **sem tela no Figma** |
| UC02 | Visualizar dashboard em tempo real (caso central) | Usuário | Início / Visão geral / Detalhe do tanque |
| UC03 | Consultar histórico de leituras | Usuário | Histórico |
| UC04 | Receber alerta via WhatsApp (pré-condição: telefone cadastrado) | Usuário | Alertas (+ telefone em Ajustes) |

**UC01 (versão "corrigido"):** nome, volume (> 0), espécie existente no catálogo, quantidade de peixes; associa dispositivo pelo MAC; MAC duplicado → rejeita e pede correção; volume ≤ 0 ou obrigatório vazio → bloqueia e destaca campo.
**UC02:** seleciona tanque → gráficos de pH, temperatura, turbidez e **OD estimado** das últimas 24 h → atualização a cada 5 s via WebSocket → semáforo de risco. Alternativo: dispositivo offline > 5 min → aviso de desconexão.
**UC06 (alternativos que aparecem na UI):** dados insuficientes → resultado indeterminado (sem alerta); erro acima do limiar → indicador de baixa confiança.

**Requisitos com impacto direto na UI:** RF04 (3 níveis de risco), RF05 (horizonte 1–3 h), RF07 (dashboard + **cadastro de tanques**), RNF02 (24 h em < 3 s), RNF05 (JWT; segredos em env), RNF06 (PWA responsivo 320–1920 px; mensagens em português claro e acionáveis).

**Regra citada no TC1 e no Figma:** OD abaixo de 3 mg/L = risco alto (TC1: aciona o aerador automaticamente; Figma: texto explicativo do OD).

**Exigências da qualificação:** demonstração ponta a ponta sensor → banco → dashboard "com as decisões da IA em operação real"; guia do usuário com instalação reproduzível do cliente; declaração formal de uso de IA assistiva (inclui o uso de IA na codificação do front).

---

## 4. Figma — análise

Marcado como **"Wireframe — não é arte final"**; ícones são marcadores (quadrados cinza), exceto o conjunto de ícones da página de componentes (estilo traço, semelhante ao Lucide).

### 4.1 Identidade visual
- Nome: **Painel Aquícola** — "Monitoramento Inteligente" / "Monitoramento inteligente da água".
- Fundo da aplicação cinza-claro; cartões brancos com borda sutil e cantos arredondados.
- Login em azul-marinho; ação primária e item ativo em azul; menu lateral com item ativo em cinza-azulado.
- Status: verde (Ótimo), âmbar (Atenção), vermelho (Crítico), sempre como *badge* com texto; cartões de alerta com fundo tingido.
- Ilustração do tanque (água com peixes) nos cartões, tingida de vermelho quando crítico.
- Tipografia sem serifa (aparência de Inter). Valores numéricos alinhados à direita.

### 4.2 Navegação
- **Desktop:** barra lateral — Início, Tanques, Histórico, Previsão, Alertas (com contador), Eventos, Relatórios, Configurações; cartão do usuário ("Olá, Isabela — Produtor") e cartão de conexão ("Conectado — Última atualização…").
- **Mobile:** barra inferior — Tanques, Histórico, Alertas, Ajustes; barra superior com título e ação.

### 4.3 Telas
| Tela | Conteúdo |
|---|---|
| Início (desktop) | Saudação pelo horário + nome; "Seus tanques" (cartões com status, ilustração, temperatura, pH, turbidez, OD estimado); gráfico "Qualidade da água — <tanque>" com 24h/7d/30d/Personalizado, valores reais, previsão tracejada e **faixa de incerteza**; cartão "Alerta crítico" com recomendação e botão **Ligar aerador**; "Últimos eventos" |
| 01 Login | Usuário, senha, **Lembrar de mim**, **Esqueci a senha**, Entrar; "Níveis de acesso" (Aquarista: acompanha tanques e recebe recomendações; **Administrador: também gerencia usuários e faixas ideais**); offline/instalável; "Sessão protegida com JWT" |
| 02 Visão geral (Meus Tanques) | Contadores Ótimo/Atenção/Crítico; faixa "1 tanque precisa de ação agora"; lista com "Atualizado há X min" e status; aviso de tempo real e última leitura offline |
| 03 Detalhe do tanque | "Parâmetros agora (há 2 min)": temperatura, pH, **Transparência (cm)**, OD estimado + explicação; gráfico 24 h; veredito "Tudo na faixa ideal — nenhuma ação nas próximas 3 horas"; Ver histórico completo; **Configurar alertas** |
| 04 Alertas e recomendações | Alerta crítico com ação recomendada e Ligar aerador; alerta de atenção de tendência ("pH subindo… alta nas próximas 3 horas"); **"Resolvidos hoje"**; aviso de WhatsApp com link direto |
| 05 Histórico e gráficos | Seletor de tanque; 24h/7d/30d/Personalizado; gráfico com previsão e incerteza; Exportar; "Previsão de risco: em 1/2/3 horas — **Baixo/Médio/Alto**"; **Exportar relatório (PDF)** |
| 06 Ajustes | Modo avançado; Linguagem simples; explicação do OD ("abaixo de 3 mg/L o risco é alto"); glossário com busca (pH, Transparência, Turbidez/NTU, Aeração); nota de acessibilidade |

### 4.4 "Decisões de UX" registradas no Figma
- Fluxo: sensores → ESP32 (MQTT) → back-end FastAPI (API REST) → ML (estima OD) → Socket.IO → front-end PWA.
- Camadas do front: Apresentação, Aplicação (hooks), **Domínio (classificação de risco, tendências e previsões, faixas ideais e recomendações, tradução de termos)**, Infraestrutura.
- Pastas: `src/app/funcionalidades/{autenticacao,tanques,historico,previsao,alertas,eventos,admin}`, `dominio/`, `infra/`, `ui/`, `compartilhado/`.
- Tecnologias: React 18, Vite, Tailwind, Recharts, Socket.IO, TanStack Query, Zustand, React Router, Zod, PWA.
- Funcionalidades: classificação ótimo/atenção/crítico; alertas com recomendação; gráficos em tempo real e histórico; previsão 1/2/3 h; offline; link profundo pelo WhatsApp; níveis de acesso; JWT; 320–1920 px; acessibilidade e linguagem simples.

---

## 5. Inconsistências e lacunas (para decisão)

### 5.1 Bloqueantes

**I-01 · Não existe API HTTP**
- **Impacto:** nenhuma tela consome dados reais.
- **Encontrado:** nenhum framework HTTP no código; TC1 §6.9, TC2 §5.2 e o Figma ("Back-end FastAPI — expõe a API REST") pressupõem a API.
- **Decidir:** quem implementa e em que prazo.

**I-02 · Não existe ML nem alertas**
- **Impacto:** status Ótimo/Atenção/Crítico, OD estimado, previsões, vereditos, alertas e recomendações — quase todo o conteúdo do Figma — não têm fonte.
- **Encontrado:** sem pasta `ml/`; `previsoes`/`alertas` fora do ORM. Não está definido onde o OD estimado é gravado (`leituras` como sensor virtual ou `previsoes`).
- **Decidir:** comportamento da UI enquanto o ML não existe (recomendado: estado "previsão indisponível", sem classificar no front) e o armazenamento do OD (equipe de ML).

### 5.2 Figma × backend × documentos

| ID | Questão | O que encontrei | Recomendação |
|---|---|---|---|
| F-01 | **Transparência (cm) × Turbidez (NTU)** | Figma: sensor de "transparência", cartões com "Turbidez 80 cm" / "Transparência 80 cm"; glossário tem os dois. Backend e TC1: turbidez em NTU (sensor óptico) | Exibir **Turbidez (NTU)**, que é o que o sensor mede. Converter NTU → cm seria inventar dado. "Linguagem simples" pode explicar sem converter |
| F-02 | **Botão "Ligar aerador"** | Nenhum UC, endpoint, canal MQTT de comando nem firmware para isso; o TC1 descreve aerador **automático** (OD < 3 mg/L). Existe a tabela `acionamentos_atuador` | Decidir: manter (exige endpoint + MQTT de comando + firmware + confirmação) ou trocar por recomendação e registro dos acionamentos automáticos |
| F-03 | **Recomendações** ("Ligue o aerador agora", "Reduza a ração de hoje") | Não há regras documentadas nem campo estruturado (`alertas.mensagem` é texto livre). O Figma põe "faixas ideais e recomendações" no domínio do front | Recomendações vêm do backend/N8N junto do alerta; não crio orientação de manejo no front |
| F-04 | **Onde o risco é classificado** | Figma: "Domínio — classificação de risco" no front. TC2: o front **não** classifica (só o ML, para não divergir do alerta) | Classificação só no backend/ML |
| F-05 | **Faixa de incerteza e vocabulário da previsão** | `previsoes` tem `valor_previsto` e `confianca`, sem limites de intervalo; o Figma usa Baixo/Médio/Alto na previsão e Ótimo/Atenção/Crítico no status | ML fornece limites (mudança de schema) ou o gráfico mostra só os pontos previstos (1/2/3 h). Unificar em Ótimo/Atenção/Crítico |
| F-06 | **Seções sem wireframe** | Previsão, Eventos, Relatórios, "Configurar alertas", gestão de usuários e de faixas ideais (admin) e **todo o UC01** (cadastro de tanque e dispositivo) | Definir escopo. Para o UC01, proponho formulário de tanque com associação do dispositivo pelo MAC (como descreve o UC01), no estilo do Figma, acessível ao admin em "Tanques" |
| F-07 | **O que é um "evento"** | Feed mistura alerta, aerador ativado e "Leitura normal — parâmetros estáveis" (não existe essa entidade). Pode também significar `eventos_mortalidade` | Definir. Sugestão: feed derivado de alertas + acionamentos; "Leitura normal" só se o backend registrar |
| F-08 | **Login** | Figma: "Usuário"; banco: e-mail. "Esqueci a senha" sem fluxo nem serviço de e-mail. "Lembrar de mim" depende da duração do cookie de renovação | Campo "E-mail"; trocar "Esqueci a senha" por "Fale com o administrador"; "Lembrar de mim" = cookie persistente × de sessão |
| F-09 | **Nome dos perfis** | Banco: admin/operador. Figma: "Aquarista" (login) e "Produtor" (menu) | Escolher um rótulo para `operador` |
| F-10 | **"Resolvidos hoje"** | `alertas.status` é status de **envio** (pendente/enviado/falha); não existe "resolvido" | Definir regra (ex.: previsão posterior ótima para o tanque) ou trocar por "Histórico de hoje" |
| F-11 | **Identidade visual** | Figma: azul/azul-marinho, fonte tipo Inter. TC2: verde-azulado `#2F6F73`, Public Sans | Seguir o Figma, mantendo as regras de acessibilidade do TC2 (contraste ≥ 4,5:1, cor nunca sozinha) |
| F-12 | **Estrutura de pastas do front** | Figma: `app/funcionalidades/dominio/infra/ui/compartilhado`. TC2: `app/pages/features/entities/shared` | Seguir o Figma (mais recente, em português) |
| F-13 | **Gráfico único com eixo 0–12** | Temperatura (28 °C) e turbidez (120 NTU) não cabem na escala do mock | Manter o cartão e a legenda do Figma, mas com escala por grandeza (mini-gráficos empilhados no mesmo cartão ou seletor de série) |
| F-14 | **Alertas globais × por tanque** | Figma: tela única de alertas de todos os tanques. TC2: `/tanques/{id}/alertas` | Endpoint global com filtro opcional por tanque |
| F-15 | **Preferências e glossário** | "Modo avançado" e "Linguagem simples" sem definição de persistência; glossário só tem 4 termos | Preferência salva no próprio aparelho; usar só os textos fornecidos e pedir os demais |
| F-16 | **Tanque destacado no gráfico do Início** | Mostra "Tanque Leste" (o crítico), sem regra | Tanque de maior risco; com seletor |

### 5.3 Regras de negócio (documentos × código)

| ID | Questão | O que encontrei | Recomendação |
|---|---|---|---|
| I-04 | Quem acessa os cadastros | UC01: Administrador; texto do TC2: admin **ou** operador | Só admin |
| I-05 | Quem vê quais tanques | `tanques.id_usuario` existe sem regra; Figma diz "Meus tanques"; multi-tenant fora do escopo | Todos veem todos (ou: operador vê os seus, admin vê todos) |
| I-06 | Gestão de usuários | Nenhum UC; seed com senha falsa; **Figma: admin gerencia usuários** | Decidir se entra (telas + endpoints) ou fica por script |
| I-07 | Sensores do dispositivo | UC01 só cita MAC; a ingestão descarta leituras sem sensor cadastrado | Criar os 3 sensores padrão com o dispositivo |
| I-08 | Exclusão | Sem DELETE no contrato; cascata apaga o histórico | Só desativar |
| I-09 | Espécies e faixas ideais | Seed só tem Tilápia, com faixas diferentes do TC1 §4.4 (20–30 × 25–30 °C; OD 4–8 × 5–8); aquário de teste usa outras espécies; **Figma: admin gerencia faixas ideais** | Faixas oficiais com fonte; decidir se há tela de edição |
| I-10 | Status do dispositivo | A ingestão nunca atualiza `ultimo_heartbeat`/`status_conexao` | API calcula pela última leitura |
| I-11 | Cadência das leituras | RF01: 60 s; TC1 §8.1: 5 min/1 min; UC02: 5 s | Confirmar 60 s |
| I-13 | Espécie obrigatória | UC01 exige; banco permite nulo | Obrigatória no formulário |
| I-15 | Reenvio de alerta | TC2 sugere botão; UC04 diz que o reenvio é automático | Só exibir status |
| I-18 | Versão oficial dos documentos | Pasta do projeto tem o TC1 "FINAL"; o "corrigido" e o TC2 estão só em Downloads | Confirmar quais valem |
| I-19 | Socket.IO | Cliente Socket.IO exige `python-socketio` no servidor | Registrar no contrato |

Resolvidos pelo Figma: nome do produto (**Painel Aquícola**) e referência visual.

---

## 6. Arquitetura recomendada para o front-end

### 6.1 Stack
A do TC1 e do Figma: **React 18 + Vite + TypeScript (strict) + TailwindCSS + Recharts + React Router + TanStack Query v5 + React Hook Form + Zod + vite-plugin-pwa + Socket.IO client**. Testes: **Vitest + Testing Library + MSW + Playwright**. Qualidade: ESLint + Prettier + jsx-a11y.

Ajustes propostos (precisam de OK, pois os dois documentos citam Zustand):
- **Sem Zustand:** eventos em tempo real atualizam o cache do TanStack Query — uma única fonte de dados.
- **Sem virtualização de listas:** paginação no servidor.
- Adições pequenas: `lucide-react` (ícones, compatíveis com o estilo do Figma) e fonte servida localmente (funciona offline no PWA).
- Componentes próprios com Tailwind (sem kit genérico); modais com `<dialog>` nativo.
- PDF de relatório via folha de estilo de impressão (`window.print()`), sem biblioteca de PDF.

### 6.2 Estrutura (conforme o Figma)
```
src/
  app/                 bootstrap, rotas, provedores, layouts, ErrorBoundary
    funcionalidades/
      autenticacao/  tanques/  historico/  previsao/  alertas/  eventos/  admin/
  dominio/             tipos e esquemas Zod das entidades, rótulos, formatação de unidades
  infra/               cliente HTTP, erros, socket, armazenamento offline
  ui/                  componentes visuais (Botão, Campo, Cartão, Badge, Gráfico…)
  compartilhado/       hooks e utilitários genéricos
  mocks/               handlers MSW do contrato — temporário, ligado por variável de ambiente
```

### 6.3 Rotas (navegação do Figma)
| Rota | Tela | Acesso |
|---|---|---|
| `/entrar` | Login | pública |
| `/` | Início (desktop) / Meus Tanques (mobile) | autenticado |
| `/tanques` | Lista de tanques (+ "Novo tanque" para admin) | autenticado |
| `/tanques/novo`, `/tanques/:id/editar` | Cadastro UC01 (tanque + dispositivo) | admin* |
| `/tanques/:id` | Detalhe do tanque | autenticado |
| `/historico?tanque=` | Histórico e gráficos | autenticado |
| `/alertas` | Alertas e recomendações | autenticado |
| `/previsao`, `/eventos`, `/relatorios` | sem wireframe (F-06) | a definir |
| `/configuracoes` | Ajustes (preferências, glossário, telefone WhatsApp; seções de admin se aprovadas) | autenticado |
| `*` | Não encontrada | — |

\* depende de I-04. A verificação no cliente é conveniência; a autorização efetiva é do backend (403). As URLs são estáveis para o link profundo vindo do WhatsApp.

### 6.4 Autenticação (RNF05)
- Access token em memória; refresh token em cookie HttpOnly/Secure/SameSite=Strict emitido pela API; "Lembrar de mim" define cookie persistente ou de sessão.
- Ao abrir o app: `POST /auth/refresh` → `GET /auth/eu` → restaura a sessão.
- Interceptor: 401 → uma única tentativa de refresh (requisições concorrentes aguardam) → repete → se falhar, encerra a sessão e leva a `/entrar` preservando o destino.
- Mesma origem (proxy do Vite em dev; Nginx/Traefik em produção) → cookie funciona e CORS deixa de ser necessário.

### 6.5 Tratamento de erros (mensagens ao usuário)
| Situação | Mensagem |
|---|---|
| Sem rede / API fora | "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente." |
| Timeout (15 s) | "O servidor demorou para responder. Tente novamente." |
| 401 após refresh | "Sua sessão expirou. Entre novamente." |
| 403 | "Você não tem permissão para realizar esta ação." |
| 404 | "Não encontramos este tanque." (por recurso) |
| 409 (MAC duplicado) | No campo: "Este endereço MAC já está cadastrado em outro dispositivo." |
| 422 | Erros mapeados por campo; resumo "Revise os campos destacados." |
| 5xx | "Ocorreu um erro no servidor. Tente novamente em instantes." |
| Resposta fora do contrato (Zod) | "Recebemos uma resposta inesperada do servidor." + detalhe no console (dev) |

### 6.6 Estado
Servidor → TanStack Query · Tempo real → eventos aplicados ao cache · Sessão → provedor de autenticação · Interface → estado local e parâmetros de URL (período, tanque, filtros, página) · Preferências (modo avançado, linguagem simples) → armazenamento local do aparelho.

---

## 7. Componentes (a partir de `componentes.png` + necessidades do sistema)

**Do Figma:** Badge de status, Botão (primário, perigo, escuro, secundário, link — com e sem ícone), Item de menu (ativo, com contador), Chip de período, Item de legenda, Linha de métrica, Campo de busca, Item de evento, Cartão de indicador (contadores), Cabeçalho de cartão com link, Cartão de tanque (3 estados), Cartão de alerta com recomendação.

**Complementares:** Campo de texto/número/data/seleção com rótulo, dica e erro; Dialog e ConfirmDialog; Toast (aria-live); Banner (offline, dados desatualizados, informativo); Estado vazio; Skeleton; Estado de erro com "tentar novamente"; Paginação; Toggle (Ajustes); Tabela responsiva (vira cartões no mobile); Barra lateral e barra inferior; Cartão de conexão; Popover acessível ao toque (explicação do OD); Gráfico de série com faixa ideal e previsão.

**Validações no cliente** (espelham os CHECKs; o backend é a autoridade): tanque — nome obrigatório (≤ 120), volume > 0, espécie obrigatória, quantidade inteira ≥ 0, data de povoamento não futura; dispositivo — MAC `AA:BB:CC:DD:EE:FF` (aceita com/sem separador, grava minúsculo com ":", mesmo formato da ingestão), nome obrigatório, firmware ≤ 30, IP válido opcional; conta — telefone com DDD.

---

## 8. Endpoints que o front-end consumirá

Contrato do TC2 (§5.2) + lacunas (**➕**) + necessidades do Figma (**🎨**, dependem de decisão). Prefixo `/api/v1`.

| Método | Rota | Uso | Situação |
|---|---|---|---|
| POST | `/auth/login` | `{email, senha, lembrar}` → `{access_token, expira_em}` + cookie | contrato (+ `lembrar`) |
| POST | `/auth/refresh` | renova o access token | contrato |
| POST | `/auth/logout` | limpa o cookie de refresh | ➕ |
| GET | `/auth/eu` | usuário e perfil | contrato |
| PATCH | `/auth/eu` | nome e telefone WhatsApp | ➕ |
| GET | `/especies` | catálogo com faixas ideais | contrato |
| POST/PATCH | `/especies` | edição de faixas ideais pelo admin | 🎨 (I-09) |
| GET | `/tipos-sensor` | catálogo de sensores | ➕ |
| GET | `/tanques` | lista com status, último risco, **últimas leituras e status do dispositivo** | contrato (ampliar) |
| POST | `/tanques` | cria (UC01) | contrato |
| GET | `/tanques/{id}` | detalhe com espécie e faixas | contrato |
| PATCH | `/tanques/{id}` | edita / desativa | contrato |
| GET | `/tanques/{id}/dispositivos` | dispositivos com sensores e status calculado | contrato |
| POST | `/dispositivos` | cria (409 se MAC duplicado) | contrato |
| PATCH | `/dispositivos/{id}` | edita | ➕ |
| PATCH | `/sensores/{id}` | status do sensor | ➕ (I-07) |
| GET | `/tanques/{id}/leituras?desde&ate&bucket&grandezas` | séries | contrato |
| GET | `/tanques/{id}/previsoes/atual` | status, veredito e previsão 1/2/3 h | contrato (sem produtor) |
| GET | `/tanques/{id}/previsoes?desde&ate` | série prevista | contrato (sem produtor) |
| GET | `/alertas?status&tanque&pagina` | tela de alertas global + contador do menu | 🎨 (F-14) |
| GET | `/eventos?pagina` | "Últimos eventos" | 🎨 (F-07) |
| POST | `/dispositivos/{id}/aerador` | `{acao: ligar\|desligar}` | 🎨 (F-02) |
| GET/POST/PATCH | `/usuarios` | gestão de usuários pelo admin | 🎨 (I-06) |

WebSocket (Socket.IO, namespace `/tempo-real`, autenticado no handshake): servidor → `leitura:nova`, `previsao:nova`, `alerta:novo`, `dispositivo:status`; cliente → `assinar:tanque`, `cancelar:tanque`.

A definir no contrato (técnico): formato de erro (padrão do FastAPI `{"detail": ...}`, 422 por campo), paginação (`{itens, total, pagina, por_pagina}`), datas ISO 8601 UTC, números como `number`, OpenAPI publicado para gerar os tipos.

---

## 9. Plano de implementação por etapas

| Etapa | Entrega | Depende de | Teste ao final |
|---|---|---|---|
| 0 | Decisões desta auditoria + contrato da API fechado | você / equipe | — |
| 1 | Fundação: Vite + TS + Tailwind com a identidade do Figma, rotas, layouts (barra lateral desktop / barra inferior mobile), componentes do Figma, cliente HTTP com erros, autenticação; MSW com o contrato | Etapa 0 | navegação, guardas, estados de erro, 320–1920 px |
| 2 | API mínima real: auth, catálogos, tanques, dispositivos (+ sensores), leituras com bucket | I-01 | pytest + chamadas reais |
| 3 | Fatia vertical real: Login → Início/Meus Tanques → Detalhe → Histórico com dados da ingestão | Etapa 2 | fluxo com leituras reais |
| 4 | Cadastro UC01 (tanque + dispositivo) e Ajustes/conta | Etapa 2 | CRUD, permissões, 409/422 |
| 5 | Tempo real + previsões, alertas, eventos, recomendações (estados vazios/indeterminados até ML e N8N existirem) | WebSocket, ML, N8N | evento simulado muda o status (CT02) |
| 6 | PWA: manifesto, service worker, aviso offline, última leitura salva | — | Lighthouse, modo avião |
| 7 | Endurecimento: Vitest, Playwright (CT02/CT06), axe, responsividade, RNF02, relatório PDF, README | tudo | critérios de sucesso |

Prazo de referência (TC1, Tabela 8): dashboard e integração em **outubro de 2026**; redação final e defesa em **novembro de 2026**.

---

## 10. Implementação com dados simulados (07/10/2026)

Decisão do usuário: desenvolver agora contra dados simulados e integrar com a API real quando o backend estiver pronto. Código em `frontend/`; contrato em `docs/CONTRATO_API.md`.

### 10.1 Decisões adotadas (recomendações aceitas — reversíveis)

| ID | Adotado |
|---|---|
| I-04 | Cadastros só para `admin` |
| I-05 | Todos os usuários autenticados veem todos os tanques |
| I-06 | Sem tela de gestão de usuários; contas criadas por script |
| I-07 | O backend cria os 3 sensores junto com o dispositivo; a tela de edição permite mudar o status de cada um |
| I-08 | Sem exclusão física; tanque vai para `inativo` |
| I-09 | Catálogo de espécies só por seed; usada a Tilápia do seed do backend (sem inventar faixas) |
| I-10 | `status_conexao` calculado pela API (offline após 5 min sem leitura) |
| I-11 | Cadência de 60 s; atualização por sondagem a cada 30 s até haver WebSocket |
| I-13 | Espécie obrigatória no formulário |
| I-15 | Sem botão de reenvio; só o status de envio (com o tempo até o envio, RNF01) |
| F-01 | Turbidez em NTU (sem conversão para "transparência em cm") |
| F-03 | Recomendações vêm da API no alerta (`recomendacoes`) |
| F-04 | Classificação de risco só no backend/ML |
| F-05 | Sem faixa de incerteza; vocabulário único Ótimo/Atenção/Crítico |
| F-07 | "Eventos" = alertas + acionamentos do aerador (sem "Leitura normal") |
| F-08 | Login por e-mail; "Esqueceu a senha? Peça ao administrador"; "Lembrar de mim" = cookie persistente |
| F-09 | `operador` exibido como "Produtor" |
| F-10 | "Ativos" definidos pelo backend (`/alertas?ativos=true`); histórico separado |
| F-11 / F-12 | Identidade visual e estrutura de pastas do Figma (a identidade foi trocada pela do TC2 em 10/10; ver §15) |
| F-13 | Gráfico com escala por grandeza: série selecionável no Início; um gráfico por grandeza no detalhe, no histórico e nos relatórios |
| F-14 | Endpoint global `/alertas` com filtro por tanque |
| F-15 | Preferências salvas no aparelho; glossário só com os textos do Figma (sem "Transparência", por causa da F-01) |
| F-16 | Gráfico do Início mostra o tanque mais urgente, com seletor |

### 10.2 Escolhas feitas por falta de definição — revisar com a equipe

| ID | O que foi feito | Por quê |
|---|---|---|
| F-02 | Botão **"Ligar aerador"** mantido (alertas críticos de OD), com confirmação, chamando `POST /dispositivos/{id}/aerador` | Está no Figma; o endpoint, o canal MQTT de comando e o firmware não existem |
| F-06 | Telas **Previsão**, **Eventos** e **Relatórios** criadas só com dados já previstos no contrato; "Configurar alertas" omitido | Seções do menu sem wireframe |
| UC01 | Cadastro e edição de tanque com o dispositivo no mesmo formulário (`/tanques/novo`, `/tanques/:id/editar`) | O Figma não tem essas telas, e o RF07 as exige |
| — | Usuários, tanques, alertas e valores simulados são fictícios; espécie e tipos de sensor vêm do seed do backend | Necessário para desenvolver sem API |

### 10.3 Testes realizados

- Navegador (1366, 768, 375 e 320 px): login e erros, sessão restaurada após recarregar, logout, rotas protegidas e redirecionamento ao destino, bloqueio de admin para o Produtor, cadastro (validação, 409 de MAC duplicado, sucesso), edição (volume inválido, status de sensor, 409 no diálogo), alertas e comando do aerador, eventos, histórico com período na URL, relatórios, previsão, 404 e tanque inexistente. Nenhuma rota tem rolagem horizontal em 320 px.
- Automatizados (`npm test`): 22 testes — cliente HTTP (500, rede, 422 por campo, 401 com uma renovação para requisições paralelas, sessão expirada, contrato inválido, `NUMERIC` como string), veredito da previsão, validações do UC01, normalização de MAC e telefone, agregação por período, login de ponta a ponta e cadastro com 409.
- Build de produção: cerca de 130 KB comprimidos no carregamento inicial; Recharts carregado sob demanda; nenhum código simulado no bundle de produção.

### 10.4 Próximos passos

1. Backend: implementar o contrato (`docs/CONTRATO_API.md`) e trocar `VITE_USAR_MOCKS=false`.
2. Decidir F-02 (aerador manual), I-03 (onde gravar o OD estimado) e as faixas oficiais das espécies (I-09).
3. Tempo real com Socket.IO, quando o backend publicar os eventos.
4. PWA (manifesto, service worker, última leitura offline) e testes E2E com Playwright (CT02/CT06).

---

## 11. Atualizações do backend recebidas em 09/10/2026 (`Desktop.rar`)

### 11.1 O que chegou

- `sistema-tcc-completo`: mesmo commit do GitHub (`ba849fe`) **mais a Tarefa 1 do ML ainda não commitada**: modelo `Previsao` no ORM, tabela `previsoes` sob o Alembic, migração `b27bf3423478` (`horizonte_h IN (0,1,2,3)`) e `test_previsao.py`.
- `TCC/implementacao/ml/_codigo_validado_v2`: serviço de ML (estimativa de OD e risco de 1 a 3 h), regra de faixas corrigida e simulador do CT02.
- `TCC/sistema`: firmware do nó sensor (payload, `null` para sensor em falha, pH ainda sem calibração, turbidez só como tendência).
- Spec do ML v2 e plano de implementação. Prazo informado no plano: **demo em 10/10/2026**.
- **Não chegou:** API HTTP (FastAPI), WebSocket, autenticação, alertas (N8N). As pastas `dashboard/` e `alertas/` continuam vazias.

### 11.2 O que mudou no front-end

| Atualização do backend | Mudança no front |
|---|---|
| OD estimado gravado em `previsoes` com `h = 0` a cada 5 min | OD atual, série histórica (resolução de 5 min) e linha "Agora" vêm das linhas `h = 0`. **Resolve a I-03** |
| Confiança: intervalo de quantis no `h = 0`; probabilidade da classe nos `h = 1..3` | "Confiança baixa" no OD quando < 0,5 (`ML_CONFIANCA_MIN`); "probabilidade" nos horizontes, no modo avançado |
| `valor_previsto` de 1 a 3 h é uma projeção linear indicativa | Valores com "≈" e legenda "Previsão (indicativa)" |
| Regra corrigida: OD alto não é risco | Faixa ideal do OD "a partir de 4,0 mg/L"; a banda do gráfico não tem teto |
| Dados insuficientes: o ML não grava nada | "Previsão desatualizada" quando a última previsão tem mais de 15 min (3 ciclos) e o motivo da falta de previsão (tanque não ativo, sem espécie, sem leituras) |
| O ML só roda para tanques ativos com espécie; a turbidez não entra nos modelos | Textos da tela Previsão corrigidos |
| O firmware publica `null` para sensor em falha | "Sensor sem leitura há X min" na grandeza que ficou para trás |
| — (correção encontrada no teste) | Gráficos ficavam com 100 px quando a página montava sem área visível (aba em segundo plano); agora medem o próprio contêiner |

O servidor simulado foi ajustado para reproduzir essas regras (cópia da regra de `faixas.py` só no mock). Os tipos (`src/dominio/entidades.ts`) e o contrato (`docs/CONTRATO_API.md` v0.2) indicam de onde cada campo sai no banco real.

### 11.3 Problemas encontrados

**P1. A API HTTP não existe (bloqueante para a integração)**
- **Impacto:** o front não consegue ler os dados reais. A demo de 10/10 só mostra as telas com dados simulados, e o plano do ML prevê exatamente uma tela com "leituras e previsões ao vivo".
- **Encontrado:** nenhum FastAPI/HTTP no código; a spec do ML lista "API HTTP e dashboard (sub-projeto 5)" como fora de escopo; o README do firmware marca o dashboard como "a fazer".
- **Decidir:** quem implementa a API e se ela entra antes da demo. Sugestão: uma API mínima só de leitura (tanques, leituras, previsões) seguindo o contrato, com autenticação simples.
- **Atualização (09/10):** API mínima implementada; ver §12.

**P2. "Nível atual" do tanque não é gravado**
- **Impacto:** o selo do tanque e os indicadores da tela inicial dependem dele.
- **Encontrado:** o ML grava o nível do OD atual (`h = 0`) e o nível previsto de 1 a 3 h, mas não um nível geral do instante atual (RF04).
- **Decidir:** a recomendação está no contrato (§4): a API calcula o pior nível entre pH, temperatura e o OD de `h = 0`, reaproveitando `faixas.nivel_geral`.

**P3. A Tarefa 1 do ML não está no GitHub**
- **Impacto:** quem clonar o repositório não terá a tabela `previsoes` com `h = 0`, e o front depende disso.
- **Encontrado:** `git status` com 4 arquivos pendentes; o `RETOMAR-AQUI.md` lista os commits a fazer.
- **Decidir:** commitar e publicar antes da integração.

**P4. Alertas (sub-projeto 4) não existem**
- **Impacto:** as telas de Alertas e Eventos ficam vazias com o backend real.
- **Encontrado:** pasta `alertas/` vazia; nada grava em `alertas` nem em `acionamentos_atuador`.
- **Decidir:** nada no front; a API deve devolver listas vazias até lá. As telas já tratam o estado vazio.

**P5. pH sem calibração e turbidez só como tendência**
- **Impacto:** os valores na tela podem passar mais precisão do que têm.
- **Encontrado:** README do firmware (limitações declaradas).
- **Decidir:** sugestão: marcar o sensor de pH como `em_calibracao` até a calibração (o domínio já existe em `sensores.status`), para o front poder exibir isso.
- **Correção (09/10, §13):** marcar o pH como `em_calibracao` **desliga a previsão** do tanque, porque o serviço de ML só lê sensores `ativo`. A sugestão só vale se a equipe aceitar ficar sem previsão ou se o ML passar a aceitar esse status.

## 12. API mínima implementada (09/10/2026)

Resposta à P1, com o aval do usuário: uma FastAPI **somente de leitura**, no padrão do repositório do backend. Ela está em `../api-backend/` (patch, arquivos e `LEIA-ME.md`), para a equipe aplicar e commitar.

### 12.1 Escopo

- **Autenticação (RNF05):** login, renovação pelo cookie HttpOnly, saída, `GET`/`PATCH /auth/eu`. Usuários criados por `python -m src.api.usuarios`; o usuário do seed não tinha senha.
- **Leitura:** espécies, tanques, dispositivos com sensores, séries de leituras (`raw`/`5m`/`1h`) e previsão atual.
- **Alertas e eventos:** listas vazias até o sub-projeto 4.
- **Escrita do UC01 e aerador:** respondem 501. O front mostra "Esta função ainda não está disponível no servidor" (`erros.ts`, tipo `indisponivel`).

### 12.2 Decisões técnicas

- **Código:** `backend/src/api/`, reusando `Settings`, `criar_engine` e os modelos SQLAlchemy. Testes em `backend/tests/api/`, com as fixtures de banco da equipe.
- **Senhas e tokens:**
  - `scrypt` da biblioteca padrão, sem dependência nova para senha. Dependências novas: `fastapi`, `uvicorn`, `pyjwt`, `httpx` (testes).
  - Tokens sem estado no servidor: sair apaga o cookie; o access token dura 15 min.
- **Séries:** agregadas com `date_bin` do PostgreSQL em vez de `time_bucket`: o banco de teste não tem TimescaleDB, e a visão `leituras_media_horaria` não cobre a última hora.
- **Datas:** saem sempre em UTC (`...Z`), qualquer que seja o fuso da sessão do banco.
- **P2 (nível atual):** aplicada a recomendação do contrato. É o pior nível entre pH e temperatura da última leitura (regra de `ml/src/faixas.py`, copiada em `src/api/faixas.py`) e o nível do OD que o ML gravou em `h = 0`. **Ainda precisa do aval da equipe do ML.**
- **Previsão desatualizada:** `previsoes/atual` mantém `gerada_em` quando o último ciclo passou de 15 min, e o front mostra "desatualizada desde". Para tanque fora do escopo do ML, tudo vem nulo e o front explica o motivo.

### 12.3 Verificação

- `pytest`: 71 testes passando (24 da equipe e 47 novos). Banco: TimescaleDB 2.27 / PostgreSQL 18, DDL do Apêndice A e migrações até `b27bf3423478`. O patch também foi aplicado e testado sobre uma cópia limpa do repositório recebido.
- Front ligado à API real pelo proxy do Vite. Funcionaram:
  - login e renovação pelo cookie `Secure` em `http://localhost`;
  - painel, detalhe, previsão, histórico de 24 h e 7 dias;
  - configurações (`PATCH /auth/eu`), alertas e eventos vazios, saída;
  - edição de tanque com a resposta 501.

### 12.4 Pendências

1. Aplicar e commitar no repositório do backend, depois da Tarefa 1 do ML (P3).
2. Confirmar a regra do nível atual (P2).
3. ~~Rotas de escrita do UC01~~ (feitas, §13) e ~~aerador (F-02)~~ (feito, §14).
4. Alertas (P4) e WebSocket.
5. Índice `previsoes (id_tanque, ts_previsao DESC)` quando o volume crescer.
6. Limite de tentativas de login.

## 13. Cadastro do UC01 na API (09/10/2026)

Pedido do usuário depois da §12. Entregue em `../api-backend/` de duas formas:

- `api-minima.patch`: tudo, sobre o repositório recebido;
- `uc01-cadastro.patch`: só o cadastro, para quem já aplicou a 1ª entrega.

### 13.1 Rotas

`POST /tanques` (tanque + dispositivo opcional), `PATCH /tanques/{id}`, `POST /dispositivos`, `PATCH /dispositivos/{id}` e `PATCH /sensores/{id}`. Todas só para `admin` (I-04); o `operador` recebe 403. Só o aerador continua em 501.

### 13.2 Regras aplicadas (todas já decididas antes)

- **Uma transação (UC01):** tanque e dispositivo são gravados juntos. Se o MAC conflita, nada é gravado.
- **Sensores (I-07):** o dispositivo nasce com os 3 sensores do nó, os tipos `TIPOS_SENSOR_PADRAO` do seed do backend.
- **MAC:** normalizado para o formato da ingestão (`aa:bb:cc:dd:ee:ff`). Repetido → 409 no campo (`dispositivo.mac_address` ou `mac_address`), inclusive na corrida entre dois cadastros, detectada pela restrição única do banco.
- **Validações:** as mesmas do formulário, com as mesmas mensagens (nome, espécie do catálogo, volume, quantidade, data não futura, IP). Espécie obrigatória (I-13).
- **Sem exclusão (I-08):** o tanque vai para `inativo`.

### 13.3 Verificação

- `pytest`: 89 testes passando (24 da equipe e 65 da API). Inclui um teste em que o `LeituraProcessor` da ingestão aceita leituras do dispositivo recém-cadastrado, e a simulação da corrida de MAC. Essa simulação achou e corrigiu um defeito: o nome da restrição única muda entre o banco do DDL (`uq_disp_mac`) e o de teste.
- **Navegador, com o front ligado à API real:**
  - cadastro com MAC repetido (erro no campo) e depois com MAC novo;
  - edição de tanque;
  - status de sensor;
  - segundo dispositivo;
  - edição de dispositivo com conflito e depois com sucesso.
- **Ciclo completo:** o nó cadastrado pela tela recebeu uma leitura publicada por MQTT, processada pela ingestão real da equipe, e apareceu online.

### 13.4 Ponto para a equipe

O status do sensor tem efeito no ML: só sensores `ativo` entram na previsão (`ml/src/servico/janela.py`). Isso corrige a sugestão da P5.

## 14. Comando do aerador (F-02) — 09/10/2026

### 14.1 Decisões do usuário (perguntadas antes de implementar)

| Ponto | Decisão |
|---|---|
| Onde aparece | Detalhe do tanque, no card de cada dispositivo (Ligar, Desligar e último comando), e no alerta crítico (Ligar, como no Figma) |
| Quem pode | Qualquer usuário autenticado (administrador e produtor) |
| Firmware | Entregar a mudança como patch para a equipe revisar e testar na bancada |

### 14.2 O que foi feito

- **API:** `POST /dispositivos/{id}/aerador`.
  - Grava em `acionamentos_atuador`, que ganhou modelo SQLAlchemy espelhando o DDL; `alembic check` não mostra diferença.
  - Publica no broker e responde 202. Sem confirmação do broker, responde 503 e não registra.
  - `ultimo_acionamento` passa a vir em cada dispositivo, e `/eventos` traz os acionamentos.
- **Protocolo MQTT (decisão técnica):**
  - tópico `<prefixo>/<mac>/aerador`, irmão de `.../leituras`;
  - payload `{"acao", "id", "ts"}`, QoS 1;
  - **retido**: o nó que reinicia volta ao último estado pedido, e no boot o relé continua desligado até a mensagem chegar.
- **Firmware v3** (patch para o repositório `sistema`): assina o tópico a cada conexão, valida a ação, aciona o relé no pino 26 e registra no Serial. O README do firmware documenta o comando e um teste com `mosquitto_pub`.
- **Front:**
  - `ControleAerador` no card do dispositivo; o botão do alerta usa o mesmo hook;
  - confirmação para ligar e desligar (desligar com destaque de risco);
  - aviso de nó offline e mensagem própria para o 503;
  - texto "Último comando", porque não há confirmação do relé.

### 14.3 Verificação

- **Backend:** 98 testes passando. Inclui o publicador real contra o broker de teste (mensagem retida recebida por quem assina depois) e o 503 com broker fora.
- **Front:** 29 testes passando; o jsdom ganhou `showModal`/`close` do `<dialog>` na configuração de teste.
- **Ponta a ponta com a pilha real:**
  - ligar e desligar pelo painel;
  - o "nó" simulado em Python recebeu os dois comandos e, ao reconectar, o último retido;
  - eventos listados;
  - broker parado → 503 sem registro; broker de volta → reconexão automática e 202.

### 14.4 Pontos para a equipe

- **Segurança:** no broker público qualquer um que souber o tópico aciona o relé. Para uso real, broker privado com senha (a VPS do TC1).
- **Sem confirmação do relé:** o painel mostra o último comando. Confirmar exige o nó publicar o estado e a ingestão gravá-lo.
- **Acionamento automático** (TC1: OD < 3 mg/L): continua sem dono. Quando existir, deve gravar com `id_previsao` para aparecer como automático.

## 15. Modernização de UX/UI (10/10/2026)

Pedido do usuário: modernizar a interface com foco em experiência de uso e mobile-first, sem mudar funcionalidades, fluxos, regras ou contratos. A auditoria mediu as 11 telas em 320, 375, 768 e 1024 px antes de qualquer mudança.

### 15.1 Decisões do usuário

| Ponto | Decisão |
|---|---|
| Identidade visual (Figma × TC2, F-11) | **Paleta, fonte e escala do TC2 §8**, com a estrutura e a hierarquia das telas do Figma |
| Tema escuro (TC2 §8: opcional, respeitando `prefers-color-scheme`) | Incluído em Ajustes: Automático (padrão), Claro, Escuro |
| Repositório | `github.com/Patokaz/front-end-tcc`. Os `.docx` acadêmicos ficam fora do repositório (`.gitignore`) |

### 15.2 Problemas medidos e soluções

| Problema | Decisão | Onde |
|---|---|---|
| Alvos de toque de 36 px (filtros, chips, "Ver todos", paginação, selects, ⓘ do OD) e interruptor de 28 px; o TC2 §8.4 exige 44 × 44 px | Variante `pointer-coarse:` do Tailwind: 44 px em telas de toque, densidade mantida no mouse. No interruptor, um `::before` amplia a área de toque sem mudar o desenho | `ui/Botao`, `ui/Navegacao`, `ui/Campos`, `ui/Cartao`, `ui/Pecas`, links "voltar", selects |
| Em 1024 px (barra lateral visível), a grade de 3 colunas do Início deixava cartões de ~220 px: nome "Tanque ...", rótulos em 3 linhas, ⓘ encostado no valor | 2 colunas até 1535 px, 3 só a partir de 1536 px; o valor da métrica não encolhe nem quebra | `PaginaInicio`, `ui/Pecas` (`LinhaMetrica`) |
| Nome do tanque cortado com reticências em 320 px | O nome quebra linha; o selo de risco desce quando não cabe ao lado | `componentes/Tanque` (`CartaoTanque`) |
| Itens do TC2 §8 ausentes: paleta, Public Sans, escala 12/14/16/20/28/40, pesos 400/600/800, tema escuro | Tokens centralizados em `src/index.css`; títulos de página em 28 px/600; 800 só em valores e veredito | Global |

### 15.3 Sistema visual

- **Paleta (TC2 §8.1):** `agua #2F6F73`, `superficie #F5F7F6`, `tinta #132B2C`, `ótimo #1F7A55`, `crítico #A83426`. Tokens derivados com contraste conferido por cálculo.
- **Desvio declarado:** o âmbar de "atenção" do TC2 (`#B87503`) tem **3,76:1** sobre branco, abaixo dos 4,5:1 que o próprio TC2 exige. O texto de atenção usa `#8F5A00` (5,78:1), do mesmo matiz.
- **Bordas de campo:** passaram a ter 3:1 (WCAG 1.4.11): `#7F918F` no claro e `#617779` no escuro.
- **Tipografia (TC2 §8.2):**
  - Public Sans variável, servida localmente (`@fontsource-variable/public-sans`, OFL), no lugar da Inter.
  - Títulos de página em 28 px/600. Contagens dos indicadores em 28 px no celular e 40 px no computador, peso 800.
  - Veredito da previsão em 800, com 28 px no detalhe do tanque e 20 px na lista de previsões. O TC2 pede 40 px, mas o veredito é uma frase e não cabe em 40 px no celular.
  - Os valores de "Parâmetros agora" seguem a lista do Figma, sem os 40 px.
- **Tema escuro:**
  - Os mesmos tokens são redefinidos em `:root[data-tema='escuro']`. Gráficos, séries, ilustração e balão do gráfico usam variáveis CSS e acompanham o tema.
  - A impressão do relatório volta sempre ao claro.
  - A preferência fica no aparelho, como as demais.
- **Movimento (TC2 §8.3):** só a troca de tema ganhou animação, uma mudança de estado pedida pelo usuário: o círculo do Skiper UI 26, feito com a View Transition API nativa em 400 ms. Com "reduzir movimento", ou sem suporte no navegador, a troca é imediata.

### 15.4 Referências visuais consultadas

Base de consulta indicada pelo usuário. São inspiração, não especificação: valem as regras do TC2 e do Figma.

| Referência | Uso no projeto |
|---|---|
| [Aceternity UI](https://ui.aceternity.com/) · [Components](https://ui.aceternity.com/components) | Consultada; nenhum componente adotado. A maioria é decorativa (shaders, fundos animados, parallax, 3D) e depende da biblioteca Motion |
| [Magic UI](https://magicui.design/) · [Pointer](https://magicui.design/docs/components/pointer) | Não adotado: cursor personalizado é decorativo e não existe em telas de toque |
| [21st.dev](https://21st.dev/) | Registro de componentes shadcn; nenhum adotado. O projeto já tem seus componentes base |
| [Lightswind](https://lightswind.com/) · [3D Carousel](https://lightswind.com/components/3d-carousel) | Não adotado: não há conteúdo em carrossel no painel, e o 3D contraria o TC2 §8.3 |
| [Skiper UI 26](https://skiper-ui.com/v1/skiper26) | **Adotada a ideia**: troca de tema com círculo a partir do botão. Implementada sem `framer-motion` e sem `next-themes` |

**Nenhuma dependência nova de interface.** A única troca foi a fonte (Inter → Public Sans), decidida pelo usuário.

### 15.5 Verificação

- **Medição automática nas 11 telas e 7 larguras** (320, 375, 390, 430, 768, 1024, 1440 px): sem rolagem horizontal e sem texto cortado. Nas larguras de celular, com toque emulado, nenhum alvo abaixo de 44 px.
- **Limites da verificação:** em 768 e 1024 px o navegador de teste emula mouse, então a regra de toque não foi medida nessas larguras. Tudo foi feito com viewport simulado, não em aparelho real.
- **Telas conferidas:** claro e escuro, cores dos gráficos resolvidas pelo tema, troca de tema em Ajustes, navegação por teclado com foco visível.
- **Checagens:** `tsc`, ESLint, 29 testes e build de produção sem erros. JS inicial com 62 KB comprimidos, dentro do orçamento de 200 KB do TC2.

### 15.6 Pendências

- Conferir as cores em aparelhos reais, sob sol e no escuro.
- Os 40 px do TC2 para valores de leitura foram adaptados (ver 15.3). Se a banca exigir literalmente, dá para aplicar no detalhe do tanque.
