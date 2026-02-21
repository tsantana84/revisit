import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { jwtDecode } from 'jwt-decode'
import OpenAI from 'openai'

interface RevisitClaims {
  restaurant_id?: string
  app_role?: 'owner' | 'manager'
  sub: string
  exp: number
}

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })
  }

  const claims = jwtDecode<RevisitClaims>(session.access_token)

  if (claims.app_role !== 'owner') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  let body: { prompt?: string; primaryColor?: string; secondaryColor?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const prompt = body.prompt?.trim()
  const primaryColor = body.primaryColor || '#000000'
  const secondaryColor = body.secondaryColor || '#FFFFFF'

  if (!prompt || prompt.length < 5 || prompt.length > 500) {
    return NextResponse.json(
      { error: 'O prompt deve ter entre 5 e 500 caracteres' },
      { status: 400 }
    )
  }

  const fullPrompt = [
    prompt,
    `Use these brand colors as the dominant palette: primary ${primaryColor} and secondary ${secondaryColor}.`,
    'This image must contain NO TEXT, NO LETTERS, NO NUMBERS, NO WORDS of any kind.',
    'Wide landscape background image. Left side slightly darker. Premium aesthetic, high quality.',
  ].join('. ')

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  try {
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: fullPrompt,
      size: '1792x1024',
      quality: 'standard',
      n: 1,
    })

    const url = response.data?.[0]?.url

    if (!url) {
      return NextResponse.json({ error: 'Nenhuma imagem gerada' }, { status: 500 })
    }

    return NextResponse.json({ url })
  } catch (error) {
    const message =
      error instanceof OpenAI.APIError
        ? error.message
        : 'Erro ao gerar imagem'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
