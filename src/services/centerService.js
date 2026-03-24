const db = require('../db');

const languageLabels = {
  english: 'Английский',
  chinese: 'Китайский',
};

const teacherLanguageLabels = {
  english: 'Английский',
  chinese: 'Китайский',
  both: 'Оба языка',
};

const teacherStatusLabels = {
  active: 'Активен',
  inactive: 'Неактивен',
};

const groupStatusLabels = {
  active: 'Активна',
  inactive: 'Неактивна',
};

const studentStatusLabels = {
  active: 'Активен',
  pause: 'Пауза',
  completed: 'Завершил',
};

const tariffStatusLabels = {
  active: 'Активен',
  inactive: 'Неактивен',
};

const paymentMethodLabels = {
  cash: 'Наличные',
  transfer: 'Перевод',
};

const dayLabels = {
  mon: 'Пн',
  tue: 'Вт',
  wed: 'Ср',
  thu: 'Чт',
  fri: 'Пт',
  sat: 'Сб',
  sun: 'Вс',
};

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeInteger(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeAmount(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeLevelKey(value) {
  const raw = normalizeText(value).toUpperCase();
  if (!raw) {
    return '';
  }

  const map = {
    А: 'A',
    В: 'B',
    С: 'C',
    Е: 'E',
    Н: 'H',
    К: 'K',
    М: 'M',
    О: 'O',
    Р: 'P',
    Т: 'T',
    Х: 'X',
  };

  return raw
    .split('')
    .map((character) => map[character] || character)
    .join('')
    .replace(/\s+/g, '')
    .replace(/[._-]/g, '');
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(isoDate, daysToAdd) {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + daysToAdd);
  return toIsoDate(date);
}

function calculateRemainingDays(periodEndIso) {
  if (!periodEndIso) {
    return null;
  }

  const today = new Date(`${toIsoDate(new Date())}T00:00:00`);
  const endDate = new Date(`${periodEndIso}T00:00:00`);
  const diffMs = endDate.getTime() - today.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

function ensureLanguage(language) {
  if (!languageLabels[language]) {
    throw new Error('Некорректный язык.');
  }
}

function ensureTeacherLanguage(value) {
  if (!teacherLanguageLabels[value]) {
    throw new Error('Некорректный язык преподавания.');
  }
}

function ensurePaymentMethod(value) {
  if (!paymentMethodLabels[value]) {
    throw new Error('Некорректный способ оплаты.');
  }
}

function ensureTeacherStatus(value) {
  if (!teacherStatusLabels[value]) {
    throw new Error('Некорректный статус преподавателя.');
  }
}

function ensureTariffStatus(value) {
  if (!tariffStatusLabels[value]) {
    throw new Error('Некорректный статус тарифа.');
  }
}

function ensureGroupStatus(value) {
  if (!groupStatusLabels[value]) {
    throw new Error('Некорректный статус группы.');
  }
}

function ensureStudentStatus(value) {
  if (!studentStatusLabels[value]) {
    throw new Error('Некорректный статус ученика.');
  }
}

function ensureTeacherExists(teacherId) {
  const teacher = db.prepare('SELECT * FROM teacher_profiles WHERE id = ?').get(teacherId);
  if (!teacher) {
    throw new Error('Преподаватель не найден.');
  }
  return teacher;
}

function ensureTariffExists(tariffId) {
  const tariff = db.prepare('SELECT * FROM tariff_plans WHERE id = ?').get(tariffId);
  if (!tariff) {
    throw new Error('Тариф не найден.');
  }
  return tariff;
}

function ensureGroupExists(groupId) {
  const group = db.prepare(`
    SELECT g.*, t.full_name AS teacher_name, t.teaching_language, t.status AS teacher_status
    FROM study_groups g
    INNER JOIN teacher_profiles t ON t.id = g.teacher_id
    WHERE g.id = ?
  `).get(groupId);
  if (!group) {
    throw new Error('Группа не найдена.');
  }
  return group;
}

function ensureStudentExists(studentId) {
  const student = db.prepare('SELECT * FROM student_profiles WHERE id = ?').get(studentId);
  if (!student) {
    throw new Error('Ученик не найден.');
  }
  return student;
}

function teacherSupportsLanguage(teacherLanguage, language) {
  return teacherLanguage === 'both' || teacherLanguage === language;
}

function groupHasActiveSchedule(groupId) {
  const result = db.prepare(`
    SELECT COUNT(*) AS count
    FROM group_schedules
    WHERE group_id = ? AND status = 'active'
  `).get(groupId);
  return result.count > 0;
}

function getGroupScheduleText(groupId) {
  const rows = db.prepare(`
    SELECT day_of_week, start_time, end_time
    FROM group_schedules
    WHERE group_id = ? AND status = 'active'
    ORDER BY CASE day_of_week
      WHEN 'mon' THEN 1
      WHEN 'tue' THEN 2
      WHEN 'wed' THEN 3
      WHEN 'thu' THEN 4
      WHEN 'fri' THEN 5
      WHEN 'sat' THEN 6
      WHEN 'sun' THEN 7
    END, start_time
  `).all(groupId);

  return rows.map((item) => `${dayLabels[item.day_of_week]} ${item.start_time}-${item.end_time}`).join(', ');
}

function countBusyStudentsInGroup(groupId, excludeStudentId = 0) {
  const result = db.prepare(`
    SELECT COUNT(*) AS count
    FROM student_profiles
    WHERE group_id = ?
      AND status IN ('active', 'pause')
      AND id != ?
  `).get(groupId, excludeStudentId);
  return result.count;
}

function ensureGroupEligibleForStudent(groupId, language, level, excludeStudentId = 0) {
  const group = ensureGroupExists(groupId);

  if (group.status !== 'active') {
    throw new Error('Выбранная группа неактивна.');
  }

  if (group.teacher_status !== 'active') {
    throw new Error('У группы назначен неактивный преподаватель.');
  }

  if (!teacherSupportsLanguage(group.teaching_language, group.language)) {
    throw new Error('Язык преподавателя не совпадает с языком группы.');
  }

  if (!groupHasActiveSchedule(groupId)) {
    throw new Error('У группы нет активного расписания.');
  }

  if (group.language !== language) {
    throw new Error('Язык ученика и группы не совпадают.');
  }

  if (normalizeLevelKey(group.level) !== normalizeLevelKey(level)) {
    throw new Error('Уровень ученика и группы не совпадают.');
  }

  const busyStudents = countBusyStudentsInGroup(groupId, excludeStudentId);
  if (busyStudents >= group.seat_limit) {
    throw new Error('В выбранной группе нет свободных мест.');
  }

  return {
    ...group,
    busy_students: busyStudents,
    schedule_text: getGroupScheduleText(groupId),
  };
}

function getMatchingGroups(language, level, excludeStudentId = 0) {
  if (!language || !level) {
    return [];
  }

  const rows = db.prepare(`
    SELECT
      g.id,
      g.name,
      g.language,
      g.level,
      g.seat_limit,
      g.status,
      g.teacher_id,
      t.full_name AS teacher_name,
      t.status AS teacher_status,
      t.teaching_language,
      (
        SELECT COUNT(*)
        FROM student_profiles s
        WHERE s.group_id = g.id
          AND s.status IN ('active', 'pause')
          AND s.id != ?
      ) AS busy_students,
      (
        SELECT COUNT(*)
        FROM group_schedules sc
        WHERE sc.group_id = g.id AND sc.status = 'active'
      ) AS schedule_count
    FROM study_groups g
    INNER JOIN teacher_profiles t ON t.id = g.teacher_id
    WHERE g.language = ?
      AND g.status = 'active'
    ORDER BY g.name COLLATE NOCASE ASC
  `).all(excludeStudentId, language);

  return rows
    .filter((group) => group.teacher_status === 'active')
    .filter((group) => teacherSupportsLanguage(group.teaching_language, group.language))
    .filter((group) => normalizeLevelKey(group.level) === normalizeLevelKey(level))
    .filter((group) => group.schedule_count > 0)
    .filter((group) => group.busy_students < group.seat_limit)
    .map((group) => ({
      ...group,
      free_slots: group.seat_limit - group.busy_students,
      schedule_text: getGroupScheduleText(group.id),
    }));
}

function listTeachers() {
  return db.prepare(`
    SELECT *
    FROM teacher_profiles
    ORDER BY status ASC, full_name COLLATE NOCASE ASC
  `).all();
}

function createTeacher(payload) {
  const fullName = normalizeText(payload.fullName);
  const phone = normalizeText(payload.phone);
  const teachingLanguage = normalizeText(payload.teachingLanguage);
  const levelsText = normalizeText(payload.levelsText);
  const availabilityText = normalizeText(payload.availabilityText);
  const notes = normalizeText(payload.notes);
  const status = normalizeText(payload.status || 'active');

  if (!fullName || !phone || !teachingLanguage || !levelsText) {
    throw new Error('Заполните обязательные поля преподавателя.');
  }

  ensureTeacherLanguage(teachingLanguage);
  ensureTeacherStatus(status);

  db.prepare(`
    INSERT INTO teacher_profiles (full_name, phone, teaching_language, levels_text, availability_text, notes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(fullName, phone, teachingLanguage, levelsText, availabilityText || null, notes || null, status);
}

function listTariffs() {
  return db.prepare(`
    SELECT *
    FROM tariff_plans
    ORDER BY status ASC, language ASC, price ASC
  `).all();
}

function createTariff(payload) {
  const name = normalizeText(payload.name);
  const language = normalizeText(payload.language);
  const durationDays = normalizeInteger(payload.durationDays, 0);
  const price = normalizeAmount(payload.price);
  const notes = normalizeText(payload.notes);
  const status = normalizeText(payload.status || 'active');

  if (!name || !language || durationDays <= 0 || price < 0) {
    throw new Error('Заполните обязательные поля тарифа.');
  }

  ensureLanguage(language);
  ensureTariffStatus(status);

  db.prepare(`
    INSERT INTO tariff_plans (name, language, format, duration_days, price, notes, status)
    VALUES (?, ?, 'group', ?, ?, ?, ?)
  `).run(name, language, durationDays, price, notes || null, status);
}

function listGroups() {
  const groups = db.prepare(`
    SELECT
      g.*,
      t.full_name AS teacher_name,
      t.status AS teacher_status,
      (
        SELECT COUNT(*)
        FROM student_profiles s
        WHERE s.group_id = g.id
          AND s.status IN ('active', 'pause')
      ) AS busy_students,
      (
        SELECT COUNT(*)
        FROM group_schedules sc
        WHERE sc.group_id = g.id AND sc.status = 'active'
      ) AS schedule_count
    FROM study_groups g
    INNER JOIN teacher_profiles t ON t.id = g.teacher_id
    ORDER BY g.name COLLATE NOCASE ASC
  `).all();

  const studentsByGroup = db.prepare(`
    SELECT group_id, full_name, status
    FROM student_profiles
    WHERE group_id IS NOT NULL
    ORDER BY full_name COLLATE NOCASE ASC
  `).all();

  const groupedStudents = studentsByGroup.reduce((accumulator, row) => {
    if (!accumulator[row.group_id]) {
      accumulator[row.group_id] = [];
    }
    accumulator[row.group_id].push(row);
    return accumulator;
  }, {});

  return groups.map((group) => ({
    ...group,
    free_slots: group.seat_limit - group.busy_students,
    schedule_text: getGroupScheduleText(group.id),
    students: groupedStudents[group.id] || [],
  }));
}

function createGroup(payload) {
  const name = normalizeText(payload.name);
  const language = normalizeText(payload.language);
  const level = normalizeText(payload.level);
  const teacherId = normalizeInteger(payload.teacherId, 0);
  const seatLimit = normalizeInteger(payload.seatLimit, 0);
  const status = normalizeText(payload.status || 'active');
  const notes = normalizeText(payload.notes);

  if (!name || !language || !level || teacherId <= 0 || seatLimit <= 0) {
    throw new Error('Заполните обязательные поля группы.');
  }

  ensureLanguage(language);
  ensureGroupStatus(status);

  const teacher = ensureTeacherExists(teacherId);
  if (teacher.status !== 'active') {
    throw new Error('Назначьте активного преподавателя.');
  }

  if (!teacherSupportsLanguage(teacher.teaching_language, language)) {
    throw new Error('Язык преподавателя не подходит для выбранного языка группы.');
  }

  db.prepare(`
    INSERT INTO study_groups (name, language, level, teacher_id, seat_limit, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(name, language, level, teacherId, seatLimit, status, notes || null);
}

function listSchedules() {
  return db.prepare(`
    SELECT
      sc.*,
      g.name AS group_name,
      g.status AS group_status,
      t.full_name AS teacher_name
    FROM group_schedules sc
    INNER JOIN study_groups g ON g.id = sc.group_id
    INNER JOIN teacher_profiles t ON t.id = sc.teacher_id
    ORDER BY CASE sc.day_of_week
      WHEN 'mon' THEN 1
      WHEN 'tue' THEN 2
      WHEN 'wed' THEN 3
      WHEN 'thu' THEN 4
      WHEN 'fri' THEN 5
      WHEN 'sat' THEN 6
      WHEN 'sun' THEN 7
    END, sc.start_time, g.name COLLATE NOCASE ASC
  `).all();
}

function createSchedule(payload) {
  const groupId = normalizeInteger(payload.groupId, 0);
  const dayOfWeek = normalizeText(payload.dayOfWeek);
  const startTime = normalizeText(payload.startTime);
  const endTime = normalizeText(payload.endTime);
  const status = normalizeText(payload.status || 'active');

  if (groupId <= 0 || !dayOfWeek || !startTime || !endTime) {
    throw new Error('Заполните обязательные поля расписания.');
  }

  if (!DAYS.includes(dayOfWeek)) {
    throw new Error('Некорректный день недели.');
  }

  if (startTime >= endTime) {
    throw new Error('Время начала должно быть меньше времени окончания.');
  }

  ensureGroupStatus(status);

  const group = ensureGroupExists(groupId);

  if (group.status !== 'active') {
    throw new Error('Нельзя добавить расписание к неактивной группе.');
  }

  if (group.teacher_status !== 'active') {
    throw new Error('У группы должен быть активный преподаватель.');
  }

  db.prepare(`
    INSERT INTO group_schedules (group_id, day_of_week, start_time, end_time, language, level, teacher_id, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(groupId, dayOfWeek, startTime, endTime, group.language, group.level, group.teacher_id, status);
}

function listStudents() {
  const students = db.prepare(`
    SELECT
      s.*,
      g.name AS group_name,
      g.language AS group_language,
      g.level AS group_level,
      t.full_name AS teacher_name,
      tf.name AS tariff_name,
      tf.duration_days,
      tf.price,
      (
        SELECT p.period_end
        FROM payment_records p
        WHERE p.student_id = s.id
        ORDER BY p.payment_date DESC, p.id DESC
        LIMIT 1
      ) AS latest_period_end
    FROM student_profiles s
    LEFT JOIN study_groups g ON g.id = s.group_id
    LEFT JOIN teacher_profiles t ON t.id = g.teacher_id
    LEFT JOIN tariff_plans tf ON tf.id = s.tariff_id
    ORDER BY s.full_name COLLATE NOCASE ASC
  `).all();

  return students.map((student) => ({
    ...student,
    schedule_text: student.group_id ? getGroupScheduleText(student.group_id) : '',
    tariff_days_left: calculateRemainingDays(student.latest_period_end),
  }));
}

function getStudentById(studentId) {
  if (!studentId) {
    return null;
  }

  const student = db.prepare(`
    SELECT
      s.*,
      g.name AS group_name,
      g.language AS group_language,
      g.level AS group_level,
      t.full_name AS teacher_name,
      tf.name AS tariff_name,
      tf.duration_days,
      tf.price,
      (
        SELECT p.period_end
        FROM payment_records p
        WHERE p.student_id = s.id
        ORDER BY p.payment_date DESC, p.id DESC
        LIMIT 1
      ) AS latest_period_end
    FROM student_profiles s
    LEFT JOIN study_groups g ON g.id = s.group_id
    LEFT JOIN teacher_profiles t ON t.id = g.teacher_id
    LEFT JOIN tariff_plans tf ON tf.id = s.tariff_id
    WHERE s.id = ?
  `).get(studentId);

  if (!student) {
    return null;
  }

  return {
    ...student,
    schedule_text: student.group_id ? getGroupScheduleText(student.group_id) : '',
    tariff_days_left: calculateRemainingDays(student.latest_period_end),
  };
}

function getStudentPayments(studentId) {
  return db.prepare(`
    SELECT
      p.*,
      t.name AS tariff_name,
      t.duration_days
    FROM payment_records p
    INNER JOIN tariff_plans t ON t.id = p.tariff_id
    WHERE p.student_id = ?
    ORDER BY p.payment_date DESC, p.id DESC
  `).all(studentId);
}

const saveStudent = db.transaction((payload) => {
  const studentId = normalizeInteger(payload.id, 0);
  const fullName = normalizeText(payload.fullName);
  const phone = normalizeText(payload.phone);
  const language = normalizeText(payload.language);
  const level = normalizeText(payload.level);
  const startDate = normalizeText(payload.startDate);
  const tariffId = normalizeInteger(payload.tariffId, 0);
  const groupId = normalizeInteger(payload.groupId, 0) || null;
  const status = normalizeText(payload.status || 'active');
  const notes = normalizeText(payload.notes);

  if (!fullName || !phone || !language || !level || !startDate || tariffId <= 0) {
    throw new Error('Заполните обязательные поля ученика.');
  }

  ensureLanguage(language);
  ensureStudentStatus(status);

  const tariff = ensureTariffExists(tariffId);
  if (tariff.status !== 'active') {
    throw new Error('Можно назначить только активный тариф.');
  }
  if (tariff.language !== language) {
    throw new Error('Язык тарифа должен совпадать с языком обучения ученика.');
  }

  if (groupId) {
    ensureGroupEligibleForStudent(groupId, language, level, studentId);
  }

  if (studentId > 0) {
    ensureStudentExists(studentId);
    db.prepare(`
      UPDATE student_profiles
      SET
        full_name = ?,
        phone = ?,
        language = ?,
        level = ?,
        start_date = ?,
        tariff_id = ?,
        group_id = ?,
        status = ?,
        notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(fullName, phone, language, level, startDate, tariffId, groupId, status, notes || null, studentId);
    return studentId;
  }

  const result = db.prepare(`
    INSERT INTO student_profiles (full_name, phone, language, level, start_date, tariff_id, group_id, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(fullName, phone, language, level, startDate, tariffId, groupId, status, notes || null);

  return Number(result.lastInsertRowid);
});

function getDashboardData() {
  const stats = {
    studentsCount: db.prepare('SELECT COUNT(*) AS count FROM student_profiles').get().count,
    activeTeachersCount: db.prepare("SELECT COUNT(*) AS count FROM teacher_profiles WHERE status = 'active'").get().count,
    activeGroupsCount: db.prepare("SELECT COUNT(*) AS count FROM study_groups WHERE status = 'active'").get().count,
    activeTariffsCount: db.prepare("SELECT COUNT(*) AS count FROM tariff_plans WHERE status = 'active'").get().count,
  };

  const studentsWithoutGroup = db.prepare(`
    SELECT id, full_name, language, level
    FROM student_profiles
    WHERE status IN ('active', 'pause')
      AND group_id IS NULL
    ORDER BY full_name COLLATE NOCASE ASC
    LIMIT 10
  `).all();

  const today = toIsoDate(new Date());

  const subscriptionRows = db.prepare(`
    SELECT
      s.id,
      s.full_name,
      (
        SELECT p.period_end
        FROM payment_records p
        WHERE p.student_id = s.id
        ORDER BY p.payment_date DESC, p.id DESC
        LIMIT 1
      ) AS latest_period_end
    FROM student_profiles s
    WHERE s.status IN ('active', 'pause')
  `).all();

  const expiredSubscriptions = subscriptionRows
    .filter((row) => !row.latest_period_end || row.latest_period_end < today)
    .slice(0, 10);

  const recentPayments = db.prepare(`
    SELECT
      p.id,
      p.amount,
      p.payment_date,
      p.payment_method,
      p.period_start,
      p.period_end,
      s.full_name AS student_name,
      t.name AS tariff_name
    FROM payment_records p
    INNER JOIN student_profiles s ON s.id = p.student_id
    INNER JOIN tariff_plans t ON t.id = p.tariff_id
    ORDER BY p.payment_date DESC, p.id DESC
    LIMIT 10
  `).all();

  return {
    stats,
    studentsWithoutGroup,
    expiredSubscriptions,
    recentPayments,
  };
}

function getStudentsPageData(selectedStudentId = 0, queryLanguage = '', queryLevel = '') {
  const students = listStudents();
  const tariffs = db.prepare(`
    SELECT *
    FROM tariff_plans
    WHERE status = 'active'
    ORDER BY language ASC, duration_days ASC, price ASC
  `).all();

  const selectedStudent = getStudentById(selectedStudentId);
  const selectedLanguage = queryLanguage || (selectedStudent ? selectedStudent.language : 'english');
  const selectedLevel = queryLevel || (selectedStudent ? selectedStudent.level : 'A1');
  const matchingGroups = getMatchingGroups(selectedLanguage, selectedLevel, selectedStudentId);
  const paymentHistory = selectedStudent ? getStudentPayments(selectedStudentId) : [];

  return {
    students,
    tariffs,
    selectedStudent,
    selectedLanguage,
    selectedLevel,
    matchingGroups,
    paymentHistory,
  };
}

function listPayments(studentId = 0) {
  const selectedStudentId = normalizeInteger(studentId, 0);

  if (selectedStudentId > 0) {
    return db.prepare(`
      SELECT
        p.*,
        s.full_name AS student_name,
        t.name AS tariff_name
      FROM payment_records p
      INNER JOIN student_profiles s ON s.id = p.student_id
      INNER JOIN tariff_plans t ON t.id = p.tariff_id
      WHERE p.student_id = ?
      ORDER BY p.payment_date DESC, p.id DESC
    `).all(selectedStudentId);
  }

  return db.prepare(`
    SELECT
      p.*,
      s.full_name AS student_name,
      t.name AS tariff_name
    FROM payment_records p
    INNER JOIN student_profiles s ON s.id = p.student_id
    INNER JOIN tariff_plans t ON t.id = p.tariff_id
    ORDER BY p.payment_date DESC, p.id DESC
  `).all();
}

const recordPayment = db.transaction((payload) => {
  const studentId = normalizeInteger(payload.studentId, 0);
  const selectedTariffId = normalizeInteger(payload.tariffId, 0);
  const amount = normalizeAmount(payload.amount);
  const paymentDate = normalizeText(payload.paymentDate);
  const paymentMethod = normalizeText(payload.paymentMethod);
  const notes = normalizeText(payload.notes);

  if (studentId <= 0 || !paymentDate || amount <= 0) {
    throw new Error('Для оплаты выберите ученика, дату и сумму.');
  }

  ensurePaymentMethod(paymentMethod);

  const student = ensureStudentExists(studentId);
  const tariffId = selectedTariffId > 0 ? selectedTariffId : student.tariff_id;
  const tariff = ensureTariffExists(tariffId);

  if (tariff.status !== 'active') {
    throw new Error('Оплата возможна только по активному тарифу.');
  }

  if (tariff.language !== student.language) {
    throw new Error('Язык тарифа должен совпадать с языком ученика.');
  }

  const periodStart = paymentDate;
  const periodEnd = addDays(periodStart, tariff.duration_days - 1);

  db.prepare(`
    INSERT INTO payment_records (
      student_id,
      tariff_id,
      amount,
      payment_date,
      payment_method,
      period_start,
      period_end,
      notes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(studentId, tariffId, amount, paymentDate, paymentMethod, periodStart, periodEnd, notes || null);
});

function getTeacherTimesheetData() {
  const teachers = db.prepare(`
    SELECT *
    FROM teacher_profiles
    ORDER BY status ASC, full_name COLLATE NOCASE ASC
  `).all();

  const groupsByTeacher = db.prepare(`
    SELECT id, name, teacher_id, language, level, status
    FROM study_groups
    ORDER BY name COLLATE NOCASE ASC
  `).all();

  const schedulesByTeacher = db.prepare(`
    SELECT
      sc.teacher_id,
      sc.day_of_week,
      sc.start_time,
      sc.end_time,
      sc.status,
      g.name AS group_name,
      g.language,
      g.level
    FROM group_schedules sc
    INNER JOIN study_groups g ON g.id = sc.group_id
    ORDER BY CASE sc.day_of_week
      WHEN 'mon' THEN 1
      WHEN 'tue' THEN 2
      WHEN 'wed' THEN 3
      WHEN 'thu' THEN 4
      WHEN 'fri' THEN 5
      WHEN 'sat' THEN 6
      WHEN 'sun' THEN 7
    END, sc.start_time
  `).all();

  return teachers.map((teacher) => {
    const groups = groupsByTeacher.filter((item) => item.teacher_id === teacher.id);
    const schedules = schedulesByTeacher.filter((item) => item.teacher_id === teacher.id);
    const activeSlots = schedules.filter((item) => item.status === 'active').length;

    return {
      ...teacher,
      groups,
      schedules,
      weekly_load: activeSlots,
      groups_count: groups.length,
    };
  });
}

module.exports = {
  languageLabels,
  teacherLanguageLabels,
  teacherStatusLabels,
  tariffStatusLabels,
  groupStatusLabels,
  studentStatusLabels,
  paymentMethodLabels,
  dayLabels,
  getDashboardData,
  listTeachers,
  createTeacher,
  listTariffs,
  createTariff,
  listGroups,
  createGroup,
  listSchedules,
  createSchedule,
  listStudents,
  getStudentById,
  getStudentsPageData,
  saveStudent,
  listPayments,
  recordPayment,
  getTeacherTimesheetData,
};
