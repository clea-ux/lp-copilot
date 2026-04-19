import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase-server'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const SYSTEM_PROMPT = `Tu es un expert en conversion de landing pages SaaS avec 15 ans d'expérience. Tu analyses les landing pages à travers le prisme du design comportemental.

Ta méthode : une landing page n'est pas une page marketing, c'est une page de décision. Son rôle unique est de faire comprendre en 3 à 5 secondes ce que fait le produit, pour qui, et pourquoi.

Pour chaque analyse, tu produis un JSON structuré avec exactement ce format :
{
  "verdict": "Une phrase directe qui résume le problème principal",
  "score_global": 65,
  "score_copy": 60,
  "score_structure": 70,
  "score_ctv": 55,
  "score_proof": 65,
  "problemes": [
    {
      "niveau": "critique",
      "titre": "Titre du problème",
      "explication": "Explication causale détaillée",
      "impact": "Impact concret sur le visiteur"
    }
  ],
  "recommandations": [
    {
      "titre": "Titre de la recommandation",
      "description": "Description concrète",
      "impact": "Élevé",
      "effort": "Rapide",
      "quick_win": true
    }
  ],
  "variantes": [
    {
      "element": "Headline",
      "actuel": "Texte actuel",
      "variante_a": "Proposition System 1",
      "variante_b": "Proposition System 2",
      "variante_c": "Proposition hybride"
    }
  ]
}

Réponds UNIQUEMENT avec le JSON, sans texte avant ou après.`

export async function POST(request: NextRequest) {
  try {
    const { projectId, description } = await request.json()

    if (!projectId || !description) {
      return NextResponse.json({ error: 'Données manquantes.' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
    }

    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single()

    if (!project) {
      return NextResponse.json({ error: 'Projet introuvable.' }, { status: 404 })
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20251001',
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Analyse cette landing page :

URL : ${project.url}
Secteur : ${project.sector || 'Non précisé'}
Stade : ${project.stage || 'Non précisé'}
Problème décrit par le fondateur : ${description}

Produis ton analyse complète en JSON.`
        }
      ]
    })

    const rawOutput = message.content[0].type === 'text' ? message.content[0].text : ''
    
    let analysisData
    try {
      const clean = rawOutput.replace(/```json|```/g, '').trim()
      analysisData = JSON.parse(clean)
    } catch {
      return NextResponse.json({ error: 'Erreur de parsing de l\'analyse.' }, { status: 500 })
    }

    const { data: analysis, error: dbError } = await supabase
      .from('analyses')
      .insert({
        project_id: projectId,
        user_id: user.id,
        score_global: analysisData.score_global,
        score_copy: analysisData.score_copy,
        score_structure: analysisData.score_structure,
        score_ctv: analysisData.score_ctv,
        score_proof: analysisData.score_proof,
        verdict: analysisData.verdict,
        recommendations: analysisData,
        raw_output: rawOutput,
      })
      .select()
      .single()

    if (dbError) {
      return NextResponse.json({ error: 'Erreur de sauvegarde.' }, { status: 500 })
    }

    return NextResponse.json({ analysisId: analysis.id })

  } catch (error) {
    console.error('Analyse error:', error)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}