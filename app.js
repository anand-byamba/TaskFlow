// ============================================
// TASK MANAGER APPLICATION
// ============================================

class TaskManager {
    constructor(cloudSync = null) {
        this.cloudSync = cloudSync;
        this.tasks = this.loadTasks();
        this.currentFilter = 'all';
        this.currentMonth = new Date();
        this.selectedDate = null;
        this.editingTaskId = null;

        this.init();
    }

    init() {
        this.bindEvents();
        this.renderCalendar();
        this.renderTaskList();
        this.setDefaultDate();
    }

    // ============================================
    // LOCAL STORAGE & CLOUD SYNC
    // ============================================
    loadTasks() {
        const saved = localStorage.getItem('taskflow-tasks');
        return saved ? JSON.parse(saved) : [];
    }

    saveTasks() {
        localStorage.setItem('taskflow-tasks', JSON.stringify(this.tasks));
        this.syncToCloud();
    }

    async syncToCloud() {
        if (this.cloudSync && this.cloudSync.isEnabled()) {
            const syncStatus = document.getElementById('syncStatus');
            if (syncStatus) {
                syncStatus.classList.add('syncing');
                syncStatus.querySelector('.sync-text').textContent = 'Syncing...';
            }

            await this.cloudSync.syncTasks(this.tasks);

            if (syncStatus) {
                syncStatus.classList.remove('syncing');
                syncStatus.querySelector('.sync-text').textContent = 'Synced';
            }
        }
    }

    setTasks(tasks) {
        this.tasks = tasks;
        localStorage.setItem('taskflow-tasks', JSON.stringify(this.tasks));
        this.renderCalendar();
        this.renderTaskList();
    }

    // ============================================
    // EVENT BINDINGS
    // ============================================
    bindEvents() {
        // Form submission
        document.getElementById('taskForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleFormSubmit();
        });

        // Cancel edit button
        document.getElementById('cancelBtn').addEventListener('click', () => {
            this.cancelEdit();
        });

        // Calendar navigation
        document.getElementById('prevMonth').addEventListener('click', () => {
            this.navigateMonth(-1);
        });

        document.getElementById('nextMonth').addEventListener('click', () => {
            this.navigateMonth(1);
        });

        document.getElementById('todayBtn').addEventListener('click', () => {
            this.goToToday();
        });

        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setFilter(e.target.dataset.filter);
            });
        });
    }

    // ============================================
    // TASK CRUD OPERATIONS
    // ============================================
    handleFormSubmit() {
        const title = document.getElementById('taskTitle').value.trim();
        const description = document.getElementById('taskDescription').value.trim();
        const date = document.getElementById('taskDate').value;
        const recurrence = document.getElementById('taskRecurrence').value;

        if (!title || !date) return;

        if (this.editingTaskId) {
            // Update existing task
            this.updateTask(this.editingTaskId, { title, description, date, recurrence });
        } else {
            // Create new task
            this.addTask({ title, description, date, recurrence });
        }

        this.resetForm();
        this.renderCalendar();
        this.renderTaskList();
        this.renderDayTasks();
    }

    addTask(taskData) {
        const task = {
            id: Date.now().toString(),
            title: taskData.title,
            description: taskData.description,
            date: taskData.date,
            recurrence: taskData.recurrence,
            completed: false,
            createdAt: new Date().toISOString()
        };

        this.tasks.push(task);
        this.saveTasks();
    }

    updateTask(id, updates) {
        const taskIndex = this.tasks.findIndex(t => t.id === id);
        if (taskIndex !== -1) {
            this.tasks[taskIndex] = { ...this.tasks[taskIndex], ...updates };
            this.saveTasks();
        }
    }

    deleteTask(id) {
        this.tasks = this.tasks.filter(t => t.id !== id);
        this.saveTasks();
        this.renderCalendar();
        this.renderTaskList();
        this.renderDayTasks();
    }

    toggleComplete(id) {
        const task = this.tasks.find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            this.saveTasks();
            this.renderTaskList();
            this.renderDayTasks();
        }
    }

    editTask(id) {
        const task = this.tasks.find(t => t.id === id);
        if (!task) return;

        this.editingTaskId = id;

        // Populate form
        document.getElementById('taskId').value = task.id;
        document.getElementById('taskTitle').value = task.title;
        document.getElementById('taskDescription').value = task.description || '';
        document.getElementById('taskDate').value = task.date;
        document.getElementById('taskRecurrence').value = task.recurrence;

        // Update form UI
        document.getElementById('formTitle').textContent = 'Edit Task';
        document.getElementById('submitBtn').textContent = 'Update Task';
        document.getElementById('cancelBtn').style.display = 'block';

        // Scroll to form
        document.querySelector('.task-form-card').scrollIntoView({ behavior: 'smooth' });
    }

    cancelEdit() {
        this.editingTaskId = null;
        this.resetForm();
    }

    resetForm() {
        document.getElementById('taskForm').reset();
        document.getElementById('taskId').value = '';
        document.getElementById('formTitle').textContent = 'New Task';
        document.getElementById('submitBtn').textContent = 'Add Task';
        document.getElementById('cancelBtn').style.display = 'none';
        this.editingTaskId = null;
        this.setDefaultDate();
    }

    setDefaultDate() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('taskDate').value = today;
    }

    // ============================================
    // TASK FILTERING & RECURRENCE
    // ============================================
    setFilter(filter) {
        this.currentFilter = filter;

        // Update active button
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });

        this.renderTaskList();
    }

    getFilteredTasks() {
        if (this.currentFilter === 'all') {
            return this.tasks;
        }
        return this.tasks.filter(task => {
            if (this.currentFilter === 'daily') return task.recurrence === 'daily';
            if (this.currentFilter === 'weekly') return task.recurrence === 'weekly';
            if (this.currentFilter === 'monthly') return task.recurrence === 'monthly';
            return true;
        });
    }

    getTasksForDate(dateStr) {
        const checkDate = new Date(dateStr + 'T00:00:00');

        return this.tasks.filter(task => {
            const taskDate = new Date(task.date + 'T00:00:00');

            // One-time task
            if (task.recurrence === 'none') {
                return task.date === dateStr;
            }

            // Task must have started (compare date strings directly to avoid timezone issues)
            if (dateStr < task.date) return false;

            // Daily recurrence
            if (task.recurrence === 'daily') {
                return true;
            }

            // Weekly recurrence (same day of week)
            if (task.recurrence === 'weekly') {
                return checkDate.getDay() === taskDate.getDay();
            }

            // Monthly recurrence (same day of month)
            if (task.recurrence === 'monthly') {
                return checkDate.getDate() === taskDate.getDate();
            }

            return false;
        });
    }

    // ============================================
    // CALENDAR RENDERING
    // ============================================
    navigateMonth(direction) {
        this.currentMonth.setMonth(this.currentMonth.getMonth() + direction);
        this.renderCalendar();
    }

    goToToday() {
        this.currentMonth = new Date();
        this.selectedDate = new Date().toISOString().split('T')[0];
        this.renderCalendar();
        this.renderDayTasks();
    }

    renderCalendar() {
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];

        const year = this.currentMonth.getFullYear();
        const month = this.currentMonth.getMonth();

        // Update header
        document.getElementById('currentMonth').textContent =
            `${monthNames[month]} ${year}`;

        // Get first day of month and total days
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startingDay = firstDay.getDay();
        const totalDays = lastDay.getDate();

        // Get days from previous month
        const prevMonthLastDay = new Date(year, month, 0).getDate();

        const calendarDays = document.getElementById('calendarDays');
        calendarDays.innerHTML = '';

        const today = new Date().toISOString().split('T')[0];

        // Previous month days
        for (let i = startingDay - 1; i >= 0; i--) {
            const day = prevMonthLastDay - i;
            const dateStr = this.formatDate(year, month - 1, day);
            calendarDays.appendChild(this.createDayElement(day, dateStr, true));
        }

        // Current month days
        for (let day = 1; day <= totalDays; day++) {
            const dateStr = this.formatDate(year, month, day);
            const isToday = dateStr === today;
            const isSelected = dateStr === this.selectedDate;
            calendarDays.appendChild(this.createDayElement(day, dateStr, false, isToday, isSelected));
        }

        // Next month days
        const remainingDays = 42 - (startingDay + totalDays);
        for (let day = 1; day <= remainingDays; day++) {
            const dateStr = this.formatDate(year, month + 1, day);
            calendarDays.appendChild(this.createDayElement(day, dateStr, true));
        }
    }

    createDayElement(day, dateStr, isOtherMonth, isToday = false, isSelected = false) {
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        if (isOtherMonth) dayEl.classList.add('other-month');
        if (isToday) dayEl.classList.add('today');
        if (isSelected) dayEl.classList.add('selected');

        const dayNumber = document.createElement('span');
        dayNumber.className = 'day-number';
        dayNumber.textContent = day;
        dayEl.appendChild(dayNumber);

        // Add task indicators
        const tasksForDay = this.getTasksForDate(dateStr);
        if (tasksForDay.length > 0) {
            const taskDots = document.createElement('div');
            taskDots.className = 'day-tasks';

            const maxDots = 3;
            const displayTasks = tasksForDay.slice(0, maxDots);

            displayTasks.forEach(task => {
                const dot = document.createElement('div');
                dot.className = `day-task-dot ${task.recurrence}`;
                taskDots.appendChild(dot);
            });

            if (tasksForDay.length > maxDots) {
                const more = document.createElement('span');
                more.className = 'day-task-more';
                more.textContent = `+${tasksForDay.length - maxDots} more`;
                taskDots.appendChild(more);
            }

            dayEl.appendChild(taskDots);
        }

        // Click handler
        dayEl.addEventListener('click', () => {
            this.selectDate(dateStr);
        });

        return dayEl;
    }

    selectDate(dateStr) {
        this.selectedDate = dateStr;
        this.renderCalendar();
        this.renderDayTasks();
    }

    formatDate(year, month, day) {
        // Handle month overflow by creating a date and extracting components
        const date = new Date(year, month, day);
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    // ============================================
    // TASK LIST RENDERING
    // ============================================
    renderTaskList() {
        const taskList = document.getElementById('taskList');
        const tasks = this.getFilteredTasks();

        if (tasks.length === 0) {
            taskList.innerHTML = '<p class="empty-state">No tasks yet. Add your first task above!</p>';
            return;
        }

        // Sort by date
        const sortedTasks = [...tasks].sort((a, b) => new Date(a.date) - new Date(b.date));

        taskList.innerHTML = sortedTasks.map(task => this.createTaskItemHTML(task)).join('');

        // Bind task item events
        this.bindTaskItemEvents();
    }

    renderDayTasks() {
        const card = document.getElementById('dayTasksCard');
        const list = document.getElementById('dayTasksList');
        const title = document.getElementById('selectedDayTitle');

        if (!this.selectedDate) {
            card.style.display = 'none';
            return;
        }

        const tasks = this.getTasksForDate(this.selectedDate);
        const dateObj = new Date(this.selectedDate + 'T00:00:00');
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };

        title.textContent = `Tasks for ${dateObj.toLocaleDateString('en-US', options)}`;
        card.style.display = 'block';

        if (tasks.length === 0) {
            list.innerHTML = '<p class="empty-state">No tasks scheduled for this day.</p>';
            return;
        }

        list.innerHTML = tasks.map(task => this.createTaskItemHTML(task, true)).join('');
        this.bindTaskItemEvents();
    }

    createTaskItemHTML(task, showInDayList = false) {
        const dateObj = new Date(task.date + 'T00:00:00');
        const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const recurrenceLabel = {
            'none': 'One-time',
            'daily': 'Daily',
            'weekly': 'Weekly',
            'monthly': 'Monthly'
        }[task.recurrence] || 'One-time';

        return `
            <div class="task-item ${task.recurrence} ${task.completed ? 'completed' : ''}" data-id="${task.id}">
                <div class="task-checkbox" data-action="complete" data-id="${task.id}"></div>
                <div class="task-content">
                    <div class="task-title">${this.escapeHtml(task.title)}</div>
                    <div class="task-meta">
                        <span class="task-badge ${task.recurrence}">${recurrenceLabel}</span>
                        <span>${dateStr}</span>
                    </div>
                </div>
                <div class="task-actions">
                    <button class="btn-icon edit" data-action="edit" data-id="${task.id}" title="Edit">✎</button>
                    <button class="btn-icon delete" data-action="delete" data-id="${task.id}" title="Delete">✕</button>
                </div>
            </div>
        `;
    }

    bindTaskItemEvents() {
        // Complete toggle
        document.querySelectorAll('[data-action="complete"]').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleComplete(e.target.dataset.id);
            });
        });

        // Edit button
        document.querySelectorAll('[data-action="edit"]').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                this.editTask(e.target.dataset.id);
            });
        });

        // Delete button
        document.querySelectorAll('[data-action="delete"]').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Are you sure you want to delete this task?')) {
                    this.deleteTask(e.target.dataset.id);
                }
            });
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// ============================================
// APP INITIALIZATION WITH CLOUD SYNC
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize CloudSync
    const cloudSync = new CloudSync(SUPABASE_URL, SUPABASE_ANON_KEY);

    // DOM Elements
    const accessModal = document.getElementById('accessModal');
    const settingsModal = document.getElementById('settingsModal');
    const accessChoice = document.getElementById('accessChoice');
    const accessEnterCode = document.getElementById('accessEnterCode');
    const accessNewCode = document.getElementById('accessNewCode');
    const accessLoading = document.getElementById('accessLoading');
    const syncStatus = document.getElementById('syncStatus');
    const btnSettings = document.getElementById('btnSettings');

    // Helper functions
    function showSection(section) {
        [accessChoice, accessEnterCode, accessNewCode, accessLoading].forEach(s => {
            s.style.display = 'none';
        });
        section.style.display = 'flex';
    }

    function hideModal() {
        accessModal.style.display = 'none';
        syncStatus.style.display = 'flex';
        btnSettings.style.display = 'block';
    }

    function showError(message) {
        const errorEl = document.getElementById('accessError');
        errorEl.textContent = message;
        errorEl.style.display = 'block';
    }

    function hideError() {
        document.getElementById('accessError').style.display = 'none';
    }

    function getCodeFromInputs() {
        const c1 = document.getElementById('codeInput1').value.toUpperCase();
        const c2 = document.getElementById('codeInput2').value.toUpperCase();
        const c3 = document.getElementById('codeInput3').value.toUpperCase();
        return `${c1}-${c2}-${c3}`;
    }

    // Auto-advance code inputs
    ['codeInput1', 'codeInput2', 'codeInput3'].forEach((id, index, arr) => {
        const input = document.getElementById(id);
        input.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase();
            if (e.target.value.length === 4 && index < arr.length - 1) {
                document.getElementById(arr[index + 1]).focus();
            }
        });
    });

    // Check for existing access code
    const existingCode = cloudSync.getAccessCode();
    if (existingCode) {
        showSection(accessLoading);
        const result = await cloudSync.autoLoad();

        if (result && result.success) {
            // Load tasks from cloud
            window.taskManager = new TaskManager(cloudSync);
            if (result.tasks && result.tasks.length > 0) {
                window.taskManager.setTasks(result.tasks);
            }
            hideModal();
        } else if (result && result.needsPin) {
            // Show PIN input
            showSection(accessEnterCode);
            const codeInputs = existingCode.split('-');
            document.getElementById('codeInput1').value = codeInputs[0] || '';
            document.getElementById('codeInput2').value = codeInputs[1] || '';
            document.getElementById('codeInput3').value = codeInputs[2] || '';
            document.getElementById('pinInputGroup').style.display = 'block';
        } else {
            // Code invalid - show choice
            cloudSync.logout();
            showSection(accessChoice);
        }
    } else {
        showSection(accessChoice);
    }

    // New User button
    document.getElementById('btnNewUser').addEventListener('click', async () => {
        showSection(accessLoading);
        const result = await cloudSync.createUser();

        if (result.success) {
            document.getElementById('newCodeDisplay').textContent = result.code;
            showSection(accessNewCode);
        } else {
            showError(result.error || 'Failed to create account. Please try again.');
            showSection(accessChoice);
        }
    });

    // Returning user button
    document.getElementById('btnReturning').addEventListener('click', () => {
        showSection(accessEnterCode);
    });

    // Back button
    document.getElementById('btnBackToChoice').addEventListener('click', () => {
        hideError();
        showSection(accessChoice);
    });

    // Validate code button
    document.getElementById('btnValidateCode').addEventListener('click', async () => {
        hideError();
        const code = getCodeFromInputs();
        const pin = document.getElementById('pinInput').value;

        if (code.length !== 14) {
            showError('Please enter a complete access code');
            return;
        }

        showSection(accessLoading);
        const result = await cloudSync.validateCode(code, pin || null);

        if (result.success) {
            window.taskManager = new TaskManager(cloudSync);
            if (result.tasks && result.tasks.length > 0) {
                window.taskManager.setTasks(result.tasks);
            }
            hideModal();
        } else if (result.pinRequired) {
            showSection(accessEnterCode);
            document.getElementById('pinInputGroup').style.display = 'block';
            showError('This account has a PIN. Please enter it.');
        } else if (result.codeRotated) {
            showSection(accessEnterCode);
            showError(`Your code was changed for security. New code: ${result.newCode}`);
        } else {
            showSection(accessEnterCode);
            showError(result.error);
        }
    });

    // Copy code button
    document.getElementById('btnCopyCode').addEventListener('click', () => {
        const code = document.getElementById('newCodeDisplay').textContent;
        navigator.clipboard.writeText(code);
        document.getElementById('codeCopied').style.display = 'block';
        setTimeout(() => {
            document.getElementById('codeCopied').style.display = 'none';
        }, 2000);
    });

    // Start using app button
    document.getElementById('btnStartUsing').addEventListener('click', () => {
        window.taskManager = new TaskManager(cloudSync);
        hideModal();
    });

    // Settings button
    btnSettings.addEventListener('click', () => {
        document.getElementById('settingsCodeDisplay').textContent = cloudSync.getAccessCode();
        settingsModal.style.display = 'flex';
    });

    // Close settings
    document.getElementById('btnCloseSettings').addEventListener('click', () => {
        settingsModal.style.display = 'none';
    });

    // Copy code in settings
    document.getElementById('btnCopyCodeSettings').addEventListener('click', () => {
        navigator.clipboard.writeText(cloudSync.getAccessCode());
    });

    // Set PIN
    document.getElementById('btnSetPin').addEventListener('click', async () => {
        const pin = document.getElementById('newPinInput').value;
        if (pin.length !== 4 || !/^\d+$/.test(pin)) {
            alert('PIN must be exactly 4 digits');
            return;
        }

        const success = await cloudSync.setPin(pin);
        if (success) {
            document.getElementById('pinNotSet').style.display = 'none';
            document.getElementById('pinIsSet').style.display = 'flex';
            document.getElementById('newPinInput').value = '';
        }
    });

    // Remove PIN
    document.getElementById('btnRemovePin').addEventListener('click', async () => {
        const success = await cloudSync.removePin();
        if (success) {
            document.getElementById('pinNotSet').style.display = 'flex';
            document.getElementById('pinIsSet').style.display = 'none';
        }
    });

    // Set email
    document.getElementById('btnSetEmail').addEventListener('click', async () => {
        const email = document.getElementById('emailInput').value;
        if (email && email.includes('@')) {
            await cloudSync.setEmail(email);
            alert('Email saved!');
        }
    });

    // Logout
    document.getElementById('btnLogout').addEventListener('click', () => {
        cloudSync.logout();
        settingsModal.style.display = 'none';
        location.reload();
    });

    // Close modal when clicking outside
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            settingsModal.style.display = 'none';
        }
    });
});
