document.addEventListener('DOMContentLoaded', () => {
    const checkBtn = document.getElementById('checkBtn');
    const sheetUrlInput = document.getElementById('sheetUrl');
    const loadingSection = document.getElementById('loading');
    const resultsSection = document.getElementById('results');
    const mainInput = document.querySelector('.main-input');

    // Stats Elements
    const totalCountEl = document.getElementById('totalCount');
    const respondedCountEl = document.getElementById('respondedCount');
    const notRespondedCountEl = document.getElementById('notRespondedCount');

    // List Elements
    const respondedUl = document.getElementById('respondedUl');
    const notRespondedUl = document.getElementById('notRespondedUl');
    const respondedBadge = document.getElementById('respondedBadge');
    const notRespondedBadge = document.getElementById('notRespondedBadge');

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
        const url = sheetUrlInput.value.trim();

        if (!url) {
            showError("Please enter a Google Sheet URL.");
            return;
        }

        if (!url.includes("docs.google.com/spreadsheets")) {
            showError("That doesn't look like a valid Google Sheet URL.");
            return;
        }

        // Reset UI
        clearError();
        resultsSection.classList.add('hidden');
        loadingSection.classList.remove('hidden');
        checkBtn.disabled = true;
        checkBtn.innerHTML = '<span>Checking...</span>';
        currentData = null;

        try {
            const response = await fetch('/check', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url: url }),
            });

            const data = await response.json();

            if (!response.ok) {
                if (data.error && data.error.includes("Client Error")) {
                    throw new Error("Could not access the sheet. Make sure 'Anyone with the link' is set to 'Viewer'.");
                }
                throw new Error(data.error || "An unexpected error occurred.");
            }

            currentData = data;

            // Populate Results
            totalCountEl.textContent = data.total_students;
            respondedCountEl.textContent = data.responded_count;
            notRespondedCountEl.textContent = data.not_responded_count;

            respondedBadge.textContent = data.responded_count;
            notRespondedBadge.textContent = data.not_responded_count;

            // Populate Lists
            renderList(respondedUl, data.responded_list);
            renderList(notRespondedUl, data.not_responded_list);

            // Show Results
            loadingSection.classList.add('hidden');
            resultsSection.classList.remove('hidden');

            // Scroll to results
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

        items.forEach(name => {
            const li = document.createElement('li');
            li.textContent = name;
            ulElement.appendChild(li);
        });
    }

    // Input animation listener
    sheetUrlInput.addEventListener('focus', () => {
        clearError();
    });
});
