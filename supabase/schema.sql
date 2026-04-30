-- ============================================================
-- MediYa - Schema de base de datos para Supabase
-- Ejecutar este script en el SQL Editor de Supabase
-- ============================================================

-- Tabla de perfiles (extiende auth.users)
CREATE TABLE public.profiles (
  id        uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role      text NOT NULL CHECK (role IN ('doctor', 'patient')),
  full_name text NOT NULL,
  phone     text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Cualquier usuario autenticado puede ver perfiles (los doctores son públicos)
CREATE POLICY "profiles_select_public" ON public.profiles
  FOR SELECT USING (true);

-- Los usuarios solo pueden actualizar su propio perfil
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Trigger: crea el perfil automáticamente cuando un usuario se registra
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'patient'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuario'),
    NEW.raw_user_meta_data->>'phone'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- Tabla de perfiles de médicos
-- ============================================================
CREATE TABLE public.doctor_profiles (
  id               uuid REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  specialty        text NOT NULL DEFAULT '',
  bio              text,
  consultation_fee integer CHECK (consultation_fee >= 0),
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.doctor_profiles ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede ver los perfiles activos de médicos
CREATE POLICY "doctor_profiles_select" ON public.doctor_profiles
  FOR SELECT USING (true);

-- El médico puede insertar y actualizar su propio perfil
CREATE POLICY "doctor_profiles_insert" ON public.doctor_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "doctor_profiles_update" ON public.doctor_profiles
  FOR UPDATE USING (auth.uid() = id);


-- ============================================================
-- Tabla de zonas del médico
-- ============================================================
CREATE TABLE public.doctor_zones (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  doctor_id   uuid NOT NULL REFERENCES public.doctor_profiles(id) ON DELETE CASCADE,
  department  text NOT NULL,
  zone        text NOT NULL,
  UNIQUE (doctor_id, department, zone)
);

ALTER TABLE public.doctor_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doctor_zones_select" ON public.doctor_zones
  FOR SELECT USING (true);

CREATE POLICY "doctor_zones_insert" ON public.doctor_zones
  FOR INSERT WITH CHECK (auth.uid() = doctor_id);

CREATE POLICY "doctor_zones_delete" ON public.doctor_zones
  FOR DELETE USING (auth.uid() = doctor_id);


-- ============================================================
-- Tabla de horarios del médico
-- ============================================================
CREATE TABLE public.doctor_schedules (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  doctor_id    uuid NOT NULL REFERENCES public.doctor_profiles(id) ON DELETE CASCADE,
  day_of_week  integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Lunes, 6=Domingo
  start_time   time NOT NULL,
  end_time     time NOT NULL,
  CHECK (end_time > start_time),
  UNIQUE (doctor_id, day_of_week)
);

ALTER TABLE public.doctor_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doctor_schedules_select" ON public.doctor_schedules
  FOR SELECT USING (true);

CREATE POLICY "doctor_schedules_insert" ON public.doctor_schedules
  FOR INSERT WITH CHECK (auth.uid() = doctor_id);

CREATE POLICY "doctor_schedules_delete" ON public.doctor_schedules
  FOR DELETE USING (auth.uid() = doctor_id);


-- ============================================================
-- Tabla de turnos
-- ============================================================
CREATE TABLE public.appointments (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  doctor_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  patient_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requested_date  date NOT NULL,
  requested_time  time NOT NULL,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'accepted', 'rejected')),
  patient_notes   text,
  doctor_notes    text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- El médico puede ver sus propios turnos
CREATE POLICY "appointments_doctor_select" ON public.appointments
  FOR SELECT USING (auth.uid() = doctor_id);

-- El paciente puede ver sus propios turnos
CREATE POLICY "appointments_patient_select" ON public.appointments
  FOR SELECT USING (auth.uid() = patient_id);

-- Solo pacientes pueden crear turnos (no pueden sacar turno consigo mismos)
CREATE POLICY "appointments_patient_insert" ON public.appointments
  FOR INSERT WITH CHECK (
    auth.uid() = patient_id
    AND auth.uid() != doctor_id
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'patient'
    )
  );

-- El médico puede actualizar el estado del turno
CREATE POLICY "appointments_doctor_update" ON public.appointments
  FOR UPDATE USING (auth.uid() = doctor_id);


-- ============================================================
-- MIGRACIÓN: Especialidades múltiples por médico
-- ============================================================
CREATE TABLE public.doctor_specialties (
  id        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  doctor_id uuid NOT NULL REFERENCES public.doctor_profiles(id) ON DELETE CASCADE,
  specialty text NOT NULL,
  UNIQUE (doctor_id, specialty)
);

ALTER TABLE public.doctor_specialties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doctor_specialties_select" ON public.doctor_specialties
  FOR SELECT USING (true);

CREATE POLICY "doctor_specialties_insert" ON public.doctor_specialties
  FOR INSERT WITH CHECK (auth.uid() = doctor_id);

CREATE POLICY "doctor_specialties_delete" ON public.doctor_specialties
  FOR DELETE USING (auth.uid() = doctor_id);


-- ============================================================
-- MIGRACIÓN: Horarios por zona
-- ============================================================
CREATE TABLE public.doctor_zone_schedules (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  zone_id      uuid NOT NULL REFERENCES public.doctor_zones(id) ON DELETE CASCADE,
  day_of_week  integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time   time NOT NULL,
  end_time     time NOT NULL,
  CHECK (end_time > start_time),
  UNIQUE (zone_id, day_of_week)
);

ALTER TABLE public.doctor_zone_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doctor_zone_schedules_select" ON public.doctor_zone_schedules
  FOR SELECT USING (true);

CREATE POLICY "doctor_zone_schedules_insert" ON public.doctor_zone_schedules
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.doctor_zones
      WHERE id = zone_id AND doctor_id = auth.uid()
    )
  );

CREATE POLICY "doctor_zone_schedules_delete" ON public.doctor_zone_schedules
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.doctor_zones
      WHERE id = zone_id AND doctor_id = auth.uid()
    )
  );


-- ============================================================
-- MIGRACIÓN: Pasarela de pago
-- Cambiar default de is_active a false para nuevos médicos
-- ============================================================
ALTER TABLE public.doctor_profiles ALTER COLUMN is_active SET DEFAULT false;

CREATE TABLE public.payments (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  doctor_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mp_preference_id  text,
  mp_payment_id     text,
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- El médico puede ver sus propios pagos
CREATE POLICY "payments_select_own" ON public.payments
  FOR SELECT USING (auth.uid() = doctor_id);

-- Solo el service role (webhook) puede insertar y actualizar
CREATE POLICY "payments_insert_own" ON public.payments
  FOR INSERT WITH CHECK (auth.uid() = doctor_id);


-- ============================================================
-- MIGRACIÓN: Suscripciones mensuales MercadoPago
-- ============================================================
ALTER TABLE public.doctor_profiles
  ADD COLUMN IF NOT EXISTS mp_subscription_id text;


-- ============================================================
-- MIGRACIÓN: Teléfonos del médico
-- ============================================================
ALTER TABLE public.doctor_profiles
  ADD COLUMN IF NOT EXISTS phone2 text;


-- ============================================================
-- MIGRACIÓN: Modalidad de atención (presencial / videollamada / ambas)
-- ============================================================
ALTER TABLE public.doctor_zone_schedules
  ADD COLUMN IF NOT EXISTS modality text NOT NULL DEFAULT 'presencial'
  CHECK (modality IN ('presencial', 'videollamada', 'ambas'));

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS modality text
  CHECK (modality IN ('presencial', 'videollamada'));
