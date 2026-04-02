CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS courses (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  language TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tariffs (
  id BIGSERIAL PRIMARY KEY,
  course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  total_lessons INTEGER NOT NULL CHECK (total_lessons > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS teachers (
  id BIGSERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  languages TEXT[] NOT NULL DEFAULT '{}',
  levels TEXT[] NOT NULL DEFAULT '{}',
  work_schedule JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rooms (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS groups (
  id BIGSERIAL PRIMARY KEY,
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
  full_name TEXT NOT NULL,
  language_focus TEXT NOT NULL,
  current_level TEXT NOT NULL CHECK (current_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  lessons_left INTEGER NOT NULL DEFAULT 0 CHECK (lessons_left >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS enrollments (
  id BIGSERIAL PRIMARY KEY,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  group_id BIGINT NOT NULL REFERENCES groups(id) ON DELETE RESTRICT,
  tariff_id BIGINT NOT NULL REFERENCES tariffs(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, group_id, status)
);

CREATE TABLE IF NOT EXISTS attendance (
  id BIGSERIAL PRIMARY KEY,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  group_id BIGINT NOT NULL REFERENCES groups(id) ON DELETE RESTRICT,
  lesson_date DATE NOT NULL,
  attended BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, group_id, lesson_date)
);

CREATE INDEX IF NOT EXISTS idx_courses_language_level ON courses(language, level);
CREATE INDEX IF NOT EXISTS idx_groups_course_id ON groups(course_id);
CREATE INDEX IF NOT EXISTS idx_groups_teacher_id ON groups(teacher_id);
CREATE INDEX IF NOT EXISTS idx_groups_room_id ON groups(room_id);
CREATE INDEX IF NOT EXISTS idx_students_language_level ON students(language_focus, current_level);
CREATE INDEX IF NOT EXISTS idx_enrollments_group_status ON enrollments(group_id, status);

CREATE OR REPLACE FUNCTION validate_group_collision()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM groups g
    WHERE g.id <> COALESCE(NEW.id, -1)
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
