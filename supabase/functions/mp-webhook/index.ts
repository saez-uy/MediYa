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

  async function activateDoctor(doctorId: string, mpPaymentId: string, mpPreferenceId: string) {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    await supabase.from('doctor_profiles').update({ is_active: true }).eq('id', doctorId)
    await supabase
      .from('payments')
      .update({ mp_payment_id: mpPaymentId, status: 'paid' })
      .eq('mp_preference_id', mpPreferenceId)
  }

  try {
    // ── 1. IPN de MercadoPago (GET o POST con topic/type=payment) ──────────
    let ipnPaymentId: string | null = null

    if (req.method === 'GET') {
      const url = new URL(req.url)
      const topic = url.searchParams.get('topic') ?? url.searchParams.get('type')
      if (topic === 'payment') {
        ipnPaymentId = url.searchParams.get('id') ?? url.searchParams.get('data.id')
      }
    } else if (req.method === 'POST') {
      const body = await req.json()

      // ── 2. Verificación iniciada por el médico desde la app ───────────────
      if (body.verify_doctor === true) {
        const authHeader = req.headers.get('Authorization') ?? ''
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        const { data: { user }, error: authError } = await supabase.auth.getUser(
          authHeader.replace('Bearer ', '')
        )
        if (authError || !user) {
          return new Response(JSON.stringify({ error: 'No autorizado' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        // Buscar el pago más reciente del médico
        const { data: payment } = await supabase
          .from('payments')
          .select('mp_preference_id')
          .eq('doctor_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (!payment?.mp_preference_id) {
          return new Response(JSON.stringify({ status: 'no_payment_found' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        // Buscar en MP si hay algún pago aprobado para esa preferencia
        const searchResp = await fetch(
          `https://api.mercadopago.com/v1/payments/search?preference_id=${payment.mp_preference_id}&sort=date_created&criteria=desc&limit=5`,
          { headers: { 'Authorization': `Bearer ${mpAccessToken}` } }
        )
        const searchResult = await searchResp.json()
        const approved = (searchResult.results ?? []).find((p: { status: string }) => p.status === 'approved')

        if (!approved) {
          const latestStatus = searchResult.results?.[0]?.status ?? 'not_found'
          return new Response(JSON.stringify({ status: latestStatus }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        await activateDoctor(user.id, String(approved.id), payment.mp_preference_id)
        return new Response(JSON.stringify({ status: 'approved' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // ── 3. Webhook POST estándar de MP ────────────────────────────────────
      if (body.type === 'payment' || body.topic === 'payment') {
        ipnPaymentId = String(body.data?.id ?? body.id ?? '')
      }

      // ── 4. Llamada directa con payment_id (desde PaymentSuccess) ─────────
      if (body.payment_id) {
        ipnPaymentId = String(body.payment_id)
      }
    }

    // ── Procesar payment_id obtenido por IPN o llamada directa ────────────
    if (ipnPaymentId) {
      const mpResp = await fetch(`https://api.mercadopago.com/v1/payments/${ipnPaymentId}`, {
        headers: { 'Authorization': `Bearer ${mpAccessToken}` },
      })
      const mpPayment = await mpResp.json()

      if (mpPayment.status === 'approved' && mpPayment.external_reference) {
        await activateDoctor(
          mpPayment.external_reference,
          String(ipnPaymentId),
          mpPayment.preference_id
        )
        return new Response(JSON.stringify({ status: 'approved' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ status: mpPayment.status ?? 'not_approved' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
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
