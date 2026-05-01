import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    const { payment_id, appointment_id } = await req.json()
    if (!appointment_id) return json({ error: 'Faltan datos.' }, 400)

    const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN')!
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Test mode: create-urgency-payment already set status to pending
    if (payment_id === 'test' || !payment_id) {
      const { data: appt } = await supabase
        .from('appointments')
        .select('status')
        .eq('id', appointment_id)
        .single()

      if (appt?.status === 'pending') return json({ verified: true })
      return json({ verified: false, reason: 'Pago no confirmado.' })
    }

    // Production: verify payment status with MercadoPago
    const mpResp = await fetch(`https://api.mercadopago.com/v1/payments/${payment_id}`, {
      headers: { Authorization: `Bearer ${mpAccessToken}` },
    })
    const payment = await mpResp.json()

    if (payment.status !== 'approved') {
      return json({ verified: false, reason: `Estado del pago: ${payment.status}` })
    }

    // Validate external_reference matches appointment_id to prevent tampering
    if (payment.external_reference !== appointment_id) {
      return json({ verified: false, reason: 'Referencia de pago inválida.' })
    }

    // All good — activate the appointment
    const { error } = await supabase
      .from('appointments')
      .update({ status: 'pending' })
      .eq('id', appointment_id)
      .eq('status', 'pending_payment')

    if (error) throw error

    return json({ verified: true })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})
