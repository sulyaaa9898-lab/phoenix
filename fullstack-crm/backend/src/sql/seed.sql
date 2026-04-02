-- Demo seed for Education CRM
-- Run after schema.sql

BEGIN;

INSERT INTO education_centers (id, name, phone, status)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Phoenix Main Center', '+998900000001', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, name, email, password_hash)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Platform Owner', 'platform@phoenix.local', 'seed_platform_owner_hash'),
  ('00000000-0000-0000-0000-000000000002', 'Center Owner', 'owner@phoenix.local', 'seed_center_owner_hash'),
  ('00000000-0000-0000-0000-000000000003', 'Center Manager', 'manager@phoenix.local', 'seed_manager_hash')
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_center_roles (user_id, center_id, role)
VALUES
  ('00000000-0000-0000-0000-000000000001', NULL, 'platform_owner'),
  ('00000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'center_owner'),
  ('00000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'manager')
ON CONFLICT DO NOTHING;

INSERT INTO courses (center_id, title, language, level)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'General English B1', 'English', 'B1'),
  ('11111111-1111-1111-1111-111111111111', 'General English B2', 'English', 'B2'),
  ('11111111-1111-1111-1111-111111111111', 'Spoken Chinese A2', 'Chinese', 'A2')
ON CONFLICT DO NOTHING;

INSERT INTO tariffs (center_id, course_id, price, total_lessons)
SELECT c.center_id, c.id, v.price, v.total_lessons
FROM (VALUES
  ('General English B1', 240000.00, 24),
  ('General English B2', 280000.00, 24),
  ('Spoken Chinese A2', 220000.00, 20)
) AS v(title, price, total_lessons)
INNER JOIN courses c ON c.title = v.title;

INSERT INTO rooms (center_id, name, capacity)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Room A', 10),
  ('11111111-1111-1111-1111-111111111111', 'Room B', 8),
  ('11111111-1111-1111-1111-111111111111', 'Room C', 12)
ON CONFLICT (center_id, name) DO NOTHING;

INSERT INTO teachers (center_id, full_name, languages, levels, work_schedule)
VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    'Nodira Karimova',
    ARRAY['English'],
    ARRAY['B1', 'B2', 'C1'],
    '{"mon":[{"start":"18:00","end":"20:00"}],"wed":[{"start":"18:00","end":"20:00"}],"fri":[{"start":"17:00","end":"19:00"}]}'::jsonb
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    'Aziz Zhang',
    ARRAY['Chinese', 'English'],
    ARRAY['A2', 'B1'],
    '{"tue":[{"start":"18:00","end":"20:00"}],"thu":[{"start":"18:00","end":"20:00"}],"sat":[{"start":"10:00","end":"12:00"}]}'::jsonb
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    'Malika Saidova',
    ARRAY['English'],
    ARRAY['A2', 'B1'],
    '{"mon":[{"start":"16:00","end":"18:00"}],"thu":[{"start":"16:00","end":"18:00"}]}'::jsonb
  )
ON CONFLICT DO NOTHING;

WITH ids AS (
  SELECT
    '11111111-1111-1111-1111-111111111111'::uuid AS center_id,
    (SELECT id FROM courses WHERE center_id = '11111111-1111-1111-1111-111111111111' AND title = 'General English B1' LIMIT 1) AS course_b1,
    (SELECT id FROM courses WHERE center_id = '11111111-1111-1111-1111-111111111111' AND title = 'General English B2' LIMIT 1) AS course_b2,
    (SELECT id FROM courses WHERE center_id = '11111111-1111-1111-1111-111111111111' AND title = 'Spoken Chinese A2' LIMIT 1) AS course_zh,
    (SELECT id FROM teachers WHERE center_id = '11111111-1111-1111-1111-111111111111' AND full_name = 'Nodira Karimova' LIMIT 1) AS t_nodira,
    (SELECT id FROM teachers WHERE center_id = '11111111-1111-1111-1111-111111111111' AND full_name = 'Aziz Zhang' LIMIT 1) AS t_aziz,
    (SELECT id FROM teachers WHERE center_id = '11111111-1111-1111-1111-111111111111' AND full_name = 'Malika Saidova' LIMIT 1) AS t_malika,
    (SELECT id FROM rooms WHERE center_id = '11111111-1111-1111-1111-111111111111' AND name = 'Room A' LIMIT 1) AS r_a,
    (SELECT id FROM rooms WHERE center_id = '11111111-1111-1111-1111-111111111111' AND name = 'Room B' LIMIT 1) AS r_b,
    (SELECT id FROM rooms WHERE center_id = '11111111-1111-1111-1111-111111111111' AND name = 'Room C' LIMIT 1) AS r_c
)
INSERT INTO groups (center_id, course_id, teacher_id, room_id, schedule_days, start_time, end_time, max_students)
SELECT ids.center_id, ids.course_b1, ids.t_nodira, ids.r_a, ARRAY[1,3], '18:00', '20:00', 10 FROM ids
UNION ALL
SELECT ids.center_id, ids.course_b2, ids.t_nodira, ids.r_c, ARRAY[5], '17:00', '19:00', 10 FROM ids
UNION ALL
SELECT ids.center_id, ids.course_zh, ids.t_aziz, ids.r_b, ARRAY[2,4], '18:00', '20:00', 8 FROM ids;

INSERT INTO students (center_id, full_name, language_focus, current_level, created_by_user_id, lessons_left)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Ali Vohidov', 'English', 'B1', '00000000-0000-0000-0000-000000000003', 10),
  ('11111111-1111-1111-1111-111111111111', 'Madina Rustamova', 'English', 'B1', '00000000-0000-0000-0000-000000000003', 6),
  ('11111111-1111-1111-1111-111111111111', 'Bekzod Chen', 'Chinese', 'A2', '00000000-0000-0000-0000-000000000003', 12)
ON CONFLICT DO NOTHING;

WITH refs AS (
  SELECT
    '11111111-1111-1111-1111-111111111111'::uuid AS center_id,
    (SELECT id FROM students WHERE center_id = '11111111-1111-1111-1111-111111111111' AND full_name = 'Ali Vohidov' LIMIT 1) AS s_ali,
    (SELECT id FROM students WHERE center_id = '11111111-1111-1111-1111-111111111111' AND full_name = 'Madina Rustamova' LIMIT 1) AS s_madina,
    (SELECT id FROM students WHERE center_id = '11111111-1111-1111-1111-111111111111' AND full_name = 'Bekzod Chen' LIMIT 1) AS s_bekzod,
    (SELECT g.id
      FROM groups g
      INNER JOIN courses c ON c.id = g.course_id
      WHERE g.center_id = '11111111-1111-1111-1111-111111111111'
        AND c.title = 'General English B1'
      LIMIT 1) AS g_b1,
    (SELECT g.id
      FROM groups g
      INNER JOIN courses c ON c.id = g.course_id
      WHERE g.center_id = '11111111-1111-1111-1111-111111111111'
        AND c.title = 'Spoken Chinese A2'
      LIMIT 1) AS g_zh,
    (SELECT t.id
      FROM tariffs t
      INNER JOIN courses c ON c.id = t.course_id
      WHERE t.center_id = '11111111-1111-1111-1111-111111111111'
        AND c.title = 'General English B1'
      LIMIT 1) AS tariff_b1,
    (SELECT t.id
      FROM tariffs t
      INNER JOIN courses c ON c.id = t.course_id
      WHERE t.center_id = '11111111-1111-1111-1111-111111111111'
        AND c.title = 'Spoken Chinese A2'
      LIMIT 1) AS tariff_zh
)
INSERT INTO enrollments (center_id, student_id, group_id, tariff_id, created_by_user_id, status)
SELECT refs.center_id, refs.s_ali, refs.g_b1, refs.tariff_b1, '00000000-0000-0000-0000-000000000003', 'active' FROM refs
UNION ALL
SELECT refs.center_id, refs.s_madina, refs.g_b1, refs.tariff_b1, '00000000-0000-0000-0000-000000000003', 'active' FROM refs
UNION ALL
SELECT refs.center_id, refs.s_bekzod, refs.g_zh, refs.tariff_zh, '00000000-0000-0000-0000-000000000003', 'active' FROM refs;

COMMIT;
