const editButtons = document.querySelectorAll('[data-edit-student]');
const resetButton = document.querySelector('[data-reset-student-form]');
const studentForm = document.querySelector('#student-form');

function setSidebarCollapsed(collapsed) {
  document.body.classList.toggle('sidebar-collapsed', collapsed);
}

// If user navigated here via a sidebar link, keep sidebar open
const keepSidebarOpen = sessionStorage.getItem('sidebarOpen') === '1';
sessionStorage.removeItem('sidebarOpen');

if (!keepSidebarOpen) {
  // Collapse on load without animation flash
  document.body.classList.add('sidebar-no-transition');
  setSidebarCollapsed(true);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.body.classList.remove('sidebar-no-transition');
    });
  });
}

const sidebarElement = document.querySelector('.sidebar');

if (sidebarElement) {
  // Open sidebar when clicking it while collapsed
  sidebarElement.addEventListener('click', (e) => {
    if (document.body.classList.contains('sidebar-collapsed')) {
      e.preventDefault();
      setSidebarCollapsed(false);
    }
  });

  // Remember sidebar was open so it stays open after navigation
  sidebarElement.querySelectorAll('.sidebar-nav a').forEach((link) => {
    link.addEventListener('click', () => {
      if (!document.body.classList.contains('sidebar-collapsed')) {
        sessionStorage.setItem('sidebarOpen', '1');
      }
    });
  });
}

// Close sidebar when clicking anywhere outside it
document.addEventListener('click', (e) => {
  if (
    !document.body.classList.contains('sidebar-collapsed') &&
    sidebarElement &&
    !sidebarElement.contains(e.target)
  ) {
    setSidebarCollapsed(true);
  }
});

const modalElements = Array.from(document.querySelectorAll('[data-modal]'));

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) {
    return;
  }

  modal.classList.add('is-open');
  document.body.classList.add('modal-open');
}

function closeModal(modalElement) {
  if (!modalElement) {
    return;
  }

  modalElement.classList.remove('is-open');
  const anyOpen = modalElements.some((item) => item.classList.contains('is-open'));
  if (!anyOpen) {
    document.body.classList.remove('modal-open');
  }
}

document.querySelectorAll('[data-open-modal]').forEach((button) => {
  button.addEventListener('click', () => {
    openModal(button.dataset.openModal);
  });
});

document.querySelectorAll('[data-close-modal]').forEach((button) => {
  button.addEventListener('click', () => {
    closeModal(button.closest('[data-modal]'));
  });
});

modalElements.forEach((modal) => {
  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      closeModal(modal);
    }
  });
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') {
    return;
  }

  const opened = modalElements.find((modal) => modal.classList.contains('is-open'));
  if (opened) {
    closeModal(opened);
  }
});

const autoOpenModalId = document.body.dataset.openModal;
if (autoOpenModalId) {
  openModal(autoOpenModalId);
}

if (studentForm) {
  const wizardPanels = Array.from(studentForm.querySelectorAll('[data-step-panel]'));
  const wizardIndicators = Array.from(studentForm.querySelectorAll('[data-step-indicator]'));
  const prevButton = studentForm.querySelector('[data-wizard-prev]');
  const nextButton = studentForm.querySelector('[data-wizard-next]');

  const formFields = {
    id: document.querySelector('#student-id'),
    fullName: document.querySelector('#student-full-name'),
    phone: document.querySelector('#student-phone'),
    language: document.querySelector('#student-language'),
    level: document.querySelector('#student-level'),
    startDate: document.querySelector('#student-start-date'),
    tariffId: document.querySelector('#student-tariff-id'),
    groupId: document.querySelector('#student-group-id'),
    status: document.querySelector('#student-status'),
    notes: document.querySelector('#student-notes'),
    submitButton: document.querySelector('#student-submit-button'),
    groupInfo: document.querySelector('#group-auto-info'),
  };

  let currentStep = 1;

  const getMaxStep = () => wizardPanels.length || 1;

  const updateWizardView = () => {
    const maxStep = getMaxStep();
    const boundedStep = Math.min(Math.max(currentStep, 1), maxStep);
    currentStep = boundedStep;

    wizardPanels.forEach((panel) => {
      panel.classList.toggle('is-active', Number(panel.dataset.stepPanel) === currentStep);
    });

    wizardIndicators.forEach((indicator) => {
      indicator.classList.toggle('is-active', Number(indicator.dataset.stepIndicator) === currentStep);
    });

    if (prevButton) {
      prevButton.disabled = currentStep === 1;
    }

    if (nextButton) {
      nextButton.style.display = currentStep === maxStep ? 'none' : 'inline-flex';
    }

    if (formFields.submitButton) {
      formFields.submitButton.style.display = currentStep === maxStep ? 'inline-flex' : 'none';
    }
  };

  const validateCurrentStep = () => {
    const activePanel = wizardPanels.find((panel) => Number(panel.dataset.stepPanel) === currentStep);
    if (!activePanel) {
      return true;
    }

    const controls = activePanel.querySelectorAll('input, select, textarea');
    for (const control of controls) {
      if (typeof control.reportValidity === 'function' && !control.reportValidity()) {
        return false;
      }
    }

    return true;
  };

  const updateGroupInfo = () => {
    if (!formFields.groupInfo || !formFields.groupId) {
      return;
    }

    const selectedOption = formFields.groupId.selectedOptions[0];
    if (!selectedOption || !selectedOption.value) {
      formFields.groupInfo.innerHTML = '';
      return;
    }

    const teacher = selectedOption.dataset.teacher || '—';
    const schedule = selectedOption.dataset.schedule || '—';
    formFields.groupInfo.innerHTML = `<p><strong>Преподаватель:</strong> ${teacher}</p><p><strong>Расписание:</strong> ${schedule}</p>`;
  };

  const clearStudentForm = () => {
    formFields.id.value = '';
    formFields.fullName.value = '';
    formFields.phone.value = '';
    formFields.language.value = 'english';
    formFields.level.value = '';
    formFields.startDate.value = '';
    formFields.tariffId.value = '';
    formFields.groupId.value = '';
    formFields.status.value = 'active';
    formFields.notes.value = '';
    formFields.submitButton.textContent = 'Сохранить ученика';
    updateGroupInfo();
    currentStep = 1;
    updateWizardView();
  };

  editButtons.forEach((button) => {
    button.addEventListener('click', () => {
      openModal('student-modal');
      formFields.id.value = button.dataset.id;
      formFields.fullName.value = button.dataset.fullName;
      formFields.phone.value = button.dataset.phone;
      formFields.language.value = button.dataset.language;
      formFields.level.value = button.dataset.level;
      formFields.startDate.value = button.dataset.startDate;
      formFields.tariffId.value = button.dataset.tariffId;
      formFields.groupId.value = button.dataset.groupId;
      formFields.status.value = button.dataset.status;
      formFields.notes.value = button.dataset.notes;
      formFields.submitButton.textContent = 'Обновить ученика';
      updateGroupInfo();
      currentStep = 1;
      updateWizardView();
    });
  });

  if (nextButton) {
    nextButton.addEventListener('click', () => {
      if (!validateCurrentStep()) {
        return;
      }

      currentStep += 1;
      updateWizardView();
    });
  }

  if (prevButton) {
    prevButton.addEventListener('click', () => {
      currentStep -= 1;
      updateWizardView();
    });
  }

  wizardIndicators.forEach((indicator) => {
    indicator.addEventListener('click', () => {
      const targetStep = Number(indicator.dataset.stepIndicator);
      if (targetStep > currentStep && !validateCurrentStep()) {
        return;
      }

      currentStep = targetStep;
      updateWizardView();
    });
  });

  if (formFields.groupId) {
    formFields.groupId.addEventListener('change', updateGroupInfo);
  }

  updateGroupInfo();
  updateWizardView();

  if (formFields.id && formFields.id.value && formFields.submitButton) {
    formFields.submitButton.textContent = 'Обновить ученика';
  }

  if (resetButton) {
    resetButton.addEventListener('click', clearStudentForm);
  }
}
