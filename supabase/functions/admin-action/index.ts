import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ADMIN_PASSWORD = Deno.env.get('ADMIN_PASSWORD') ?? '123123'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    const { password, action, doctor_id, admin_enabled } = await req.json()

    if (password !== ADMIN_PASSWORD) {
      return json({ error: 'Contraseña incorrecta' }, 401)
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    if (action === 'list') {
      const { data, error } = await supabase
        .from('doctor_profiles')
        .select(`
          id,
          is_active,
          admin_enabled,
          caja_profesional,
          documento,
          profile:profiles!inner(full_name, phone, created_at)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      return json({ doctors: data })
    }

    if (action === 'toggle') {
      const { error } = await supabase
        .from('doctor_profiles')
        .update({ admin_enabled })
        .eq('id', doctor_id)

      if (error) throw error
      return json({ ok: true })
    }

    return json({ error: 'Acción no válida' }, 400)
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})
