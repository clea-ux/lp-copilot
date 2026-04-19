'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AnalysePage() {
  const { id } = useParams()
  const router = useRouter()
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAnalyse = async () => {
    if (!description || description.length < 10) {
      setError('Décris ton problème en au moins 10 caractères.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: id, description }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Erreur lors de l\'analyse.')
        setLoading(false)
        return
      }

      router.push(`/dashboard/projects/${id}/rapport/${data.analysisId}`)
    } catch {
      setError('Erreur inattendue. Réessaie.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-lg w-full bg-white rounded-xl shadow-lg p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lancer l'analyse</h1>
          <p className="text-gray-500 mt-1">Décris ce que tu veux analyser</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quel est ton problème principal ?
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ex: Mon taux de conversion est très faible, les visiteurs repartent sans s'inscrire..."
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}

          <button
            onClick={handleAnalyse}
            disabled={loading}
            className="w-full bg-teal-600 text-white py-3 rounded-lg font-medium hover:bg-teal-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Analyse en cours...' : 'Analyser ma landing page'}
          </button>
        </div>

        {loading && (
          <div className="text-center text-gray-500 text-sm space-y-1">
            <p>📸 Capture de ta landing page...</p>
            <p>🤖 Analyse IA en cours...</p>
            <p>📊 Génération du rapport...</p>
            <p className="text-xs">Cela prend environ 1-2 minutes</p>
          </div>
        )}
      </div>
    </div>
  )
}