// === TAB SYSTEM ===

// Track open workspace tabs
let openWorkspaceTabs = [];
let activeWorkspaceTab = null;

// Track open template tabs
let openTemplateTabs = [];
let activeTemplateTab = null;

// Show/hide workspace empty state
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

// Show/hide template empty state
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

// Render workspace tabs
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

// Render template tabs
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

// Open workspace in tab
async function openWorkspaceTab(workspaceId) {
    const existingTab = openWorkspaceTabs.find(tab => tab.id === workspaceId);

    if (existingTab) {
        activeWorkspaceTab = workspaceId;
        renderWorkspaceTabs();
        await loadWorkspaceDetails(workspaceId);
        return;
    }

    try {
        const res = await fetch(`/workspace/by-id/${encodeURIComponent(workspaceId)}`);
        const data = await res.json();

        if (res.ok && data.success) {
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

// Open template in tab
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

// Close workspace tab
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

// Close template tab
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

// Tab click handlers
document.addEventListener('click', async (e) => {
    // Handle workspace sidebar link
    const workspaceLink = e.target.closest('[data-workspace-id]');
    if (workspaceLink && !e.target.closest('.tab')) {
        e.preventDefault();
        const workspaceId = workspaceLink.dataset.workspaceId;
        window.location.hash = '#workspace';
        setHeaderSection('Workspaces');
        await openWorkspaceTab(workspaceId);
        return;
    }

    // Handle template sidebar link
    const templateLink = e.target.closest('[data-template-id]');
    if (templateLink && !e.target.closest('.tab')) {
        e.preventDefault();
        const templateId = templateLink.dataset.templateId;
        window.location.hash = '#template';
        setHeaderSection('Templates');
        await openTemplateTab(templateId);
        return;
    }

    // Handle workspace tab click (switch tabs)
    const workspaceTab = e.target.closest('.tab[data-tab-type="workspace"]');
    if (workspaceTab && !e.target.closest('.tab-close')) {
        const tabId = workspaceTab.dataset.tabId;
        activeWorkspaceTab = tabId;
        renderWorkspaceTabs();
        await loadWorkspaceDetails(tabId);
        return;
    }

    // Handle template tab click (switch tabs)
    const templateTab = e.target.closest('.tab[data-tab-type="template"]');
    if (templateTab && !e.target.closest('.tab-close')) {
        const tabId = templateTab.dataset.tabId;
        activeTemplateTab = tabId;
        renderTemplateTabs();
        await loadTemplateDetails(tabId);
        return;
    }

    // Handle workspace tab close
    const closeWorkspaceBtn = e.target.closest('.tab-close[data-close-type="workspace"]');
    if (closeWorkspaceBtn) {
        e.stopPropagation();
        const tabId = closeWorkspaceBtn.dataset.closeTab;
        closeWorkspaceTab(tabId);
        return;
    }

    // Handle template tab close
    const closeTemplateBtn = e.target.closest('.tab-close[data-close-type="template"]');
    if (closeTemplateBtn) {
        e.stopPropagation();
        const tabId = closeTemplateBtn.dataset.closeTab;
        closeTemplateTab(tabId);
        return;
    }
});