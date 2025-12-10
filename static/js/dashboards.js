// === DASHBOARDS ===

const metricColors = ['orange', 'blue', 'green', 'purple', 'pink', 'cyan'];
const metricIcons = {
    sales: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>',
    calls: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>',
    meetings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
    default: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>'
};

let currentDashboardMetrics = [];
let currentDashboardUrl = '';

// Show metrics view (default)
function showMetricsView() {
    const metricsView = document.getElementById('dashboard-metrics-view');
    const detailsView = document.getElementById('dashboard-details-view');
    if (metricsView) metricsView.style.display = 'block';
    if (detailsView) detailsView.style.display = 'none';
}

// Show details view
function showDetailsView() {
    const metricsView = document.getElementById('dashboard-metrics-view');
    const detailsView = document.getElementById('dashboard-details-view');
    if (metricsView) metricsView.style.display = 'none';
    if (detailsView) detailsView.style.display = 'block';
}

// Load dashboard details by ID
async function loadDashboardDetails(dashboardId) {
    // Reset to metrics view when loading new dashboard
    showMetricsView();

    try {
        // Fetch dashboard template
        const res = await fetch(`/dashboards/${encodeURIComponent(dashboardId)}`, { credentials: 'same-origin' });
        const data = await res.json();

        // Fetch login info (members with passcodes and URL)
        const loginRes = await fetch(`/dashboards/${encodeURIComponent(dashboardId)}/login-info`, { credentials: 'same-origin' });
        const loginData = await loginRes.json();

        if (res.ok && data.dashboard) {
            const d = data.dashboard;
            currentDashboardMetrics = d.metrics || [];

            // === METRICS VIEW (new) ===
            const metricsTitle = document.getElementById('metrics-view-title');
            if (metricsTitle) metricsTitle.textContent = d.dashboard_name || 'Dashboard';

            const metricsSubtitle = document.getElementById('metrics-view-subtitle');
            if (metricsSubtitle) metricsSubtitle.textContent = `Overview of ${d.metrics?.length || 0} metrics`;

            const periodBadge = document.getElementById('dashboard-period-badge');
            if (periodBadge) periodBadge.textContent = d.reporting_period || 'Weekly';

            // Render metric cards
            renderMetricCards(d.metrics || [], dashboardId);

            // Load leaderboard
            loadDashboardLeaderboard(dashboardId, d.metrics || []);

            // === DETAILS VIEW (old) ===
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

            const statusEl = document.getElementById('dashboard-status');
            if (statusEl) statusEl.textContent = d.is_active ? 'Active' : 'Inactive';

            const createdEl = document.getElementById('dashboard-created');
            if (createdEl) createdEl.textContent = d.created_at ? new Date(d.created_at).toLocaleDateString() : '-';

            // Metrics tags
            const metricsEl = document.getElementById('dashboard-metrics');
            if (metricsEl) {
                if (d.metrics && d.metrics.length > 0) {
                    metricsEl.innerHTML = d.metrics.map(m => `<span class="metric-tag">${m}</span>`).join('');
                } else {
                    metricsEl.innerHTML = '<p class="text-muted">No metrics configured</p>';
                }
            }

            // Get members from login-info response
            const members = loginData.members || [];

            // Update members count
            const membersEl = document.getElementById('dashboard-members');
            if (membersEl) membersEl.textContent = members.length + ' members';

            // Dashboard URL - use /team-dashboard/{dashboard_id} path
            currentDashboardUrl = `${window.location.origin}/team-dashboard/${dashboardId}`;
            const urlEl = document.getElementById('dashboard-url');
            if (urlEl) urlEl.textContent = currentDashboardUrl;

            // Member access list with passcodes from login-info
            const accessEl = document.getElementById('dashboard-members-access');
            if (accessEl) {
                if (members.length > 0) {
                    accessEl.innerHTML = members.map(m => `
                        <div class="member-access-item">
                            <div class="member-info">
                                <span class="member-name">${m.name || 'Unknown'}</span>
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
                    accessEl.innerHTML = '<p class="text-muted">No members with access. Click "Sync Members" to add team members.</p>';
                }
            }

            // Store dashboard ID for actions
            const viewBtn = document.getElementById('view-dashboard-btn');
            const deleteBtn = document.getElementById('delete-dashboard-btn');
            const syncBtn = document.getElementById('sync-members-btn');
            if (viewBtn) viewBtn.dataset.dashboardId = dashboardId;
            if (deleteBtn) deleteBtn.dataset.dashboardId = dashboardId;
            if (syncBtn) syncBtn.dataset.dashboardId = dashboardId;
        }
    } catch (err) {
        console.error('Error loading dashboard:', err);
    }
}

// Render metric cards (new)
async function renderMetricCards(metrics, dashboardId) {
    const grid = document.getElementById('metrics-grid');
    if (!grid) return;

    if (!metrics || metrics.length === 0) {
        grid.innerHTML = '<div class="metric-card-placeholder"><p>No metrics configured</p></div>';
        return;
    }

    let aggregatedData = {};
    try {
        const res = await fetch(`/dashboards/${dashboardId}/aggregate`, { credentials: 'same-origin' });
        const data = await res.json();
        if (res.ok && data.aggregates) {
            aggregatedData = data.aggregates;
        }
    } catch (err) {}

    grid.innerHTML = metrics.map((metric, index) => {
        const color = metricColors[index % metricColors.length];
        const icon = metricIcons[metric.toLowerCase()] || metricIcons.default;
        const value = aggregatedData[metric]?.total || 0;
        const count = aggregatedData[metric]?.count || 0;

        const chartBars = Array.from({ length: 8 }, () =>
            `<div class="metric-chart-bar" style="height: ${20 + Math.random() * 80}%"></div>`
        ).join('');

        return `
            <div class="metric-card">
                <div class="metric-card-header">
                    <div class="metric-card-icon ${color}">${icon}</div>
                    <div class="metric-card-trend">${count} submissions</div>
                </div>
                <div class="metric-card-body">
                    <span class="metric-card-label">${metric}</span>
                    <span class="metric-card-value">${formatNumber(value)}</span>
                </div>
                <div class="metric-card-chart">${chartBars}</div>
            </div>
        `;
    }).join('');
}

// Format numbers
function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
}

// Load leaderboard (new)
async function loadDashboardLeaderboard(dashboardId, metrics) {
    const container = document.getElementById('dashboard-leaderboard');
    const countBadge = document.getElementById('leaderboard-count');
    if (!container) return;

    try {
        const res = await fetch(`/dashboards/${dashboardId}/leaderboard`, { credentials: 'same-origin' });
        const data = await res.json();

        if (res.ok && data.leaderboard && data.leaderboard.length > 0) {
            if (countBadge) countBadge.textContent = `${data.leaderboard.length} members`;

            container.innerHTML = data.leaderboard.map((member, index) => {
                let rankClass = '';
                if (index === 0) rankClass = 'gold';
                else if (index === 1) rankClass = 'silver';
                else if (index === 2) rankClass = 'bronze';

                // Build metrics HTML - handle case-insensitive matching
                const memberMetrics = member.metrics || {};
                const metricsHtml = metrics.slice(0, 3).map(m => {
                    // Try exact match first, then case-insensitive
                    let val = 0;
                    if (memberMetrics[m]) {
                        val = memberMetrics[m].value || 0;
                    } else {
                        // Case-insensitive fallback
                        const lowerM = m.toLowerCase();
                        for (const [key, data] of Object.entries(memberMetrics)) {
                            if (key.toLowerCase() === lowerM) {
                                val = data.value || 0;
                                break;
                            }
                        }
                    }
                    return `
                        <div class="leaderboard-metric">
                            <span class="leaderboard-metric-value">${formatNumber(val)}</span>
                            <span class="leaderboard-metric-label">${m}</span>
                        </div>
                    `;
                }).join('');

                return `
                    <div class="leaderboard-row">
                        <div class="leaderboard-rank ${rankClass}">${index + 1}</div>
                        <div class="leaderboard-info">
                            <span class="leaderboard-name">${member.name || 'Unknown'}</span>
                            <span class="leaderboard-email">${member.email}</span>
                        </div>
                        <div class="leaderboard-metrics">${metricsHtml}</div>
                    </div>
                `;
            }).join('');
        } else {
            if (countBadge) countBadge.textContent = '0 members';
            container.innerHTML = '<div class="leaderboard-empty"><p>No submissions yet</p></div>';
        }
    } catch (err) {
        container.innerHTML = '<div class="leaderboard-empty"><p>Could not load leaderboard</p></div>';
    }
}

// Load dashboards into sidebar
function loadDashboardsSidebar() {
    const dashboardsList = document.getElementById('dashboards-list');
    if (!dashboardsList) return;

    fetch('/dashboards/list', { credentials: 'same-origin' }).then(r => r.json()).then(data => {
        let html = '<a href="#dashboards" class="sidebar-submenu-item add-new" id="sidebar-add-dashboard">+ Add dashboard</a>';
        if (data.dashboards && data.dashboards.length > 0) {
            html += data.dashboards.map(d =>
                `<a href="#dashboards" class="sidebar-submenu-item" data-dashboard-id="${d._id}">${d.dashboard_name}</a>`
            ).join('');
        }
        dashboardsList.innerHTML = html;
    }).catch(() => {
        dashboardsList.innerHTML = '<a href="#dashboards" class="sidebar-submenu-item add-new" id="sidebar-add-dashboard">+ Add dashboard</a>';
    });
}

// Toggle between views
document.addEventListener('click', (e) => {
    if (e.target.closest('#show-details-btn')) {
        showDetailsView();
    }
    if (e.target.closest('#hide-details-btn')) {
        showMetricsView();
    }
});

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

// View dashboard button - opens the team dashboard page
document.addEventListener('click', (e) => {
    if (e.target.id === 'view-dashboard-btn') {
        const dashboardId = e.target.dataset.dashboardId;
        if (dashboardId) {
            // Open the team-dashboard URL
            window.open(`${window.location.origin}/team-dashboard/${dashboardId}`, '_blank');
        }
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
                status.textContent = `✓ Synced! ${data.total_members} members (${data.new_members_added} new)`;
                status.style.color = '#4ade80';

                // Reload dashboard details and stay on details view
                await loadDashboardDetails(dashboardId);
                showDetailsView();
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

        const confirmed = await confirmDelete({
            title: 'Delete Dashboard',
            message: 'Are you sure you want to delete this dashboard?',
            warning: 'All metrics and member access will be removed. This action cannot be undone.'
        });
        if (!confirmed) return;

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

// Open modal from sidebar
document.addEventListener('click', (e) => {
    if (e.target.closest('#sidebar-add-dashboard')) {
        e.preventDefault();
        window.location.hash = '#dashboards';
        if (typeof setHeaderSection === 'function') setHeaderSection('Dashboards');
        const modal = document.getElementById('create-dashboard-modal');
        if (modal) modal.classList.add('active');
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
                    reporting_period: period,
                    base_url: window.location.origin
                })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                status.textContent = '✓ Dashboard created';
                status.className = 'modal-status status-success';

                loadDashboardsSidebar();
                loadDashboardEmptyList();

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