document.addEventListener('DOMContentLoaded', () => {
    // Views
    const viewLogin = document.getElementById('view-login');
    const viewAbout = document.getElementById('view-about');
    const viewApp = document.getElementById('view-app');

    // Auth Elements
    const usernameInput = document.getElementById('usernameInput');
    const btnLogin = document.getElementById('btnLogin');
    const btnFromAbout = document.getElementById('btnFromAbout');
    const displayUsername = document.getElementById('displayUsername');

    // Link/File Inputs
    const sheetUrlInput = document.getElementById('sheetUrl');
    const checkBtn = document.getElementById('checkBtn');

    // Sections
    const loadingSection = document.getElementById('loading');
    const resultsSection = document.getElementById('results');
    const totalCountEl = document.getElementById('totalCount');
    const respondedCountEl = document.getElementById('respondedCount');
    const notRespondedCountEl = document.getElementById('notRespondedCount');

    const mainInput = document.querySelector('.main-input');

    // Navigation Logic
    const showView = (viewName) => {
        [viewLogin, viewAbout, viewApp].forEach(el => el.classList.add('hidden'));
        if (viewName === 'login') viewLogin.classList.remove('hidden');
        if (viewName === 'about') viewAbout.classList.remove('hidden');
        if (viewName === 'app') viewApp.classList.remove('hidden');
    };

    // Auto-login if saved
    const savedUser = localStorage.getItem('gTrackUser');
    if (savedUser) {
        displayUsername.textContent = savedUser;
        showView('app'); // Skip to app if logged in
    } else {
        showView('login');
    }

    // Login Action
    btnLogin.addEventListener('click', () => {
        const name = usernameInput.value.trim();
        if (name) {
            localStorage.setItem('gTrackUser', name);
            displayUsername.textContent = name;
            showView('about'); // Go to About after login
        } else {
            usernameInput.style.border = "1px solid var(--danger)";
            setTimeout(() => usernameInput.style.border = "none", 2000);
        }
    });

    // About -> App Action
    btnFromAbout.addEventListener('click', () => {
        showView('app');
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

    let isFileMode = false;
    let selectedFile = null;

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
        const text = items.join('\n');
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

            // Show Debug Info
            if (data.debug_info) {
                const debugDiv = document.createElement('div');
                debugDiv.className = 'debug-info';

                let rowsHtml = '';
                data.debug_info.preview_rows.forEach(row => {
                    let extra = '';
                    if (row.status === "Not Responded" && row.missing_cols && row.missing_cols.length > 0) {
                        extra = `<br><small style="color: #f87171;">Missing: ${row.missing_cols.join(', ')}</small>`;
                    }
                    rowsHtml += `<li><strong>${row.name}</strong>: ${row.status} (${row.answers_found}/${row.total_required}) ${extra}</li>`;
                });

                debugDiv.innerHTML = `
                    <p><i class="fa-solid fa-magic-wand-sparkles"></i> <strong>Analysis Info:</strong></p>
                    <ul>
                        <li>Using <strong>"${data.debug_info.detected_name_column}"</strong> as Name.</li>
                        <li>Checking <strong>${data.debug_info.detected_answer_columns.length}</strong> required columns.</li>
                    </ul>
                    <hr style="border:0; border-top:1px solid rgba(255,255,255,0.1); margin:10px 0;">
                    <p><strong>First Few Rows Check:</strong></p>
                    <ul>${rowsHtml}</ul>
                `;
                // Insert after stats
                const resultsGrid = document.querySelector('.results-grid');
                // Remove old debug info if any
                const oldDebug = document.querySelector('.debug-info');
                if (oldDebug) oldDebug.remove();

                resultsGrid.parentNode.insertBefore(debugDiv, resultsGrid);
            }

            // Populate Lists
            renderList(respondedUl, data.responded_list);
            renderList(notRespondedUl, data.not_responded_list);

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

    function renderList(ulElement, items) {
        ulElement.innerHTML = '';
        if (items.length === 0) {
            const li = document.createElement('li');
            li.textContent = "None found";
            li.style.fontStyle = "italic";
            li.style.opacity = "0.5";
            ulElement.appendChild(li);
            return;
        }

        items.forEach(item => {
            const li = document.createElement('li');

            if (typeof item === 'object' && item.name) {
                // It's a student object (Not Responded likely)
                let html = `<span>${item.name}</span>`;
                if (item.missing && item.missing.length > 0) {
                    html += `<br><small style="color: #f87171; font-size: 0.8rem;">Missing: ${item.missing.join(', ')}</small>`;
                }
                li.innerHTML = html;
                li.style.flexDirection = "column";
                li.style.alignItems = "flex-start";
            } else {
                // It's a string (Responded)
                li.textContent = item;
            }

            ulElement.appendChild(li);
        });
    }

    // Input animation listener
    sheetUrlInput.addEventListener('focus', () => {
        clearError();
    });
});
