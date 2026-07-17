/**
 * UI Module
 * Handles DOM manipulation, rendering, and UI state.
 */

export const ui = {
    // -------------------------------------------------------------------------
    // Utility & Error Messaging
    // -------------------------------------------------------------------------
    
    showError(message) {
        // A simple alert as requested for Version 1
        alert(message);
    },

    escapeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    // -------------------------------------------------------------------------
    // Screens
    // -------------------------------------------------------------------------

    showScreen(screenId) {
        const screens = ['auth-screen', 'app-screen'];
        screens.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                if (id === screenId) {
                    el.classList.remove('hidden');
                } else {
                    el.classList.add('hidden');
                }
            }
        });
    },

    // -------------------------------------------------------------------------
    // Capture UI
    // -------------------------------------------------------------------------

    setCaptureState(isSaving) {
        const btn = document.getElementById('capture-btn');
        const input = document.getElementById('capture-input');
        
        if (isSaving) {
            btn.disabled = true;
            btn.innerHTML = 'Saving...';
            // Do not disable the entire textarea. Only disable the button.
        } else {
            btn.disabled = false;
            btn.innerHTML = `
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <line x1="8" y1="2" x2="8" y2="14"/>
                    <line x1="2" y1="8" x2="14" y2="8"/>
                </svg>
                Capture
            `;
            if (input) {
                input.disabled = false;
            }
        }
    },

    fixCaptureState(isSaving) {
        const btn = document.getElementById('capture-btn');
        if (isSaving) {
            btn.disabled = true;
            btn.innerHTML = 'Saving...';
        } else {
            const input = document.getElementById('capture-input');
            btn.disabled = input.value.trim().length === 0;
            btn.innerHTML = `
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <line x1="8" y1="2" x2="8" y2="14"/>
                    <line x1="2" y1="8" x2="14" y2="8"/>
                </svg>
                Capture
            `;
        }
    },

    clearCaptureInput() {
        const input = document.getElementById('capture-input');
        input.value = '';
        this.updateCharCount();
        input.focus();
    },

    updateCharCount() {
        const input = document.getElementById('capture-input');
        const count = document.getElementById('char-count');
        const btn = document.getElementById('capture-btn');
        
        const len = input.value.trim().length;
        count.textContent = `${len.toLocaleString()} / 5,000`;
        btn.disabled = len === 0;
    },

    // -------------------------------------------------------------------------
    // Timeline UI
    // -------------------------------------------------------------------------

    setTimelineLoading() {
        const container = document.getElementById('memory-feed');
        container.innerHTML = '<div class="timeline-loading">Loading memories...</div>';
    },

    renderTimeline(memories, onDeleteClick, onEditTitleClick) {
        const container = document.getElementById('memory-feed');
        const emptyState = document.getElementById('empty-state');
        const feedCount = document.getElementById('feed-count');
        
        container.innerHTML = ''; // Clear current memories

        if (!memories || memories.length === 0) {
            if (emptyState) emptyState.classList.remove('hidden');
            if (container) container.classList.add('hidden');
            if (feedCount) feedCount.textContent = '0';
            return;
        }

        if (emptyState) emptyState.classList.add('hidden');
        if (container) container.classList.remove('hidden');
        if (feedCount) feedCount.textContent = memories.length.toString();

        memories.forEach(memory => {
            const card = this.createMemoryCard(memory, onDeleteClick, onEditTitleClick);
            container.appendChild(card);
        });
    },

    // -------------------------------------------------------------------------
    // Search UI
    // -------------------------------------------------------------------------

    setSearchLoading() {
        const section = document.getElementById('search-results-section');
        const feed = document.getElementById('search-results-feed');
        const recent = document.getElementById('recent-captures-section');
        
        section.classList.remove('hidden');
        recent.classList.add('hidden');
        
        feed.innerHTML = '<div class="timeline-loading">Searching memories...</div>';
    },

    renderSearchResults(results, onDeleteClick, onEditTitleClick) {
        const section = document.getElementById('search-results-section');
        const feed = document.getElementById('search-results-feed');
        const recent = document.getElementById('recent-captures-section');
        
        section.classList.remove('hidden');
        recent.classList.add('hidden');
        
        feed.innerHTML = '';
        
        if (results.length === 0) {
            feed.innerHTML = `
                <div class="empty-state">
                    <p>We couldn't find any memories matching your search.</p>
                </div>
            `;
            return;
        }

        results.forEach(memory => {
            const card = this.createMemoryCard(memory, onDeleteClick, onEditTitleClick);
            feed.appendChild(card);
        });
    },

    clearSearch() {
        const input = document.getElementById('search-input');
        if (input) {
            input.value = '';
        }
        
        document.getElementById('search-results-section').classList.add('hidden');
        document.getElementById('recent-captures-section').classList.remove('hidden');
    },

    createMemoryCard(memory, onDeleteClick, onEditTitleClick) {
        const article = document.createElement('article');
        article.className = 'memory-card';
        article.id = `memory-${memory.id}`;
        article.dataset.aiStatus = memory.ai_status;

        // Apply content-type modifier class
        if (memory.memory_type === 'link') {
            article.classList.add('memory-card--link');
        }

        const isPending = memory.ai_status === 'pending' || memory.ai_status === 'processing';
        const isFailed = memory.ai_status === 'failed';
        const isLink = memory.memory_type === 'link';

        let headerHtml = '';
        let bodyHtml = '';

        if (isLink) {
            // -------------------------------------------------------------------
            // LINK card rendering
            // Always renders with icon, title, domain badge, and clickable URL.
            // Status (pending/failed/ready) still applies to the status badge only.
            // -------------------------------------------------------------------
            const title = memory.link_title || memory.ai_title || 'Saved Link';
            const domain = memory.domain || '';
            const url = memory.url || memory.raw_content;

            const statusBadge = isPending
                ? `<div class="spinner"></div>`
                : isFailed
                    ? `<span class="memory-card-status error">Failed</span>`
                    : '';

            headerHtml = `
                <div class="memory-card-header">
                    <div class="memory-card-link-header">
                        <span class="memory-card-link-icon" aria-hidden="true">🔗</span>
                        <h3 class="memory-card-title">${this.escapeHTML(title)}</h3>
                    </div>
                    ${statusBadge}
                </div>`;

            bodyHtml = `
                <div class="memory-card-body">
                    ${domain ? `<span class="memory-card-domain-badge">${this.escapeHTML(domain)}</span>` : ''}
                    <a
                        href="${this.escapeHTML(url)}"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="memory-card-link-url"
                        title="${this.escapeHTML(url)}"
                    >${this.escapeHTML(url)}</a>
                </div>`;

        } else {
            // -------------------------------------------------------------------
            // TEXT card rendering — unchanged from V1.0
            // -------------------------------------------------------------------
            if (isPending) {
                headerHtml = `
                    <div class="memory-card-header">
                        <h3 class="memory-card-title processing">Processing AI enrichment...</h3>
                        <div class="spinner"></div>
                    </div>`;
                bodyHtml = `<div class="memory-card-body"><p class="memory-card-content">${this.escapeHTML(memory.raw_content)}</p></div>`;
            } else if (isFailed) {
                headerHtml = `
                    <div class="memory-card-header">
                        <h3 class="memory-card-title failed">Original Memory</h3>
                        <span class="memory-card-status error">Enrichment Failed</span>
                    </div>`;
                bodyHtml = `<div class="memory-card-body"><p class="memory-card-content">${this.escapeHTML(memory.raw_content)}</p></div>`;
            } else {
                const titleText = memory.ai_title || 'Untitled Memory';
                headerHtml = `
                    <div class="memory-card-header">
                        <h3 class="memory-card-title">${this.escapeHTML(titleText)}</h3>
                    </div>`;
                bodyHtml = `
                    <div class="memory-card-body">
                        ${memory.ai_summary ? `<p class="memory-card-summary">${this.escapeHTML(memory.ai_summary)}</p>` : ''}
                        <p class="memory-card-content raw-content-preview">${this.escapeHTML(memory.raw_content)}</p>
                    </div>`;
            }
        }

        // Format date
        const dateObj = new Date(memory.created_at);
        const timeString = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateString = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });

        article.innerHTML = `
            ${headerHtml}
            ${bodyHtml}
            <div class="memory-card-footer">
                <time class="memory-card-time" datetime="${memory.created_at}">${dateString} at ${timeString}</time>
                <div class="memory-card-actions">
                    ${isLink ? '<button class="nav-btn edit-title-btn" aria-label="Edit title">Edit Title</button>' : ''}
                    <button class="nav-btn danger delete-btn" aria-label="Delete memory">
                        Delete
                    </button>
                </div>
            </div>
        `;

        const deleteBtn = article.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to delete this thought?')) {
                const originalText = deleteBtn.innerHTML;
                deleteBtn.innerHTML = 'Deleting...';
                deleteBtn.disabled = true;

                onDeleteClick(memory.id).catch(err => {
                    deleteBtn.innerHTML = originalText;
                    deleteBtn.disabled = false;
                    this.showError(err.message);
                });
            }
        });

        const editTitleBtn = article.querySelector('.edit-title-btn');
        if (editTitleBtn && onEditTitleClick) {
            editTitleBtn.addEventListener('click', () => {
                const newTitle = prompt('Enter a new title for this link:', memory.link_title || memory.ai_title || '');
                if (newTitle !== null) {
                    const originalText = editTitleBtn.innerHTML;
                    editTitleBtn.innerHTML = 'Saving...';
                    editTitleBtn.disabled = true;

                    onEditTitleClick(memory.id, newTitle).catch(err => {
                        editTitleBtn.innerHTML = originalText;
                        editTitleBtn.disabled = false;
                        this.showError(err.message);
                    });
                }
            });
        }

        return article;
    },

    updateMemoryCard(memory, onDeleteClick, onEditTitleClick) {
        const oldCard = document.getElementById(`memory-${memory.id}`);
        if (oldCard) {
            const newCard = this.createMemoryCard(memory, onDeleteClick, onEditTitleClick);
            oldCard.replaceWith(newCard);
        }
    },

    removeMemoryCard(id) {
        const card = document.getElementById(`memory-${id}`);
        if (card) {
            card.remove();
            
            // Check if feed is now empty
            const feed = document.getElementById('memory-feed');
            if (feed.children.length === 0) {
                document.getElementById('empty-state').classList.remove('hidden');
                feed.classList.add('hidden');
                document.getElementById('feed-count').textContent = '0';
            } else {
                document.getElementById('feed-count').textContent = feed.children.length.toString();
            }
        }
    },
    
    // -------------------------------------------------------------------------
    // Ask ME UI
    // -------------------------------------------------------------------------
    
    setAskLoading(isLoading) {
        const btn = document.getElementById('ask-btn');
        const input = document.getElementById('ask-input');
        const container = document.getElementById('ask-response-container');
        const loading = document.getElementById('ask-loading');
        const content = document.getElementById('ask-answer-content');
        
        if (isLoading) {
            btn.disabled = true;
            btn.textContent = 'Asking...';
            input.disabled = true;
            container.classList.remove('hidden');
            loading.classList.remove('hidden');
            content.classList.add('hidden');
        } else {
            btn.disabled = false;
            btn.textContent = 'Ask';
            input.disabled = false;
            loading.classList.add('hidden');
        }
    },
    
    renderAskAnswer(data) {
        const content = document.getElementById('ask-answer-content');
        const text = document.getElementById('ask-answer-text');
        const sourcesGrid = document.getElementById('ask-sources-grid');
        const count = document.getElementById('ask-sources-count');
        
        text.innerHTML = this.escapeHTML(data.answer).replace(/\n/g, '<br>');
        
        if (data.sources && data.sources.length > 0) {
            count.textContent = data.sources.length;
            sourcesGrid.innerHTML = data.sources.map(src => `
                <div class="source-card">
                    <div class="source-title">Source ${src.memory_id}: ${this.escapeHTML(src.title)}</div>
                    <div class="source-summary">${this.escapeHTML(src.summary)}</div>
                </div>
            `).join('');
            document.getElementById('ask-sources-header').classList.remove('hidden');
        } else {
            sourcesGrid.innerHTML = '';
            document.getElementById('ask-sources-header').classList.add('hidden');
        }
        
        content.classList.remove('hidden');
    },
    
    clearAskAnswer() {
        const input = document.getElementById('ask-input');
        input.value = '';
        document.getElementById('ask-response-container').classList.add('hidden');
    }
};
