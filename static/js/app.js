// Reset to home on page load/refresh
history.replaceState(null, '', window.location.pathname);

// Store user data globally
let currentUser = null;

// Helper function to set header section
function setHeaderSection(text) {
    const section = document.getElementById('header-section');
    const separator = document.querySelector('.header-separator');

    if (text) {
        section.textContent = text;
        separator.classList.add('visible');
    } else {
        section.textContent = '';
        separator.classList.remove('visible');
    }
}

// Load user data
fetch('/auth/me').then(r => {
    if (!r.ok) throw new Error('Not authenticated');
    return r.json();
}).then(u => {
    currentUser = u;

    document.getElementById('user-name').textContent = u.username || 'User';
    document.getElementById('dropdown-name').textContent = u.username || 'User';
    document.getElementById('dropdown-email').textContent = u.email || '';

    if (u.picture) {
        document.getElementById('account-img').src = u.picture;
        document.getElementById('dropdown-img').src = u.picture;
    }

    const slackToken = document.getElementById('slack-token');
    if (slackToken && u.bot_token) {
        slackToken.value = u.bot_token;
    }

    // Load workspaces
    const workspacesList = document.getElementById('workspaces-list');
    if (workspacesList) {
        if (u.has_workspace && u.workspace_name) {
            workspacesList.innerHTML = `<a href="#workspace" class="sidebar-submenu-item" data-workspace-id="${u.workspace_id}">${u.workspace_name}</a>`;
        } else {
            workspacesList.innerHTML = '<a href="#settings" class="sidebar-submenu-item">+ Add workspace</a>';
        }
    }

    // Load templates by workspace_id
    const templatesList = document.getElementById('templates-list');
    if (templatesList && u.workspace_id) {
        fetch(`/templates?workspace_id=${u.workspace_id}`).then(r => r.json()).then(data => {
            if (data.templates && data.templates.length > 0) {
                templatesList.innerHTML = data.templates.map(t =>
                    `<a href="#template" class="sidebar-submenu-item" data-template-id="${t.template_id}">${t.template_id}</a>`
                ).join('');
            } else {
                templatesList.innerHTML = '<a href="#" class="sidebar-submenu-item">No templates yet</a>';
            }
        }).catch(() => {
            templatesList.innerHTML = '<a href="#" class="sidebar-submenu-item">No templates yet</a>';
        });
    } else if (templatesList) {
        templatesList.innerHTML = '<a href="#" class="sidebar-submenu-item">No workspace</a>';
    }
}).catch(() => {
    // Redirect to login if not authenticated
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

// Workspace click handler
document.addEventListener('click', async (e) => {
    const workspaceLink = e.target.closest('[data-workspace-id]');
    if (workspaceLink) {
        const workspaceId = workspaceLink.dataset.workspaceId;
        setHeaderSection('Workspaces');
        await loadWorkspaceDetails(workspaceId);
    }
});

// Template click handler
document.addEventListener('click', async (e) => {
    const templateLink = e.target.closest('[data-template-id]');
    if (templateLink) {
        const templateId = templateLink.dataset.templateId;
        setHeaderSection('Templates');
        await loadTemplateDetails(templateId);
    }
});

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
        }
    }

    // Also handle dropdown settings link
    const dropdownLink = e.target.closest('.dropdown-item');
    if (dropdownLink && dropdownLink.getAttribute('href') === '#settings') {
        setHeaderSection('Settings');
    }
});

// Load workspace details by ID
async function loadWorkspaceDetails(workspaceId) {
    try {
        const res = await fetch(`/workspace/by-id/${encodeURIComponent(workspaceId)}`);
        const data = await res.json();

        if (res.ok && data.success) {
            const ws = data.workspace;

            document.getElementById('workspace-title').textContent = ws.workspace_name || 'Workspace';
            document.getElementById('workspace-subtitle').textContent = 'Workspace details and configuration';
            document.getElementById('workspace-id').textContent = ws.workspace_id || '-';
            document.getElementById('workspace-owner').textContent = ws.username || '-';
            document.getElementById('workspace-email').textContent = ws.gmail || '-';
            document.getElementById('workspace-token').textContent = ws.bot_token ? '••••••••' + ws.bot_token.slice(-8) : 'Not set';
            document.getElementById('workspace-created').textContent = ws.created_at ? new Date(ws.created_at).toLocaleDateString() : '-';
            document.getElementById('workspace-updated').textContent = ws.updated_at ? new Date(ws.updated_at).toLocaleDateString() : '-';
        } else {
            document.getElementById('workspace-subtitle').textContent = 'Workspace not found';
        }
    } catch (err) {
        document.getElementById('workspace-subtitle').textContent = 'Error loading workspace';
    }
}

// Load template details by ID
async function loadTemplateDetails(templateId) {
    try {
        const res = await fetch(`/templates/by-id/${encodeURIComponent(templateId)}`);
        const data = await res.json();

        if (res.ok && data.success) {
            const t = data.template;
            const ac = t.action_chain || {};

            document.getElementById('template-title').textContent = t.template_id || 'Template';
            document.getElementById('template-subtitle').textContent = 'Template configuration and actions';
            document.getElementById('template-id').textContent = t.template_id || '-';
            document.getElementById('template-workspace-id').textContent = t.workspace_id || '-';

            // Trigger
            const trigger = ac.trigger;
            if (typeof trigger === 'string') {
                document.getElementById('template-trigger').textContent = trigger;
            } else if (trigger && trigger.type) {
                document.getElementById('template-trigger').textContent = trigger.type;
            } else {
                document.getElementById('template-trigger').textContent = '-';
            }

            // Blocks
            document.getElementById('template-blocks').textContent = ac.blocks ? ac.blocks.join(' → ') : '-';

            // Created
            document.getElementById('template-created').textContent = t.created_at ? new Date(t.created_at).toLocaleDateString() : '-';

            // Message config
            const msg = ac.message || {};
            if (msg.channel_name) {
                document.getElementById('template-target').textContent = '#' + msg.channel_name;
            } else if (msg.users) {
                document.getElementById('template-target').textContent = msg.users.length + ' user(s)';
            } else {
                document.getElementById('template-target').textContent = '-';
            }

            document.getElementById('template-message').textContent = msg.message || '-';
            document.getElementById('template-response').textContent = ac.response || '-';

            // Store template ID for actions
            const runBtn = document.getElementById('run-template-btn');
            const deleteBtn = document.getElementById('delete-template-btn');
            if (runBtn) runBtn.dataset.templateId = t.template_id;
            if (deleteBtn) deleteBtn.dataset.templateId = t.template_id;

        } else {
            document.getElementById('template-subtitle').textContent = 'Template not found';
        }
    } catch (err) {
        document.getElementById('template-subtitle').textContent = 'Error loading template';
    }
}

// Run template button
const runBtn = document.getElementById('run-template-btn');
if (runBtn) {
    runBtn.addEventListener('click', async (e) => {
        const templateId = e.target.dataset.templateId;
        const status = document.getElementById('template-action-status');

        if (!templateId) return;

        e.target.textContent = 'Running...';
        e.target.disabled = true;

        try {
            const res = await fetch('/templates/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ template_id: templateId })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                status.textContent = '✓ Template executed';
                status.style.color = '#4ade80';
            } else {
                status.textContent = '✗ ' + (data.detail || 'Failed');
                status.style.color = '#f87171';
            }
        } catch (err) {
            status.textContent = '✗ Error';
            status.style.color = '#f87171';
        }

        e.target.textContent = 'Run Template';
        e.target.disabled = false;

        setTimeout(() => { status.textContent = ''; }, 3000);
    });
}

// Delete template button
const deleteBtn = document.getElementById('delete-template-btn');
if (deleteBtn) {
    deleteBtn.addEventListener('click', async (e) => {
        const templateId = e.target.dataset.templateId;
        const status = document.getElementById('template-action-status');

        if (!templateId) return;

        if (!confirm(`Delete template "${templateId}"?`)) return;

        e.target.textContent = 'Deleting...';
        e.target.disabled = true;

        try {
            const res = await fetch(`/templates/delete/${encodeURIComponent(templateId)}`, {
                method: 'DELETE'
            });

            const data = await res.json();

            if (res.ok && data.success) {
                status.textContent = '✓ Deleted';
                status.style.color = '#4ade80';
                setTimeout(() => { window.location.hash = '#home'; location.reload(); }, 1000);
            } else {
                status.textContent = '✗ ' + (data.detail || 'Failed');
                status.style.color = '#f87171';
            }
        } catch (err) {
            status.textContent = '✗ Error';
            status.style.color = '#f87171';
        }

        e.target.textContent = 'Delete';
        e.target.disabled = false;
    });
}