// === INTERACTIVE TUTORIAL SYSTEM ===

const Tutorial = {
    currentStep: 0,
    isActive: false,
    steps: [],
    activeClickHandler: null,
    waitingForAction: false,

    // Tutorial step definitions - Simplified highlight-based flow
    init() {
        this.steps = [
            // ===== WELCOME =====
            {
                type: 'welcome',
                title: 'Welcome to DEO!',
                description: 'Let\'s take a quick tour of DEO! We\'ll show you the key features for managing your Slack automations.',
                target: null
            },

            // ===== STEP 1: EXPAND SIDEBAR =====
            {
                type: 'action',
                title: 'Expand the Sidebar',
                description: 'First, let\'s expand the sidebar to see all navigation options.',
                target: '.sidebar-expand',
                action: 'click',
                waitFor: '#sidebar-toggle:checked',
                position: 'right',
                padding: 8,
                hint: 'Click to expand'
            },

            // ===== STEP 2: WORKSPACES =====
            {
                type: 'highlight',
                title: 'Workspaces',
                description: 'Workspaces connect DEO to your Slack workspace.\n\nClick here anytime to add a new workspace or view existing ones.',
                target: '#workspaces-group > label',
                position: 'right',
                padding: 8,
                beforeShow: () => {
                    // Ensure sidebar is expanded
                    const toggle = document.getElementById('sidebar-toggle');
                    if (toggle && !toggle.checked) toggle.checked = true;
                }
            },

            // ===== STEP 3: TEAMS =====
            {
                type: 'highlight',
                title: 'Teams',
                description: 'Teams let you organize your colleagues.\n\nCreate teams to assign members to dashboards and track their metrics.',
                target: '#teams-group > label',
                position: 'right',
                padding: 8
            },

            // ===== STEP 4: DASHBOARDS =====
            {
                type: 'highlight',
                title: 'Dashboards',
                description: 'Dashboards track your team\'s performance metrics.\n\nCreate dashboards with custom metrics like sales, calls, or meetings.',
                target: '#dashboards-group > label',
                position: 'right',
                padding: 8
            },

            // ===== STEP 5: BOT TEMPLATES =====
            {
                type: 'highlight',
                title: 'Bot Templates',
                description: 'Bot Templates are your saved automations.\n\nView and manage all your bots from here.',
                target: '#templates-group > label',
                position: 'right',
                padding: 8
            },

            // ===== STEP 6: CANVAS =====
            {
                type: 'highlight',
                title: 'Canvas - Build Bots',
                description: 'The Canvas is where you create new bots!\n\nClick here to open the visual bot builder and start automating.',
                target: '.sidebar-btn[href="#new-deo"]',
                position: 'right',
                padding: 8
            },

            // ===== STEP 7: APPS =====
            {
                type: 'highlight',
                title: 'Apps',
                description: 'Apps is where DEO\'s integrated apps and tools will reside.',
                target: '.sidebar-btn[href="#apps"]',
                position: 'right',
                padding: 8
            },

            // ===== STEP 8: SETTINGS =====
            {
                type: 'highlight',
                title: 'Settings',
                description: 'Access your account settings, Slack tokens, and preferences here.',
                target: '.sidebar-settings',
                position: 'right',
                padding: 8
            },

            // ===== STEP 9: HELP =====
            {
                type: 'highlight',
                title: 'Need Help?',
                description: 'Click here anytime to access help documentation and support.',
                target: '#open-help-btn',
                position: 'right',
                padding: 8
            },

            // ===== COMPLETION =====
            {
                type: 'completion',
                title: 'Tour Complete!',
                description: 'You\'re ready to start using DEO!\n\nQuick start tips:\n• Add a Workspace to connect Slack\n• Create a Team for your colleagues\n• Build your first Bot on the Canvas\n\nClick "Take a Tour" anytime to see this again!',
                target: null
            }
        ];

        this.bindEvents();
        this.checkFirstVisit();
    },

    bindEvents() {
        // Toggle button
        const toggleBtn = document.getElementById('tutorial-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.start());
        }

        // Navigation buttons
        const nextBtn = document.getElementById('tutorial-next');
        const prevBtn = document.getElementById('tutorial-prev');
        const closeBtn = document.getElementById('tutorial-close');

        if (nextBtn) nextBtn.addEventListener('click', () => this.next());
        if (prevBtn) prevBtn.addEventListener('click', () => this.prev());
        if (closeBtn) closeBtn.addEventListener('click', () => this.end());

        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isActive) {
                this.end();
            }
        });

        // Close on backdrop click
        const backdrop = document.querySelector('.tutorial-backdrop');
        if (backdrop) {
            backdrop.addEventListener('click', () => this.end());
        }

        // Listen for hash changes
        window.addEventListener('hashchange', () => {
            if (this.isActive && this.waitingForAction) {
                this.checkActionComplete();
            }
        });
    },

    checkFirstVisit() {
        // Auto-start tutorial for first-time visitors
        const hasSeenTutorial = localStorage.getItem('deo-tutorial-seen');
        if (!hasSeenTutorial) {
            // Small delay to let the page fully load
            setTimeout(() => {
                // Only auto-start if on home page
                if (!window.location.hash || window.location.hash === '#home') {
                    this.start();
                }
            }, 1000);
        }
    },

    start() {
        this.isActive = true;
        this.currentStep = 0;
        this.waitingForAction = false;

        const overlay = document.getElementById('tutorial-overlay');
        const toggleBtn = document.getElementById('tutorial-toggle');

        if (overlay) overlay.classList.add('active');
        if (toggleBtn) toggleBtn.classList.add('active');
        document.body.classList.add('tutorial-active');

        // Navigate to home if not already there
        if (window.location.hash && window.location.hash !== '#home') {
            window.location.hash = '#home';
        }

        // Ensure sidebar is collapsed at start
        const sidebarToggle = document.getElementById('sidebar-toggle');
        if (sidebarToggle && sidebarToggle.checked) {
            sidebarToggle.checked = false;
        }

        this.showStep(0);
    },

    end() {
        this.isActive = false;
        this.waitingForAction = false;
        this.removeClickHandler();

        const overlay = document.getElementById('tutorial-overlay');
        const toggleBtn = document.getElementById('tutorial-toggle');

        if (overlay) overlay.classList.remove('active');
        if (toggleBtn) toggleBtn.classList.remove('active');
        document.body.classList.remove('tutorial-active');

        // Remove any click hints
        document.querySelectorAll('.tutorial-click-hint').forEach(el => el.remove());

        // Mark tutorial as seen
        localStorage.setItem('deo-tutorial-seen', 'true');
    },

    next() {
        if (this.currentStep < this.steps.length - 1) {
            this.removeClickHandler();
            this.currentStep++;
            this.showStep(this.currentStep);
        } else {
            this.end();
        }
    },

    prev() {
        if (this.currentStep > 0) {
            this.removeClickHandler();
            this.currentStep--;
            this.showStep(this.currentStep);
        }
    },

    removeClickHandler() {
        if (this.activeClickHandler) {
            document.removeEventListener('click', this.activeClickHandler, true);
            this.activeClickHandler = null;
        }
        // Clean up resize handler
        if (this._currentResizeHandler) {
            window.removeEventListener('resize', this._currentResizeHandler);
            this._currentResizeHandler = null;
        }
        document.querySelectorAll('.tutorial-click-hint').forEach(el => el.remove());
        document.querySelectorAll('.tutorial-clickable').forEach(el => {
            el.classList.remove('tutorial-clickable');
        });
    },

    showStep(index) {
        const step = this.steps[index];
        if (!step) return;

        // Run beforeShow if exists
        if (step.beforeShow) {
            step.beforeShow();
        }

        const tooltip = document.getElementById('tutorial-tooltip');
        const spotlight = document.getElementById('tutorial-spotlight');
        const title = document.getElementById('tutorial-title');
        const description = document.getElementById('tutorial-description');
        const stepIndicator = document.getElementById('tutorial-step-indicator');
        const progressBar = document.getElementById('tutorial-progress-bar');
        const prevBtn = document.getElementById('tutorial-prev');
        const nextBtn = document.getElementById('tutorial-next');
        const backdrop = document.querySelector('.tutorial-backdrop');

        // Update content
        if (title) title.textContent = step.title;
        if (description) {
            // Support multiline descriptions
            description.innerHTML = step.description.replace(/\n/g, '<br>');
        }
        if (stepIndicator) stepIndicator.textContent = `${index + 1} of ${this.steps.length}`;
        if (progressBar) progressBar.style.width = `${((index + 1) / this.steps.length) * 100}%`;

        // Update buttons based on step type
        if (prevBtn) {
            prevBtn.style.visibility = index === 0 ? 'hidden' : 'visible';
        }

        if (nextBtn) {
            if (step.type === 'completion') {
                nextBtn.innerHTML = `
                    Finish
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                `;
                nextBtn.style.display = 'flex';
            } else if (step.type === 'welcome') {
                nextBtn.innerHTML = `
                    Let's Go
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                `;
                nextBtn.style.display = 'flex';
            } else if (step.type === 'action') {
                // Hide next button for action steps - user must perform the action
                nextBtn.style.display = 'none';
            } else if (step.type === 'info' && step.showNext) {
                nextBtn.innerHTML = `
                    Continue
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                `;
                nextBtn.style.display = 'flex';
            } else {
                nextBtn.innerHTML = `
                    Next
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                `;
                nextBtn.style.display = 'flex';
            }
        }

        // Handle different step types
        if (step.type === 'welcome') {
            this.showWelcomeScreen(tooltip, spotlight, backdrop);
        } else if (step.type === 'completion') {
            this.showCompletionScreen(tooltip, spotlight, backdrop);
        } else if (step.type === 'action') {
            this.showActionStep(step, tooltip, spotlight, backdrop);
        } else if (step.type === 'info') {
            this.showInfoStep(step, tooltip, spotlight, backdrop);
        } else {
            this.showHighlightStep(step, tooltip, spotlight, backdrop);
        }
    },

    showWelcomeScreen(tooltip, spotlight, backdrop) {
        tooltip.classList.remove('completion-screen');
        tooltip.classList.add('welcome-screen');
        tooltip.removeAttribute('data-position');

        if (spotlight) spotlight.style.display = 'none';
        if (backdrop) backdrop.style.display = 'block';

        const content = tooltip.querySelector('.tutorial-tooltip-content');
        if (content) {
            content.innerHTML = `
                <div class="welcome-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
                    </svg>
                </div>
                <h3 class="tutorial-title" id="tutorial-title">${this.steps[0].title}</h3>
                <p class="tutorial-description" id="tutorial-description">${this.steps[0].description}</p>
            `;
        }

        const footer = tooltip.querySelector('.tutorial-tooltip-footer');
        if (footer && !footer.querySelector('.tutorial-skip')) {
            const skipLink = document.createElement('div');
            skipLink.className = 'tutorial-skip';
            skipLink.textContent = 'Skip tutorial';
            skipLink.addEventListener('click', () => this.end());
            footer.parentNode.insertBefore(skipLink, footer.nextSibling);
        }
    },

    showCompletionScreen(tooltip, spotlight, backdrop) {
        tooltip.classList.remove('welcome-screen');
        tooltip.classList.add('completion-screen');
        tooltip.removeAttribute('data-position');

        if (spotlight) spotlight.style.display = 'none';
        if (backdrop) backdrop.style.display = 'block';

        const content = tooltip.querySelector('.tutorial-tooltip-content');
        if (content) {
            content.innerHTML = `
                <div class="completion-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </div>
                <h3 class="tutorial-title" id="tutorial-title">${this.steps[this.steps.length - 1].title}</h3>
                <p class="tutorial-description" id="tutorial-description">${this.steps[this.steps.length - 1].description.replace(/\n/g, '<br>')}</p>
            `;
        }

        const skipLink = tooltip.parentNode.querySelector('.tutorial-skip');
        if (skipLink) skipLink.remove();
    },

    showActionStep(step, tooltip, spotlight, backdrop) {
        tooltip.classList.remove('welcome-screen', 'completion-screen');

        if (spotlight) spotlight.style.display = 'block';
        // Hide backdrop completely for action steps so clicks can pass through
        if (backdrop) {
            backdrop.style.display = 'none';
            backdrop.style.pointerEvents = 'none';
        }

        // Find target element
        let target = document.querySelector(step.target);

        // Try fallback if primary target not found
        if (!target && step.targetFallback) {
            target = document.querySelector(step.targetFallback);
        }

        if (!target) {
            console.warn('Tutorial target not found:', step.target);
            // Skip to next step if target not found
            setTimeout(() => this.next(), 500);
            return;
        }

        // Ensure target is visible - scroll into view if needed
        const targetRect = target.getBoundingClientRect();
        if (targetRect.top < 0 || targetRect.bottom > window.innerHeight) {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        // Get target position after any scroll
        const positionElements = () => {
            const rect = target.getBoundingClientRect();
            const padding = step.padding || 8;

            // Position spotlight
            if (spotlight) {
                spotlight.style.top = `${rect.top - padding}px`;
                spotlight.style.left = `${rect.left - padding}px`;
                spotlight.style.width = `${rect.width + padding * 2}px`;
                spotlight.style.height = `${rect.height + padding * 2}px`;
            }

            // Position tooltip
            this.positionTooltip(tooltip, rect, step.position);

            // Update click hint position
            const existingHint = document.querySelector('.tutorial-click-hint');
            if (existingHint) {
                existingHint.style.top = `${rect.bottom + 8}px`;
                existingHint.style.left = `${rect.left + rect.width / 2}px`;
            }
        };

        // Initial positioning
        positionElements();

        // Update tooltip content
        const content = tooltip.querySelector('.tutorial-tooltip-content');
        if (content) {
            content.innerHTML = `
                <div class="action-indicator">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 16 16 12 12 8"></polyline>
                        <line x1="8" y1="12" x2="16" y2="12"></line>
                    </svg>
                    <span>Action Required</span>
                </div>
                <h3 class="tutorial-title" id="tutorial-title">${step.title}</h3>
                <p class="tutorial-description" id="tutorial-description">${step.description}</p>
            `;
        }

        const skipLink = tooltip.parentNode.querySelector('.tutorial-skip');
        if (skipLink) skipLink.remove();

        // Add click hint
        this.addClickHint(target, step.hint || 'Click');

        // Make target clickable through overlay
        target.classList.add('tutorial-clickable');

        // Set up action listener
        this.waitingForAction = true;
        this.setupActionListener(step, target);

        // Reposition on window resize
        const resizeHandler = () => {
            if (this.isActive && this.waitingForAction) {
                positionElements();
            }
        };
        window.addEventListener('resize', resizeHandler);

        // Store handler reference for cleanup
        this._currentResizeHandler = resizeHandler;
    },

    showInfoStep(step, tooltip, spotlight, backdrop) {
        tooltip.classList.remove('welcome-screen', 'completion-screen');

        if (spotlight) spotlight.style.display = 'block';
        if (backdrop) backdrop.style.display = 'none';

        // Find target with fallback support
        let target = document.querySelector(step.target);
        if (!target && step.targetFallback) {
            target = document.querySelector(step.targetFallback);
        }

        if (!target) {
            console.warn('Tutorial target not found:', step.target);
            // Skip to next step if target not found
            setTimeout(() => this.next(), 500);
            return;
        }

        const rect = target.getBoundingClientRect();
        const padding = step.padding || 8;

        if (spotlight) {
            spotlight.style.top = `${rect.top - padding}px`;
            spotlight.style.left = `${rect.left - padding}px`;
            spotlight.style.width = `${rect.width + padding * 2}px`;
            spotlight.style.height = `${rect.height + padding * 2}px`;
        }

        const content = tooltip.querySelector('.tutorial-tooltip-content');
        if (content) {
            content.innerHTML = `
                <div class="info-indicator">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="16" x2="12" y2="12"></line>
                        <line x1="12" y1="8" x2="12.01" y2="8"></line>
                    </svg>
                    <span>Info</span>
                </div>
                <h3 class="tutorial-title" id="tutorial-title">${step.title}</h3>
                <p class="tutorial-description" id="tutorial-description">${step.description.replace(/\n/g, '<br>')}</p>
            `;
        }

        const skipLink = tooltip.parentNode.querySelector('.tutorial-skip');
        if (skipLink) skipLink.remove();

        this.positionTooltip(tooltip, rect, step.position);
    },

    showHighlightStep(step, tooltip, spotlight, backdrop) {
        tooltip.classList.remove('welcome-screen', 'completion-screen');

        if (spotlight) spotlight.style.display = 'block';
        if (backdrop) backdrop.style.display = 'none';

        // Find target with fallback support
        let target = document.querySelector(step.target);
        if (!target && step.targetFallback) {
            target = document.querySelector(step.targetFallback);
        }

        if (!target) {
            console.warn('Tutorial target not found:', step.target);
            // Skip to next step if target not found
            setTimeout(() => this.next(), 500);
            return;
        }

        const rect = target.getBoundingClientRect();
        const padding = step.padding || 8;

        if (spotlight) {
            spotlight.style.top = `${rect.top - padding}px`;
            spotlight.style.left = `${rect.left - padding}px`;
            spotlight.style.width = `${rect.width + padding * 2}px`;
            spotlight.style.height = `${rect.height + padding * 2}px`;
        }

        const content = tooltip.querySelector('.tutorial-tooltip-content');
        if (content) {
            content.innerHTML = `
                <h3 class="tutorial-title" id="tutorial-title">${step.title}</h3>
                <p class="tutorial-description" id="tutorial-description">${step.description.replace(/\n/g, '<br>')}</p>
            `;
        }

        const skipLink = tooltip.parentNode.querySelector('.tutorial-skip');
        if (skipLink) skipLink.remove();

        this.positionTooltip(tooltip, rect, step.position);
    },

    addClickHint(target, text) {
        // Remove existing hints
        document.querySelectorAll('.tutorial-click-hint').forEach(el => el.remove());

        const hint = document.createElement('div');
        hint.className = 'tutorial-click-hint';
        hint.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 9l6 6 6-6"/>
            </svg>
            <span>${text}</span>
        `;

        const rect = target.getBoundingClientRect();
        hint.style.position = 'fixed';
        hint.style.top = `${rect.bottom + 8}px`;
        hint.style.left = `${rect.left + rect.width / 2}px`;
        hint.style.transform = 'translateX(-50%)';
        hint.style.zIndex = '10001';

        document.body.appendChild(hint);
    },

    setupActionListener(step, target) {
        // Store reference to poll interval so we can clear it
        let pollInterval = null;

        const checkComplete = () => {
            if (this.checkWaitCondition(step.waitFor)) {
                this.waitingForAction = false;
                this.removeClickHandler();
                if (pollInterval) {
                    clearInterval(pollInterval);
                    pollInterval = null;
                }
                // Remove highlight from current target immediately
                target.classList.remove('tutorial-clickable');
                document.querySelectorAll('.tutorial-click-hint').forEach(el => el.remove());
                setTimeout(() => this.next(), 300);
                return true;
            }
            return false;
        };

        // Check if already complete
        if (checkComplete()) return;

        // For checkbox-based targets (like sidebar-expand), listen to the checkbox change
        if (step.waitFor && step.waitFor.includes(':checked')) {
            const checkboxId = step.waitFor.replace(':checked', '').replace('#', '');
            const checkbox = document.getElementById(checkboxId);

            if (checkbox) {
                const changeHandler = () => {
                    if (checkbox.checked) {
                        checkbox.removeEventListener('change', changeHandler);
                        checkComplete();
                    }
                };
                checkbox.addEventListener('change', changeHandler);
            }
        }

        // Listen for clicks on target and let them through
        this.activeClickHandler = (e) => {
            // Check if clicked on target or its children
            if (target.contains(e.target) || e.target === target) {
                // Don't prevent default - let the click work naturally
                // Check completion after a short delay to allow the action to complete
                setTimeout(() => {
                    checkComplete();
                }, 150);
            }
        };

        document.addEventListener('click', this.activeClickHandler, true);

        // Also poll for condition (as a fallback)
        pollInterval = setInterval(() => {
            if (!this.isActive || !this.waitingForAction) {
                clearInterval(pollInterval);
                pollInterval = null;
                return;
            }
            if (checkComplete()) {
                clearInterval(pollInterval);
                pollInterval = null;
            }
        }, 200);
    },

    checkWaitCondition(condition) {
        if (!condition) return true;

        // Hash-based condition
        if (condition.startsWith('hash:')) {
            const expectedHash = condition.replace('hash:', '');
            return window.location.hash === expectedHash;
        }

        // Checkbox :checked condition - just check if element exists (selector matches)
        if (condition.includes(':checked')) {
            const element = document.querySelector(condition);
            // If the selector matches, the checkbox is checked
            return element !== null;
        }

        // Element visible condition (CSS selector)
        const element = document.querySelector(condition);
        if (element) {
            // Check if visible (for modals, etc.)
            const style = window.getComputedStyle(element);
            return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
        }

        return false;
    },

    checkActionComplete() {
        const step = this.steps[this.currentStep];
        if (step && step.waitFor && this.checkWaitCondition(step.waitFor)) {
            this.waitingForAction = false;
            this.removeClickHandler();
            setTimeout(() => this.next(), 300);
        }
    },

    positionTooltip(tooltip, targetRect, position) {
        const tooltipRect = tooltip.getBoundingClientRect();
        const margin = 20;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let top, left;
        let finalPosition = position;

        // Calculate available space in each direction
        const spaceRight = viewportWidth - targetRect.right - margin;
        const spaceLeft = targetRect.left - margin;
        const spaceBottom = viewportHeight - targetRect.bottom - margin;
        const spaceTop = targetRect.top - margin;

        switch (position) {
            case 'right':
                left = targetRect.right + margin;
                // Align top of tooltip with top of target, then adjust if needed
                top = targetRect.top;

                // If tooltip would go off right edge, try left
                if (spaceRight < tooltipRect.width && spaceLeft > tooltipRect.width) {
                    finalPosition = 'left';
                    left = targetRect.left - tooltipRect.width - margin;
                }
                break;

            case 'left':
                left = targetRect.left - tooltipRect.width - margin;
                top = targetRect.top;

                // If tooltip would go off left edge, try right
                if (spaceLeft < tooltipRect.width && spaceRight > tooltipRect.width) {
                    finalPosition = 'right';
                    left = targetRect.right + margin;
                }
                break;

            case 'bottom':
                top = targetRect.bottom + margin;
                left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);

                // If tooltip would go off bottom, try top
                if (spaceBottom < tooltipRect.height && spaceTop > tooltipRect.height) {
                    finalPosition = 'top';
                    top = targetRect.top - tooltipRect.height - margin;
                }
                break;

            case 'top':
                top = targetRect.top - tooltipRect.height - margin;
                left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);

                // If tooltip would go off top, try bottom
                if (spaceTop < tooltipRect.height && spaceBottom > tooltipRect.height) {
                    finalPosition = 'bottom';
                    top = targetRect.bottom + margin;
                }
                break;

            default:
                finalPosition = 'right';
                left = targetRect.right + margin;
                top = targetRect.top;
        }

        // Clamp to viewport - ensure tooltip stays within bounds
        top = Math.max(margin, Math.min(top, viewportHeight - tooltipRect.height - margin));
        left = Math.max(margin, Math.min(left, viewportWidth - tooltipRect.width - margin));

        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;
        tooltip.setAttribute('data-position', finalPosition);
    }
};

// Initialize tutorial on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    Tutorial.init();
});
