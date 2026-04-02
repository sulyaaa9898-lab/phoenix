-- Demo seed for Education CRM
-- Run after schema.sql

BEGIN;

INSERT INTO courses (title, language, level)
VALUES
  ('General English B1', 'English', 'B1'),
  ('General English B2', 'English', 'B2'),
  ('Spoken Chinese A2', 'Chinese', 'A2')
ON CONFLICT DO NOTHING;

INSERT INTO tariffs (course_id, price, total_lessons)
SELECT c.id, v.price, v.total_lessons
FROM (VALUES
  ('General English B1', 240000.00, 24),
  ('General English B2', 280000.00, 24),
  ('Spoken Chinese A2', 220000.00, 20)
) AS v(title, price, total_lessons)
INNER JOIN courses c ON c.title = v.title;

INSERT INTO rooms (name, capacity)
VALUES
  ('Room A', 10),
  ('Room B', 8),
  ('Room C', 12)
ON CONFLICT (name) DO NOTHING;

INSERT INTO teachers (full_name, languages, levels, work_schedule)
VALUES
  (
    'Nodira Karimova',
    ARRAY['English'],
    ARRAY['B1', 'B2', 'C1'],
    '{"mon":[{"start":"18:00","end":"20:00"}],"wed":[{"start":"18:00","end":"20:00"}],"fri":[{"start":"17:00","end":"19:00"}]}'::jsonb
  ),
  (
    'Aziz Zhang',
    ARRAY['Chinese', 'English'],
    ARRAY['A2', 'B1'],
    '{"tue":[{"start":"18:00","end":"20:00"}],"thu":[{"start":"18:00","end":"20:00"}],"sat":[{"start":"10:00","end":"12:00"}]}'::jsonb
  ),
  (
    'Malika Saidova',
    ARRAY['English'],
    ARRAY['A2', 'B1'],
    '{"mon":[{"start":"16:00","end":"18:00"}],"thu":[{"start":"16:00","end":"18:00"}]}'::jsonb
  )
ON CONFLICT DO NOTHING;

WITH ids AS (
  SELECT
    (SELECT id FROM courses WHERE title = 'General English B1' LIMIT 1) AS course_b1,
    (SELECT id FROM courses WHERE title = 'General English B2' LIMIT 1) AS course_b2,
    (SELECT id FROM courses WHERE title = 'Spoken Chinese A2' LIMIT 1) AS course_zh,
    (SELECT id FROM teachers WHERE full_name = 'Nodira Karimova' LIMIT 1) AS t_nodira,
    (SELECT id FROM teachers WHERE full_name = 'Aziz Zhang' LIMIT 1) AS t_aziz,
    (SELECT id FROM teachers WHERE full_name = 'Malika Saidova' LIMIT 1) AS t_malika,
    (SELECT id FROM rooms WHERE name = 'Room A' LIMIT 1) AS r_a,
    (SELECT id FROM rooms WHERE name = 'Room B' LIMIT 1) AS r_b,
    (SELECT id FROM rooms WHERE name = 'Room C' LIMIT 1) AS r_c
)
INSERT INTO groups (course_id, teacher_id, room_id, schedule_days, start_time, end_time, max_students)
SELECT ids.course_b1, ids.t_nodira, ids.r_a, ARRAY[1,3], '18:00', '20:00', 10 FROM ids
UNION ALL
SELECT ids.course_b2, ids.t_nodira, ids.r_c, ARRAY[5], '17:00', '19:00', 10 FROM ids
UNION ALL
SELECT ids.course_zh, ids.t_aziz, ids.r_b, ARRAY[2,4], '18:00', '20:00', 8 FROM ids;

INSERT INTO students (full_name, language_focus, current_level, lessons_left)
VALUES
  ('Ali Vohidov', 'English', 'B1', 10),
  ('Madina Rustamova', 'English', 'B1', 6),
  ('Bekzod Chen', 'Chinese', 'A2', 12)
ON CONFLICT DO NOTHING;

WITH refs AS (
  SELECT
    (SELECT id FROM students WHERE full_name = 'Ali Vohidov' LIMIT 1) AS s_ali,
    (SELECT id FROM students WHERE full_name = 'Madina Rustamova' LIMIT 1) AS s_madina,
    (SELECT id FROM students WHERE full_name = 'Bekzod Chen' LIMIT 1) AS s_bekzod,
    (SELECT g.id
      FROM groups g
      INNER JOIN courses c ON c.id = g.course_id
      WHERE c.title = 'General English B1'
      LIMIT 1) AS g_b1,
    (SELECT g.id
      FROM groups g
      INNER JOIN courses c ON c.id = g.course_id
      WHERE c.title = 'Spoken Chinese A2'
      LIMIT 1) AS g_zh,
    (SELECT t.id
      FROM tariffs t
      INNER JOIN courses c ON c.id = t.course_id
      WHERE c.title = 'General English B1'
      LIMIT 1) AS tariff_b1,
    (SELECT t.id
      FROM tariffs t
      INNER JOIN courses c ON c.id = t.course_id
      WHERE c.title = 'Spoken Chinese A2'
      LIMIT 1) AS tariff_zh
)
INSERT INTO enrollments (student_id, group_id, tariff_id, status)
SELECT refs.s_ali, refs.g_b1, refs.tariff_b1, 'active' FROM refs
UNION ALL
SELECT refs.s_madina, refs.g_b1, refs.tariff_b1, 'active' FROM refs
UNION ALL
SELECT refs.s_bekzod, refs.g_zh, refs.tariff_zh, 'active' FROM refs;

COMMIT;
