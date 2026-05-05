import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
const DAYS_ES   = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']

function formatDate(dateStr: string, timeStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return `${DAYS_ES[d.getDay()]} ${d.getDate()} de ${MONTHS_ES[d.getMonth()]} a las ${timeStr.slice(0, 5)} hs`
}

function buildReminderEmail(opts: { doctorName: string; when: string; modality: string; appUrl: string }) {
  const content = `
    <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111827;">⏰ Recordatorio de turno</p>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">Tu turno es mañana. ¡No te olvides!</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;margin-bottom:24px;">
      <tr>
        <td style="padding:6px 0;color:#6b7280;font-size:14px;width:130px;">Médico</td>
        <td style="padding:6px 0;color:#111827;font-size:14px;font-weight:500;">${opts.doctorName}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#6b7280;font-size:14px;">Fecha y hora</td>
        <td style="padding:6px 0;color:#111827;font-size:14px;font-weight:500;">${opts.when}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#6b7280;font-size:14px;">Modalidad</td>
        <td style="padding:6px 0;color:#111827;font-size:14px;font-weight:500;">${opts.modality}</td>
      </tr>
    </table>
    <a href="${opts.appUrl}/dashboard/paciente"
       style="display:inline-block;background:#0d9488;color:#fff;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">
      Ver mis turnos
    </a>
  `
  return `<!DOCTYPE html><html lang="es"><body style="margin:0;padding:0;background:#f9fafb;font-family:sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px;">
<table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
  <tr><td style="background:#0d9488;padding:24px 32px;">
    <span style="color:#fff;font-size:22px;font-weight:700;">MediYa</span>
  </td></tr>
  <tr><td style="padding:32px;">${content}</td></tr>
  <tr><td style="background:#f3f4f6;padding:16px 32px;text-align:center;">
    <a href="${opts.appUrl}" style="color:#6b7280;font-size:12px;text-decoration:none;">mediya.uy</a>
  </td></tr>
</table>
</td></tr></table>
</body></html>`
}

serve(async () => {
  try {
    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) {
      console.warn('RESEND_API_KEY not configured — skipping reminders')
      return new Response('ok')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const appUrl    = (Deno.env.get('APP_URL') ?? 'https://mediya.uy').replace(/\/$/, '')
    const fromEmail = Deno.env.get('FROM_EMAIL') ?? 'MediYa <onboarding@resend.dev>'

    // Tomorrow in UTC+0 — the cron runs at 11:00 UTC (08:00 Uruguay)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]

    const { data: appointments, error } = await supabase
      .from('appointments')
      .select('id, patient_id, doctor_id, requested_date, requested_time, modality')
      .eq('requested_date', tomorrowStr)
      .in('status', ['pending', 'accepted'])
      .is('reminder_sent_at', null)

    if (error) throw error
    if (!appointments || appointments.length === 0) {
      console.log(`No reminders needed for ${tomorrowStr}`)
      return new Response(JSON.stringify({ sent: 0 }))
    }

    let sent = 0
    for (const appt of appointments) {
      const [{ data: { user: patientUser } }, { data: doctorProfile }] = await Promise.all([
        supabase.auth.admin.getUserById(appt.patient_id),
        supabase.from('profiles').select('full_name').eq('id', appt.doctor_id).single(),
      ])

      const patientEmail = patientUser?.email
      if (!patientEmail) continue

      const html = buildReminderEmail({
        doctorName: doctorProfile?.full_name ?? 'el médico',
        when: formatDate(appt.requested_date, appt.requested_time),
        modality: appt.modality === 'videollamada' ? '💻 Videollamada' : '🏥 Presencial',
        appUrl,
      })

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: fromEmail,
          to: [patientEmail],
          subject: `⏰ Recordatorio: turno mañana con ${doctorProfile?.full_name ?? 'el médico'}`,
          html,
        }),
      })

      if (res.ok) {
        await supabase
          .from('appointments')
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq('id', appt.id)
        sent++
      } else {
        console.error('Resend error for appointment', appt.id, await res.text())
      }
    }

    console.log(`Reminders sent: ${sent}/${appointments.length}`)
    return new Response(JSON.stringify({ sent, total: appointments.length }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('send-appointment-reminders:', err)
    return new Response('error', { status: 500 })
  }
})
