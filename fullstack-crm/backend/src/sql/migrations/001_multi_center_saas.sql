BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS education_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO education_centers (id, name, phone, status)
VALUES ('11111111-1111-1111-1111-111111111111', 'Phoenix Main Center', '+998900000001', 'active')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_center_roles (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  center_id UUID REFERENCES education_centers(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('platform_owner', 'center_owner', 'manager')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_center_roles_lookup ON user_center_roles(user_id, role, center_id);

CREATE TABLE IF NOT EXISTS invites (
  id BIGSERIAL PRIMARY KEY,
  center_id UUID REFERENCES education_centers(id) ON DELETE CASCADE,
  role_to_assign TEXT NOT NULL CHECK (role_to_assign IN ('center_owner', 'manager')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE courses ADD COLUMN IF NOT EXISTS center_id UUID;
ALTER TABLE tariffs ADD COLUMN IF NOT EXISTS center_id UUID;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS center_id UUID;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS center_id UUID;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS center_id UUID;
ALTER TABLE students ADD COLUMN IF NOT EXISTS center_id UUID;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS center_id UUID;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS center_id UUID;

UPDATE courses SET center_id = '11111111-1111-1111-1111-111111111111' WHERE center_id IS NULL;
UPDATE tariffs SET center_id = '11111111-1111-1111-1111-111111111111' WHERE center_id IS NULL;
UPDATE teachers SET center_id = '11111111-1111-1111-1111-111111111111' WHERE center_id IS NULL;
UPDATE rooms SET center_id = '11111111-1111-1111-1111-111111111111' WHERE center_id IS NULL;
UPDATE groups SET center_id = '11111111-1111-1111-1111-111111111111' WHERE center_id IS NULL;
UPDATE students SET center_id = '11111111-1111-1111-1111-111111111111' WHERE center_id IS NULL;
UPDATE enrollments SET center_id = '11111111-1111-1111-1111-111111111111' WHERE center_id IS NULL;
UPDATE attendance SET center_id = '11111111-1111-1111-1111-111111111111' WHERE center_id IS NULL;

ALTER TABLE courses ALTER COLUMN center_id SET NOT NULL;
ALTER TABLE tariffs ALTER COLUMN center_id SET NOT NULL;
ALTER TABLE teachers ALTER COLUMN center_id SET NOT NULL;
ALTER TABLE rooms ALTER COLUMN center_id SET NOT NULL;
ALTER TABLE groups ALTER COLUMN center_id SET NOT NULL;
ALTER TABLE students ALTER COLUMN center_id SET NOT NULL;
ALTER TABLE enrollments ALTER COLUMN center_id SET NOT NULL;
ALTER TABLE attendance ALTER COLUMN center_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'courses_center_id_fkey') THEN
    ALTER TABLE courses ADD CONSTRAINT courses_center_id_fkey FOREIGN KEY (center_id) REFERENCES education_centers(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tariffs_center_id_fkey') THEN
    ALTER TABLE tariffs ADD CONSTRAINT tariffs_center_id_fkey FOREIGN KEY (center_id) REFERENCES education_centers(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teachers_center_id_fkey') THEN
    ALTER TABLE teachers ADD CONSTRAINT teachers_center_id_fkey FOREIGN KEY (center_id) REFERENCES education_centers(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rooms_center_id_fkey') THEN
    ALTER TABLE rooms ADD CONSTRAINT rooms_center_id_fkey FOREIGN KEY (center_id) REFERENCES education_centers(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'groups_center_id_fkey') THEN
    ALTER TABLE groups ADD CONSTRAINT groups_center_id_fkey FOREIGN KEY (center_id) REFERENCES education_centers(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'students_center_id_fkey') THEN
    ALTER TABLE students ADD CONSTRAINT students_center_id_fkey FOREIGN KEY (center_id) REFERENCES education_centers(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'enrollments_center_id_fkey') THEN
    ALTER TABLE enrollments ADD CONSTRAINT enrollments_center_id_fkey FOREIGN KEY (center_id) REFERENCES education_centers(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_center_id_fkey') THEN
    ALTER TABLE attendance ADD CONSTRAINT attendance_center_id_fkey FOREIGN KEY (center_id) REFERENCES education_centers(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE students ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_rooms_center_name ON rooms(center_id, name);

ALTER TABLE enrollments DROP CONSTRAINT IF EXISTS enrollments_student_id_group_id_status_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_enrollments_center_student_group_status ON enrollments(center_id, student_id, group_id, status);

ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_student_id_group_id_lesson_date_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_center_student_group_date ON attendance(center_id, student_id, group_id, lesson_date);

CREATE TABLE IF NOT EXISTS business_events (
  id BIGSERIAL PRIMARY KEY,
  center_id UUID NOT NULL REFERENCES education_centers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('student_registered', 'student_renewed', 'attendance_marked')),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_courses_center_language_level ON courses(center_id, language, level);
CREATE INDEX IF NOT EXISTS idx_groups_center_course_id ON groups(center_id, course_id);
CREATE INDEX IF NOT EXISTS idx_groups_center_teacher_id ON groups(center_id, teacher_id);
CREATE INDEX IF NOT EXISTS idx_groups_center_room_id ON groups(center_id, room_id);
CREATE INDEX IF NOT EXISTS idx_students_center_language_level ON students(center_id, language_focus, current_level);
CREATE INDEX IF NOT EXISTS idx_enrollments_center_group_status ON enrollments(center_id, group_id, status);
CREATE INDEX IF NOT EXISTS idx_attendance_center_date ON attendance(center_id, lesson_date);
CREATE INDEX IF NOT EXISTS idx_business_events_center_type ON business_events(center_id, event_type, created_at);

CREATE OR REPLACE FUNCTION validate_group_collision()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM groups g
    WHERE g.id <> COALESCE(NEW.id, -1)
      AND g.center_id = NEW.center_id
      AND (g.teacher_id = NEW.teacher_id OR g.room_id = NEW.room_id)
      AND EXISTS (
        SELECT 1
        FROM unnest(g.schedule_days) d1
        INNER JOIN unnest(NEW.schedule_days) d2 ON d1 = d2
      )
      AND (NEW.start_time < g.end_time AND NEW.end_time > g.start_time)
  ) THEN
    RAISE EXCEPTION 'Schedule collision: teacher or room already busy';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_group_collision ON groups;
CREATE TRIGGER trg_validate_group_collision
BEFORE INSERT OR UPDATE ON groups
FOR EACH ROW
EXECUTE FUNCTION validate_group_collision();

CREATE OR REPLACE FUNCTION decrement_lessons_left_on_attendance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.attended = true THEN
    UPDATE students
    SET lessons_left = lessons_left - 1
    WHERE id = NEW.student_id
      AND center_id = NEW.center_id
      AND lessons_left > 0;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_decrement_lessons ON attendance;
CREATE TRIGGER trg_decrement_lessons
AFTER INSERT ON attendance
FOR EACH ROW
EXECUTE FUNCTION decrement_lessons_left_on_attendance();

COMMIT;
