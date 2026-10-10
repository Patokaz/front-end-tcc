# Textos para o TCC: painel web, API e PWA

Situação em 10/10/2026. Este documento traz os textos para atualizar o TCC com o que foi implementado no painel web (front-end), na API HTTP e no PWA. Cada bloco indica a seção do TCC em que entra, pela numeração do TC1 da pasta do projeto, e traz o texto pronto para colar e revisar.

**Como usar**

- **Só descrição e resultado.** Os textos trazem descrição técnica, procedimento e resultado. Não há análise, discussão nem conclusão: pela Declaração de Uso de IA, essas partes são escritas pelos autores (capítulos de análise dos resultados e de conclusões).
- **Marcas para o grupo.** Trechos entre colchetes com **AUTORES** pedem uma decisão ou um dado do grupo.
- **Origem dos números.** Os números vêm das verificações registradas em [`AUDITORIA_FRONTEND.md`](AUDITORIA_FRONTEND.md) (§12 a §16) e do código deste repositório. Cada tabela indica a fonte e a data.
- **Uso de IA.** Este documento foi elaborado com apoio de IA (Claude Code). A linha correspondente para a Declaração está no item 10.

---

## 1. O que muda no texto atual

A revisão do TCC de 09/10/2026 descreve a API REST e o painel como não implementados. Isso aparece nas seções 6.3, 6.9 (item "Situação da implementação"), 6.12, 8.1, 8.3 e na tabela de situação dos requisitos.

Em 10/10/2026:

- **API HTTP:** a API em FastAPI está implementada, com autenticação JWT, consulta de leituras e previsões, cadastro do UC01 e comando do aerador, e tem testes automatizados. Foi entregue como *patch* para o repositório do back-end. **[AUTORES: informar se o patch já foi aplicado e commitado em `sistema-tcc-completo`.]**
- **Painel web:** o painel está implementado em React, com doze telas, cadastro do UC01, PWA e tema claro e escuro. Está no repositório `github.com/Patokaz/front-end-tcc`.
- **Continuam não implementados:**
  - os alertas por WhatsApp (N8N e Evolution API);
  - a atualização em tempo real por WebSocket;
  - o acionamento automático do aerador.

---

## 2. Seção 6.3 — Delimitação do Escopo

Substituir o item do painel na lista "Dentro do escopo" por:

> Dashboard web responsivo e instalável (PWA), com visualização das leituras, do oxigênio dissolvido estimado e da previsão de risco, histórico, relatórios e cadastro de tanques e dispositivos; a atualização dos dados ocorre por consulta periódica a cada 30 segundos (seção 6.9).

**[AUTORES: decidir com o orientador se os alertas via N8N e WhatsApp continuam no escopo ou passam a trabalhos futuros, e ajustar a lista. O painel já tem a tela de alertas, que fica vazia enquanto o serviço de alertas não gravar na tabela `alertas`.]**

---

## 3. Seção 6.9 — Arquitetura do Sistema

### 3.1 Back-end: API HTTP

Texto para o parágrafo "Quanto ao back-end", na parte implementada:

> A camada de aplicação foi implementada como uma API REST em Python 3.11, com FastAPI e Uvicorn, no pacote `src/api` do repositório do back-end, ao lado do serviço de ingestão MQTT. A API lê a tabela `leituras`, gravada pela ingestão, e a tabela `previsoes`, gravada pelo serviço de Machine Learning, e utiliza os mesmos modelos SQLAlchemy 2 e a mesma configuração de banco do repositório. São 19 rotas sob o prefixo `/api/v1`, agrupadas em autenticação, catálogos, tanques, leituras, previsões, cadastro (UC01), alertas, eventos e comando do aerador; a documentação interativa é gerada pelo próprio FastAPI em `/api/v1/docs`.
>
> A autenticação atende ao RNF05. O login devolve um token de acesso JWT com validade de 15 minutos, que o painel mantém apenas em memória, e grava um token de renovação em *cookie* `HttpOnly`, `Secure` e `SameSite=Strict`. Esse *cookie* vale pela sessão do navegador, ou por 30 dias quando o usuário marca "Lembrar de mim". As senhas são armazenadas com o algoritmo scrypt, e o segredo de assinatura dos tokens é lido da variável de ambiente `API_JWT_SEGREDO`. As rotas de cadastro exigem o perfil administrador; o perfil operador recebe a resposta 403.
>
> A API aplica as seguintes regras de leitura:
>
> - o oxigênio dissolvido exibido é a estimativa de horizonte zero gravada pelo serviço de Machine Learning a cada 5 minutos;
> - uma previsão só é considerada válida se o último ciclo do serviço tiver no máximo 15 minutos e o tanque estiver ativo e com espécie cadastrada;
> - um dispositivo é considerado *online* quando a última leitura tem no máximo 5 minutos;
> - as séries históricas são agregadas no banco (`date_bin`) em intervalos brutos, de 5 minutos ou de 1 hora, com até 5.000 pontos por consulta.
>
> No cadastro (UC01), o endereço MAC é normalizado para o formato procurado pela ingestão e o MAC repetido é recusado com a resposta 409. Todo dispositivo novo recebe os três sensores do nó, e não há exclusão física: o tanque passa ao status inativo e o histórico é preservado.
>
> O comando manual do aerador segue três passos:
>
> 1. é registrado na tabela `acionamentos_atuador`;
> 2. é publicado no *broker* MQTT, no tópico `<prefixo>/<mac>/aerador`, com QoS 1 e mensagem retida, para que o nó receba o último comando ao se reconectar;
> 3. se o *broker* não confirmar em 5 segundos, o registro é desfeito e a API responde 503.

**[AUTORES: a regra do nível atual do tanque (o pior entre pH e temperatura da última leitura, pela regra de `faixas.py`, e o nível do OD estimado) ainda espera confirmação da equipe, como registrado em `API.md`.]**

### 3.2 Front-end: painel web

Texto para o parágrafo "Quanto ao front-end", na parte implementada:

> **Tecnologias e organização.** O painel é uma aplicação de página única em React 18 e TypeScript em modo estrito, empacotada com Vite, estilizada com Tailwind CSS 4 e com gráficos em Recharts. O código segue a organização em camadas definida no protótipo do Figma: `app` (rotas, leiaute e telas), `dominio` (tipos e regras de exibição), `infra` (cliente HTTP e armazenamento local), `ui` (componentes visuais) e `compartilhado` (formatação e utilitários). Os dados vindos da API são tratados como *cache* pela biblioteca TanStack Query 5. Os formulários usam React Hook Form com validação Zod, a mesma biblioteca que valida cada resposta da API antes de exibi-la: uma resposta fora do contrato vira a mensagem "resposta inesperada", e não uma tela quebrada.
>
> **Comunicação com a API.** O cliente HTTP converte falhas de rede, tempo esgotado e as respostas 401, 403, 404, 409, 422 e 5xx em mensagens em português. Ao receber 401, faz uma única tentativa de renovação da sessão, compartilhada pelas requisições simultâneas. O painel não classifica risco: o nível ótimo, atenção ou crítico chega pronto do serviço de Machine Learning, por meio da API, e a interface o traduz em texto, cor e ícone, de modo que a cor nunca é o único sinal.
>
> **Atualização dos dados.** O canal WebSocket (Socket.IO) da arquitetura-alvo não foi implementado na API. Por isso, os dados são atualizados por consulta periódica a cada 30 segundos, modo de contingência previsto no documento de arquitetura do front-end. Com o nó sensor publicando a cada 60 segundos (RF01), esse intervalo corresponde a meio ciclo de leitura.
>
> **Instalação e uso sem internet (PWA).** O painel é distribuído como *Progressive Web App*, com manifesto e *service worker* gerados pelo vite-plugin-pwa (Workbox). As estratégias de *cache* do Workbox estão na Tabela X. Além do *cache* HTTP, a última leitura conhecida de cada tanque é gravada no IndexedDB do aparelho. Ao abrir o painel sem conexão, ou com o servidor fora do ar, a interface mostra esses valores sempre com o horário da medição e com o aviso de que podem estar desatualizados, e volta a funcionar sozinha quando a conexão é restabelecida. A cópia local e as respostas guardadas são apagadas quando o usuário sai da conta, quando a sessão expira e quando a renovação da sessão é recusada pelo servidor.
>
> **Instalação e atualização.** O convite de instalação aparece a partir da segunda visita e também fica disponível em Configurações. Nos aparelhos iPhone e iPad, que não oferecem o pedido de instalação ao site, o painel mostra os passos de "Adicionar à Tela de Início". Quando há uma versão nova, o painel avisa e só recarrega com a confirmação do usuário, para não perder um cadastro em andamento.
>
> **Identidade visual e acessibilidade.** A identidade visual segue a especificação do documento de arquitetura do front-end, com paleta, fonte Public Sans e escala tipográfica de 12, 14, 16, 20, 28 e 40 px. A estrutura e a hierarquia das telas seguem o protótipo do Figma. O leiaute vai de 320 a 1920 px: no celular e no *tablet*, há uma barra de navegação inferior; a partir de 1024 px, uma barra lateral. Há tema claro, que é o padrão, e tema escuro opcional. Em telas de toque, os controles têm no mínimo 44 × 44 px (critério 2.5.5 da WCAG 2.2). O contraste é de no mínimo 4,5:1 para texto (critério 1.4.3) e de 3:1 para as bordas dos campos (critério 1.4.11), nos dois temas.

Tabela X — Estratégias de *cache* do *service worker*

| Recurso | Estratégia | Validade |
|---|---|---|
| Aplicação (HTML, JavaScript, CSS, fonte e ícones) | Pré-carregamento (*precache*) com revisão por *hash* | Até a próxima versão |
| Catálogos (`GET /especies`) | *Stale-while-revalidate* | 7 dias |
| Tanques (`GET /tanques`, `GET /tanques/{id}`) | Rede primeiro; sem rede, a cópia guardada | 5 minutos |
| Séries de leituras (`GET /tanques/{id}/leituras`) | Rede primeiro; sem rede, a cópia guardada | 5 minutos, até 30 respostas |
| Login, alertas, eventos, previsões e todas as gravações | Somente rede | — |

Fonte: elaborada pelos autores, a partir de `frontend/vite.config.ts`.

Desvio em relação ao documento de arquitetura do front-end, para registrar no texto:

> O reenvio automático de cadastros feitos sem conexão (*Background Sync*), previsto no documento de arquitetura do front-end, não foi implementado. Como o token de acesso fica apenas em memória (RNF05), um reenvio feito depois pelo *service worker* chegaria sem autorização. Além disso, o UC01 exige resposta imediata quando o MAC é repetido ou um campo é inválido. Sem conexão, o cadastro informa a falha e o usuário repete o envio.

### 3.3 Situação da implementação

Substitui os itens (b) e (e) do parágrafo "Situação da implementação em 09/10/2026":

> (b) o back-end implementado compreende o serviço de ingestão e a API REST em FastAPI, com autenticação JWT, executados localmente; o canal WebSocket não foi implementado, e o painel atualiza os dados por consulta periódica a cada 30 segundos; (…) (e) o painel web foi implementado como PWA (seção 6.10); a integração com N8N e Evolution API não foi implementada, e a tela de alertas do painel permanece vazia até que o serviço de alertas grave na tabela `alertas`.

**[AUTORES: atualizar a data do parágrafo para a data da entrega.]**

---

## 4. Seção 6.10 — Definição do Protótipo (painel)

Texto a acrescentar após a descrição do nó sensor:

> O painel web completa o protótipo na camada de apresentação. As telas seguem o fluxo do protótipo do Figma. As telas de cadastro e edição de tanques e dispositivos (UC01), que o Figma não detalha, foram criadas a partir do RF07. A Tabela Y relaciona as telas implementadas.

Tabela Y — Telas do painel web

| Tela | Endereço | Função | Perfil |
|---|---|---|---|
| Entrar | `/entrar` | Login por e-mail e senha, com "Lembrar de mim" | Todos |
| Início | `/` | Contagem de tanques por nível, tanques ordenados por urgência, gráfico do tanque mais urgente, alerta principal e últimos eventos | Todos |
| Tanques | `/tanques` | Lista de tanques com busca e filtro por situação | Todos |
| Detalhe do tanque | `/tanques/{id}` | Parâmetros atuais (temperatura, pH, turbidez e OD estimado), previsão de 1 a 3 h, gráficos, dispositivos e comando do aerador | Todos |
| Novo tanque | `/tanques/novo` | Cadastro do tanque e do nó sensor (UC01) | Administrador |
| Editar tanque | `/tanques/{id}/editar` | Edição do tanque, dos dispositivos e do status dos sensores | Administrador |
| Histórico | `/historico` | Séries por período, com exportação em CSV | Todos |
| Relatórios | `/relatorios` | Resumo do período, com impressão ou PDF | Todos |
| Previsão | `/previsao` | Risco previsto de 1 a 3 h para cada tanque | Todos |
| Alertas | `/alertas` | Alertas ativos e histórico, com recomendações | Todos |
| Eventos | `/eventos` | Alertas e acionamentos do aerador | Todos |
| Configurações | `/configuracoes` | Conta (nome e WhatsApp), tema, modo avançado, linguagem simples, instalação do aplicativo e glossário | Todos |

Fonte: elaborada pelos autores, a partir de `frontend/src/app/rotas.tsx`.

---

## 5. Seções 6.11 e 6.13 — Casos de teste

Texto para a seção de resultado da execução dos casos de teste:

> O painel e a API têm testes automatizados próprios, executados a cada alteração.
>
> - **Painel:** os testes usam Vitest e Testing Library, com um servidor simulado (MSW) que implementa o contrato da API. Cobrem:
>   - o cliente HTTP: erros, renovação única da sessão e validação do contrato;
>   - as validações do UC01 e o cadastro com MAC repetido;
>   - o login e a restauração da sessão;
>   - o comando do aerador, com confirmação e falha do *broker*;
>   - a abertura sem conexão.
> - **API:** os testes usam pytest, com um banco PostgreSQL 18 e TimescaleDB 2.27 de teste e o *broker* Mosquitto de teste do repositório. Um dos testes confere que um dispositivo cadastrado pela API passa a ter as leituras aceitas pelo serviço de ingestão.

Situação dos casos de teste ligados ao painel e à API:

> - **CT01 (fluxo ESP32 → MQTT → banco).** Foi executado com uma leitura publicada por MQTT a partir de um simulador, e não pelo nó real. A leitura foi processada pela ingestão do repositório e o dispositivo apareceu *online* no painel. A medição com o ESP32 real e o tempo até a gravação continuam pendentes.
> - **CT02 (injeção de pH 4,5).** Não foi executado: depende do serviço de alertas.
> - **CT06 (aceitação com o aquarista).** O painel está pronto para a tarefa de visualização. O alerta de teste no celular depende do serviço de alertas. **[AUTORES: executar com um usuário real e registrar.]**

---

## 6. Seção 6.12 — Cronograma

Linha a acrescentar à tabela do cronograma:

| Período | Entregas principais |
|---|---|
| Outubro de 2026 (07 a 10/10) | Realizado: painel web com dados simulados (07/10); adaptação ao serviço de ML e API HTTP com cadastro do UC01 e comando do aerador (09/10); identidade visual, tema escuro e PWA (10/10). Pendente: alertas, WebSocket, testes em aparelhos reais e CT06 |

Fonte: datas registradas em `docs/AUDITORIA_FRONTEND.md` (§10 a §16).

---

## 7. Seções 8.1 e 8.3 — Arquitetura e *stack*

**8.1, Camada de Apresentação.** Substituir a frase sobre o *dashboard* por:

> Camada de Apresentação: painel web em React, instalável como PWA, consumindo a API REST com atualização a cada 30 segundos; alertas por WhatsApp (N8N e Evolution API) previstos e não implementados até 10/10/2026.

**8.3, Tabela 10.** Linhas a atualizar:

| Componente | Tecnologia |
|---|---|
| Back-end | Implementado: Python 3.11, paho-mqtt, Pydantic 2, SQLAlchemy 2 e Alembic (ingestão); FastAPI, Uvicorn e PyJWT (API REST). Previsto e não implementado: WebSocket (Socket.IO) |
| Dashboard | Implementado: React 18, TypeScript, Vite, Tailwind CSS 4, Recharts, TanStack Query 5, React Hook Form e Zod; PWA com vite-plugin-pwa (Workbox) e IndexedDB (idb-keyval). Previsto e não implementado: Socket.IO |
| Testes do painel | Vitest, Testing Library e MSW |

---

## 8. Resultados — painel web e API

Texto de abertura da nova seção do capítulo de resultados:

> Esta seção apresenta os resultados das verificações do painel web e da API realizadas entre 07 e 10/10/2026.

Tabela A — Verificações automatizadas

| Verificação | Ferramenta | Resultado |
|---|---|---|
| Tipos (TypeScript estrito) | `tsc` | Sem erros (10/10) |
| Regras de código e de acessibilidade | ESLint com jsx-a11y | Sem erros (10/10) |
| Testes do painel | Vitest | 33 de 33 aprovados, em 5 arquivos (10/10) |
| Testes da ingestão e da API | pytest | 98 de 98 aprovados: 24 já existentes no repositório e 74 da API (09/10) |
| *Build* de produção | Vite | Sem erros; cerca de 135 kB de JavaScript comprimido na abertura, para um orçamento de 200 kB (10/10) |
| *Precache* do PWA | Workbox | 48 arquivos, cerca de 1 MB (10/10) |

Fonte: `docs/AUDITORIA_FRONTEND.md`, §14.3, §15.5 e §16.3.

Tabela B — Responsividade e alvos de toque (*viewport* simulado no navegador)

| Medida | Resultado |
|---|---|
| Telas medidas × larguras | 11 telas × 7 larguras (320, 375, 390, 430, 768, 1024 e 1440 px) |
| Telas com rolagem horizontal | 0 |
| Textos cortados | 0 |
| Alvos de toque abaixo de 44 px nas larguras de celular (toque emulado) | 0 |

Fonte: `docs/AUDITORIA_FRONTEND.md`, §15.5. Em 768 e 1024 px o navegador de teste emulou mouse, e os alvos de toque não foram medidos nessas larguras. Nenhuma medição foi feita em aparelho real.

Tabela C — Integração do painel com a API real (ambiente local)

| Fluxo verificado | Resultado | Data |
|---|---|---|
| Login, renovação da sessão pelo *cookie* e saída | Funcionou | 09/10 |
| Início, detalhe do tanque, previsão e histórico de 24 h e de 7 dias | Funcionou | 09/10 |
| Cadastro de tanque com MAC repetido (erro no campo) e depois com MAC novo | Funcionou | 09/10 |
| Edição de tanque, status de sensor e segundo dispositivo | Funcionou | 09/10 |
| Leitura publicada por MQTT (simulador), processada pela ingestão e exibida no painel | Funcionou: o nó apareceu *online* | 09/10 |
| Comando do aerador: ligar e desligar; o nó simulado recebeu os comandos e, ao reconectar, o último comando retido | Funcionou | 09/10 |
| *Broker* parado: resposta 503 sem registro; *broker* de volta: resposta 202 | Funcionou | 09/10 |

Fonte: `docs/AUDITORIA_FRONTEND.md`, §12.3, §13.3 e §14.3.

Tabela D — PWA (Chrome 154 sem interface, *build* de produção e API local)

| Verificação | Resultado |
|---|---|
| Erros no manifesto | 0 |
| Erros nos critérios de instalação | 0 |
| *Service worker* | Ativo e controlando a página |
| Cópia local após o login | 3 tanques salvos |
| Abertura com o servidor parado e a rede desligada | A aplicação abriu do *precache* e mostrou "Última leitura salva", com o horário e o aviso; sem rolagem horizontal em 390 px |
| Volta da conexão | Entrou de novo sem pedir login |
| Convite de instalação | Apareceu na 2ª visita e sumiu com "Agora não" |
| Saída da conta | Cópia local e respostas guardadas apagadas |

Fonte: `docs/AUDITORIA_FRONTEND.md`, §16.3. O teste foi feito no computador, com a rede emulada; a instalação e o uso sem internet não foram testados em celular.

Figuras sugeridas, de dados de teste locais e fictícios, em largura de 390 px:

- **Figura — Painel aberto sem conexão, com a última leitura salva:** [`figuras/pwa-ultima-leitura-390.png`](figuras/pwa-ultima-leitura-390.png). Fonte: elaborada pelos autores.
- **Figura — Início do painel com o convite de instalação:** [`figuras/pwa-convite-instalacao-390.png`](figuras/pwa-convite-instalacao-390.png). Fonte: elaborada pelos autores.

**[AUTORES: se preferirem, trocar por capturas do sistema com dados reais do protótipo.]**

Tabela E — Situação dos requisitos ligados ao painel e à API (linhas para a tabela de situação dos requisitos)

| Item | Situação em 10/10/2026 | Evidência |
|---|---|---|
| RF04 / RF05 — exibição do risco e da previsão | O painel exibe o nível e a previsão de 1 a 3 h gravados pelo serviço de ML | Tabela C |
| RF06 — alerta via WhatsApp | Não implementado | — |
| RF07 — dashboard e cadastro de tanques | Implementado; atualização a cada 30 s, sem WebSocket | Tabelas Y e C |
| RNF02 — 24 h em menos de 3 s | Não medido | — |
| RNF05 — JWT e credenciais em variáveis de ambiente | Implementado na API e no painel | Seção 6.9; testes de autenticação |
| RNF06 — responsivo de 320 a 1920 px (PWA) e mensagens em português | Responsividade medida de 320 a 1440 px em *viewport* simulado; PWA instalável e com abertura sem conexão; não testado em aparelho real | Tabelas B e D |
| UC01 — cadastrar tanque e dispositivo | Implementado no painel e na API | Tabela C |
| UC02 — visualizar o dashboard | Implementado, com consulta a cada 30 s em vez de WebSocket a cada 5 s | Seção 6.9 |
| UC03 — consultar histórico | Implementado, com exportação em CSV e relatório para impressão | Tabela Y |

Fonte: elaborada pelos autores.

---

## 9. Apêndice D — Repositórios e código-fonte

Texto a acrescentar:

> O código do painel web está no repositório `https://github.com/Patokaz/front-end-tcc` (pasta `frontend`). O mesmo repositório traz o contrato da API, em `docs/CONTRATO_API.md`, e o registro das decisões do front-end, em `docs/AUDITORIA_FRONTEND.md`. A API HTTP está na pasta `api-backend`, como *patch* para o repositório `sistema-tcc-completo`; o *patch* do firmware para o comando do aerador, ainda não compilado nem gravado na placa, também está nessa pasta.

**[AUTORES: depois de aplicar o patch, apontar para `backend/src/api` no repositório `sistema-tcc-completo`.]**

---

## 10. Declaração de Uso de IA — linhas para o Quadro 1

| Ferramenta e desenvolvedor | Versão / checkpoint | Seção afetada | Finalidade específica | Intervenção humana pós-geração (%) |
|---|---|---|---|---|
| Claude (Anthropic), via Claude Code (aplicativo para computador) | `claude-opus-5-5` **[AUTORES: confirmar no histórico do Claude Code]**; 07 a 10/10/2026 | Painel web: seções 6.9, 6.10, 8.1 e 8.3, resultados do painel e Apêndice D | Codificação: auditoria dos requisitos frente ao Figma e ao back-end; implementação do front-end em React; testes automatizados; identidade visual; PWA; documentação técnica do repositório | **[AUTORES]** |
| Claude (Anthropic), via Claude Code | Mesma versão; 09/10/2026 | API HTTP e firmware do aerador: seção 6.9, resultados da API e Apêndice D | Codificação: API em FastAPI, testes com pytest e *patch* do firmware para o comando do aerador (não compilado nem gravado na placa) | **[AUTORES]** |
| Claude (Anthropic), via Claude Code | Mesma versão; 10/10/2026 | Textos das seções 6.3, 6.9 a 6.13, 8.1, 8.3, resultados do painel e da API e Apêndice D | Redação de descrição técnica e organização em tabelas dos resultados registrados no repositório; sem análise nem conclusões | **[AUTORES]** |

No item 3 da Declaração (prompts e saídas arquivados), os registros deste trabalho são o histórico de sessões do Claude Code e o arquivo `docs/AUDITORIA_FRONTEND.md`.

---

## 11. Bibliografia

Referência citada nos textos acima:

> W3C. **Web Content Accessibility Guidelines (WCAG) 2.2**. W3C Recommendation, 5 out. 2023. Disponível em: https://www.w3.org/TR/WCAG22/. Acesso em: 10 out. 2026.

**[AUTORES: conferir a referência na fonte e o formato da NBR 6023, como exige a Declaração de IA.]**

---

## 12. O que ainda falta para fechar estas seções

| Pendência | Quem resolve | Observação |
|---|---|---|
| Medir o RNF02 (24 h em menos de 3 s) | Pode ser feito agora | Com a API local e 24 h de dados; o documento de arquitetura do front-end sugere o Lighthouse em modo móvel com rede 4G simulada |
| Executar o CT01 com o ESP32 real | Grupo | Precisa do nó ligado ao mesmo *broker* da API |
| Executar o CT06 com um usuário real | Grupo | A parte de alerta depende do serviço de alertas |
| Decidir o escopo dos alertas (N8N e WhatsApp) | Grupo e orientador | Afeta as seções 3, 6.3, a análise dos resultados e as conclusões |
| Testar a instalação e o uso sem internet em Android e iPhone | Grupo | Até agora só houve teste com a rede emulada no computador |
| Aplicar o *patch* da API e compilar o firmware do aerador | Grupo | Ver `api-backend/LEIA-ME.md` |
