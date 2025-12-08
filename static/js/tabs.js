// === TAB SYSTEM ===

// Track open tabs
let openWorkspaceTabs = [];
let activeWorkspaceTab = null;

let openTemplateTabs = [];
let activeTemplateTab = null;

let openDashboardTabs = [];
let activeDashboardTab = null;

let openTeamTabs = [];
let activeTeamTab = null;

// === UPDATE VIEW FUNCTIONS ===

function updateWorkspaceView() {
    const emptyState = document.getElementById('workspace-empty-state');
    const details = document.getElementById('workspace-details');

    if (openWorkspaceTabs.length === 0) {
        if (emptyState) emptyState.style.display = 'flex';
        if (details) details.style.display = 'none';
    } else {
        if (emptyState) emptyState.style.display = 'none';
        if (details) details.style.display = 'block';
    }
}

function updateTemplateView() {
    const emptyState = document.getElementById('template-empty-state');
    const details = document.getElementById('template-details');

    if (openTemplateTabs.length === 0) {
        if (emptyState) emptyState.style.display = 'flex';
        if (details) details.style.display = 'none';
    } else {
        if (emptyState) emptyState.style.display = 'none';
        if (details) details.style.display = 'block';
    }
}

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

// === RENDER TAB FUNCTIONS ===

function renderWorkspaceTabs() {
    const tabsBar = document.getElementById('workspace-tabs');
    if (!tabsBar) return;

    tabsBar.innerHTML = openWorkspaceTabs.map(tab => {
        const isActive = tab.id === activeWorkspaceTab;
        return `
            <div class="tab ${isActive ? 'active' : ''}" data-tab-id="${tab.id}" data-tab-type="workspace">
                <span class="tab-name">${tab.name}</span>
                <span class="tab-close" data-close-tab="${tab.id}" data-close-type="workspace">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </span>
            </div>
        `;
    }).join('');

    updateWorkspaceView();
}

function renderTemplateTabs() {
    const tabsBar = document.getElementById('template-tabs');
    if (!tabsBar) return;

    tabsBar.innerHTML = openTemplateTabs.map(tab => {
        const isActive = tab.id === activeTemplateTab;
        return `
            <div class="tab ${isActive ? 'active' : ''}" data-tab-id="${tab.id}" data-tab-type="template">
                <span class="tab-name">${tab.name}</span>
                <span class="tab-close" data-close-tab="${tab.id}" data-close-type="template">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </span>
            </div>
        `;
    }).join('');

    updateTemplateView();
}

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

// === OPEN TAB FUNCTIONS ===

async function openWorkspaceTab(workspaceId) {
    const existingTab = openWorkspaceTabs.find(tab => tab.id === workspaceId);

    if (existingTab) {
        activeWorkspaceTab = workspaceId;
        renderWorkspaceTabs();
        await loadWorkspaceDetails(workspaceId);
        return;
    }

    try {
        const res = await fetch(`/workspace/${encodeURIComponent(workspaceId)}`, { credentials: 'same-origin' });
        const data = await res.json();

        if (res.ok && data.workspace) {
            const ws = data.workspace;

            openWorkspaceTabs.push({
                id: workspaceId,
                name: ws.workspace_name || 'Workspace'
            });

            activeWorkspaceTab = workspaceId;
            renderWorkspaceTabs();
            await loadWorkspaceDetails(workspaceId);
        }
    } catch (err) {
        console.error('Error opening workspace tab:', err);
    }
}

async function openTemplateTab(templateId) {
    const existingTab = openTemplateTabs.find(tab => tab.id === templateId);

    if (existingTab) {
        activeTemplateTab = templateId;
        renderTemplateTabs();
        await loadTemplateDetails(templateId);
        return;
    }

    try {
        const res = await fetch(`/templates/by-id/${encodeURIComponent(templateId)}`);
        const data = await res.json();

        if (res.ok && data.success) {
            const t = data.template;

            openTemplateTabs.push({
                id: templateId,
                name: t.template_id || 'Template'
            });

            activeTemplateTab = templateId;
            renderTemplateTabs();
            await loadTemplateDetails(templateId);
        }
    } catch (err) {
        console.error('Error opening template tab:', err);
    }
}

async function openDashboardTab(dashboardId) {
    const existingTab = openDashboardTabs.find(tab => tab.id === dashboardId);

    if (existingTab) {
        activeDashboardTab = dashboardId;
        renderDashboardTabs();
        await loadDashboardDetails(dashboardId);
        return;
    }

    try {
        const res = await fetch(`/dashboards/${encodeURIComponent(dashboardId)}`, { credentials: 'same-origin' });
        const data = await res.json();

        if (res.ok && data.dashboard) {
            const d = data.dashboard;

            openDashboardTabs.push({
                id: dashboardId,
                name: d.dashboard_name || 'Dashboard'
            });

            activeDashboardTab = dashboardId;
            renderDashboardTabs();
            await loadDashboardDetails(dashboardId);
        }
    } catch (err) {
        console.error('Error opening dashboard tab:', err);
    }
}

async function openTeamTab(teamId) {
    const existingTab = openTeamTabs.find(tab => tab.id === teamId);

    if (existingTab) {
        activeTeamTab = teamId;
        renderTeamTabs();
        await loadTeamDetails(teamId);
        return;
    }

    try {
        const res = await fetch(`/teams/${encodeURIComponent(teamId)}`, { credentials: 'same-origin' });
        const data = await res.json();

        if (res.ok && data.team) {
            const t = data.team;

            openTeamTabs.push({
                id: teamId,
                name: t.team_name || 'Team'
            });

            activeTeamTab = teamId;
            renderTeamTabs();
            await loadTeamDetails(teamId);
        }
    } catch (err) {
        console.error('Error opening team tab:', err);
    }
}

// === CLOSE TAB FUNCTIONS ===

function closeWorkspaceTab(workspaceId) {
    const index = openWorkspaceTabs.findIndex(tab => tab.id === workspaceId);
    if (index === -1) return;

    openWorkspaceTabs.splice(index, 1);

    if (activeWorkspaceTab === workspaceId) {
        if (openWorkspaceTabs.length > 0) {
            const newIndex = Math.max(0, index - 1);
            activeWorkspaceTab = openWorkspaceTabs[newIndex].id;
            loadWorkspaceDetails(activeWorkspaceTab);
        } else {
            activeWorkspaceTab = null;
        }
    }

    renderWorkspaceTabs();
}

function closeTemplateTab(templateId) {
    const index = openTemplateTabs.findIndex(tab => tab.id === templateId);
    if (index === -1) return;

    openTemplateTabs.splice(index, 1);

    if (activeTemplateTab === templateId) {
        if (openTemplateTabs.length > 0) {
            const newIndex = Math.max(0, index - 1);
            activeTemplateTab = openTemplateTabs[newIndex].id;
            loadTemplateDetails(activeTemplateTab);
        } else {
            activeTemplateTab = null;
        }
    }

    renderTemplateTabs();
}

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

// === CLICK HANDLERS (single event listener for all) ===

document.addEventListener('click', async (e) => {
    // === SIDEBAR/LIST ITEM CLICKS ===

    // Workspace link (sidebar or empty state list)
    const workspaceLink = e.target.closest('[data-workspace-id]');
    if (workspaceLink && !e.target.closest('.tab')) {
        e.preventDefault();
        const workspaceId = workspaceLink.dataset.workspaceId;
        window.location.hash = '#workspace';
        setHeaderSection('Workspaces');
        await openWorkspaceTab(workspaceId);
        return;
    }

    // Template link (sidebar or empty state list)
    const templateLink = e.target.closest('[data-template-id]');
    if (templateLink && !e.target.closest('.tab')) {
        e.preventDefault();
        const templateId = templateLink.dataset.templateId;
        window.location.hash = '#template';
        setHeaderSection('Templates');
        await openTemplateTab(templateId);
        return;
    }

    // Dashboard link (sidebar or empty state list)
    const dashboardLink = e.target.closest('[data-dashboard-id]');
    if (dashboardLink && !e.target.closest('.tab')) {
        e.preventDefault();
        const dashboardId = dashboardLink.dataset.dashboardId;
        window.location.hash = '#dashboards';
        setHeaderSection('Dashboards');
        await openDashboardTab(dashboardId);
        return;
    }

    // Team link (sidebar or empty state list)
    const teamLink = e.target.closest('[data-team-id]');
    if (teamLink && !e.target.closest('.tab')) {
        e.preventDefault();
        const teamId = teamLink.dataset.teamId;
        window.location.hash = '#teams';
        setHeaderSection('Teams');
        await openTeamTab(teamId);
        return;
    }

    // === TAB CLICKS (switch between open tabs) ===

    const workspaceTab = e.target.closest('.tab[data-tab-type="workspace"]');
    if (workspaceTab && !e.target.closest('.tab-close')) {
        const tabId = workspaceTab.dataset.tabId;
        activeWorkspaceTab = tabId;
        renderWorkspaceTabs();
        await loadWorkspaceDetails(tabId);
        return;
    }

    const templateTab = e.target.closest('.tab[data-tab-type="template"]');
    if (templateTab && !e.target.closest('.tab-close')) {
        const tabId = templateTab.dataset.tabId;
        activeTemplateTab = tabId;
        renderTemplateTabs();
        await loadTemplateDetails(tabId);
        return;
    }

    const dashboardTab = e.target.closest('.tab[data-tab-type="dashboard"]');
    if (dashboardTab && !e.target.closest('.tab-close')) {
        const tabId = dashboardTab.dataset.tabId;
        activeDashboardTab = tabId;
        renderDashboardTabs();
        await loadDashboardDetails(tabId);
        return;
    }

    const teamTab = e.target.closest('.tab[data-tab-type="team"]');
    if (teamTab && !e.target.closest('.tab-close')) {
        const tabId = teamTab.dataset.tabId;
        activeTeamTab = tabId;
        renderTeamTabs();
        await loadTeamDetails(tabId);
        return;
    }

    // === TAB CLOSE CLICKS ===

    const closeWorkspaceBtn = e.target.closest('.tab-close[data-close-type="workspace"]');
    if (closeWorkspaceBtn) {
        e.stopPropagation();
        closeWorkspaceTab(closeWorkspaceBtn.dataset.closeTab);
        return;
    }

    const closeTemplateBtn = e.target.closest('.tab-close[data-close-type="template"]');
    if (closeTemplateBtn) {
        e.stopPropagation();
        closeTemplateTab(closeTemplateBtn.dataset.closeTab);
        return;
    }

    const closeDashboardBtn = e.target.closest('.tab-close[data-close-type="dashboard"]');
    if (closeDashboardBtn) {
        e.stopPropagation();
        closeDashboardTab(closeDashboardBtn.dataset.closeTab);
        return;
    }

    const closeTeamBtn = e.target.closest('.tab-close[data-close-type="team"]');
    if (closeTeamBtn) {
        e.stopPropagation();
        closeTeamTab(closeTeamBtn.dataset.closeTab);
        return;
    }
});