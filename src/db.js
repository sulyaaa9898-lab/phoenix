const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const databasePath = path.join(__dirname, '..', 'data', 'phoenix-center.db');
const db = new DatabaseSync(databasePath);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA synchronous = FULL;');
db.exec('PRAGMA busy_timeout = 5000;');

db.transaction = (callback) => {
  return (...args) => {
    db.exec('BEGIN IMMEDIATE;');
    try {
      const result = callback(...args);
      db.exec('COMMIT;');
      return result;
    } catch (error) {
      try {
        db.exec('ROLLBACK;');
      } catch (rollbackError) {
        // Ignore rollback errors and surface the original failure.
      }
      throw error;
    }
  };
};

db.exec(`
  CREATE TABLE IF NOT EXISTS teacher_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    teaching_language TEXT NOT NULL CHECK (teaching_language IN ('english', 'chinese', 'both')),
    levels_text TEXT NOT NULL,
    availability_text TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tariff_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    language TEXT NOT NULL CHECK (language IN ('english', 'chinese')),
    format TEXT NOT NULL DEFAULT 'group' CHECK (format = 'group'),
    duration_days INTEGER NOT NULL CHECK (duration_days > 0),
    price REAL NOT NULL CHECK (price >= 0),
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS study_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    language TEXT NOT NULL CHECK (language IN ('english', 'chinese')),
    level TEXT NOT NULL,
    teacher_id INTEGER NOT NULL,
    seat_limit INTEGER NOT NULL DEFAULT 8 CHECK (seat_limit > 0),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES teacher_profiles (id) ON DELETE RESTRICT
  );

  CREATE TABLE IF NOT EXISTS group_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    day_of_week TEXT NOT NULL CHECK (day_of_week IN ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')),
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    language TEXT NOT NULL CHECK (language IN ('english', 'chinese')),
    level TEXT NOT NULL,
    teacher_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES study_groups (id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES teacher_profiles (id) ON DELETE RESTRICT,
    UNIQUE (group_id, day_of_week, start_time)
  );

  CREATE TABLE IF NOT EXISTS student_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    language TEXT NOT NULL CHECK (language IN ('english', 'chinese')),
    level TEXT NOT NULL,
    start_date TEXT NOT NULL,
    tariff_id INTEGER NOT NULL,
    group_id INTEGER,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pause', 'completed')),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tariff_id) REFERENCES tariff_plans (id) ON DELETE RESTRICT,
    FOREIGN KEY (group_id) REFERENCES study_groups (id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS payment_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    tariff_id INTEGER NOT NULL,
    amount REAL NOT NULL CHECK (amount > 0),
    payment_date TEXT NOT NULL,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'transfer')),
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES student_profiles (id) ON DELETE CASCADE,
    FOREIGN KEY (tariff_id) REFERENCES tariff_plans (id) ON DELETE RESTRICT
  );

  CREATE INDEX IF NOT EXISTS idx_study_groups_teacher_id ON study_groups (teacher_id);
  CREATE INDEX IF NOT EXISTS idx_group_schedules_group_id ON group_schedules (group_id);
  CREATE INDEX IF NOT EXISTS idx_group_schedules_teacher_id ON group_schedules (teacher_id);
  CREATE INDEX IF NOT EXISTS idx_student_profiles_group_id ON student_profiles (group_id);
  CREATE INDEX IF NOT EXISTS idx_student_profiles_tariff_id ON student_profiles (tariff_id);
  CREATE INDEX IF NOT EXISTS idx_payment_records_student_id ON payment_records (student_id);
  CREATE INDEX IF NOT EXISTS idx_payment_records_tariff_id ON payment_records (tariff_id);

  CREATE TABLE IF NOT EXISTS crm_courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    duration_lessons INTEGER NOT NULL CHECK (duration_lessons > 0),
    price REAL NOT NULL CHECK (price >= 0),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS crm_rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS crm_teacher_courses (
    teacher_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (teacher_id, course_id),
    FOREIGN KEY (teacher_id) REFERENCES teacher_profiles (id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES crm_courses (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS crm_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    course_id INTEGER NOT NULL,
    teacher_id INTEGER NOT NULL,
    room_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES crm_courses (id) ON DELETE RESTRICT,
    FOREIGN KEY (teacher_id) REFERENCES teacher_profiles (id) ON DELETE RESTRICT,
    FOREIGN KEY (room_id) REFERENCES crm_rooms (id) ON DELETE RESTRICT
  );

  CREATE TABLE IF NOT EXISTS crm_group_schedule_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    day_of_week TEXT NOT NULL CHECK (day_of_week IN ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')),
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (start_time < end_time),
    UNIQUE (group_id, day_of_week, start_time),
    FOREIGN KEY (group_id) REFERENCES crm_groups (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS crm_group_students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'removed')),
    enrolled_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (group_id, student_id),
    FOREIGN KEY (group_id) REFERENCES crm_groups (id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES student_profiles (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS crm_student_accounts (
    student_id INTEGER PRIMARY KEY,
    balance REAL NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES student_profiles (id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_crm_teacher_courses_course ON crm_teacher_courses (course_id);
  CREATE INDEX IF NOT EXISTS idx_crm_groups_course ON crm_groups (course_id);
  CREATE INDEX IF NOT EXISTS idx_crm_groups_teacher ON crm_groups (teacher_id);
  CREATE INDEX IF NOT EXISTS idx_crm_groups_room ON crm_groups (room_id);
  CREATE INDEX IF NOT EXISTS idx_crm_group_slots_group ON crm_group_schedule_slots (group_id);
  CREATE INDEX IF NOT EXISTS idx_crm_group_students_group ON crm_group_students (group_id);
  CREATE INDEX IF NOT EXISTS idx_crm_group_students_student ON crm_group_students (student_id);

  CREATE TRIGGER IF NOT EXISTS trg_crm_teacher_no_overlap_insert
  BEFORE INSERT ON crm_group_schedule_slots
  WHEN NEW.status = 'active'
  BEGIN
    SELECT CASE
      WHEN EXISTS (
        SELECT 1
        FROM crm_group_schedule_slots existing_slot
        INNER JOIN crm_groups existing_group ON existing_group.id = existing_slot.group_id
        INNER JOIN crm_groups new_group ON new_group.id = NEW.group_id
        WHERE existing_slot.status = 'active'
          AND existing_group.status = 'active'
          AND new_group.status = 'active'
          AND existing_slot.day_of_week = NEW.day_of_week
          AND existing_slot.group_id != NEW.group_id
          AND existing_group.teacher_id = new_group.teacher_id
          AND NEW.start_time < existing_slot.end_time
          AND NEW.end_time > existing_slot.start_time
      )
      THEN RAISE(ABORT, 'Teacher has overlapping schedule slot.')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS trg_crm_teacher_no_overlap_update
  BEFORE UPDATE ON crm_group_schedule_slots
  WHEN NEW.status = 'active'
  BEGIN
    SELECT CASE
      WHEN EXISTS (
        SELECT 1
        FROM crm_group_schedule_slots existing_slot
        INNER JOIN crm_groups existing_group ON existing_group.id = existing_slot.group_id
        INNER JOIN crm_groups new_group ON new_group.id = NEW.group_id
        WHERE existing_slot.status = 'active'
          AND existing_group.status = 'active'
          AND new_group.status = 'active'
          AND existing_slot.day_of_week = NEW.day_of_week
          AND existing_slot.id != NEW.id
          AND existing_group.teacher_id = new_group.teacher_id
          AND NEW.start_time < existing_slot.end_time
          AND NEW.end_time > existing_slot.start_time
      )
      THEN RAISE(ABORT, 'Teacher has overlapping schedule slot.')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS trg_crm_room_no_overlap_insert
  BEFORE INSERT ON crm_group_schedule_slots
  WHEN NEW.status = 'active'
  BEGIN
    SELECT CASE
      WHEN EXISTS (
        SELECT 1
        FROM crm_group_schedule_slots existing_slot
        INNER JOIN crm_groups existing_group ON existing_group.id = existing_slot.group_id
        INNER JOIN crm_groups new_group ON new_group.id = NEW.group_id
        WHERE existing_slot.status = 'active'
          AND existing_group.status = 'active'
          AND new_group.status = 'active'
          AND existing_slot.day_of_week = NEW.day_of_week
          AND existing_slot.group_id != NEW.group_id
          AND existing_group.room_id = new_group.room_id
          AND NEW.start_time < existing_slot.end_time
          AND NEW.end_time > existing_slot.start_time
      )
      THEN RAISE(ABORT, 'Room has overlapping schedule slot.')
    END;
  END;

  CREATE TRIGGER IF NOT EXISTS trg_crm_room_no_overlap_update
  BEFORE UPDATE ON crm_group_schedule_slots
  WHEN NEW.status = 'active'
  BEGIN
    SELECT CASE
      WHEN EXISTS (
        SELECT 1
        FROM crm_group_schedule_slots existing_slot
        INNER JOIN crm_groups existing_group ON existing_group.id = existing_slot.group_id
        INNER JOIN crm_groups new_group ON new_group.id = NEW.group_id
        WHERE existing_slot.status = 'active'
          AND existing_group.status = 'active'
          AND new_group.status = 'active'
          AND existing_slot.day_of_week = NEW.day_of_week
          AND existing_slot.id != NEW.id
          AND existing_group.room_id = new_group.room_id
          AND NEW.start_time < existing_slot.end_time
          AND NEW.end_time > existing_slot.start_time
      )
      THEN RAISE(ABORT, 'Room has overlapping schedule slot.')
    END;
  END;
`);

module.exports = db;