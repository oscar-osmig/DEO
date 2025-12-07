// === TEAM DASHBOARD ===

// Get dashboard ID from data attribute
const dashboardId = document.body.dataset.dashboardId;
const reportingPeriod = document.body.dataset.reportingPeriod;

const views = ['metrics', 'charts', 'leaderboard'];
let currentViewIndex = 0;
let currentUser = null;
let hasSubmittedThisPeriod = false;
let currentMetrics = {};

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

    if (viewId === 'leaderboard') {
        loadLeaderboard();
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
    } catch (err) {
        console.log('Error checking metrics:', err);
        showFormState();
    }
}

// === SHOW SUBMITTED STATE ===
function showSubmittedState(metrics) {
    document.getElementById('metrics-form-state').style.display = 'none';
    document.getElementById('metrics-submitted-state').style.display = 'block';

    document.getElementById('metrics-view-title').textContent = 'Your Metrics';
    document.getElementById('metrics-view-subtitle').textContent = 'You have already submitted your metrics for this period.';

    const displayEl = document.getElementById('metrics-display');
    let html = '';

    for (const [metricName, valueData] of Object.entries(metrics)) {
        const value = typeof valueData === 'object' ? valueData.value : valueData;
        html += `
            <div class="metric-item">
                <span class="metric-item-label">${metricName}</span>
                <span class="metric-item-value">${Number(value).toLocaleString()}</span>
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
    hasSubmittedThisPeriod = false;

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
    list.innerHTML = '<div class="empty-state"><p>Loading...</p></div>';

    try {
        const res = await fetch(`/dashboards/${dashboardId}/leaderboard`);
        const data = await res.json();

        if (res.ok && data.leaderboard && data.leaderboard.length > 0) {
            list.innerHTML = data.leaderboard.map((member, index) => {
                let rankClass = '';
                if (index === 0) rankClass = 'gold';
                else if (index === 1) rankClass = 'silver';
                else if (index === 2) rankClass = 'bronze';

                const isCurrentUser = currentUser && member.email.toLowerCase() === currentUser.email.toLowerCase();

                return `
                    <div class="leaderboard-item ${isCurrentUser ? 'current-user' : ''}">
                        <div class="leaderboard-rank ${rankClass}">${index + 1}</div>
                        <div class="leaderboard-info">
                            <div class="leaderboard-name">${member.name || 'Unknown'}${isCurrentUser ? ' (You)' : ''}</div>
                            <div class="leaderboard-email">${member.email}</div>
                        </div>
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

// Initialize
document.getElementById('nav-prev').disabled = true;