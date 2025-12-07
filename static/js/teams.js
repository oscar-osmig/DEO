// === TEAM FUNCTIONS ===

// Track open team tabs
let openTeamTabs = [];
let activeTeamTab = null;
let currentTeamId = null;

// Show/hide team empty state
function updateTeamView() {
    const emptyState = document.getElementById('team-empty-state');
    const details = document.getElementById('team-details');

    if (openTeamTabs.length === 0) {
        if (emptyState) emptyState.style.display = 'flex';
        if (details) details.style.display = 'none';
    } else {
        if (emptyState) emptyState.style.display = 'none';
        if (details) details.style.display = 'block';
    }
}

// Render team tabs
function renderTeamTabs() {
    const tabsBar = document.getElementById('team-tabs');
    if (!tabsBar) return;

    tabsBar.innerHTML = openTeamTabs.map(tab => {
        const isActive = tab.id === activeTeamTab;
        return `
            <div class="tab ${isActive ? 'active' : ''}" data-tab-id="${tab.id}" data-tab-type="team">
                <span class="tab-name">${tab.name}</span>
                <span class="tab-close" data-close-tab="${tab.id}" data-close-type="team">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </span>
            </div>
        `;
    }).join('');

    updateTeamView();
}

// Open team in tab
async function openTeamTab(teamId) {
    const existingTab = openTeamTabs.find(tab => tab.id === teamId);

    if (existingTab) {
        activeTeamTab = teamId;
        renderTeamTabs();
        await loadTeamDetails(teamId);
        return;
    }

    try {
        const res = await fetch(`/teams/${encodeURIComponent(teamId)}`);
        const data = await res.json();

        if (res.ok && data.success) {
            const team = data.team;

            openTeamTabs.push({
                id: teamId,
                name: team.team_name || 'Team'
            });

            activeTeamTab = teamId;
            renderTeamTabs();
            await loadTeamDetails(teamId);
        }
    } catch (err) {
        console.error('Error opening team tab:', err);
    }
}

// Close team tab
function closeTeamTab(teamId) {
    const index = openTeamTabs.findIndex(tab => tab.id === teamId);
    if (index === -1) return;

    openTeamTabs.splice(index, 1);

    if (activeTeamTab === teamId) {
        if (openTeamTabs.length > 0) {
            const newIndex = Math.max(0, index - 1);
            activeTeamTab = openTeamTabs[newIndex].id;
            loadTeamDetails(activeTeamTab);
        } else {
            activeTeamTab = null;
        }
    }

    renderTeamTabs();
}

// Load team details by ID
async function loadTeamDetails(teamId) {
    try {
        const res = await fetch(`/teams/${encodeURIComponent(teamId)}`);
        const data = await res.json();

        if (res.ok && data.success) {
            const team = data.team;
            currentTeamId = team._id;

            const title = document.getElementById('team-title');
            if (title) title.textContent = team.team_name || 'Team';

            const subtitle = document.getElementById('team-subtitle');
            if (subtitle) subtitle.textContent = team.description || 'Team details and members';

            const tId = document.getElementById('team-id');
            if (tId) tId.textContent = team._id || '-';

            const name = document.getElementById('team-name');
            if (name) name.textContent = team.team_name || '-';

            const description = document.getElementById('team-description');
            if (description) description.textContent = team.description || 'No description';

            const owner = document.getElementById('team-owner');
            if (owner) owner.textContent = team.owner_name || team.owner_email || '-';

            const memberCount = document.getElementById('team-member-count');
            const members = team.members || [];
            if (memberCount) memberCount.textContent = members.length + ' member(s)';

            const created = document.getElementById('team-created');
            if (created) created.textContent = team.created_at ? new Date(team.created_at).toLocaleDateString() : '-';

            // Members list
            const membersList = document.getElementById('team-members-list');
            if (membersList) {
                if (members.length > 0) {
                    membersList.innerHTML = members.map(m => `
                        <div class="member-item">
                            <div class="member-info">
                                <span class="member-name">${m.name || 'Unknown'}</span>
                                <span class="member-email">${m.email || ''}</span>
                                ${m.slack_user_id ? `<span class="member-slack">Slack: ${m.slack_user_id}</span>` : ''}
                            </div>
                            <button class="member-remove" data-member-email="${m.email}" title="Remove member">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                    `).join('');
                } else {
                    membersList.innerHTML = '<p class="text-muted">No members yet</p>';
                }
            }

            // Store team ID for actions
            const deleteBtn = document.getElementById('delete-team-btn');
            if (deleteBtn) deleteBtn.dataset.teamId = team._id;

        } else {
            const subtitle = document.getElementById('team-subtitle');
            if (subtitle) subtitle.textContent = 'Team not found';
        }
    } catch (err) {
        const subtitle = document.getElementById('team-subtitle');
        if (subtitle) subtitle.textContent = 'Error loading team';
    }
}

// Load teams into sidebar
function loadTeamsSidebar() {
    const teamsList = document.getElementById('teams-list');
    if (!teamsList) return;

    fetch('/teams/list').then(r => r.json()).then(data => {
        let html = '<a href="#teams" class="sidebar-submenu-item add-new" id="sidebar-add-team">+ Add team</a>';
        if (data.teams && data.teams.length > 0) {
            html += data.teams.map(team =>
                `<a href="#teams" class="sidebar-submenu-item" data-team-id="${team._id}">${team.team_name}</a>`
            ).join('');
        }
        teamsList.innerHTML = html;
    }).catch((err) => {
        console.error('Error loading teams:', err);
        teamsList.innerHTML = '<a href="#teams" class="sidebar-submenu-item add-new" id="sidebar-add-team">+ Add team</a>';
    });
}

// Team tab click handlers
document.addEventListener('click', async (e) => {
    // Handle team sidebar link
    const teamLink = e.target.closest('[data-team-id]');
    if (teamLink && !e.target.closest('.tab')) {
        e.preventDefault();
        const teamId = teamLink.dataset.teamId;
        window.location.hash = '#teams';
        setHeaderSection('Teams');
        await openTeamTab(teamId);
        return;
    }

    // Handle team tab click (switch tabs)
    const teamTab = e.target.closest('.tab[data-tab-type="team"]');
    if (teamTab && !e.target.closest('.tab-close')) {
        const tabId = teamTab.dataset.tabId;
        activeTeamTab = tabId;
        renderTeamTabs();
        await loadTeamDetails(tabId);
        return;
    }

    // Handle team tab close
    const closeTeamBtn = e.target.closest('.tab-close[data-close-type="team"]');
    if (closeTeamBtn) {
        e.stopPropagation();
        const tabId = closeTeamBtn.dataset.closeTab;
        closeTeamTab(tabId);
        return;
    }
});

// Team modal handlers
document.addEventListener('click', (e) => {
    // Open create team modal from header button
    if (e.target.closest('#create-team-btn')) {
        const modal = document.getElementById('create-team-modal');
        if (modal) modal.classList.add('active');
    }

    // Open create team modal from sidebar
    if (e.target.closest('#sidebar-add-team')) {
        e.preventDefault();
        window.location.hash = '#teams';
        setHeaderSection('Teams');
        const modal = document.getElementById('create-team-modal');
        if (modal) modal.classList.add('active');
    }

    // Close create team modal
    if (e.target.closest('#close-team-modal') || e.target.closest('#cancel-team-btn')) {
        const modal = document.getElementById('create-team-modal');
        if (modal) {
            modal.classList.remove('active');
            const form = document.getElementById('create-team-form');
            if (form) form.reset();
            const status = document.getElementById('create-team-status');
            if (status) status.textContent = '';
        }
    }

    // Open add member modal
    if (e.target.closest('#add-member-btn')) {
        const modal = document.getElementById('add-member-modal');
        if (modal) modal.classList.add('active');
    }

    // Close add member modal
    if (e.target.closest('#close-member-modal') || e.target.closest('#cancel-member-btn')) {
        const modal = document.getElementById('add-member-modal');
        if (modal) {
            modal.classList.remove('active');
            const form = document.getElementById('add-member-form');
            if (form) form.reset();
            const status = document.getElementById('add-member-status');
            if (status) status.textContent = '';
        }
    }
});

// Create Team Form Submission
document.addEventListener('submit', async (e) => {
    if (e.target.id === 'create-team-form') {
        e.preventDefault();

        const teamName = document.getElementById('new-team-name').value;
        const teamDescription = document.getElementById('new-team-description').value;
        const status = document.getElementById('create-team-status');
        const submitBtn = document.getElementById('submit-team-btn');

        if (!teamName) {
            status.textContent = 'Team name is required';
            status.className = 'modal-status error';
            return;
        }

        submitBtn.textContent = 'Creating...';
        submitBtn.disabled = true;

        try {
            const res = await fetch('/teams/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    team_name: teamName,
                    description: teamDescription || null,
                    members: []
                })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                status.textContent = '✓ Team created!';
                status.className = 'modal-status success';

                setTimeout(async () => {
                    const modal = document.getElementById('create-team-modal');
                    if (modal) modal.classList.remove('active');

                    e.target.reset();
                    status.textContent = '';

                    await openTeamTab(data.team_id);
                    loadTeamsSidebar();
                }, 1000);
            } else {
                status.textContent = '✗ ' + (data.detail || 'Failed to create team');
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

// Add Member Form Submission
document.addEventListener('submit', async (e) => {
    if (e.target.id === 'add-member-form') {
        e.preventDefault();

        const memberName = document.getElementById('member-name').value;
        const memberEmail = document.getElementById('member-email').value;
        const memberSlackId = document.getElementById('member-slack-id').value;
        const status = document.getElementById('add-member-status');
        const submitBtn = document.getElementById('submit-member-btn');

        if (!memberName || !memberEmail) {
            status.textContent = 'Name and email are required';
            status.className = 'modal-status error';
            return;
        }

        if (!currentTeamId) {
            status.textContent = 'No team selected';
            status.className = 'modal-status error';
            return;
        }

        submitBtn.textContent = 'Adding...';
        submitBtn.disabled = true;

        try {
            const res = await fetch(`/teams/${currentTeamId}/members/add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    members: [{
                        name: memberName,
                        email: memberEmail,
                        slack_user_id: memberSlackId || null
                    }]
                })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                status.textContent = '✓ Member added!';
                status.className = 'modal-status success';

                setTimeout(async () => {
                    const modal = document.getElementById('add-member-modal');
                    if (modal) modal.classList.remove('active');

                    e.target.reset();
                    status.textContent = '';

                    await loadTeamDetails(currentTeamId);
                }, 1000);
            } else {
                status.textContent = '✗ ' + (data.detail || 'Failed to add member');
                status.className = 'modal-status error';
            }
        } catch (err) {
            status.textContent = '✗ Connection error';
            status.className = 'modal-status error';
        }

        submitBtn.textContent = 'Add Member';
        submitBtn.disabled = false;
    }
});

// Team action buttons
document.addEventListener('click', async (e) => {
    // Remove member
    if (e.target.closest('.member-remove')) {
        const btn = e.target.closest('.member-remove');
        const memberEmail = btn.dataset.memberEmail;

        if (!currentTeamId || !memberEmail) return;

        if (!confirm(`Remove this member from the team?`)) return;

        try {
            const res = await fetch(`/teams/${currentTeamId}/members/remove`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: memberEmail })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                await loadTeamDetails(currentTeamId);
            }
        } catch (err) {
            console.error('Error removing member:', err);
        }
    }

    // Delete team
    if (e.target.id === 'delete-team-btn') {
        const teamId = e.target.dataset.teamId;
        const status = document.getElementById('team-action-status');

        if (!teamId) return;

        if (!confirm('Delete this team? This action cannot be undone.')) return;

        e.target.textContent = 'Deleting...';
        e.target.disabled = true;

        try {
            const res = await fetch(`/teams/${encodeURIComponent(teamId)}`, {
                method: 'DELETE'
            });

            const data = await res.json();

            if (res.ok && data.success) {
                status.textContent = '✓ Deleted';
                status.style.color = '#4ade80';

                closeTeamTab(teamId);
                loadTeamsSidebar();
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