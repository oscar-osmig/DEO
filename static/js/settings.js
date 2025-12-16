// === SETTINGS ===

// Token masking - store actual token value
let actualTokenValue = '';

// Handle token display field input - show asterisks, store actual value
function setupTokenMasking() {
    const displayInput = document.getElementById('slack-token-display');
    const hiddenInput = document.getElementById('slack-token');

    if (!displayInput || !hiddenInput) return;

    // Reset state
    actualTokenValue = '';
    displayInput.value = '';
    hiddenInput.value = '';

    // Handle keydown for special keys
    displayInput.addEventListener('keydown', (e) => {
        // Allow: backspace, delete, tab, escape, enter, and navigation keys
        if (e.key === 'Backspace') {
            e.preventDefault();
            actualTokenValue = actualTokenValue.slice(0, -1);
            displayInput.value = '*'.repeat(actualTokenValue.length);
            hiddenInput.value = actualTokenValue;
        } else if (e.key === 'Delete') {
            e.preventDefault();
            actualTokenValue = '';
            displayInput.value = '';
            hiddenInput.value = '';
        }
    });

    // Handle regular character input
    displayInput.addEventListener('input', (e) => {
        const inputType = e.inputType;

        if (inputType === 'insertText' && e.data) {
            // Add character to actual value
            actualTokenValue += e.data;
        } else if (inputType === 'insertFromPaste') {
            // Handle paste - get the pasted text from the display field before we mask it
            // The display field now has the pasted content mixed with asterisks
            // We need to extract just the new pasted portion
            const currentDisplay = displayInput.value;
            const existingLength = actualTokenValue.length;
            const newChars = currentDisplay.slice(existingLength);
            actualTokenValue += newChars;
        } else if (inputType === 'deleteContentBackward') {
            // Already handled in keydown, but just in case
            actualTokenValue = actualTokenValue.slice(0, -1);
        } else if (inputType === 'deleteContentForward' || inputType === 'deleteByCut') {
            actualTokenValue = '';
        }

        // Update displays
        displayInput.value = '*'.repeat(actualTokenValue.length);
        hiddenInput.value = actualTokenValue;
    });

    // Prevent autofill from setting values
    displayInput.addEventListener('change', () => {
        if (!actualTokenValue && displayInput.value) {
            // Browser autofilled - clear it
            displayInput.value = '';
        }
    });
}

// Clear token form and reset masking state
function clearTokenForm() {
    const displayInput = document.getElementById('slack-token-display');
    const hiddenInput = document.getElementById('slack-token');
    const nameInput = document.getElementById('token-name');

    actualTokenValue = '';

    if (displayInput) displayInput.value = '';
    if (hiddenInput) hiddenInput.value = '';
    if (nameInput) nameInput.value = '';
}

// Load saved tokens on settings view
function loadSettingsTokens() {
    const list = document.getElementById('settings-tokens-list');
    if (!list) return;

    fetch('/account/tokens', { credentials: 'same-origin' })
        .then(r => r.json())
        .then(data => {
            console.log('Loaded tokens:', data);
            if (data.tokens && data.tokens.length > 0) {
                list.innerHTML = data.tokens.map(t => `
                    <div class="settings-token-item">
                        <div class="settings-token-info">
                            <span class="settings-token-name">${t.name}</span>
                            <span class="settings-token-value">${t.masked}</span>
                        </div>
                        <button class="btn btn-small btn-secondary delete-token-btn" data-token-id="${t.id}">Delete</button>
                    </div>
                `).join('');
            } else {
                list.innerHTML = `
                    <div class="settings-tokens-empty">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                        <p>No saved tokens yet</p>
                    </div>
                `;
            }
        })
        .catch(err => {
            console.error('Error loading tokens:', err);
            list.innerHTML = '<p class="text-muted">Could not load tokens</p>';
        });
}

// Load account info for settings page
function loadSettingsAccountInfo() {
    const nameEl = document.getElementById('settings-account-name');
    const emailEl = document.getElementById('settings-account-email');
    const avatarEl = document.getElementById('settings-avatar');

    if (!nameEl || !emailEl) return;

    // Use cached user data if available
    if (typeof currentUser !== 'undefined' && currentUser) {
        nameEl.textContent = currentUser.name || currentUser.email?.split('@')[0] || 'User';
        emailEl.textContent = currentUser.email || '';
        if (avatarEl) {
            avatarEl.textContent = (currentUser.name || currentUser.email || 'U').charAt(0).toUpperCase();
        }
    } else {
        // Fetch from API
        fetch('/auth/me', { credentials: 'same-origin' })
            .then(r => r.json())
            .then(data => {
                if (data.email) {
                    nameEl.textContent = data.name || data.email.split('@')[0];
                    emailEl.textContent = data.email;
                    if (avatarEl) {
                        avatarEl.textContent = (data.name || data.email).charAt(0).toUpperCase();
                    }
                }
            })
            .catch(err => {
                console.error('Error loading account info:', err);
                nameEl.textContent = 'Unable to load';
                emailEl.textContent = '';
            });
    }
}

// Save token form - use event delegation
document.addEventListener('submit', async (e) => {
    if (e.target.id !== 'token-form') return;
    e.preventDefault();

    console.log('Token form submitted');

    const name = document.getElementById('token-name').value;
    const token = document.getElementById('slack-token').value;
    const status = document.getElementById('token-status');
    const btn = document.getElementById('save-token-btn');

    console.log('Saving token:', { name, tokenLength: token.length });

    if (!name || !token) {
        status.textContent = '✗ Name and token are required';
        status.style.color = '#f87171';
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Saving...';
    status.textContent = '';

    try {
        const res = await fetch('/account/tokens', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ name, token })
        });

        console.log('Save response status:', res.status);
        const data = await res.json();
        console.log('Save response data:', data);

        if (res.ok && data.success) {
            status.textContent = '✓ Token saved';
            status.style.color = '#4ade80';
            clearTokenForm();
            loadSettingsTokens();
        } else {
            status.textContent = '✗ ' + (data.detail || 'Failed to save');
            status.style.color = '#f87171';
        }
    } catch (err) {
        console.error('Error saving token:', err);
        status.textContent = '✗ Connection error';
        status.style.color = '#f87171';
    }

    btn.disabled = false;
    btn.textContent = 'Save Token';

    setTimeout(() => { status.textContent = ''; }, 3000);
});

// Delete token button
document.addEventListener('click', async (e) => {
    if (!e.target.classList.contains('delete-token-btn')) return;

    const tokenId = e.target.dataset.tokenId;
    if (!tokenId) return;

    const confirmed = await confirmDelete({
        title: 'Delete Token',
        message: 'Are you sure you want to delete this token?',
        warning: 'Workspaces using this token will not be affected.'
    });
    if (!confirmed) return;

    e.target.textContent = 'Deleting...';
    e.target.disabled = true;

    try {
        const res = await fetch(`/account/tokens/${tokenId}`, {
            method: 'DELETE',
            credentials: 'same-origin'
        });

        if (res.ok) {
            loadSettingsTokens();
        } else {
            e.target.textContent = 'Delete';
            e.target.disabled = false;
        }
    } catch (err) {
        console.error('Error deleting token:', err);
        e.target.textContent = 'Delete';
        e.target.disabled = false;
    }
});

// Delete account button
document.addEventListener('click', async (e) => {
    if (e.target.id !== 'delete-account-btn') return;

    const status = document.getElementById('account-action-status');

    const confirmed = await confirmDelete({
        title: 'Delete Account',
        message: 'Are you sure you want to delete your account and ALL data?',
        warning: 'This will permanently delete all workspaces, teams, dashboards, and templates. This action cannot be undone.',
        confirmText: 'Delete Account'
    });
    if (!confirmed) return;

    e.target.textContent = 'Deleting...';
    e.target.disabled = true;

    try {
        const res = await fetch('/account/delete-all', {
            method: 'DELETE',
            credentials: 'same-origin'
        });

        const data = await res.json();

        if (res.ok && data.success) {
            status.textContent = '✓ Account deleted. Redirecting...';
            status.style.color = '#4ade80';
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
        } else {
            status.textContent = '✗ ' + (data.detail || 'Failed');
            status.style.color = '#f87171';
        }
    } catch (err) {
        status.textContent = '✗ Error';
        status.style.color = '#f87171';
    }

    e.target.textContent = 'Delete Account';
    e.target.disabled = false;
});

// Load settings data when settings view becomes visible
function loadSettingsPage() {
    loadSettingsTokens();
    loadSettingsAccountInfo();
    clearTokenForm();
    setupTokenMasking();
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.location.hash === '#settings') {
        loadSettingsPage();
    }
});

// Also load when hash changes to settings
window.addEventListener('hashchange', () => {
    if (window.location.hash === '#settings') {
        loadSettingsPage();
    }
});