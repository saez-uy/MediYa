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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  async function activateDoctor(doctorId: string, subscriptionId: string) {
    await supabase
      .from('doctor_profiles')
      .upsert({ id: doctorId, is_active: true, mp_subscription_id: subscriptionId })
    await supabase
      .from('payments')
      .update({ status: 'paid' })
      .eq('mp_preference_id', subscriptionId)
  }

  async function deactivateDoctor(doctorId: string) {
    await supabase
      .from('doctor_profiles')
      .update({ is_active: false })
      .eq('id', doctorId)
  }

  async function handleSubscriptionEvent(subscriptionId: string) {
    const resp = await fetch(`https://api.mercadopago.com/preapproval/${subscriptionId}`, {
      headers: { 'Authorization': `Bearer ${mpAccessToken}` },
    })
    const sub = await resp.json()
    const doctorId = sub.external_reference
    if (!doctorId) return

    if (sub.status === 'authorized') {
      await activateDoctor(doctorId, subscriptionId)
    } else if (sub.status === 'cancelled' || sub.status === 'paused') {
      await deactivateDoctor(doctorId)
    }
  }

  try {
    if (req.method === 'POST') {
      const body = await req.json()

      // ── Verificación iniciada por el médico desde la app (con JWT) ────────
      if (body.verify_doctor === true) {
        const authHeader = req.headers.get('Authorization') ?? ''
        const { data: { user }, error: authError } = await supabase.auth.getUser(
          authHeader.replace('Bearer ', '')
        )
        if (authError || !user) {
          return new Response(JSON.stringify({ error: 'No autorizado' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        // Buscar suscripción activa del médico en MP
        const searchResp = await fetch(
          `https://api.mercadopago.com/preapproval/search?external_reference=${user.id}&status=authorized&limit=1`,
          { headers: { 'Authorization': `Bearer ${mpAccessToken}` } }
        )
        const searchResult = await searchResp.json()
        const authorized = searchResult.results?.[0]

        if (authorized) {
          await activateDoctor(user.id, authorized.id)
          return new Response(JSON.stringify({ status: 'authorized' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        // También buscar sin filtro de status para ver el estado actual
        const allResp = await fetch(
          `https://api.mercadopago.com/preapproval/search?external_reference=${user.id}&limit=1`,
          { headers: { 'Authorization': `Bearer ${mpAccessToken}` } }
        )
        const allResult = await allResp.json()
        const latest = allResult.results?.[0]
        const currentStatus = latest?.status ?? 'not_found'

        return new Response(JSON.stringify({ status: currentStatus }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // ── Webhook de MercadoPago ─────────────────────────────────────────────
      const eventType = body.type ?? body.topic

      if (eventType === 'subscription_preapproval') {
        const subscriptionId = String(body.data?.id ?? body.id ?? '')
        if (subscriptionId) await handleSubscriptionEvent(subscriptionId)

      } else if (eventType === 'subscription_authorized_payment') {
        // Pago mensual procesado — verificar si el pago fue rechazado
        const paymentId = String(body.data?.id ?? '')
        if (paymentId) {
          const payResp = await fetch(
            `https://api.mercadopago.com/authorized_payments/${paymentId}`,
            { headers: { 'Authorization': `Bearer ${mpAccessToken}` } }
          )
          const authPayment = await payResp.json()
          if (authPayment.preapproval_id) {
            await handleSubscriptionEvent(authPayment.preapproval_id)
          }
        }

      } else if (eventType === 'payment' || body.payment_id) {
        // Fallback: pago directo (compatibilidad con flujo anterior)
        const paymentId = String(body.data?.id ?? body.payment_id ?? body.id ?? '')
        if (paymentId) {
          const mpResp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: { 'Authorization': `Bearer ${mpAccessToken}` },
          })
          const payment = await mpResp.json()
          if (payment.status === 'approved' && payment.external_reference) {
            await activateDoctor(payment.external_reference, payment.preference_id ?? paymentId)
          }
        }
      }
    }

    if (req.method === 'GET') {
      const url = new URL(req.url)
      const topic = url.searchParams.get('topic') ?? url.searchParams.get('type')
      const id = url.searchParams.get('id') ?? url.searchParams.get('data.id')
      if ((topic === 'subscription_preapproval' || topic === 'preapproval') && id) {
        await handleSubscriptionEvent(id)
      }
    }

    return new Response(JSON.stringify({ status: 'ok' }), {
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
