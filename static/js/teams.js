// === TEAMS ===

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
        if (data.teams && data.teams.length > 0) {
            teamsList.innerHTML = data.teams.map(t =>
                `<a href="#teams" class="sidebar-submenu-item" data-team-id="${t._id}">${t.team_name}</a>`
            ).join('');
        } else {
            teamsList.innerHTML = '<a href="#teams" class="sidebar-submenu-item">No teams yet</a>';
        }
    }).catch(() => {
        teamsList.innerHTML = '<a href="#teams" class="sidebar-submenu-item">No teams yet</a>';
    });
}

// Remove member button
document.addEventListener('click', async (e) => {
    const removeBtn = e.target.closest('.member-remove');
    if (!removeBtn) return;

    const email = removeBtn.dataset.email;
    const teamId = removeBtn.dataset.teamId;

    if (!email || !teamId) return;

    if (!confirm(`Remove ${email} from the team?`)) return;

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

        if (!confirm('Delete this team?')) return;

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

// Add member modal handling
document.addEventListener('click', (e) => {
    if (e.target.id === 'add-member-btn') {
        const modal = document.getElementById('add-member-modal');
        if (modal) {
            modal.classList.add('active');
            // Store team ID in the form
            const form = document.getElementById('add-member-form');
            if (form) form.dataset.teamId = e.target.dataset.teamId;
        }
    }

    if (e.target.id === 'close-member-modal' || e.target.id === 'cancel-member-btn') {
        const modal = document.getElementById('add-member-modal');
        if (modal) modal.classList.remove('active');
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