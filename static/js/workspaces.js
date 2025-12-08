// === WORKSPACE FUNCTIONS ===

// Load workspace details by ID
async function loadWorkspaceDetails(workspaceId) {
    try {
        const res = await fetch(`/workspace/${encodeURIComponent(workspaceId)}`);
        const data = await res.json();

        if (res.ok && data.workspace) {
            const ws = data.workspace;

            const title = document.getElementById('workspace-title');
            if (title) title.textContent = ws.workspace_name || 'Workspace';

            const subtitle = document.getElementById('workspace-subtitle');
            if (subtitle) subtitle.textContent = 'Workspace configuration and settings';

            const wsId = document.getElementById('workspace-id');
            if (wsId) wsId.textContent = ws._id || '-';

            const owner = document.getElementById('workspace-owner');
            if (owner) owner.textContent = ws.owner_name || ws.owner_email || ws.username || '-';

            const created = document.getElementById('workspace-created');
            if (created) created.textContent = ws.created_at ? new Date(ws.created_at).toLocaleDateString() : '-';

            const status = document.getElementById('workspace-status');
            if (status) {
                status.textContent = ws.is_active !== false ? 'Active' : 'Inactive';
                status.style.color = ws.is_active !== false ? '#4ade80' : '#f87171';
            }

            const token = document.getElementById('workspace-token');
            if (token) {
                const tokenValue = ws.bot_token || '';
                token.textContent = tokenValue ? tokenValue.substring(0, 10) + '••••••••••' : '-';
            }

            // Store workspace ID for delete button
            const deleteBtn = document.getElementById('delete-workspace-btn');
            if (deleteBtn) deleteBtn.dataset.workspaceId = ws._id;

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
function loadWorkspacesSidebar() {
    const workspacesList = document.getElementById('workspaces-list');
    if (!workspacesList) return;

    fetch('/workspace/list', { credentials: 'same-origin' }).then(r => r.json()).then(data => {
        let html = '<a href="#workspace" class="sidebar-submenu-item add-new" id="sidebar-add-workspace">+ Add workspace</a>';
        if (data.workspaces && data.workspaces.length > 0) {
            html += data.workspaces.map(ws =>
                `<a href="#workspace" class="sidebar-submenu-item" data-workspace-id="${ws._id}">${ws.workspace_name}</a>`
            ).join('');
        }
        workspacesList.innerHTML = html;
    }).catch((err) => {
        console.error('Error loading workspaces:', err);
        workspacesList.innerHTML = '<a href="#workspace" class="sidebar-submenu-item add-new" id="sidebar-add-workspace">+ Add workspace</a>';
    });
}

// Workspace modal handlers
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
        if (typeof setHeaderSection === 'function') setHeaderSection('Workspaces');
        const modal = document.getElementById('create-workspace-modal');
        if (modal) modal.classList.add('active');
    }

    // Close modal
    if (e.target.id === 'close-workspace-modal' || e.target.id === 'cancel-workspace-btn') {
        const modal = document.getElementById('create-workspace-modal');
        if (modal) modal.classList.remove('active');
    }
});

// Close modal on overlay click
document.addEventListener('click', (e) => {
    if (e.target.id === 'create-workspace-modal') {
        e.target.classList.remove('active');
    }
});

// Create workspace form
const createWorkspaceForm = document.getElementById('create-workspace-form');
if (createWorkspaceForm) {
    createWorkspaceForm.addEventListener('submit', async (e) => {
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
            const res = await fetch('/workspace/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({
                    workspace_name: workspaceName,
                    bot_token: botToken
                })
            });

            const data = await res.json();

            if (res.ok && data.workspace_id) {
                status.textContent = '✓ Workspace created!';
                status.className = 'modal-status success';

                setTimeout(async () => {
                    const modal = document.getElementById('create-workspace-modal');
                    if (modal) modal.classList.remove('active');

                    createWorkspaceForm.reset();
                    status.textContent = '';

                    await openWorkspaceTab(data.workspace_id);
                    loadWorkspacesSidebar();
                    loadWorkspaceEmptyList();
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
    });
}

// Delete workspace handler
document.addEventListener('click', async (e) => {
    if (e.target.id === 'delete-workspace-btn' || e.target.closest('#delete-workspace-btn')) {
        const btn = e.target.id === 'delete-workspace-btn' ? e.target : e.target.closest('#delete-workspace-btn');
        const workspaceId = btn.dataset.workspaceId;
        const status = document.getElementById('workspace-action-status');

        if (!workspaceId) return;

        if (!confirm('Delete this workspace? This action cannot be undone.')) return;

        btn.textContent = 'Deleting...';
        btn.disabled = true;

        try {
            const res = await fetch(`/workspace/${encodeURIComponent(workspaceId)}`, {
                method: 'DELETE',
                credentials: 'same-origin'
            });

            const data = await res.json();

            if (res.ok && data.success) {
                status.textContent = '✓ Deleted';
                status.style.color = '#4ade80';

                closeWorkspaceTab(workspaceId);
                loadWorkspacesSidebar();
                loadWorkspaceEmptyList();
            } else {
                status.textContent = '✗ ' + (data.detail || 'Failed');
                status.style.color = '#f87171';
            }
        } catch (err) {
            status.textContent = '✗ Error';
            status.style.color = '#f87171';
        }

        btn.textContent = 'Delete Workspace';
        btn.disabled = false;
    }
});

// === TOKEN SELECTOR ===
document.addEventListener('click', async (e) => {
    // Open token dropdown
    if (e.target.id === 'select-existing-token') {
        e.preventDefault();
        e.stopPropagation();

        const dropdown = document.getElementById('token-dropdown');
        const list = document.getElementById('saved-tokens-list');

        if (!dropdown || !list) return;

        if (dropdown.style.display === 'none' || dropdown.style.display === '') {
            dropdown.style.display = 'block';
            list.innerHTML = '<p style="padding: 16px; text-align: center; color: #6b6b6b;">Loading...</p>';

            try {
                const res = await fetch('/account/tokens', { credentials: 'same-origin' });

                if (!res.ok) {
                    list.innerHTML = `
                        <div class="token-dropdown-empty">
                            <p>No saved tokens</p>
                            <p style="margin-top: 8px; font-size: 12px;">Add tokens in Settings → Slack Tokens</p>
                        </div>
                    `;
                    return;
                }

                const data = await res.json();

                if (data.tokens && data.tokens.length > 0) {
                    list.innerHTML = data.tokens.map(token => `
                        <div class="token-item" data-token="${token.token}">
                            <span class="token-item-name">${token.name || 'Unnamed Token'}</span>
                            <span class="token-item-preview">${token.token.substring(0, 15)}...</span>
                        </div>
                    `).join('');
                } else {
                    list.innerHTML = `
                        <div class="token-dropdown-empty">
                            <p>No saved tokens</p>
                            <p style="margin-top: 8px; font-size: 12px;">Add tokens in Settings → Slack Tokens</p>
                        </div>
                    `;
                }
            } catch (err) {
                list.innerHTML = `
                    <div class="token-dropdown-empty">
                        <p>No saved tokens</p>
                        <p style="margin-top: 8px; font-size: 12px;">Add tokens in Settings → Slack Tokens</p>
                    </div>
                `;
            }
        } else {
            dropdown.style.display = 'none';
        }
        return;
    }

    // Close token dropdown
    if (e.target.id === 'close-token-dropdown') {
        e.preventDefault();
        e.stopPropagation();
        const dropdown = document.getElementById('token-dropdown');
        if (dropdown) dropdown.style.display = 'none';
        return;
    }

    // Select token from dropdown
    const tokenItem = e.target.closest('.token-item');
    if (tokenItem && e.target.closest('#token-dropdown')) {
        e.preventDefault();
        e.stopPropagation();
        const token = tokenItem.dataset.token;
        const input = document.getElementById('new-workspace-token');
        const dropdown = document.getElementById('token-dropdown');
        if (input) input.value = token;
        if (dropdown) dropdown.style.display = 'none';
        return;
    }
});

// Close dropdown when clicking outside
document.addEventListener('mousedown', (e) => {
    const dropdown = document.getElementById('token-dropdown');
    const selectBtn = document.getElementById('select-existing-token');

    if (dropdown && dropdown.style.display !== 'none' && dropdown.style.display !== '') {
        if (!dropdown.contains(e.target) && e.target !== selectBtn) {
            dropdown.style.display = 'none';
        }
    }
});