const path = require('path');
const express = require('express');

const {
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
  getStudentsPageData,
  saveStudent,
  listStudents,
  listPayments,
  recordPayment,
  getTeacherTimesheetData,
} = require('./services/centerService');

require('./db');

const app = express();
const port = Number(process.env.PORT || 3000);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  res.locals.openModalId = String(req.query.modal || '');
  res.locals.flash = req.query.message
    ? {
        type: req.query.type === 'error' ? 'error' : 'success',
        message: req.query.message,
      }
    : null;

  res.locals.languageLabels = languageLabels;
  res.locals.teacherLanguageLabels = teacherLanguageLabels;
  res.locals.teacherStatusLabels = teacherStatusLabels;
  res.locals.tariffStatusLabels = tariffStatusLabels;
  res.locals.groupStatusLabels = groupStatusLabels;
  res.locals.studentStatusLabels = studentStatusLabels;
  res.locals.paymentMethodLabels = paymentMethodLabels;
  res.locals.dayLabels = dayLabels;

  next();
});

function redirectWithMessage(res, pathName, message, type = 'success', extraParams = {}) {
  const params = new URLSearchParams({ message, type });
  Object.entries(extraParams).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    params.set(key, String(value));
  });
  const separator = pathName.includes('?') ? '&' : '?';
  res.redirect(`${pathName}${separator}${params.toString()}`);
}

function encodeDraft(draft) {
  return Buffer.from(JSON.stringify(draft), 'utf8').toString('base64url');
}

function decodeDraft(rawDraft) {
  if (!rawDraft) {
    return {};
  }

  try {
    const payload = Buffer.from(String(rawDraft), 'base64url').toString('utf8');
    const parsed = JSON.parse(payload);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

app.get('/', (req, res) => {
  res.render('dashboard', getDashboardData());
});

app.get('/teachers', (req, res) => {
  const teacherDraft = decodeDraft(req.query.draft);

  res.render('teachers', {
    teachers: listTeachers(),
    teacherDraft,
  });
});

app.post('/teachers/create', (req, res) => {
  try {
    createTeacher({
      fullName: req.body.fullName,
      phone: req.body.phone,
      teachingLanguage: req.body.teachingLanguage,
      levelsText: req.body.levelsText,
      availabilityText: req.body.availabilityText,
      notes: req.body.notes,
      status: req.body.status,
    });

    redirectWithMessage(res, '/teachers', 'Преподаватель добавлен.');
  } catch (error) {
    redirectWithMessage(res, '/teachers', error.message, 'error', {
      modal: 'teacher-modal',
      draft: encodeDraft({
        fullName: req.body.fullName,
        phone: req.body.phone,
        teachingLanguage: req.body.teachingLanguage,
        levelsText: req.body.levelsText,
        availabilityText: req.body.availabilityText,
        status: req.body.status,
        notes: req.body.notes,
      }),
    });
  }
});

app.get('/tariffs', (req, res) => {
  const tariffDraft = decodeDraft(req.query.draft);

  res.render('tariffs', {
    tariffs: listTariffs(),
    tariffDraft,
  });
});

app.post('/tariffs/create', (req, res) => {
  try {
    createTariff({
      name: req.body.name,
      language: req.body.language,
      durationDays: req.body.durationDays,
      price: req.body.price,
      notes: req.body.notes,
      status: req.body.status,
    });

    redirectWithMessage(res, '/tariffs', 'Тариф создан.');
  } catch (error) {
    redirectWithMessage(res, '/tariffs', error.message, 'error', {
      modal: 'tariff-modal',
      draft: encodeDraft({
        name: req.body.name,
        language: req.body.language,
        durationDays: req.body.durationDays,
        price: req.body.price,
        status: req.body.status,
        notes: req.body.notes,
      }),
    });
  }
});

app.get('/groups', (req, res) => {
  const groupDraft = decodeDraft(req.query.draft);

  res.render('groups', {
    groups: listGroups(),
    teachers: listTeachers().filter((teacher) => teacher.status === 'active'),
    groupDraft,
  });
});

app.post('/groups/create', (req, res) => {
  try {
    createGroup({
      name: req.body.name,
      language: req.body.language,
      level: req.body.level,
      teacherId: req.body.teacherId,
      seatLimit: req.body.seatLimit,
      status: req.body.status,
      notes: req.body.notes,
    });

    redirectWithMessage(res, '/groups', 'Группа создана.');
  } catch (error) {
    redirectWithMessage(res, '/groups', error.message, 'error', {
      modal: 'group-modal',
      draft: encodeDraft({
        name: req.body.name,
        language: req.body.language,
        level: req.body.level,
        teacherId: req.body.teacherId,
        seatLimit: req.body.seatLimit,
        status: req.body.status,
        notes: req.body.notes,
      }),
    });
  }
});

app.get('/schedules', (req, res) => {
  const scheduleDraft = decodeDraft(req.query.draft);

  res.render('schedules', {
    schedules: listSchedules(),
    groups: listGroups().filter((group) => group.status === 'active'),
    scheduleDraft,
  });
});

app.post('/schedules/create', (req, res) => {
  try {
    createSchedule({
      groupId: req.body.groupId,
      dayOfWeek: req.body.dayOfWeek,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      status: req.body.status,
    });

    redirectWithMessage(res, '/schedules', 'Слот расписания добавлен.');
  } catch (error) {
    redirectWithMessage(res, '/schedules', error.message, 'error', {
      modal: 'schedule-modal',
      draft: encodeDraft({
        groupId: req.body.groupId,
        dayOfWeek: req.body.dayOfWeek,
        startTime: req.body.startTime,
        endTime: req.body.endTime,
        status: req.body.status,
      }),
    });
  }
});

app.get('/students', (req, res) => {
  const selectedStudentId = Number.parseInt(req.query.studentId, 10) || 0;
  const studentDraft = decodeDraft(req.query.draft);

  res.render('students', {
    ...getStudentsPageData(selectedStudentId),
    studentDraft,
  });
});

app.post('/students/save', (req, res) => {
  try {
    const studentId = saveStudent({
      id: req.body.id,
      fullName: req.body.fullName,
      phone: req.body.phone,
      language: req.body.language,
      level: req.body.level,
      startDate: req.body.startDate,
      tariffId: req.body.tariffId,
      groupId: req.body.groupId,
      status: req.body.status,
      notes: req.body.notes,
    });

    redirectWithMessage(res, `/students?studentId=${studentId}`, 'Карточка ученика сохранена.');
  } catch (error) {
    redirectWithMessage(res, '/students', error.message, 'error', {
      modal: 'student-modal',
      draft: encodeDraft({
        id: req.body.id,
        fullName: req.body.fullName,
        phone: req.body.phone,
        language: req.body.language,
        level: req.body.level,
        startDate: req.body.startDate,
        tariffId: req.body.tariffId,
        groupId: req.body.groupId,
        status: req.body.status,
        notes: req.body.notes,
      }),
    });
  }
});

app.get('/payments', (req, res) => {
  const paymentDraft = decodeDraft(req.query.draft);
  const selectedStudentId = Number.parseInt(req.query.studentId, 10) || Number.parseInt(paymentDraft.studentId, 10) || 0;
  const todayIso = new Date().toISOString().slice(0, 10);

  res.render('payments', {
    students: listStudents(),
    tariffs: listTariffs().filter((tariff) => tariff.status === 'active'),
    payments: listPayments(selectedStudentId),
    selectedStudentId,
    paymentDraft,
    todayIso,
  });
});

app.post('/payments/create', (req, res) => {
  try {
    recordPayment({
      studentId: req.body.studentId,
      tariffId: req.body.tariffId,
      amount: req.body.amount,
      paymentDate: req.body.paymentDate,
      paymentMethod: req.body.paymentMethod,
      notes: req.body.notes,
    });

    redirectWithMessage(res, `/payments?studentId=${req.body.studentId}`, 'Оплата сохранена.');
  } catch (error) {
    redirectWithMessage(res, '/payments', error.message, 'error', {
      modal: 'payment-modal',
      studentId: req.body.studentId,
      draft: encodeDraft({
        studentId: req.body.studentId,
        tariffId: req.body.tariffId,
        amount: req.body.amount,
        paymentDate: req.body.paymentDate,
        paymentMethod: req.body.paymentMethod,
        notes: req.body.notes,
      }),
    });
  }
});

app.get('/teacher-timesheet', (req, res) => {
  res.render('teacher-timesheet', {
    teachers: getTeacherTimesheetData(),
  });
});

app.get('/attendance', (req, res) => {
  res.redirect('/schedules');
});

app.use((req, res) => {
  res.status(404).render('dashboard', getDashboardData());
});

app.listen(port, () => {
  console.log(`Phoenix Center запущен на http://localhost:${port}`);
});
