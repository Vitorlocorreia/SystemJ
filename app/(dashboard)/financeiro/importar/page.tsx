'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Upload, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useProfile } from '@/lib/hooks/useProfile'

interface Row {
  data: string
  descricao: string
  valor: number
  tipo: 'receita' | 'despesa'
  categoria: string
  cliente: string
  _status?: 'ok' | 'erro'
  _erro?: string
}

export default function ImportarPlanilhaPage() {
  const { profile } = useProfile()
  const [rows, setRows] = useState<Row[]>([])
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload')
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState({ ok: 0, erro: 0 })

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const data = e.target?.result
      const workbook = XLSX.read(data, { type: 'array', cellDates: true })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

      const parsed: Row[] = json.map((r) => {
        const raw = r as Record<string, unknown>
        const valor = parseFloat(String(raw['valor'] ?? raw['Valor'] ?? 0).replace(',', '.'))
        const tipo = String(raw['tipo'] ?? raw['Tipo'] ?? '').toLowerCase()

        let status: 'ok' | 'erro' = 'ok'
        let erro = ''

        if (!raw['descricao'] && !raw['Descrição'] && !raw['descricao']) {
          status = 'erro'; erro = 'Descrição ausente'
        } else if (isNaN(valor) || valor <= 0) {
          status = 'erro'; erro = 'Valor inválido'
        } else if (!['receita', 'despesa'].includes(tipo)) {
          status = 'erro'; erro = 'Tipo deve ser receita ou despesa'
        }

        return {
          data: String(raw['data'] ?? raw['Data'] ?? new Date().toISOString().split('T')[0]),
          descricao: String(raw['descricao'] ?? raw['Descrição'] ?? raw['descricao'] ?? ''),
          valor,
          tipo: (['receita', 'despesa'].includes(tipo) ? tipo : 'despesa') as 'receita' | 'despesa',
          categoria: String(raw['categoria'] ?? raw['Categoria'] ?? ''),
          cliente: String(raw['cliente'] ?? raw['Cliente'] ?? ''),
          _status: status,
          _erro: erro,
        }
      })

      setRows(parsed)
      setStep('preview')
    }
    reader.readAsArrayBuffer(file)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
    },
    multiple: false,
  })

  async function handleImport() {
    if (!profile) return
    setImporting(true)

    const supabase = createClient() as any
    const validRows = rows.filter(r => r._status === 'ok')
    let ok = 0, erro = 0

    for (const row of validRows) {
      const { error } = await supabase.from('lancamentos').insert({
        tipo: row.tipo,
        descricao: row.descricao,
        valor: row.valor,
        data_lancamento: row.data,
        criado_por: profile.id,
      })

      if (error) erro++; else ok++
    }

    setResults({ ok, erro })
    setStep('done')
    setImporting(false)
    toast.success(`${ok} lançamentos importados!`)
  }

  if (step === 'done') {
    return (
      <div className="space-y-6 animate-fade-in max-w-xl">
        <div className="flex items-center gap-3">
          <Link href="/financeiro" className="btn-ghost p-2 -ml-2"><ArrowLeft size={18} /></Link>
          <h1 className="font-display text-display-md text-text-primary">Importação Concluída</h1>
        </div>
        <div className="card text-center py-10 space-y-4">
          <CheckCircle size={48} className="mx-auto text-success" />
          <p className="font-display text-2xl font-bold text-text-primary">{results.ok} importados</p>
          {results.erro > 0 && <p className="text-danger text-sm">{results.erro} com erro</p>}
          <Link href="/financeiro" className="btn-primary inline-block mt-4">Ver lançamentos</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/financeiro" className="btn-ghost p-2 -ml-2"><ArrowLeft size={18} /></Link>
        <div>
          <h1 className="font-display text-display-md text-text-primary">Importar Planilha</h1>
          <p className="text-text-secondary text-sm mt-1">Excel (.xlsx) ou CSV com colunas: data, descrição, valor, tipo, categoria, cliente</p>
        </div>
      </div>

      {step === 'upload' && (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-all duration-200 ${
            isDragActive ? 'border-gold bg-gold-muted' : 'border-border hover:border-gold/40 hover:bg-surface-elevated'
          }`}
        >
          <input {...getInputProps()} />
          <Upload size={40} className={`mx-auto mb-4 ${isDragActive ? 'text-gold' : 'text-text-secondary'}`} />
          <p className="text-text-primary font-medium">Arraste o arquivo ou clique para selecionar</p>
          <p className="text-text-secondary text-sm mt-1">.xlsx, .xls ou .csv</p>
        </div>
      )}

      {step === 'preview' && rows.length > 0 && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-primary font-medium">{rows.length} linhas detectadas</p>
              <p className="text-xs text-text-secondary mt-0.5">
                {rows.filter(r => r._status === 'ok').length} válidas ·{' '}
                <span className="text-danger">{rows.filter(r => r._status === 'erro').length} com erro</span>
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep('upload')} className="btn-secondary text-sm">Trocar arquivo</button>
              <button onClick={handleImport} disabled={importing || rows.filter(r => r._status === 'ok').length === 0} className="btn-primary text-sm">
                {importing ? 'Importando...' : `Importar ${rows.filter(r => r._status === 'ok').length} lançamentos`}
              </button>
            </div>
          </div>

          <div className="card p-0 overflow-hidden max-h-[60vh] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-text-secondary font-medium uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-text-secondary font-medium uppercase tracking-wider">Data</th>
                  <th className="text-left px-4 py-3 text-text-secondary font-medium uppercase tracking-wider">Descrição</th>
                  <th className="text-left px-4 py-3 text-text-secondary font-medium uppercase tracking-wider">Tipo</th>
                  <th className="text-right px-4 py-3 text-text-secondary font-medium uppercase tracking-wider">Valor</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={`border-b border-border last:border-0 ${r._status === 'erro' ? 'bg-danger/5' : ''}`}>
                    <td className="px-4 py-3">
                      {r._status === 'ok'
                        ? <CheckCircle size={14} className="text-success" />
                        : <span className="flex items-center gap-1 text-danger"><AlertCircle size={14} />{r._erro}</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{r.data}</td>
                    <td className="px-4 py-3 text-text-primary">{r.descricao}</td>
                    <td className="px-4 py-3">
                      <span className={r.tipo === 'receita' ? 'text-success' : 'text-danger'}>
                        {r.tipo}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right font-display tabular-nums ${r.tipo === 'receita' ? 'text-success' : 'text-danger'}`}>
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(r.valor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
