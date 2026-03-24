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
`);

module.exports = db;