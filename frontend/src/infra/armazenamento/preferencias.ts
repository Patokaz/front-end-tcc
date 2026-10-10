export interface Preferencias {
  /** Mostra faixas ideais, confiança da previsão e detalhes técnicos dos dispositivos. */
  modoAvancado: boolean
  /** Troca termos técnicos por explicações do dia a dia. */
  linguagemSimples: boolean
  explicacaoOdDispensada: boolean
}

const CHAVE = 'painel-aquicola:preferencias'

export const PREFERENCIAS_PADRAO: Preferencias = {
  modoAvancado: false,
  linguagemSimples: false,
  explicacaoOdDispensada: false,
}

// Preferência de interface por aparelho: o armazenamento pode falhar (aba anônima) sem quebrar a tela.
export function lerPreferencias(): Preferencias {
  try {
    const salvo = localStorage.getItem(CHAVE)
    return salvo ? { ...PREFERENCIAS_PADRAO, ...(JSON.parse(salvo) as Partial<Preferencias>) } : PREFERENCIAS_PADRAO
  } catch {
    return PREFERENCIAS_PADRAO
  }
}

export function salvarPreferencias(preferencias: Preferencias) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(preferencias))
  } catch {
    // segue funcionando só nesta sessão
  }
}
