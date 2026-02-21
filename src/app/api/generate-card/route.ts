import { NextResponse } from 'next/server'
import { requireOwner } from '@/lib/auth'
import OpenAI from 'openai'
import { log } from '@/lib/logger'

export async function POST(request: Request) {
  let owner
  try {
    owner = await requireOwner()
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 401 })
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

  log.info('card_design.generation_started', { restaurant_id: owner.restaurantId, user_id: owner.userId, prompt_length: prompt.length })
  const startTime = Date.now()
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

    log.info('card_design.generation_completed', { restaurant_id: owner.restaurantId, user_id: owner.userId, duration_ms: Date.now() - startTime })
    return NextResponse.json({ url })
  } catch (error) {
    const message =
      error instanceof OpenAI.APIError
        ? error.message
        : 'Erro ao gerar imagem'
    log.error('card_design.generation_failed', { restaurant_id: owner.restaurantId, error: message })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
