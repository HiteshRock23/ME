import { api } from './api.js';
import { analytics } from './analytics.js';

let drawerCloseTimeout = null;

export const ui = {
    _isEditorDirty: false,

    hasUnsavedChanges() {
        return this._isEditorDirty;
    },

    resetUnsavedChanges() {
        this._isEditorDirty = false;
    },

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

    showToast(message) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        toast.setAttribute('role', 'alert');

        container.appendChild(toast);

        // Force reflow for animation
        void toast.offsetWidth;
        toast.classList.add('visible');

        setTimeout(() => {
            toast.classList.remove('visible');
            toast.addEventListener('transitionend', () => {
                toast.remove();
            });
        }, 3000);
    },

    escapeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    showScreen(screenId) {
        const screens = ['landing-screen', 'auth-screen', 'app-screen', 'dump-screen', 'save-link-screen'];
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

        // Auto-grow capture input height dynamically
        input.style.height = 'auto';
        input.style.height = input.scrollHeight + 'px';

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
        const pinnedSection = document.getElementById('pinned-captures-section');
        const pinnedFeed = document.getElementById('pinned-memory-feed');
        const pinnedEmptyState = document.getElementById('pinned-empty-state');
        const pinnedCountEl = document.getElementById('pinned-feed-count');

        const recentContainer = document.getElementById('memory-feed');
        const recentEmptyState = document.getElementById('empty-state');
        const feedCount = document.getElementById('feed-count');

        if (recentContainer) recentContainer.innerHTML = '';
        if (pinnedFeed) pinnedFeed.innerHTML = '';

        if (!memories || memories.length === 0) {
            if (recentEmptyState) recentEmptyState.classList.remove('hidden');
            if (recentContainer) recentContainer.classList.add('hidden');
            if (feedCount) feedCount.textContent = '[0]';
            if (pinnedSection) pinnedSection.classList.add('hidden');
            return;
        }

        const pinnedMemories = memories
            .filter(m => m.is_pinned || m.pinned_at != null)
            .sort((a, b) => new Date(b.pinned_at || 0) - new Date(a.pinned_at || 0));

        const recentMemories = memories
            .filter(m => !m.is_pinned && m.pinned_at == null);

        // Render Pinned Section
        if (pinnedSection) {
            pinnedSection.classList.remove('hidden');
            if (pinnedCountEl) pinnedCountEl.textContent = `${pinnedMemories.length} of 5 pinned`;

            if (pinnedMemories.length === 0) {
                if (pinnedEmptyState) pinnedEmptyState.classList.remove('hidden');
            } else {
                if (pinnedEmptyState) pinnedEmptyState.classList.add('hidden');
                pinnedMemories.forEach(memory => {
                    const card = this.createMemoryCard(memory, onDeleteClick, onEditTitleClick);
                    pinnedFeed.appendChild(card);
                });
            }
        }

        // Render Recent Memories
        if (recentMemories.length === 0 && pinnedMemories.length > 0) {
            // All memories are pinned
            if (recentEmptyState) recentEmptyState.classList.add('hidden');
            if (recentContainer) recentContainer.classList.remove('hidden');
            if (feedCount) feedCount.textContent = '[0]';
        } else {
            if (recentEmptyState) recentEmptyState.classList.add('hidden');
            if (recentContainer) recentContainer.classList.remove('hidden');
            if (feedCount) feedCount.textContent = `[${recentMemories.length.toString()}]`;

            recentMemories.forEach(memory => {
                const card = this.createMemoryCard(memory, onDeleteClick, onEditTitleClick);
                recentContainer.appendChild(card);
            });
        }
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
        article.dataset.aiStatus  = memory.ai_status  || '';
        article.dataset.aiTitle   = memory.ai_title   || '';
        article.dataset.aiSummary = memory.ai_summary || '';
        article.dataset.thumbnail = memory.thumbnail_url || '';
        article.dataset.tags      = JSON.stringify(memory.tags || []);
        article.dataset.pinned    = (memory.is_pinned || memory.pinned_at != null) ? 'true' : 'false';

        const isLink = memory.memory_type === 'link';
        const typeLabel = isLink ? 'LINK' : 'NOTE';
        const isPinned = memory.is_pinned || memory.pinned_at != null;

        // Title Rendering Priority: User Title -> Enriched Title -> Temporary Title
        let titleText = '';
        if (memory.link_title) {
            titleText = memory.link_title;
        } else if (memory.ai_title && memory.ai_title.trim() !== '') {
            titleText = memory.ai_title;
        } else {
            titleText = isLink ? 'Link Saved' : 'New Memory';
        }

        const dateObj = new Date(memory.created_at || Date.now());
        const dateString = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

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
                ${summaryHtml}
                <p class="memory-card-link-text">${this.escapeHTML(url)}</p>
            `;
        } else {
            bodyHtml = `
                ${summaryHtml}
                <p class="memory-card-content">${this.escapeHTML(rawPreview)}</p>
            `;
        }

        article.innerHTML = `
            <div class="memory-card-content-wrapper">
                <div class="memory-card-main">
                    <div class="memory-card-top-row">
                        <h3 class="memory-card-title">${this.escapeHTML(titleText)}</h3>
                        ${isPinned ? '<span class="memory-card-pin-badge" title="Pinned memory" aria-label="Pinned">📌</span>' : ''}
                    </div>
                    ${bodyHtml}
                    <div class="memory-card-meta-row">
                        <time datetime="${memory.created_at}">${dateString}</time>
                        <span class="meta-separator">•</span>
                        <span class="meta-type-tag">${typeLabel}</span>
                    </div>
                </div>
                <div class="memory-card-arrow" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </div>
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
                document.getElementById('feed-count').textContent = '[0]';
            } else {
                document.getElementById('feed-count').textContent = `[${feed.children.length.toString()}]`;
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
            btn.textContent = 'Ask ME →';
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
            count.textContent = `[${refs.length}]`;
            sourcesGrid.innerHTML = refs.map(ref => {
                const badge = ref.memory_type === 'link' ? '🔗 Link' : '📝 Note';
                const dateStr = ref.created_at ? new Date(ref.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '';
                return `
                    <div class="source-card memory-reference-card" data-memory-id="${ref.id}">
                        <div class="drawer-meta-wrap">
                            <span class="memory-card-type-badge">${badge}</span>
                            <span class="drawer-date">${dateStr}</span>
                        </div>
                        <div class="source-title">${this.escapeHTML(ref.title)}</div>
                        <div class="source-summary">${this.escapeHTML(ref.preview || ref.summary || '')}</div>
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
            <div class="drawer-loading-wrap">
                <div class="drawer-loading-card">
                    <div class="skeleton skeleton-text skeleton-90"></div>
                    <div class="skeleton skeleton-text skeleton-75"></div>
                    <div class="skeleton skeleton-text medium skeleton-85"></div>
                    <div class="skeleton skeleton-text skeleton-60"></div>
                </div>
                <div class="drawer-loading-footer">
                    <div class="skeleton skeleton-meta"></div>
                    <div class="skeleton skeleton-btn"></div>
                </div>
            </div>`;
        document.getElementById('drawer-summary-container').classList.add('hidden');
        document.getElementById('drawer-thumbnail-container').classList.add('hidden');
        document.getElementById('drawer-tags-container').classList.add('hidden');
        document.getElementById('drawer-metadata-container').classList.add('hidden');
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
        this._isEditorDirty = false;

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
        // Redesigned premium editing experience
        const contentArea = document.getElementById('drawer-content-text');
        contentArea.innerHTML = `
            <div id="note-editor-wrap" class="note-editor-wrap">
                <div class="note-editor-container">
                    <textarea
                        id="note-editor-textarea"
                        class="note-editor-textarea"
                        placeholder="Write your memory here..."
                        maxlength="5000"
                        aria-label="Memory content editor"
                    >${this.escapeHTML(rawContent)}</textarea>
                </div>
                <div class="note-editor-meta">
                    <span id="note-editor-status" class="note-editor-status"></span>
                    <span id="note-editor-count" class="note-editor-count">${rawContent.length} / 5,000</span>
                </div>
                <button id="note-editor-save" class="btn btn-primary note-editor-save" disabled>Save Changes</button>
            </div>`;

        // Wire up editor logic
        const textarea = document.getElementById('note-editor-textarea');
        const saveBtn = document.getElementById('note-editor-save');
        const countEl = document.getElementById('note-editor-count');
        const statusEl = document.getElementById('note-editor-status');
        let originalContent = rawContent;

        // Autofocus editor and place cursor at the end
        textarea.focus();
        const initialLen = textarea.value.length;
        textarea.setSelectionRange(initialLen, initialLen);

        // Auto-grow textarea
        const autoGrow = () => {
            textarea.style.height = 'auto';
            textarea.style.height = Math.min(textarea.scrollHeight, window.innerHeight * 0.6) + 'px';
        };
        autoGrow();

        // Input: char count, auto-grow, enable Save if changed
        textarea.addEventListener('input', () => {
            const len = textarea.value.length;
            countEl.textContent = `${len} / 5,000`;
            countEl.style.color = len >= 4900 ? '#E53E3E' : 'var(--text-tertiary)';
            autoGrow();
            const isDirty = textarea.value !== originalContent;
            this._isEditorDirty = isDirty;
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
            saveBtn.classList.add('loading');
            statusEl.textContent = '';

            try {
                await api.updateMemoryContent(memory.id, newContent);

                originalContent = newContent;
                this._isEditorDirty = false;
                saveBtn.classList.remove('loading');
                saveBtn.disabled = true;
                
                statusEl.textContent = '✓ Saved Changes';
                statusEl.style.color = '#38A169';
                statusEl.style.opacity = '1';
                setTimeout(() => { statusEl.style.opacity = '0'; }, 2500);

                analytics.capture('Memory Edited', {
                    memory_id: memory.id,
                    memory_type: memory.memory_type || 'note',
                    field: 'content'
                });

                window.dispatchEvent(new CustomEvent('me:invalidate-memory', { detail: { id: memory.id } }));
                window.dispatchEvent(new CustomEvent('me:memory-mutated', { detail: { id: memory.id } }));
            } catch (err) {
                saveBtn.classList.remove('loading');
                saveBtn.disabled = false;
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

        // --- Thumbnail section ---
        const thumbContainer = document.getElementById('drawer-thumbnail-container');
        const thumbImg = document.getElementById('drawer-thumbnail-image');
        if (memory.thumbnail_url) {
            thumbImg.src = memory.thumbnail_url;
            thumbContainer.classList.remove('hidden');
        } else {
            thumbContainer.classList.add('hidden');
        }

        // --- Tags section ---
        const tagsContainer = document.getElementById('drawer-tags-container');
        const tagsGrid = document.getElementById('drawer-tags-grid');
        if (memory.tags && memory.tags.length > 0) {
            tagsGrid.innerHTML = memory.tags.map(t => 
                `<span style="background: var(--bg-tertiary); padding: 4px 10px; border-radius: 12px; font-size: 0.85rem; color: var(--text-secondary);">${this.escapeHTML(t)}</span>`
            ).join('');
            tagsContainer.classList.remove('hidden');
        } else {
            tagsContainer.classList.add('hidden');
        }

        // --- Metadata section ---
        const metaContainer = document.getElementById('drawer-metadata-container');
        const metaList = document.getElementById('drawer-metadata-list');
        const metaItems = [];
        if (memory.platform && memory.platform !== 'Unknown') metaItems.push(`Platform: ${memory.platform}`);
        if (memory.content_type && memory.content_type !== 'Website') metaItems.push(`Content Type: ${memory.content_type}`);
        if (memory.author) metaItems.push(`Author: ${memory.author}`);
        if (memory.site_name) metaItems.push(`Site: ${memory.site_name}`);
        if (memory.reading_time) metaItems.push(`Reading Time: ${memory.reading_time}`);
        
        if (metaItems.length > 0) {
            metaList.innerHTML = metaItems.map(m => `<li>${this.escapeHTML(m)}</li>`).join('');
            metaContainer.classList.remove('hidden');
        } else {
            metaContainer.classList.add('hidden');
        }

        // --- Link section ---
        const linkContainer = document.getElementById('drawer-link-container');
        const linkUrl = document.getElementById('drawer-link-url');
        if (isLink || memory.url) {
            const targetUrl = memory.url || rawContent;
            linkUrl.textContent = targetUrl;
            linkUrl.href = targetUrl;
            linkUrl.onclick = () => {
                analytics.capture('Link Opened', {
                    memory_id: memory.id,
                    url: targetUrl
                });
            };
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
                    
                    analytics.capture('Memory Edited', {
                        memory_id: memory.id,
                        memory_type: memory.memory_type || 'note',
                        field: 'title'
                    });

                    window.dispatchEvent(new CustomEvent('me:invalidate-memory', { detail: { id: memory.id } }));
                } catch (err) {
                    alert(err.message);
                }
            };
        }

        const pinBtn = document.getElementById('drawer-pin-btn');
        if (pinBtn) {
            const isCurrentlyPinned = memory.is_pinned || memory.pinned_at != null;
            pinBtn.textContent = isCurrentlyPinned ? '📌 Unpin Memory' : '📌 Pin Memory';
            pinBtn.onclick = () => {
                window.dispatchEvent(new CustomEvent('me:toggle-pin', {
                    detail: { id: memory.id, isPinned: isCurrentlyPinned }
                }));
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
                    
                    analytics.capture('Memory Deleted', {
                        memory_id: memory.id,
                        memory_type: memory.memory_type || 'note'
                    });
                    if (memory.memory_type === 'link') {
                        analytics.capture('Link Deleted', {
                            memory_id: memory.id
                        });
                    }

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
                <div class="source-card memory-reference-card" data-memory-id="${rel.id}">
                    <div class="drawer-meta-wrap">
                        <span class="memory-card-type-badge">${badge}</span>
                    </div>
                    <div class="source-title">${this.escapeHTML(rel.title || rel.ai_title || 'Memory')}</div>
                    <div class="source-summary">${this.escapeHTML(rel.preview || '')}</div>
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

        this._isEditorDirty = false;
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

