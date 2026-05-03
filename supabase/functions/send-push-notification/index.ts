import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' },
    })
  }

  try {
    const { type, record, old_record } = await req.json()

    const vapidPublicKey  = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
    const vapidEmail      = Deno.env.get('VAPID_EMAIL') ?? 'mailto:admin@mediya.uy'

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.warn('VAPID keys not configured — skipping push')
      return new Response('ok')
    }

    webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const appUrl    = (Deno.env.get('APP_URL') ?? 'https://mediya.uy').replace(/\/$/, '')
    const oldStatus = old_record?.status ?? null
    const newStatus = record.status

    let targetUserId: string | null = null
    let title = ''
    let body  = ''
    let url   = '/'

    // INSERT pending → notificar médico
    if (type === 'INSERT' && newStatus === 'pending') {
      const { data: patient } = await supabase.from('profiles').select('full_name').eq('id', record.patient_id).single()
      targetUserId = record.doctor_id
      title = '📅 Nuevo turno solicitado'
      body  = `${patient?.full_name ?? 'Un paciente'} solicitó un turno para el ${record.requested_date}`
      url   = `${appUrl}/dashboard/medico`
    }

    // pending_payment → pending (urgente) → notificar médico
    if (type === 'UPDATE' && oldStatus === 'pending_payment' && newStatus === 'pending') {
      const { data: patient } = await supabase.from('profiles').select('full_name').eq('id', record.patient_id).single()
      targetUserId = record.doctor_id
      title = '⚡ Turno urgente recibido'
      body  = `${patient?.full_name ?? 'Un paciente'} reservó un turno urgente para hoy`
      url   = `${appUrl}/dashboard/medico`
    }

    // pending → accepted → notificar paciente
    if (type === 'UPDATE' && oldStatus === 'pending' && newStatus === 'accepted') {
      const { data: doctor } = await supabase.from('profiles').select('full_name').eq('id', record.doctor_id).single()
      targetUserId = record.patient_id
      title = '✅ Turno confirmado'
      body  = `Tu turno con ${doctor?.full_name ?? 'el médico'} fue confirmado`
      url   = `${appUrl}/dashboard/paciente`
    }

    // pending → rejected → notificar paciente
    if (type === 'UPDATE' && oldStatus === 'pending' && newStatus === 'rejected') {
      targetUserId = record.patient_id
      title = 'Turno no confirmado'
      body  = record.doctor_notes ? `Motivo: ${record.doctor_notes}` : 'El médico no pudo aceptar tu solicitud'
      url   = `${appUrl}/dashboard/paciente`
    }

    if (!targetUserId) return new Response('ok')

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', targetUserId)

    if (!subs || subs.length === 0) return new Response('ok')

    const payload = JSON.stringify({ title, body, url })

    await Promise.all(
      subs.map(async ({ subscription }) => {
        try {
          await webpush.sendNotification(subscription, payload)
        } catch (err) {
          if ((err as { statusCode?: number }).statusCode === 410) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
          } else {
            console.error('Push send error:', err)
          }
        }
      })
    )

    return new Response('ok')
  } catch (err) {
    console.error('send-push-notification:', err)
    return new Response('error', { status: 500 })
  }
})
