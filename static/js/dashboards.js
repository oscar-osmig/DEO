// === DASHBOARD FUNCTIONS ===

// Track open dashboard tabs
let openDashboardTabs = [];
let activeDashboardTab = null;

// Show/hide dashboard empty state
function updateDashboardView() {
    const emptyState = document.getElementById('dashboard-empty-state');
    const details = document.getElementById('dashboard-details');

    if (openDashboardTabs.length === 0) {
        if (emptyState) emptyState.style.display = 'flex';
        if (details) details.style.display = 'none';
    } else {
        if (emptyState) emptyState.style.display = 'none';
        if (details) details.style.display = 'block';
    }
}

// Render dashboard tabs
function renderDashboardTabs() {
    const tabsBar = document.getElementById('dashboard-tabs');
    if (!tabsBar) return;

    tabsBar.innerHTML = openDashboardTabs.map(tab => {
        const isActive = tab.id === activeDashboardTab;
        return `
            <div class="tab ${isActive ? 'active' : ''}" data-tab-id="${tab.id}" data-tab-type="dashboard">
                <span class="tab-name">${tab.name}</span>
                <span class="tab-close" data-close-tab="${tab.id}" data-close-type="dashboard">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </span>
            </div>
        `;
    }).join('');

    updateDashboardView();
}

// Open dashboard in tab
async function openDashboardTab(dashboardId) {
    const existingTab = openDashboardTabs.find(tab => tab.id === dashboardId);

    if (existingTab) {
        activeDashboardTab = dashboardId;
        renderDashboardTabs();
        await loadDashboardDetails(dashboardId);
        return;
    }

    try {
        const res = await fetch(`/dashboards/${encodeURIComponent(dashboardId)}`);
        const data = await res.json();

        if (res.ok && data.success) {
            const db = data.dashboard;

            openDashboardTabs.push({
                id: dashboardId,
                name: db.dashboard_name || 'Dashboard'
            });

            activeDashboardTab = dashboardId;
            renderDashboardTabs();
            await loadDashboardDetails(dashboardId);
        }
    } catch (err) {
        console.error('Error opening dashboard tab:', err);
    }
}

// Close dashboard tab
function closeDashboardTab(dashboardId) {
    const index = openDashboardTabs.findIndex(tab => tab.id === dashboardId);
    if (index === -1) return;

    openDashboardTabs.splice(index, 1);

    if (activeDashboardTab === dashboardId) {
        if (openDashboardTabs.length > 0) {
            const newIndex = Math.max(0, index - 1);
            activeDashboardTab = openDashboardTabs[newIndex].id;
            loadDashboardDetails(activeDashboardTab);
        } else {
            activeDashboardTab = null;
        }
    }

    renderDashboardTabs();
}

// Load dashboard details by ID
async function loadDashboardDetails(dashboardId) {
    try {
        const res = await fetch(`/dashboards/${encodeURIComponent(dashboardId)}`);
        const data = await res.json();

        if (res.ok && data.success) {
            const db = data.dashboard;

            const title = document.getElementById('dashboard-title');
            if (title) title.textContent = db.dashboard_name || 'Dashboard';

            const subtitle = document.getElementById('dashboard-subtitle');
            if (subtitle) subtitle.textContent = 'Dashboard details and configuration';

            const dbId = document.getElementById('dashboard-id');
            if (dbId) dbId.textContent = db._id || '-';

            const team = document.getElementById('dashboard-team');
            if (team) team.textContent = db.team_name || '-';

            const owner = document.getElementById('dashboard-owner');
            if (owner) owner.textContent = db.owner_name || '-';

            const period = document.getElementById('dashboard-period');
            if (period) period.textContent = db.reporting_period || '-';

            const members = document.getElementById('dashboard-members');
            if (members) members.textContent = db.members_with_access || '0';

            const status = document.getElementById('dashboard-status');
            if (status) {
                status.textContent = db.is_active ? 'Active' : 'Inactive';
                status.style.color = db.is_active ? '#4ade80' : '#f87171';
            }

            const created = document.getElementById('dashboard-created');
            if (created) created.textContent = db.created_at ? new Date(db.created_at).toLocaleDateString() : '-';

            // Metrics
            const metricsEl = document.getElementById('dashboard-metrics');
            if (metricsEl) {
                if (db.metrics && db.metrics.length > 0) {
                    metricsEl.innerHTML = db.metrics.map(m =>
                        `<span class="metric-tag">${m}</span>`
                    ).join('');
                } else {
                    metricsEl.innerHTML = '<p class="text-muted">No metrics configured</p>';
                }
            }

            // URL
            const urlEl = document.getElementById('dashboard-url');
            if (urlEl) urlEl.textContent = db.url || 'Not available';

            // Store dashboard ID for actions
            const viewBtn = document.getElementById('view-dashboard-btn');
            const deleteBtn = document.getElementById('delete-dashboard-btn');
            const copyBtn = document.getElementById('copy-dashboard-url');
            if (viewBtn) viewBtn.dataset.dashboardId = db._id;
            if (viewBtn) viewBtn.dataset.dashboardUrl = db.url;
            if (deleteBtn) deleteBtn.dataset.dashboardId = db._id;
            if (copyBtn) copyBtn.dataset.dashboardUrl = db.url;

        } else {
            const subtitle = document.getElementById('dashboard-subtitle');
            if (subtitle) subtitle.textContent = 'Dashboard not found';
        }
    } catch (err) {
        const subtitle = document.getElementById('dashboard-subtitle');
        if (subtitle) subtitle.textContent = 'Error loading dashboard';
    }
}

// Load dashboards into sidebar
function loadDashboardsSidebar() {
    const dashboardsList = document.getElementById('dashboards-list');
    if (!dashboardsList) return;

    fetch('/dashboards/list').then(r => r.json()).then(data => {
        let html = '<a href="#dashboards" class="sidebar-submenu-item add-new" id="sidebar-add-dashboard">+ Add dashboard</a>';
        if (data.dashboards && data.dashboards.length > 0) {
            html += data.dashboards.map(db =>
                `<a href="#dashboards" class="sidebar-submenu-item" data-dashboard-id="${db._id}">${db.dashboard_name}</a>`
            ).join('');
        }
        dashboardsList.innerHTML = html;
    }).catch((err) => {
        console.error('Error loading dashboards:', err);
        dashboardsList.innerHTML = '<a href="#dashboards" class="sidebar-submenu-item add-new" id="sidebar-add-dashboard">+ Add dashboard</a>';
    });
}

// Dashboard tab click handlers
document.addEventListener('click', async (e) => {
    // Handle dashboard sidebar link
    const dashboardLink = e.target.closest('[data-dashboard-id]');
    if (dashboardLink && !e.target.closest('.tab')) {
        e.preventDefault();
        const dashboardId = dashboardLink.dataset.dashboardId;
        window.location.hash = '#dashboards';
        setHeaderSection('Dashboards');
        await openDashboardTab(dashboardId);
        return;
    }

    // Handle dashboard tab click (switch tabs)
    const dashboardTab = e.target.closest('.tab[data-tab-type="dashboard"]');
    if (dashboardTab && !e.target.closest('.tab-close')) {
        const tabId = dashboardTab.dataset.tabId;
        activeDashboardTab = tabId;
        renderDashboardTabs();
        await loadDashboardDetails(tabId);
        return;
    }

    // Handle dashboard tab close
    const closeDashboardBtn = e.target.closest('.tab-close[data-close-type="dashboard"]');
    if (closeDashboardBtn) {
        e.stopPropagation();
        const tabId = closeDashboardBtn.dataset.closeTab;
        closeDashboardTab(tabId);
        return;
    }
});

// Dashboard modal handlers
document.addEventListener('click', (e) => {
    // Open modal from header button
    if (e.target.closest('#create-dashboard-btn')) {
        const modal = document.getElementById('create-dashboard-modal');
        if (modal) modal.classList.add('active');
    }

    // Open modal from sidebar
    if (e.target.closest('#sidebar-add-dashboard')) {
        e.preventDefault();
        window.location.hash = '#dashboards';
        setHeaderSection('Dashboards');
        const modal = document.getElementById('create-dashboard-modal');
        if (modal) modal.classList.add('active');
    }

    // Close modal
    if (e.target.closest('#close-dashboard-modal') || e.target.closest('#cancel-dashboard-btn')) {
        const modal = document.getElementById('create-dashboard-modal');
        if (modal) {
            modal.classList.remove('active');
            const form = document.getElementById('create-dashboard-form');
            if (form) form.reset();
            const status = document.getElementById('create-dashboard-status');
            if (status) status.textContent = '';
        }
    }
});

// Create Dashboard Form Submission
document.addEventListener('submit', async (e) => {
    if (e.target.id === 'create-dashboard-form') {
        e.preventDefault();

        const dashboardName = document.getElementById('new-dashboard-name').value;
        const teamId = document.getElementById('new-dashboard-team').value;
        const metricsInput = document.getElementById('new-dashboard-metrics').value;
        const period = document.getElementById('new-dashboard-period').value;
        const status = document.getElementById('create-dashboard-status');
        const submitBtn = document.getElementById('submit-dashboard-btn');

        if (!dashboardName || !teamId || !metricsInput) {
            status.textContent = 'All fields are required';
            status.className = 'modal-status error';
            return;
        }

        // Parse metrics
        const metrics = metricsInput.split(',').map(m => m.trim()).filter(m => m);

        if (metrics.length === 0) {
            status.textContent = 'At least one metric is required';
            status.className = 'modal-status error';
            return;
        }

        submitBtn.textContent = 'Creating...';
        submitBtn.disabled = true;

        try {
            const res = await fetch('/dashboards/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dashboard_name: dashboardName,
                    team_id: teamId,
                    metrics: metrics,
                    base_url: window.location.origin,
                    reporting_period: period
                })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                status.textContent = '✓ Dashboard created!';
                status.className = 'modal-status success';

                setTimeout(async () => {
                    const modal = document.getElementById('create-dashboard-modal');
                    if (modal) modal.classList.remove('active');

                    e.target.reset();
                    status.textContent = '';

                    await openDashboardTab(data.dashboard_id);
                    loadDashboardsSidebar();
                }, 1000);
            } else {
                status.textContent = '✗ ' + (data.detail || 'Failed to create dashboard');
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

// Dashboard action buttons
document.addEventListener('click', async (e) => {
    // View dashboard
    if (e.target.id === 'view-dashboard-btn') {
        const url = e.target.dataset.dashboardUrl;
        if (url) {
            window.open(url, '_blank');
        }
    }

    // Copy URL
    if (e.target.id === 'copy-dashboard-url') {
        const url = e.target.dataset.dashboardUrl;
        if (url) {
            navigator.clipboard.writeText(url).then(() => {
                e.target.textContent = 'Copied!';
                setTimeout(() => {
                    e.target.textContent = 'Copy URL';
                }, 2000);
            });
        }
    }

    // Delete dashboard
    if (e.target.id === 'delete-dashboard-btn') {
        const dashboardId = e.target.dataset.dashboardId;
        const status = document.getElementById('dashboard-action-status');

        if (!dashboardId) return;

        if (!confirm('Delete this dashboard? This action cannot be undone.')) return;

        e.target.textContent = 'Deleting...';
        e.target.disabled = true;

        try {
            const res = await fetch(`/dashboards/${encodeURIComponent(dashboardId)}`, {
                method: 'DELETE'
            });

            const data = await res.json();

            if (res.ok && data.success) {
                status.textContent = '✓ Deleted';
                status.style.color = '#4ade80';

                closeDashboardTab(dashboardId);
                loadDashboardsSidebar();
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