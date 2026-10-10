import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Usuario } from '@/dominio/entidades'
import { buscarUsuarioAtual, entrar, sair } from '@/infra/api/autenticacao'
import { sessao } from '@/infra/api/sessao'

type EstadoSessao =
  | { status: 'verificando' }
  | { status: 'anonimo'; expirada?: boolean }
  | { status: 'autenticado'; usuario: Usuario }

interface ContextoAutenticacao {
  estado: EstadoSessao
  entrar: (dados: { email: string; senha: string; lembrar: boolean }) => Promise<void>
  sair: () => Promise<void>
  atualizarUsuario: (usuario: Usuario) => void
}

const Contexto = createContext<ContextoAutenticacao | null>(null)

export function ProvedorAutenticacao({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [estado, setEstado] = useState<EstadoSessao>({ status: 'verificando' })

  // Ao abrir o app, tenta restaurar a sessão pelo cookie de renovação (o token não fica salvo no navegador).
  useEffect(() => {
    let ativo = true
    void (async () => {
      const renovada = await sessao.renovar()
      if (!renovada) {
        if (ativo) setEstado({ status: 'anonimo' })
        return
      }
      try {
        const usuario = await buscarUsuarioAtual()
        if (ativo) setEstado({ status: 'autenticado', usuario })
      } catch {
        if (ativo) setEstado({ status: 'anonimo' })
      }
    })()
    return () => {
      ativo = false
    }
  }, [])

  useEffect(
    () =>
      sessao.aoExpirar(() => {
        queryClient.clear()
        setEstado({ status: 'anonimo', expirada: true })
      }),
    [queryClient],
  )

  const fazerLogin = useCallback(async (dados: { email: string; senha: string; lembrar: boolean }) => {
    await entrar(dados)
    const usuario = await buscarUsuarioAtual()
    setEstado({ status: 'autenticado', usuario })
  }, [])

  const fazerLogout = useCallback(async () => {
    try {
      await sair()
    } catch {
      // Mesmo sem resposta do servidor, a sessão local é encerrada.
    } finally {
      queryClient.clear()
      setEstado({ status: 'anonimo' })
    }
  }, [queryClient])

  const atualizarUsuario = useCallback((usuario: Usuario) => setEstado({ status: 'autenticado', usuario }), [])

  const valor = useMemo(
    () => ({ estado, entrar: fazerLogin, sair: fazerLogout, atualizarUsuario }),
    [estado, fazerLogin, fazerLogout, atualizarUsuario],
  )
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useAutenticacao() {
  const contexto = useContext(Contexto)
  if (!contexto) throw new Error('useAutenticacao precisa estar dentro de <ProvedorAutenticacao>')
  return contexto
}

/** Usuário logado — só use dentro de rotas protegidas. */
export function useUsuario(): Usuario {
  const { estado } = useAutenticacao()
  if (estado.status !== 'autenticado') throw new Error('useUsuario usado fora de uma rota protegida')
  return estado.usuario
}
