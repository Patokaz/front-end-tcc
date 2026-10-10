# Painel Aquícola — front-end

Dashboard web do **Sistema Inteligente de Monitoramento da Qualidade da Água em Tanques de Piscicultura** (TCC — Ciência da Computação, UNIP, 2026).

Mostra em tempo quase real as leituras de pH, temperatura, turbidez e oxigênio dissolvido estimado; a previsão de risco (ótimo, atenção ou crítico) para as próximas 1 a 3 horas; os alertas com recomendações; o histórico; e o cadastro de tanques e dispositivos (UC01).

> **Estado atual (09/10/2026):** a ingestão MQTT e o serviço de ML do backend gravam `leituras` e `previsoes`. A **API** (leitura, cadastro do UC01 e comando do aerador) está em [`../api-backend/`](../api-backend/LEIA-ME.md), pronta para entrar no repositório do backend. Por padrão o front-end roda com um **servidor simulado (MSW)**. Ele reproduz as regras do backend real (OD estimado em `h = 0` a cada 5 min, níveis pela regra de `faixas.py`, sensor em falha) e segue o contrato de [`../docs/CONTRATO_API.md`](../docs/CONTRATO_API.md). Para usar a API real, veja "Usar a API real".

## Requisitos

- Node.js **22.12 ou superior** (testado com 25.8)
- npm 10 ou superior

## Como rodar

```bash
npm install
npm run dev
```

Abra http://localhost:5173. O cartão no rodapé do menu mostra a etiqueta **"Dados simulados"**.

### Usuários de demonstração (somente no modo simulado)

| Perfil | E-mail | Senha |
|---|---|---|
| Administrador | `admin@painelaquicola.test` | `aquicola-demo` |
| Produtor (operador) | `produtor@painelaquicola.test` | `aquicola-demo` |

Os cadastros feitos na demonstração ficam salvos no navegador. Para voltar aos dados iniciais, rode no console do navegador:

```js
painelAquicola.restaurarDadosSimulados()
```

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento (com dados simulados) |
| `npm test` | Testes automatizados (Vitest + Testing Library + MSW) |
| `npm run lint` | ESLint, incluindo regras de acessibilidade (jsx-a11y) |
| `npm run build` | Build de produção (sem os dados simulados) |
| `npm run build:demo` | Build para apresentação, **com** os dados simulados |
| `npm run preview` | Serve o build localmente |

## Usar a API real

1. Suba a API no backend, como descreve [`../api-backend/LEIA-ME.md`](../api-backend/LEIA-ME.md): `python -m src.api`, depois de criar um usuário com `python -m src.api.usuarios`.
2. Copie `.env.example` para `.env.development.local`.
3. Defina `VITE_USAR_MOCKS=false` e `API_PROXY_ALVO=http://127.0.0.1:8000`.
4. Rode `npm run dev`. O Vite repassa `/api` para o backend na mesma origem; assim o cookie de renovação funciona sem configurar CORS. Entre com o usuário criado no passo 1. Os usuários de demonstração só existem no modo simulado.

Em produção, sirva o `dist/` e a API no mesmo domínio por um proxy reverso (Nginx/Traefik), com `/api` apontando para o FastAPI.

## Tecnologias

React 18 · Vite · TypeScript (strict) · TailwindCSS 4 · React Router 7 · TanStack Query 5 · React Hook Form + Zod · Recharts · lucide-react · MSW (dados simulados e testes) · Vitest + Testing Library.

## Estrutura (camadas do Figma "Decisões de UX")

```
src/
  app/                    Aplicação: rotas, layout, provedores e telas
    funcionalidades/      autenticacao · tanques · historico · previsao · alertas · eventos · admin · ajustes
    componentes/          componentes compostos usados por várias telas (cartão de tanque, gráficos, alertas…)
    consultas/            hooks de dados (TanStack Query) e chaves de cache
  dominio/                tipos e esquemas Zod das entidades, regras de exibição, validações do UC01
  infra/                  cliente HTTP (sessão, renovação, erros), armazenamento local
  ui/                     componentes visuais do Figma (botão, campos, selos, cartões, gráfico…)
  compartilhado/          formatação pt-BR, períodos, hooks utilitários
  mocks/                  servidor simulado — temporário, fora do build de produção
```

Regras que orientam o código:

- **O front-end não classifica risco.** O nível vem pronto do serviço de ML (via API); a interface só o traduz em frase, cor, ícone e texto.
- **Toda resposta da API é validada** com Zod. Uma mudança de contrato vira a mensagem "resposta inesperada", em vez de tela quebrada.
- **Erros técnicos nunca aparecem ao usuário.** O cliente HTTP converte rede indisponível, tempo esgotado, 401/403/404/409/422/5xx em mensagens em português.
- **Token só em memória (RNF05)**, com renovação pelo cookie HttpOnly e uma única tentativa de renovação, mesmo com várias requisições recebendo 401 ao mesmo tempo.
- **Cor nunca é o único sinal:** todo status tem ícone e texto.

## Acessibilidade e responsividade

- Layouts de 320 px a 1920 px. No computador, barra lateral; no celular e tablet, barra inferior, como no Figma.
- Alvos de toque de 44 px no mínimo; foco visível; link "Pular para o conteúdo".
- Rótulos ligados aos campos, erros anunciados por leitor de tela, `prefers-reduced-motion` respeitado.
- Preferências "Modo avançado" e "Linguagem simples" em Configurações.

## Limitações conhecidas

- **Tempo real:** sem WebSocket no backend, os dados são atualizados a cada 30 s (contingência prevista no TC2). A troca por Socket.IO fica isolada na camada de consultas.
- **PWA (instalação e modo offline):** previsto para a etapa seguinte.
- **Navegadores embutidos sem suporte a Service Worker** (ex.: painel de pré-visualização do Claude Desktop): o servidor simulado passa sozinho para um modo de compatibilidade. O console mostra o aviso do registro recusado, que não ocorre no Chrome, Edge ou Firefox.
- **Alertas e eventos:** o sub-projeto 4 (N8N) ainda não existe no backend; com a API real essas telas ficam vazias até lá.
- **Aerador:** o painel mostra o **último comando enviado**, não o estado real do relé: o nó ainda não confirma. O comando só chega ao relé com o firmware v3 (`../api-backend/firmware-aerador.patch`).
- As decisões pendentes estão em [`../docs/AUDITORIA_FRONTEND.md`](../docs/AUDITORIA_FRONTEND.md) (§10 e §11).
