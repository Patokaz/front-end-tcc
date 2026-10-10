import { useSyncExternalStore } from 'react'
import { QueryCache, QueryClient } from '@tanstack/react-query'
import { ErroApi, type TipoErro } from '@/infra/api/erros'

/**
 * Enquanto o WebSocket (Socket.IO) não existe no backend, os dados "ao vivo" são
 * atualizados por sondagem — o mesmo modo de contingência previsto no TC2 (§14).
 * As leituras chegam a cada 60 s (RF01), então 30 s mantém a tela no máximo meio ciclo atrasada.
 */
export const INTERVALO_ATUALIZACAO_MS = 30_000

let ultimaAtualizacao: number | null = null
const ouvintes = new Set<() => void>()

function registrarAtualizacao() {
  ultimaAtualizacao = Date.now()
  ouvintes.forEach((ouvinte) => ouvinte())
}

/** Momento do último dado recebido com sucesso da API (cartão "Conectado — Última atualização"). */
export function useUltimaAtualizacao(): number | null {
  return useSyncExternalStore(
    (aoMudar) => {
      ouvintes.add(aoMudar)
      return () => ouvintes.delete(aoMudar)
    },
    () => ultimaAtualizacao,
  )
}

const ERROS_SEM_NOVA_TENTATIVA: TipoErro[] = [
  'nao_encontrado',
  'proibido',
  'sessao_expirada',
  'credenciais',
  'validacao',
  'indisponivel',
  'resposta_invalida',
]

export function criarClienteQuery() {
  return new QueryClient({
    queryCache: new QueryCache({ onSuccess: registrarAtualizacao }),
    defaultOptions: {
      queries: {
        staleTime: 20_000,
        retry: (falhas, erro) =>
          falhas < 2 && !(erro instanceof ErroApi && ERROS_SEM_NOVA_TENTATIVA.includes(erro.tipo)),
      },
      mutations: { retry: false },
    },
  })
}
