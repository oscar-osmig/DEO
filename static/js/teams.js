// === TEAMS ===

// Cache for Slack users per workspace
let teamSlackUsersCache = {};
let teamWorkspacesCache = [];

// Fetch workspaces for the dropdown
async function fetchTeamWorkspaces() {
    try {
        const res = await fetch('/workspace/list', { credentials: 'same-origin' });
        const data = await res.json();
        if (data.success && data.workspaces) {
            teamWorkspacesCache = data.workspaces;
            updateWorkspaceDropdown();
        }
    } catch (err) {
        console.error('Error fetching workspaces:', err);
    }
}

// Update the workspace dropdown in the modal
function updateWorkspaceDropdown() {
    const select = document.getElementById('slack-workspace-select');
    if (!select) return;

    select.innerHTML = '<option value="">Select a workspace...</option>';
    teamWorkspacesCache.forEach(ws => {
        const option = document.createElement('option');
        option.value = ws._id;
        option.textContent = ws.workspace_name;
        select.appendChild(option);
    });
}

// Fetch Slack users for a workspace
async function fetchTeamSlackUsers(workspaceId) {
    if (teamSlackUsersCache[workspaceId]) {
        return teamSlackUsersCache[workspaceId];
    }

    try {
        const res = await fetch(`/workspace/${workspaceId}/users`, { credentials: 'same-origin' });
        const data = await res.json();
        if (data.success && data.users) {
            teamSlackUsersCache[workspaceId] = data.users;
            return data.users;
        }
    } catch (err) {
        console.error('Error fetching Slack users:', err);
    }
    return [];
}

// Render Slack users list with checkboxes
function renderSlackUsersList(users) {
    const container = document.getElementById('slack-users-list');
    if (!container) return;

    if (!users || users.length === 0) {
        container.innerHTML = '<p class="text-muted">No users found in this workspace</p>';
        return;
    }

    container.innerHTML = users.map(user => `
        <div class="slack-user-checkbox-item">
            <input type="checkbox"
                   class="slack-user-checkbox"
                   id="slack-user-${user.id}"
                   data-user-id="${user.id}"
                   data-user-name="${user.real_name || user.name}"
                   data-user-display="${user.display_name || ''}"
            >
            <label for="slack-user-${user.id}" class="slack-user-label">
                ${user.avatar ? `<img src="${user.avatar}" class="slack-user-avatar" alt="">` : ''}
                <span class="slack-user-info">
                    <span class="slack-user-name">${user.real_name || user.name}</span>
                    ${user.display_name ? `<span class="slack-user-handle">@${user.display_name}</span>` : ''}
                </span>
            </label>
        </div>
    `).join('');

    // Update Add button state when checkboxes change
    container.querySelectorAll('.slack-user-checkbox').forEach(cb => {
        cb.addEventListener('change', updateAddSlackMembersButton);
    });
}

// Update the Add button enabled state based on selections
function updateAddSlackMembersButton() {
    const btn = document.getElementById('add-slack-members-btn');
    const checkboxes = document.querySelectorAll('#slack-users-list .slack-user-checkbox:checked');
    if (btn) {
        btn.disabled = checkboxes.length === 0;
    }
}

// Load team details by ID
async function loadTeamDetails(teamId) {
    try {
        const res = await fetch(`/teams/${encodeURIComponent(teamId)}`, { credentials: 'same-origin' });
        const data = await res.json();

        if (res.ok && data.team) {
            const t = data.team;

            const title = document.getElementById('team-title');
            if (title) title.textContent = t.team_name || 'Team';

            const subtitle = document.getElementById('team-subtitle');
            if (subtitle) subtitle.textContent = 'Team configuration and members';

            const idEl = document.getElementById('team-id');
            if (idEl) idEl.textContent = t._id || '-';

            const nameEl = document.getElementById('team-name');
            if (nameEl) nameEl.textContent = t.team_name || '-';

            const descEl = document.getElementById('team-description');
            if (descEl) descEl.textContent = t.description || '-';

            const ownerEl = document.getElementById('team-owner');
            if (ownerEl) ownerEl.textContent = t.owner_email || '-';

            const countEl = document.getElementById('team-member-count');
            if (countEl) countEl.textContent = (t.members?.length || 0) + ' members';

            const createdEl = document.getElementById('team-created');
            if (createdEl) createdEl.textContent = t.created_at ? new Date(t.created_at).toLocaleDateString() : '-';

            // Members list
            const membersEl = document.getElementById('team-members-list');
            if (membersEl) {
                if (t.members && t.members.length > 0) {
                    membersEl.innerHTML = t.members.map(m => `
                        <div class="member-item" data-member-email="${m.email}">
                            <div class="member-info">
                                <span class="member-name">${m.name}</span>
                                <span class="member-email">${m.email}</span>
                                ${m.slack_id ? `<span class="member-slack">Slack: ${m.slack_id}</span>` : ''}
                            </div>
                            <button class="member-remove" data-email="${m.email}" data-team-id="${t._id}">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                    `).join('');
                } else {
                    membersEl.innerHTML = '<p class="text-muted">No members yet</p>';
                }
            }

            // Store team ID for actions
            const deleteBtn = document.getElementById('delete-team-btn');
            const addBtn = document.getElementById('add-member-btn');
            if (deleteBtn) deleteBtn.dataset.teamId = t._id;
            if (addBtn) addBtn.dataset.teamId = t._id;
        }
    } catch (err) {
        console.error('Error loading team:', err);
    }
}

// Load teams into sidebar
function loadTeamsSidebar() {
    const teamsList = document.getElementById('teams-list');
    if (!teamsList) return;

    fetch('/teams/list', { credentials: 'same-origin' }).then(r => r.json()).then(data => {
        let html = '<a href="#teams" class="sidebar-submenu-item add-new" id="sidebar-add-team">+ Add team</a>';
        if (data.teams && data.teams.length > 0) {
            html += data.teams.map(t =>
                `<a href="#teams" class="sidebar-submenu-item" data-team-id="${t._id}">${t.team_name}</a>`
            ).join('');
        }
        teamsList.innerHTML = html;
    }).catch(() => {
        teamsList.innerHTML = '<a href="#teams" class="sidebar-submenu-item add-new" id="sidebar-add-team">+ Add team</a>';
    });
}

// Copy Team ID button
document.addEventListener('click', (e) => {
    if (e.target.closest('#copy-team-id')) {
        const teamId = document.getElementById('team-id').textContent;
        const btn = e.target.closest('#copy-team-id');

        navigator.clipboard.writeText(teamId).then(() => {
            btn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            `;
            setTimeout(() => {
                btn.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                `;
            }, 2000);
        });
    }
});

// Remove member button
document.addEventListener('click', async (e) => {
    const removeBtn = e.target.closest('.member-remove');
    if (!removeBtn) return;

    const email = removeBtn.dataset.email;
    const teamId = removeBtn.dataset.teamId;

    if (!email || !teamId) return;

    const confirmed = await confirmDelete({
        title: 'Remove Member',
        message: `Are you sure you want to remove ${email} from the team?`,
        warning: 'They will lose access to team resources.',
        confirmText: 'Remove'
    });
    if (!confirmed) return;

    try {
        const res = await fetch(`/teams/${teamId}/members/${encodeURIComponent(email)}`, {
            method: 'DELETE',
            credentials: 'same-origin'
        });

        if (res.ok) {
            // Reload team details
            await loadTeamDetails(teamId);
        }
    } catch (err) {
        console.error('Error removing member:', err);
    }
});

// Delete team button
document.addEventListener('click', async (e) => {
    if (e.target.id === 'delete-team-btn') {
        const teamId = e.target.dataset.teamId;
        const status = document.getElementById('team-action-status');

        if (!teamId) return;

        const confirmed = await confirmDelete({
            title: 'Delete Team',
            message: 'Are you sure you want to delete this team?',
            warning: 'All members will be removed. This action cannot be undone.'
        });
        if (!confirmed) return;

        e.target.textContent = 'Deleting...';
        e.target.disabled = true;

        try {
            const res = await fetch(`/teams/${encodeURIComponent(teamId)}`, {
                method: 'DELETE',
                credentials: 'same-origin'
            });

            const data = await res.json();

            if (res.ok && data.success) {
                status.textContent = '✓ Deleted';
                status.style.color = '#4ade80';

                closeTeamTab(teamId);
                loadTeamsSidebar();
                loadTeamEmptyList();
            } else {
                status.textContent = '✗ ' + (data.detail || 'Failed');
                status.style.color = '#f87171';
            }
        } catch (err) {
            status.textContent = '✗ Error';
            status.style.color = '#f87171';
        }

        e.target.textContent = 'Delete Team';
        e.target.disabled = false;
    }
});

// Create team modal handling
document.addEventListener('click', (e) => {
    if (e.target.id === 'create-team-btn') {
        const modal = document.getElementById('create-team-modal');
        if (modal) modal.classList.add('active');
    }

    if (e.target.id === 'close-team-modal' || e.target.id === 'cancel-team-btn') {
        const modal = document.getElementById('create-team-modal');
        if (modal) modal.classList.remove('active');
    }
});

// Open modal from sidebar
document.addEventListener('click', (e) => {
    if (e.target.closest('#sidebar-add-team')) {
        e.preventDefault();
        window.location.hash = '#teams';
        if (typeof setHeaderSection === 'function') setHeaderSection('Teams');
        const modal = document.getElementById('create-team-modal');
        if (modal) modal.classList.add('active');
    }
});

// Add member modal handling
document.addEventListener('click', (e) => {
    if (e.target.id === 'add-member-btn') {
        const modal = document.getElementById('add-member-modal');
        if (modal) {
            modal.classList.add('active');
            // Store team ID in the form and slack picker
            const form = document.getElementById('add-member-form');
            const slackPicker = document.getElementById('slack-member-picker');
            if (form) form.dataset.teamId = e.target.dataset.teamId;
            if (slackPicker) slackPicker.dataset.teamId = e.target.dataset.teamId;

            // Fetch workspaces for Slack picker
            fetchTeamWorkspaces();

            // Reset to manual tab
            resetMemberModalTabs();
        }
    }

    if (e.target.id === 'close-member-modal' || e.target.id === 'cancel-member-btn' || e.target.id === 'cancel-slack-member-btn') {
        const modal = document.getElementById('add-member-modal');
        if (modal) modal.classList.remove('active');
        resetMemberModalTabs();
    }
});

// Reset modal tabs to default state
function resetMemberModalTabs() {
    const tabs = document.querySelectorAll('.member-tab');
    const contents = document.querySelectorAll('.member-tab-content');

    tabs.forEach(tab => tab.classList.remove('active'));
    contents.forEach(content => content.classList.remove('active'));

    const manualTab = document.querySelector('.member-tab[data-tab="manual"]');
    const manualContent = document.querySelector('.member-tab-content[data-tab="manual"]');
    if (manualTab) manualTab.classList.add('active');
    if (manualContent) manualContent.classList.add('active');

    // Reset Slack picker state
    const workspaceSelect = document.getElementById('slack-workspace-select');
    const usersList = document.getElementById('slack-users-list');
    const addBtn = document.getElementById('add-slack-members-btn');
    if (workspaceSelect) workspaceSelect.value = '';
    if (usersList) usersList.innerHTML = '<p class="text-muted">Select a workspace to load users</p>';
    if (addBtn) addBtn.disabled = true;
}

// Tab switching in add member modal
document.addEventListener('click', (e) => {
    const tab = e.target.closest('.member-tab');
    if (!tab) return;

    const tabName = tab.dataset.tab;
    const tabs = document.querySelectorAll('.member-tab');
    const contents = document.querySelectorAll('.member-tab-content');

    tabs.forEach(t => t.classList.remove('active'));
    contents.forEach(c => c.classList.remove('active'));

    tab.classList.add('active');
    const content = document.querySelector(`.member-tab-content[data-tab="${tabName}"]`);
    if (content) content.classList.add('active');
});

// Workspace selection change handler
document.addEventListener('change', async (e) => {
    if (e.target.id === 'slack-workspace-select') {
        const workspaceId = e.target.value;
        const usersList = document.getElementById('slack-users-list');

        if (!workspaceId) {
            if (usersList) usersList.innerHTML = '<p class="text-muted">Select a workspace to load users</p>';
            updateAddSlackMembersButton();
            return;
        }

        if (usersList) usersList.innerHTML = '<p class="text-muted">Loading users...</p>';

        const users = await fetchTeamSlackUsers(workspaceId);
        renderSlackUsersList(users);
    }
});

// Add selected Slack members button handler
document.addEventListener('click', async (e) => {
    if (e.target.id === 'add-slack-members-btn') {
        const slackPicker = document.getElementById('slack-member-picker');
        const teamId = slackPicker?.dataset.teamId;
        if (!teamId) return;

        const checkboxes = document.querySelectorAll('#slack-users-list .slack-user-checkbox:checked');
        if (checkboxes.length === 0) return;

        const btn = e.target;
        const status = document.getElementById('slack-member-status');

        btn.disabled = true;
        btn.textContent = 'Adding...';
        status.textContent = '';

        let successCount = 0;
        let failCount = 0;

        for (const cb of checkboxes) {
            const userId = cb.dataset.userId;
            const userName = cb.dataset.userName;

            try {
                const res = await fetch(`/teams/${teamId}/members`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify({
                        name: userName,
                        email: `${userId}@slack.user`,
                        slack_id: userId
                    })
                });

                if (res.ok) {
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (err) {
                failCount++;
            }
        }

        if (successCount > 0) {
            status.textContent = `Added ${successCount} member${successCount > 1 ? 's' : ''}${failCount > 0 ? ` (${failCount} failed)` : ''}`;
            status.className = 'modal-status status-success';

            // Reload team details
            await loadTeamDetails(teamId);

            // Close modal after delay
            setTimeout(() => {
                document.getElementById('add-member-modal').classList.remove('active');
                resetMemberModalTabs();
                status.textContent = '';
            }, 1500);
        } else {
            status.textContent = 'Failed to add members';
            status.className = 'modal-status status-error';
        }

        btn.disabled = false;
        btn.textContent = 'Add Selected Members';
        updateAddSlackMembersButton();
    }
});

// Close modals on overlay click
document.addEventListener('click', (e) => {
    if (e.target.id === 'create-team-modal' || e.target.id === 'add-member-modal') {
        e.target.classList.remove('active');
    }
});

// Create team form submission
const createTeamForm = document.getElementById('create-team-form');
if (createTeamForm) {
    createTeamForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('new-team-name').value;
        const description = document.getElementById('new-team-description').value;
        const status = document.getElementById('create-team-status');
        const btn = document.getElementById('submit-team-btn');

        btn.disabled = true;
        btn.textContent = 'Creating...';
        status.textContent = '';

        try {
            const res = await fetch('/teams/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({
                    team_name: name,
                    description: description
                })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                status.textContent = '✓ Team created';
                status.className = 'modal-status status-success';

                // Refresh sidebar and empty list
                loadTeamsSidebar();
                loadTeamEmptyList();

                // Close modal after delay
                setTimeout(() => {
                    document.getElementById('create-team-modal').classList.remove('active');
                    createTeamForm.reset();
                    status.textContent = '';
                }, 1000);
            } else {
                status.textContent = '✗ ' + (data.detail || 'Failed to create');
                status.className = 'modal-status status-error';
            }
        } catch (err) {
            status.textContent = '✗ Connection error';
            status.className = 'modal-status status-error';
        }

        btn.disabled = false;
        btn.textContent = 'Create';
    });
}

// Add member form submission
const addMemberForm = document.getElementById('add-member-form');
if (addMemberForm) {
    addMemberForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const teamId = addMemberForm.dataset.teamId;
        if (!teamId) return;

        const name = document.getElementById('member-name').value;
        const email = document.getElementById('member-email').value;
        const slackId = document.getElementById('member-slack-id').value;
        const status = document.getElementById('add-member-status');
        const btn = document.getElementById('submit-member-btn');

        btn.disabled = true;
        btn.textContent = 'Adding...';
        status.textContent = '';

        try {
            const res = await fetch(`/teams/${teamId}/members`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({
                    name: name,
                    email: email,
                    slack_id: slackId || null
                })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                status.textContent = '✓ Member added';
                status.className = 'modal-status status-success';

                // Reload team details
                await loadTeamDetails(teamId);

                // Close modal after delay
                setTimeout(() => {
                    document.getElementById('add-member-modal').classList.remove('active');
                    addMemberForm.reset();
                    status.textContent = '';
                }, 1000);
            } else {
                status.textContent = '✗ ' + (data.detail || 'Failed to add');
                status.className = 'modal-status status-error';
            }
        } catch (err) {
            status.textContent = '✗ Connection error';
            status.className = 'modal-status status-error';
        }

        btn.disabled = false;
        btn.textContent = 'Add Member';
    });
}