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
    const { doctor_id, patient_id, date, time, notes, modality, payer_email } = await req.json()
    if (!doctor_id || !patient_id || !date || !time) throw new Error('Faltan datos del turno.')

    const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN')!
    const appUrl = Deno.env.get('APP_URL')!
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const urgencyFee = Number(Deno.env.get('URGENCY_FEE') ?? 300)

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Crear turno en estado pending_payment
    const { data: appt, error: apptError } = await supabase
      .from('appointments')
      .insert({
        doctor_id,
        patient_id,
        requested_date: date,
        requested_time: time,
        status: 'pending_payment',
        modality: modality ?? null,
        patient_notes: notes ?? null,
      })
      .select('id')
      .single()

    if (apptError) throw apptError

    // Modo test: activar directamente
    if (mpAccessToken.startsWith('TEST-')) {
      await supabase
        .from('appointments')
        .update({ status: 'pending' })
        .eq('id', appt.id)
      return json({
        test_mode: true,
        checkout_url: `${appUrl}/pago/exito?type=urgency&appointment_id=${appt.id}&payment_id=test`,
        appointment_id: appt.id,
      })
    }

    // Crear preferencia de pago único en MercadoPago
    const prefResp = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mpAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [{
          title: 'Turno urgente para hoy – MediYa',
          quantity: 1,
          unit_price: urgencyFee,
          currency_id: 'UYU',
        }],
        payer: { email: payer_email },
        back_urls: {
          success: `${appUrl}/pago/exito?type=urgency&appointment_id=${appt.id}`,
          failure: `${appUrl}/pago/error`,
          pending: `${appUrl}/pago/exito?type=urgency&appointment_id=${appt.id}`,
        },
        auto_return: 'approved',
        external_reference: appt.id,
      }),
    })

    const pref = await prefResp.json()
    if (!pref.id) throw new Error(pref.message ?? 'Error creando preferencia en MercadoPago')

    return json({ checkout_url: pref.init_point, appointment_id: appt.id })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})
