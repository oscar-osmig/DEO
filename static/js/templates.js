// === TEMPLATE FUNCTIONS ===

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

// Load templates into sidebar
function loadTemplatesSidebar(workspaceId) {
    const templatesList = document.getElementById('templates-list');
    if (!templatesList) return;

    if (!workspaceId) {
        templatesList.innerHTML = '<a href="#template" class="sidebar-submenu-item">No workspace</a>';
        return;
    }

    fetch(`/templates?workspace_id=${workspaceId}`).then(r => r.json()).then(data => {
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

        const confirmed = await confirmDelete({
            title: 'Delete Template',
            message: `Are you sure you want to delete "${templateId}"?`,
            warning: 'This action cannot be undone.'
        });
        if (!confirmed) return;

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

                closeTemplateTab(templateId);
                loadTemplatesSidebar(currentUser?.workspace_id);
                loadTemplateEmptyList(currentUser?.workspace_id);
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

// Create template button - navigate to canvas
document.addEventListener('click', (e) => {
    if (e.target.closest('#create-template-btn')) {
        window.location.hash = '#new-deo';
        if (typeof setHeaderSection === 'function') setHeaderSection('Canvas');
    }
});

// === CANVAS WORKSPACE SELECTOR ===
let selectedCanvasWorkspace = null;

// Load workspaces into canvas dropdown
async function loadCanvasWorkspaces() {
    const list = document.getElementById('workspace-dropdown-list');
    if (!list) return;

    try {
        const res = await fetch('/workspace/list', { credentials: 'same-origin' });
        const data = await res.json();

        if (res.ok && data.workspaces && data.workspaces.length > 0) {
            list.innerHTML = data.workspaces.map(ws => `
                <div class="workspace-dropdown-item" data-workspace-id="${ws._id}" data-workspace-name="${ws.workspace_name}">
                    ${ws.workspace_name}
                </div>
            `).join('');
        } else {
            list.innerHTML = '<div class="workspace-dropdown-item" style="color: var(--text-muted); cursor: default;">No workspaces</div>';
        }
    } catch (err) {
        list.innerHTML = '<div class="workspace-dropdown-item" style="color: var(--text-muted); cursor: default;">Error loading</div>';
    }
}

// Toggle workspace dropdown
document.addEventListener('click', (e) => {
    const btn = e.target.closest('#workspace-select-btn');
    const wrapper = document.querySelector('.workspace-select-wrapper');

    if (btn && wrapper) {
        e.stopPropagation();
        const isOpen = wrapper.classList.contains('open');

        if (!isOpen) {
            loadCanvasWorkspaces();
        }
        wrapper.classList.toggle('open');
        return;
    }

    // Select workspace from dropdown
    const item = e.target.closest('.workspace-dropdown-item');
    if (item && item.dataset.workspaceId) {
        selectedCanvasWorkspace = item.dataset.workspaceId;
        const nameSpan = document.getElementById('selected-workspace-name');
        if (nameSpan) nameSpan.textContent = item.dataset.workspaceName;

        // Mark as selected
        document.querySelectorAll('.workspace-dropdown-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');

        // Close dropdown
        const wrapper = document.querySelector('.workspace-select-wrapper');
        if (wrapper) wrapper.classList.remove('open');
        return;
    }

    // Close dropdown when clicking outside
    if (wrapper && !wrapper.contains(e.target)) {
        wrapper.classList.remove('open');
    }
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    const wrapper = document.querySelector('.workspace-select-wrapper');
    if (wrapper && !wrapper.contains(e.target)) {
        wrapper.classList.remove('open');
    }
});