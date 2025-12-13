// === TEAM DASHBOARD ===

// Get dashboard ID from data attribute
const dashboardId = document.body.dataset.dashboardId;
const reportingPeriod = document.body.dataset.reportingPeriod;

const views = ['metrics', 'charts', 'leaderboard', 'apps'];
let currentViewIndex = 0;
let currentUser = null;
let hasSubmittedThisPeriod = false;
let currentMetrics = {};
let performanceChart = null;
let cachedLeaderboard = null;

// Session storage keys
const SESSION_KEY = `dashboard_session_${dashboardId}`;

// === SESSION PERSISTENCE ===
function saveSession() {
    if (currentUser) {
        const session = {
            user: currentUser,
            viewIndex: currentViewIndex,
            metrics: currentMetrics,
            hasSubmitted: hasSubmittedThisPeriod
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
}

function loadSession() {
    try {
        const stored = localStorage.getItem(SESSION_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.log('Error loading session:', e);
    }
    return null;
}

function clearSession() {
    localStorage.removeItem(SESSION_KEY);
}

// === BADGE SYSTEM ===
const BADGE_TIERS = [
    { name: 'Bronze', tier: 'bronze', minScore: 0, icon: 'chevron' },
    { name: 'Silver', tier: 'silver', minScore: 1000, icon: 'chevrons' },
    { name: 'Gold', tier: 'gold', minScore: 5000, icon: 'star' },
    { name: 'Platinum', tier: 'platinum', minScore: 10000, icon: 'star-filled' },
    { name: 'Diamond', tier: 'diamond', minScore: 25000, icon: 'gem' },
    { name: 'Master', tier: 'master', minScore: 50000, icon: 'crown' },
    { name: 'Grandmaster', tier: 'grandmaster', minScore: 100000, icon: 'crown-laurel' }
];

function getBadgeTier(totalScore) {
    let badge = BADGE_TIERS[0];
    for (const tier of BADGE_TIERS) {
        if (totalScore >= tier.minScore) {
            badge = tier;
        }
    }
    return badge;
}

function getBadgeIcon(iconType) {
    const icons = {
        'chevron': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="6 9 12 15 18 9"></polyline>
        </svg>`,
        'chevrons': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="6 6 12 12 18 6"></polyline>
            <polyline points="6 12 12 18 18 12"></polyline>
        </svg>`,
        'star': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
        </svg>`,
        'star-filled': `<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
        </svg>`,
        'gem': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 3h12l4 6-10 13L2 9l4-6z"></path>
            <path d="M12 22V9"></path>
            <path d="M2 9h20"></path>
            <path d="M6 3l6 6 6-6"></path>
        </svg>`,
        'crown': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M2 8l4 4 6-8 6 8 4-4-2 12H4L2 8z"></path>
            <circle cx="12" cy="4" r="1" fill="currentColor"></circle>
        </svg>`,
        'crown-laurel': `<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1">
            <path d="M2 8l4 4 6-8 6 8 4-4-2 12H4L2 8z"></path>
            <circle cx="12" cy="4" r="1.5"></circle>
            <path d="M5 20c-2-1-3-4-3-6" fill="none" stroke-width="1.5"></path>
            <path d="M19 20c2-1 3-4 3-6" fill="none" stroke-width="1.5"></path>
        </svg>`
    };
    return icons[iconType] || icons['chevron'];
}

function createBadgeHTML(tier, showTooltip = true) {
    const tooltipHTML = showTooltip ? `<span class="badge-tooltip">${tier.name}</span>` : '';
    return `
        <div class="member-badge">
            <div class="badge-hexagon badge-${tier.tier}">
                <svg viewBox="0 0 100 100">
                    <polygon class="badge-fill" points="50,3 93,25 93,75 50,97 7,75 7,25" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
                </svg>
                <div class="badge-icon">${getBadgeIcon(tier.icon)}</div>
            </div>
            ${tooltipHTML}
        </div>
    `;
}

// === VIEW NAVIGATION ===
function switchView(viewId) {
    currentViewIndex = views.indexOf(viewId);
    if (currentViewIndex === -1) currentViewIndex = 0;

    document.querySelectorAll('.sidebar-btn[data-view]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === viewId);
    });

    document.querySelectorAll('.view').forEach(view => {
        view.classList.toggle('active', view.id === 'view-' + viewId);
    });

    document.getElementById('nav-prev').disabled = currentViewIndex === 0;
    document.getElementById('nav-next').disabled = currentViewIndex === views.length - 1;

    // Save session when view changes
    saveSession();

    if (viewId === 'leaderboard') {
        loadLeaderboard();
    } else if (viewId === 'charts') {
        loadChartsView();
    }
}

// Sidebar navigation
document.querySelectorAll('.sidebar-btn[data-view]').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
});

// Arrow navigation
document.getElementById('nav-prev').addEventListener('click', () => {
    if (currentViewIndex > 0) switchView(views[currentViewIndex - 1]);
});

document.getElementById('nav-next').addEventListener('click', () => {
    if (currentViewIndex < views.length - 1) switchView(views[currentViewIndex + 1]);
});

// === LOGIN ===
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const passcode = document.getElementById('passcode').value;
    const status = document.getElementById('login-status');
    const btn = document.getElementById('login-btn');

    btn.textContent = 'Signing in...';
    btn.disabled = true;

    try {
        const res = await fetch(`/dashboards/login/check?dashboard_id=${dashboardId}&email=${encodeURIComponent(email)}&passcode=${encodeURIComponent(passcode)}`);
        const data = await res.json();

        if (res.ok && data.access_granted) {
            status.textContent = '✓ Access granted';
            status.className = 'status success';
            currentUser = { email, name: data.member_name };
            saveSession(); // Save session immediately after login

            setTimeout(() => {
                document.getElementById('login-view').classList.add('hidden');
                document.getElementById('dashboard-app').classList.add('active');
                document.getElementById('user-email-display').textContent = email;
                switchView('metrics');
                checkExistingMetrics();
            }, 300);
        } else {
            status.textContent = '✗ ' + (data.detail || 'Invalid email or passcode');
            status.className = 'status error';
        }
    } catch (err) {
        status.textContent = '✗ Connection error';
        status.className = 'status error';
    }

    btn.textContent = 'Sign In';
    btn.disabled = false;
});

// === LOGOUT ===
function logout() {
    currentUser = null;
    hasSubmittedThisPeriod = false;
    currentMetrics = {};
    cachedLeaderboard = null;
    clearSession(); // Clear saved session
    if (performanceChart) {
        performanceChart.destroy();
        performanceChart = null;
    }
    document.getElementById('dashboard-app').classList.remove('active');
    document.getElementById('login-view').classList.remove('hidden');
    document.getElementById('login-form').reset();
    document.getElementById('login-status').textContent = '';
    document.getElementById('metrics-form').reset();
    document.getElementById('metrics-form-state').style.display = 'block';
    document.getElementById('metrics-submitted-state').style.display = 'none';
    document.getElementById('submit-btn').textContent = 'Submit Metrics';
}

document.getElementById('logout-btn').addEventListener('click', logout);
document.getElementById('logout-sidebar-btn').addEventListener('click', logout);

// === CHECK EXISTING METRICS ===
async function checkExistingMetrics() {
    try {
        const res = await fetch(`/dashboards/${dashboardId}/my-metrics?email=${encodeURIComponent(currentUser.email)}`);
        const data = await res.json();

        if (res.ok && data.metrics && Object.keys(data.metrics).length > 0) {
            hasSubmittedThisPeriod = true;
            currentMetrics = data.metrics;
            showSubmittedState(data.metrics);
        } else {
            hasSubmittedThisPeriod = false;
            showFormState();
        }
        // Save session after checking metrics
        saveSession();
    } catch (err) {
        console.log('Error checking metrics:', err);
        showFormState();
    }
}

// === SHOW SUBMITTED STATE ===
function showSubmittedState(metrics) {
    document.getElementById('metrics-form-state').style.display = 'none';
    document.getElementById('metrics-submitted-state').style.display = 'block';
    document.getElementById('cancel-edit-btn').style.display = 'none';

    document.getElementById('metrics-view-title').textContent = 'Your Metrics';
    document.getElementById('metrics-view-subtitle').textContent = 'You have already submitted your metrics for this period.';

    const displayEl = document.getElementById('metrics-display');
    let html = '';

    for (const [metricName, valueData] of Object.entries(metrics)) {
        const value = typeof valueData === 'object' ? valueData.value : valueData;
        html += `
            <div class="metric-item">
                <div class="metric-item-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="20" x2="18" y2="10"></line>
                        <line x1="12" y1="20" x2="12" y2="4"></line>
                        <line x1="6" y1="20" x2="6" y2="14"></line>
                    </svg>
                </div>
                <span class="metric-item-value">${Number(value).toLocaleString()}</span>
                <span class="metric-item-label">${metricName}</span>
            </div>
        `;
    }

    displayEl.innerHTML = html;
}

// === SHOW FORM STATE ===
function showFormState() {
    document.getElementById('metrics-form-state').style.display = 'block';
    document.getElementById('metrics-submitted-state').style.display = 'none';

    document.getElementById('metrics-view-title').textContent = 'Submit Metrics';
    document.getElementById('metrics-view-subtitle').textContent = `Enter your metrics for the current ${reportingPeriod} period.`;
}

// === EDIT METRICS ===
document.getElementById('edit-metrics-btn').addEventListener('click', () => {
    // Pre-fill form with current values
    for (const [metricName, valueData] of Object.entries(currentMetrics)) {
        const value = typeof valueData === 'object' ? valueData.value : valueData;
        const input = document.querySelector(`[data-metric="${metricName}"]`);
        if (input) {
            input.value = value;
        }
    }

    showFormState();
    document.getElementById('submit-btn').textContent = 'Update Metrics';
    document.getElementById('cancel-edit-btn').style.display = 'inline-flex';
});

// === CANCEL EDIT ===
document.getElementById('cancel-edit-btn').addEventListener('click', () => {
    // Reset form and go back to submitted state
    document.getElementById('metrics-form').reset();
    showSubmittedState(currentMetrics);
    document.getElementById('submit-btn').textContent = 'Submit Metrics';
});

// === SUBMIT METRICS ===
document.getElementById('metrics-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const status = document.getElementById('submit-status');
    const btn = document.getElementById('submit-btn');

    const metrics = {};
    document.querySelectorAll('[data-metric]').forEach(input => {
        const value = parseFloat(input.value);
        if (!isNaN(value)) {
            metrics[input.dataset.metric] = value;
        }
    });

    if (Object.keys(metrics).length === 0) {
        status.textContent = '✗ Please enter at least one metric';
        status.className = 'submit-status error show';
        setTimeout(() => status.classList.remove('show'), 3000);
        return;
    }

    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = 'Submitting...';

    try {
        const res = await fetch(`/dashboards/${dashboardId}/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: currentUser.email,
                metrics: metrics
            })
        });

        const data = await res.json();

        if (res.ok && data.success) {
            status.textContent = '✓ Metrics submitted successfully!';
            status.className = 'submit-status success show';

            hasSubmittedThisPeriod = true;
            cachedLeaderboard = null; // Clear cache to refresh

            // Update currentMetrics
            for (const [key, value] of Object.entries(metrics)) {
                currentMetrics[key] = { value: value };
            }

            setTimeout(() => {
                showSubmittedState(currentMetrics);
                btn.textContent = 'Submit Metrics';
            }, 1000);
        } else {
            status.textContent = '✗ ' + (data.detail || 'Failed to submit');
            status.className = 'submit-status error show';
        }
    } catch (err) {
        status.textContent = '✗ Connection error';
        status.className = 'submit-status error show';
    }

    btn.textContent = originalText;
    btn.disabled = false;

    setTimeout(() => status.classList.remove('show'), 4000);
});

// === LEADERBOARD ===
async function loadLeaderboard() {
    const list = document.getElementById('leaderboard-list');
    list.innerHTML = '<div class="chart-loading"><div class="spinner"></div><p>Loading leaderboard...</p></div>';

    try {
        const res = await fetch(`/dashboards/${dashboardId}/leaderboard`);
        const data = await res.json();

        if (res.ok && data.leaderboard && data.leaderboard.length > 0) {
            cachedLeaderboard = data.leaderboard;

            list.innerHTML = data.leaderboard.map((member, index) => {
                let rankClass = '';
                let rankItemClass = '';
                if (index === 0) { rankClass = 'gold'; rankItemClass = 'rank-1'; }
                else if (index === 1) { rankClass = 'silver'; rankItemClass = 'rank-2'; }
                else if (index === 2) { rankClass = 'bronze'; rankItemClass = 'rank-3'; }

                const isCurrentUser = currentUser && member.email.toLowerCase() === currentUser.email.toLowerCase();
                const badge = getBadgeTier(member.total);

                // Build metric tags HTML
                let metricsHTML = '';
                if (member.metrics && Object.keys(member.metrics).length > 0) {
                    metricsHTML = '<div class="leaderboard-metrics">';
                    for (const [metricName, valueData] of Object.entries(member.metrics)) {
                        // Handle both { value: number } and direct number formats
                        const value = typeof valueData === 'object' ? valueData.value : valueData;
                        metricsHTML += `
                            <div class="leaderboard-metric-tag">
                                <span class="tag-label">${metricName}:</span>
                                <span class="tag-value">${Number(value).toLocaleString()}</span>
                            </div>
                        `;
                    }
                    metricsHTML += '</div>';
                }

                return `
                    <div class="leaderboard-item ${isCurrentUser ? 'current-user' : ''} ${rankItemClass}">
                        <div class="leaderboard-rank ${rankClass}">${index + 1}</div>
                        ${createBadgeHTML(badge)}
                        <div class="leaderboard-info">
                            <div class="leaderboard-name">${member.name || 'Unknown'}${isCurrentUser ? ' (You)' : ''}</div>
                            <div class="leaderboard-email">${member.email}</div>
                        </div>
                        ${metricsHTML}
                        <div class="leaderboard-score">${member.total.toLocaleString()}</div>
                    </div>
                `;
            }).join('');
        } else {
            list.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
                        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
                        <path d="M4 22h16"></path>
                        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path>
                        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path>
                        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>
                    </svg>
                    <p>No data yet</p>
                    <p class="hint">Submit metrics to appear on the leaderboard</p>
                </div>
            `;
        }
    } catch (err) {
        list.innerHTML = `
            <div class="empty-state">
                <p>Could not load leaderboard</p>
                <p class="hint">Please try again later</p>
            </div>
        `;
    }
}

// === CHARTS VIEW ===
async function loadChartsView() {
    if (!currentUser) return;

    // Update member profile
    const initials = currentUser.name ? currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase() : currentUser.email[0].toUpperCase();
    document.getElementById('member-avatar').textContent = initials;
    document.getElementById('profile-name').textContent = currentUser.name || 'Unknown';
    document.getElementById('profile-email').textContent = currentUser.email;

    // Load leaderboard to get user's rank and badge
    let userTotal = 0;
    let userRank = '-';
    let userMetrics = currentMetrics;

    if (cachedLeaderboard) {
        const userEntry = cachedLeaderboard.find(m => m.email.toLowerCase() === currentUser.email.toLowerCase());
        if (userEntry) {
            userTotal = userEntry.total;
            userRank = cachedLeaderboard.indexOf(userEntry) + 1;
            userMetrics = userEntry.metrics || currentMetrics;
        }
    } else {
        try {
            const res = await fetch(`/dashboards/${dashboardId}/leaderboard`);
            const data = await res.json();
            if (res.ok && data.leaderboard) {
                cachedLeaderboard = data.leaderboard;
                const userEntry = data.leaderboard.find(m => m.email.toLowerCase() === currentUser.email.toLowerCase());
                if (userEntry) {
                    userTotal = userEntry.total;
                    userRank = data.leaderboard.indexOf(userEntry) + 1;
                    userMetrics = userEntry.metrics || currentMetrics;
                }
            }
        } catch (err) {
            console.log('Error fetching leaderboard for charts:', err);
        }
    }

    // Update badge in profile
    const badge = getBadgeTier(userTotal);
    const badgeContainer = document.getElementById('profile-badge-container');
    badgeContainer.innerHTML = `
        ${createBadgeHTML(badge, false)}
        <span class="badge-rank-label">${badge.name}</span>
    `;

    // Update stats row
    const statsRow = document.getElementById('stats-row');
    let statsHTML = `
        <div class="stat-card">
            <div class="stat-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
                    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
                    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>
                </svg>
            </div>
            <div class="stat-value">#${userRank}</div>
            <div class="stat-label">Current Rank</div>
        </div>
        <div class="stat-card">
            <div class="stat-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
            </div>
            <div class="stat-value">${userTotal.toLocaleString()}</div>
            <div class="stat-label">Total Score</div>
        </div>
    `;

    // Add individual metric stats
    for (const [metricName, valueData] of Object.entries(userMetrics)) {
        const value = typeof valueData === 'object' ? valueData.value : valueData;
        statsHTML += `
            <div class="stat-card">
                <div class="stat-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="20" x2="18" y2="10"></line>
                        <line x1="12" y1="20" x2="12" y2="4"></line>
                        <line x1="6" y1="20" x2="6" y2="14"></line>
                    </svg>
                </div>
                <div class="stat-value">${Number(value).toLocaleString()}</div>
                <div class="stat-label">${metricName}</div>
            </div>
        `;
    }

    statsRow.innerHTML = statsHTML;

    // Load chart data
    await loadPerformanceChart();
}

async function loadPerformanceChart() {
    const canvas = document.getElementById('performance-chart');
    if (!canvas) return;

    // Destroy existing chart if it exists
    if (performanceChart) {
        performanceChart.destroy();
    }

    try {
        const res = await fetch(`/dashboards/${dashboardId}/my-metrics-history?email=${encodeURIComponent(currentUser.email)}&weeks=8`);

        let chartData;
        if (res.ok) {
            chartData = await res.json();
        } else {
            // Create mock data structure with current metrics only
            const currentWeek = reportingPeriod;
            chartData = {
                labels: [currentWeek],
                datasets: []
            };

            // Add current metrics as single data point
            for (const [metricName, valueData] of Object.entries(currentMetrics)) {
                const value = typeof valueData === 'object' ? valueData.value : valueData;
                chartData.datasets.push({
                    label: metricName,
                    data: [value]
                });
            }
        }

        // Chart colors matching our theme
        const chartColors = [
            { bg: 'rgba(59, 130, 246, 0.2)', border: 'rgba(59, 130, 246, 1)' },
            { bg: 'rgba(74, 222, 128, 0.2)', border: 'rgba(74, 222, 128, 1)' },
            { bg: 'rgba(251, 191, 36, 0.2)', border: 'rgba(251, 191, 36, 1)' },
            { bg: 'rgba(248, 113, 113, 0.2)', border: 'rgba(248, 113, 113, 1)' },
            { bg: 'rgba(167, 139, 250, 0.2)', border: 'rgba(167, 139, 250, 1)' }
        ];

        const datasets = (chartData.datasets || []).map((ds, i) => ({
            label: ds.label,
            data: ds.data,
            backgroundColor: chartColors[i % chartColors.length].bg,
            borderColor: chartColors[i % chartColors.length].border,
            borderWidth: 2,
            tension: 0.3,
            fill: true,
            pointBackgroundColor: chartColors[i % chartColors.length].border,
            pointBorderColor: '#0a0a0a',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6
        }));

        performanceChart = new Chart(canvas, {
            type: 'line',
            data: {
                labels: chartData.labels || [],
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: '#a1a1a1',
                            font: { size: 12 },
                            padding: 20,
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    tooltip: {
                        backgroundColor: '#1a1a1a',
                        titleColor: '#ffffff',
                        bodyColor: '#a1a1a1',
                        borderColor: '#2a2a2a',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: true,
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${context.parsed.y.toLocaleString()}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(42, 42, 42, 0.5)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#6b6b6b',
                            font: { size: 11 }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(42, 42, 42, 0.5)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#6b6b6b',
                            font: { size: 11 },
                            callback: function(value) {
                                return value.toLocaleString();
                            }
                        }
                    }
                }
            }
        });
    } catch (err) {
        console.log('Error loading chart:', err);
        // Show empty state for chart
        const container = canvas.parentElement;
        container.innerHTML = `
            <div class="chart-loading">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width: 48px; height: 48px; opacity: 0.3; margin-bottom: 12px;">
                    <line x1="18" y1="20" x2="18" y2="10"></line>
                    <line x1="12" y1="20" x2="12" y2="4"></line>
                    <line x1="6" y1="20" x2="6" y2="14"></line>
                </svg>
                <p>Submit more metrics to see trends</p>
            </div>
        `;
    }
}

// === RESTORE SESSION ===
async function restoreSession() {
    const session = loadSession();
    console.log('Restoring session:', session);

    if (session && session.user) {
        // Verify the session is still valid by checking with the server
        try {
            const res = await fetch(`/dashboards/${dashboardId}/my-metrics?email=${encodeURIComponent(session.user.email)}`);
            console.log('Session validation response:', res.status);

            if (res.ok) {
                // Session is valid, restore state
                currentUser = session.user;
                currentMetrics = session.metrics || {};
                hasSubmittedThisPeriod = session.hasSubmitted || false;

                // Show dashboard
                document.getElementById('login-view').classList.add('hidden');
                document.getElementById('dashboard-app').classList.add('active');
                document.getElementById('user-email-display').textContent = currentUser.email;

                // Restore to the saved view
                const savedViewIndex = session.viewIndex || 0;
                switchView(views[savedViewIndex]);

                // Refresh metrics data
                await checkExistingMetrics();
                console.log('Session restored successfully');
                return true;
            } else {
                console.log('Session validation failed with status:', res.status);
            }
        } catch (err) {
            console.log('Session validation error:', err);
        }
        // Session invalid, clear it
        clearSession();
    }
    return false;
}

// Initialize
document.getElementById('nav-prev').disabled = true;

// Try to restore session on page load
restoreSession();
