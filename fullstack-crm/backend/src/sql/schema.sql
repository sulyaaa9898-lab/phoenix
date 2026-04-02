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

CREATE TABLE IF NOT EXISTS courses (
  id BIGSERIAL PRIMARY KEY,
  center_id UUID NOT NULL REFERENCES education_centers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  language TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tariffs (
  id BIGSERIAL PRIMARY KEY,
  center_id UUID NOT NULL REFERENCES education_centers(id) ON DELETE CASCADE,
  course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  total_lessons INTEGER NOT NULL CHECK (total_lessons > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS teachers (
  id BIGSERIAL PRIMARY KEY,
  center_id UUID NOT NULL REFERENCES education_centers(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  languages TEXT[] NOT NULL DEFAULT '{}',
  levels TEXT[] NOT NULL DEFAULT '{}',
  work_schedule JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rooms (
  id BIGSERIAL PRIMARY KEY,
  center_id UUID NOT NULL REFERENCES education_centers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS groups (
  id BIGSERIAL PRIMARY KEY,
  center_id UUID NOT NULL REFERENCES education_centers(id) ON DELETE CASCADE,
  course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  teacher_id BIGINT NOT NULL REFERENCES teachers(id) ON DELETE RESTRICT,
  room_id BIGINT NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
  schedule_days SMALLINT[] NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  max_students INTEGER NOT NULL CHECK (max_students > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (start_time < end_time)
);

CREATE TABLE IF NOT EXISTS students (
  id BIGSERIAL PRIMARY KEY,
  center_id UUID NOT NULL REFERENCES education_centers(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  language_focus TEXT NOT NULL,
  current_level TEXT NOT NULL CHECK (current_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  lessons_left INTEGER NOT NULL DEFAULT 0 CHECK (lessons_left >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS enrollments (
  id BIGSERIAL PRIMARY KEY,
  center_id UUID NOT NULL REFERENCES education_centers(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  group_id BIGINT NOT NULL REFERENCES groups(id) ON DELETE RESTRICT,
  tariff_id BIGINT NOT NULL REFERENCES tariffs(id) ON DELETE RESTRICT,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (center_id, student_id, group_id, status)
);

CREATE TABLE IF NOT EXISTS attendance (
  id BIGSERIAL PRIMARY KEY,
  center_id UUID NOT NULL REFERENCES education_centers(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  group_id BIGINT NOT NULL REFERENCES groups(id) ON DELETE RESTRICT,
  lesson_date DATE NOT NULL,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  attended BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (center_id, student_id, group_id, lesson_date)
);

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

DROP INDEX IF EXISTS idx_courses_language_level;
DROP INDEX IF EXISTS idx_groups_course_id;
DROP INDEX IF EXISTS idx_groups_teacher_id;
DROP INDEX IF EXISTS idx_groups_room_id;
DROP INDEX IF EXISTS idx_students_language_level;
DROP INDEX IF EXISTS idx_enrollments_group_status;

CREATE UNIQUE INDEX IF NOT EXISTS uq_rooms_center_name ON rooms(center_id, name);
CREATE INDEX IF NOT EXISTS idx_courses_center_language_level ON courses(center_id, language, level);
CREATE INDEX IF NOT EXISTS idx_groups_center_course_id ON groups(center_id, course_id);
CREATE INDEX IF NOT EXISTS idx_groups_center_teacher_id ON groups(center_id, teacher_id);
CREATE INDEX IF NOT EXISTS idx_groups_center_room_id ON groups(center_id, room_id);
CREATE INDEX IF NOT EXISTS idx_students_center_language_level ON students(center_id, language_focus, current_level);
CREATE INDEX IF NOT EXISTS idx_enrollments_center_group_status ON enrollments(center_id, group_id, status);
CREATE INDEX IF NOT EXISTS idx_attendance_center_date ON attendance(center_id, lesson_date);
CREATE INDEX IF NOT EXISTS idx_business_events_center_type ON business_events(center_id, event_type, created_at);

ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_name_key;

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
