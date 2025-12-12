// === TEMPLATE FUNCTIONS ===

// Store current template data for diagram rendering
let currentTemplateData = null;

// === CANVAS ZOOM ===
let canvasZoom = 1;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.1;
const ZOOM_WHEEL_SENSITIVITY = 0.002; // Lower = less sensitive
let lastWheelZoom = 0;

// === CANVAS PANNING ===
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let panOffsetX = 0;  // Current pan offset
let panOffsetY = 0;
let panStartOffsetX = 0;  // Offset when pan started
let panStartOffsetY = 0;

function updateCanvasTransform() {
    const canvasContent = document.querySelector('.deo-canvas-content');
    const canvas = document.querySelector('.deo-canvas');
    if (canvasContent) {
        canvasContent.style.transform = `translate(${panOffsetX}px, ${panOffsetY}px) scale(${canvasZoom})`;
        canvasContent.style.transformOrigin = 'top left';
    }
    // Update background position to move with pan (creates parallax effect)
    if (canvas) {
        canvas.style.backgroundPosition = `${panOffsetX}px ${panOffsetY}px, ${panOffsetX}px ${panOffsetY}px`;
    }
}

function updateCanvasZoom(newZoom) {
    canvasZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newZoom));
    const zoomLabel = document.getElementById('zoom-level');

    updateCanvasTransform();

    if (zoomLabel) {
        zoomLabel.textContent = `${Math.round(canvasZoom * 100)}%`;
    }

    // Update button states
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    if (zoomInBtn) zoomInBtn.disabled = canvasZoom >= ZOOM_MAX;
    if (zoomOutBtn) zoomOutBtn.disabled = canvasZoom <= ZOOM_MIN;

    // Update connection lines after zoom - wait for CSS transition to complete (150ms)
    // Use 160ms to ensure transform is fully applied
    setTimeout(() => renderConnections(), 160);
}

// Zoom controls event handlers
document.addEventListener('click', (e) => {
    if (e.target.closest('#zoom-in-btn')) {
        updateCanvasZoom(canvasZoom + ZOOM_STEP);
    }
    if (e.target.closest('#zoom-out-btn')) {
        updateCanvasZoom(canvasZoom - ZOOM_STEP);
    }
    if (e.target.closest('#zoom-reset-btn')) {
        // Reset both zoom and pan
        panOffsetX = 0;
        panOffsetY = 0;
        updateCanvasZoom(1);
    }
});

// Mouse wheel zoom (with Ctrl key) - throttled for less sensitivity
document.addEventListener('wheel', (e) => {
    const canvasWrapper = e.target.closest('.deo-canvas-wrapper');
    if (!canvasWrapper) return;

    if (e.ctrlKey) {
        e.preventDefault();

        // Throttle wheel zoom events (50ms minimum between zooms)
        const now = Date.now();
        if (now - lastWheelZoom < 50) return;
        lastWheelZoom = now;

        // Use smaller delta for smoother, less sensitive zoom
        const delta = -e.deltaY * ZOOM_WHEEL_SENSITIVITY;
        updateCanvasZoom(canvasZoom + delta);
    }
}, { passive: false });

// === CANVAS PANNING (click and drag to move content) ===
document.addEventListener('mousedown', (e) => {
    const canvasWrapper = e.target.closest('.deo-canvas-wrapper');
    if (!canvasWrapper) return;

    // Only start panning if clicking directly on canvas background (not on nodes, connectors, etc.)
    const isCanvasBackground = e.target.closest('.deo-canvas') &&
        !e.target.closest('.flow-node') &&
        !e.target.closest('.trigger-node') &&
        !e.target.closest('.flow-node-connector') &&
        !e.target.closest('.block-config-popup') &&
        !e.target.closest('.trigger-config-popup') &&
        !e.target.closest('.canvas-zoom-controls');

    if (!isCanvasBackground) return;

    isPanning = true;
    panStartX = e.clientX;
    panStartY = e.clientY;
    panStartOffsetX = panOffsetX;
    panStartOffsetY = panOffsetY;

    // Change cursor to grabbing
    canvasWrapper.style.cursor = 'grabbing';

    // Disable transition during drag for smooth movement
    const canvasContent = document.querySelector('.deo-canvas-content');
    if (canvasContent) {
        canvasContent.style.transition = 'none';
    }

    e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
    if (!isPanning) return;

    const dx = e.clientX - panStartX;
    const dy = e.clientY - panStartY;

    // Update pan offset - dragging left moves content left, etc.
    panOffsetX = panStartOffsetX + dx;
    panOffsetY = panStartOffsetY + dy;

    updateCanvasTransform();

    // Update connections in real-time during pan
    renderConnections();
});

document.addEventListener('mouseup', () => {
    if (isPanning) {
        isPanning = false;
        const canvasWrapper = document.querySelector('.deo-canvas-wrapper');
        if (canvasWrapper) {
            canvasWrapper.style.cursor = '';
        }

        // Re-enable transition after drag
        const canvasContent = document.querySelector('.deo-canvas-content');
        if (canvasContent) {
            canvasContent.style.transition = 'transform 0.15s ease';
        }
    }
});

// Load template details by ID
async function loadTemplateDetails(templateId) {
    try {
        const res = await fetch(`/templates/by-id/${encodeURIComponent(templateId)}`);
        const data = await res.json();

        if (res.ok && data.success) {
            const t = data.template;
            const ac = t.action_chain || {};

            // Store template data for diagram
            currentTemplateData = t;

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

            // Render diagram view
            renderTemplateDiagram(t);

            // Reset view toggle state (show diagram by default)
            const diagramView = document.getElementById('template-diagram-view');
            const simpleView = document.getElementById('template-simple-view');
            const toggleBtn = document.getElementById('toggle-template-view-btn');
            if (diagramView) diagramView.style.display = 'block';
            if (simpleView) simpleView.style.display = 'none';
            if (toggleBtn) toggleBtn.textContent = 'Simplify';

        } else {
            const subtitle = document.getElementById('template-subtitle');
            if (subtitle) subtitle.textContent = 'Template not found';
        }
    } catch (err) {
        const subtitle = document.getElementById('template-subtitle');
        if (subtitle) subtitle.textContent = 'Error loading template';
    }
}

// Render template as a read-only diagram
function renderTemplateDiagram(template) {
    const canvas = document.getElementById('template-diagram-canvas');
    if (!canvas) return;

    const ac = template.action_chain || {};
    const blocks = ac.blocks || [];
    const trigger = ac.trigger;
    const canvasLayout = ac.canvas_layout;

    // Clear canvas
    canvas.innerHTML = '';

    // Create SVG for connections
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('diagram-svg');
    canvas.appendChild(svg);

    // Icons for each block type
    const icons = {
        trigger: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>',
        message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>',
        await: '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>',
        response: '<polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>'
    };

    // Get trigger label
    let triggerLabel = 'Manual';
    if (typeof trigger === 'object' && trigger.type === 'schedule') {
        const sched = trigger.schedule || {};
        if (sched.regularity === 'daily') triggerLabel = `Daily at ${sched.time || '09:00'}`;
        else if (sched.regularity === 'weekly') triggerLabel = `Weekly`;
        else if (sched.regularity === 'interval') triggerLabel = `Every ${sched.interval_minutes || 30}m`;
        else triggerLabel = 'Schedule';
    }

    // Check if we have canvas layout (NEW FORMAT with positions)
    if (canvasLayout && canvasLayout.nodes && canvasLayout.nodes.length > 0) {
        // Render using saved canvas layout
        renderDiagramFromLayout(canvas, svg, canvasLayout, icons, triggerLabel);
    } else {
        // Fall back to simple vertical layout (OLD FORMAT or no layout saved)
        renderDiagramSimple(canvas, svg, blocks, ac, icons, triggerLabel);
    }
}

// Render diagram from saved canvas layout (matches the canvas exactly)
function renderDiagramFromLayout(canvas, svg, layout, icons, triggerLabel) {
    const nodes = layout.nodes || [];
    const connections = layout.connections || [];
    const nodeConfigs = layout.nodeConfigs || {};

    // Create trigger node (always at a fixed position at top)
    const triggerNode = document.createElement('div');
    triggerNode.className = 'diagram-node diagram-trigger';
    triggerNode.id = 'diagram-trigger-node';
    triggerNode.innerHTML = `
        <div class="diagram-node-header">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${icons.trigger}</svg>
            <span class="node-title">Trigger</span>
            <span class="node-label">${triggerLabel}</span>
        </div>
        <div class="diagram-connector bottom"></div>
    `;
    canvas.appendChild(triggerNode);

    // Create a map of node IDs to their DOM elements
    const nodeElements = {};
    nodeElements['trigger-node'] = triggerNode;

    // Create block nodes at their saved positions
    nodes.forEach(nodeData => {
        const node = document.createElement('div');
        node.className = 'diagram-node';
        node.dataset.nodeId = nodeData.id;

        // Position the node
        node.style.left = `${nodeData.x}px`;
        node.style.top = `${nodeData.y}px`;
        node.style.position = 'absolute';

        // Get config for this node
        const config = nodeConfigs[nodeData.id] || {};
        let label = '';
        let bodyContent = '';

        if (nodeData.type === 'message') {
            if (config.mode === 'channel' && config.channel_name) {
                label = `#${config.channel_name}`;
            } else if (config.mode === 'users' && config.users) {
                const userCount = config.users.split(',').filter(u => u.trim()).length;
                label = `${userCount} user(s)`;
            } else {
                label = 'Channel';
            }
            bodyContent = config.message ? (config.message.length > 40 ? config.message.substring(0, 40) + '...' : config.message) : '';
        } else if (nodeData.type === 'await') {
            label = config.timeout || '24h';
            bodyContent = config.expected_response ? `Wait for: "${config.expected_response}"` : '';
        } else if (nodeData.type === 'response') {
            label = 'Success';
            bodyContent = config.message ? (config.message.length > 40 ? config.message.substring(0, 40) + '...' : config.message) : '';
        }

        node.innerHTML = `
            <div class="diagram-connector top"></div>
            <div class="diagram-node-header">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${icons[nodeData.type] || ''}</svg>
                <span class="node-title">${nodeData.type.charAt(0).toUpperCase() + nodeData.type.slice(1)}</span>
                <span class="node-label">${label}</span>
            </div>
            ${bodyContent ? `<div class="diagram-node-body">${bodyContent}</div>` : ''}
            <div class="diagram-connector bottom"></div>
            <div class="diagram-connector left"></div>
            <div class="diagram-connector right"></div>
        `;

        canvas.appendChild(node);
        nodeElements[nodeData.id] = node;
    });

    // Draw connections after nodes are rendered
    setTimeout(() => {
        drawDiagramConnectionsFromLayout(canvas, svg, connections, nodeElements);
    }, 10);
}

// Draw connections from saved layout data
function drawDiagramConnectionsFromLayout(canvas, svg, connections, nodeElements) {
    svg.innerHTML = '';
    const canvasRect = canvas.getBoundingClientRect();

    connections.forEach(conn => {
        const fromNode = nodeElements[conn.from.nodeId];
        const toNode = nodeElements[conn.to.nodeId];

        if (!fromNode || !toNode) return;

        const fromPos = getDiagramConnectorPos(fromNode, conn.from.side, canvasRect, conn.from.nodeId);
        const toPos = getDiagramConnectorPos(toNode, conn.to.side, canvasRect, conn.to.nodeId);

        if (!fromPos || !toPos) return;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', createDiagramCurvedPath(fromPos.x, fromPos.y, toPos.x, toPos.y, conn.from.side, conn.to.side));
        path.classList.add('diagram-line');
        svg.appendChild(path);
    });
}

// Get connector position for diagram nodes
function getDiagramConnectorPos(node, side, canvasRect, nodeId) {
    const nodeRect = node.getBoundingClientRect();

    // Trigger node only has bottom connector
    if (nodeId === 'trigger-node') {
        return {
            x: nodeRect.left + nodeRect.width / 2 - canvasRect.left,
            y: nodeRect.bottom - canvasRect.top
        };
    }

    switch (side) {
        case 'top':
            return { x: nodeRect.left + nodeRect.width / 2 - canvasRect.left, y: nodeRect.top - canvasRect.top };
        case 'bottom':
            return { x: nodeRect.left + nodeRect.width / 2 - canvasRect.left, y: nodeRect.bottom - canvasRect.top };
        case 'left':
            return { x: nodeRect.left - canvasRect.left, y: nodeRect.top + nodeRect.height / 2 - canvasRect.top };
        case 'right':
            return { x: nodeRect.right - canvasRect.left, y: nodeRect.top + nodeRect.height / 2 - canvasRect.top };
        default:
            return null;
    }
}

// Create curved path for diagram connections
function createDiagramCurvedPath(x1, y1, x2, y2, fromSide, toSide) {
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const curvature = Math.min(50, Math.max(dx, dy) * 0.3);

    let cp1x, cp1y, cp2x, cp2y;

    switch (fromSide) {
        case 'bottom':
            cp1x = x1; cp1y = y1 + curvature;
            break;
        case 'top':
            cp1x = x1; cp1y = y1 - curvature;
            break;
        case 'right':
            cp1x = x1 + curvature; cp1y = y1;
            break;
        case 'left':
            cp1x = x1 - curvature; cp1y = y1;
            break;
        default:
            cp1x = x1; cp1y = y1 + curvature;
    }

    switch (toSide) {
        case 'top':
            cp2x = x2; cp2y = y2 - curvature;
            break;
        case 'bottom':
            cp2x = x2; cp2y = y2 + curvature;
            break;
        case 'left':
            cp2x = x2 - curvature; cp2y = y2;
            break;
        case 'right':
            cp2x = x2 + curvature; cp2y = y2;
            break;
        default:
            cp2x = x2; cp2y = y2 - curvature;
    }

    return `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
}

// Render simple vertical layout (fallback for old format or no layout)
function renderDiagramSimple(canvas, svg, blocks, ac, icons, triggerLabel) {
    const msg = ac.message || {};
    const awaitConfig = ac.await || {};

    // Create trigger node
    const triggerNode = document.createElement('div');
    triggerNode.className = 'diagram-node diagram-trigger';
    triggerNode.innerHTML = `
        <div class="diagram-node-header">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${icons.trigger}</svg>
            <span class="node-title">Trigger</span>
            <span class="node-label">${triggerLabel}</span>
        </div>
        <div class="diagram-connector bottom"></div>
    `;
    canvas.appendChild(triggerNode);

    // Calculate positions for blocks (vertical layout)
    const startY = 100;
    const nodeSpacing = 100;
    const centerX = canvas.offsetWidth / 2;

    // Handle both NEW format (objects with type/config) and OLD format (strings)
    blocks.forEach((blockEntry, index) => {
        const blockType = typeof blockEntry === 'string' ? blockEntry : blockEntry.type;
        const blockConfig = typeof blockEntry === 'object' ? blockEntry.config : null;

        const node = document.createElement('div');
        node.className = 'diagram-node';

        const y = startY + (index * nodeSpacing);
        node.style.left = `${centerX - 90}px`;
        node.style.top = `${y}px`;

        let label = '';
        let bodyContent = '';

        if (blockType === 'message') {
            // Use inline config if available (new format), otherwise use shared config (old format)
            const msgConfig = blockConfig || msg;
            if (msgConfig.channel_name) {
                label = `#${msgConfig.channel_name}`;
            } else if (msgConfig.users && msgConfig.users.length) {
                const userCount = Array.isArray(msgConfig.users) ? msgConfig.users.length : 1;
                label = `${userCount} user(s)`;
            } else {
                label = 'Message';
            }
            const msgText = msgConfig.message || '';
            bodyContent = msgText ? (msgText.length > 50 ? msgText.substring(0, 50) + '...' : msgText) : '';
        } else if (blockType === 'await') {
            const awaitCfg = blockConfig || awaitConfig;
            label = awaitCfg.timeout || '24h';
            bodyContent = awaitCfg.expected_response ? `Wait for: "${awaitCfg.expected_response}"` : '';
        } else if (blockType === 'response') {
            label = 'Success';
            const respMsg = blockConfig ? blockConfig.message : ac.response;
            bodyContent = respMsg ? (respMsg.length > 50 ? respMsg.substring(0, 50) + '...' : respMsg) : '';
        }

        node.innerHTML = `
            <div class="diagram-connector top"></div>
            <div class="diagram-node-header">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${icons[blockType] || ''}</svg>
                <span class="node-title">${blockType.charAt(0).toUpperCase() + blockType.slice(1)}</span>
                <span class="node-label">${label}</span>
            </div>
            ${bodyContent ? `<div class="diagram-node-body">${bodyContent}</div>` : ''}
            ${index < blocks.length - 1 ? '<div class="diagram-connector bottom"></div>' : ''}
        `;

        canvas.appendChild(node);
    });

    // Draw connection lines after nodes are rendered
    setTimeout(() => {
        drawDiagramConnections(canvas, svg);
    }, 10);
}

// Draw connections between diagram nodes
function drawDiagramConnections(canvas, svg) {
    svg.innerHTML = '';

    const triggerNode = canvas.querySelector('.diagram-trigger');
    if (!triggerNode) return;

    const canvasRect = canvas.getBoundingClientRect();
    const triggerRect = triggerNode.getBoundingClientRect();

    // Starting point (trigger bottom connector)
    let prevX = triggerRect.left + triggerRect.width / 2 - canvasRect.left;
    let prevY = triggerRect.bottom - canvasRect.top;

    // Get all non-trigger nodes
    const nodes = canvas.querySelectorAll('.diagram-node:not(.diagram-trigger)');

    nodes.forEach((node) => {
        const nodeRect = node.getBoundingClientRect();
        const nodeX = nodeRect.left + nodeRect.width / 2 - canvasRect.left;
        const nodeY = nodeRect.top - canvasRect.top;

        // Draw line from previous to current
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const midY = prevY + (nodeY - prevY) / 2;
        const d = `M ${prevX} ${prevY} C ${prevX} ${midY}, ${nodeX} ${midY}, ${nodeX} ${nodeY}`;
        line.setAttribute('d', d);
        line.classList.add('diagram-line');
        svg.appendChild(line);

        // Update prev position for next connection
        prevX = nodeX;
        prevY = nodeRect.bottom - canvasRect.top;
    });
}

// Toggle between diagram and simple view
document.addEventListener('click', (e) => {
    if (e.target.id === 'toggle-template-view-btn') {
        const btn = e.target;
        const diagramView = document.getElementById('template-diagram-view');
        const simpleView = document.getElementById('template-simple-view');

        if (!diagramView || !simpleView) return;

        const isDiagramVisible = diagramView.style.display !== 'none';

        if (isDiagramVisible) {
            // Switch to simple view
            diagramView.style.display = 'none';
            simpleView.style.display = 'grid';
            btn.textContent = 'Diagram';
        } else {
            // Switch to diagram view
            diagramView.style.display = 'block';
            simpleView.style.display = 'none';
            btn.textContent = 'Simplify';

            // Re-render diagram in case canvas size changed
            if (currentTemplateData) {
                renderTemplateDiagram(currentTemplateData);
            }
        }
    }
});

// Load templates into sidebar
// If workspaceId is provided, filter by workspace; otherwise load all templates
function loadTemplatesSidebar(workspaceId) {
    const templatesList = document.getElementById('templates-list');
    if (!templatesList) return;

    // Build URL - include workspace filter only if provided
    const url = workspaceId ? `/templates?workspace_id=${workspaceId}` : '/templates';

    fetch(url).then(r => r.json()).then(data => {
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
                loadTemplatesSidebar(); // Refresh all templates
                loadTemplateEmptyList(); // Refresh all templates
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
        // Clear editing mode when creating new template
        editingTemplateId = null;
        window.location.hash = '#new-deo';
        if (typeof setHeaderSection === 'function') setHeaderSection('Canvas');
    }
});

// === EDIT TEMPLATE ===
let editingTemplateId = null; // Track if we're editing an existing template

// Edit template button
document.addEventListener('click', async (e) => {
    if (e.target.closest('#update-template-btn')) {
        const btn = e.target.closest('#update-template-btn');
        const runBtn = document.getElementById('run-template-btn');
        const templateId = runBtn?.dataset.templateId;

        if (!templateId || !currentTemplateData) return;

        // Navigate to canvas and load template data
        window.location.hash = '#new-deo';
        if (typeof setHeaderSection === 'function') setHeaderSection('Canvas');

        // Wait for canvas to be ready, then load template
        setTimeout(() => {
            loadTemplateIntoCanvas(currentTemplateData);
        }, 100);
    }
});

// Load template data into the canvas for editing
async function loadTemplateIntoCanvas(template) {
    const canvasContent = document.querySelector('.deo-canvas-content');
    if (!canvasContent) return;

    // Set editing mode
    editingTemplateId = template.template_id;

    // Reset canvas first
    const placeholder = canvasContent.querySelector('.canvas-placeholder');
    if (placeholder) placeholder.style.display = 'none';

    // Clear existing nodes (but keep trigger)
    canvasContent.querySelectorAll('.flow-node').forEach(n => n.remove());
    canvasNodes = [];
    connections = [];
    nodeConfigs = {};
    nodeIdCounter = 0;

    // Set template name (disable input in edit mode since template_id can't change)
    const templateNameInput = document.getElementById('template-name-input');
    if (templateNameInput) {
        templateNameInput.value = template.template_id;
        templateNameInput.disabled = true;
        templateNameInput.style.opacity = '0.7';
        templateNameInput.title = 'Template name cannot be changed when editing';
    }

    // Set workspace
    const workspaceId = template.workspace_id;
    selectedCanvasWorkspace = workspaceId;
    const workspaceNameSpan = document.getElementById('selected-workspace-name');
    if (workspaceNameSpan) {
        // Try to get workspace name from dropdown or just show ID
        const dropdownItem = document.querySelector(`.workspace-dropdown-item[data-workspace-id="${workspaceId}"]`);
        if (dropdownItem) {
            workspaceNameSpan.textContent = dropdownItem.dataset.workspaceName;
        } else {
            workspaceNameSpan.textContent = workspaceId;
        }
    }

    const ac = template.action_chain || {};

    // Set trigger configuration
    const trigger = ac.trigger;
    if (typeof trigger === 'object' && trigger.type === 'schedule') {
        triggerConfig.type = 'schedule';
        triggerConfig.schedule = trigger.schedule || {};

        // Update trigger UI
        selectTriggerType('schedule');

        // Set schedule form values
        const sched = trigger.schedule || {};
        const regularitySelect = document.getElementById('trigger-schedule-regularity');
        if (regularitySelect && sched.regularity) {
            regularitySelect.value = sched.regularity;
            // Trigger change to show correct fields
            regularitySelect.dispatchEvent(new Event('change'));
        }

        const timeInput = document.getElementById('trigger-schedule-time');
        if (timeInput && sched.time) timeInput.value = sched.time;

        const dayWeekSelect = document.getElementById('trigger-schedule-day-week');
        if (dayWeekSelect && sched.day_of_week !== undefined) dayWeekSelect.value = sched.day_of_week;

        const dayMonthInput = document.getElementById('trigger-schedule-day-month');
        if (dayMonthInput && sched.day_of_month) dayMonthInput.value = sched.day_of_month;

        const intervalInput = document.getElementById('trigger-schedule-interval');
        if (intervalInput && sched.interval_minutes) intervalInput.value = sched.interval_minutes;

        updateScheduleConfig();
    } else {
        triggerConfig.type = 'manual';
        triggerConfig.schedule = null;
        selectTriggerType('manual');
    }

    // Create nodes for each block
    // Support both NEW FORMAT (blocks with inline config) and OLD FORMAT (strings)
    const blocks = ac.blocks || [];

    // Detect format: new format has objects with 'type' key
    const isNewFormat = blocks.length > 0 && typeof blocks[0] === 'object' && blocks[0].type;

    // OLD FORMAT fallback configs
    const oldMsg = ac.message || {};
    const oldAwaitConfig = ac.await || {};
    const oldResponseText = ac.response || '';

    // Position nodes vertically below trigger
    const triggerNode = document.getElementById('trigger-node');
    const triggerRect = triggerNode ? triggerNode.getBoundingClientRect() : { left: 300, bottom: 100 };
    const canvasRect = canvas.getBoundingClientRect();

    const startX = triggerRect.left - canvasRect.left + (triggerNode ? triggerNode.offsetWidth / 2 : 100);
    let currentY = 150; // Start below trigger
    const nodeSpacing = 120;

    let previousNodeId = 'trigger-node';

    blocks.forEach((blockEntry, index) => {
        // Handle both formats
        let blockType, blockConfig;
        if (isNewFormat) {
            blockType = blockEntry.type;
            blockConfig = blockEntry.config || {};
        } else {
            blockType = blockEntry;
            // Use old format shared configs
            if (blockType === 'message') blockConfig = oldMsg;
            else if (blockType === 'await') blockConfig = oldAwaitConfig;
            else if (blockType === 'response') blockConfig = { message: oldResponseText };
            else blockConfig = {};
        }

        // Create node
        const newNode = createNode(blockType, startX, currentY);
        if (!newNode) return;

        const nodeId = newNode.dataset.nodeId;

        // Connect to previous node
        connections.push({
            from: { nodeId: previousNodeId, side: 'bottom' },
            to: { nodeId: nodeId, side: 'top' }
        });

        // Set node config based on block type
        if (blockType === 'message') {
            const config = nodeConfigs[nodeId];
            if (blockConfig.channel_name) {
                config.mode = 'channel';
                config.channel_name = blockConfig.channel_name;
                config.message = blockConfig.message || '';

                // Update UI - channel select will be populated when workspace is selected
                const channelSelect = newNode.querySelector('.config-channel-select');
                if (channelSelect) channelSelect.value = blockConfig.channel_name;
                const msgInput = newNode.querySelector('.config-message-input');
                if (msgInput) msgInput.value = blockConfig.message || '';

                selectMessageMode(nodeId, 'channel');
            } else if (blockConfig.users) {
                config.mode = 'users';
                config.users = Array.isArray(blockConfig.users) ? blockConfig.users.join(', ') : blockConfig.users;
                config.message = blockConfig.message || '';

                // Update UI - user multiselect will be populated when workspace is selected
                const msgInput = newNode.querySelector('.config-message-input');
                if (msgInput) msgInput.value = blockConfig.message || '';

                selectMessageMode(nodeId, 'users');
            }
            updateNodeLabel(nodeId);
        } else if (blockType === 'await') {
            const config = nodeConfigs[nodeId];
            config.expected_response = blockConfig.expected_response || '';
            config.timeout = blockConfig.timeout || '24h';
            config.failure_message = blockConfig.failed || blockConfig.failure_message || '';

            // Update UI
            const expectedInput = newNode.querySelector('.config-expected-response-input');
            if (expectedInput) expectedInput.value = config.expected_response;
            const timeoutSelect = newNode.querySelector('.config-timeout-select');
            const customRow = newNode.querySelector('.config-custom-timeout-row');

            // Check if it's a preset value or custom
            const presetValues = ['1h', '6h', '12h', '24h', '48h', '72h', '7d'];
            if (presetValues.includes(config.timeout)) {
                if (timeoutSelect) timeoutSelect.value = config.timeout;
                if (customRow) customRow.style.display = 'none';
            } else {
                // Custom value - parse it
                if (timeoutSelect) timeoutSelect.value = 'custom';
                if (customRow) customRow.style.display = 'block';
                const match = config.timeout.match(/^(\d+)(m|h|d)$/);
                if (match) {
                    const valueInput = newNode.querySelector('.config-custom-timeout-value');
                    const unitSelect = newNode.querySelector('.config-custom-timeout-unit');
                    if (valueInput) valueInput.value = match[1];
                    if (unitSelect) unitSelect.value = match[2];
                }
            }

            const failureInput = newNode.querySelector('.config-failure-message-input');
            if (failureInput) failureInput.value = config.failure_message;

            updateNodeLabel(nodeId);
        } else if (blockType === 'response') {
            const config = nodeConfigs[nodeId];
            config.message = blockConfig.message || '';

            // Update UI
            const responseInput = newNode.querySelector('.config-response-input');
            if (responseInput) responseInput.value = config.message;

            updateNodeLabel(nodeId);
        }

        previousNodeId = nodeId;
        currentY += nodeSpacing;
    });

    // Update connector states and render connections
    updateConnectorStates();
    renderConnections();

    // Update save button to show we're in edit mode
    const saveBtn = document.getElementById('save-deo-btn');
    if (saveBtn) {
        saveBtn.textContent = 'Update';
        saveBtn.disabled = false;
    }

    const saveRunBtn = document.getElementById('save-run-deo-btn');
    if (saveRunBtn) {
        saveRunBtn.textContent = 'Update & Run';
        saveRunBtn.disabled = false;
    }

    // Refresh Slack data to populate channel/user dropdowns
    if (selectedCanvasWorkspace) {
        refreshSlackData();
    }
}

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

        // Refresh Slack channels and users for the new workspace
        refreshSlackData();

        // Auto-save after workspace selection
        triggerAutoSave();
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

// === SLACK DATA CACHE ===
let slackChannelsCache = [];
let slackUsersCache = [];

// Fetch Slack channels for current workspace
async function fetchSlackChannels() {
    if (!selectedCanvasWorkspace) {
        slackChannelsCache = [];
        return [];
    }

    try {
        const res = await fetch(`/workspace/${selectedCanvasWorkspace}/channels`);
        const data = await res.json();

        if (res.ok && data.success) {
            slackChannelsCache = data.channels || [];
            return slackChannelsCache;
        }
    } catch (err) {
        console.error('Error fetching Slack channels:', err);
    }

    slackChannelsCache = [];
    return [];
}

// Fetch Slack users for current workspace
async function fetchSlackUsers() {
    if (!selectedCanvasWorkspace) {
        slackUsersCache = [];
        return [];
    }

    try {
        const res = await fetch(`/workspace/${selectedCanvasWorkspace}/users`);
        const data = await res.json();

        if (res.ok && data.success) {
            slackUsersCache = data.users || [];
            return slackUsersCache;
        }
    } catch (err) {
        console.error('Error fetching Slack users:', err);
    }

    slackUsersCache = [];
    return [];
}

// Update all channel dropdowns in message blocks
function updateChannelDropdowns() {
    const dropdowns = document.querySelectorAll('.config-channel-dropdown');
    dropdowns.forEach(dropdown => {
        const nodeId = dropdown.dataset.nodeId;
        const config = nodeId ? nodeConfigs[nodeId] : null;
        const selectedChannel = config?.channel_name || '';

        // Update the selected text display
        const selectedText = dropdown.querySelector('.channel-dropdown-text');
        if (selectedText) {
            selectedText.textContent = selectedChannel ? `#${selectedChannel}` : 'Select a channel...';
        }

        // Update the list
        const container = dropdown.querySelector('.config-channel-list');
        if (!container) return;

        if (slackChannelsCache.length === 0) {
            container.innerHTML = '<div class="channel-select-empty">Select a workspace first</div>';
            return;
        }

        container.innerHTML = slackChannelsCache.map(ch => {
            const isSelected = ch.name === selectedChannel;
            return `
                <div class="channel-item ${isSelected ? 'selected' : ''}" data-channel="${ch.name}">
                    <span class="channel-name">#${ch.name}</span>
                    ${ch.is_private ? '<span class="channel-private">🔒</span>' : ''}
                </div>
            `;
        }).join('');
    });
}

// Update all user multi-selects in message blocks
function updateUserMultiSelects() {
    const containers = document.querySelectorAll('.config-users-multiselect');
    containers.forEach(container => {
        const nodeId = container.dataset.nodeId;
        const config = nodeConfigs[nodeId];
        const selectedUsers = config?.users ? config.users.split(',').map(u => u.trim()).filter(u => u) : [];

        if (slackUsersCache.length === 0) {
            container.innerHTML = '<div class="users-select-empty">Select a workspace first</div>';
            return;
        }

        container.innerHTML = slackUsersCache.map(user => {
            const isSelected = selectedUsers.includes(user.id);
            const displayName = user.real_name || user.display_name || user.name;
            return `
                <label class="user-checkbox-item ${isSelected ? 'selected' : ''}">
                    <input type="checkbox" value="${user.id}" ${isSelected ? 'checked' : ''}>
                    <span class="user-name">${displayName}</span>
                    <span class="user-handle">@${user.name}</span>
                </label>
            `;
        }).join('');
    });
}

// Refresh Slack data when workspace changes
async function refreshSlackData() {
    await Promise.all([fetchSlackChannels(), fetchSlackUsers()]);
    updateChannelDropdowns();
    updateUserMultiSelects();
}

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

    // Trigger auto-save when label updates (config changed)
    triggerAutoSave();
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
    if (e.target.classList.contains('config-message-input')) {
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

// Handle config select changes (for timeout)
document.addEventListener('change', (e) => {
    const popup = e.target.closest('.block-config-popup');
    if (!popup) return;

    const node = popup.closest('.flow-node');
    if (!node) return;

    const nodeId = node.dataset.nodeId;
    const config = nodeConfigs[nodeId];
    if (!config) return;

    if (e.target.classList.contains('config-timeout-select')) {
        const customRow = popup.querySelector('.config-custom-timeout-row');

        if (e.target.value === 'custom') {
            // Show custom timeout input
            if (customRow) customRow.style.display = 'block';
            // Build custom timeout value from inputs
            const valueInput = popup.querySelector('.config-custom-timeout-value');
            const unitSelect = popup.querySelector('.config-custom-timeout-unit');
            const value = valueInput?.value || '30';
            const unit = unitSelect?.value || 'h';
            config.timeout = `${value}${unit}`;
        } else {
            // Hide custom timeout input
            if (customRow) customRow.style.display = 'none';
            config.timeout = e.target.value;
        }
        updateNodeLabel(nodeId);
        triggerAutoSave();
    }

    // Handle custom timeout value/unit changes
    if (e.target.classList.contains('config-custom-timeout-value') ||
        e.target.classList.contains('config-custom-timeout-unit')) {
        const valueInput = popup.querySelector('.config-custom-timeout-value');
        const unitSelect = popup.querySelector('.config-custom-timeout-unit');
        const value = valueInput?.value || '30';
        const unit = unitSelect?.value || 'h';
        config.timeout = `${value}${unit}`;
        updateNodeLabel(nodeId);
        triggerAutoSave();
    }
});

// Handle custom timeout input changes (for number input)
document.addEventListener('input', (e) => {
    if (!e.target.classList.contains('config-custom-timeout-value')) return;

    const popup = e.target.closest('.block-config-popup');
    if (!popup) return;

    const node = popup.closest('.flow-node');
    if (!node) return;

    const nodeId = node.dataset.nodeId;
    const config = nodeConfigs[nodeId];
    if (!config) return;

    const unitSelect = popup.querySelector('.config-custom-timeout-unit');
    const value = e.target.value || '30';
    const unit = unitSelect?.value || 'h';
    config.timeout = `${value}${unit}`;
    updateNodeLabel(nodeId);
});

// Handle user checkbox changes
document.addEventListener('click', (e) => {
    const checkbox = e.target.closest('.user-checkbox-item input[type="checkbox"]');
    if (!checkbox) return;

    const multiselect = checkbox.closest('.config-users-multiselect');
    if (!multiselect) return;

    const nodeId = multiselect.dataset.nodeId;
    const config = nodeConfigs[nodeId];
    if (!config) return;

    // Toggle visual selection
    const label = checkbox.closest('.user-checkbox-item');
    if (label) {
        label.classList.toggle('selected', checkbox.checked);
    }

    // Update config with selected user IDs
    const selectedCheckboxes = multiselect.querySelectorAll('input[type="checkbox"]:checked');
    const selectedUserIds = Array.from(selectedCheckboxes).map(cb => cb.value);
    config.users = selectedUserIds.join(', ');

    updateNodeLabel(nodeId);
    triggerAutoSave();
});

// Handle channel dropdown toggle
document.addEventListener('click', (e) => {
    const selectedArea = e.target.closest('.channel-dropdown-selected');
    if (selectedArea) {
        const dropdown = selectedArea.closest('.config-channel-dropdown');
        if (dropdown) {
            dropdown.classList.toggle('open');
        }
        return;
    }

    // Handle channel item clicks
    const channelItem = e.target.closest('.channel-item');
    if (channelItem) {
        const dropdown = channelItem.closest('.config-channel-dropdown');
        if (!dropdown) return;

        const nodeId = dropdown.dataset.nodeId;
        const config = nodeConfigs[nodeId];
        if (!config) return;

        const channelList = dropdown.querySelector('.config-channel-list');

        // Remove selected class from all items in this list
        channelList.querySelectorAll('.channel-item').forEach(item => {
            item.classList.remove('selected');
        });

        // Add selected class to clicked item
        channelItem.classList.add('selected');

        // Update config with selected channel
        config.channel_name = channelItem.dataset.channel;

        // Update the selected text display
        const selectedText = dropdown.querySelector('.channel-dropdown-text');
        if (selectedText) {
            selectedText.textContent = `#${channelItem.dataset.channel}`;
        }

        // Close the dropdown
        dropdown.classList.remove('open');

        updateNodeLabel(nodeId);
        triggerAutoSave();
        return;
    }

    // Close any open channel dropdowns when clicking elsewhere
    const openDropdowns = document.querySelectorAll('.config-channel-dropdown.open');
    openDropdowns.forEach(dropdown => {
        if (!dropdown.contains(e.target)) {
            dropdown.classList.remove('open');
        }
    });
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

// === CANVAS STATE PERSISTENCE ===
const CANVAS_STORAGE_KEY = 'deo_canvas_state';

// Save canvas state to localStorage
function saveCanvasState() {
    const state = {
        canvasNodes: canvasNodes,
        connections: connections,
        nodeConfigs: nodeConfigs,
        nodeIdCounter: nodeIdCounter,
        triggerConfig: triggerConfig,
        selectedWorkspace: selectedCanvasWorkspace,
        templateName: document.getElementById('template-name-input')?.value || '',
        editingTemplateId: editingTemplateId
    };
    try {
        localStorage.setItem(CANVAS_STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        console.warn('Failed to save canvas state:', e);
    }
}

// Load canvas state from localStorage
function loadCanvasState() {
    try {
        const saved = localStorage.getItem(CANVAS_STORAGE_KEY);
        if (!saved) return null;
        return JSON.parse(saved);
    } catch (e) {
        console.warn('Failed to load canvas state:', e);
        return null;
    }
}

// Clear saved canvas state
function clearCanvasState() {
    try {
        localStorage.removeItem(CANVAS_STORAGE_KEY);
    } catch (e) {
        console.warn('Failed to clear canvas state:', e);
    }
}

// Restore canvas from saved state
function restoreCanvasFromState(state) {
    if (!state) return false;

    const canvasContent = document.querySelector('.deo-canvas-content');
    if (!canvasContent) return false;

    // Hide placeholder
    const placeholder = canvasContent.querySelector('.canvas-placeholder');
    if (placeholder && state.canvasNodes.length > 0) {
        placeholder.style.display = 'none';
    }

    // Restore global state
    nodeIdCounter = state.nodeIdCounter || 0;
    triggerConfig = state.triggerConfig || { type: 'manual', schedule: null };
    selectedCanvasWorkspace = state.selectedWorkspace || null;
    editingTemplateId = state.editingTemplateId || null;

    // Restore template name
    const templateNameInput = document.getElementById('template-name-input');
    if (templateNameInput && state.templateName) {
        templateNameInput.value = state.templateName;
        if (state.editingTemplateId) {
            templateNameInput.disabled = true;
            templateNameInput.style.opacity = '0.7';
            templateNameInput.title = 'Template name cannot be changed when editing';
        }
    }

    // Restore workspace selection UI
    if (state.selectedWorkspace) {
        const workspaceNameSpan = document.getElementById('selected-workspace-name');
        if (workspaceNameSpan) {
            const dropdownItem = document.querySelector(`.workspace-dropdown-item[data-workspace-id="${state.selectedWorkspace}"]`);
            if (dropdownItem) {
                workspaceNameSpan.textContent = dropdownItem.dataset.workspaceName;
            } else {
                workspaceNameSpan.textContent = state.selectedWorkspace;
            }
        }
    }

    // Restore trigger UI
    if (triggerConfig.type === 'schedule') {
        selectTriggerType('schedule');
        const sched = triggerConfig.schedule || {};
        const regularitySelect = document.getElementById('trigger-schedule-regularity');
        if (regularitySelect && sched.regularity) {
            regularitySelect.value = sched.regularity;
            regularitySelect.dispatchEvent(new Event('change'));
        }
        const timeInput = document.getElementById('trigger-schedule-time');
        if (timeInput && sched.time) timeInput.value = sched.time;
        const dayWeekSelect = document.getElementById('trigger-schedule-day-week');
        if (dayWeekSelect && sched.day_of_week !== undefined) dayWeekSelect.value = sched.day_of_week;
        const dayMonthInput = document.getElementById('trigger-schedule-day-month');
        if (dayMonthInput && sched.day_of_month) dayMonthInput.value = sched.day_of_month;
        const intervalInput = document.getElementById('trigger-schedule-interval');
        if (intervalInput && sched.interval_minutes) intervalInput.value = sched.interval_minutes;
    } else {
        selectTriggerType('manual');
    }

    // Restore nodes
    canvasNodes = [];
    connections = [];
    nodeConfigs = {};

    for (const nodeData of state.canvasNodes) {
        const newNode = createNode(nodeData.type, nodeData.x, nodeData.y, nodeData.id);
        if (!newNode) continue;

        const nodeId = newNode.dataset.nodeId;
        const config = state.nodeConfigs[nodeData.id] || {};
        nodeConfigs[nodeId] = config;

        // Restore UI for each block type
        if (nodeData.type === 'message') {
            if (config.mode === 'channel') {
                // Channel select will be populated when workspace is selected/refreshed
                selectMessageMode(nodeId, 'channel');
            } else if (config.mode === 'users') {
                // User multiselect will be populated when workspace is selected/refreshed
                selectMessageMode(nodeId, 'users');
            }
            const msgInput = newNode.querySelector('.config-message-input');
            if (msgInput) msgInput.value = config.message || '';
            updateNodeLabel(nodeId);
        } else if (nodeData.type === 'await') {
            const expectedInput = newNode.querySelector('.config-expected-response-input');
            if (expectedInput) expectedInput.value = config.expected_response || '';
            const timeoutSelect = newNode.querySelector('.config-timeout-select');
            const customRow = newNode.querySelector('.config-custom-timeout-row');
            const timeout = config.timeout || '24h';

            // Check if it's a preset value or custom
            const presetValues = ['1h', '6h', '12h', '24h', '48h', '72h', '7d'];
            if (presetValues.includes(timeout)) {
                if (timeoutSelect) timeoutSelect.value = timeout;
                if (customRow) customRow.style.display = 'none';
            } else {
                // Custom value - parse it
                if (timeoutSelect) timeoutSelect.value = 'custom';
                if (customRow) customRow.style.display = 'block';
                const match = timeout.match(/^(\d+)(m|h|d)$/);
                if (match) {
                    const valueInput = newNode.querySelector('.config-custom-timeout-value');
                    const unitSelect = newNode.querySelector('.config-custom-timeout-unit');
                    if (valueInput) valueInput.value = match[1];
                    if (unitSelect) unitSelect.value = match[2];
                }
            }

            const failureInput = newNode.querySelector('.config-failure-message-input');
            if (failureInput) failureInput.value = config.failure_message || '';
            updateNodeLabel(nodeId);
        } else if (nodeData.type === 'response') {
            const responseInput = newNode.querySelector('.config-response-input');
            if (responseInput) responseInput.value = config.message || '';
            updateNodeLabel(nodeId);
        }
    }

    // Restore connections (need to map old IDs to new IDs if they differ)
    connections = state.connections || [];

    // Update UI - use requestAnimationFrame to ensure DOM is fully rendered
    // before calculating connector positions for lines
    updateConnectorStates();

    // Need to wait for the browser to finish layout before rendering connections
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            renderConnections();
        });
    });

    // Update button states if editing
    if (state.editingTemplateId) {
        const saveBtn = document.getElementById('save-deo-btn');
        if (saveBtn) saveBtn.textContent = 'Update';
        const saveRunBtn = document.getElementById('save-run-deo-btn');
        if (saveRunBtn) saveRunBtn.textContent = 'Update & Run';
    }

    // Refresh Slack data if workspace is selected (will update dropdowns)
    if (selectedCanvasWorkspace) {
        refreshSlackData();
    }

    return true;
}

// Auto-save debounce timer
let autoSaveTimer = null;

// Trigger auto-save with debounce
function triggerAutoSave() {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
        saveCanvasState();
    }, 500); // Save 500ms after last change
}

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

        // Show preview connection while dragging (adjust for zoom)
        const canvasContent = canvas.querySelector('.deo-canvas-content');
        const rect = canvasContent ? canvasContent.getBoundingClientRect() : canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / canvasZoom;
        const y = (e.clientY - rect.top) / canvasZoom;
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

        // Adjust drop position for zoom scale
        const canvasContent = canvas.querySelector('.deo-canvas-content');
        const rect = canvasContent ? canvasContent.getBoundingClientRect() : canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / canvasZoom;
        const y = (e.clientY - rect.top) / canvasZoom;

        const placeholder = canvasContent ? canvasContent.querySelector('.canvas-placeholder') : canvas.querySelector('.canvas-placeholder');
        if (placeholder) placeholder.style.display = 'none';

        const newNode = createNode(draggedBlock, x, y);

        // Find closest existing connector and auto-connect (with threshold)
        // Pass isNewNode=true since this is a brand new node being dropped
        if (newNode) {
            autoConnectNode(newNode, true);
        }

        draggedBlock = null;
        renderConnections();
    }
});

// Show preview line while dragging block from sidebar
function showDropPreview(dropX, dropY) {
    const canvasContent = document.querySelector('.deo-canvas-content');
    if (!canvasContent) return;

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
        let svg = canvasContent.querySelector('.connections-svg');
        if (!svg) {
            svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.classList.add('connections-svg');
            canvasContent.insertBefore(svg, canvasContent.firstChild);
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

// Check if a node has an incoming connection from a SIDE (left or right)
// This is used to disable the TOP connector when a node receives input from the side
function hasIncomingFromSide(nodeId) {
    return connections.some(c =>
        c.to.nodeId === nodeId && (c.to.side === 'left' || c.to.side === 'right')
    );
}

// Check if a specific connector side is already used (as input or output)
// Also checks if TOP should be disabled because node has incoming from side
function isConnectorUsed(nodeId, side) {
    // Direct check: is this specific side already used?
    const directlyUsed = connections.some(c =>
        (c.from.nodeId === nodeId && c.from.side === side) ||
        (c.to.nodeId === nodeId && c.to.side === side)
    );

    if (directlyUsed) return true;

    // Special rule: If checking TOP connector and node has incoming from side (left/right),
    // then TOP is also considered "used" (disabled) to prevent ambiguous multiple inputs
    if (side === 'top' && hasIncomingFromSide(nodeId)) {
        return true;
    }

    return false;
}

// Check if a node already has an outgoing connection (from any side)
function hasOutgoingConnection(nodeId) {
    return connections.some(c => c.from.nodeId === nodeId);
}

// Find closest available connector for auto-connect
// This finds connectors that are NOT already used (as input or output)
// x, y are in unscaled canvas content coordinates
function findClosestAvailableConnector(x, y, excludeNodeId) {
    let closest = null;
    let minDist = Infinity;

    // Check trigger node bottom connector - only if not already used
    const trigger = document.getElementById('trigger-node');
    const triggerBottomUsed = isConnectorUsed('trigger-node', 'bottom');

    if (trigger && excludeNodeId !== 'trigger-node' && !triggerBottomUsed) {
        const pos = getConnectorPos('trigger-node', 'bottom');
        if (pos) {
            const dist = Math.hypot(x - pos.x, y - pos.y);
            if (dist < minDist) {
                minDist = dist;
                closest = { nodeId: 'trigger-node', side: 'bottom', x: pos.x, y: pos.y, distance: dist };
            }
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
// optionalId: if provided, use this ID instead of generating a new one (for restoration)
function createNode(blockType, x, y, optionalId = null) {
    const canvasContent = document.querySelector('.deo-canvas-content');
    if (!canvasContent) return null;

    const nodeId = optionalId || `node-${++nodeIdCounter}`;
    // Update counter if optionalId is higher
    if (optionalId) {
        const num = parseInt(optionalId.replace('node-', ''), 10);
        if (!isNaN(num) && num > nodeIdCounter) {
            nodeIdCounter = num;
        }
    }

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
                    <div class="block-config-label">Channel</div>
                    <div class="config-channel-dropdown" data-node-id="${nodeId}">
                        <div class="channel-dropdown-selected">
                            <span class="channel-dropdown-text">Select a channel...</span>
                            <svg class="channel-dropdown-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M6 9l6 6 6-6"></path>
                            </svg>
                        </div>
                        <div class="config-channel-list">
                            <div class="channel-select-empty">Select a workspace first</div>
                        </div>
                    </div>
                </div>
                <div class="block-config-row config-users-row" style="display: none;">
                    <div class="block-config-label">Select Users</div>
                    <div class="config-users-multiselect" data-node-id="${nodeId}">
                        <div class="users-select-empty">Select a workspace first</div>
                    </div>
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
                        <option value="custom">Custom...</option>
                    </select>
                </div>
                <div class="block-config-row config-custom-timeout-row" style="display: none;">
                    <div class="block-config-label">Custom Timeout</div>
                    <div class="custom-timeout-input-wrapper">
                        <input type="number" class="block-config-input config-custom-timeout-value" placeholder="30" min="1" value="30">
                        <select class="block-config-select config-custom-timeout-unit">
                            <option value="m">Minutes</option>
                            <option value="h" selected>Hours</option>
                            <option value="d">Days</option>
                        </select>
                    </div>
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

    canvasContent.appendChild(node);
    makeNodeDraggable(node);

    // Initialize config for this node
    initNodeConfig(nodeId, blockType);

    canvasNodes.push({
        id: nodeId,
        type: blockType,
        x: x,
        y: y,
        element: node
    });

    // Trigger auto-save
    triggerAutoSave();

    return node;
}

// Get connector position (relative to canvas content for SVG drawing)
// Returns coordinates in the unscaled canvas content coordinate system
function getConnectorPos(nodeId, side) {
    const canvasContent = document.querySelector('.deo-canvas-content');
    if (!canvasContent) return null;

    let node;
    if (nodeId === 'trigger-node') {
        node = document.getElementById('trigger-node');
    } else {
        node = document.querySelector(`[data-node-id="${nodeId}"]`);
    }
    if (!node) return null;

    // Get the connector element for precise positioning
    const connector = node.querySelector(`.flow-node-connector.${side}, .flow-node-connector[data-connector="${side}"]`);

    if (connector) {
        // Use the actual connector element position
        const connectorRect = connector.getBoundingClientRect();
        const contentRect = canvasContent.getBoundingClientRect();
        // Convert screen coords to unscaled canvas content coords
        const x = (connectorRect.left + connectorRect.width / 2 - contentRect.left) / canvasZoom;
        const y = (connectorRect.top + connectorRect.height / 2 - contentRect.top) / canvasZoom;
        return { x, y };
    }

    // Fallback: calculate from node position
    const nodeRect = node.getBoundingClientRect();
    const contentRect = canvasContent.getBoundingClientRect();
    const left = (nodeRect.left - contentRect.left) / canvasZoom;
    const top = (nodeRect.top - contentRect.top) / canvasZoom;
    const width = nodeRect.width / canvasZoom;
    const height = nodeRect.height / canvasZoom;

    switch (side) {
        case 'top':
            return { x: left + width / 2, y: top };
        case 'bottom':
            return { x: left + width / 2, y: top + height };
        case 'left':
            return { x: left, y: top + height / 2 };
        case 'right':
            return { x: left + width, y: top + height / 2 };
    }
    return null;
}

// Find closest connector (for manual connection dragging)
// x, y are in unscaled canvas content coordinates
function findClosestConnector(x, y, excludeNodeId = null) {
    let closest = null;
    let minDist = Infinity;

    // Check trigger node bottom connector
    const trigger = document.getElementById('trigger-node');
    if (trigger && excludeNodeId !== 'trigger-node') {
        const pos = getConnectorPos('trigger-node', 'bottom');
        if (pos) {
            const dist = Math.hypot(x - pos.x, y - pos.y);
            if (dist < minDist) {
                minDist = dist;
                closest = { nodeId: 'trigger-node', side: 'bottom', x: pos.x, y: pos.y, distance: dist };
            }
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
// - IMPORTANT: If the node already has an incoming connection, do NOT auto-connect to new unconnected blocks
//   This prevents tangled connections when moving already-connected nodes near other blocks
// - Only reconnect to nodes that the dragged node was ALREADY connected to (allow re-snapping to existing connection partner)
// - For NEW nodes (no incoming connection), find closest available connector
// - The dragged node's connector side we want to use is the opposite of the target
// - If dragged node's connector side is already used as OUTPUT, we can't connect there
function autoConnectNode(newNode, isNewNode = false) {
    const nodeId = newNode.dataset.nodeId;

    // Use getBoundingClientRect with zoom adjustment for consistent coordinates
    const canvasContent = document.querySelector('.deo-canvas-content');
    const contentRect = canvasContent.getBoundingClientRect();
    const nodeRect = newNode.getBoundingClientRect();
    const nodeCenterX = (nodeRect.left + nodeRect.width / 2 - contentRect.left) / canvasZoom;
    const nodeCenterY = (nodeRect.top + nodeRect.height / 2 - contentRect.top) / canvasZoom;

    // Check if this node already has an incoming connection
    const existingIncoming = connections.find(c => c.to.nodeId === nodeId);

    // If node already has an incoming connection AND this is not a new node drop,
    // only allow reconnecting to the node it's already connected to (for re-snapping)
    if (existingIncoming && !isNewNode) {
        // Node is already connected - don't try to auto-connect to other blocks
        // The existing connection will be maintained, just re-render at new position
        return;
    }

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
        triggerAutoSave();
    }
}

// Update connector visual states
function updateConnectorStates() {
    // Reset all connector states
    document.querySelectorAll('.flow-node-connector').forEach(c => {
        c.classList.remove('connected');
        c.classList.remove('disabled');
    });

    // Mark connected connectors
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

        // If connected via side (left/right), disable the TOP connector
        if (conn.to.side === 'left' || conn.to.side === 'right') {
            const topConnector = toNode?.querySelector('[data-connector="top"]');
            if (topConnector) {
                topConnector.classList.add('disabled');
            }
        }
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

        // Adjust movement for zoom scale
        const dx = (e.clientX - startX) / canvasZoom;
        const dy = (e.clientY - startY) / canvasZoom;

        node.style.left = `${initialX + dx}px`;
        node.style.top = `${initialY + dy}px`;

        // Show preview for potential new connection
        const nodeId = node.dataset.nodeId;
        // Use getBoundingClientRect with zoom adjustment for consistent coordinates
        const canvasContent = document.querySelector('.deo-canvas-content');
        const contentRect = canvasContent.getBoundingClientRect();
        const nodeRect = node.getBoundingClientRect();
        const nodeCenterX = (nodeRect.left + nodeRect.width / 2 - contentRect.left) / canvasZoom;
        const nodeCenterY = (nodeRect.top + nodeRect.height / 2 - contentRect.top) / canvasZoom;

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

            // Update node position in canvasNodes and trigger auto-save
            const nodeId = node.dataset.nodeId;
            const nodeData = canvasNodes.find(n => n.id === nodeId);
            if (nodeData) {
                nodeData.x = node.offsetLeft + 100; // Restore center position
                nodeData.y = node.offsetTop + 22;
            }
            triggerAutoSave();
        }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

// Show preview line while dragging existing node
// IMPORTANT: If the node already has an incoming connection, don't show preview
// because we won't auto-connect it to new blocks anyway
function showNodeDragPreview(nodeId, nodeCenterX, nodeCenterY) {
    // Check if this node already has an incoming connection
    const hasExistingIncoming = connections.some(c => c.to.nodeId === nodeId);

    // If node is already connected, don't show preview for potential new connections
    // This matches the behavior in autoConnectNode which skips already-connected nodes
    if (hasExistingIncoming) {
        removePreviewLine();
        return;
    }

    const closest = findClosestAvailableConnector(nodeCenterX, nodeCenterY, nodeId);

    if (closest && closest.distance < CONNECTION_THRESHOLD) {
        const canvasContent = document.querySelector('.deo-canvas-content');
        let svg = canvasContent.querySelector('.connections-svg');
        if (!svg) {
            svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.classList.add('connections-svg');
            canvasContent.insertBefore(svg, canvasContent.firstChild);
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

    const canvasContent = document.querySelector('.deo-canvas-content');
    let svg = canvasContent.querySelector('.connections-svg');
    if (!svg) {
        svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.classList.add('connections-svg');
        canvasContent.insertBefore(svg, canvasContent.firstChild);
    }

    tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    tempLine.classList.add('connection-line', 'temp');
    svg.appendChild(tempLine);
});

document.addEventListener('mousemove', (e) => {
    if (!isConnecting || !tempLine || !connectionStart) return;

    const canvasContent = document.querySelector('.deo-canvas-content');
    const contentRect = canvasContent.getBoundingClientRect();
    const startPos = getConnectorPos(connectionStart.nodeId, connectionStart.side);

    if (!startPos) return;

    // Adjust mouse position for zoom scale
    const endX = (e.clientX - contentRect.left) / canvasZoom;
    const endY = (e.clientY - contentRect.top) / canvasZoom;

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
    const canvasContent = document.querySelector('.deo-canvas-content');
    if (!canvasContent) return;

    let svg = canvasContent.querySelector('.connections-svg');
    if (!svg) {
        svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.classList.add('connections-svg');
        canvasContent.insertBefore(svg, canvasContent.firstChild);
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
            triggerAutoSave();

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
        const canvasContent = document.querySelector('.deo-canvas-content');
        if (canvasContent) {
            canvasContent.querySelectorAll('.flow-node').forEach(n => n.remove());

            const svg = canvasContent.querySelector('.connections-svg');
            if (svg) svg.innerHTML = '';

            const placeholder = canvasContent.querySelector('.canvas-placeholder');
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

            // Reset save & run button state
            const saveRunBtn = document.getElementById('save-run-deo-btn');
            if (saveRunBtn) {
                saveRunBtn.textContent = 'Save & Run';
                saveRunBtn.disabled = false;
            }

            // Reset template name input
            const templateNameInput = document.getElementById('template-name-input');
            if (templateNameInput) {
                templateNameInput.value = '';
                templateNameInput.disabled = false;
                templateNameInput.style.opacity = '1';
                templateNameInput.title = '';
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

            // Clear editing mode
            editingTemplateId = null;

            // Reset zoom to 100%
            updateCanvasZoom(1);

            // Clear saved canvas state
            clearCanvasState();
        }
    }
});

// === SAVE TEMPLATE ===

// Traverse connections from trigger to get ordered blocks
// Uses DFS (Depth-First Search) with priority: bottom -> right -> left
// This ensures we follow each branch completely before moving to the next sibling
// Example: Trigger -> Message -> (right: Await -> its children) -> (left: Response -> its children)
function getOrderedBlocks() {
    const orderedBlocks = [];
    const visited = new Set();

    // DFS recursive helper function
    function dfsTraverse(currentNodeId) {
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
                    // Add this node to the ordered list
                    orderedBlocks.push({
                        nodeId: nextNodeId,
                        type: nodeData.type,
                        config: nodeConfigs[nextNodeId] || {}
                    });
                    visited.add(nextNodeId);

                    // Recursively traverse this node's children BEFORE moving to siblings
                    // This is the key difference from BFS - we go deep first
                    dfsTraverse(nextNodeId);
                }
            }
        }
    }

    // Start DFS from trigger node
    visited.add('trigger-node');
    dfsTraverse('trigger-node');

    return orderedBlocks;
}

// Build template payload from canvas state
// NEW FORMAT: Each block has its own config inline
// This supports multiple message blocks with different configs
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

    // Check for required blocks
    const hasMessage = orderedBlocks.some(b => b.type === 'message');
    const hasAwait = orderedBlocks.some(b => b.type === 'await');
    const hasResponse = orderedBlocks.some(b => b.type === 'response');

    if (!hasMessage) {
        return { error: 'Template requires at least one Message block' };
    }

    // Response block is only required if there's an await block
    if (hasAwait && !hasResponse) {
        return { error: 'Template with Await block requires a Response block' };
    }

    // Build blocks array with inline configs
    const blocksWithConfig = [];

    for (const block of orderedBlocks) {
        const blockEntry = { type: block.type };

        if (block.type === 'message') {
            const msgConfig = block.config;
            if (!msgConfig.message) {
                return { error: `Message block requires a message` };
            }

            blockEntry.config = { message: msgConfig.message };

            if (msgConfig.mode === 'channel') {
                if (!msgConfig.channel_name) {
                    return { error: `Message block requires a channel name` };
                }
                blockEntry.config.channel_name = msgConfig.channel_name;
            } else {
                if (!msgConfig.users) {
                    return { error: `Message block requires user IDs` };
                }
                blockEntry.config.users = msgConfig.users.split(',').map(u => u.trim()).filter(u => u);
            }
        } else if (block.type === 'await') {
            const awaitConfig = block.config;
            blockEntry.config = {
                expected_response: awaitConfig.expected_response || '',
                timeout: awaitConfig.timeout || '24h',
                failure_message: awaitConfig.failure_message || ''
            };
        } else if (block.type === 'response') {
            const respConfig = block.config;
            if (!respConfig.message) {
                return { error: `Response block requires a message` };
            }
            blockEntry.config = { message: respConfig.message };
        }

        blocksWithConfig.push(blockEntry);
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

    // Build canvas layout for read-only diagram display
    const canvasLayout = {
        nodes: canvasNodes.map(node => ({
            id: node.id,
            type: node.type,
            x: node.x,
            y: node.y
        })),
        connections: connections.map(conn => ({
            from: { nodeId: conn.from.nodeId, side: conn.from.side },
            to: { nodeId: conn.to.nodeId, side: conn.to.side }
        })),
        nodeConfigs: { ...nodeConfigs }
    };

    // Build payload with new format
    const payload = {
        template_id: templateName,
        workspace_id: workspaceId,
        action_chain: {
            blocks: blocksWithConfig,
            trigger: triggerPayload,
            canvas_layout: canvasLayout
        }
    };

    return { payload };
}

// Save template function (reusable)
async function saveTemplate(btn, runAfterSave = false) {
    const originalText = btn.textContent;

    // Build payload
    const result = buildTemplatePayload();

    if (result.error) {
        await showAlert({ title: 'Validation Error', message: result.error, type: 'warning' });
        return null;
    }

    // Disable both buttons while saving
    const saveBtn = document.getElementById('save-deo-btn');
    const saveRunBtn = document.getElementById('save-run-deo-btn');
    if (saveBtn) saveBtn.disabled = true;
    if (saveRunBtn) saveRunBtn.disabled = true;
    btn.textContent = runAfterSave ? 'Saving...' : 'Saving...';

    try {
        let res;
        let isUpdate = editingTemplateId !== null;

        if (isUpdate) {
            // Update existing template (PUT)
            btn.textContent = runAfterSave ? 'Updating...' : 'Updating...';
            res = await fetch(`/templates/update/${encodeURIComponent(editingTemplateId)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action_chain: result.payload.action_chain })
            });
        } else {
            // Create new template (POST)
            res = await fetch('/templates/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(result.payload)
            });
        }

        const data = await res.json();

        if (res.ok && data.success) {
            // Refresh templates sidebar if function exists
            if (typeof loadTemplatesSidebar === 'function') {
                loadTemplatesSidebar(); // Refresh all templates
            }
            if (typeof loadTemplateEmptyList === 'function') {
                loadTemplateEmptyList(); // Refresh all templates
            }

            // Return the template ID (use editingTemplateId for updates)
            return isUpdate ? editingTemplateId : result.payload.template_id;
        } else {
            await showAlert({ title: 'Save Failed', message: data.detail || `Failed to ${isUpdate ? 'update' : 'save'} template`, type: 'error' });
            btn.textContent = originalText;
            if (saveBtn) saveBtn.disabled = false;
            if (saveRunBtn) saveRunBtn.disabled = false;
            return null;
        }
    } catch (err) {
        console.error('Save error:', err);
        await showAlert({ title: 'Error', message: 'Error saving template', type: 'error' });
        btn.textContent = originalText;
        if (saveBtn) saveBtn.disabled = false;
        if (saveRunBtn) saveRunBtn.disabled = false;
        return null;
    }
}

// Save button handler
document.addEventListener('click', async (e) => {
    if (e.target.id === 'save-deo-btn') {
        const btn = e.target;
        const isUpdate = editingTemplateId !== null;
        const templateId = await saveTemplate(btn, false);

        if (templateId) {
            btn.textContent = isUpdate ? 'Updated!' : 'Saved!';
            // Clear editing mode after successful save
            editingTemplateId = null;
            // Redirect to templates view after short delay
            setTimeout(() => {
                window.location.hash = '#templates';
            }, 500);
        }
    }
});

// Save & Run button handler
document.addEventListener('click', async (e) => {
    if (e.target.id === 'save-run-deo-btn') {
        const btn = e.target;
        const saveBtn = document.getElementById('save-deo-btn');
        const isUpdate = editingTemplateId !== null;

        const templateId = await saveTemplate(btn, true);

        if (templateId) {
            // Now run the template
            btn.textContent = 'Running...';

            try {
                const runRes = await fetch('/templates/run', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ template_id: templateId })
                });

                const runData = await runRes.json();

                if (runRes.ok && runData.success) {
                    btn.textContent = 'Done!';
                    if (saveBtn) saveBtn.textContent = isUpdate ? 'Updated!' : 'Saved!';

                    // Clear editing mode after successful save
                    editingTemplateId = null;

                    // Show success notification
                    setTimeout(async () => {
                        await showAlert({ title: 'Success', message: `Template "${templateId}" ${isUpdate ? 'updated' : 'saved'} and executed successfully!`, type: 'success' });
                        // Reset buttons after notification
                        btn.textContent = 'Save & Run';
                        btn.disabled = false;
                        if (saveBtn) {
                            saveBtn.textContent = 'Save';
                            saveBtn.disabled = false;
                        }
                    }, 300);
                } else {
                    await showAlert({ title: 'Run Failed', message: `Template ${isUpdate ? 'updated' : 'saved'} but failed to run: ` + (runData.detail || 'Unknown error'), type: 'error' });
                    btn.textContent = 'Save & Run';
                    btn.disabled = false;
                    if (saveBtn) {
                        saveBtn.textContent = 'Save';
                        saveBtn.disabled = false;
                    }
                }
            } catch (err) {
                console.error('Run error:', err);
                await showAlert({ title: 'Error', message: 'Template saved but error running: ' + err.message, type: 'error' });
                btn.textContent = 'Save & Run';
                btn.disabled = false;
                if (saveBtn) {
                    saveBtn.textContent = 'Save';
                    saveBtn.disabled = false;
                }
            }
        }
    }
});

// === PAGE INITIALIZATION ===
// Restore canvas state on page load (if on canvas page)
(function initCanvasPage() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tryRestoreCanvas);
    } else {
        // DOM already ready, run with a small delay to ensure all elements are set up
        setTimeout(tryRestoreCanvas, 100);
    }

    function tryRestoreCanvas() {
        const canvas = document.querySelector('.deo-canvas');
        if (!canvas) return; // Not on canvas page

        // Apply initial canvas transform (syncs background position)
        updateCanvasTransform();

        // Add listener for template name changes
        const templateNameInput = document.getElementById('template-name-input');
        if (templateNameInput) {
            templateNameInput.addEventListener('input', () => {
                triggerAutoSave();
            });
        }

        // Try to restore saved state
        const savedState = loadCanvasState();
        if (savedState && savedState.canvasNodes && savedState.canvasNodes.length > 0) {
            console.log('Restoring canvas state from localStorage');
            restoreCanvasFromState(savedState);
        }
    }
})();