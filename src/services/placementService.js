const db = require('../db');

const dayLabels = {
  mon: 'Пн',
  tue: 'Вт',
  wed: 'Ср',
  thu: 'Чт',
  fri: 'Пт',
  sat: 'Сб',
  sun: 'Вс',
};

const validDays = new Set(Object.keys(dayLabels));

function normalizeInteger(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeText(value) {
  return String(value || '').trim();
}

function assertPositiveId(value, fieldName) {
  const id = normalizeInteger(value, 0);
  if (id <= 0) {
    throw new Error(`Некорректный ${fieldName}.`);
  }
  return id;
}

function isOverlapping(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

function parseAvailabilityText(availabilityText) {
  const raw = normalizeText(availabilityText).toLowerCase();
  if (!raw) {
    return [];
  }

  return raw
    .split(/[\n;,]+/)
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => {
      const match = row.match(/^(mon|tue|wed|thu|fri|sat|sun)\s+([0-2]\d:[0-5]\d)\s*-\s*([0-2]\d:[0-5]\d)$/i);
      if (!match) {
        return null;
      }

      const dayOfWeek = match[1].toLowerCase();
      const startTime = match[2];
      const endTime = match[3];

      if (!validDays.has(dayOfWeek) || startTime >= endTime) {
        return null;
      }

      return { dayOfWeek, startTime, endTime };
    })
    .filter(Boolean);
}

function ensureStudentExists(studentId) {
  const student = db.prepare(`
    SELECT id, full_name, phone, status
    FROM student_profiles
    WHERE id = ?
  `).get(studentId);

  if (!student) {
    throw new Error('Ученик не найден.');
  }

  return student;
}

function ensureCourseExists(courseId) {
  const course = db.prepare(`
    SELECT id, name, duration_lessons, price, status
    FROM crm_courses
    WHERE id = ?
  `).get(courseId);

  if (!course) {
    throw new Error('Курс не найден.');
  }

  if (course.status !== 'active') {
    throw new Error('Курс неактивен.');
  }

  return course;
}

function getGroupScheduleText(groupId) {
  const slots = db.prepare(`
    SELECT day_of_week, start_time, end_time
    FROM crm_group_schedule_slots
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

  return slots
    .map((slot) => `${dayLabels[slot.day_of_week]} ${slot.start_time}-${slot.end_time}`)
    .join(', ');
}

function listCourseGroupsWithFreeSeats(courseId) {
  const groups = db.prepare(`
    SELECT
      g.id,
      g.name,
      g.course_id,
      g.teacher_id,
      g.room_id,
      t.full_name AS teacher_name,
      r.name AS room_name,
      r.capacity,
      (
        SELECT COUNT(*)
        FROM crm_group_students gs
        WHERE gs.group_id = g.id
          AND gs.status IN ('active', 'paused')
      ) AS students_count,
      (
        SELECT COUNT(*)
        FROM crm_group_schedule_slots s
        WHERE s.group_id = g.id
          AND s.status = 'active'
      ) AS active_slots_count
    FROM crm_groups g
    INNER JOIN teacher_profiles t ON t.id = g.teacher_id
    INNER JOIN crm_rooms r ON r.id = g.room_id
    WHERE g.course_id = ?
      AND g.status = 'active'
      AND t.status = 'active'
      AND r.status = 'active'
    ORDER BY g.name COLLATE NOCASE ASC
  `).all(courseId);

  return groups
    .filter((group) => group.active_slots_count > 0)
    .filter((group) => group.students_count < group.capacity)
    .map((group) => ({
      id: group.id,
      name: group.name,
      teacherId: group.teacher_id,
      teacherName: group.teacher_name,
      roomId: group.room_id,
      roomName: group.room_name,
      capacity: group.capacity,
      studentsCount: group.students_count,
      freeSeats: group.capacity - group.students_count,
      scheduleText: getGroupScheduleText(group.id),
    }));
}

function getActiveResourceSlots() {
  return db.prepare(`
    SELECT
      s.day_of_week,
      s.start_time,
      s.end_time,
      g.teacher_id,
      g.room_id
    FROM crm_group_schedule_slots s
    INNER JOIN crm_groups g ON g.id = s.group_id
    WHERE s.status = 'active'
      AND g.status = 'active'
  `).all();
}

function findNewGroupSlotSuggestions(courseId) {
  const teachers = db.prepare(`
    SELECT t.id, t.full_name, t.availability_text
    FROM teacher_profiles t
    INNER JOIN crm_teacher_courses tc ON tc.teacher_id = t.id
    WHERE tc.course_id = ?
      AND t.status = 'active'
    ORDER BY t.full_name COLLATE NOCASE ASC
  `).all(courseId);

  const rooms = db.prepare(`
    SELECT id, name, capacity
    FROM crm_rooms
    WHERE status = 'active'
    ORDER BY capacity DESC, name COLLATE NOCASE ASC
  `).all();

  const activeSlots = getActiveResourceSlots();
  const suggestions = [];

  teachers.forEach((teacher) => {
    const availableSlots = parseAvailabilityText(teacher.availability_text);

    availableSlots.forEach((slot) => {
      const teacherBusy = activeSlots.some((used) => {
        if (used.teacher_id !== teacher.id) {
          return false;
        }

        if (used.day_of_week !== slot.dayOfWeek) {
          return false;
        }

        return isOverlapping(slot.startTime, slot.endTime, used.start_time, used.end_time);
      });

      if (teacherBusy) {
        return;
      }

      const freeRooms = rooms.filter((room) => {
        return !activeSlots.some((used) => {
          if (used.room_id !== room.id) {
            return false;
          }

          if (used.day_of_week !== slot.dayOfWeek) {
            return false;
          }

          return isOverlapping(slot.startTime, slot.endTime, used.start_time, used.end_time);
        });
      });

      if (!freeRooms.length) {
        return;
      }

      suggestions.push({
        teacherId: teacher.id,
        teacherName: teacher.full_name,
        dayOfWeek: slot.dayOfWeek,
        dayLabel: dayLabels[slot.dayOfWeek],
        startTime: slot.startTime,
        endTime: slot.endTime,
        availableRooms: freeRooms.map((room) => ({
          roomId: room.id,
          roomName: room.name,
          capacity: room.capacity,
        })),
      });
    });
  });

  return suggestions;
}

function assertNoResourceConflicts({
  teacherId,
  roomId,
  dayOfWeek,
  startTime,
  endTime,
  excludeGroupId = 0,
}) {
  const conflict = db.prepare(`
    SELECT
      g.id AS group_id,
      g.name AS group_name,
      s.start_time,
      s.end_time,
      CASE
        WHEN g.teacher_id = ? THEN 'teacher'
        WHEN g.room_id = ? THEN 'room'
        ELSE ''
      END AS conflict_type
    FROM crm_group_schedule_slots s
    INNER JOIN crm_groups g ON g.id = s.group_id
    WHERE s.status = 'active'
      AND g.status = 'active'
      AND s.day_of_week = ?
      AND s.start_time < ?
      AND s.end_time > ?
      AND g.id != ?
      AND (g.teacher_id = ? OR g.room_id = ?)
    LIMIT 1
  `).get(
    teacherId,
    roomId,
    dayOfWeek,
    endTime,
    startTime,
    normalizeInteger(excludeGroupId, 0),
    teacherId,
    roomId,
  );

  if (!conflict) {
    return;
  }

  if (conflict.conflict_type === 'teacher') {
    throw new Error(`Конфликт преподавателя с группой "${conflict.group_name}" (${conflict.start_time}-${conflict.end_time}).`);
  }

  throw new Error(`Конфликт кабинета с группой "${conflict.group_name}" (${conflict.start_time}-${conflict.end_time}).`);
}

function findAvailablePlacements(studentIdValue, courseIdValue) {
  const studentId = assertPositiveId(studentIdValue, 'studentId');
  const courseId = assertPositiveId(courseIdValue, 'courseId');

  const student = ensureStudentExists(studentId);
  const course = ensureCourseExists(courseId);

  const availableGroups = listCourseGroupsWithFreeSeats(courseId);
  const newGroupSlotSuggestions = findNewGroupSlotSuggestions(courseId);

  return {
    student,
    course,
    availableGroups,
    newGroupSlotSuggestions,
  };
}

module.exports = {
  findAvailablePlacements,
  assertNoResourceConflicts,
};
