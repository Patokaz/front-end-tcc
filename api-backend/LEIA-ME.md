# API do painel para o repositório do backend

Entrega para o repositório `sistema-tcc-completo` (sub-projeto 5, parte HTTP). É uma FastAPI com login.

- **Leitura:** entrega ao painel o que a ingestão MQTT e o serviço de ML gravam no banco.
- **Cadastro (UC01):** tanques, dispositivos e status dos sensores, só para administradores.
- **Pendente:** o comando do aerador.

| Arquivo | Para quem |
|---|---|
| `api-minima.patch` | **Repositório ainda sem a API**: tudo de uma vez (leitura + cadastro) |
| `uc01-cadastro.patch` | **Quem já aplicou a 1ª entrega** (API de leitura, 09/10): só o cadastro do UC01 |
| `arquivos/` | Os mesmos arquivos, na estrutura do repositório, para ler ou copiar |
| `arquivos/backend/API.md` | Documentação da API: como rodar, rotas, regras, pendências |

## Antes de aplicar

A API usa o modelo `Previsao` da **Tarefa 1 do ML**, que no repositório recebido ainda não estava commitada (ver `RETOMAR-AQUI.md`). Commite a Tarefa 1 primeiro. Os patches também aplicam sobre ela ainda não commitada; foram testados assim.

## Aplicar

Da raiz do `sistema-tcc-completo`, escolha **um** dos dois:

```powershell
# repositório ainda sem a API
git apply --check "C:\Users\Raphael\Desktop\frontend tcc\api-backend\api-minima.patch"
git apply "C:\Users\Raphael\Desktop\frontend tcc\api-backend\api-minima.patch"
```

```powershell
# já aplicou a 1ª entrega
git apply --check "C:\Users\Raphael\Desktop\frontend tcc\api-backend\uc01-cadastro.patch"
git apply "C:\Users\Raphael\Desktop\frontend tcc\api-backend\uc01-cadastro.patch"
```

Sem git: copie a pasta `arquivos\backend` por cima da pasta `backend` do repositório. `requirements.txt` e `.env.example` são substituídos inteiros; se tiverem mudado desde 09/10, junte as linhas à mão.

Commits sugeridos, no padrão do repositório. Para quem aplica tudo de uma vez:

```powershell
git add backend/requirements.txt backend/.env.example
git commit -m "adiciona dependencias e variaveis da api http"
git add backend/tests/api
git commit -m "adiciona testes da api http do painel"
git add backend/src/api
git commit -m "implementa api http do painel com leitura e cadastro do uc01"
git add backend/API.md
git commit -m "documenta a api http do painel"
```

Para quem já tinha a 1ª entrega:

```powershell
git add backend/tests/api
git commit -m "adiciona testes do cadastro de tanques e dispositivos"
git add backend/src/api
git commit -m "implementa cadastro de tanques, dispositivos e sensores (uc01)"
git add backend/API.md
git commit -m "documenta as rotas de cadastro da api"
```

## Rodar

1. `pip install -r requirements.txt` (entram `fastapi`, `uvicorn`, `pyjwt` e `httpx`).
2. No `.env`, preencha `API_JWT_SEGREDO` com a saída de `python -c "import secrets; print(secrets.token_urlsafe(48))"`.
3. Crie um administrador: `python -m src.api.usuarios --email voce@exemplo.com --nome "Seu Nome" --perfil admin` (a senha é pedida no terminal).
4. Suba a API: `python -m src.api`. Ela fica em `http://127.0.0.1:8000`, com a documentação em `/api/v1/docs`.
5. Rode também a ingestão (`python -m src.main`) e o serviço de ML.
6. No front-end, crie `frontend\.env.development.local` com:

   ```
   VITE_USAR_MOCKS=false
   API_PROXY_ALVO=http://127.0.0.1:8000
   ```

   Depois rode `npm run dev` e abra http://localhost:5173.

## O que foi verificado

- `pytest`: **89 testes passando**, os 24 da equipe e 65 da API. Rodaram contra TimescaleDB 2.27 / PostgreSQL 18 em Docker, com o DDL do Apêndice A e as migrações até `b27bf3423478`.
- Os dois patches foram aplicados em cópias limpas do repositório recebido. Dão o mesmo resultado, e os testes passam.
- No navegador, com o front ligado à API real:
  - **Cadastro do UC01:** tanque com dispositivo; MAC repetido destacado no próprio campo; edição do tanque; segundo dispositivo; edição de dispositivo (com conflito de MAC); status de sensor.
  - **Ciclo completo:** o nó cadastrado pela tela recebeu uma leitura MQTT pela ingestão da equipe (`python -m src.main`) e apareceu online no painel.
  - **Leitura:** login, painel, previsão, histórico, configurações e saída.

## 3ª entrega: comando do aerador (09/10)

- `api-minima.patch` foi atualizado: agora traz tudo (leitura + UC01 + aerador).
- `aerador-api.patch`: só o aerador, para quem já aplicou a 1ª e a 2ª entrega.
- `firmware-aerador.patch`: para o repositório **`sistema`** (firmware v3). Aplicar da raiz dele com `git apply`. Ainda **não foi compilado nem gravado na placa**: testar na bancada antes de usar (ver "Comando do aerador" no README do firmware).
- Commit sugerido no backend: `git add backend/src/db/models.py backend/alembic/env.py backend/src/api backend/tests/api backend/API.md` e `git commit -m "implementa comando do aerador pelo painel (f-02)"`.
- Verificado: 98 testes no backend, 29 no front. De ponta a ponta com a API real: ligar e desligar pela tela; o nó simulado recebeu os comandos e o retido ao reconectar; broker fora do ar resultou em 503 sem registro.
