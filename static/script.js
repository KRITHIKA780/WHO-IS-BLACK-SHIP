document.addEventListener('DOMContentLoaded', () => {
    // Views
    const viewLogin = document.getElementById('view-login');
    const viewAbout = document.getElementById('view-about');
    const viewApp = document.getElementById('view-app');

    // Auth Elements
    const tabLogin = document.getElementById('tabLogin');
    const tabSignup = document.getElementById('tabSignup');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');

    const usernameInput = document.getElementById('usernameInput');
    const passwordInput = document.getElementById('passwordInput');
    const btnLogin = document.getElementById('btnLogin');

    const newUsername = document.getElementById('newUsername');
    const newEmail = document.getElementById('newEmail');
    const newPassword = document.getElementById('newPassword');
    const btnSignup = document.getElementById('btnSignup');

    const btnFromAbout = document.getElementById('btnFromAbout');
    const displayUsername = document.getElementById('displayUsername');
    const btnLogout = document.getElementById('btnLogout');

    // Link/File Inputs
    const sheetUrlInput = document.getElementById('sheetUrl');
    const checkBtn = document.getElementById('checkBtn');
    if (checkBtn) {
        checkBtn.className = 'auth-btn';
        checkBtn.style.maxWidth = '300px';
        checkBtn.style.margin = '2rem auto 0';
    }

    // Sections
    const loadingSection = document.getElementById('loading');
    const resultsSection = document.getElementById('results');
    const totalCountEl = document.getElementById('totalCount');
    const respondedCountEl = document.getElementById('respondedCount');
    const notRespondedCountEl = document.getElementById('notRespondedCount');

    const mainInput = document.querySelector('.main-input');

    // Navigation Logic
    const showView = (viewName) => {
        // Hide all and remove active
        [viewLogin, viewAbout, viewApp].forEach(el => {
            el.classList.add('hidden');
            el.classList.remove('active');
        });

        // Show the target view
        let target;
        if (viewName === 'login') target = viewLogin;
        if (viewName === 'about') target = viewAbout;
        if (viewName === 'app') target = viewApp;

        if (target) {
            target.classList.remove('hidden');
            setTimeout(() => target.classList.add('active'), 10);
        }
    };

    // Auto-login if saved
    const savedUser = localStorage.getItem('gTrackUser');
    if (savedUser) {
        displayUsername.textContent = savedUser;
        showView('app'); // Skip to app if logged in
    } else {
        showView('login');
    }

    // --- Page 1: Auth Tab Logic ---
    tabLogin.addEventListener('click', () => {
        tabLogin.classList.add('active');
        tabSignup.classList.remove('active');
        loginForm.classList.remove('hidden');
        signupForm.classList.add('hidden');
    });

    tabSignup.addEventListener('click', () => {
        tabSignup.classList.add('active');
        tabLogin.classList.remove('active');
        signupForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
    });

    // Login Action
    btnLogin.addEventListener('click', () => {
        const name = usernameInput.value.trim();
        const pass = passwordInput.value.trim();

        if (name && pass) {
            loginUser(name);
        } else {
            showInputError(usernameInput);
            if (!pass) showInputError(passwordInput);
        }
    });

    // Signup Action
    btnSignup.addEventListener('click', () => {
        const name = newUsername.value.trim();
        const email = newEmail.value.trim();
        const pass = newPassword.value.trim();

        if (name && email && pass) {
            // Mock signup - just login
            loginUser(name);
        } else {
            if (!name) showInputError(newUsername);
            if (!email) showInputError(newEmail);
            if (!pass) showInputError(newPassword);
        }
    });

    function loginUser(name) {
        localStorage.setItem('gTrackUser', name);
        displayUsername.textContent = name;
        showView('about'); // Page 1 -> Page 2
    }

    function showInputError(inputEl) {
        inputEl.style.borderColor = "var(--danger)";
        setTimeout(() => inputEl.style.borderColor = "var(--glass-border)", 2000);
    }

    // About -> App Action
    btnFromAbout.addEventListener('click', () => {
        showView('app');
    });

    // Logout Action
    btnLogout.addEventListener('click', () => {
        localStorage.removeItem('gTrackUser');
        showView('login');
    });

    // List Elements
    const respondedUl = document.getElementById('respondedUl');
    const notRespondedUl = document.getElementById('notRespondedUl');
    const respondedBadge = document.getElementById('respondedBadge');
    const notRespondedBadge = document.getElementById('notRespondedBadge');

    // Toggle & Inputs
    const btnLinkMode = document.getElementById('btnLinkMode');
    const btnFileMode = document.getElementById('btnFileMode');
    const modeLink = document.getElementById('modeLink');
    const modeFile = document.getElementById('modeFile');
    const dropArea = document.getElementById('dropArea');
    const fileInput = document.getElementById('fileInput');
    const filePreview = document.getElementById('filePreview');
    const fileNameEl = document.getElementById('fileName');
    const removeFile = document.getElementById('removeFile');

    // Results Tab Elements
    const tabResponded = document.getElementById('tabResponded');
    const tabNotResponded = document.getElementById('tabNotResponded');
    const resultsSlider = document.getElementById('resultsSlider');

    let isFileMode = false;
    let selectedFile = null;

    // --- Results Tab Logic ---
    if (tabResponded && tabNotResponded) {
        tabResponded.addEventListener('click', () => {
            tabResponded.classList.add('active');
            tabNotResponded.classList.remove('active');
            resultsSlider.style.transform = 'translateX(0%)';
        });

        tabNotResponded.addEventListener('click', () => {
            tabNotResponded.classList.add('active');
            tabResponded.classList.remove('active');
            resultsSlider.style.transform = 'translateX(calc(-100% - 2rem))';
        });
    }

    // --- Toggle Logic ---
    btnLinkMode.addEventListener('click', () => setMode(false));
    btnFileMode.addEventListener('click', () => setMode(true));

    function setMode(isFile) {
        isFileMode = isFile;
        // Buttons
        btnLinkMode.classList.toggle('active', !isFile);
        btnFileMode.classList.toggle('active', isFile);

        // Sections
        if (isFile) {
            modeLink.classList.add('hidden');
            modeFile.classList.remove('hidden');
        } else {
            modeLink.classList.remove('hidden');
            modeFile.classList.add('hidden');
        }
        clearError();
    }

    // --- File Handling ---
    dropArea.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));

    // Drag & Drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    dropArea.addEventListener('dragover', () => dropArea.classList.add('dragover'));
    dropArea.addEventListener('dragleave', () => dropArea.classList.remove('dragover'));

    dropArea.addEventListener('drop', (e) => {
        dropArea.classList.remove('dragover');
        handleFile(e.dataTransfer.files[0]);
    });

    function handleFile(file) {
        if (!file) return;
        if (!file.name.match(/\.(csv|xlsx|xls)$/i)) {
            showError("Invalid file type. Please upload Excel or CSV.");
            return;
        }
        selectedFile = file;
        fileNameEl.textContent = file.name;
        dropArea.classList.add('hidden');
        filePreview.classList.remove('hidden');
        clearError();
    }

    removeFile.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedFile = null;
        fileInput.value = '';
        dropArea.classList.remove('hidden');
        filePreview.classList.add('hidden');
    });

    // Copy Buttons
    const copyRespondedBtn = document.getElementById('copyResponded');
    const copyNotRespondedBtn = document.getElementById('copyNotResponded');

    // Helper to clear errors
    const clearError = () => {
        const existingError = document.querySelector('.error-msg');
        if (existingError) existingError.remove();

        // Also clear debug info if exists
        const existingDebug = document.querySelector('.debug-info');
        if (existingDebug) existingDebug.remove();
    };

    // Helper to show error
    const showError = (message) => {
        clearError();
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-msg';
        errorDiv.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <span>${message}</span>`;
        mainInput.appendChild(errorDiv);
    };

    // Helper to copy list
    const copyList = (items, btn) => {
        if (!items || items.length === 0) return;

        // Extract names if items are objects
        const names = items.map(item => typeof item === 'object' ? item.name : item);
        const text = names.join('\n');

        navigator.clipboard.writeText(text).then(() => {
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-check"></i>';
            setTimeout(() => {
                btn.innerHTML = originalHTML;
            }, 1000);
        });
    };

    let currentData = null;

    checkBtn.addEventListener('click', async () => {
        // Add visual punch on click
        checkBtn.style.transform = 'scale(0.95)';
        setTimeout(() => checkBtn.style.transform = '', 100);

        // Reset UI
        clearError();
        let bodyBase = null;
        let headers = {};

        if (isFileMode) {
            if (!selectedFile) {
                showError("Please upload a file first.");
                return;
            }
            const formData = new FormData();
            formData.append('file', selectedFile);
            bodyBase = formData;
            // No content-type header for FormData (browser sets it with boundary)
        } else {
            const url = sheetUrlInput.value.trim();
            if (!url) {
                showError("Please enter a Google Sheet URL.");
                return;
            }
            if (!url.includes("docs.google.com/spreadsheets") && !url.includes("drive.google")) {
                showError("That doesn't look like a valid Google Sheet URL.");
                return;
            }
            bodyBase = JSON.stringify({ url: url });
            headers['Content-Type'] = 'application/json';
        }

        resultsSection.classList.add('hidden');
        loadingSection.classList.remove('hidden');
        checkBtn.disabled = true;
        checkBtn.innerHTML = '<span>Processing...</span>';
        currentData = null;

        // Reset Slider Position on new check
        if (resultsSlider) {
            resultsSlider.style.transform = 'translateX(0%)';
            tabResponded.classList.add('active');
            tabNotResponded.classList.remove('active');
        }

        try {
            const response = await fetch('/check', {
                method: 'POST',
                headers: headers,
                body: bodyBase,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "An unexpected error occurred.");
            }

            currentData = data;

            // Populate Results
            totalCountEl.textContent = data.total_students;
            respondedCountEl.textContent = data.responded_count;
            notRespondedCountEl.textContent = data.not_responded_count;

            respondedBadge.textContent = data.responded_count;
            notRespondedBadge.textContent = data.not_responded_count;

            // AI Insight Analysis Removal per request
            const oldDebug = document.querySelector('.debug-info');
            if (oldDebug) oldDebug.remove();

            // Populate Tables
            renderTable('respondedTableBody', data.responded_list, true);
            renderTable('notRespondedTableBody', data.not_responded_list, false);

            document.getElementById('respondedTableTotal').textContent = data.responded_count;
            document.getElementById('notRespondedTableTotal').textContent = data.not_responded_count;

            // Show Results
            loadingSection.classList.add('hidden');
            resultsSection.classList.remove('hidden');
            resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

        } catch (err) {
            loadingSection.classList.add('hidden');
            showError(err.message);
        } finally {
            checkBtn.disabled = false;
            checkBtn.innerHTML = '<span>Check Responses</span> <i class="fa-solid fa-arrow-right"></i>';
        }
    });

    // Copy Event Listeners
    copyRespondedBtn.addEventListener('click', () => {
        if (currentData) copyList(currentData.responded_list, copyRespondedBtn);
    });

    copyNotRespondedBtn.addEventListener('click', () => {
        if (currentData) copyList(currentData.not_responded_list, copyNotRespondedBtn);
    });

    function renderTable(tbodyId, items, isResponded) {
        const tbody = document.getElementById(tbodyId);
        tbody.innerHTML = '';

        if (items.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; opacity:0.5; padding:2rem;">No data available</td></tr>`;
            return;
        }

        items.forEach(item => {
            const tr = document.createElement('tr');

            if (isResponded) {
                // item is just a name string
                tr.innerHTML = `
                    <td><strong>${item}</strong></td>
                    <td><span class="status-pill status-res">Completed</span></td>
                    <td><i class="fa-solid fa-circle-check" style="color:var(--success)"></i></td>
                `;
            } else {
                // item is an object { name, missing }
                tr.innerHTML = `
                    <td><strong>${item.name}</strong></td>
                    <td style="font-size:0.85rem; color:var(--text-secondary)">${item.missing.join(', ')}</td>
                    <td><span class="status-pill status-nr">Pending</span></td>
                `;
            }
            tbody.appendChild(tr);
        });
    }

    // Input animation listener
    sheetUrlInput.addEventListener('focus', () => {
        clearError();
    });

    // --- Export Functions ---
    const btnDownloadExcel = document.getElementById('downloadExcel');
    const btnDownloadPDF = document.getElementById('downloadPDF');

    btnDownloadExcel.addEventListener('click', () => {
        if (!currentData) return;

        const wb = XLSX.utils.book_new();

        // Prepare Data for Excel
        const respondedData = currentData.responded_list.map(name => ({ "Student Name": name, "Status": "Responded" }));
        const notRespondedData = currentData.not_responded_list.map(item => ({
            "Student Name": item.name,
            "Status": "Not Responded",
            "Missing Fields": item.missing.join(', ')
        }));

        const wsResponded = XLSX.utils.json_to_sheet(respondedData);
        const wsNotResponded = XLSX.utils.json_to_sheet(notRespondedData);

        XLSX.utils.book_append_sheet(wb, wsResponded, "Responded");
        XLSX.utils.book_append_sheet(wb, wsNotResponded, "Not Responded");

        XLSX.writeFile(wb, `G-Tracker_Export_${new Date().getTime()}.xlsx`);
    });

    btnDownloadPDF.addEventListener('click', () => {
        if (!currentData) return;
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        doc.setFontSize(20);
        doc.text("G-Tracker Analysis Report", 14, 20);
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);

        // Stats Table
        doc.autoTable({
            startY: 35,
            head: [['Total Students', 'Responded', 'Not Responded']],
            body: [[currentData.total_students, currentData.responded_count, currentData.not_responded_count]],
            theme: 'grid',
            headStyles: { fillStyle: '#3b82f6' }
        });

        // Not Responded List
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text("Incomplete Submissions", 14, doc.lastAutoTable.finalY + 15);

        const nrRows = currentData.not_responded_list.map(item => [item.name, item.missing.join(', ')]);
        doc.autoTable({
            startY: doc.lastAutoTable.finalY + 20,
            head: [['Student Name', 'Missing Fields']],
            body: nrRows,
            theme: 'striped',
            headStyles: { fillStyle: '#ef4444' }
        });

        // Responded List
        doc.addPage();
        doc.text("Full Submissions (Responded)", 14, 20);
        const rRows = currentData.responded_list.map(name => [name]);
        doc.autoTable({
            startY: 25,
            head: [['Student Name']],
            body: rRows,
            theme: 'striped',
            headStyles: { fillStyle: '#10b981' }
        });

        doc.save(`G-Tracker_Report_${new Date().getTime()}.pdf`);
    });
});
