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
    const { doctor_id } = await req.json()
    if (!doctor_id) throw new Error('Falta doctor_id')

    const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN')!
    const appUrl = Deno.env.get('APP_URL')!
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const price = Number(Deno.env.get('SUBSCRIPTION_PRICE') ?? 500)

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Obtener el email del médico para MercadoPago
    const { data: { user } } = await supabase.auth.admin.getUserById(doctor_id)
    if (!user?.email) throw new Error('No se encontró el email del médico')

    // Crear suscripción mensual en MercadoPago
    const preapprovalResp = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mpAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reason: 'MediYa – Suscripción mensual médico',
        payer_email: user.email,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: price,
          currency_id: 'UYU',
        },
        back_url: `${appUrl}/pago/exito`,
        external_reference: doctor_id,
        notification_url: `${supabaseUrl}/functions/v1/mp-webhook`,
      }),
    })

    const preapproval = await preapprovalResp.json()
    if (!preapproval.id) throw new Error(preapproval.message ?? 'Error creando suscripción MP')

    // Guardar en tabla payments
    await supabase.from('payments').insert({
      doctor_id,
      mp_preference_id: preapproval.id,
      status: 'pending',
    })

    return new Response(
      JSON.stringify({
        checkout_url: preapproval.init_point,
        sandbox_url: preapproval.sandbox_init_point,
        subscription_id: preapproval.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('create-payment error:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Error desconocido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
