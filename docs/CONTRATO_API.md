# Contrato da API consumida pelo front-end (Painel Aquícola)

Versão 0.5 · 09/10/2026 · Base: contrato proposto no TC2 (§5.2) + telas do Figma + **backend e serviço de ML recebidos em 09/10** (spec `2026-09-24-ml-od-risco-design.md` v2, modelo `Previsao` e migração `b27bf3423478`) + **API implementada em 09/10** (`../api-backend/`): leitura, cadastro do UC01 e comando do aerador.

Este documento descreve **exatamente** o que o front-end espera do backend FastAPI. O servidor simulado em `frontend/src/mocks/handlers.ts` implementa este contrato e pode servir de referência executável; os esquemas de validação do front estão em `frontend/src/dominio/entidades.ts`.

Legenda: **[TC2]** já previsto no TC2 · **[+]** lacuna identificada na auditoria · **[Figma]** exigido por tela do Figma e ainda dependente de decisão (ver `AUDITORIA_FRONTEND.md`).

> **Situação em 09/10/2026:** existe uma **API** com leitura, cadastro do UC01 e comando do aerador, entregue em `../api-backend/` para o repositório do backend (`backend/src/api`, `python -m src.api`). Ela lê o que a ingestão MQTT grava em `leituras` e o serviço de ML grava em `previsoes`. As seções abaixo indicam, para cada campo, **de onde ele sai no banco real**.
>
> | Situação | Rotas |
> |---|---|
> | Implementadas | `/auth/*` (inclusive `PATCH /auth/eu`), `GET /especies`, `GET /tanques`, `GET /tanques/{id}`, `GET /tanques/{id}/dispositivos`, `GET /tanques/{id}/leituras`, `GET /tanques/{id}/previsoes/atual` |
> | Implementadas, só `admin` (UC01) | `POST /tanques`, `PATCH /tanques/{id}`, `POST /dispositivos`, `PATCH /dispositivos/{id}`, `PATCH /sensores/{id}` |
> | Implementada, qualquer usuário (F-02) | `POST /dispositivos/{id}/aerador` |
> | Implementadas, sem alertas até o sub-projeto 4 | `GET /alertas` (vazia), `GET /eventos` (só acionamentos do aerador) |

---

## 1. Convenções gerais

| Item | Regra |
|---|---|
| Prefixo | `/api/v1` |
| Origem | Mesma origem do front (proxy reverso). Em desenvolvimento o Vite repassa `/api` para `API_PROXY_ALVO`. Assim não há CORS e o cookie `SameSite=Strict` funciona. |
| Formato | JSON UTF-8 |
| Datas | ISO 8601 com fuso (`2026-10-07T03:40:00Z`) |
| Datas sem hora | `AAAA-MM-DD` (ex.: `data_povoamento`) |
| Números `NUMERIC` | Pode ser `number` ou string numérica (padrão do Pydantic para `Decimal`); o front aceita os dois |
| Paginação | Parâmetros `pagina` (≥ 1) e `por_pagina` (≤ 50). Resposta: `{ "itens": [...], "total": 18, "pagina": 1, "por_pagina": 10 }` |
| Mensagens | Em português (são exibidas ao usuário quando ligadas a um campo) |

### 1.1 Erros

Formato padrão do FastAPI:

```json
{ "detail": "Tanque não encontrado." }
```

Erros de campo (422 e 409) no formato de validação do FastAPI — `loc` começa com `"body"` e o restante é o caminho do campo:

```json
{
  "detail": [
    { "loc": ["body", "volume_litros"], "msg": "O volume deve ser maior que zero.", "type": "value_error" },
    { "loc": ["body", "dispositivo", "mac_address"], "msg": "Este endereço MAC já está cadastrado em outro dispositivo.", "type": "conflict" }
  ]
}
```

| Status | Quando | O que o front faz |
|---|---|---|
| 401 | Token ausente/expirado; credenciais inválidas no login | Renova a sessão uma vez; se falhar, volta ao login com "Sua sessão expirou" |
| 403 | Perfil sem permissão | "Você não tem permissão para realizar esta ação." |
| 404 | Recurso inexistente | Estado "não encontrado" da tela |
| 409 | Conflito de unicidade (MAC) | Mensagem no campo indicado em `loc` |
| 422 | Validação | Mensagens nos campos; se `type` for do Pydantic (`missing`, `greater_than`…) o front traduz |
| 501 | Rota do contrato ainda não implementada (nenhuma hoje) | "Esta função ainda não está disponível no servidor." |
| 503 | Comando do aerador não chegou ao broker MQTT | "Não foi possível enviar o comando ao nó sensor. Tente novamente." |
| 5xx | Falha interna | "Ocorreu um erro no servidor. Tente novamente em instantes." |

---

## 2. Autenticação (RNF05)

- **Access token** JWT no corpo da resposta; o front guarda só em memória e envia `Authorization: Bearer <token>`.
- **Refresh token** em cookie `HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`, emitido no login. Com `lembrar = true`, cookie persistente (ex.: 30 dias); com `false`, cookie de sessão.
- Ao abrir o app, o front chama `POST /auth/refresh`; se der 200, a sessão é restaurada sem novo login.
- Na API mínima: access token de 15 min; token de renovação de 12 h (cookie de sessão) ou 30 dias (`lembrar`); senhas com `scrypt`; usuários criados por `python -m src.api.usuarios`. Os tokens não guardam estado no servidor: `logout` apaga o cookie e o access token expira sozinho.

| Método | Rota | Corpo | Resposta | Origem |
|---|---|---|---|---|
| POST | `/auth/login` | `{ "email": "...", "senha": "...", "lembrar": true }` | `200 { "access_token": "...", "expira_em": "..." }` + cookie · `401` | [TC2] + `lembrar` |
| POST | `/auth/refresh` | — (cookie) | `200 { "access_token", "expira_em" }` · `401` | [TC2] |
| POST | `/auth/logout` | — | `204` (apaga o cookie) | [+] |
| GET | `/auth/eu` | — | `200 Usuario` | [TC2] |
| PATCH | `/auth/eu` | `{ "nome": "...", "telefone": "+5511987654321" \| null }` | `200 Usuario` · `422` | [+] |

```json
// Usuario
{ "id": 2, "nome": "Marina Souza", "email": "produtor@exemplo.com", "telefone": "+5511987654321", "perfil": "operador" }
```

`telefone` em formato internacional (`+55` + DDD + número), usado pelo N8N/Evolution API (UC04).

---

## 3. Catálogos

| Método | Rota | Resposta | Origem |
|---|---|---|---|
| GET | `/especies` | `Especie[]` | [TC2] |

```json
// Especie
{ "id": 1, "nome_comum": "Tilápia do Nilo", "nome_cientifico": "Oreochromis niloticus",
  "ph_min": "6.50", "ph_max": "8.50", "temp_min": "20.0", "temp_max": "30.0", "od_min": "4.00", "od_max": "8.00" }
```

---

## 4. Tanques (UC01, UC02)

Permissões: leitura para qualquer usuário autenticado (decisão I-05: todos veem todos); escrita só `admin` (I-04).

| Método | Rota | Corpo | Resposta | Origem |
|---|---|---|---|---|
| GET | `/tanques` | — | `200 Tanque[]` | [TC2], ampliado |
| GET | `/tanques/{id}` | — | `200 Tanque` · `404` | [TC2] |
| POST | `/tanques` | `DadosTanque` + `dispositivo?` | `201 Tanque` · `409` · `422` | [TC2], ampliado |
| PATCH | `/tanques/{id}` | `DadosTanque` | `200 Tanque` · `404` · `422` | [TC2] |

Não há `DELETE` (decisão I-08): para "excluir", o admin muda `status` para `inativo`; o histórico é preservado.

```json
// DadosTanque (POST/PATCH)
{ "nome": "Tanque Norte", "id_especie": 1, "volume_litros": 500, "quantidade_peixes": 40,
  "data_povoamento": "2026-08-10", "status": "ativo",
  "dispositivo": { "nome": "Nó sensor Norte", "mac_address": "a4:f0:0f:64:3c:70",
                   "modelo_esp32": "ESP32 DevKitC V4", "versao_firmware": "1.2.0", "ip_local": "192.168.0.21" } }
```

- `dispositivo` é **opcional** e só existe no POST: tanque e dispositivo são gravados **na mesma transação**, como descreve o UC01.
- MAC: o front envia sempre no formato `aa:bb:cc:dd:ee:ff` minúsculo — o mesmo que a ingestão MQTT usa (`mac_com_separador`). O backend deve normalizar também.
- Ao criar um dispositivo, o backend cria os 3 `sensores` (pH, temperatura, turbidez) com os `tipos_sensor` do catálogo (decisão I-07). Sem isso, a ingestão descarta as leituras.
- Implementação: MAC aceito com `:`, `-` ou sem separador e gravado como `aa:bb:cc:dd:ee:ff`. Repetido → `409` com `type: "conflict"`, também quando dois cadastros chegam juntos. Espécie fora do catálogo → `422` em `id_especie`. `data_povoamento` no futuro → `422`. `PATCH /tanques/{id}` recebe o objeto inteiro (`DadosTanque`) e ignora `dispositivo`. Usuário `operador` → `403`.

```json
// Tanque (resposta) — campos calculados marcados com *
{
  "id": 3, "nome": "Tanque Leste", "volume_litros": "300.00", "quantidade_peixes": 30,
  "data_povoamento": "2026-08-24", "status": "ativo", "criado_em": "2026-08-08T03:00:00Z",
  "especie": { ...Especie } | null,
  "nivel_risco": "critico" | "atencao" | "otimo" | null,          // * nível atual (ver abaixo); null = sem previsão
  "ultima_leitura_em": "2026-10-07T03:40:00Z" | null,              // * leitura mais recente de qualquer dispositivo
  "ultimas_leituras": [                                            // * valor mais recente por grandeza, cada um com o seu ts
    { "grandeza": "temperatura", "valor": "28.1", "unidade": "C", "ts": "...", "estimado": false },
    { "grandeza": "od", "valor": "2.8", "unidade": "mg/L", "ts": "...", "estimado": true, "baixa_confianca": true }
  ],
  "dispositivos": [                                                // * resumo
    { "id": 3, "nome": "Nó sensor Leste", "status_conexao": "online", "ultima_leitura_em": "..." }
  ]
}
```

`status_conexao` **calculado** pela API (decisão I-10): `offline` se a última leitura do dispositivo tiver mais de 5 min (fluxo alternativo do UC02). A ingestão atual não atualiza `ultimo_heartbeat`.

De onde sai cada campo calculado:

| Campo | Fonte no banco |
|---|---|
| `ultimas_leituras` de pH, temperatura e turbidez | última linha de `leituras` **por grandeza** (join `sensores` → `tipos_sensor`). Cada uma com o seu `ts`: quando um sensor falha, o firmware publica `null`, a ingestão não grava, e o front mostra "Sensor sem leitura há X min" |
| `ultimas_leituras` de OD | última linha de `previsoes` com `horizonte_h = 0` (`valor_previsto`, `ts_previsao`); `estimado: true`; `baixa_confianca = confianca < ML_CONFIANCA_MIN` (0,5) |
| `nivel_risco` | **recomendação:** pior nível entre pH e temperatura da última leitura e o OD de `h = 0`, pela mesma regra de `ml/src/faixas.py` (`nivel_geral`), reaproveitando o módulo. `null` se o tanque não tem previsão válida (não `ativo`, sem espécie ou última previsão com mais de 15 min). **A confirmar com a equipe**: o ML grava o nível do OD atual e o nível previsto de 1 a 3 h, mas não um "nível geral atual" |

---

## 5. Dispositivos e sensores

| Método | Rota | Corpo | Resposta | Origem |
|---|---|---|---|---|
| GET | `/tanques/{id}/dispositivos` | — | `200 Dispositivo[]` | [TC2] |
| POST | `/dispositivos` | `DadosDispositivo` + `id_tanque` | `201 Dispositivo` · `409` · `422` | [TC2] |
| PATCH | `/dispositivos/{id}` | `DadosDispositivo` | `200 Dispositivo` · `409` · `422` | [+] |
| PATCH | `/sensores/{id}` | `{ "status": "ativo" \| "inativo" \| "em_calibracao" }` | `200 Sensor` | [+] |
| POST | `/dispositivos/{id}/aerador` | `{ "acao": "ligar" \| "desligar" }` | `202 { id, acao, motivo, ts_acionamento }` | [Figma] F-02 |

```json
// Dispositivo
{ "id": 3, "id_tanque": 3, "nome": "Nó sensor Leste", "modelo_esp32": "ESP32 DevKitC V4",
  "mac_address": "a4:f0:0f:64:3c:72", "versao_firmware": "1.2.0", "ip_local": "192.168.0.23",
  "status_conexao": "online", "ultima_leitura_em": "...", "data_cadastro": "...",
  "sensores": [ { "id": 7, "grandeza": "ph", "modelo": "SEN0161-V2", "unidade": "pH", "status": "ativo", "data_instalacao": "2026-08-08" } ],
  "ultimo_acionamento": { "id": 4, "acao": "ligar", "motivo": "Comando manual de Marina Souza pelo painel.",
                          "ts_acionamento": "...", "automatico": false } | null }
```

**Comando do aerador (F-02), decidido em 09/10:**

- **Quem e onde:** qualquer usuário autenticado; no detalhe do tanque (ligar e desligar) e no alerta crítico (ligar).
- **O que a API faz:** grava em `acionamentos_atuador`, publica no broker MQTT e responde **202**. Se o broker não confirma em 5 s, desfaz o registro e responde **503**.
- **Protocolo:** tópico `<prefixo>/<mac sem separador>/aerador`, payload `{"acao", "id", "ts"}`, QoS 1, **retido**. O nó que reinicia recebe o último comando ao assinar.
- **Firmware:** precisa da versão v3, que assina o tópico (`../api-backend/firmware-aerador.patch`).
- **Último comando:** `ultimo_acionamento` é o último comando do dispositivo. O nó ainda não confirma o estado real do relé.
- **Automático:** `automatico` é `true` quando o acionamento tem `id_previsao` (disparado por previsão); nada grava acionamento automático ainda.

`PATCH /dispositivos/{id}` sem `modelo_esp32` mantém o modelo atual; `versao_firmware` e `ip_local` vazios viram `null`.

**Atenção ao status do sensor:** o serviço de ML só lê sensores `ativo`. Com o pH ou a temperatura `inativo` ou `em_calibracao`, o tanque fica sem previsão.

---

## 6. Leituras (UC02, UC03, RNF02)

`GET /tanques/{id}/leituras?desde=<ISO>&ate=<ISO>&bucket=raw|5m|1h&grandezas=ph,temperatura,turbidez,od` **[TC2]**

O front escolhe o `bucket`: até 6 h → `raw`; até 48 h → `5m`; acima → `1h`. Se a janela gerar mais de 5.000 pontos para o bucket (`raw` conta 1 por minuto), a API responde `422` com `loc: ["query", "bucket"]`.

```json
{
  "id_tanque": 3, "bucket": "5m", "desde": "...", "ate": "...",
  "series": [
    { "grandeza": "ph", "unidade": "pH", "estimado": false,
      "pontos": [ { "ts": "2026-10-06T03:45:00Z", "valor": 7.81, "min": 7.79, "max": 7.83 } ] },
    { "grandeza": "od", "unidade": "mg/L", "estimado": true, "pontos": [ ... ] }
  ]
}
```

`min`/`max` só existem quando agregado.

- pH, temperatura e turbidez: `leituras`, agregadas com `date_bin` do PostgreSQL (`5m` e `1h`). A visão `leituras_media_horaria` pode substituir o `1h` no futuro; hoje ela não cobre a última hora.
- **OD (resolve a pendência I-03):** série das linhas `previsoes` com `horizonte_h = 0` (`ts_previsao`, `valor_previsto`), uma a cada ciclo do serviço de ML (5 min). Por isso a série de OD tem resolução de 5 min mesmo com `bucket=raw`.

---

## 7. Previsões (UC06, RF04, RF05)

`GET /tanques/{id}/previsoes/atual` **[TC2]**

Fonte: o último ciclo do serviço de ML para o tanque — as 4 linhas de `previsoes` com o mesmo `ts_previsao` (spec do ML, seção "Gravação em `previsoes`").

```json
{
  "id_tanque": 3,
  "nivel_risco": "critico",              // nível atual do tanque (mesma regra de /tanques); null = indisponível
  "gerada_em": "2026-10-07T03:40:00Z",   // ts_previsao do último ciclo
  "od_atual": {                          // linha h = 0
    "valor": "2.8000", "nivel_risco": "critico", "confianca": "0.4600", "baixa_confianca": true
  },
  "horizontes": [                        // linhas h = 1, 2, 3
    { "id": 31, "parametro_critico": "od", "valor_previsto": "2.60", "nivel_risco": "critico",
      "horizonte_h": 1, "confianca": "0.9400", "baixa_confianca": false, "ts_previsao": "..." },
    { "id": 32, "...": "...", "horizonte_h": 2 },
    { "id": 33, "...": "...", "horizonte_h": 3 }
  ]
}
```

- O front **não** classifica risco: exibe os níveis gravados pelo ML e monta a frase a partir deles.
- `od_atual.confianca` vem do intervalo de quantis; `baixa_confianca = confianca < ML_CONFIANCA_MIN` (0,5), o fluxo alternativo do UC06.
- Nos horizontes, `confianca` é a **probabilidade da classe prevista** (o front mostra "probabilidade" no modo avançado) e `valor_previsto` é a projeção linear **indicativa** (o front mostra "≈").
- Quando os dados não bastam, o serviço **não grava** nada (indeterminado). Se a última previsão tiver mais de 15 min (3 ciclos), a API devolve `nivel_risco: null`, `od_atual: null` e `horizontes: []`, **mas mantém `gerada_em`** com a hora do último ciclo: o front mostra "Previsão desatualizada. Última previsão às HH:MM".
- Tanque fora do escopo do ML (não `ativo` ou sem espécie): tudo nulo, inclusive `gerada_em`; o front explica o motivo.
- `baixa_confianca` dos horizontes é sempre `false`: o ML só define baixa confiança para o OD de `h = 0`.
- O serviço só roda para tanques `ativo` com espécie; o front explica isso quando não há previsão.

---

## 8. Alertas e eventos (UC04, UC07)

`GET /alertas?tanque=&status=&ativos=&desde=&ate=&pagina=&por_pagina=` **[Figma]**, versão global do `/tanques/{id}/alertas` do TC2.

```json
// Alerta
{ "id": 14, "id_tanque": 3, "tanque_nome": "Tanque Leste", "id_previsao": 1014,
  "mensagem": "Oxigênio muito baixo (2,8 mg/L, estimado).",
  "recomendacoes": ["Ligue o aerador agora.", "Reduza a ração de hoje."],
  "nivel_risco": "critico", "parametro": "od",
  "canal": "whatsapp", "status": "enviado", "ts_envio": "...", "criado_em": "..." }
```

- `tanque_nome`, `nivel_risco` e `parametro` vêm de junções (`tanques`, `previsoes`).
- `recomendacoes` **[Figma] F-03**: texto gerado pelo backend/N8N; a tabela `alertas` só tem `mensagem`.
- **Sub-projeto 4 (alertas/N8N) ainda não existe:** até lá a API responde listas vazias (`200`, `itens: []`, com `pagina` e `por_pagina` validados) — o front mostra o estado vazio, sem erro.
- `ativos=true` **[Figma] F-10**: último alerta de cada tanque que **continua** em atenção/crítico. A regra de "ativo/resolvido" é do backend.
- Ordenação: mais recentes primeiro.

`GET /eventos?pagina=&por_pagina=` **[Figma] F-07**: linha do tempo que junta alertas e acionamentos do aerador, mais recentes primeiro. Hoje traz só os acionamentos (tabela `acionamentos_atuador`); os alertas entram com o sub-projeto 4.

```json
{ "tipo": "alerta", "id": "alerta-14", "id_tanque": 3, "tanque_nome": "Tanque Leste",
  "ocorrido_em": "...", "nivel_risco": "critico", "mensagem": "..." }
{ "tipo": "acionamento", "id": "acionamento-3", "id_tanque": 3, "tanque_nome": "Tanque Leste",
  "ocorrido_em": "...", "acao": "ligar", "automatico": true, "motivo": "Ação automática: ..." }
```

---

## 9. Tempo real (pendente)

Previsto no TC1/TC2: Socket.IO no namespace `/tempo-real` (exige `python-socketio` no servidor), com os eventos `leitura:nova`, `previsao:nova`, `alerta:novo` e `dispositivo:status`, e salas por tanque (`assinar:tanque` / `cancelar:tanque`).

Enquanto o backend não oferece o WebSocket, o front atualiza os dados a cada 30 s por sondagem REST — o mesmo modo de contingência previsto no TC2 (§14).
