// === WORKSPACE FUNCTIONS ===

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

// Load workspaces into sidebar
function loadWorkspacesSidebar(userEmail) {
    const workspacesList = document.getElementById('workspaces-list');
    if (!workspacesList || !userEmail) {
        if (workspacesList) {
            workspacesList.innerHTML = '<a href="#workspace" class="sidebar-submenu-item add-new" id="sidebar-add-workspace">+ Add workspace</a>';
        }
        return;
    }

    fetch(`/workspace/by-account/${encodeURIComponent(userEmail)}`).then(r => r.json()).then(data => {
        let html = '<a href="#workspace" class="sidebar-submenu-item add-new" id="sidebar-add-workspace">+ Add workspace</a>';
        if (data.workspaces && data.workspaces.length > 0) {
            html += data.workspaces.map(ws =>
                `<a href="#workspace" class="sidebar-submenu-item" data-workspace-id="${ws.workspace_id}">${ws.workspace_name}</a>`
            ).join('');
        }
        workspacesList.innerHTML = html;
    }).catch((err) => {
        console.error('Error loading workspaces:', err);
        workspacesList.innerHTML = '<a href="#workspace" class="sidebar-submenu-item add-new" id="sidebar-add-workspace">+ Add workspace</a>';
    });
}

// Create Workspace Modal handlers
document.addEventListener('click', (e) => {
    // Open modal from header button
    if (e.target.closest('#create-workspace-btn')) {
        const modal = document.getElementById('create-workspace-modal');
        if (modal) modal.classList.add('active');
    }

    // Open modal from sidebar
    if (e.target.closest('#sidebar-add-workspace')) {
        e.preventDefault();
        window.location.hash = '#workspace';
        setHeaderSection('Workspaces');
        const modal = document.getElementById('create-workspace-modal');
        if (modal) modal.classList.add('active');
    }

    // Close modal
    if (e.target.closest('#close-workspace-modal') || e.target.closest('#cancel-workspace-btn')) {
        const modal = document.getElementById('create-workspace-modal');
        if (modal) {
            modal.classList.remove('active');
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

                setTimeout(async () => {
                    const modal = document.getElementById('create-workspace-modal');
                    if (modal) modal.classList.remove('active');

                    e.target.reset();
                    status.textContent = '';

                    await openWorkspaceTab(workspaceId);

                    // Refresh sidebar
                    if (currentUser?.email) {
                        loadWorkspacesSidebar(currentUser.email);
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