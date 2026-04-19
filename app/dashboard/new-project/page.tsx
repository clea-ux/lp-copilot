'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function NewProjectPage() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!url || !name) {
      setError('Remplis tous les champs.')
      return
    }

    setLoading(true)
    setError(null)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }

    const { data, error: dbError } = await supabase
      .from('projects')
      .insert({ name, url, user_id: session.user.id })
      .select()
      .single()

    if (dbError) {
      setError('Erreur lors de la création du projet.')
      setLoading(false)
      return
    }

    router.push(`/dashboard/projects/${data.id}/analyse`)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-lg w-full bg-white rounded-xl shadow-lg p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nouveau projet</h1>
          <p className="text-gray-500 mt-1">Ajoute ta landing page à analyser</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom du projet
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: Mon SaaS"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              URL de ta landing page
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://monsite.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-teal-600 text-white py-3 rounded-lg font-medium hover:bg-teal-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Création...' : 'Créer et analyser'}
          </button>
        </div>
      </div>
    </div>
  )
}