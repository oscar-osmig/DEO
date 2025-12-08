// === DASHBOARDS ===

// Load dashboard details by ID
async function loadDashboardDetails(dashboardId) {
    try {
        const res = await fetch(`/dashboards/${encodeURIComponent(dashboardId)}`, { credentials: 'same-origin' });
        const data = await res.json();

        if (res.ok && data.dashboard) {
            const d = data.dashboard;

            const title = document.getElementById('dashboard-title');
            if (title) title.textContent = d.dashboard_name || 'Dashboard';

            const subtitle = document.getElementById('dashboard-subtitle');
            if (subtitle) subtitle.textContent = 'Dashboard configuration and member access';

            const idEl = document.getElementById('dashboard-id');
            if (idEl) idEl.textContent = d._id || '-';

            const teamEl = document.getElementById('dashboard-team');
            if (teamEl) teamEl.textContent = d.team_id || '-';

            const ownerEl = document.getElementById('dashboard-owner');
            if (ownerEl) ownerEl.textContent = d.owner_email || '-';

            const periodEl = document.getElementById('dashboard-period');
            if (periodEl) periodEl.textContent = d.reporting_period || 'weekly';

            const membersEl = document.getElementById('dashboard-members');
            if (membersEl) membersEl.textContent = (d.members?.length || 0) + ' members';

            const statusEl = document.getElementById('dashboard-status');
            if (statusEl) statusEl.textContent = d.status || 'Active';

            const createdEl = document.getElementById('dashboard-created');
            if (createdEl) createdEl.textContent = d.created_at ? new Date(d.created_at).toLocaleDateString() : '-';

            // Metrics
            const metricsEl = document.getElementById('dashboard-metrics');
            if (metricsEl) {
                if (d.metrics && d.metrics.length > 0) {
                    metricsEl.innerHTML = d.metrics.map(m => `<span class="metric-tag">${m}</span>`).join('');
                } else {
                    metricsEl.innerHTML = '<p class="text-muted">No metrics configured</p>';
                }
            }

            // Dashboard URL
            const urlEl = document.getElementById('dashboard-url');
            if (urlEl) urlEl.textContent = `${window.location.origin}/d/${d._id}`;

            // Member access list
            const accessEl = document.getElementById('dashboard-members-access');
            if (accessEl) {
                if (d.members && d.members.length > 0) {
                    accessEl.innerHTML = d.members.map(m => `
                        <div class="member-access-item">
                            <div class="member-info">
                                <span class="member-name">${m.name}</span>
                                <span class="member-email">${m.email}</span>
                            </div>
                            <div class="member-passcode">
                                <span class="passcode-label">Passcode:</span>
                                <span class="passcode-value">${m.passcode || 'N/A'}</span>
                                <button class="copy-passcode-btn" data-passcode="${m.passcode || ''}" title="Copy passcode">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    `).join('');
                } else {
                    accessEl.innerHTML = '<p class="text-muted">No members with access</p>';
                }
            }

            // Store dashboard ID for actions
            const viewBtn = document.getElementById('view-dashboard-btn');
            const deleteBtn = document.getElementById('delete-dashboard-btn');
            const syncBtn = document.getElementById('sync-members-btn');
            if (viewBtn) viewBtn.dataset.dashboardId = d._id;
            if (deleteBtn) deleteBtn.dataset.dashboardId = d._id;
            if (syncBtn) syncBtn.dataset.dashboardId = d._id;
        }
    } catch (err) {
        console.error('Error loading dashboard:', err);
    }
}

// Load dashboards into sidebar
function loadDashboardsSidebar() {
    const dashboardsList = document.getElementById('dashboards-list');
    if (!dashboardsList) return;

    fetch('/dashboards/list', { credentials: 'same-origin' }).then(r => r.json()).then(data => {
        if (data.dashboards && data.dashboards.length > 0) {
            dashboardsList.innerHTML = data.dashboards.map(d =>
                `<a href="#dashboards" class="sidebar-submenu-item" data-dashboard-id="${d._id}">${d.dashboard_name}</a>`
            ).join('');
        } else {
            dashboardsList.innerHTML = '<a href="#dashboards" class="sidebar-submenu-item">No dashboards yet</a>';
        }
    }).catch(() => {
        dashboardsList.innerHTML = '<a href="#dashboards" class="sidebar-submenu-item">No dashboards yet</a>';
    });
}

// Copy passcode button
document.addEventListener('click', (e) => {
    const copyBtn = e.target.closest('.copy-passcode-btn');
    if (copyBtn) {
        const passcode = copyBtn.dataset.passcode;
        navigator.clipboard.writeText(passcode).then(() => {
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

// Copy dashboard URL button
document.addEventListener('click', (e) => {
    if (e.target.id === 'copy-dashboard-url') {
        const url = document.getElementById('dashboard-url').textContent;
        navigator.clipboard.writeText(url).then(() => {
            e.target.textContent = 'Copied!';
            setTimeout(() => {
                e.target.textContent = 'Copy URL';
            }, 2000);
        });
    }
});

// View dashboard button
document.addEventListener('click', (e) => {
    if (e.target.id === 'view-dashboard-btn') {
        const url = document.getElementById('dashboard-url').textContent;
        window.open(url, '_blank');
    }
});

// Sync members button
document.addEventListener('click', async (e) => {
    if (e.target.id === 'sync-members-btn') {
        const dashboardId = e.target.dataset.dashboardId;
        const status = document.getElementById('dashboard-action-status');

        if (!dashboardId) return;

        e.target.textContent = 'Syncing...';
        e.target.disabled = true;

        try {
            const res = await fetch(`/dashboards/${dashboardId}/sync-members`, {
                method: 'POST',
                credentials: 'same-origin'
            });

            const data = await res.json();

            if (res.ok && data.success) {
                status.textContent = '✓ Members synced';
                status.style.color = '#4ade80';

                // Reload dashboard details
                await loadDashboardDetails(dashboardId);
            } else {
                status.textContent = '✗ ' + (data.detail || 'Failed');
                status.style.color = '#f87171';
            }
        } catch (err) {
            status.textContent = '✗ Error';
            status.style.color = '#f87171';
        }

        e.target.textContent = 'Sync Members';
        e.target.disabled = false;

        setTimeout(() => { status.textContent = ''; }, 3000);
    }
});

// Delete dashboard button
document.addEventListener('click', async (e) => {
    if (e.target.id === 'delete-dashboard-btn') {
        const dashboardId = e.target.dataset.dashboardId;
        const status = document.getElementById('dashboard-action-status');

        if (!dashboardId) return;

        if (!confirm('Delete this dashboard?')) return;

        e.target.textContent = 'Deleting...';
        e.target.disabled = true;

        try {
            const res = await fetch(`/dashboards/${encodeURIComponent(dashboardId)}`, {
                method: 'DELETE',
                credentials: 'same-origin'
            });

            const data = await res.json();

            if (res.ok && data.success) {
                status.textContent = '✓ Deleted';
                status.style.color = '#4ade80';

                closeDashboardTab(dashboardId);
                loadDashboardsSidebar();
                loadDashboardEmptyList();
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

// Create dashboard modal handling
document.addEventListener('click', (e) => {
    if (e.target.id === 'create-dashboard-btn') {
        const modal = document.getElementById('create-dashboard-modal');
        if (modal) modal.classList.add('active');
    }

    if (e.target.id === 'close-dashboard-modal' || e.target.id === 'cancel-dashboard-btn') {
        const modal = document.getElementById('create-dashboard-modal');
        if (modal) modal.classList.remove('active');
    }
});

// Close modal on overlay click
document.addEventListener('click', (e) => {
    if (e.target.id === 'create-dashboard-modal') {
        e.target.classList.remove('active');
    }
});

// Create dashboard form submission
const createDashboardForm = document.getElementById('create-dashboard-form');
if (createDashboardForm) {
    createDashboardForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('new-dashboard-name').value;
        const teamId = document.getElementById('new-dashboard-team').value;
        const metricsStr = document.getElementById('new-dashboard-metrics').value;
        const period = document.getElementById('new-dashboard-period').value;
        const status = document.getElementById('create-dashboard-status');
        const btn = document.getElementById('submit-dashboard-btn');

        // Parse metrics
        const metrics = metricsStr.split(',').map(m => m.trim()).filter(Boolean);

        btn.disabled = true;
        btn.textContent = 'Creating...';
        status.textContent = '';

        try {
            const res = await fetch('/dashboards/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({
                    dashboard_name: name,
                    team_id: teamId,
                    metrics: metrics,
                    reporting_period: period
                })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                status.textContent = '✓ Dashboard created';
                status.className = 'modal-status status-success';

                // Refresh sidebar and empty list
                loadDashboardsSidebar();
                loadDashboardEmptyList();

                // Close modal after delay
                setTimeout(() => {
                    document.getElementById('create-dashboard-modal').classList.remove('active');
                    createDashboardForm.reset();
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