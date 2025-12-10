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
    const graphView = document.getElementById('dashboard-graph-view');
    if (metricsView) metricsView.style.display = 'block';
    if (detailsView) detailsView.style.display = 'none';
    if (graphView) graphView.style.display = 'none';
}

// Show details view
function showDetailsView() {
    const metricsView = document.getElementById('dashboard-metrics-view');
    const detailsView = document.getElementById('dashboard-details-view');
    const graphView = document.getElementById('dashboard-graph-view');
    if (metricsView) metricsView.style.display = 'none';
    if (detailsView) detailsView.style.display = 'block';
    if (graphView) graphView.style.display = 'none';
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

            // Initialize graph for this dashboard
            initGraphForDashboard(dashboardId, d.metrics || []);

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
    let historicalData = {};

    try {
        // Fetch current aggregates and historical data in parallel
        const [aggRes, histRes] = await Promise.all([
            fetch(`/dashboards/${dashboardId}/aggregate`, { credentials: 'same-origin' }),
            fetch(`/dashboards/${dashboardId}/graph-data?time_range=4`, { credentials: 'same-origin' })
        ]);

        const aggData = await aggRes.json();
        if (aggRes.ok && aggData.aggregates) {
            aggregatedData = aggData.aggregates;
        }

        const histData = await histRes.json();
        if (histRes.ok && histData.series) {
            // Transform series data into per-metric arrays
            histData.series.forEach((point, idx) => {
                metrics.forEach(metric => {
                    if (!historicalData[metric]) historicalData[metric] = [];
                    historicalData[metric].push({
                        value: point[metric] || 0,
                        label: point.period
                    });
                });
            });
        }
    } catch (err) {
        console.error('Error fetching metric data:', err);
    }

    grid.innerHTML = metrics.map((metric, index) => {
        const color = metricColors[index % metricColors.length];
        const icon = metricIcons[metric.toLowerCase()] || metricIcons.default;
        const value = aggregatedData[metric]?.total || 0;
        const count = aggregatedData[metric]?.count || 0;

        // Build chart bars from historical data
        const history = historicalData[metric] || [];
        const maxVal = Math.max(...history.map(h => h.value), 1);

        const chartBars = history.length > 0
            ? history.map((h, i) => {
                const heightPercent = Math.max((h.value / maxVal) * 100, 4);
                const isLast = i === history.length - 1;
                return `<div class="metric-chart-bar-wrapper">
                    <div class="metric-chart-bar ${isLast ? 'current' : ''}" style="height: ${heightPercent}%"></div>
                    <span class="metric-chart-label">${h.label}</span>
                </div>`;
            }).join('')
            : Array.from({ length: 4 }, (_, i) =>
                `<div class="metric-chart-bar-wrapper">
                    <div class="metric-chart-bar" style="height: 4%"></div>
                    <span class="metric-chart-label">W${i+1}</span>
                </div>`
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
                <div class="metric-card-chart" data-color="${color}">${chartBars}</div>
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

// === TEAM PICKER ===
document.addEventListener('click', async (e) => {
    // Open team dropdown
    if (e.target.id === 'pick-team-btn') {
        e.preventDefault();
        e.stopPropagation();

        const dropdown = document.getElementById('team-dropdown');
        const list = document.getElementById('team-dropdown-list');

        if (!dropdown || !list) return;

        if (dropdown.style.display === 'none' || dropdown.style.display === '') {
            dropdown.style.display = 'block';
            list.innerHTML = '<p style="padding: 16px; text-align: center; color: #6b6b6b;">Loading...</p>';

            try {
                const res = await fetch('/teams/list', { credentials: 'same-origin' });
                const data = await res.json();

                if (res.ok && data.teams && data.teams.length > 0) {
                    list.innerHTML = data.teams.map(team => `
                        <div class="team-item" data-team-id="${team._id}">
                            <span class="team-item-name">${team.team_name}</span>
                            <span class="team-item-id">${team._id.substring(0, 8)}...</span>
                        </div>
                    `).join('');
                } else {
                    list.innerHTML = `
                        <div class="team-dropdown-empty">
                            <p>No teams found</p>
                            <p style="margin-top: 8px; font-size: 12px;">Create a team first in the Teams section</p>
                        </div>
                    `;
                }
            } catch (err) {
                console.error('Error fetching teams:', err);
                list.innerHTML = `
                    <div class="team-dropdown-empty">
                        <p>Error loading teams</p>
                    </div>
                `;
            }
        } else {
            dropdown.style.display = 'none';
        }
        return;
    }

    // Close team dropdown
    if (e.target.id === 'close-team-dropdown') {
        e.preventDefault();
        e.stopPropagation();
        const dropdown = document.getElementById('team-dropdown');
        if (dropdown) dropdown.style.display = 'none';
        return;
    }

    // Select team from dropdown
    const teamItem = e.target.closest('.team-item');
    if (teamItem && e.target.closest('#team-dropdown')) {
        e.preventDefault();
        e.stopPropagation();
        const teamId = teamItem.dataset.teamId;
        const input = document.getElementById('new-dashboard-team');
        const dropdown = document.getElementById('team-dropdown');

        if (input) input.value = teamId;
        if (dropdown) dropdown.style.display = 'none';
        return;
    }
});

// Close team dropdown when clicking outside
document.addEventListener('mousedown', (e) => {
    const dropdown = document.getElementById('team-dropdown');
    const pickBtn = document.getElementById('pick-team-btn');

    if (dropdown && dropdown.style.display !== 'none' && dropdown.style.display !== '') {
        if (!dropdown.contains(e.target) && e.target !== pickBtn) {
            dropdown.style.display = 'none';
        }
    }
});

// === GRAPH VIEW ===
let graphCurrentDashboardId = null;
let graphCurrentMetric = null;
let graphCurrentMember = 'all';
let graphMembers = [];
let graphMetrics = [];

// Show graph view
function showGraphView() {
    const metricsView = document.getElementById('dashboard-metrics-view');
    const detailsView = document.getElementById('dashboard-details-view');
    const graphView = document.getElementById('dashboard-graph-view');
    if (metricsView) metricsView.style.display = 'none';
    if (detailsView) detailsView.style.display = 'none';
    if (graphView) graphView.style.display = 'block';

    // Load graph data if we have a dashboard
    if (graphCurrentDashboardId) {
        loadGraphData();
    }
}

// Hide graph view (back to metrics)
function hideGraphView() {
    showMetricsView();
}

// Graph button click
document.addEventListener('click', (e) => {
    if (e.target.closest('#show-graph-btn')) {
        showGraphView();
    }
    if (e.target.closest('#hide-graph-btn')) {
        hideGraphView();
    }
});

// Initialize graph when loading dashboard
function initGraphForDashboard(dashboardId, metrics) {
    graphCurrentDashboardId = dashboardId;
    graphMetrics = metrics || [];
    graphCurrentMetric = null; // All metrics by default
    graphCurrentMember = 'all';

    // Populate metric tabs
    const tabsContainer = document.getElementById('graph-metric-tabs');
    if (tabsContainer && graphMetrics.length > 0) {
        let tabsHtml = '<button class="graph-metric-tab active" data-metric="">All</button>';
        tabsHtml += graphMetrics.map(m =>
            `<button class="graph-metric-tab" data-metric="${m}">${m}</button>`
        ).join('');
        tabsContainer.innerHTML = tabsHtml;
    }

    // Reset member dropdown display
    const memberLabel = document.getElementById('graph-member-label');
    if (memberLabel) memberLabel.textContent = 'All Members';

    // Reset the By Member button
    updateByMemberButton('all');
}

// Load graph data from API
async function loadGraphData() {
    if (!graphCurrentDashboardId) return;

    const container = document.getElementById('graph-container');
    if (!container) return;

    container.innerHTML = '<div class="graph-loading">Loading graph data...</div>';

    const timeRange = document.getElementById('graph-time-range')?.value || 8;

    let url = `/dashboards/${graphCurrentDashboardId}/graph-data?time_range=${timeRange}`;
    if (graphCurrentMetric) {
        url += `&metric=${encodeURIComponent(graphCurrentMetric)}`;
    }
    if (graphCurrentMember && graphCurrentMember !== 'all') {
        url += `&member_email=${encodeURIComponent(graphCurrentMember)}`;
    }

    try {
        const res = await fetch(url, { credentials: 'same-origin' });
        const data = await res.json();

        if (res.ok && data.success) {
            graphMembers = data.members || [];
            renderGraph(data.series, data.metrics);
            updateGraphLabels();
        } else {
            container.innerHTML = `<div class="graph-empty"><p>Could not load graph data</p></div>`;
        }
    } catch (err) {
        console.error('Error loading graph:', err);
        container.innerHTML = `<div class="graph-empty"><p>Error loading graph data</p></div>`;
    }
}

// Update graph labels
function updateGraphLabels() {
    const metricLabel = document.getElementById('graph-metric-label');
    const memberLabel = document.getElementById('graph-member-label');

    if (metricLabel) {
        metricLabel.textContent = graphCurrentMetric || 'All Metrics';
    }
    if (memberLabel) {
        if (graphCurrentMember === 'all') {
            memberLabel.textContent = 'All Members';
        } else {
            const member = graphMembers.find(m => m.email === graphCurrentMember);
            memberLabel.textContent = member ? member.name : graphCurrentMember;
        }
    }
}

// Render SVG graph
function renderGraph(series, metrics) {
    const container = document.getElementById('graph-container');
    const legendContainer = document.getElementById('graph-legend');
    if (!container) return;

    if (!series || series.length === 0) {
        container.innerHTML = `
            <div class="graph-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <line x1="18" y1="20" x2="18" y2="10"></line>
                    <line x1="12" y1="20" x2="12" y2="4"></line>
                    <line x1="6" y1="20" x2="6" y2="14"></line>
                </svg>
                <p>No data available</p>
            </div>
        `;
        if (legendContainer) legendContainer.innerHTML = '';
        return;
    }

    // Determine which metrics to display
    const displayMetrics = graphCurrentMetric ? [graphCurrentMetric] : metrics;
    const graphColors = ['orange', 'blue', 'green', 'purple', 'pink', 'cyan'];

    // Calculate dimensions
    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const width = container.clientWidth;
    const height = container.clientHeight;
    const graphWidth = width - padding.left - padding.right;
    const graphHeight = height - padding.top - padding.bottom;

    // Find max value
    let maxValue = 0;
    series.forEach(point => {
        displayMetrics.forEach(m => {
            if (point[m] > maxValue) maxValue = point[m];
        });
    });
    if (maxValue === 0) maxValue = 100;
    maxValue = Math.ceil(maxValue * 1.1); // Add 10% padding

    // Create SVG
    let svg = `<svg class="graph-svg" viewBox="0 0 ${width} ${height}">`;

    // Draw grid lines
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
        const y = padding.top + (graphHeight / gridLines) * i;
        const value = Math.round(maxValue - (maxValue / gridLines) * i);
        svg += `<line class="graph-grid-line" x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}"/>`;
        svg += `<text class="graph-axis-label" x="${padding.left - 10}" y="${y + 4}" text-anchor="end">${formatNumber(value)}</text>`;
    }

    // Draw x-axis labels
    const xStep = graphWidth / (series.length - 1 || 1);
    series.forEach((point, i) => {
        const x = padding.left + xStep * i;
        svg += `<text class="graph-axis-label" x="${x}" y="${height - 10}" text-anchor="middle">${point.period}</text>`;
    });

    // Draw lines and areas for each metric
    displayMetrics.forEach((metricName, metricIndex) => {
        const color = graphColors[metricIndex % graphColors.length];
        let linePath = '';
        let areaPath = '';
        const points = [];

        series.forEach((point, i) => {
            const x = padding.left + xStep * i;
            const value = point[metricName] || 0;
            const y = padding.top + graphHeight - (value / maxValue) * graphHeight;

            points.push({ x, y, value, period: point.period });

            if (i === 0) {
                linePath += `M ${x} ${y}`;
                areaPath += `M ${x} ${padding.top + graphHeight} L ${x} ${y}`;
            } else {
                linePath += ` L ${x} ${y}`;
                areaPath += ` L ${x} ${y}`;
            }
        });

        // Close area path
        if (series.length > 0) {
            const lastX = padding.left + xStep * (series.length - 1);
            areaPath += ` L ${lastX} ${padding.top + graphHeight} Z`;
        }

        // Draw area
        svg += `<path class="graph-area ${color}" d="${areaPath}"/>`;

        // Draw line
        svg += `<path class="graph-line ${color}" d="${linePath}"/>`;

        // Draw points
        points.forEach((p, i) => {
            svg += `<circle class="graph-point ${color}" cx="${p.x}" cy="${p.y}" r="4" data-metric="${metricName}" data-value="${p.value}" data-period="${p.period}"/>`;
        });
    });

    svg += '</svg>';

    // Add tooltip div
    svg += '<div class="graph-tooltip" id="graph-tooltip"></div>';

    container.innerHTML = svg;

    // Build legend
    if (legendContainer) {
        legendContainer.innerHTML = displayMetrics.map((m, i) => {
            const color = graphColors[i % graphColors.length];
            return `
                <div class="graph-legend-item">
                    <div class="graph-legend-color graph-color-${color}"></div>
                    <span>${m}</span>
                </div>
            `;
        }).join('');
    }

    // Add point hover handlers
    container.querySelectorAll('.graph-point').forEach(point => {
        point.addEventListener('mouseenter', (e) => {
            const tooltip = document.getElementById('graph-tooltip');
            if (tooltip) {
                const metric = e.target.dataset.metric;
                const value = e.target.dataset.value;
                const period = e.target.dataset.period;
                tooltip.innerHTML = `
                    <div class="graph-tooltip-period">${period}</div>
                    <div class="graph-tooltip-value">${metric}: ${formatNumber(parseFloat(value))}</div>
                `;
                tooltip.classList.add('visible');

                const rect = container.getBoundingClientRect();
                const x = parseFloat(e.target.getAttribute('cx'));
                const y = parseFloat(e.target.getAttribute('cy'));
                tooltip.style.left = `${x}px`;
                tooltip.style.top = `${y - 60}px`;
            }
        });

        point.addEventListener('mouseleave', () => {
            const tooltip = document.getElementById('graph-tooltip');
            if (tooltip) tooltip.classList.remove('visible');
        });
    });
}

// Metric tab click handler
document.addEventListener('click', (e) => {
    const tab = e.target.closest('.graph-metric-tab');
    if (tab) {
        // Update active state
        document.querySelectorAll('.graph-metric-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Set current metric
        graphCurrentMetric = tab.dataset.metric || null;

        // Reload graph
        loadGraphData();
    }
});

// Time range change
document.addEventListener('change', (e) => {
    if (e.target.id === 'graph-time-range') {
        loadGraphData();
    }
});

// By Member button click
document.addEventListener('click', (e) => {
    const byMemberBtn = e.target.closest('#by-member-btn');
    if (byMemberBtn) {
        e.preventDefault();
        e.stopPropagation();
        const dropdown = document.getElementById('member-dropdown');
        if (!dropdown) return;

        if (dropdown.style.display === 'none' || dropdown.style.display === '') {
            dropdown.style.display = 'block';
            populateMemberDropdown();
        } else {
            dropdown.style.display = 'none';
        }
        return;
    }

    // Close member dropdown
    if (e.target.closest('#close-member-dropdown')) {
        const dropdown = document.getElementById('member-dropdown');
        if (dropdown) dropdown.style.display = 'none';
    }
});

// Populate member dropdown
function populateMemberDropdown() {
    const list = document.getElementById('member-dropdown-list');
    if (!list) return;

    let html = `
        <div class="member-dropdown-item ${graphCurrentMember === 'all' ? 'active' : ''}" data-email="all">
            <span class="member-item-name">All Members</span>
            <span class="member-item-email">Show aggregated data</span>
        </div>
    `;

    graphMembers.forEach(m => {
        const isActive = graphCurrentMember === m.email;
        html += `
            <div class="member-dropdown-item ${isActive ? 'active' : ''}" data-email="${m.email}">
                <span class="member-item-name">${m.name || 'Unknown'}</span>
                <span class="member-item-email">${m.email}</span>
            </div>
        `;
    });

    list.innerHTML = html;
}

// Member dropdown item click
document.addEventListener('click', (e) => {
    const item = e.target.closest('.member-dropdown-item');
    if (item && e.target.closest('#member-dropdown')) {
        e.preventDefault();
        e.stopPropagation();

        const email = item.dataset.email;
        graphCurrentMember = email;

        // Update button text and style
        updateByMemberButton(email);

        // Close dropdown
        const dropdown = document.getElementById('member-dropdown');
        if (dropdown) dropdown.style.display = 'none';

        // Reload graph
        loadGraphData();
    }
});

// Helper function to update the By Member button
function updateByMemberButton(email) {
    const btn = document.getElementById('by-member-btn');
    if (!btn) return;

    // Ensure button is always visible
    btn.style.display = 'inline-flex';
    btn.style.visibility = 'visible';
    btn.style.opacity = '1';

    if (email === 'all') {
        btn.textContent = 'By Member';
        btn.classList.remove('has-selection');
    } else {
        const member = graphMembers.find(m => m.email === email);
        const displayName = member ? member.name : email;
        // Truncate long names
        const truncatedName = displayName.length > 15 ? displayName.substring(0, 15) + '...' : displayName;
        btn.textContent = truncatedName;
        btn.classList.add('has-selection');
    }
}

// Close member dropdown when clicking outside
document.addEventListener('mousedown', (e) => {
    const dropdown = document.getElementById('member-dropdown');
    const btn = document.getElementById('by-member-btn');

    if (dropdown && dropdown.style.display !== 'none' && dropdown.style.display !== '') {
        if (!dropdown.contains(e.target) && e.target !== btn) {
            dropdown.style.display = 'none';
        }
    }

    // Also handle metrics view member dropdown
    const metricsDropdown = document.getElementById('metrics-member-dropdown');
    const metricsBtn = document.getElementById('metrics-by-member-btn');

    if (metricsDropdown && metricsDropdown.style.display !== 'none' && metricsDropdown.style.display !== '') {
        // Check if click is inside button (including its children like SVGs)
        const isInsideBtn = metricsBtn && (e.target === metricsBtn || metricsBtn.contains(e.target));
        if (!metricsDropdown.contains(e.target) && !isInsideBtn) {
            metricsDropdown.style.display = 'none';
        }
    }
});

// === METRICS VIEW MEMBER FILTER ===
let metricsViewCurrentMember = 'all';
let metricsViewMembers = [];

// Metrics By Member button click
document.addEventListener('click', (e) => {
    const metricsBtn = e.target.closest('#metrics-by-member-btn');
    if (metricsBtn) {
        e.preventDefault();
        e.stopPropagation();
        const dropdown = document.getElementById('metrics-member-dropdown');
        if (!dropdown) return;

        if (dropdown.style.display === 'none' || dropdown.style.display === '') {
            dropdown.style.display = 'block';
            populateMetricsMemberDropdown();
        } else {
            dropdown.style.display = 'none';
        }
        return;
    }

    // Close metrics member dropdown
    if (e.target.closest('#close-metrics-member-dropdown')) {
        const dropdown = document.getElementById('metrics-member-dropdown');
        if (dropdown) dropdown.style.display = 'none';
    }
});

// Populate metrics member dropdown
async function populateMetricsMemberDropdown() {
    const list = document.getElementById('metrics-member-dropdown-list');
    if (!list) return;

    // Load members if not already loaded
    if (metricsViewMembers.length === 0 && graphCurrentDashboardId) {
        try {
            const res = await fetch(`/dashboards/${graphCurrentDashboardId}/login-info`, { credentials: 'same-origin' });
            const data = await res.json();
            if (res.ok && data.members) {
                metricsViewMembers = data.members;
            }
        } catch (err) {
            console.error('Error loading members:', err);
        }
    }

    let html = `
        <div class="member-dropdown-item ${metricsViewCurrentMember === 'all' ? 'active' : ''}" data-email="all" data-target="metrics">
            <span class="member-item-name">All Members</span>
            <span class="member-item-email">Show aggregated data</span>
        </div>
    `;

    metricsViewMembers.forEach(m => {
        const isActive = metricsViewCurrentMember === m.email;
        html += `
            <div class="member-dropdown-item ${isActive ? 'active' : ''}" data-email="${m.email}" data-target="metrics">
                <span class="member-item-name">${m.name || 'Unknown'}</span>
                <span class="member-item-email">${m.email}</span>
            </div>
        `;
    });

    list.innerHTML = html;
}

// Metrics member dropdown item click
document.addEventListener('click', (e) => {
    const item = e.target.closest('.member-dropdown-item[data-target="metrics"]');
    if (item && e.target.closest('#metrics-member-dropdown')) {
        e.preventDefault();
        e.stopPropagation();

        const email = item.dataset.email;
        metricsViewCurrentMember = email;

        // Update button text
        updateMetricsByMemberButton(email);

        // Close dropdown
        const dropdown = document.getElementById('metrics-member-dropdown');
        if (dropdown) dropdown.style.display = 'none';

        // Reload metrics with filter
        if (graphCurrentDashboardId) {
            renderMetricCardsFiltered(currentDashboardMetrics, graphCurrentDashboardId, email);
            loadDashboardLeaderboardFiltered(graphCurrentDashboardId, currentDashboardMetrics, email);
        }
    }
});

// Helper function to update the Metrics By Member button
function updateMetricsByMemberButton(email) {
    const btn = document.getElementById('metrics-by-member-btn');
    const textSpan = document.getElementById('metrics-member-btn-text');
    if (!btn || !textSpan) return;

    btn.style.display = 'inline-flex';
    btn.style.visibility = 'visible';
    btn.style.opacity = '1';

    if (email === 'all') {
        textSpan.textContent = 'all';
        btn.classList.remove('has-selection');
    } else {
        const member = metricsViewMembers.find(m => m.email === email);
        const displayName = member ? member.name : email;
        // Truncate to fit in button
        const truncatedName = displayName.length > 12 ? displayName.substring(0, 12) + '...' : displayName;
        textSpan.textContent = truncatedName;
        btn.classList.add('has-selection');
    }
}

// Render metric cards with member filter
async function renderMetricCardsFiltered(metrics, dashboardId, memberEmail) {
    const grid = document.getElementById('metrics-grid');
    if (!grid) return;

    if (!metrics || metrics.length === 0) {
        grid.innerHTML = '<div class="metric-card-placeholder"><p>No metrics configured</p></div>';
        return;
    }

    let aggregatedData = {};
    let historicalData = {};

    try {
        // Build URLs with member filter
        let aggUrl = `/dashboards/${dashboardId}/aggregate`;
        let histUrl = `/dashboards/${dashboardId}/graph-data?time_range=4`;
        if (memberEmail && memberEmail !== 'all') {
            aggUrl += `?member_email=${encodeURIComponent(memberEmail)}`;
            histUrl += `&member_email=${encodeURIComponent(memberEmail)}`;
        }

        // Fetch current aggregates and historical data in parallel
        const [aggRes, histRes] = await Promise.all([
            fetch(aggUrl, { credentials: 'same-origin' }),
            fetch(histUrl, { credentials: 'same-origin' })
        ]);

        const aggData = await aggRes.json();
        if (aggRes.ok && aggData.aggregates) {
            aggregatedData = aggData.aggregates;
        }

        const histData = await histRes.json();
        if (histRes.ok && histData.series) {
            // Transform series data into per-metric arrays
            histData.series.forEach((point, idx) => {
                metrics.forEach(metric => {
                    if (!historicalData[metric]) historicalData[metric] = [];
                    historicalData[metric].push({
                        value: point[metric] || 0,
                        label: point.period
                    });
                });
            });
        }
    } catch (err) {
        console.error('Error fetching filtered metric data:', err);
    }

    grid.innerHTML = metrics.map((metric, index) => {
        const color = metricColors[index % metricColors.length];
        const icon = metricIcons[metric.toLowerCase()] || metricIcons.default;
        const value = aggregatedData[metric]?.total || 0;
        const count = aggregatedData[metric]?.count || 0;

        // Build chart bars from historical data
        const history = historicalData[metric] || [];
        const maxVal = Math.max(...history.map(h => h.value), 1);

        const chartBars = history.length > 0
            ? history.map((h, i) => {
                const heightPercent = Math.max((h.value / maxVal) * 100, 4);
                const isLast = i === history.length - 1;
                return `<div class="metric-chart-bar-wrapper">
                    <div class="metric-chart-bar ${isLast ? 'current' : ''}" style="height: ${heightPercent}%"></div>
                    <span class="metric-chart-label">${h.label}</span>
                </div>`;
            }).join('')
            : Array.from({ length: 4 }, (_, i) =>
                `<div class="metric-chart-bar-wrapper">
                    <div class="metric-chart-bar" style="height: 4%"></div>
                    <span class="metric-chart-label">W${i+1}</span>
                </div>`
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
                <div class="metric-card-chart" data-color="${color}">${chartBars}</div>
            </div>
        `;
    }).join('');
}

// Load leaderboard with member filter (shows only that member)
async function loadDashboardLeaderboardFiltered(dashboardId, metrics, memberEmail) {
    const container = document.getElementById('dashboard-leaderboard');
    const countBadge = document.getElementById('leaderboard-count');
    if (!container) return;

    try {
        const res = await fetch(`/dashboards/${dashboardId}/leaderboard`, { credentials: 'same-origin' });
        const data = await res.json();

        if (res.ok && data.leaderboard && data.leaderboard.length > 0) {
            let leaderboard = data.leaderboard;

            // Filter to specific member if not 'all'
            if (memberEmail && memberEmail !== 'all') {
                leaderboard = leaderboard.filter(m => m.email.toLowerCase() === memberEmail.toLowerCase());
            }

            if (countBadge) countBadge.textContent = `${leaderboard.length} members`;

            container.innerHTML = leaderboard.map((member, index) => {
                let rankClass = '';
                if (index === 0) rankClass = 'gold';
                else if (index === 1) rankClass = 'silver';
                else if (index === 2) rankClass = 'bronze';

                const memberMetrics = member.metrics || {};
                const metricsHtml = metrics.slice(0, 3).map(m => {
                    let val = 0;
                    if (memberMetrics[m]) {
                        val = memberMetrics[m].value || 0;
                    } else {
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

// Reset metrics view member filter when loading new dashboard
function resetMetricsViewMemberFilter() {
    metricsViewCurrentMember = 'all';
    metricsViewMembers = [];
    updateMetricsByMemberButton('all');
}