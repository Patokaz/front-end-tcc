import { respostaToken } from '@/dominio/entidades'
import { montarUrl, TEMPO_LIMITE_MS } from './url'

/**
 * Token de acesso mantido apenas em memória (RNF05): nunca vai para localStorage.
 * A renovação usa o cookie HttpOnly emitido pela API, que o front-end não consegue ler.
 */
let tokenAcesso: string | null = null
let renovacaoEmAndamento: Promise<boolean> | null = null
const ouvintesExpiracao = new Set<() => void>()

async function pedirRenovacao(): Promise<boolean> {
  try {
    const resposta = await fetch(montarUrl('/auth/refresh'), {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    })
    if (!resposta.ok) return false
    const dados = respostaToken.safeParse(await resposta.json())
    if (!dados.success) return false
    tokenAcesso = dados.data.access_token
    return true
  } catch {
    return false
  }
}

export const sessao = {
  token: () => tokenAcesso,

  definirToken(token: string | null) {
    tokenAcesso = token
  },

  /** Requisições concorrentes que recebem 401 aguardam a mesma renovação. */
  renovar(): Promise<boolean> {
    renovacaoEmAndamento ??= pedirRenovacao().finally(() => {
      renovacaoEmAndamento = null
    })
    return renovacaoEmAndamento
  },

  expirar() {
    tokenAcesso = null
    ouvintesExpiracao.forEach((ouvinte) => ouvinte())
  },

  aoExpirar(ouvinte: () => void) {
    ouvintesExpiracao.add(ouvinte)
    return () => {
      ouvintesExpiracao.delete(ouvinte)
    }
  },
}
