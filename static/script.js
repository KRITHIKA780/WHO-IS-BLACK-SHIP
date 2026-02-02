document.addEventListener('DOMContentLoaded', () => {
    // --- Authentication Logic ---
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const loginUser = document.getElementById('loginUser');
    const loginPass = document.getElementById('loginPass');
    const regUser = document.getElementById('regUser');
    const regPass = document.getElementById('regPass');
    const authError = document.getElementById('authError');
    const authErrorText = document.getElementById('authErrorText');

    const btnShowLogin = document.getElementById('btnShowLogin');
    const btnShowRegister = document.getElementById('btnShowRegister');
    const loginFormBox = document.getElementById('login-form-box');
    const registerFormBox = document.getElementById('register-form-box');

    // Switcher Logic with Slide Effect
    if (btnShowLogin && btnShowRegister) {
        btnShowLogin.addEventListener('click', () => {
            btnShowLogin.classList.add('active');
            btnShowRegister.classList.remove('active');
            loginFormBox.classList.remove('hidden');
            registerFormBox.classList.add('hidden');
            clearAuthError();
        });

        btnShowRegister.addEventListener('click', () => {
            btnShowRegister.classList.add('active');
            btnShowLogin.classList.remove('active');
            registerFormBox.classList.remove('hidden');
            loginFormBox.classList.add('hidden');
            clearAuthError();
        });
    }

    const clearAuthError = () => {
        if (authError) authError.classList.add('hidden');
    };

    const showAuthError = (msg) => {
        if (authErrorText) {
            authErrorText.innerHTML = msg;
            authError.classList.remove('hidden');
            setTimeout(() => authError.classList.add('hidden'), 3000);
        }
    };

    async function switchView(targetUrl) {
        try {
            // Determine target panel
            let targetPanelName = 'auth';
            if (targetUrl.includes('/methods')) targetPanelName = 'methods';
            if (targetUrl.includes('/tracker')) targetPanelName = 'tracker';

            const panels = document.querySelectorAll('.panel-view');
            const currentPanel = document.querySelector('.panel-view.active');
            const targetPanel = document.querySelector(`.panel-view[data-panel="${targetPanelName}"]`);

            if (!targetPanel) {
                window.location.href = targetUrl;
                return;
            }

            if (currentPanel) {
                currentPanel.classList.remove('active', 'entrance-anim');
                currentPanel.classList.add('exit-anim');
            }

            // Small delay for exit if it exists
            targetPanel.classList.remove('exit-anim');
            targetPanel.classList.add('active', 'entrance-anim');

            // Update Nav brand color if needed or active links
            document.querySelectorAll('.nav-link').forEach(link => {
                if (link.getAttribute('href') === targetUrl) link.classList.add('active');
                else link.classList.remove('active');
            });

            // Update URL
            history.pushState({}, '', targetUrl);

            // Re-initialize logic
            initTracker();
            bindNavButtons();
        } catch (err) {
            console.error("View switch failed:", err);
            window.location.href = targetUrl; // Fallback
        }
    }

    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            const username = loginUser.value;
            const password = loginPass.value;

            loginBtn.classList.add('loading');

            if (!username || !password) {
                loginBtn.classList.remove('loading');
                return showAuthError("CREDENTIALS MISSING");
            }

            try {
                const res = await fetch('/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await res.json();
                if (res.ok) {
                    switchView('/methods');
                } else {
                    showAuthError(data.error.toUpperCase());
                }
            } catch (err) {
                showAuthError("CONNECTION FAILURE");
            } finally {
                loginBtn.classList.remove('loading');
            }
        });
    }

    if (registerBtn) {
        registerBtn.addEventListener('click', async () => {
            const username = regUser.value;
            const password = regPass.value;

            if (!username || !password) return showAuthError("FIELDS REQUIRED");

            try {
                const res = await fetch('/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await res.json();
                if (res.ok) {
                    btnShowLogin.click();
                    showAuthError("IDENTITY REGISTERED. PLEASE LOG IN.");
                } else {
                    showAuthError(data.error.toUpperCase());
                }
            } catch (err) {
                showAuthError("REGISTRATION FAILED");
            }
        });
    }

    function bindNavButtons() {
        const btnToTracker = document.getElementById('btnToTracker');
        if (btnToTracker) {
            btnToTracker.addEventListener('click', () => switchView('/tracker'));
        }
    }

    // --- Tracker Logic ---
    function initTracker() {
        const checkBtn = document.getElementById('checkBtn');
        if (!checkBtn) return;

        const sheetUrlInput = document.getElementById('sheetUrl');
        const loadingSection = document.getElementById('loading');
        const resultsSection = document.getElementById('results');
        const errorBanner = document.getElementById('errorBanner');
        const errorText = document.getElementById('errorText');
        const btnSpinner = document.getElementById('btnSpinner');

        // Stats
        const totalCountEl = document.getElementById('totalCount');
        const respondedCountEl = document.getElementById('respondedCount');
        const notRespondedCountEl = document.getElementById('notRespondedCount');
        const respondedBadge = document.getElementById('respondedBadge');
        const notRespondedBadge = document.getElementById('notRespondedBadge');
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

        let isFileMode = false;
        let selectedFile = null;
        let currentData = null;

        const setMode = (isFile) => {
            isFileMode = isFile;
            btnLinkMode.classList.toggle('active', !isFile);
            btnFileMode.classList.toggle('active', isFile);
            if (isFile) {
                modeLink.classList.add('hidden');
                modeFile.classList.remove('hidden');
            } else {
                modeFile.classList.add('hidden');
                modeLink.classList.remove('hidden');
            }
            clearError();
        };

        btnLinkMode.addEventListener('click', () => setMode(false));
        btnFileMode.addEventListener('click', () => setMode(true));

        dropArea.addEventListener('click', () => fileInput.click());
        dropArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropArea.style.borderColor = 'var(--nebula-pink)';
        });
        dropArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropArea.style.borderColor = 'rgba(255,255,255,0.2)';
        });
        dropArea.addEventListener('drop', (e) => {
            e.preventDefault();
            dropArea.style.borderColor = 'rgba(255,255,255,0.2)';
            if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
        });

        fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));

        const handleFile = (file) => {
            if (!file) return;
            selectedFile = file;
            fileNameEl.textContent = file.name;
            dropArea.classList.add('hidden');
            filePreview.classList.remove('hidden');
        };

        removeFileBtn.addEventListener('click', () => {
            selectedFile = null;
            fileInput.value = '';
            dropArea.classList.remove('hidden');
            filePreview.classList.add('hidden');
        });

        checkBtn.addEventListener('click', async () => {
            clearError();
            resultsSection.classList.add('hidden');
            let body;
            let headers = {};

            if (isFileMode) {
                if (!selectedFile) return showError("UPLOAD MANIFEST REQUIRED");
                body = new FormData();
                body.append('file', selectedFile);
            } else {
                const url = sheetUrlInput.value.trim();
                if (!url) return showError("TARGET URL REQUIRED");
                body = JSON.stringify({ url });
                headers['Content-Type'] = 'application/json';
            }

            loadingSection.classList.remove('hidden');
            if (btnSpinner) btnSpinner.classList.remove('hidden');

            // Artificial delay for "Scanning" effect
            await new Promise(r => setTimeout(r, 800));

            try {
                const res = await fetch('/check', { method: 'POST', headers, body });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                renderDashboard(data);
            } catch (err) {
                showError(err.message.toUpperCase());
            } finally {
                loadingSection.classList.add('hidden');
                if (btnSpinner) btnSpinner.classList.add('hidden');
            }
        });

        function renderDashboard(data) {
            currentData = data;

            // Animate numbers
            animateValue(totalCountEl, 0, data.total_students, 1000);
            animateValue(respondedCountEl, 0, data.responded_count, 1000);
            animateValue(notRespondedCountEl, 0, data.not_responded_count, 1000);

            respondedBadge.textContent = data.responded_count;
            notRespondedBadge.textContent = data.not_responded_count;

            renderList(respondedUl, data.responded_list, 'verified');
            renderList(notRespondedUl, data.not_responded_list, 'missing');

            resultsSection.classList.remove('hidden');
            resultsSection.scrollIntoView({ behavior: 'smooth' });
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

        function renderList(ul, items, type) {
            ul.innerHTML = '';
            items.forEach(item => {
                const li = document.createElement('li');
                const name = typeof item === 'object' ? item.name : item;
                // Add some cyber decoration
                li.innerHTML = `<span style="color: ${type === 'verified' ? 'var(--signal-green)' : 'var(--alert-red)'}">[${type === 'verified' ? 'OK' : '!!'}]</span> ${name}`;
                ul.appendChild(li);
            });
        }

        function showError(msg) {
            errorText.textContent = msg;
            errorBanner.classList.remove('hidden');
            setTimeout(() => errorBanner.classList.add('hidden'), 5000);
        }

        function clearError() {
            if (errorBanner) errorBanner.classList.add('hidden');
        }

        // --- Export Support (Excel) ---
        const copyRespondedBtn = document.getElementById('copyResponded');
        const copyNotRespondedBtn = document.getElementById('copyNotResponded');

        if (copyRespondedBtn) {
            copyRespondedBtn.addEventListener('click', () => {
                if (!currentData) return;
                exportExcel(currentData.responded_list, 'verified');
            });
        }

        if (copyNotRespondedBtn) {
            copyNotRespondedBtn.addEventListener('click', () => {
                if (!currentData) return;
                exportExcel(currentData.not_responded_list, 'missing');
            });
        }

        async function exportExcel(items, type) {
            try {
                const res = await fetch('/export', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ items, type })
                });

                if (!res.ok) throw new Error("Export failed");

                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `BlackShip_${type}_export.xlsx`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            } catch (err) {
                showError("EXPORT FAILED: " + err.message);
            }
        }
    }

    // Initialize on first load
    initTracker();
    bindNavButtons();
});
