// === MAIN APP ===

// Store user data globally
let currentUser = null;

// Run on page load
window.addEventListener('DOMContentLoaded', () => {
    initFromHash();
});

// Handle back/forward navigation
window.addEventListener('hashchange', () => {
    initFromHash();
});

// Load user data
fetch('/auth/me').then(r => {
    if (!r.ok) throw new Error('Not authenticated');
    return r.json();
}).then(u => {
    currentUser = u;

    // Update UI with user info
    const userName = document.getElementById('user-name');
    if (userName) userName.textContent = u.username || 'User';

    const dropdownName = document.getElementById('dropdown-name');
    if (dropdownName) dropdownName.textContent = u.username || 'User';

    const dropdownEmail = document.getElementById('dropdown-email');
    if (dropdownEmail) dropdownEmail.textContent = u.email || '';

    if (u.picture) {
        const accountImg = document.getElementById('account-img');
        if (accountImg) accountImg.src = u.picture;

        const dropdownImg = document.getElementById('dropdown-img');
        if (dropdownImg) dropdownImg.src = u.picture;
    }

    // Load settings token
    const slackToken = document.getElementById('slack-token');
    if (slackToken && u.bot_token) {
        slackToken.value = u.bot_token;
    }

    // Load sidebar data
    loadWorkspacesSidebar(u.email);
    loadTemplatesSidebar(u.workspace_id);
    loadDashboardsSidebar();
    loadTeamsSidebar();

}).catch(() => {
    window.location.href = '/login';
});

// Token form submission
const tokenForm = document.getElementById('token-form');
if (tokenForm) {
    tokenForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const token = document.getElementById('slack-token').value;
        const status = document.getElementById('token-status');
        const btn = document.getElementById('save-token-btn');

        if (!token) {
            status.textContent = '✗ Token required';
            status.className = 'status-error';
            return;
        }

        btn.textContent = 'Saving...';
        btn.disabled = true;

        try {
            const res = await fetch('/auth/update-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bot_token: token })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                status.textContent = '✓ Token saved';
                status.className = 'status-success';
            } else {
                status.textContent = '✗ ' + (data.detail || 'Failed');
                status.className = 'status-error';
            }
        } catch (err) {
            status.textContent = '✗ Connection error';
            status.className = 'status-error';
        }

        btn.textContent = 'Save Token';
        btn.disabled = false;

        setTimeout(() => { status.textContent = ''; }, 3000);
    });
}

// Sidebar navigation - update header section
document.addEventListener('click', (e) => {
    const link = e.target.closest('.sidebar-btn');
    if (link) {
        const href = link.getAttribute('href');
        if (href === '#home') {
            setHeaderSection('');
        } else if (href === '#settings') {
            setHeaderSection('Settings');
        } else if (href === '#new-deo') {
            setHeaderSection('New Deo');
        } else if (href === '#dashboards') {
            setHeaderSection('Dashboards');
        } else if (href === '#teams') {
            setHeaderSection('Teams');
        }
    }

    // Handle dropdown settings link
    const dropdownLink = e.target.closest('.dropdown-item');
    if (dropdownLink && dropdownLink.getAttribute('href') === '#settings') {
        setHeaderSection('Settings');
    }
});

// Handle New Deo click to generate fresh template name
document.addEventListener('click', (e) => {
    const newDeoLink = e.target.closest('a[href="#new-deo"]');
    if (newDeoLink) {
        const templateNameInput = document.getElementById('template-name-input');
        if (templateNameInput) {
            templateNameInput.value = generateTemplateName();
        }
    }
});