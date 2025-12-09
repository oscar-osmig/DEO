// === SETTINGS ===

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
                    <div class="saved-token-item">
                        <div class="saved-token-info">
                            <span class="saved-token-name">${t.name}</span>
                            <span class="saved-token-value">${t.masked}</span>
                        </div>
                        <button class="btn btn-small btn-secondary delete-token-btn" data-token-id="${t.id}">Delete</button>
                    </div>
                `).join('');
            } else {
                list.innerHTML = '<p class="text-muted">No saved tokens yet</p>';
            }
        })
        .catch(err => {
            console.error('Error loading tokens:', err);
            list.innerHTML = '<p class="text-muted">Could not load tokens</p>';
        });
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
            e.target.reset();
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

    if (!confirm('Delete this token?')) return;

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

    if (!confirm('Are you sure you want to delete your account and ALL data? This cannot be undone.')) return;
    if (!confirm('This will delete all workspaces, teams, dashboards, and templates. Are you absolutely sure?')) return;

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

// Load tokens when settings view becomes visible
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.hash === '#settings') {
        loadSettingsTokens();
    }
});

// Also load when hash changes to settings
window.addEventListener('hashchange', () => {
    if (window.location.hash === '#settings') {
        loadSettingsTokens();
    }
});