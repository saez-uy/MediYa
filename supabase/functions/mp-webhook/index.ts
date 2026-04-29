import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    let paymentId: string | null = null

    if (req.method === 'GET') {
      const url = new URL(req.url)
      const topic = url.searchParams.get('topic') ?? url.searchParams.get('type')
      if (topic !== 'payment') return new Response('OK', { status: 200 })
      paymentId = url.searchParams.get('id') ?? url.searchParams.get('data.id')
    } else if (req.method === 'POST') {
      const body = await req.json()
      if (body.type !== 'payment') return new Response('OK', { status: 200 })
      paymentId = String(body.data?.id ?? body.id ?? '')
    }

    if (!paymentId) return new Response('OK', { status: 200 })

    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${Deno.env.get('MP_ACCESS_TOKEN')}` },
    })
    const payment = await mpResponse.json()

    if (payment.status !== 'approved') return new Response('OK', { status: 200 })

    const doctorId = payment.external_reference
    if (!doctorId) return new Response('OK', { status: 200 })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    await supabase
      .from('doctor_profiles')
      .update({ is_active: true })
      .eq('id', doctorId)

    await supabase
      .from('payments')
      .update({ mp_payment_id: String(paymentId), status: 'paid' })
      .eq('mp_preference_id', payment.preference_id)

    return new Response('OK', { status: 200 })
  } catch (err) {
    console.error('mp-webhook error:', err)
    return new Response('Error', { status: 500 })
  }
})
