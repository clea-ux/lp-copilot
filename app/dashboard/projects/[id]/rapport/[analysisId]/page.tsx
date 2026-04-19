'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Analysis {
  id: string
  score_global: number
  score_copy: number
  score_structure: number
  score_ctv: number
  score_proof: number
  verdict: string
  recommendations: {
    problemes: Array<{
      niveau: string
      titre: string
      explication: string
      impact: string
    }>
    recommandations: Array<{
      titre: string
      description: string
      impact: string
      effort: string
      quick_win: boolean
    }>
    variantes: Array<{
      element: string
      actuel: string
      variante_a: string
      variante_b: string
      variante_c: string
    }>
  }
}

function ScoreCircle({ score, label }: { score: number, label: string }) {
  const color = score >= 75 ? 'text-green-500' : score >= 50 ? 'text-orange-500' : 'text-red-500'
  return (
    <div className="text-center">
      <div className={`text-3xl font-bold ${color}`}>{score}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  )
}

export default function RapportPage() {
  const { id, analysisId } = useParams()
  const router = useRouter()
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/login')
        return
      }

      supabase
        .from('analyses')
        .select('*')
        .eq('id', analysisId)
        .eq('user_id', session.user.id)
        .single()
        .then(({ data, error }) => {
          if (error || !data) {
            router.push('/dashboard')
            return
          }
          setAnalysis(data)
          setLoading(false)
        })
    })
  }, [analysisId, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Chargement du rapport...</p>
      </div>
    )
  }

  if (!analysis) return null

  const data = analysis.recommendations

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 space-y-6">

        {/* Header */}
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Rapport d'analyse</h1>
              <p className="text-gray-500 mt-1">Voici le diagnostic de ta landing page</p>
            </div>
            <div className="text-center">
              <div className={`text-5xl font-bold ${analysis.score_global >= 75 ? 'text-green-500' : analysis.score_global >= 50 ? 'text-orange-500' : 'text-red-500'}`}>
                {analysis.score_global}
              </div>
              <div className="text-sm text-gray-500">Score global</div>
            </div>
          </div>
        </div>

        {/* Verdict */}
        <div className="bg-navy-900 bg-gray-900 rounded-xl shadow p-6">
          <h2 className="text-teal-400 font-semibold text-sm uppercase tracking-wide mb-2">🎯 Verdict principal</h2>
          <p className="text-white text-lg font-medium">{analysis.verdict}</p>
        </div>

        {/* Scores */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-gray-900 font-semibold mb-4">Scores par dimension</h2>
          <div className="grid grid-cols-4 gap-4">
            <ScoreCircle score={analysis.score_copy} label="Copy" />
            <ScoreCircle score={analysis.score_structure} label="Structure" />
            <ScoreCircle score={analysis.score_ctv} label="CTV" />
            <ScoreCircle score={analysis.score_proof} label="Preuve" />
          </div>
        </div>

        {/* Problèmes */}
        {data?.problemes && (
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h2 className="text-gray-900 font-semibold">🔍 Pourquoi ça casse</h2>
            {data.problemes.map((p, i) => (
              <div key={i} className={`p-4 rounded-lg border-l-4 ${p.niveau === 'critique' ? 'border-red-500 bg-red-50' : p.niveau === 'fort' ? 'border-orange-500 bg-orange-50' : 'border-yellow-500 bg-yellow-50'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-bold uppercase ${p.niveau === 'critique' ? 'text-red-600' : p.niveau === 'fort' ? 'text-orange-600' : 'text-yellow-600'}`}>
                    {p.niveau === 'critique' ? '🔴' : p.niveau === 'fort' ? '🟠' : '🟡'} {p.niveau}
                  </span>
                  <span className="font-semibold text-gray-900">{p.titre}</span>
                </div>
                <p className="text-gray-700 text-sm">{p.explication}</p>
                <p className="text-gray-500 text-sm mt-1 italic">{p.impact}</p>
              </div>
            ))}
          </div>
        )}

        {/* Recommandations */}
        {data?.recommandations && (
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h2 className="text-gray-900 font-semibold">🚀 Plan d'action</h2>
            {data.recommandations.map((r, i) => (
              <div key={i} className="p-4 rounded-lg border border-gray-200">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {r.quick_win && <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">⚡ Quick win</span>}
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{r.impact} impact</span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{r.effort}</span>
                    </div>
                    <h3 className="font-semibold text-gray-900">{r.titre}</h3>
                    <p className="text-gray-600 text-sm mt-1">{r.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Variantes */}
        {data?.variantes && (
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h2 className="text-gray-900 font-semibold">✏️ Variantes suggérées</h2>
            {data.variantes.map((v, i) => (
              <div key={i} className="p-4 rounded-lg border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-2">{v.element}</h3>
                <div className="space-y-2">
                  <div className="text-sm"><span className="text-gray-500">Actuel :</span> <span className="italic">"{v.actuel}"</span></div>
                  <div className="text-sm"><span className="text-teal-600 font-medium">Variante A :</span> {v.variante_a}</div>
                  <div className="text-sm"><span className="text-teal-600 font-medium">Variante B :</span> {v.variante_b}</div>
                  <div className="text-sm"><span className="text-teal-600 font-medium">Variante C :</span> {v.variante_c}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => router.push('/dashboard')}
          className="w-full bg-gray-900 text-white py-3 rounded-xl font-medium hover:bg-gray-800 transition-colors"
        >
          Retour au dashboard
        </button>

      </div>
    </div>
  )
}