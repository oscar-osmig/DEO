// === TEMPLATE FUNCTIONS ===

// Load template details by ID
async function loadTemplateDetails(templateId) {
    try {
        const res = await fetch(`/templates/by-id/${encodeURIComponent(templateId)}`);
        const data = await res.json();

        if (res.ok && data.success) {
            const t = data.template;
            const ac = t.action_chain || {};

            const title = document.getElementById('template-title');
            if (title) title.textContent = t.template_id || 'Template';

            const subtitle = document.getElementById('template-subtitle');
            if (subtitle) subtitle.textContent = 'Template configuration and actions';

            const tId = document.getElementById('template-id');
            if (tId) tId.textContent = t.template_id || '-';

            const wsId = document.getElementById('template-workspace-id');
            if (wsId) wsId.textContent = t.workspace_id || '-';

            // Trigger
            const trigger = ac.trigger;
            const triggerEl = document.getElementById('template-trigger');
            if (triggerEl) {
                if (typeof trigger === 'string') {
                    triggerEl.textContent = trigger;
                } else if (trigger && trigger.type) {
                    triggerEl.textContent = trigger.type;
                } else {
                    triggerEl.textContent = '-';
                }
            }

            // Blocks
            const blocksEl = document.getElementById('template-blocks');
            if (blocksEl) blocksEl.textContent = ac.blocks ? ac.blocks.join(' → ') : '-';

            // Created
            const createdEl = document.getElementById('template-created');
            if (createdEl) createdEl.textContent = t.created_at ? new Date(t.created_at).toLocaleDateString() : '-';

            // Message config
            const msg = ac.message || {};
            const targetEl = document.getElementById('template-target');
            if (targetEl) {
                if (msg.channel_name) {
                    targetEl.textContent = '#' + msg.channel_name;
                } else if (msg.users) {
                    targetEl.textContent = msg.users.length + ' user(s)';
                } else {
                    targetEl.textContent = '-';
                }
            }

            const messageEl = document.getElementById('template-message');
            if (messageEl) messageEl.textContent = msg.message || '-';

            const responseEl = document.getElementById('template-response');
            if (responseEl) responseEl.textContent = ac.response || '-';

            // Store template ID for actions
            const runBtn = document.getElementById('run-template-btn');
            const deleteBtn = document.getElementById('delete-template-btn');
            if (runBtn) runBtn.dataset.templateId = t.template_id;
            if (deleteBtn) deleteBtn.dataset.templateId = t.template_id;

        } else {
            const subtitle = document.getElementById('template-subtitle');
            if (subtitle) subtitle.textContent = 'Template not found';
        }
    } catch (err) {
        const subtitle = document.getElementById('template-subtitle');
        if (subtitle) subtitle.textContent = 'Error loading template';
    }
}

// Load templates into sidebar
function loadTemplatesSidebar(workspaceId) {
    const templatesList = document.getElementById('templates-list');
    if (!templatesList) return;

    if (!workspaceId) {
        templatesList.innerHTML = '<a href="#template" class="sidebar-submenu-item">No workspace</a>';
        return;
    }

    fetch(`/templates?workspace_id=${workspaceId}`).then(r => r.json()).then(data => {
        if (data.templates && data.templates.length > 0) {
            templatesList.innerHTML = data.templates.map(t =>
                `<a href="#template" class="sidebar-submenu-item" data-template-id="${t.template_id}">${t.template_id}</a>`
            ).join('');
        } else {
            templatesList.innerHTML = '<a href="#template" class="sidebar-submenu-item">No templates yet</a>';
        }
    }).catch(() => {
        templatesList.innerHTML = '<a href="#template" class="sidebar-submenu-item">No templates yet</a>';
    });
}

// Run template button
document.addEventListener('click', async (e) => {
    if (e.target.id === 'run-template-btn') {
        const templateId = e.target.dataset.templateId;
        const status = document.getElementById('template-action-status');

        if (!templateId) return;

        e.target.textContent = 'Running...';
        e.target.disabled = true;

        try {
            const res = await fetch('/templates/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ template_id: templateId })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                status.textContent = '✓ Template executed';
                status.style.color = '#4ade80';
            } else {
                status.textContent = '✗ ' + (data.detail || 'Failed');
                status.style.color = '#f87171';
            }
        } catch (err) {
            status.textContent = '✗ Error';
            status.style.color = '#f87171';
        }

        e.target.textContent = 'Run Template';
        e.target.disabled = false;

        setTimeout(() => { status.textContent = ''; }, 3000);
    }
});

// Delete template button
document.addEventListener('click', async (e) => {
    if (e.target.id === 'delete-template-btn') {
        const templateId = e.target.dataset.templateId;
        const status = document.getElementById('template-action-status');

        if (!templateId) return;

        const confirmed = await confirmDelete({
            title: 'Delete Template',
            message: `Are you sure you want to delete "${templateId}"?`,
            warning: 'This action cannot be undone.'
        });
        if (!confirmed) return;

        e.target.textContent = 'Deleting...';
        e.target.disabled = true;

        try {
            const res = await fetch(`/templates/delete/${encodeURIComponent(templateId)}`, {
                method: 'DELETE'
            });

            const data = await res.json();

            if (res.ok && data.success) {
                status.textContent = '✓ Deleted';
                status.style.color = '#4ade80';

                closeTemplateTab(templateId);
                loadTemplatesSidebar(currentUser?.workspace_id);
                loadTemplateEmptyList(currentUser?.workspace_id);
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

// Create template button - navigate to canvas
document.addEventListener('click', (e) => {
    if (e.target.closest('#create-template-btn')) {
        window.location.hash = '#new-deo';
        if (typeof setHeaderSection === 'function') setHeaderSection('Canvas');
    }
});

// === CANVAS WORKSPACE SELECTOR ===
let selectedCanvasWorkspace = null;

// Load workspaces into canvas dropdown
async function loadCanvasWorkspaces() {
    const list = document.getElementById('workspace-dropdown-list');
    if (!list) return;

    try {
        const res = await fetch('/workspace/list', { credentials: 'same-origin' });
        const data = await res.json();

        if (res.ok && data.workspaces && data.workspaces.length > 0) {
            list.innerHTML = data.workspaces.map(ws => `
                <div class="workspace-dropdown-item" data-workspace-id="${ws.workspace_id}" data-workspace-name="${ws.workspace_name}">
                    ${ws.workspace_name}
                </div>
            `).join('');
        } else {
            list.innerHTML = '<div class="workspace-dropdown-item" style="color: var(--text-muted); cursor: default;">No workspaces</div>';
        }
    } catch (err) {
        list.innerHTML = '<div class="workspace-dropdown-item" style="color: var(--text-muted); cursor: default;">Error loading</div>';
    }
}

// Toggle workspace dropdown
document.addEventListener('click', (e) => {
    const btn = e.target.closest('#workspace-select-btn');
    const wrapper = document.querySelector('.workspace-select-wrapper');

    if (btn && wrapper) {
        e.stopPropagation();
        const isOpen = wrapper.classList.contains('open');

        if (!isOpen) {
            loadCanvasWorkspaces();
        }
        wrapper.classList.toggle('open');
        return;
    }

    // Select workspace from dropdown
    const item = e.target.closest('.workspace-dropdown-item');
    if (item && item.dataset.workspaceId) {
        selectedCanvasWorkspace = item.dataset.workspaceId;
        const nameSpan = document.getElementById('selected-workspace-name');
        if (nameSpan) nameSpan.textContent = item.dataset.workspaceName;

        // Mark as selected
        document.querySelectorAll('.workspace-dropdown-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');

        // Close dropdown
        const wrapper = document.querySelector('.workspace-select-wrapper');
        if (wrapper) wrapper.classList.remove('open');
        return;
    }

    // Close dropdown when clicking outside
    if (wrapper && !wrapper.contains(e.target)) {
        wrapper.classList.remove('open');
    }
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    const wrapper = document.querySelector('.workspace-select-wrapper');
    if (wrapper && !wrapper.contains(e.target)) {
        wrapper.classList.remove('open');
    }
});

// === TRIGGER CONFIGURATION ===
let triggerConfig = {
    type: 'manual',
    schedule: null
};

// Toggle trigger config popup
document.addEventListener('click', (e) => {
    const triggerNode = document.getElementById('trigger-node');
    if (!triggerNode) return;

    const clickedHeader = e.target.closest('.trigger-node .flow-node-header');
    const clickedPopup = e.target.closest('.trigger-config-popup');
    const clickedConnector = e.target.closest('.flow-node-connector');

    // Toggle popup when clicking on trigger header (not connector)
    if (clickedHeader && !clickedConnector) {
        e.stopPropagation();
        triggerNode.classList.toggle('config-open');
        return;
    }

    // Handle clicks inside popup
    if (clickedPopup) {
        e.stopPropagation();

        // Handle trigger type selection
        const option = e.target.closest('.trigger-config-option');
        if (option) {
            const type = option.dataset.triggerType;
            selectTriggerType(type);
        }
        return;
    }

    // Close popup when clicking outside
    if (!triggerNode.contains(e.target)) {
        triggerNode.classList.remove('config-open');
    }
});

// Select trigger type
function selectTriggerType(type) {
    triggerConfig.type = type;

    // Update selected state
    document.querySelectorAll('.trigger-config-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.triggerType === type);
    });

    // Show/hide schedule config
    const scheduleConfig = document.getElementById('trigger-schedule-config');
    if (scheduleConfig) {
        scheduleConfig.classList.toggle('visible', type === 'schedule');
    }

    // Update label
    updateTriggerLabel();

    // If manual, clear schedule config
    if (type === 'manual') {
        triggerConfig.schedule = null;
    } else {
        // Initialize schedule config
        updateScheduleConfig();
    }
}

// Update trigger type label text
function updateTriggerLabel() {
    const label = document.getElementById('trigger-type-label');
    if (!label) return;

    if (triggerConfig.type === 'manual') {
        label.textContent = 'Manual';
    } else if (triggerConfig.schedule) {
        const reg = triggerConfig.schedule.regularity;
        const time = triggerConfig.schedule.time || '';

        if (reg === 'daily') {
            label.textContent = `Daily at ${time}`;
        } else if (reg === 'weekly') {
            const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            const day = days[triggerConfig.schedule.day_of_week || 0];
            label.textContent = `${day} at ${time}`;
        } else if (reg === 'monthly') {
            const dayNum = triggerConfig.schedule.day_of_month || 1;
            label.textContent = `Day ${dayNum} at ${time}`;
        } else if (reg === 'interval') {
            const mins = triggerConfig.schedule.interval_minutes || 30;
            label.textContent = `Every ${mins}m`;
        } else {
            label.textContent = 'Schedule';
        }
    } else {
        label.textContent = 'Schedule';
    }
}

// Update schedule config from form inputs
function updateScheduleConfig() {
    const regularity = document.getElementById('trigger-schedule-regularity')?.value || 'daily';
    const time = document.getElementById('trigger-schedule-time')?.value || '09:00';
    const dayOfWeek = parseInt(document.getElementById('trigger-schedule-day-week')?.value || '0');
    const dayOfMonth = parseInt(document.getElementById('trigger-schedule-day-month')?.value || '1');
    const intervalMinutes = parseInt(document.getElementById('trigger-schedule-interval')?.value || '30');

    triggerConfig.schedule = {
        regularity: regularity,
        time: time
    };

    // Add regularity-specific fields
    if (regularity === 'weekly') {
        triggerConfig.schedule.day_of_week = dayOfWeek;
    } else if (regularity === 'monthly') {
        triggerConfig.schedule.day_of_month = dayOfMonth;
    } else if (regularity === 'interval') {
        triggerConfig.schedule.interval_minutes = intervalMinutes;
        delete triggerConfig.schedule.time;
    }

    updateTriggerLabel();
}

// Handle regularity change - show/hide relevant fields
document.addEventListener('change', (e) => {
    if (e.target.id === 'trigger-schedule-regularity') {
        const regularity = e.target.value;

        // Show/hide fields based on regularity
        const timeRow = document.getElementById('trigger-time-row');
        const dayWeekRow = document.getElementById('trigger-day-week-row');
        const dayMonthRow = document.getElementById('trigger-day-month-row');
        const intervalRow = document.getElementById('trigger-interval-row');

        if (timeRow) timeRow.style.display = regularity !== 'interval' ? 'block' : 'none';
        if (dayWeekRow) dayWeekRow.style.display = regularity === 'weekly' ? 'block' : 'none';
        if (dayMonthRow) dayMonthRow.style.display = regularity === 'monthly' ? 'block' : 'none';
        if (intervalRow) intervalRow.style.display = regularity === 'interval' ? 'block' : 'none';

        updateScheduleConfig();
    }

    // Update config when any schedule input changes
    if (e.target.closest('.trigger-schedule-config')) {
        updateScheduleConfig();
    }
});

// Also update on input for number fields
document.addEventListener('input', (e) => {
    if (e.target.closest('.trigger-schedule-config')) {
        updateScheduleConfig();
    }
});

// === NODE CONFIGURATIONS ===
// Store config for each node by nodeId
let nodeConfigs = {};

// Initialize config for a node
function initNodeConfig(nodeId, nodeType) {
    if (nodeType === 'message') {
        nodeConfigs[nodeId] = {
            mode: 'channel', // 'channel' or 'users'
            channel_name: '',
            users: '',
            message: ''
        };
    } else if (nodeType === 'await') {
        nodeConfigs[nodeId] = {
            timeout: '24h',
            expected_response: '',
            failure_message: ''
        };
    } else if (nodeType === 'response') {
        nodeConfigs[nodeId] = {
            message: ''
        };
    }
}

// Update node label based on config
function updateNodeLabel(nodeId) {
    const node = document.querySelector(`[data-node-id="${nodeId}"]`);
    if (!node) return;

    const label = node.querySelector('.block-type-label');
    if (!label) return;

    const config = nodeConfigs[nodeId];
    if (!config) return;

    const nodeType = node.dataset.nodeType;

    if (nodeType === 'message') {
        if (config.mode === 'channel' && config.channel_name) {
            label.textContent = `#${config.channel_name}`;
        } else if (config.mode === 'users' && config.users) {
            const userCount = config.users.split(',').filter(u => u.trim()).length;
            label.textContent = `${userCount} user${userCount !== 1 ? 's' : ''}`;
        } else {
            label.textContent = config.mode === 'channel' ? 'Channel' : 'Users';
        }
    } else if (nodeType === 'await') {
        label.textContent = config.timeout || '24h';
    } else if (nodeType === 'response') {
        if (config.message) {
            // Show truncated message preview
            const preview = config.message.length > 20
                ? config.message.substring(0, 20) + '...'
                : config.message;
            label.textContent = preview;
        } else {
            label.textContent = 'Response';
        }
    }
}

// Toggle node config popup
document.addEventListener('click', (e) => {
    const flowNode = e.target.closest('.flow-node');
    const clickedHeader = e.target.closest('.flow-node .flow-node-header');
    const clickedPopup = e.target.closest('.block-config-popup');
    const clickedConnector = e.target.closest('.flow-node-connector');
    const clickedDelete = e.target.closest('.flow-node-delete');

    // Don't open popup when clicking delete button or connector
    if (clickedDelete || clickedConnector) return;

    // Toggle popup when clicking on flow node header
    if (clickedHeader && flowNode && !flowNode.classList.contains('trigger-node')) {
        e.stopPropagation();

        // Close other open popups
        document.querySelectorAll('.flow-node.config-open').forEach(n => {
            if (n !== flowNode) n.classList.remove('config-open');
        });

        flowNode.classList.toggle('config-open');
        return;
    }

    // Handle clicks inside popup (don't close)
    if (clickedPopup) {
        e.stopPropagation();

        // Handle mode selection for message block
        const modeBtn = e.target.closest('.block-config-mode');
        if (modeBtn) {
            const nodeId = modeBtn.closest('.flow-node').dataset.nodeId;
            const mode = modeBtn.dataset.mode;
            selectMessageMode(nodeId, mode);
        }
        return;
    }

    // Close all flow node popups when clicking outside
    if (!flowNode) {
        document.querySelectorAll('.flow-node.config-open').forEach(n => {
            n.classList.remove('config-open');
        });
    }
});

// Select message mode (channel or users)
function selectMessageMode(nodeId, mode) {
    const config = nodeConfigs[nodeId];
    if (!config) return;

    config.mode = mode;

    const node = document.querySelector(`[data-node-id="${nodeId}"]`);
    if (!node) return;

    // Update selected state
    node.querySelectorAll('.block-config-mode').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.mode === mode);
    });

    // Show/hide relevant input
    const channelRow = node.querySelector('.config-channel-row');
    const usersRow = node.querySelector('.config-users-row');

    if (channelRow) channelRow.style.display = mode === 'channel' ? 'block' : 'none';
    if (usersRow) usersRow.style.display = mode === 'users' ? 'block' : 'none';

    updateNodeLabel(nodeId);
}

// Handle config input changes
document.addEventListener('input', (e) => {
    const popup = e.target.closest('.block-config-popup');
    if (!popup) return;

    const node = popup.closest('.flow-node');
    if (!node) return;

    const nodeId = node.dataset.nodeId;
    const config = nodeConfigs[nodeId];
    if (!config) return;

    // Update config based on input
    if (e.target.classList.contains('config-channel-input')) {
        config.channel_name = e.target.value;
    } else if (e.target.classList.contains('config-users-input')) {
        config.users = e.target.value;
    } else if (e.target.classList.contains('config-message-input')) {
        config.message = e.target.value;
    } else if (e.target.classList.contains('config-response-input')) {
        config.message = e.target.value;
    } else if (e.target.classList.contains('config-expected-response-input')) {
        config.expected_response = e.target.value;
    } else if (e.target.classList.contains('config-failure-message-input')) {
        config.failure_message = e.target.value;
    }

    updateNodeLabel(nodeId);
});

// Handle config select changes (for timeout, etc.)
document.addEventListener('change', (e) => {
    const popup = e.target.closest('.block-config-popup');
    if (!popup) return;

    const node = popup.closest('.flow-node');
    if (!node) return;

    const nodeId = node.dataset.nodeId;
    const config = nodeConfigs[nodeId];
    if (!config) return;

    if (e.target.classList.contains('config-timeout-select')) {
        config.timeout = e.target.value;
        updateNodeLabel(nodeId);
    }
});

// === CANVAS DRAG AND DROP (Flow-based) ===
let draggedBlock = null;
let canvasNodes = [];
let connections = []; // Array of {from: {nodeId, side}, to: {nodeId, side}}
let nodeIdCounter = 0;

// Connection dragging state
let isConnecting = false;
let connectionStart = null;
let tempLine = null;

// Node dragging state for preview
let draggingNode = null;
let previewLine = null;
let previewConnection = null;

// Distance threshold for auto-connect (in pixels)
const CONNECTION_THRESHOLD = 150;

// Block drag start from sidebar
document.addEventListener('dragstart', (e) => {
    const blockItem = e.target.closest('.block-item');
    if (blockItem) {
        draggedBlock = blockItem.dataset.block;
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/plain', blockItem.dataset.block);
        blockItem.classList.add('dragging');
    }
});

// Block drag end
document.addEventListener('dragend', (e) => {
    const blockItem = e.target.closest('.block-item');
    if (blockItem) {
        blockItem.classList.remove('dragging');
        draggedBlock = null;
        removePreviewLine();
    }
});

// Canvas dragover - allow drop and show preview
document.addEventListener('dragover', (e) => {
    const canvas = e.target.closest('.deo-canvas');
    if (canvas && draggedBlock) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        canvas.classList.add('drag-over');

        // Show preview connection while dragging
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        showDropPreview(x, y);
    }
});

// Canvas dragleave
document.addEventListener('dragleave', (e) => {
    const canvas = e.target.closest('.deo-canvas');
    if (canvas && !canvas.contains(e.relatedTarget)) {
        canvas.classList.remove('drag-over');
        removePreviewLine();
    }
});

// Canvas drop
document.addEventListener('drop', (e) => {
    const canvas = e.target.closest('.deo-canvas');
    if (canvas && draggedBlock) {
        e.preventDefault();
        canvas.classList.remove('drag-over');
        removePreviewLine();

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const placeholder = canvas.querySelector('.canvas-placeholder');
        if (placeholder) placeholder.style.display = 'none';

        const newNode = createNode(draggedBlock, x, y);

        // Find closest existing connector and auto-connect (with threshold)
        if (newNode) {
            autoConnectNode(newNode);
        }

        draggedBlock = null;
        renderConnections();
    }
});

// Show preview line while dragging block from sidebar
function showDropPreview(dropX, dropY) {
    const canvas = document.querySelector('.deo-canvas');
    if (!canvas) return;

    // Find closest available connector
    const closest = findClosestAvailableConnector(dropX, dropY, null);

    if (closest && closest.distance < CONNECTION_THRESHOLD) {
        // Calculate where the new node would connect
        const newNodeSide = getOppositeSide(closest.side);

        // Approximate new node center position
        const newNodePos = {
            x: dropX,
            y: dropY
        };

        // Get position based on side
        let newConnectorPos;
        switch (newNodeSide) {
            case 'top': newConnectorPos = { x: dropX, y: dropY - 22 }; break;
            case 'bottom': newConnectorPos = { x: dropX, y: dropY + 22 }; break;
            case 'left': newConnectorPos = { x: dropX - 100, y: dropY }; break;
            case 'right': newConnectorPos = { x: dropX + 100, y: dropY }; break;
            default: newConnectorPos = newNodePos;
        }

        // Create or update preview line
        let svg = canvas.querySelector('.connections-svg');
        if (!svg) {
            svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.classList.add('connections-svg');
            canvas.insertBefore(svg, canvas.firstChild);
        }

        if (!previewLine) {
            previewLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            previewLine.classList.add('connection-line', 'preview');
            svg.appendChild(previewLine);
        }

        const fromPos = getConnectorPos(closest.nodeId, closest.side);
        if (fromPos) {
            const path = createCurvedPath(fromPos.x, fromPos.y, newConnectorPos.x, newConnectorPos.y, closest.side, newNodeSide);
            previewLine.setAttribute('d', path);
        }

        previewConnection = { closest, newNodeSide };
    } else {
        removePreviewLine();
    }
}

// Remove preview line
function removePreviewLine() {
    if (previewLine) {
        previewLine.remove();
        previewLine = null;
    }
    previewConnection = null;
}

// Get opposite side for connection
function getOppositeSide(side) {
    switch (side) {
        case 'top': return 'bottom';
        case 'bottom': return 'top';
        case 'left': return 'right';
        case 'right': return 'left';
        default: return 'top';
    }
}

// Check if a node already has an incoming connection (as target)
function hasIncomingConnection(nodeId) {
    return connections.some(c => c.to.nodeId === nodeId);
}

// Check if a specific connector side is already used (as input or output)
function isConnectorUsed(nodeId, side) {
    return connections.some(c =>
        (c.from.nodeId === nodeId && c.from.side === side) ||
        (c.to.nodeId === nodeId && c.to.side === side)
    );
}

// Check if a node already has an outgoing connection (from any side)
function hasOutgoingConnection(nodeId) {
    return connections.some(c => c.from.nodeId === nodeId);
}

// Find closest available connector for auto-connect
// This finds connectors that are NOT already used (as input or output)
function findClosestAvailableConnector(x, y, excludeNodeId) {
    const canvas = document.querySelector('.deo-canvas');
    if (!canvas) return null;
    const canvasRect = canvas.getBoundingClientRect();
    let closest = null;
    let minDist = Infinity;

    // Check trigger node bottom connector - only if not already used
    const trigger = document.getElementById('trigger-node');
    const triggerBottomUsed = isConnectorUsed('trigger-node', 'bottom');

    if (trigger && excludeNodeId !== 'trigger-node' && !triggerBottomUsed) {
        const triggerRect = trigger.getBoundingClientRect();
        const tx = triggerRect.left + triggerRect.width / 2 - canvasRect.left;
        const ty = triggerRect.bottom - canvasRect.top;
        const dist = Math.hypot(x - tx, y - ty);
        if (dist < minDist) {
            minDist = dist;
            closest = { nodeId: 'trigger-node', side: 'bottom', x: tx, y: ty, distance: dist };
        }
    }

    // Check all nodes for available connectors
    canvasNodes.forEach(nodeData => {
        if (nodeData.id === excludeNodeId) return;

        const sides = ['top', 'bottom', 'left', 'right'];
        sides.forEach(side => {
            // Skip if this specific connector side is already used
            if (isConnectorUsed(nodeData.id, side)) return;

            const pos = getConnectorPos(nodeData.id, side);
            if (pos) {
                const dist = Math.hypot(x - pos.x, y - pos.y);
                if (dist < minDist) {
                    minDist = dist;
                    closest = { nodeId: nodeData.id, side, x: pos.x, y: pos.y, distance: dist };
                }
            }
        });
    });

    return closest;
}

// Create a node on the canvas
function createNode(blockType, x, y) {
    const canvas = document.querySelector('.deo-canvas');
    if (!canvas) return null;

    const nodeId = `node-${++nodeIdCounter}`;
    const node = document.createElement('div');
    node.className = 'flow-node';
    node.dataset.nodeId = nodeId;
    node.dataset.nodeType = blockType;

    node.style.left = `${x - 100}px`;
    node.style.top = `${y - 22}px`;

    const icons = {
        message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>',
        await: '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>',
        response: '<polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>'
    };

    const labels = {
        message: 'Message',
        await: 'Await',
        response: 'Response'
    };

    const defaultLabels = {
        message: 'Channel',
        await: '24h',
        response: 'Response'
    };

    // Generate config popup HTML based on block type
    let configPopupHtml = '';

    if (blockType === 'message') {
        configPopupHtml = `
            <div class="block-config-popup">
                <div class="block-config-title">Message Configuration</div>
                <div class="block-config-modes">
                    <div class="block-config-mode selected" data-mode="channel">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M4 9l16 0"></path>
                            <path d="M4 15l16 0"></path>
                            <path d="M10 3l-2 18"></path>
                            <path d="M16 3l-2 18"></path>
                        </svg>
                        <span>Channel</span>
                    </div>
                    <div class="block-config-mode" data-mode="users">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                        <span>Users</span>
                    </div>
                </div>
                <div class="block-config-row config-channel-row">
                    <div class="block-config-label">Channel Name</div>
                    <input type="text" class="block-config-input config-channel-input" placeholder="general">
                </div>
                <div class="block-config-row config-users-row" style="display: none;">
                    <div class="block-config-label">User IDs (comma-separated)</div>
                    <input type="text" class="block-config-input config-users-input" placeholder="U123, U456">
                </div>
                <div class="block-config-row">
                    <div class="block-config-label">Message</div>
                    <textarea class="block-config-textarea config-message-input" placeholder="Enter your message..."></textarea>
                </div>
            </div>
        `;
    } else if (blockType === 'await') {
        configPopupHtml = `
            <div class="block-config-popup">
                <div class="block-config-title">Await Configuration</div>
                <div class="block-config-row">
                    <div class="block-config-label">Expected Response</div>
                    <input type="text" class="block-config-input config-expected-response-input" placeholder="e.g., yes, approve, done">
                </div>
                <div class="block-config-row">
                    <div class="block-config-label">Timeout</div>
                    <select class="block-config-select config-timeout-select">
                        <option value="1h">1 hour</option>
                        <option value="6h">6 hours</option>
                        <option value="12h">12 hours</option>
                        <option value="24h" selected>24 hours</option>
                        <option value="48h">48 hours</option>
                        <option value="72h">72 hours</option>
                        <option value="7d">7 days</option>
                    </select>
                </div>
                <div class="block-config-row">
                    <div class="block-config-label">Timeout Message</div>
                    <textarea class="block-config-textarea config-failure-message-input" placeholder="Message to send if no response..."></textarea>
                </div>
            </div>
        `;
    } else if (blockType === 'response') {
        configPopupHtml = `
            <div class="block-config-popup">
                <div class="block-config-title">Response Configuration</div>
                <div class="block-config-row">
                    <div class="block-config-label">Success Message</div>
                    <textarea class="block-config-textarea config-response-input" placeholder="Message to send on success..."></textarea>
                </div>
            </div>
        `;
    }

    node.innerHTML = `
        <div class="flow-node-connector top" data-connector="top" data-node-id="${nodeId}"></div>
        <div class="flow-node-connector left" data-connector="left" data-node-id="${nodeId}"></div>
        <div class="flow-node-header">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${icons[blockType]}</svg>
            <span>${labels[blockType]}</span>
            <span class="block-type-label">${defaultLabels[blockType]}</span>
            <button class="flow-node-delete" data-node-id="${nodeId}">&times;</button>
        </div>
        <div class="flow-node-connector right" data-connector="right" data-node-id="${nodeId}"></div>
        <div class="flow-node-connector bottom" data-connector="bottom" data-node-id="${nodeId}"></div>
        ${configPopupHtml}
    `;

    canvas.appendChild(node);
    makeNodeDraggable(node);

    // Initialize config for this node
    initNodeConfig(nodeId, blockType);

    canvasNodes.push({
        id: nodeId,
        type: blockType,
        element: node
    });

    return node;
}

// Get connector position
function getConnectorPos(nodeId, side) {
    const canvas = document.querySelector('.deo-canvas');
    if (!canvas) return null;
    const canvasRect = canvas.getBoundingClientRect();

    let node, nodeRect;
    if (nodeId === 'trigger-node') {
        node = document.getElementById('trigger-node');
        if (!node) return null;
        nodeRect = node.getBoundingClientRect();
        return {
            x: nodeRect.left + nodeRect.width / 2 - canvasRect.left,
            y: nodeRect.bottom - canvasRect.top
        };
    }

    node = document.querySelector(`[data-node-id="${nodeId}"]`);
    if (!node) return null;
    nodeRect = node.getBoundingClientRect();

    switch (side) {
        case 'top':
            return { x: nodeRect.left + nodeRect.width / 2 - canvasRect.left, y: nodeRect.top - canvasRect.top };
        case 'bottom':
            return { x: nodeRect.left + nodeRect.width / 2 - canvasRect.left, y: nodeRect.bottom - canvasRect.top };
        case 'left':
            return { x: nodeRect.left - canvasRect.left, y: nodeRect.top + nodeRect.height / 2 - canvasRect.top };
        case 'right':
            return { x: nodeRect.right - canvasRect.left, y: nodeRect.top + nodeRect.height / 2 - canvasRect.top };
    }
    return null;
}

// Find closest connector (for manual connection dragging)
function findClosestConnector(x, y, excludeNodeId = null) {
    const canvas = document.querySelector('.deo-canvas');
    if (!canvas) return null;
    const canvasRect = canvas.getBoundingClientRect();
    let closest = null;
    let minDist = Infinity;

    // Check trigger node bottom connector
    const trigger = document.getElementById('trigger-node');
    if (trigger && excludeNodeId !== 'trigger-node') {
        const triggerRect = trigger.getBoundingClientRect();
        const tx = triggerRect.left + triggerRect.width / 2 - canvasRect.left;
        const ty = triggerRect.bottom - canvasRect.top;
        const dist = Math.hypot(x - tx, y - ty);
        if (dist < minDist) {
            minDist = dist;
            closest = { nodeId: 'trigger-node', side: 'bottom', x: tx, y: ty, distance: dist };
        }
    }

    // Check all node connectors
    canvasNodes.forEach(nodeData => {
        if (nodeData.id === excludeNodeId) return;

        const sides = ['top', 'bottom', 'left', 'right'];
        sides.forEach(side => {
            const pos = getConnectorPos(nodeData.id, side);
            if (pos) {
                const dist = Math.hypot(x - pos.x, y - pos.y);
                if (dist < minDist) {
                    minDist = dist;
                    closest = { nodeId: nodeData.id, side, x: pos.x, y: pos.y, distance: dist };
                }
            }
        });
    });

    return closest;
}

// Auto-connect node to closest available connector (with threshold)
// Rules:
// - Find closest connector that is NOT already used
// - The dragged node's connector side we want to use is the opposite of the target
// - If dragged node's connector side is already used as OUTPUT, we can't connect there
// - Remove ALL incoming connections to this node (a node can only have one parent connection when auto-connecting)
// - If there's already ANY connection between these two nodes, remove it first (only one connection per node pair)
function autoConnectNode(newNode) {
    const nodeId = newNode.dataset.nodeId;
    const nodeRect = newNode.getBoundingClientRect();
    const canvas = document.querySelector('.deo-canvas');
    const canvasRect = canvas.getBoundingClientRect();

    const nodeCenterX = nodeRect.left + nodeRect.width / 2 - canvasRect.left;
    const nodeCenterY = nodeRect.top + nodeRect.height / 2 - canvasRect.top;

    // Find closest available connector within threshold
    const closest = findClosestAvailableConnector(nodeCenterX, nodeCenterY, nodeId);

    if (closest && closest.distance < CONNECTION_THRESHOLD) {
        const newNodeSide = getOppositeSide(closest.side);

        // Check if this node's connector side is used as an OUTGOING connection
        const usedAsOutput = connections.some(c =>
            c.from.nodeId === nodeId && c.from.side === newNodeSide
        );

        // If this side is used as output, we can't receive an incoming connection there
        if (usedAsOutput) return;

        // Remove ALL incoming connections to this node (dragging updates the parent)
        connections = connections.filter(c => c.to.nodeId !== nodeId);

        // Also remove any connection where this node outputs TO the target (only one connection per pair)
        connections = connections.filter(c =>
            !(c.from.nodeId === nodeId && c.to.nodeId === closest.nodeId)
        );

        connections.push({
            from: { nodeId: closest.nodeId, side: closest.side },
            to: { nodeId: nodeId, side: newNodeSide }
        });

        updateConnectorStates();
    }
}

// Update connector visual states
function updateConnectorStates() {
    document.querySelectorAll('.flow-node-connector').forEach(c => c.classList.remove('connected'));

    connections.forEach(conn => {
        if (conn.from.nodeId === 'trigger-node') {
            const trigger = document.getElementById('trigger-node');
            trigger?.querySelector('.flow-node-connector')?.classList.add('connected');
        } else {
            const fromNode = document.querySelector(`[data-node-id="${conn.from.nodeId}"]`);
            fromNode?.querySelector(`[data-connector="${conn.from.side}"]`)?.classList.add('connected');
        }

        const toNode = document.querySelector(`[data-node-id="${conn.to.nodeId}"]`);
        toNode?.querySelector(`[data-connector="${conn.to.side}"]`)?.classList.add('connected');
    });
}

// Make nodes draggable within canvas
function makeNodeDraggable(node) {
    let isDragging = false;
    let startX, startY, initialX, initialY;

    node.addEventListener('mousedown', (e) => {
        // Don't start drag when clicking on delete button, connector, or config popup
        if (e.target.closest('.flow-node-delete') ||
            e.target.closest('.flow-node-connector') ||
            e.target.closest('.block-config-popup')) return;

        isDragging = true;
        draggingNode = node;
        node.classList.add('dragging');

        startX = e.clientX;
        startY = e.clientY;
        initialX = node.offsetLeft;
        initialY = node.offsetTop;

        e.preventDefault();
    });

    const onMouseMove = (e) => {
        if (!isDragging) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        node.style.left = `${initialX + dx}px`;
        node.style.top = `${initialY + dy}px`;

        // Show preview for potential new connection
        const nodeId = node.dataset.nodeId;
        const canvas = document.querySelector('.deo-canvas');
        const canvasRect = canvas.getBoundingClientRect();
        const nodeRect = node.getBoundingClientRect();
        const nodeCenterX = nodeRect.left + nodeRect.width / 2 - canvasRect.left;
        const nodeCenterY = nodeRect.top + nodeRect.height / 2 - canvasRect.top;

        showNodeDragPreview(nodeId, nodeCenterX, nodeCenterY);

        renderConnections();
    };

    const onMouseUp = () => {
        if (isDragging) {
            isDragging = false;
            draggingNode = null;
            node.classList.remove('dragging');

            // Try to connect within threshold (will replace existing connection)
            autoConnectNode(node);

            removePreviewLine();
            renderConnections();
        }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

// Show preview line while dragging existing node
function showNodeDragPreview(nodeId, nodeCenterX, nodeCenterY) {
    const closest = findClosestAvailableConnector(nodeCenterX, nodeCenterY, nodeId);

    if (closest && closest.distance < CONNECTION_THRESHOLD) {
        const canvas = document.querySelector('.deo-canvas');
        let svg = canvas.querySelector('.connections-svg');
        if (!svg) {
            svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.classList.add('connections-svg');
            canvas.insertBefore(svg, canvas.firstChild);
        }

        if (!previewLine) {
            previewLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            previewLine.classList.add('connection-line', 'preview');
            svg.appendChild(previewLine);
        }

        const newNodeSide = getOppositeSide(closest.side);
        const fromPos = getConnectorPos(closest.nodeId, closest.side);
        const toPos = getConnectorPos(nodeId, newNodeSide);

        if (fromPos && toPos) {
            const path = createCurvedPath(fromPos.x, fromPos.y, toPos.x, toPos.y, closest.side, newNodeSide);
            previewLine.setAttribute('d', path);
        }
    } else {
        removePreviewLine();
    }
}

// Connection dragging from connectors
document.addEventListener('mousedown', (e) => {
    const connector = e.target.closest('.flow-node-connector');
    if (!connector) return;

    e.preventDefault();
    e.stopPropagation();

    const nodeId = connector.dataset.nodeId || (connector.closest('.trigger-node') ? 'trigger-node' : null);
    const side = connector.dataset.connector;

    if (!nodeId) return;

    isConnecting = true;
    connectionStart = { nodeId, side, element: connector };
    connector.classList.add('active');

    const canvas = document.querySelector('.deo-canvas');
    let svg = canvas.querySelector('.connections-svg');
    if (!svg) {
        svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.classList.add('connections-svg');
        canvas.insertBefore(svg, canvas.firstChild);
    }

    tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    tempLine.classList.add('connection-line', 'temp');
    svg.appendChild(tempLine);
});

document.addEventListener('mousemove', (e) => {
    if (!isConnecting || !tempLine || !connectionStart) return;

    const canvas = document.querySelector('.deo-canvas');
    const canvasRect = canvas.getBoundingClientRect();
    const startPos = getConnectorPos(connectionStart.nodeId, connectionStart.side);

    if (!startPos) return;

    const endX = e.clientX - canvasRect.left;
    const endY = e.clientY - canvasRect.top;

    const path = createCurvedPath(startPos.x, startPos.y, endX, endY, connectionStart.side, null);
    tempLine.setAttribute('d', path);
});

document.addEventListener('mouseup', (e) => {
    if (!isConnecting) return;

    const connector = e.target.closest('.flow-node-connector');

    if (connector && connectionStart) {
        const endNodeId = connector.dataset.nodeId || (connector.closest('.trigger-node') ? 'trigger-node' : null);
        const endSide = connector.dataset.connector;

        if (endNodeId && endNodeId !== connectionStart.nodeId) {
            // Check if source connector side is already used
            const sourceConnectorUsed = isConnectorUsed(connectionStart.nodeId, connectionStart.side);

            // Check if target connector side is already used
            const targetConnectorUsed = isConnectorUsed(endNodeId, endSide);

            // Only allow if both connector sides are free
            if (!sourceConnectorUsed && !targetConnectorUsed) {
                // Remove any existing connection between these two nodes (only one connection per pair)
                connections = connections.filter(c =>
                    !((c.from.nodeId === connectionStart.nodeId && c.to.nodeId === endNodeId) ||
                      (c.from.nodeId === endNodeId && c.to.nodeId === connectionStart.nodeId))
                );

                connections.push({
                    from: { nodeId: connectionStart.nodeId, side: connectionStart.side },
                    to: { nodeId: endNodeId, side: endSide }
                });

                updateConnectorStates();
            }
        }
    }

    if (connectionStart?.element) {
        connectionStart.element.classList.remove('active');
    }
    if (tempLine) {
        tempLine.remove();
        tempLine = null;
    }
    isConnecting = false;
    connectionStart = null;

    renderConnections();
});

// Create curved path between two points
function createCurvedPath(x1, y1, x2, y2, fromSide, toSide) {
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const tension = Math.min(dx, dy, 80);

    let c1x = x1, c1y = y1, c2x = x2, c2y = y2;

    switch (fromSide) {
        case 'top': c1y = y1 - tension; break;
        case 'bottom': c1y = y1 + tension; break;
        case 'left': c1x = x1 - tension; break;
        case 'right': c1x = x1 + tension; break;
    }

    switch (toSide) {
        case 'top': c2y = y2 - tension; break;
        case 'bottom': c2y = y2 + tension; break;
        case 'left': c2x = x2 - tension; break;
        case 'right': c2x = x2 + tension; break;
        default:
            if (fromSide === 'top' || fromSide === 'bottom') {
                c2x = x2;
                c2y = y1 + (y2 - y1) / 2;
            } else {
                c2x = x1 + (x2 - x1) / 2;
                c2y = y2;
            }
    }

    return `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`;
}

// Render all connections
function renderConnections() {
    const canvas = document.querySelector('.deo-canvas');
    if (!canvas) return;

    let svg = canvas.querySelector('.connections-svg');
    if (!svg) {
        svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.classList.add('connections-svg');
        canvas.insertBefore(svg, canvas.firstChild);
    }

    // Keep temp and preview lines
    const existingTemp = svg.querySelector('.temp');
    const existingPreview = svg.querySelector('.preview');
    svg.innerHTML = '';
    if (existingTemp) svg.appendChild(existingTemp);
    if (existingPreview) svg.appendChild(existingPreview);

    connections.forEach((conn, index) => {
        const fromPos = getConnectorPos(conn.from.nodeId, conn.from.side);
        const toPos = getConnectorPos(conn.to.nodeId, conn.to.side);

        if (!fromPos || !toPos) return;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', createCurvedPath(fromPos.x, fromPos.y, toPos.x, toPos.y, conn.from.side, conn.to.side));
        path.classList.add('connection-line');
        path.dataset.connectionIndex = index;
        path.dataset.fromNode = conn.from.nodeId;
        path.dataset.toNode = conn.to.nodeId;
        svg.appendChild(path);
    });
}

// Click on connection line to delete it
document.addEventListener('click', (e) => {
    const connectionLine = e.target.closest('.connection-line:not(.temp):not(.preview)');
    if (connectionLine && connectionLine.dataset.connectionIndex !== undefined) {
        const index = parseInt(connectionLine.dataset.connectionIndex);
        if (!isNaN(index) && index >= 0 && index < connections.length) {
            connections.splice(index, 1);
            updateConnectorStates();
            renderConnections();
        }
        return;
    }
});

// Delete node
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('flow-node-delete')) {
        const nodeId = e.target.dataset.nodeId;
        const node = document.querySelector(`[data-node-id="${nodeId}"]`);
        if (node) {
            node.remove();
            canvasNodes = canvasNodes.filter(n => n.id !== nodeId);
            connections = connections.filter(c => c.from.nodeId !== nodeId && c.to.nodeId !== nodeId);
            delete nodeConfigs[nodeId]; // Clean up node config
            updateConnectorStates();
            renderConnections();

            if (canvasNodes.length === 0) {
                const placeholder = document.querySelector('.canvas-placeholder');
                if (placeholder) placeholder.style.display = 'flex';
            }
        }
    }
});

// Reset canvas
document.addEventListener('click', (e) => {
    if (e.target.id === 'reset-deo-btn') {
        const canvas = document.querySelector('.deo-canvas');
        if (canvas) {
            canvas.querySelectorAll('.flow-node').forEach(n => n.remove());

            const svg = canvas.querySelector('.connections-svg');
            if (svg) svg.innerHTML = '';

            const placeholder = canvas.querySelector('.canvas-placeholder');
            if (placeholder) placeholder.style.display = 'flex';

            canvasNodes = [];
            connections = [];
            nodeConfigs = {}; // Clear all node configs
            nodeIdCounter = 0;
            updateConnectorStates();

            // Reset save button state
            const saveBtn = document.getElementById('save-deo-btn');
            if (saveBtn) {
                saveBtn.textContent = 'Save';
                saveBtn.disabled = false;
            }

            // Reset template name input
            const templateNameInput = document.getElementById('template-name-input');
            if (templateNameInput) {
                templateNameInput.value = '';
            }

            // Reset workspace selection
            selectedCanvasWorkspace = null;
            const workspaceNameSpan = document.getElementById('selected-workspace-name');
            if (workspaceNameSpan) {
                workspaceNameSpan.textContent = 'Select Workspace';
            }

            // Reset trigger config
            triggerConfig = { type: 'manual', schedule: null };
            selectTriggerType('manual');
        }
    }
});

// === SAVE TEMPLATE ===

// Traverse connections from trigger to get ordered blocks
// Uses BFS with priority: bottom -> right -> left
// This ensures ALL connected nodes are found, not just one linear path
function getOrderedBlocks() {
    const orderedBlocks = [];
    const visited = new Set();

    // Queue for BFS: each item has nodeId
    // We process nodes in order, but for each node we check connections with priority
    const queue = ['trigger-node'];
    visited.add('trigger-node');

    while (queue.length > 0) {
        const currentNodeId = queue.shift();

        // Find all outgoing connections from current node, sorted by priority
        const priorities = ['bottom', 'right', 'left'];

        for (const side of priorities) {
            // Find connection from this side
            const conn = connections.find(c =>
                c.from.nodeId === currentNodeId &&
                c.from.side === side &&
                !visited.has(c.to.nodeId)
            );

            if (conn) {
                const nextNodeId = conn.to.nodeId;
                const nodeData = canvasNodes.find(n => n.id === nextNodeId);

                if (nodeData) {
                    orderedBlocks.push({
                        nodeId: nextNodeId,
                        type: nodeData.type,
                        config: nodeConfigs[nextNodeId] || {}
                    });
                    visited.add(nextNodeId);
                    queue.push(nextNodeId);
                }
            }
        }
    }

    return orderedBlocks;
}

// Build template payload from canvas state
function buildTemplatePayload() {
    const templateName = document.getElementById('template-name-input')?.value?.trim();
    const workspaceId = selectedCanvasWorkspace;

    // Validation
    if (!templateName) {
        return { error: 'Please enter a template name' };
    }
    if (!workspaceId) {
        return { error: 'Please select a workspace' };
    }

    // Get ordered blocks
    const orderedBlocks = getOrderedBlocks();

    if (orderedBlocks.length === 0) {
        return { error: 'Please add at least one block connected to the trigger' };
    }

    // Extract block types for the blocks array
    const blockTypes = orderedBlocks.map(b => b.type);

    // Find specific block configs
    const messageBlock = orderedBlocks.find(b => b.type === 'message');
    const awaitBlock = orderedBlocks.find(b => b.type === 'await');
    const responseBlock = orderedBlocks.find(b => b.type === 'response');

    // Validate required blocks
    if (!messageBlock) {
        return { error: 'Template requires a Message block' };
    }
    if (!responseBlock) {
        return { error: 'Template requires a Response block' };
    }

    // Build message config
    const msgConfig = messageBlock.config;
    if (!msgConfig.message) {
        return { error: 'Message block requires a message' };
    }

    const messagePayload = { message: msgConfig.message };
    if (msgConfig.mode === 'channel') {
        if (!msgConfig.channel_name) {
            return { error: 'Message block requires a channel name' };
        }
        messagePayload.channel_name = msgConfig.channel_name;
    } else {
        if (!msgConfig.users) {
            return { error: 'Message block requires user IDs' };
        }
        messagePayload.users = msgConfig.users.split(',').map(u => u.trim()).filter(u => u);
    }

    // Build trigger config
    let triggerPayload;
    if (triggerConfig.type === 'manual') {
        triggerPayload = 'manual';
    } else {
        triggerPayload = {
            type: 'schedule',
            schedule: triggerConfig.schedule
        };
    }

    // Build response
    const respConfig = responseBlock.config;
    if (!respConfig.message) {
        return { error: 'Response block requires a message' };
    }

    // Build payload
    const payload = {
        template_id: templateName,
        workspace_id: workspaceId,
        action_chain: {
            blocks: blockTypes,
            trigger: triggerPayload,
            message: messagePayload,
            response: respConfig.message
        }
    };

    // Add await config if present
    if (awaitBlock) {
        const awaitConfig = awaitBlock.config;
        payload.action_chain.await = {
            expected_response: awaitConfig.expected_response || '',
            timeout: awaitConfig.timeout || '24h',
            failure_message: awaitConfig.failure_message || ''
        };
    }

    return { payload };
}

// Save button handler
document.addEventListener('click', async (e) => {
    if (e.target.id === 'save-deo-btn') {
        const btn = e.target;
        const originalText = btn.textContent;

        // Build payload
        const result = buildTemplatePayload();

        if (result.error) {
            alert(result.error);
            return;
        }

        // Disable button and show loading
        btn.disabled = true;
        btn.textContent = 'Saving...';

        try {
            const res = await fetch('/templates/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(result.payload)
            });

            const data = await res.json();

            if (res.ok && data.success) {
                // Success - show message and redirect
                btn.textContent = 'Saved!';

                // Refresh templates sidebar if function exists
                if (typeof loadTemplatesSidebar === 'function') {
                    loadTemplatesSidebar(selectedCanvasWorkspace);
                }
                if (typeof loadTemplateEmptyList === 'function') {
                    loadTemplateEmptyList(selectedCanvasWorkspace);
                }

                // Redirect to templates view after short delay
                setTimeout(() => {
                    window.location.hash = '#templates';
                }, 500);
            } else {
                alert(data.detail || 'Failed to save template');
                btn.textContent = originalText;
                btn.disabled = false;
            }
        } catch (err) {
            console.error('Save error:', err);
            alert('Error saving template');
            btn.textContent = originalText;
            btn.disabled = false;
        }
    }
});