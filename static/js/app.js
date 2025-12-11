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
fetch('/auth/me', {
    credentials: 'same-origin'
}).then(r => {
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
    loadTemplatesSidebar(); // Load all templates, not filtered by workspace
    loadDashboardsSidebar();
    loadTeamsSidebar();

    // Load empty state lists
    loadWorkspaceEmptyList();
    loadTemplateEmptyList(); // Load all templates
    loadDashboardEmptyList();
    loadTeamEmptyList();

}).catch((err) => {
    console.error('Auth check failed:', err);
    window.location.href = '/login';
});

// === EMPTY STATE LIST LOADERS ===

// Load workspace empty list
function loadWorkspaceEmptyList() {
    const list = document.getElementById('workspace-empty-list');
    if (!list) return;

    list.innerHTML = '<div class="empty-state-list-title">Workspaces</div><div class="empty-state-list-empty">Loading...</div>';

    fetch('/workspace/list', { credentials: 'same-origin' }).then(r => r.json()).then(data => {
        let html = '<div class="empty-state-list-title">Workspaces</div>';
        if (data.workspaces && data.workspaces.length > 0) {
            html += data.workspaces.map(ws =>
                `<a class="empty-state-list-item" data-workspace-id="${ws._id}">${ws.workspace_name}</a>`
            ).join('');
        } else {
            html += '<div class="empty-state-list-empty">No workspaces yet</div>';
        }
        list.innerHTML = html;
    }).catch(() => {
        list.innerHTML = '<div class="empty-state-list-title">Workspaces</div><div class="empty-state-list-empty">No workspaces yet</div>';
    });
}

// Load template empty list
// If workspaceId is provided, filter by workspace; otherwise load all templates
function loadTemplateEmptyList(workspaceId) {
    const list = document.getElementById('template-empty-list');
    if (!list) return;

    list.innerHTML = '<div class="empty-state-list-title">Templates</div><div class="empty-state-list-empty">Loading...</div>';

    // Build URL - include workspace filter only if provided
    const url = workspaceId ? `/templates?workspace_id=${workspaceId}` : '/templates';

    fetch(url).then(r => r.json()).then(data => {
        let html = '<div class="empty-state-list-title">Templates</div>';
        if (data.templates && data.templates.length > 0) {
            html += data.templates.map(t =>
                `<a class="empty-state-list-item" data-template-id="${t.template_id}">${t.template_id}</a>`
            ).join('');
        } else {
            html += '<div class="empty-state-list-empty">No templates yet</div>';
        }
        list.innerHTML = html;
    }).catch(() => {
        list.innerHTML = '<div class="empty-state-list-title">Templates</div><div class="empty-state-list-empty">No templates yet</div>';
    });
}

// Load dashboard empty list
function loadDashboardEmptyList() {
    const list = document.getElementById('dashboard-empty-list');
    if (!list) return;

    list.innerHTML = '<div class="empty-state-list-title">Dashboards</div><div class="empty-state-list-empty">Loading...</div>';

    fetch('/dashboards/list', { credentials: 'same-origin' }).then(r => r.json()).then(data => {
        let html = '<div class="empty-state-list-title">Dashboards</div>';
        if (data.dashboards && data.dashboards.length > 0) {
            html += data.dashboards.map(d =>
                `<a class="empty-state-list-item" data-dashboard-id="${d._id}">${d.dashboard_name}</a>`
            ).join('');
        } else {
            html += '<div class="empty-state-list-empty">No dashboards yet</div>';
        }
        list.innerHTML = html;
    }).catch(() => {
        list.innerHTML = '<div class="empty-state-list-title">Dashboards</div><div class="empty-state-list-empty">No dashboards yet</div>';
    });
}

// Load team empty list
function loadTeamEmptyList() {
    const list = document.getElementById('team-empty-list');
    if (!list) return;

    list.innerHTML = '<div class="empty-state-list-title">Teams</div><div class="empty-state-list-empty">Loading...</div>';

    fetch('/teams/list', { credentials: 'same-origin' }).then(r => r.json()).then(data => {
        let html = '<div class="empty-state-list-title">Teams</div>';
        if (data.teams && data.teams.length > 0) {
            html += data.teams.map(t =>
                `<a class="empty-state-list-item" data-team-id="${t._id}">${t.team_name}</a>`
            ).join('');
        } else {
            html += '<div class="empty-state-list-empty">No teams yet</div>';
        }
        list.innerHTML = html;
    }).catch(() => {
        list.innerHTML = '<div class="empty-state-list-title">Teams</div><div class="empty-state-list-empty">No teams yet</div>';
    });
}

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
                credentials: 'same-origin',
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
            setHeaderSection('Canvas');
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

// Handle collapsed sidebar clicks - navigate to views
document.addEventListener('click', (e) => {
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const isCollapsed = sidebarToggle && !sidebarToggle.checked;

    // Only handle when sidebar is collapsed
    if (!isCollapsed) return;

    const sidebarBtn = e.target.closest('.sidebar-group .sidebar-btn');
    if (!sidebarBtn) return;

    // Determine which group was clicked
    const group = sidebarBtn.closest('.sidebar-group');
    if (!group) return;

    const groupId = group.id;

    // Navigate to appropriate view
    if (groupId === 'dashboards-group') {
        e.preventDefault();
        window.location.hash = '#dashboards';
        setHeaderSection('Dashboards');
    } else if (groupId === 'teams-group') {
        e.preventDefault();
        window.location.hash = '#teams';
        setHeaderSection('Teams');
    } else if (groupId === 'workspaces-group') {
        e.preventDefault();
        window.location.hash = '#workspace';
        setHeaderSection('Workspaces');
    } else if (groupId === 'templates-group') {
        e.preventDefault();
        window.location.hash = '#template';
        setHeaderSection('Templates');
    }
});

// NOTE: Click handlers for [data-workspace-id], [data-template-id],
// [data-dashboard-id], [data-team-id] are in tabs.js
// Do NOT add duplicate handlers here!