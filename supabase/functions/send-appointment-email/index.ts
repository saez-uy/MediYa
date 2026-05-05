import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
const DAYS_ES   = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']

function formatDate(dateStr: string, timeStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return `${DAYS_ES[d.getDay()]} ${d.getDate()} de ${MONTHS_ES[d.getMonth()]} a las ${timeStr.slice(0, 5)} hs`
}

function modalityLabel(m: string | null) {
  if (m === 'videollamada') return '💻 Videollamada'
  return '🏥 Presencial'
}

// ── Email templates ────────────────────────────────────────────────────────

function wrap(content: string, appUrl: string) {
  return `<!DOCTYPE html><html lang="es"><body style="margin:0;padding:0;background:#f9fafb;font-family:sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px;">
<table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
  <tr><td style="background:#0d9488;padding:24px 32px;">
    <span style="color:#fff;font-size:22px;font-weight:700;">MediYa</span>
  </td></tr>
  <tr><td style="padding:32px;">${content}</td></tr>
  <tr><td style="background:#f3f4f6;padding:16px 32px;text-align:center;">
    <a href="${appUrl}" style="color:#6b7280;font-size:12px;text-decoration:none;">mediya.uy</a>
  </td></tr>
</table>
</td></tr></table>
</body></html>`
}

function tRow(label: string, value: string) {
  return `<tr>
    <td style="padding:6px 0;color:#6b7280;font-size:14px;width:130px;">${label}</td>
    <td style="padding:6px 0;color:#111827;font-size:14px;font-weight:500;">${value}</td>
  </tr>`
}

function emailNewAppointment(opts: {
  patientName: string; when: string; modality: string
  phone: string | null; notes: string | null; appUrl: string; isUrgency?: boolean
}) {
  const badge = opts.isUrgency
    ? `<span style="background:#f59e0b;color:#fff;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;">⚡ URGENTE</span>&nbsp;`
    : ''
  return wrap(`
    <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111827;">${badge}Nuevo turno solicitado</p>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">Un paciente ha solicitado un turno contigo.</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;margin-bottom:24px;">
      ${tRow('Paciente', opts.patientName)}
      ${opts.phone ? tRow('Teléfono', opts.phone) : ''}
      ${tRow('Fecha y hora', opts.when)}
      ${tRow('Modalidad', opts.modality)}
      ${opts.notes ? tRow('Motivo', opts.notes) : ''}
    </table>
    <a href="${opts.appUrl}/dashboard/medico" style="display:inline-block;background:#0d9488;color:#fff;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">Ver mi agenda</a>
  `, opts.appUrl)
}

function emailAppointmentAccepted(opts: {
  doctorName: string; when: string; modality: string; appUrl: string
}) {
  return wrap(`
    <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111827;">✅ Turno confirmado</p>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">Tu turno fue aceptado por el médico.</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;margin-bottom:24px;">
      ${tRow('Médico', opts.doctorName)}
      ${tRow('Fecha y hora', opts.when)}
      ${tRow('Modalidad', opts.modality)}
    </table>
    <p style="margin:0 0 24px;color:#374151;font-size:14px;">El médico se va a contactar con vos a la brevedad para coordinar los detalles.</p>
    <a href="${opts.appUrl}/dashboard/paciente" style="display:inline-block;background:#0d9488;color:#fff;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">Ver mis turnos</a>
  `, opts.appUrl)
}

function emailAppointmentRejected(opts: {
  doctorName: string; when: string; reason: string | null; appUrl: string
}) {
  return wrap(`
    <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111827;">Tu turno no pudo ser confirmado</p>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">Lamentablemente el médico no pudo aceptar tu solicitud.</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;margin-bottom:24px;">
      ${tRow('Médico', opts.doctorName)}
      ${tRow('Fecha y hora', opts.when)}
      ${opts.reason ? tRow('Motivo', opts.reason) : ''}
    </table>
    <p style="margin:0 0 24px;color:#374151;font-size:14px;">Podés buscar otro médico disponible.</p>
    <a href="${opts.appUrl}/buscar" style="display:inline-block;background:#0d9488;color:#fff;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">Buscar médicos</a>
  `, opts.appUrl)
}

function emailAppointmentCancelled(opts: {
  patientName: string; when: string; appUrl: string
}) {
  return wrap(`
    <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111827;">Turno cancelado</p>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">Un paciente canceló su turno.</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;margin-bottom:24px;">
      ${tRow('Paciente', opts.patientName)}
      ${tRow('Fecha y hora', opts.when)}
    </table>
    <a href="${opts.appUrl}/dashboard/medico" style="display:inline-block;background:#0d9488;color:#fff;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">Ver mi agenda</a>
  `, opts.appUrl)
}

function emailRefundAlert(opts: {
  patientName: string; patientEmail: string; doctorName: string
  when: string; reason: string | null; appUrl: string
}) {
  return wrap(`
    <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:#b91c1c;">⚠️ Reembolso pendiente</p>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">Un médico rechazó un turno que ya tenía pago confirmado. Se requiere reembolso manual.</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;margin-bottom:24px;">
      ${tRow('Paciente', opts.patientName)}
      ${tRow('Email paciente', opts.patientEmail)}
      ${tRow('Médico', opts.doctorName)}
      ${tRow('Fecha y hora', opts.when)}
      ${opts.reason ? tRow('Motivo de rechazo', opts.reason) : ''}
    </table>
    <p style="margin:0 0 24px;color:#374151;font-size:14px;font-weight:500;">Acción requerida: contactar al paciente y procesar el reembolso desde MercadoPago.</p>
    <a href="${opts.appUrl}/admin" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">Ir al panel de admin</a>
  `, opts.appUrl)
}

// ── Main handler ───────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' },
    })
  }

  try {
    const { type, record, old_record } = await req.json()

    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) {
      console.warn('RESEND_API_KEY no configurado — se omite el envío de email.')
      return new Response('ok')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const fromEmail  = Deno.env.get('FROM_EMAIL') ?? 'MediYa <onboarding@resend.dev>'
    const appUrl     = (Deno.env.get('APP_URL') ?? 'https://mediya.uy').replace(/\/$/, '')
    const adminEmail = Deno.env.get('ADMIN_EMAIL') ?? null

    // Fetch doctor and patient emails via auth.admin (email lives in auth.users)
    const [{ data: { user: doctorUser } }, { data: { user: patientUser } }] = await Promise.all([
      supabase.auth.admin.getUserById(record.doctor_id),
      supabase.auth.admin.getUserById(record.patient_id),
    ])

    // Fetch profiles for names and phone
    const [{ data: doctorProfile }, { data: patientProfile }] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', record.doctor_id).single(),
      supabase.from('profiles').select('full_name, phone').eq('id', record.patient_id).single(),
    ])

    const doctorEmail  = doctorUser?.email ?? null
    const patientEmail = patientUser?.email ?? null
    const doctorName   = doctorProfile?.full_name ?? 'El médico'
    const patientName  = patientProfile?.full_name ?? 'El paciente'
    const patientPhone = patientProfile?.phone ?? null

    const when     = formatDate(record.requested_date, record.requested_time)
    const modality = modalityLabel(record.modality)

    async function send(to: string, subject: string, html: string) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: fromEmail, to: [to], subject, html }),
      })
      if (!res.ok) console.error('Resend error:', await res.text())
    }

    const oldStatus = old_record?.status ?? null
    const newStatus = record.status

    // INSERT con status pending → notificar médico
    if (type === 'INSERT' && newStatus === 'pending') {
      if (doctorEmail) await send(
        doctorEmail,
        `Nuevo turno — ${patientName}`,
        emailNewAppointment({ patientName, when, modality, phone: patientPhone, notes: record.patient_notes, appUrl }),
      )
    }

    if (type === 'UPDATE') {
      // pending_payment → pending (pago urgente confirmado) → notificar médico
      if (oldStatus === 'pending_payment' && newStatus === 'pending') {
        if (doctorEmail) await send(
          doctorEmail,
          `⚡ Turno urgente — ${patientName}`,
          emailNewAppointment({ patientName, when, modality, phone: patientPhone, notes: record.patient_notes, appUrl, isUrgency: true }),
        )
      }

      // pending → accepted → notificar paciente
      if (oldStatus === 'pending' && newStatus === 'accepted') {
        if (patientEmail) await send(
          patientEmail,
          '✅ Turno confirmado — MediYa',
          emailAppointmentAccepted({ doctorName, when, modality, appUrl }),
        )
      }

      // pending → rejected → notificar paciente
      if (oldStatus === 'pending' && newStatus === 'rejected') {
        if (patientEmail) await send(
          patientEmail,
          'Tu turno no pudo confirmarse — MediYa',
          emailAppointmentRejected({ doctorName, when, reason: record.doctor_notes ?? null, appUrl }),
        )
        // Si tenía pago confirmado → alertar al admin para reembolso manual
        if (record.has_payment && adminEmail && patientEmail) await send(
          adminEmail,
          `⚠️ Reembolso pendiente — ${patientName}`,
          emailRefundAlert({
            patientName, patientEmail, doctorName, when,
            reason: record.doctor_notes ?? null, appUrl,
          }),
        )
      }

      // pending/accepted → cancelled → notificar médico
      if ((oldStatus === 'pending' || oldStatus === 'accepted') && newStatus === 'cancelled') {
        if (doctorEmail) await send(
          doctorEmail,
          `Turno cancelado — ${patientName}`,
          emailAppointmentCancelled({ patientName, when, appUrl }),
        )
      }
    }

    return new Response('ok')
  } catch (err) {
    console.error('send-appointment-email:', err)
    return new Response('error', { status: 500 })
  }
})
