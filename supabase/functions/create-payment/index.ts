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

    const prefResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mpAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [{
          id: 'mediya-doctor-alta',
          title: 'MediYa – Alta médico',
          quantity: 1,
          unit_price: price,
          currency_id: 'UYU',
        }],
        back_urls: {
          success: `${appUrl}/pago/exito`,
          failure: `${appUrl}/pago/error`,
          pending: `${appUrl}/pago/pendiente`,
        },
        notification_url: `${supabaseUrl}/functions/v1/mp-webhook`,
        external_reference: doctor_id,
        auto_return: 'approved',
      }),
    })

    const preference = await prefResponse.json()
    if (!preference.id) throw new Error(preference.message ?? 'Error creando preferencia MP')

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    await supabase.from('payments').insert({
      doctor_id,
      mp_preference_id: preference.id,
      status: 'pending',
    })

    return new Response(
      JSON.stringify({
        checkout_url: preference.init_point,
        sandbox_url: preference.sandbox_init_point,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Error desconocido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
