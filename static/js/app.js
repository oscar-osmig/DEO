// Track open workspace tabs
let openWorkspaceTabs = [];
let activeWorkspaceTab = null;

// Track open template tabs
let openTemplateTabs = [];
let activeTemplateTab = null;

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

// Generate random template name
function generateTemplateName() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    for (let i = 0; i < 6; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `Template-${id}`;
}

// Initialize template name when navigating to new-deo
function initNewDeo() {
    const templateNameInput = document.getElementById('template-name-input');
    if (templateNameInput && !templateNameInput.value) {
        templateNameInput.value = generateTemplateName();
    }
}

// Check if there's a hash in URL and set header section accordingly
function initFromHash() {
    const hash = window.location.hash;
    if (hash === '#settings') {
        setHeaderSection('Settings');
    } else if (hash === '#new-deo') {
        setHeaderSection('New Deo');
        initNewDeo();
    } else if (hash === '#workspace') {
        setHeaderSection('Workspaces');
    } else if (hash === '#template') {
        setHeaderSection('Templates');
    } else if (hash === '#dashboards') {
        setHeaderSection('Dashboards');
    } else {
        setHeaderSection('');
    }
}

// Run on page load
window.addEventListener('DOMContentLoaded', () => {
    initFromHash();
});

// Also handle back/forward navigation
window.addEventListener('hashchange', () => {
    initFromHash();
});

// Show/hide workspace empty state
function updateWorkspaceView() {
    const emptyState = document.getElementById('workspace-empty-state');
    const details = document.getElementById('workspace-details');

    if (openWorkspaceTabs.length === 0) {
        if (emptyState) emptyState.style.display = 'flex';
        if (details) details.style.display = 'none';
    } else {
        if (emptyState) emptyState.style.display = 'none';
        if (details) details.style.display = 'block';
    }
}

// Show/hide template empty state
function updateTemplateView() {
    const emptyState = document.getElementById('template-empty-state');
    const details = document.getElementById('template-details');

    if (openTemplateTabs.length === 0) {
        if (emptyState) emptyState.style.display = 'flex';
        if (details) details.style.display = 'none';
    } else {
        if (emptyState) emptyState.style.display = 'none';
        if (details) details.style.display = 'block';
    }
}

// Render workspace tabs
function renderWorkspaceTabs() {
    const tabsBar = document.getElementById('workspace-tabs');
    if (!tabsBar) return;

    tabsBar.innerHTML = openWorkspaceTabs.map(tab => {
        const isActive = tab.id === activeWorkspaceTab;
        return `
            <div class="tab ${isActive ? 'active' : ''}" data-tab-id="${tab.id}" data-tab-type="workspace">
                <span class="tab-name">${tab.name}</span>
                <span class="tab-close" data-close-tab="${tab.id}" data-close-type="workspace">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </span>
            </div>
        `;
    }).join('');

    updateWorkspaceView();
}

// Render template tabs
function renderTemplateTabs() {
    const tabsBar = document.getElementById('template-tabs');
    if (!tabsBar) return;

    tabsBar.innerHTML = openTemplateTabs.map(tab => {
        const isActive = tab.id === activeTemplateTab;
        return `
            <div class="tab ${isActive ? 'active' : ''}" data-tab-id="${tab.id}" data-tab-type="template">
                <span class="tab-name">${tab.name}</span>
                <span class="tab-close" data-close-tab="${tab.id}" data-close-type="template">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </span>
            </div>
        `;
    }).join('');

    updateTemplateView();
}

// Open workspace in tab
async function openWorkspaceTab(workspaceId) {
    // Check if tab already exists
    const existingTab = openWorkspaceTabs.find(tab => tab.id === workspaceId);

    if (existingTab) {
        // Just switch to it
        activeWorkspaceTab = workspaceId;
        renderWorkspaceTabs();
        await loadWorkspaceDetails(workspaceId);
        return;
    }

    // Fetch workspace data
    try {
        const res = await fetch(`/workspace/by-id/${encodeURIComponent(workspaceId)}`);
        const data = await res.json();

        if (res.ok && data.success) {
            const ws = data.workspace;

            // Add new tab
            openWorkspaceTabs.push({
                id: workspaceId,
                name: ws.workspace_name || 'Workspace'
            });

            activeWorkspaceTab = workspaceId;
            renderWorkspaceTabs();
            await loadWorkspaceDetails(workspaceId);
        }
    } catch (err) {
        console.error('Error opening workspace tab:', err);
    }
}

// Open template in tab
async function openTemplateTab(templateId) {
    // Check if tab already exists
    const existingTab = openTemplateTabs.find(tab => tab.id === templateId);

    if (existingTab) {
        // Just switch to it
        activeTemplateTab = templateId;
        renderTemplateTabs();
        await loadTemplateDetails(templateId);
        return;
    }

    // Fetch template data
    try {
        const res = await fetch(`/templates/by-id/${encodeURIComponent(templateId)}`);
        const data = await res.json();

        if (res.ok && data.success) {
            const t = data.template;

            // Add new tab
            openTemplateTabs.push({
                id: templateId,
                name: t.template_id || 'Template'
            });

            activeTemplateTab = templateId;
            renderTemplateTabs();
            await loadTemplateDetails(templateId);
        }
    } catch (err) {
        console.error('Error opening template tab:', err);
    }
}

// Close workspace tab
function closeWorkspaceTab(workspaceId) {
    const index = openWorkspaceTabs.findIndex(tab => tab.id === workspaceId);
    if (index === -1) return;

    openWorkspaceTabs.splice(index, 1);

    // If closing active tab, switch to another
    if (activeWorkspaceTab === workspaceId) {
        if (openWorkspaceTabs.length > 0) {
            // Switch to previous tab or first available
            const newIndex = Math.max(0, index - 1);
            activeWorkspaceTab = openWorkspaceTabs[newIndex].id;
            loadWorkspaceDetails(activeWorkspaceTab);
        } else {
            // No tabs left, show empty state
            activeWorkspaceTab = null;
        }
    }

    renderWorkspaceTabs();
}

// Close template tab
function closeTemplateTab(templateId) {
    const index = openTemplateTabs.findIndex(tab => tab.id === templateId);
    if (index === -1) return;

    openTemplateTabs.splice(index, 1);

    // If closing active tab, switch to another
    if (activeTemplateTab === templateId) {
        if (openTemplateTabs.length > 0) {
            // Switch to previous tab or first available
            const newIndex = Math.max(0, index - 1);
            activeTemplateTab = openTemplateTabs[newIndex].id;
            loadTemplateDetails(activeTemplateTab);
        } else {
            // No tabs left, show empty state
            activeTemplateTab = null;
        }
    }

    renderTemplateTabs();
}

// Load user data
fetch('/auth/me').then(r => {
    if (!r.ok) throw new Error('Not authenticated');
    return r.json();
}).then(u => {
    currentUser = u;

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

    const slackToken = document.getElementById('slack-token');
    if (slackToken && u.bot_token) {
        slackToken.value = u.bot_token;
    }

    // Load ALL workspaces for this user
    const workspacesList = document.getElementById('workspaces-list');
    if (workspacesList && u.email) {
        fetch(`/workspace/by-account/${encodeURIComponent(u.email)}`).then(r => r.json()).then(data => {
            if (data.workspaces && data.workspaces.length > 0) {
                workspacesList.innerHTML = data.workspaces.map(ws =>
                    `<a href="#workspace" class="sidebar-submenu-item" data-workspace-id="${ws.workspace_id}">${ws.workspace_name}</a>`
                ).join('');
            } else {
                workspacesList.innerHTML = '<a href="#workspace" class="sidebar-submenu-item">+ Add workspace</a>';
            }
        }).catch(() => {
            workspacesList.innerHTML = '<a href="#workspace" class="sidebar-submenu-item">+ Add workspace</a>';
        });
    } else if (workspacesList) {
        workspacesList.innerHTML = '<a href="#workspace" class="sidebar-submenu-item">+ Add workspace</a>';
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
                templatesList.innerHTML = '<a href="#template" class="sidebar-submenu-item">No templates yet</a>';
            }
        }).catch(() => {
            templatesList.innerHTML = '<a href="#template" class="sidebar-submenu-item">No templates yet</a>';
        });
    } else if (templatesList) {
        templatesList.innerHTML = '<a href="#template" class="sidebar-submenu-item">No workspace</a>';
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

// Workspace and Template click handlers
document.addEventListener('click', async (e) => {
    // Handle workspace sidebar link
    const workspaceLink = e.target.closest('[data-workspace-id]');
    if (workspaceLink && !e.target.closest('.tab')) {
        e.preventDefault();
        const workspaceId = workspaceLink.dataset.workspaceId;
        window.location.hash = '#workspace';
        setHeaderSection('Workspaces');
        await openWorkspaceTab(workspaceId);
        return;
    }

    // Handle template sidebar link
    const templateLink = e.target.closest('[data-template-id]');
    if (templateLink && !e.target.closest('.tab')) {
        e.preventDefault();
        const templateId = templateLink.dataset.templateId;
        window.location.hash = '#template';
        setHeaderSection('Templates');
        await openTemplateTab(templateId);
        return;
    }

    // Handle workspace tab click (switch tabs)
    const workspaceTab = e.target.closest('.tab[data-tab-type="workspace"]');
    if (workspaceTab && !e.target.closest('.tab-close')) {
        const tabId = workspaceTab.dataset.tabId;
        activeWorkspaceTab = tabId;
        renderWorkspaceTabs();
        await loadWorkspaceDetails(tabId);
        return;
    }

    // Handle template tab click (switch tabs)
    const templateTab = e.target.closest('.tab[data-tab-type="template"]');
    if (templateTab && !e.target.closest('.tab-close')) {
        const tabId = templateTab.dataset.tabId;
        activeTemplateTab = tabId;
        renderTemplateTabs();
        await loadTemplateDetails(tabId);
        return;
    }

    // Handle workspace tab close
    const closeWorkspaceBtn = e.target.closest('.tab-close[data-close-type="workspace"]');
    if (closeWorkspaceBtn) {
        e.stopPropagation();
        const tabId = closeWorkspaceBtn.dataset.closeTab;
        closeWorkspaceTab(tabId);
        return;
    }

    // Handle template tab close
    const closeTemplateBtn = e.target.closest('.tab-close[data-close-type="template"]');
    if (closeTemplateBtn) {
        e.stopPropagation();
        const tabId = closeTemplateBtn.dataset.closeTab;
        closeTemplateTab(tabId);
        return;
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
        } else if (href === '#dashboards') {
            setHeaderSection('Dashboards');
        }
    }

    // Also handle dropdown settings link
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

// Load workspace details by ID
async function loadWorkspaceDetails(workspaceId) {
    try {
        const res = await fetch(`/workspace/by-id/${encodeURIComponent(workspaceId)}`);
        const data = await res.json();

        if (res.ok && data.success) {
            const ws = data.workspace;

            const title = document.getElementById('workspace-title');
            if (title) title.textContent = ws.workspace_name || 'Workspace';

            const subtitle = document.getElementById('workspace-subtitle');
            if (subtitle) subtitle.textContent = 'Workspace details and configuration';

            const wsId = document.getElementById('workspace-id');
            if (wsId) wsId.textContent = ws.workspace_id || '-';

            const owner = document.getElementById('workspace-owner');
            if (owner) owner.textContent = ws.username || '-';

            const email = document.getElementById('workspace-email');
            if (email) email.textContent = ws.gmail || '-';

            const token = document.getElementById('workspace-token');
            if (token) token.textContent = ws.bot_token ? '••••••••' + ws.bot_token.slice(-8) : 'Not set';

            const created = document.getElementById('workspace-created');
            if (created) created.textContent = ws.created_at ? new Date(ws.created_at).toLocaleDateString() : '-';

            const updated = document.getElementById('workspace-updated');
            if (updated) updated.textContent = ws.updated_at ? new Date(ws.updated_at).toLocaleDateString() : '-';
        } else {
            const subtitle = document.getElementById('workspace-subtitle');
            if (subtitle) subtitle.textContent = 'Workspace not found';
        }
    } catch (err) {
        const subtitle = document.getElementById('workspace-subtitle');
        if (subtitle) subtitle.textContent = 'Error loading workspace';
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

            const title = document.getElementById('template-title');
            if (title) title.textContent = t.template_id || 'Template';

            const subtitle = document.getElementById('template-subtitle');
            if (subtitle) subtitle.textContent = 'Template configuration and actions';

            const tId = document.getElementById('template-id');
            if (tId) tId.textContent = t.template_id || '-';

            const wsId = document.getElementById('template-workspace-id');
            if (wsId) wsId.textContent = t.workspace_id || '-';

            // Trigger
            const trigger = ac.trigger;
            const triggerEl = document.getElementById('template-trigger');
            if (triggerEl) {
                if (typeof trigger === 'string') {
                    triggerEl.textContent = trigger;
                } else if (trigger && trigger.type) {
                    triggerEl.textContent = trigger.type;
                } else {
                    triggerEl.textContent = '-';
                }
            }

            // Blocks
            const blocksEl = document.getElementById('template-blocks');
            if (blocksEl) blocksEl.textContent = ac.blocks ? ac.blocks.join(' → ') : '-';

            // Created
            const createdEl = document.getElementById('template-created');
            if (createdEl) createdEl.textContent = t.created_at ? new Date(t.created_at).toLocaleDateString() : '-';

            // Message config
            const msg = ac.message || {};
            const targetEl = document.getElementById('template-target');
            if (targetEl) {
                if (msg.channel_name) {
                    targetEl.textContent = '#' + msg.channel_name;
                } else if (msg.users) {
                    targetEl.textContent = msg.users.length + ' user(s)';
                } else {
                    targetEl.textContent = '-';
                }
            }

            const messageEl = document.getElementById('template-message');
            if (messageEl) messageEl.textContent = msg.message || '-';

            const responseEl = document.getElementById('template-response');
            if (responseEl) responseEl.textContent = ac.response || '-';

            // Store template ID for actions
            const runBtn = document.getElementById('run-template-btn');
            const deleteBtn = document.getElementById('delete-template-btn');
            if (runBtn) runBtn.dataset.templateId = t.template_id;
            if (deleteBtn) deleteBtn.dataset.templateId = t.template_id;

        } else {
            const subtitle = document.getElementById('template-subtitle');
            if (subtitle) subtitle.textContent = 'Template not found';
        }
    } catch (err) {
        const subtitle = document.getElementById('template-subtitle');
        if (subtitle) subtitle.textContent = 'Error loading template';
    }
}

// Run template button
document.addEventListener('click', async (e) => {
    if (e.target.id === 'run-template-btn') {
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
    }
});

// Delete template button
document.addEventListener('click', async (e) => {
    if (e.target.id === 'delete-template-btn') {
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

                // Close the tab
                closeTemplateTab(templateId);

                // Refresh page after short delay
                setTimeout(() => { location.reload(); }, 1000);
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
    }
});

// Create Workspace Modal
document.addEventListener('click', (e) => {
    // Open modal
    if (e.target.closest('#create-workspace-btn')) {
        const modal = document.getElementById('create-workspace-modal');
        if (modal) modal.classList.add('active');
    }

    // Close modal
    if (e.target.closest('#close-workspace-modal') || e.target.closest('#cancel-workspace-btn')) {
        const modal = document.getElementById('create-workspace-modal');
        if (modal) {
            modal.classList.remove('active');
            // Reset form
            const form = document.getElementById('create-workspace-form');
            if (form) form.reset();
            const status = document.getElementById('create-workspace-status');
            if (status) status.textContent = '';
        }
    }

    // Close modal on overlay click
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('active');
    }

    // Create template button (placeholder - does nothing for now)
    if (e.target.closest('#create-template-btn')) {
        // TODO: Implement template creation modal
        console.log('Create template clicked');
    }
});

// Create Workspace Form Submission
document.addEventListener('submit', async (e) => {
    if (e.target.id === 'create-workspace-form') {
        e.preventDefault();

        const workspaceName = document.getElementById('new-workspace-name').value;
        const botToken = document.getElementById('new-workspace-token').value;
        const status = document.getElementById('create-workspace-status');
        const submitBtn = document.getElementById('submit-workspace-btn');

        if (!workspaceName || !botToken) {
            status.textContent = 'All fields are required';
            status.className = 'modal-status error';
            return;
        }

        submitBtn.textContent = 'Creating...';
        submitBtn.disabled = true;

        try {
            // Generate workspace ID
            const workspaceId = 'workspace-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

            const res = await fetch('/workspace/make-workspace', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: currentUser?.username || 'User',
                    account_id: currentUser?.email || 'unknown',
                    bot_token: botToken,
                    workspace_name: workspaceName,
                    workspace_id: workspaceId
                })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                status.textContent = '✓ Workspace created!';
                status.className = 'modal-status success';

                // Close modal after short delay
                setTimeout(async () => {
                    const modal = document.getElementById('create-workspace-modal');
                    if (modal) modal.classList.remove('active');

                    // Reset form
                    e.target.reset();
                    status.textContent = '';

                    // Open the new workspace in a tab
                    await openWorkspaceTab(workspaceId);

                    // Refresh sidebar workspaces list
                    const workspacesList = document.getElementById('workspaces-list');
                    if (workspacesList) {
                        const existingItems = workspacesList.innerHTML;
                        if (existingItems.includes('+ Add workspace') || existingItems.includes('No workspace')) {
                            workspacesList.innerHTML = `<a href="#workspace" class="sidebar-submenu-item" data-workspace-id="${workspaceId}">${workspaceName}</a>`;
                        } else {
                            workspacesList.innerHTML += `<a href="#workspace" class="sidebar-submenu-item" data-workspace-id="${workspaceId}">${workspaceName}</a>`;
                        }
                    }
                }, 1000);
            } else {
                status.textContent = '✗ ' + (data.detail || 'Failed to create workspace');
                status.className = 'modal-status error';
            }
        } catch (err) {
            status.textContent = '✗ Connection error';
            status.className = 'modal-status error';
        }

        submitBtn.textContent = 'Create';
        submitBtn.disabled = false;
    }
});