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
            const hireBtn = document.getElementById('hire-btn');
            if (deleteBtn) deleteBtn.dataset.teamId = t._id;
            if (addBtn) addBtn.dataset.teamId = t._id;
            if (hireBtn) hireBtn.dataset.teamId = t._id;
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

// === HIRE FUNCTIONALITY ===

// Cache for channels and users
let hireChannelsCache = {};
let hireUsersCache = {};
let currentSendToType = 'channel';
let currentHireTeamId = null;

// Open hire modal
document.addEventListener('click', (e) => {
    const hireBtn = e.target.closest('#hire-btn');
    if (hireBtn) {
        const modal = document.getElementById('hire-modal');
        const form = document.getElementById('hire-form');

        // Get team ID from multiple sources
        currentHireTeamId = hireBtn.dataset.teamId ||
                           document.getElementById('delete-team-btn')?.dataset.teamId ||
                           document.getElementById('team-id')?.textContent;

        console.log('Opening hire modal for team:', currentHireTeamId);

        if (modal && form) {
            modal.classList.add('active');

            // Reset form
            form.reset();
            form.style.display = 'block';
            document.getElementById('hire-success').style.display = 'none';
            document.getElementById('hire-status').textContent = '';
            document.getElementById('hire-status').className = 'modal-status';

            // Load workspaces
            loadHireWorkspaces();

            // Reset send-to tabs
            currentSendToType = 'channel';
            document.querySelectorAll('.send-to-tab').forEach(t => t.classList.remove('active'));
            document.querySelector('.send-to-tab[data-type="channel"]')?.classList.add('active');
            document.getElementById('hire-channel-group').style.display = 'block';
            document.getElementById('hire-user-group').style.display = 'none';
        }
    }
});

// Close hire modal
document.addEventListener('click', (e) => {
    if (e.target.id === 'close-hire-modal' || e.target.id === 'cancel-hire-btn' || e.target.id === 'close-hire-success' || e.target.id === 'hire-modal') {
        const modal = document.getElementById('hire-modal');
        if (modal) modal.classList.remove('active');
    }
});

// Load workspaces for hire modal
async function loadHireWorkspaces() {
    const select = document.getElementById('hire-workspace');
    if (!select) return;

    try {
        const res = await fetch('/workspace/list', { credentials: 'same-origin' });
        const data = await res.json();

        select.innerHTML = '<option value="">Select a workspace...</option>';

        if (data.success && data.workspaces) {
            data.workspaces.forEach(ws => {
                const option = document.createElement('option');
                option.value = ws._id;
                option.textContent = ws.workspace_name;
                select.appendChild(option);
            });
        }
    } catch (err) {
        console.error('Error loading workspaces:', err);
    }
}

// Load channels for hire modal
async function loadHireChannels(workspaceId) {
    const select = document.getElementById('hire-channel');
    if (!select) return;

    select.innerHTML = '<option value="">Loading channels...</option>';

    if (hireChannelsCache[workspaceId]) {
        renderHireChannels(hireChannelsCache[workspaceId]);
        return;
    }

    try {
        const res = await fetch(`/workspace/${workspaceId}/channels`, { credentials: 'same-origin' });
        const data = await res.json();

        if (data.success && data.channels) {
            hireChannelsCache[workspaceId] = data.channels;
            renderHireChannels(data.channels);
        }
    } catch (err) {
        console.error('Error loading channels:', err);
        select.innerHTML = '<option value="">Error loading channels</option>';
    }
}

function renderHireChannels(channels) {
    const select = document.getElementById('hire-channel');
    select.innerHTML = '<option value="">Select a channel...</option>';

    channels.forEach(ch => {
        const option = document.createElement('option');
        option.value = ch.id;
        option.textContent = `#${ch.name}${ch.is_private ? ' (private)' : ''}`;
        select.appendChild(option);
    });
}

// Load users for hire modal
async function loadHireUsers(workspaceId) {
    const select = document.getElementById('hire-user');
    if (!select) return;

    select.innerHTML = '<option value="">Loading users...</option>';

    if (hireUsersCache[workspaceId]) {
        renderHireUsers(hireUsersCache[workspaceId]);
        return;
    }

    try {
        const res = await fetch(`/workspace/${workspaceId}/users`, { credentials: 'same-origin' });
        const data = await res.json();

        if (data.success && data.users) {
            hireUsersCache[workspaceId] = data.users;
            renderHireUsers(data.users);
        }
    } catch (err) {
        console.error('Error loading users:', err);
        select.innerHTML = '<option value="">Error loading users</option>';
    }
}

function renderHireUsers(users) {
    const select = document.getElementById('hire-user');
    select.innerHTML = '<option value="">Select a user...</option>';

    users.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = user.real_name || user.name;
        select.appendChild(option);
    });
}

// Workspace change handler
document.addEventListener('change', (e) => {
    if (e.target.id === 'hire-workspace') {
        const workspaceId = e.target.value;

        if (workspaceId) {
            loadHireChannels(workspaceId);
            loadHireUsers(workspaceId);
        } else {
            document.getElementById('hire-channel').innerHTML = '<option value="">Select a workspace first...</option>';
            document.getElementById('hire-user').innerHTML = '<option value="">Select a workspace first...</option>';
        }
    }
});

// Send-to tab switching
document.addEventListener('click', (e) => {
    const tab = e.target.closest('.send-to-tab');
    if (!tab) return;

    currentSendToType = tab.dataset.type;

    document.querySelectorAll('.send-to-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    if (currentSendToType === 'channel') {
        document.getElementById('hire-channel-group').style.display = 'block';
        document.getElementById('hire-user-group').style.display = 'none';
    } else {
        document.getElementById('hire-channel-group').style.display = 'none';
        document.getElementById('hire-user-group').style.display = 'block';
    }
});

// Hire form submission
const hireForm = document.getElementById('hire-form');
if (hireForm) {
    hireForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const position = document.getElementById('hire-position').value;
        const companyName = document.getElementById('hire-company').value;
        const workspaceId = document.getElementById('hire-workspace').value;
        const status = document.getElementById('hire-status');
        const btn = document.getElementById('submit-hire-btn');

        console.log('Submitting hire form with teamId:', currentHireTeamId);

        // Validate required fields
        if (!currentHireTeamId) {
            status.textContent = 'Error: No team selected. Please close and try again.';
            status.className = 'modal-status status-error';
            return;
        }

        if (!workspaceId) {
            status.textContent = 'Please select a workspace';
            status.className = 'modal-status status-error';
            return;
        }

        let sendToId, sendToName;
        if (currentSendToType === 'channel') {
            const channelSelect = document.getElementById('hire-channel');
            sendToId = channelSelect.value;
            sendToName = channelSelect.options[channelSelect.selectedIndex]?.text || '';
        } else {
            const userSelect = document.getElementById('hire-user');
            sendToId = userSelect.value;
            sendToName = userSelect.options[userSelect.selectedIndex]?.text || '';
        }

        if (!sendToId) {
            status.textContent = `Please select a ${currentSendToType}`;
            status.className = 'modal-status status-error';
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Creating...';
        status.textContent = '';

        try {
            const res = await fetch('/applications/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({
                    team_id: currentHireTeamId,
                    position_title: position,
                    company_name: companyName,
                    workspace_id: workspaceId,
                    send_to_type: currentSendToType,
                    send_to_id: sendToId,
                    base_url: window.location.origin
                })
            });

            const data = await res.json();
            console.log('Hire response:', data);

            if (res.ok && data.success) {
                // Show success state
                document.getElementById('hire-form').style.display = 'none';
                document.getElementById('hire-success').style.display = 'block';
                document.getElementById('hire-url').value = data.url;
                document.getElementById('hire-destination').textContent = sendToName;
            } else {
                status.textContent = '✗ ' + (data.detail || data.message || 'Failed to create');
                status.className = 'modal-status status-error';
            }
        } catch (err) {
            console.error('Hire form error:', err);
            status.textContent = '✗ Connection error: ' + err.message;
            status.className = 'modal-status status-error';
        }

        btn.disabled = false;
        btn.textContent = 'Generate Application Link';
    });
}

// Copy URL button
document.addEventListener('click', (e) => {
    if (e.target.closest('#copy-hire-url')) {
        const urlInput = document.getElementById('hire-url');
        const btn = e.target.closest('#copy-hire-url');

        navigator.clipboard.writeText(urlInput.value).then(() => {
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

// === APPLICATION LINKS FUNCTIONALITY ===

let currentAppLinksTeamId = null;

// Open app links modal
document.addEventListener('click', (e) => {
    const appLinksBtn = e.target.closest('#app-links-btn');
    if (appLinksBtn) {
        const modal = document.getElementById('app-links-modal');

        // Get team ID from multiple sources
        currentAppLinksTeamId = document.getElementById('delete-team-btn')?.dataset.teamId ||
                               document.getElementById('team-id')?.textContent;

        console.log('Opening app links modal for team:', currentAppLinksTeamId);

        if (modal && currentAppLinksTeamId) {
            modal.classList.add('active');
            loadApplicationLinks(currentAppLinksTeamId);
        }
    }
});

// Close app links modal
document.addEventListener('click', (e) => {
    const closeBtn = e.target.closest('#close-app-links-modal');
    const overlay = e.target.closest('#app-links-modal');

    if (closeBtn || (overlay && e.target === overlay)) {
        document.getElementById('app-links-modal')?.classList.remove('active');
    }
});

// Load application links for team
async function loadApplicationLinks(teamId) {
    const listEl = document.getElementById('app-links-list');
    listEl.innerHTML = '<p class="text-muted" style="padding: 20px; text-align: center;">Loading...</p>';

    try {
        const res = await fetch(`/applications/team/${teamId}`, {
            credentials: 'same-origin'
        });
        const data = await res.json();

        if (res.ok && data.success) {
            if (data.forms.length === 0) {
                listEl.innerHTML = `
                    <div class="app-links-empty">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                        </svg>
                        <p>No application links yet</p>
                        <p style="font-size: 12px;">Click "Hire" to create your first application form</p>
                    </div>
                `;
            } else {
                listEl.innerHTML = data.forms.map(form => `
                    <div class="app-link-item" data-form-id="${form._id}">
                        <div class="app-link-info">
                            <div class="app-link-position">${form.position_title}</div>
                            <div class="app-link-meta">
                                <span class="app-link-status ${form.is_active ? 'active' : 'inactive'}">
                                    ${form.is_active ? 'Active' : 'Inactive'}
                                </span>
                                <span>${form.company_name || ''}</span>
                                <span>${form.application_count || 0} applications</span>
                            </div>
                        </div>
                        <div class="app-link-url">
                            <input type="text" class="form-input" value="${form.url}" readonly>
                        </div>
                        <div class="app-link-actions">
                            <button class="btn btn-icon copy-app-link-btn" title="Copy URL">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                            </button>
                            <button class="btn btn-icon btn-danger delete-app-link-btn" title="Delete">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                `).join('');
            }
        } else {
            listEl.innerHTML = `<p class="text-muted" style="padding: 20px; text-align: center; color: var(--danger);">Failed to load links</p>`;
        }
    } catch (err) {
        console.error('Error loading app links:', err);
        listEl.innerHTML = `<p class="text-muted" style="padding: 20px; text-align: center; color: var(--danger);">Error: ${err.message}</p>`;
    }
}

// Copy app link URL
document.addEventListener('click', (e) => {
    const copyBtn = e.target.closest('.copy-app-link-btn');
    if (copyBtn) {
        const item = copyBtn.closest('.app-link-item');
        const urlInput = item.querySelector('input');

        navigator.clipboard.writeText(urlInput.value).then(() => {
            copyBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            `;
            setTimeout(() => {
                copyBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                `;
            }, 2000);
        });
    }
});

// Delete app link - show confirmation modal
let pendingDeleteFormId = null;
let pendingDeleteItem = null;

document.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('.delete-app-link-btn');
    if (deleteBtn) {
        const item = deleteBtn.closest('.app-link-item');
        const formId = item.dataset.formId;

        // Store for later
        pendingDeleteFormId = formId;
        pendingDeleteItem = item;

        // Show confirmation modal
        document.getElementById('delete-app-link-modal').classList.add('active');
    }
});

// Close delete confirmation modal
document.addEventListener('click', (e) => {
    const cancelBtn = e.target.closest('#cancel-delete-app-link');
    const modal = document.getElementById('delete-app-link-modal');

    // Close on cancel button click or clicking outside the modal content
    if (cancelBtn || (e.target === modal)) {
        modal?.classList.remove('active');
        pendingDeleteFormId = null;
        pendingDeleteItem = null;
    }
});

// Confirm delete app link
document.addEventListener('click', async (e) => {
    const confirmBtn = e.target.closest('#confirm-delete-app-link');
    if (confirmBtn && pendingDeleteFormId && pendingDeleteItem) {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Deleting...';

        try {
            const res = await fetch(`/applications/${pendingDeleteFormId}`, {
                method: 'DELETE',
                credentials: 'same-origin'
            });

            if (res.ok) {
                pendingDeleteItem.remove();

                // Check if list is empty
                const listEl = document.getElementById('app-links-list');
                if (!listEl.querySelector('.app-link-item')) {
                    listEl.innerHTML = `
                        <div class="app-links-empty">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                            </svg>
                            <p>No application links yet</p>
                            <p style="font-size: 12px;">Click "Hire" to create your first application form</p>
                        </div>
                    `;
                }

                // Close modal
                document.getElementById('delete-app-link-modal').classList.remove('active');
            } else {
                const data = await res.json();
                alertModal.show({
                    type: 'error',
                    title: 'Delete Failed',
                    message: data.detail || 'Unknown error'
                });
            }
        } catch (err) {
            console.error('Error deleting app link:', err);
            alertModal.show({
                type: 'error',
                title: 'Error',
                message: err.message
            });
        }

        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Delete';
        pendingDeleteFormId = null;
        pendingDeleteItem = null;
    }
});