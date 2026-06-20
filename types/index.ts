export type RoleType =
  | 'gestor_equipe'
  | 'gestor_financeiro'
  | 'tecnologia'
  | 'filmmaker'
  | 'design_grafico'

export type StatusCliente = 'prospecto' | 'ativo' | 'inativo'
export type StatusProjeto = 'planejamento' | 'em_andamento' | 'concluido' | 'cancelado'
export type StatusTarefa = 'a_fazer' | 'em_andamento' | 'concluido'
export type TipoLancamento = 'receita' | 'despesa'

export interface Profile {
  id: string
  user_id: string
  nome: string
  cargo: string | null
  role: RoleType
  avatar_url: string | null
  created_at: string
}

export interface Cliente {
  id: string
  nome: string
  cnpj_cpf: string | null
  email: string | null
  telefone: string | null
  segmento: string | null
  status: StatusCliente
  valor_contrato: number | null
  criado_por: string | null
  created_at: string
}

export interface ClientePublico {
  id: string
  nome: string
  email: string | null
  telefone: string | null
  segmento: string | null
  status: StatusCliente
  created_at: string
}

export interface Interacao {
  id: string
  cliente_id: string
  descricao: string
  autor_id: string | null
  created_at: string
  autor?: Profile
}

export interface Projeto {
  id: string
  nome: string
  cliente_id: string | null
  responsavel_id: string | null
  status: StatusProjeto
  prazo: string | null
  descricao: string | null
  created_at: string
  cliente?: ClientePublico | null
  responsavel?: Profile | null
}

export interface Tarefa {
  id: string
  projeto_id: string
  titulo: string
  descricao: string | null
  status: StatusTarefa
  responsavel_id: string | null
  prazo: string | null
  horario_inicio: string | null
  ordem: number
  created_at: string
  responsavel?: Profile | null
}

export interface Comentario {
  id: string
  tarefa_id: string
  autor_id: string | null
  conteudo: string
  created_at: string
  autor?: Profile | null
}

export interface CategoriaFinanceiro {
  id: string
  nome: string
  tipo: TipoLancamento
  cor: string
}

export interface Lancamento {
  id: string
  tipo: TipoLancamento
  descricao: string
  valor: number
  categoria_id: string | null
  cliente_id: string | null
  projeto_id: string | null
  data_lancamento: string
  comprovante_url: string | null
  criado_por: string | null
  created_at: string
  categoria?: CategoriaFinanceiro | null
  cliente?: ClientePublico | null
  projeto?: Projeto | null
}

// ─── Supabase Database Types ──────────────────────────────────

export type Database = {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Omit<Profile, 'id' | 'created_at'>; Update: Partial<Profile> }
      clientes: { Row: Cliente; Insert: Omit<Cliente, 'id' | 'created_at'>; Update: Partial<Cliente> }
      interacoes: { Row: Interacao; Insert: Omit<Interacao, 'id' | 'created_at'>; Update: Partial<Interacao> }
      projetos: { Row: Projeto; Insert: Omit<Projeto, 'id' | 'created_at'>; Update: Partial<Projeto> }
      projeto_colaboradores: { Row: { projeto_id: string; profile_id: string }; Insert: { projeto_id: string; profile_id: string }; Update: never }
      tarefas: { Row: Tarefa; Insert: Omit<Tarefa, 'id' | 'created_at'>; Update: Partial<Tarefa> }
      comentarios: { Row: Comentario; Insert: Omit<Comentario, 'id' | 'created_at'>; Update: Partial<Comentario> }
      categorias_financeiro: { Row: CategoriaFinanceiro; Insert: Omit<CategoriaFinanceiro, 'id'>; Update: Partial<CategoriaFinanceiro> }
      lancamentos: { Row: Lancamento; Insert: Omit<Lancamento, 'id' | 'created_at'>; Update: Partial<Lancamento> }
    }
    Views: {
      clientes_publico: { Row: ClientePublico }
    }
    Functions: {
      get_my_role: { Args: Record<string, never>; Returns: RoleType }
      is_gestor: { Args: Record<string, never>; Returns: boolean }
      my_profile_id: { Args: Record<string, never>; Returns: string }
    }
    Enums: {
      role_type: RoleType
      status_cliente: StatusCliente
      status_projeto: StatusProjeto
      status_tarefa: StatusTarefa
      tipo_lancamento: TipoLancamento
    }
  }
}
