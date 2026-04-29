import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    let paymentId: string | null = null

    if (req.method === 'GET') {
      const url = new URL(req.url)
      const topic = url.searchParams.get('topic') ?? url.searchParams.get('type')
      // MercadoPago IPN: topic=payment, or direct verify call with payment_id param
      if (topic === 'payment') {
        paymentId = url.searchParams.get('id') ?? url.searchParams.get('data.id')
      } else {
        paymentId = url.searchParams.get('payment_id')
      }
    } else if (req.method === 'POST') {
      const body = await req.json()
      // Direct verify call from frontend: { payment_id: "..." }
      if (body.payment_id) {
        paymentId = String(body.payment_id)
      } else if (body.type === 'payment') {
        paymentId = String(body.data?.id ?? body.id ?? '')
      }
    }

    if (!paymentId) {
      return new Response(JSON.stringify({ status: 'no_payment_id' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${Deno.env.get('MP_ACCESS_TOKEN')}` },
    })
    const payment = await mpResponse.json()

    if (payment.status !== 'approved') {
      return new Response(JSON.stringify({ status: payment.status ?? 'not_approved' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const doctorId = payment.external_reference
    if (!doctorId) {
      return new Response(JSON.stringify({ status: 'no_reference' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

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

    return new Response(JSON.stringify({ status: 'approved', doctor_id: doctorId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('mp-webhook error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
