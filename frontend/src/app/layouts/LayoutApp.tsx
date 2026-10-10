import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useMatches } from 'react-router'
import { ChevronDown, LogOut, Settings, UserRound, Waves, WifiOff } from 'lucide-react'
import { cn } from '@/compartilhado/cn'
import { formatarDataHora, formatarHora, primeiroNome } from '@/compartilhado/formatacao'
import { useOnline } from '@/compartilhado/hooks'
import { ROTULO_PERFIL } from '@/dominio/rotulos'
import { Aviso } from '@/ui/Estados'
import { Etiqueta } from '@/ui/Selos'
import { useUltimaAtualizacao } from '../consultas/cliente'
import { useAlertasAtivos } from '../consultas/monitoramento'
import { useAutenticacao, useUsuario } from '../funcionalidades/autenticacao/ProvedorAutenticacao'
import { itemAtivo, MENU_INFERIOR, MENU_LATERAL, type ItemNavegacao } from './navegacao'

const DADOS_SIMULADOS = import.meta.env.VITE_USAR_MOCKS === 'true'

export function Marca({ claro }: { claro?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-3 rounded-lg">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primaria-solida text-white">
        <Waves aria-hidden className="size-5" />
      </span>
      <span className="leading-tight">
        <span className={cn('block font-semibold', claro ? 'text-white' : 'text-tinta')}>Painel Aquícola</span>
        <span className={cn('block text-xs', claro ? 'text-white/75' : 'text-tinta-suave')}>Monitoramento Inteligente</span>
      </span>
    </Link>
  )
}

function ContadorAlertas({ compacto }: { compacto?: boolean }) {
  const { data } = useAlertasAtivos()
  const total = data?.total ?? 0
  if (!total) return null
  return (
    <span
      className={cn(
        'flex items-center justify-center rounded-full bg-critico-solido font-semibold text-white tabular-nums',
        compacto ? 'absolute -top-1 left-1/2 ml-1.5 h-4 min-w-4 px-1 text-[10px]' : 'ml-auto h-5 min-w-5 px-1.5 text-xs',
      )}
    >
      {total}
      <span className="sr-only"> {total === 1 ? 'alerta ativo' : 'alertas ativos'}</span>
    </span>
  )
}

function ItemMenuLateral({ item, caminho }: { item: ItemNavegacao; caminho: string }) {
  const ativo = itemAtivo(item, caminho)
  const Icone = item.icone
  return (
    <li>
      <Link
        to={item.para}
        aria-current={ativo ? 'page' : undefined}
        className={cn(
          'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors',
          ativo ? 'bg-menu-ativo text-white' : 'text-tinta hover:bg-neutro-fundo',
        )}
      >
        <Icone aria-hidden className="size-5" />
        {item.rotulo}
        {item.contadorAlertas && <ContadorAlertas />}
      </Link>
    </li>
  )
}

function MenuUsuario({ alinhamento }: { alinhamento: 'cima' | 'baixo' }) {
  const usuario = useUsuario()
  const { sair } = useAutenticacao()
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return
    const fechar = (evento: Event) => {
      if (evento instanceof KeyboardEvent ? evento.key === 'Escape' : !ref.current?.contains(evento.target as Node)) {
        setAberto(false)
      }
    }
    document.addEventListener('pointerdown', fechar)
    document.addEventListener('keydown', fechar)
    return () => {
      document.removeEventListener('pointerdown', fechar)
      document.removeEventListener('keydown', fechar)
    }
  }, [aberto])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={aberto}
        aria-haspopup="menu"
        onClick={() => setAberto((a) => !a)}
        className={cn(
          'flex min-h-11 items-center gap-3 rounded-xl text-left',
          alinhamento === 'cima' ? 'w-full bg-neutro-fundo p-3 hover:bg-borda' : 'justify-center px-2',
        )}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-superficie text-tinta-suave ring-1 ring-borda">
          <UserRound aria-hidden className="size-5" />
        </span>
        <span className={cn('min-w-0 flex-1', alinhamento === 'baixo' && 'sr-only')}>
          <span className="block truncate text-sm font-semibold">Olá, {primeiroNome(usuario.nome)}</span>
          <span className="block text-xs text-tinta-suave">{ROTULO_PERFIL[usuario.perfil]}</span>
        </span>
        <ChevronDown aria-hidden className={cn('size-4 text-tinta-suave', alinhamento === 'baixo' && 'hidden')} />
      </button>
      {aberto && (
        <div
          role="menu"
          className={cn(
            'absolute z-30 w-56 rounded-xl border border-borda bg-superficie p-1.5 shadow-lg',
            alinhamento === 'cima' ? 'bottom-full left-0 mb-2' : 'top-full right-0 mt-2',
          )}
        >
          <p className="px-3 py-2 text-xs text-tinta-suave">
            {usuario.nome}
            <br />
            {usuario.email}
          </p>
          <Link
            role="menuitem"
            to="/configuracoes"
            onClick={() => setAberto(false)}
            className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm hover:bg-neutro-fundo"
          >
            <Settings aria-hidden className="size-4" />
            Configurações
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={() => void sair()}
            className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-sm text-critico hover:bg-critico-fundo"
          >
            <LogOut aria-hidden className="size-4" />
            Sair
          </button>
        </div>
      )}
    </div>
  )
}

function CartaoConexao() {
  const online = useOnline()
  const ultima = useUltimaAtualizacao()
  return (
    <div className="rounded-xl bg-neutro-fundo p-3 text-center text-xs">
      <p className="flex items-center justify-center gap-2 text-sm font-semibold">
        <span aria-hidden className={cn('size-2 rounded-full', online ? 'bg-otimo' : 'bg-critico')} />
        {online ? 'Conectado' : 'Sem conexão'}
      </p>
      {ultima && (
        <p className="mt-1 text-tinta-suave">
          Última atualização:
          <br />
          {formatarDataHora(ultima)}
        </p>
      )}
      {DADOS_SIMULADOS && (
        <Etiqueta tom="info" className="mt-2">
          Dados simulados
        </Etiqueta>
      )}
    </div>
  )
}

function AvisoSemConexao() {
  const online = useOnline()
  const ultima = useUltimaAtualizacao()
  if (online) return null
  return (
    <Aviso tom="neutro" icone={WifiOff} titulo="Você está sem conexão." className="mb-4">
      {ultima ? `Mostrando os dados de ${formatarHora(ultima)}. ` : ''}
      Os valores serão atualizados quando a internet voltar.
    </Aviso>
  )
}

export function LayoutApp() {
  const { pathname } = useLocation()
  const matches = useMatches()
  const titulo = [...matches].reverse().find((m) => (m.handle as { titulo?: string } | undefined)?.titulo)
  const tituloPagina = (titulo?.handle as { titulo?: string } | undefined)?.titulo ?? 'Painel Aquícola'

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="min-h-dvh lg:flex">
      <a
        href="#conteudo"
        className="sr-only z-50 rounded-lg bg-primaria-solida px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Pular para o conteúdo
      </a>

      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-borda bg-superficie p-4 lg:flex print:hidden">
        <Marca />
        <nav aria-label="Menu principal" className="mt-8 flex-1 overflow-y-auto">
          <ul className="space-y-1">
            {MENU_LATERAL.map((item) => (
              <ItemMenuLateral key={item.para} item={item} caminho={pathname} />
            ))}
          </ul>
        </nav>
        <div className="space-y-3">
          <MenuUsuario alinhamento="cima" />
          <CartaoConexao />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-borda bg-superficie/95 px-4 backdrop-blur lg:hidden print:hidden">
          <p className="text-base font-semibold">{tituloPagina}</p>
          <div className="flex items-center gap-2">
            {DADOS_SIMULADOS && <Etiqueta tom="info">Simulado</Etiqueta>}
            <MenuUsuario alinhamento="baixo" />
          </div>
        </header>

        <main id="conteudo" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 pt-4 pb-28 sm:px-6 lg:px-8 lg:py-8 print:p-0">
          <AvisoSemConexao />
          <Outlet />
        </main>
      </div>

      <nav
        aria-label="Menu principal"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-borda bg-superficie pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-4">
          {MENU_INFERIOR.map((item) => {
            const ativo = itemAtivo(item, pathname)
            const Icone = item.icone
            return (
              <li key={item.para}>
                <Link
                  to={item.para}
                  aria-current={ativo ? 'page' : undefined}
                  className={cn(
                    'flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-semibold',
                    ativo ? 'text-primaria' : 'text-tinta-suave',
                  )}
                >
                  <span className="relative">
                    <Icone aria-hidden className="size-6" />
                    {item.contadorAlertas && <ContadorAlertas compacto />}
                  </span>
                  {item.rotulo}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}

