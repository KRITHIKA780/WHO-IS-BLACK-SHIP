document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const configPanel = document.getElementById('config-panel');
    const sheetUrlInput = document.getElementById('sheetUrl');
    const checkBtn = document.getElementById('checkBtn');
    const loadingSection = document.getElementById('loading');
    const resultsSection = document.getElementById('results');
    const errorBanner = document.getElementById('errorBanner');
    const errorText = document.getElementById('errorText');

    // Stats
    const totalCountEl = document.getElementById('totalCount');
    const respondedCountEl = document.getElementById('respondedCount');
    const notRespondedCountEl = document.getElementById('notRespondedCount');
    const respondedBadge = document.getElementById('respondedBadge');
    const notRespondedBadge = document.getElementById('notRespondedBadge');

    // Lists
    const respondedUl = document.getElementById('respondedUl');
    const notRespondedUl = document.getElementById('notRespondedUl');

    // Toggles
    const btnLinkMode = document.getElementById('btnLinkMode');
    const btnFileMode = document.getElementById('btnFileMode');
    const modeLink = document.getElementById('modeLink');
    const modeFile = document.getElementById('modeFile');
    const dropArea = document.getElementById('dropArea');
    const fileInput = document.getElementById('fileInput');
    const filePreview = document.getElementById('filePreview');
    const fileNameEl = document.getElementById('fileName');
    const removeFileBtn = document.getElementById('removeFile');

    // Export
    const copyRespondedBtn = document.getElementById('copyResponded');
    const copyNotRespondedBtn = document.getElementById('copyNotResponded');

    let isFileMode = false;
    let selectedFile = null;
    let currentData = null;

    // --- Tab Logic ---
    const setMode = (isFile) => {
        isFileMode = isFile;
        btnLinkMode.classList.toggle('active', !isFile);
        btnFileMode.classList.toggle('active', isFile);

        if (isFile) {
            modeLink.classList.add('hidden');
            modeFile.classList.remove('hidden');
            modeFile.classList.add('view-transition');
        } else {
            modeFile.classList.add('hidden');
            modeLink.classList.remove('hidden');
            modeLink.classList.add('view-transition');
        }
        clearError();
    };

    btnLinkMode.addEventListener('click', () => setMode(false));
    btnFileMode.addEventListener('click', () => setMode(true));

    // --- File Handling ---
    dropArea.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        }, false);
    });

    dropArea.addEventListener('dragover', () => dropArea.style.borderColor = 'hsl(var(--neon-blue))');
    dropArea.addEventListener('dragleave', () => dropArea.style.borderColor = 'var(--glass-border)');

    dropArea.addEventListener('drop', (e) => {
        dropArea.style.borderColor = 'var(--glass-border)';
        handleFile(e.dataTransfer.files[0]);
    });

    function handleFile(file) {
        if (!file) return;
        if (!file.name.match(/\.(csv|xlsx|xls)$/i)) {
            showError("Please upload a valid CSV or Excel file.");
            return;
        }
        selectedFile = file;
        fileNameEl.textContent = file.name;
        dropArea.classList.add('hidden');
        filePreview.classList.remove('hidden');
        clearError();
    }

    removeFileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedFile = null;
        fileInput.value = '';
        dropArea.classList.remove('hidden');
        filePreview.classList.add('hidden');
    });

    // --- Core Action ---
    checkBtn.addEventListener('click', async () => {
        clearError();
        resultsSection.classList.add('hidden');

        let body;
        let headers = {};

        if (isFileMode) {
            if (!selectedFile) return showError("Please select a file first.");
            body = new FormData();
            body.append('file', selectedFile);
        } else {
            const url = sheetUrlInput.value.trim();
            if (!url) return showError("Please enter a Google Sheet URL.");
            if (!url.includes("docs.google.com/spreadsheets") && !url.includes("drive.google")) {
                return showError("Invalid Google Sheet URL format.");
            }
            body = JSON.stringify({ url });
            headers['Content-Type'] = 'application/json';
        }

        // Start Loading
        loadingSection.classList.remove('hidden');
        checkBtn.disabled = true;
        checkBtn.innerHTML = '<span>Processing Library...</span> <i class="fa-solid fa-sync fa-spin"></i>';

        try {
            const response = await fetch('/check', { method: 'POST', headers, body });
            const data = await response.json();

            if (!response.ok) throw new Error(data.error || "Verification engine failed.");

            currentData = data;
            renderDashboard(data);

        } catch (err) {
            showError(err.message);
        } finally {
            loadingSection.classList.add('hidden');
            checkBtn.disabled = false;
            checkBtn.innerHTML = '<span>Start Verification</span> <i class="fa-solid fa-wand-magic-sparkles"></i>';
        }
    });

    function renderDashboard(data) {
        // Animate Numbers
        animateValue(totalCountEl, 0, data.total_students, 1200);
        animateValue(respondedCountEl, 0, data.responded_count, 1200);
        animateValue(notRespondedCountEl, 0, data.not_responded_count, 1200);

        respondedBadge.textContent = data.responded_count;
        notRespondedBadge.textContent = data.not_responded_count;

        // Render Lists
        renderList(respondedUl, data.responded_list, 'verified');
        renderList(notRespondedUl, data.not_responded_list, 'missing');

        // Show Results
        resultsSection.classList.remove('hidden');
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Intelligence Logs
        if (data.debug_info) {
            const debugTarget = document.getElementById('debugTarget');
            debugTarget.innerHTML = `
                <div style="color: hsl(var(--neon-blue)); font-weight: 700; margin-bottom: 0.5rem;">
                    <i class="fa-solid fa-microchip"></i> Verification Intelligence
                </div>
                <p>Target Name Column: <span style="color:#fff;">"${data.debug_info.detected_name_column}"</span></p>
                <p>Required Data Points: <span style="color:#fff;">${data.debug_info.detected_answer_columns.length}</span></p>
                <div style="margin-top: 1rem; opacity: 0.7;">Engine successfully parsed ${data.total_students} entries.</div>
            `;
            debugTarget.classList.remove('hidden');
        }
    }

    function renderList(ul, items, type) {
        ul.innerHTML = '';
        if (items.length === 0) {
            ul.innerHTML = `<li style="opacity: 0.5; justify-content: center;">No entries found</li>`;
            return;
        }

        items.forEach((item, index) => {
            const li = document.createElement('li');
            li.style.animation = `slideUp 0.4s ease-out ${index * 0.03}s backwards`;

            const name = typeof item === 'object' ? item.name : item;
            const statusIcon = type === 'verified' ?
                '<i class="fa-solid fa-circle-check" style="color: hsl(var(--neon-green))"></i>' :
                '<i class="fa-solid fa-circle-exclamation" style="color: hsl(var(--neon-purple))"></i>';

            li.innerHTML = `
                <span style="font-weight: 500;">${name}</span>
                ${statusIcon}
            `;
            ul.appendChild(li);
        });
    }

    function animateValue(obj, start, end, duration) {
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            obj.innerHTML = Math.floor(progress * (end - start) + start);
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }

    function showError(msg) {
        errorText.textContent = msg;
        errorBanner.classList.remove('hidden');
        errorBanner.classList.add('view-transition');
    }

    function clearError() {
        errorBanner.classList.add('hidden');
    }

    // --- Export Logic ---
    copyRespondedBtn.addEventListener('click', () => exportList(currentData.responded_list, copyRespondedBtn));
    copyNotRespondedBtn.addEventListener('click', () => {
        const list = currentData.not_responded_list.map(i => typeof i === 'object' ? i.name : i);
        exportList(list, copyNotRespondedBtn);
    });

    function exportList(list, btn) {
        if (!list || list.length === 0) return;
        const text = list.join('\n');
        navigator.clipboard.writeText(text).then(() => {
            const original = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied to Clipboard';
            btn.style.color = 'hsl(var(--neon-green))';
            setTimeout(() => {
                btn.innerHTML = original;
                btn.style.color = '';
            }, 2000);
        });
    }
});
