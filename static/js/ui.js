import { api } from './api.js';

let drawerCloseTimeout = null;

export const ui = {
    clearError() {
        const authErrorEl = document.getElementById('auth-error');
        if (authErrorEl) {
            authErrorEl.textContent = '';
            authErrorEl.style.display = 'none';
        }
    },

    showError(message) {
        if (!message) {
            this.clearError();
            return;
        }

        const authErrorEl = document.getElementById('auth-error');
        if (authErrorEl) {
            authErrorEl.textContent = message;
            authErrorEl.style.display = 'block';
            return;
        }

        alert(message);
    },

    escapeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    showScreen(screenId) {
        const screens = ['landing-screen', 'auth-screen', 'app-screen'];
        screens.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                if (id === screenId) {
                    if (el.classList.contains('hidden')) {
                        // Prepare for animation
                        el.style.opacity = '0';
                        el.style.transform = 'translateY(15px)';
                        el.style.transition = 'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
                        
                        el.classList.remove('hidden');
                        
                        // Force reflow
                        void el.offsetWidth;
                        
                        // Execute animation
                        el.style.opacity = '1';
                        el.style.transform = 'translateY(0)';
                        
                        // Dispatch event and auto-focus Google button when auth screen loads
                        if (id === 'auth-screen') {
                            window.dispatchEvent(new CustomEvent('auth-screen-shown'));
                            setTimeout(() => {
                                const googleBtn = document.getElementById('google-btn-container');
                                if (googleBtn) {
                                    googleBtn.setAttribute('tabindex', '0');
                                    googleBtn.focus();
                                    googleBtn.style.outline = 'none'; // Avoid harsh outline if click-focused
                                }
                            }, 400);
                        }
                    }
                } else {
                    el.classList.add('hidden');
                }
            }
        });
    },

    setCaptureState(isSaving) {
        const btn = document.getElementById('capture-btn');
        const input = document.getElementById('capture-input');
        
        if (isSaving) {
            btn.disabled = true;
            btn.innerHTML = 'Capturing...';
        } else {
            btn.disabled = false;
            btn.innerHTML = 'Capture';
            if (input) {
                input.disabled = false;
            }
        }
    },

    fixCaptureState(isSaving) {
        const btn = document.getElementById('capture-btn');
        if (isSaving) {
            btn.disabled = true;
            btn.innerHTML = 'Capturing...';
        } else {
            const input = document.getElementById('capture-input');
            btn.disabled = input.value.trim().length === 0;
            btn.innerHTML = 'Capture';
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
        if (!input || !count || !btn) return;
        
        // Truncate if raw content exceeds 5000 characters
        if (input.value.length > 5000) {
            input.value = input.value.slice(0, 5000);
        }

        const len = input.value.length;
        const trimmedLen = input.value.trim().length;

        count.textContent = `${len.toLocaleString()} / 5,000`;

        if (len >= 5000) {
            count.style.color = '#E53E3E'; // Red
            count.textContent = 'Maximum memory size reached (5,000 / 5,000)';
            btn.disabled = true;
        } else if (len >= 4900) {
            count.style.color = '#E53E3E'; // Red
            btn.disabled = trimmedLen === 0;
        } else if (len >= 4500) {
            count.style.color = '#DD6B20'; // Amber
            btn.disabled = trimmedLen === 0;
        } else {
            count.style.color = 'var(--text-secondary)';
            btn.disabled = trimmedLen === 0;
        }
    },

    setTimelineLoading() {
        const container = document.getElementById('memory-feed');
        container.innerHTML = `
            <div class="timeline-loading skeleton-container">
                <div class="memory-card">
                    <div class="skeleton skeleton-title"></div>
                    <div class="skeleton skeleton-text"></div>
                    <div class="skeleton skeleton-text medium"></div>
                </div>
                <div class="memory-card">
                    <div class="skeleton skeleton-title"></div>
                    <div class="skeleton skeleton-text medium"></div>
                </div>
            </div>`;
    },

    renderTimeline(memories, onDeleteClick, onEditTitleClick) {
        const container = document.getElementById('memory-feed');
        const emptyState = document.getElementById('empty-state');
        const feedCount = document.getElementById('feed-count');
        
        container.innerHTML = '';

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

    setSearchLoading() {
        const section = document.getElementById('search-results-section');
        const feed = document.getElementById('search-results-feed');
        const recent = document.getElementById('recent-captures-section');
        
        section.classList.remove('hidden');
        recent.classList.add('hidden');
        
        feed.innerHTML = `
            <div class="timeline-loading skeleton-container">
                <div class="memory-card">
                    <div class="skeleton skeleton-title"></div>
                    <div class="skeleton skeleton-text"></div>
                </div>
            </div>`;
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
                    <div class="empty-state-icon" aria-hidden="true">🔍</div>
                    <div class="empty-state-title">No matching memories</div>
                    <p class="empty-state-desc">I couldn't remember anything matching that. Try asking differently.</p>
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

    createMemoryCard(memory) {
        const article = document.createElement('article');
        article.className = 'memory-card';
        article.id = `memory-${memory.id}`;
        article.dataset.aiStatus = memory.ai_status;

        const isLink = memory.memory_type === 'link';
        const typeBadge = isLink ? '🔗 Link' : '📝 Note';

        // Title Rendering Priority: User Title -> Enriched Title -> Temporary Title
        let titleText = '';
        if (memory.link_title) {
            titleText = memory.link_title;
        } else if (memory.ai_title && memory.ai_title.trim() !== '') {
            titleText = memory.ai_title;
        } else {
            titleText = isLink ? 'Link Saved' : 'New Memory';
        }

        const headerHtml = `
            <div class="memory-card-header">
                <div class="memory-card-type-badge">${typeBadge}</div>
                <h3 class="memory-card-title">${this.escapeHTML(titleText)}</h3>
            </div>`;

        // Card Preview Priority: Enriched Summary -> Original Content / Link URL
        let summaryHtml = '';
        if (memory.ai_summary && memory.ai_summary.trim() !== '' && memory.ai_summary !== memory.url) {
            summaryHtml = `<p class="memory-card-summary">${this.escapeHTML(memory.ai_summary)}</p>`;
        }

        let rawPreview = memory.raw_content || '';
        if (rawPreview.length > 140) {
            rawPreview = rawPreview.slice(0, 140) + '...';
        }

        let bodyHtml = '';
        if (isLink) {
            const url = memory.url || memory.raw_content;
            bodyHtml = `
                <div class="memory-card-body">
                    ${summaryHtml}
                    <p class="memory-card-content" style="font-size: 0.85rem; color: var(--text-tertiary);">${this.escapeHTML(url)}</p>
                </div>`;
        } else {
            bodyHtml = `
                <div class="memory-card-body">
                    ${summaryHtml}
                    <p class="memory-card-content">${this.escapeHTML(rawPreview)}</p>
                </div>`;
        }

        const dateObj = new Date(memory.created_at);
        const dateString = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

        article.innerHTML = `
            ${headerHtml}
            ${bodyHtml}
            <div class="memory-card-footer">
                <time class="memory-card-time" datetime="${memory.created_at}">${dateString}</time>
                <button class="btn btn-outline memory-card-open-btn" style="padding: 6px 14px; font-size: 0.8rem; border-radius: 6px; margin: 0; min-height: unset; line-height: 1.2;" aria-label="Open memory details">Open</button>
            </div>
        `;

        // On click: dispatch event → app.js handles navigation (avoids circular imports)
        article.addEventListener('click', (e) => {
            if (e.target.tagName === 'A') return;
            window.dispatchEvent(new CustomEvent('me:open-memory', { detail: { id: memory.id } }));
        });

        // On hover: prefetch
        article.addEventListener('mouseenter', () => {
            window.dispatchEvent(new CustomEvent('me:prefetch-memory', { detail: { id: memory.id } }));
        }, { once: true });

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
    
    setAskLoading(isLoading) {
        const btn = document.getElementById('ask-btn');
        const input = document.getElementById('ask-input');
        const container = document.getElementById('ask-response-container');
        const loading = document.getElementById('ask-loading');
        const content = document.getElementById('ask-answer-content');
        
        if (isLoading) {
            btn.disabled = true;
            btn.textContent = 'Thinking...';
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
        
        const refs = data.referenced_memories || data.sources || [];

        if (refs.length > 0) {
            count.textContent = refs.length;
            sourcesGrid.innerHTML = refs.map(ref => {
                const badge = ref.memory_type === 'link' ? '🔗 Link' : '📝 Note';
                const dateStr = ref.created_at ? new Date(ref.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '';
                return `
                    <div class="source-card memory-reference-card" data-memory-id="${ref.id}">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                            <span class="memory-card-type-badge">${badge}</span>
                            <span class="body-small" style="color: var(--text-tertiary); font-size: 0.75rem;">${dateStr}</span>
                        </div>
                        <div class="source-title" style="font-weight: 600; font-size: 0.95rem; margin-bottom: 4px; color: var(--text-primary);">${this.escapeHTML(ref.title)}</div>
                        <div class="source-summary" style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.4;">${this.escapeHTML(ref.preview || ref.summary || '')}</div>
                    </div>
                `;
            }).join('');
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
    },

    // -----------------------------------------------------------------------
    // Memory Viewer — Pure Presentation Layer
    // Data fetching is NEVER done here. The MemoryController is responsible.
    // -----------------------------------------------------------------------

    /**
     * Open the viewer immediately with a skeleton loading state.
     * Called by MemoryController before the API fetch completes.
     */
    openMemoryViewerLoading() {
        this._showViewerPanel();
        document.getElementById('drawer-type-badge').textContent = '';
        document.getElementById('drawer-date').textContent = '';
        document.getElementById('drawer-title').textContent = '';
        document.getElementById('drawer-content-text').innerHTML = `
            <div style="display:flex;flex-direction:column;gap:8px;margin-top:4px;">
                <div style="
                    width:100%;min-height:180px;border-radius:8px;
                    background:var(--bg-secondary,#faf8f5);border:1.5px solid var(--border-subtle,#e5e0d8);
                    display:flex;flex-direction:column;gap:10px;padding:14px;">
                    <div class="skeleton skeleton-text" style="width:90%;"></div>
                    <div class="skeleton skeleton-text" style="width:75%;"></div>
                    <div class="skeleton skeleton-text medium" style="width:85%;"></div>
                    <div class="skeleton skeleton-text" style="width:60%;"></div>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div class="skeleton" style="width:60px;height:14px;border-radius:4px;"></div>
                    <div class="skeleton" style="width:70px;height:30px;border-radius:6px;"></div>
                </div>
            </div>`;
        document.getElementById('drawer-summary-container').classList.add('hidden');
        document.getElementById('drawer-link-container').classList.add('hidden');
        document.getElementById('drawer-related-container').classList.add('hidden');
        this._clearViewerError();
    },


    /**
     * Open the viewer immediately with a cached or preview memory object.
     * Called by MemoryController on a cache hit.
     * @param {object} memory
     */
    openMemoryViewer(memory) {
        this._showViewerPanel();
        this.hydrateMemoryViewer(memory);
    },

    /**
     * Hydrate the viewer with a fully-loaded memory object.
     * Renders an inline note editor so the user can read and edit content.
     * Called by MemoryController after the API fetch completes.
     * @param {object} memory
     */
    hydrateMemoryViewer(memory) {
        this._clearViewerError();

        const isLink = memory.memory_type === 'link';
        const typeBadge = isLink ? '🔗 Link' : '📝 Note';
        const titleText = memory.link_title || memory.ai_title || memory.title || (isLink ? 'Link Saved' : 'New Memory');
        const rawContent = memory.raw_content || memory.preview || '';
        const dateObj = new Date(memory.created_at || Date.now());
        const dateString = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

        document.getElementById('drawer-type-badge').textContent = typeBadge;
        document.getElementById('drawer-date').textContent = dateString;
        document.getElementById('drawer-title').textContent = titleText;

        // --- Inline Note Editor ---
        // Replace the static div with an auto-growing textarea + save controls
        const contentArea = document.getElementById('drawer-content-text');
        contentArea.innerHTML = `
            <div id="note-editor-wrap" style="display:flex;flex-direction:column;gap:8px;">
                <textarea
                    id="note-editor-textarea"
                    style="
                        width: 100%;
                        min-height: 180px;
                        max-height: 60vh;
                        resize: none;
                        border: 1.5px solid var(--border-subtle, #e5e0d8);
                        border-radius: 8px;
                        padding: 12px 14px;
                        font-family: inherit;
                        font-size: 0.9375rem;
                        line-height: 1.65;
                        color: var(--text-primary);
                        background: var(--bg-secondary, #faf8f5);
                        outline: none;
                        transition: border-color 0.2s, box-shadow 0.2s;
                        overflow-y: auto;
                        word-break: break-word;
                    "
                    placeholder="Write your memory here..."
                    maxlength="5000"
                    aria-label="Memory content editor"
                >${this.escapeHTML(rawContent)}</textarea>
                <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
                    <span id="note-editor-count" style="font-size:0.78rem;color:var(--text-tertiary);">${rawContent.length} / 5,000</span>
                    <div style="display:flex;gap:6px;align-items:center;">
                        <span id="note-editor-status" style="font-size:0.78rem;color:var(--text-tertiary);opacity:0;transition:opacity 0.3s;"></span>
                        <button id="note-editor-save" class="btn btn-primary" style="padding: 6px 18px; font-size: 0.85rem;" disabled>Save</button>
                    </div>
                </div>
            </div>`;

        // Wire up editor logic
        const textarea = document.getElementById('note-editor-textarea');
        const saveBtn = document.getElementById('note-editor-save');
        const countEl = document.getElementById('note-editor-count');
        const statusEl = document.getElementById('note-editor-status');
        let originalContent = rawContent;

        // Auto-grow textarea
        const autoGrow = () => {
            textarea.style.height = 'auto';
            textarea.style.height = Math.min(textarea.scrollHeight, window.innerHeight * 0.6) + 'px';
        };
        autoGrow();

        // Focus style
        textarea.addEventListener('focus', () => {
            textarea.style.borderColor = 'var(--text-primary)';
            textarea.style.boxShadow = '0 0 0 3px rgba(0,0,0,0.06)';
        });
        textarea.addEventListener('blur', () => {
            textarea.style.borderColor = 'var(--border-subtle, #e5e0d8)';
            textarea.style.boxShadow = 'none';
        });

        // Input: char count, auto-grow, enable Save if changed
        textarea.addEventListener('input', () => {
            const len = textarea.value.length;
            countEl.textContent = `${len} / 5,000`;
            countEl.style.color = len >= 4900 ? '#E53E3E' : 'var(--text-tertiary)';
            autoGrow();
            const isDirty = textarea.value !== originalContent;
            saveBtn.disabled = !isDirty || len === 0;
            if (isDirty) {
                statusEl.textContent = '';
                statusEl.style.opacity = '0';
            }
        });

        // Save handler
        const doSave = async () => {
            const newContent = textarea.value.trim();
            if (!newContent || newContent === originalContent) return;

            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving…';
            statusEl.textContent = '';

            try {
                await api.updateMemoryContent(memory.id, newContent);

                originalContent = newContent;
                saveBtn.textContent = 'Save';
                statusEl.textContent = '✓ Saved';
                statusEl.style.color = '#38A169';
                statusEl.style.opacity = '1';
                setTimeout(() => { statusEl.style.opacity = '0'; }, 2500);

                window.dispatchEvent(new CustomEvent('me:invalidate-memory', { detail: { id: memory.id } }));
                window.dispatchEvent(new CustomEvent('me:memory-mutated', { detail: { id: memory.id } }));
            } catch (err) {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save';
                statusEl.textContent = '⚠ ' + (err.message || 'Save failed');
                statusEl.style.color = '#E53E3E';
                statusEl.style.opacity = '1';
            }
        };

        saveBtn.addEventListener('click', doSave);

        // Keyboard shortcut: Ctrl+S / Cmd+S saves without leaving the viewer
        textarea.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();
                doSave();
            }
        });

        // --- Summary section ---
        const summaryContainer = document.getElementById('drawer-summary-container');
        const summaryText = document.getElementById('drawer-summary-text');
        if (memory.ai_summary && memory.ai_summary.trim() !== '' && memory.ai_summary !== memory.url) {
            summaryText.textContent = memory.ai_summary;
            summaryContainer.classList.remove('hidden');
        } else {
            summaryContainer.classList.add('hidden');
        }

        // --- Link section ---
        const linkContainer = document.getElementById('drawer-link-container');
        const linkUrl = document.getElementById('drawer-link-url');
        if (isLink || memory.url) {
            const targetUrl = memory.url || rawContent;
            linkUrl.textContent = targetUrl;
            linkUrl.href = targetUrl;
            linkContainer.classList.remove('hidden');
        } else {
            linkContainer.classList.add('hidden');
        }

        // --- Action buttons ---
        const copyBtn = document.getElementById('drawer-copy-btn');
        if (copyBtn) {
            copyBtn.onclick = () => {
                navigator.clipboard.writeText(textarea.value || rawContent);
                const orig = copyBtn.textContent;
                copyBtn.textContent = 'Copied!';
                setTimeout(() => { copyBtn.textContent = orig; }, 2000);
            };
        }

        const editBtn = document.getElementById('drawer-edit-btn');
        if (editBtn) {
            editBtn.onclick = async () => {
                const currentTitle = memory.link_title || memory.ai_title || memory.title || '';
                const newTitle = prompt('Enter a new title for this memory:', currentTitle);
                if (newTitle === null) return;
                try {
                    await api.updateMemoryTitle(memory.id, newTitle.trim());
                    document.getElementById('drawer-title').textContent = newTitle.trim() || titleText;
                    window.dispatchEvent(new CustomEvent('me:invalidate-memory', { detail: { id: memory.id } }));
                    window.dispatchEvent(new CustomEvent('me:memory-mutated', { detail: { id: memory.id } }));
                } catch (err) {
                    alert(err.message);
                }
            };
        }

        const deleteBtn = document.getElementById('drawer-delete-btn');
        if (deleteBtn) {
            deleteBtn.onclick = async () => {
                if (!confirm('Are you sure you want to delete this memory?')) return;
                deleteBtn.disabled = true;
                deleteBtn.textContent = 'Deleting...';
                try {
                    await api.deleteMemory(memory.id);
                    window.dispatchEvent(new CustomEvent('me:invalidate-memory', { detail: { id: memory.id } }));
                    window.dispatchEvent(new CustomEvent('me:navigate', { detail: { path: '/dashboard' } }));
                    window.dispatchEvent(new CustomEvent('me:memory-mutated', { detail: { id: memory.id, deleted: true } }));
                } catch (err) {
                    deleteBtn.disabled = false;
                    deleteBtn.textContent = 'Delete Memory';
                    alert(err.message);
                }
            };
        }

        // Clear related grid while controller fetches them
        document.getElementById('drawer-related-container').classList.add('hidden');
        document.getElementById('drawer-related-grid').innerHTML = '';
    },

    /**
     * Render related memories into the viewer panel.
     * Called by MemoryController after related fetch completes.
     * @param {object[]} related
     */
    renderRelatedMemories(related) {
        const relatedContainer = document.getElementById('drawer-related-container');
        const relatedGrid = document.getElementById('drawer-related-grid');
        if (!relatedContainer || !relatedGrid) return;
        if (!related || related.length === 0) return;

        relatedGrid.innerHTML = related.map(rel => {
            const badge = rel.memory_type === 'link' ? '🔗 Link' : '📝 Note';
            return `
                <div class="source-card memory-reference-card" data-memory-id="${rel.id}" style="padding: 10px 12px; margin-bottom: 0; cursor: pointer;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                        <span class="memory-card-type-badge" style="font-size: 0.7rem;">${badge}</span>
                    </div>
                    <div class="source-title" style="font-weight: 600; font-size: 0.875rem; color: var(--text-primary);">${this.escapeHTML(rel.title || rel.ai_title || 'Memory')}</div>
                    <div class="source-summary" style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.3;">${this.escapeHTML(rel.preview || '')}</div>
                </div>`;
        }).join('');
        relatedContainer.classList.remove('hidden');
    },

    /**
     * Show an error state inside the viewer without closing it.
     * @param {string} message
     * @param {Function} onRetry
     */
    showMemoryViewerError(message, onRetry) {
        this._showViewerPanel();
        document.getElementById('drawer-content-text').innerHTML = `
            <div style="text-align: center; padding: 32px 0;">
                <div style="font-size: 2rem; margin-bottom: 12px;">⚠️</div>
                <div style="font-size: 0.95rem; color: var(--text-secondary); margin-bottom: 20px;">${this.escapeHTML(message || 'Unable to load memory.')}</div>
                <button id="viewer-retry-btn" class="btn btn-outline" style="margin-bottom: 8px; width: 100%;">Retry</button>
            </div>`;
        const retryBtn = document.getElementById('viewer-retry-btn');
        if (retryBtn && onRetry) retryBtn.onclick = onRetry;
    },

    /**
     * Close the Memory Viewer with a slide-out animation.
     * Called exclusively by the Router / MemoryController.
     */
    closeMemoryViewer() {
        const backdrop = document.getElementById('memory-drawer-backdrop');
        const drawer = document.getElementById('memory-detail-drawer');
        if (!drawer) return;

        drawer.classList.add('hidden-slide');

        if (drawerCloseTimeout) clearTimeout(drawerCloseTimeout);
        drawerCloseTimeout = setTimeout(() => {
            if (backdrop) backdrop.classList.add('hidden');
            if (drawer) drawer.classList.add('hidden');
            drawerCloseTimeout = null;
        }, 300);
    },

    // Legacy alias — keeps backward compat for any remaining call sites
    closeMemoryDrawer() { this.closeMemoryViewer(); },

    // Private: show the panel itself without populating content
    _showViewerPanel() {
        if (drawerCloseTimeout) {
            clearTimeout(drawerCloseTimeout);
            drawerCloseTimeout = null;
        }
        const backdrop = document.getElementById('memory-drawer-backdrop');
        const drawer = document.getElementById('memory-detail-drawer');
        if (!backdrop || !drawer) return;
        backdrop.classList.remove('hidden');
        drawer.classList.remove('hidden', 'hidden-slide');
    },

    _clearViewerError() {
        // Nothing specific to clear — error state is just content inside drawer-content-text
    },
};

