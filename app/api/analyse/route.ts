import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase-server'
import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'

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

async function captureScreenshot(url: string): Promise<string | null> {
  let browser = null
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1280, height: 900 },
      executablePath: await chromium.executablePath(),
      headless: true,
    })
    const page = await browser.newPage()
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 })
    const buffer = await page.screenshot({ type: 'jpeg', quality: 80 })
    return Buffer.from(buffer).toString('base64')
  } catch (err) {
    console.error('Screenshot failed:', err)
    return null
  } finally {
    if (browser) await browser.close()
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('ANTHROPIC_API_KEY exists:', !!process.env.ANTHROPIC_API_KEY)
    const { projectId, description } = await request.json()

    if (!projectId || !description) {
      return NextResponse.json({ error: 'Données manquantes.' }, { status: 400 })
    }

    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
    }

    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
    const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
    )

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

    const screenshotBase64 = await captureScreenshot(project.url)

    const textContent = `Analyse cette landing page :

URL : ${project.url}
Secteur : ${project.sector || 'Non précisé'}
Stade : ${project.stage || 'Non précisé'}
Problème décrit par le fondateur : ${description}

Produis ton analyse complète en JSON.`

    type ContentBlock =
      | { type: 'text'; text: string }
      | { type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg'; data: string } }

    const userContent: ContentBlock[] = screenshotBase64
      ? [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: screenshotBase64 } },
          { type: 'text', text: textContent },
        ]
      : [{ type: 'text', text: textContent }]

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
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