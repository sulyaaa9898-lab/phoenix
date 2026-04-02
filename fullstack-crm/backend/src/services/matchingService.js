import { query } from '../db.js';

const weekdays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function toMinutes(timeText) {
  const [hours, minutes] = String(timeText || '00:00').split(':').map(Number);
  return (hours * 60) + minutes;
}

function overlaps(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

function parseTeacherAvailability(scheduleJson) {
  if (!scheduleJson || typeof scheduleJson !== 'object') {
    return [];
  }

  const slots = [];
  weekdays.forEach((day) => {
    const daySlots = Array.isArray(scheduleJson[day]) ? scheduleJson[day] : [];
    daySlots.forEach((slot) => {
      if (!slot || !slot.start || !slot.end) {
        return;
      }

      const startMinutes = toMinutes(slot.start);
      const endMinutes = toMinutes(slot.end);
      if (startMinutes >= endMinutes) {
        return;
      }

      slots.push({
        day,
        start: slot.start,
        end: slot.end,
        startMinutes,
        endMinutes,
      });
    });
  });

  return slots;
}

async function getBusySlotsByTeacher(teacherId) {
  const { rows } = await query(
    `
      SELECT g.schedule_days, g.start_time::text AS start_time, g.end_time::text AS end_time
      FROM groups g
      WHERE g.teacher_id = $1
    `,
    [teacherId],
  );

  const busy = [];
  rows.forEach((row) => {
    (row.schedule_days || []).forEach((isoDay) => {
      const day = weekdays[(isoDay || 1) - 1];
      if (!day) {
        return;
      }

      busy.push({
        day,
        startMinutes: toMinutes(row.start_time),
        endMinutes: toMinutes(row.end_time),
      });
    });
  });

  return busy;
}

async function getBusySlotsByRoom(roomId) {
  const { rows } = await query(
    `
      SELECT g.schedule_days, g.start_time::text AS start_time, g.end_time::text AS end_time
      FROM groups g
      WHERE g.room_id = $1
    `,
    [roomId],
  );

  const busy = [];
  rows.forEach((row) => {
    (row.schedule_days || []).forEach((isoDay) => {
      const day = weekdays[(isoDay || 1) - 1];
      if (!day) {
        return;
      }

      busy.push({
        day,
        startMinutes: toMinutes(row.start_time),
        endMinutes: toMinutes(row.end_time),
      });
    });
  });

  return busy;
}

export async function getMatchingResources(language, level) {
  const teacherResult = await query(
    `
      SELECT id, full_name, languages, levels, work_schedule
      FROM teachers
      WHERE $1 = ANY(languages)
        AND $2 = ANY(levels)
      ORDER BY full_name ASC
    `,
    [language, level],
  );

  const groupsResult = await query(
    `
      SELECT
        g.id,
        g.course_id,
        g.teacher_id,
        g.room_id,
        g.schedule_days,
        g.start_time::text AS start_time,
        g.end_time::text AS end_time,
        g.max_students,
        c.title AS course_title,
        t.full_name AS teacher_name,
        r.name AS room_name,
        r.capacity,
        COUNT(e.id) FILTER (WHERE e.status = 'active')::int AS current_students
      FROM groups g
      INNER JOIN courses c ON c.id = g.course_id
      INNER JOIN teachers t ON t.id = g.teacher_id
      INNER JOIN rooms r ON r.id = g.room_id
      LEFT JOIN enrollments e ON e.group_id = g.id
      WHERE c.language = $1
        AND c.level = $2
      GROUP BY g.id, c.title, t.full_name, r.name, r.capacity
      HAVING COUNT(e.id) FILTER (WHERE e.status = 'active') < r.capacity
         AND COUNT(e.id) FILTER (WHERE e.status = 'active') < g.max_students
      ORDER BY g.id DESC
    `,
    [language, level],
  );

  if (groupsResult.rows.length > 0) {
    return {
      matchingTeachers: teacherResult.rows,
      availableGroups: groupsResult.rows,
      availableSlots: [],
    };
  }

  const roomsResult = await query(
    `
      SELECT id, name, capacity
      FROM rooms
      ORDER BY capacity DESC, name ASC
    `,
  );

  const availableSlots = [];

  for (const teacher of teacherResult.rows) {
    const teacherAvailability = parseTeacherAvailability(teacher.work_schedule);
    if (!teacherAvailability.length) {
      continue;
    }

    const teacherBusy = await getBusySlotsByTeacher(teacher.id);

    for (const slot of teacherAvailability) {
      const teacherHasCollision = teacherBusy.some((busy) => {
        return busy.day === slot.day && overlaps(slot.startMinutes, slot.endMinutes, busy.startMinutes, busy.endMinutes);
      });

      if (teacherHasCollision) {
        continue;
      }

      const freeRooms = [];
      for (const room of roomsResult.rows) {
        const roomBusy = await getBusySlotsByRoom(room.id);
        const roomHasCollision = roomBusy.some((busy) => {
          return busy.day === slot.day && overlaps(slot.startMinutes, slot.endMinutes, busy.startMinutes, busy.endMinutes);
        });

        if (!roomHasCollision) {
          freeRooms.push(room);
        }
      }

      if (!freeRooms.length) {
        continue;
      }

      availableSlots.push({
        teacherId: teacher.id,
        teacherName: teacher.full_name,
        day: slot.day,
        startTime: slot.start,
        endTime: slot.end,
        rooms: freeRooms,
      });
    }
  }

  return {
    matchingTeachers: teacherResult.rows,
    availableGroups: [],
    availableSlots,
  };
}
