/**
 * Zen — Frontend Application
 *
 * Implements:
 *   Spec 2.1 — Model Selection & Switching
 *   Spec 2.2 — Message Streaming & Output Rendering
 *   Spec 2.3 — Message Editing & Conversation Branching
 *   Spec 2.4 — Response Regeneration & Model Comparison
 *   Spec 2.6 — Feedback & Interaction Actions (Rating & Modal)
 *   Spec 3.1 — Real-Time Web Search & Source Citations
 *   Spec 3.2 — Document & File Ingestion (Multi-file & Drag-and-drop)
 *   Spec 3.3 — Vision & Image Understanding (Inspection & Lightbox)
 */

'use strict';

/* ──────────────────────────────────────────────
   Constants & State
   ────────────────────────────────────────────── */
const API = {
  models          : '/api/models',
  preferences     : '/api/preferences',
  conversations   : '/api/conversations',
  upload          : '/api/upload',
  messages        : (id) => `/api/conversations/${id}/messages`,
  stream          : (id) => `/api/conversations/${id}/stream`,
  switchModel     : (id) => `/api/conversations/${id}/model`,
  regenerate      : (id) => `/api/conversations/${id}/regenerate`,
  edit            : (id) => `/api/conversations/${id}/edit`,
};

const state = {
  currentConvId       : null,
  currentModel        : null,     // model object
  models              : [],       // available models
  isStreaming         : false,
  streamController    : null,
  conversations       : [],
  
  // Multimodal state (Spec 3.1, 3.2, 3.3)
  webSearchEnabled    : false,
  pendingAttachments  : [],       // array of uploaded file objects

  // Tree state for active conversation
  allMessages         : [],
  messagesById        : new Map(),
  childrenByParentId  : new Map(),
  selectedBranch      : new Map(),
};

/* ──────────────────────────────────────────────
   DOM References
   ────────────────────────────────────────────── */
const $ = (id) => document.getElementById(id);

const dom = {
  zeroState           : $('zero-state'),
  messages            : $('messages'),
  conversationsList   : $('conversations-list'),
  promptInput         : $('prompt-input'),
  btnSend             : $('btn-send'),
  iconSend            : $('icon-send'),
  iconStop            : $('icon-stop'),
  btnModelSelector    : $('btn-model-selector'),
  modelSelectorName   : $('model-selector-name'),
  modelSelectorTag    : $('model-selector-tag'),
  modelSelectorIcon   : $('model-selector-icon'),
  modelDropdown       : $('model-dropdown'),
  capsuleModelLabel   : $('capsule-model-label'),
  btnCapsuleModel     : $('btn-capsule-model'),
  streamingIndicator  : $('streaming-indicator'),
  sidebar             : document.querySelector('.sidebar'),
  btnToggleSidebar    : $('btn-toggle-sidebar'),
  btnNewChat          : $('btn-new-chat'),
  sidebarSearch       : $('sidebar-search'),
  toastContainer      : $('toast-container'),

  // Multimodal DOM Elements
  btnTopWebSearch     : $('btn-top-web-search'),
  btnCapsuleWebSearch : $('btn-capsule-web-search'),
  webSearchBanner     : $('web-search-banner'),
  btnCloseSearchBanner: $('btn-close-search-banner'),
  btnAttach           : $('btn-attach'),
  fileUploadInput     : $('file-upload-input'),
  attachmentTray      : $('attachment-tray'),
  dragDropOverlay     : $('drag-drop-overlay'),
  imageLightbox       : $('image-lightbox'),
  lightboxImg         : $('lightbox-img'),
  lightboxCaption     : $('lightbox-caption'),
  btnCloseLightbox    : $('btn-close-lightbox'),
};

/* ──────────────────────────────────────────────
   Markdown, Code Blocks & KaTeX (Spec 2.2 & 3.1)
   ────────────────────────────────────────────── */
marked.setOptions({
  gfm      : true,
  breaks   : true,
  highlight: (code, lang) => {
    if (lang && hljs.getLanguage(lang)) {
      try { return hljs.highlight(code, { language: lang }).value; } catch (_) {}
    }
    return hljs.highlightAuto(code).value;
  },
});

const renderer = new marked.Renderer();

renderer.code = (code, lang) => {
  const language = (lang || 'plaintext').toLowerCase();
  const highlighted = (() => {
    try {
      if (lang && hljs.getLanguage(lang)) return hljs.highlight(code, { language: lang }).value;
      return hljs.highlightAuto(code).value;
    } catch (_) {
      return escapeHtml(code);
    }
  })();

  return `<div class="code-block-wrapper">
    <div class="code-block-header">
      <span class="code-lang-label">${escapeHtml(language)}</span>
      <button class="btn-copy-code" data-code="${encodeURIComponent(code)}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
        Copy Code
      </button>
    </div>
    <pre><code class="hljs language-${escapeHtml(language)}">${highlighted}</code></pre>
  </div>`;
};

marked.use({ renderer });

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderContent(text, el, sources = []) {
  const latexBlocks = [];
  let protected_text = text;

  // Protect display math $$...$$ first
  protected_text = protected_text.replace(/\$\$([\s\S]+?)\$\$/g, (match, latex) => {
    const idx = latexBlocks.push({ latex, display: true }) - 1;
    return `LATEXBLOCK_${idx}_END`;
  });

  // Protect inline math $...$
  protected_text = protected_text.replace(/\$([^\n$]+?)\$/g, (match, latex) => {
    const idx = latexBlocks.push({ latex, display: false }) - 1;
    return `LATEXINLINE_${idx}_END`;
  });

  // Render Markdown
  let html = marked.parse(protected_text);

  // Restore LaTeX
  html = html.replace(/LATEXBLOCK_(\d+)_END/g, (_, idx) => {
    const { latex } = latexBlocks[parseInt(idx)];
    try {
      return `<div class="math-display">${katex.renderToString(latex, { displayMode: true, throwOnError: false })}</div>`;
    } catch (e) {
      return `<code>$$${escapeHtml(latex)}$$</code>`;
    }
  });

  html = html.replace(/LATEXINLINE_(\d+)_END/g, (_, idx) => {
    const { latex } = latexBlocks[parseInt(idx)];
    try {
      return katex.renderToString(latex, { displayMode: false, throwOnError: false });
    } catch (e) {
      return `<code>$${escapeHtml(latex)}$</code>`;
    }
  });

  // Convert citations [1], [2] to interactive pills (Spec 3.1)
  html = html.replace(/\[(\d+)\]/g, (match, num) => {
    const srcIndex = parseInt(num) - 1;
    const src = sources[srcIndex];
    return `<button class="citation-pill" data-cit-num="${num}" data-src-idx="${srcIndex}" title="${src ? escapeHtml(src.title) : 'Source ' + num}">${num}</button>`;
  });

  el.innerHTML = html;

  // Wire up copy code buttons
  el.querySelectorAll('.btn-copy-code').forEach(btn => {
    btn.addEventListener('click', () => {
      const code = decodeURIComponent(btn.dataset.code || '');
      navigator.clipboard.writeText(code).then(() => {
        btn.classList.add('copied');
        btn.textContent = 'Copied!';
        setTimeout(() => {
          btn.classList.remove('copied');
          btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy Code`;
        }, 2000);
      }).catch(() => showToast('Could not copy to clipboard', 'error'));
    });
  });

  // Wire up citation pill hover tooltips & click
  el.querySelectorAll('.citation-pill').forEach(pill => {
    const srcIndex = parseInt(pill.dataset.srcIdx);
    const src = sources[srcIndex];
    if (src) {
      pill.addEventListener('mouseenter', (e) => showCitationTooltip(e, src));
      pill.addEventListener('mouseleave', hideCitationTooltip);
      pill.addEventListener('click', () => {
        if (src.url) window.open(src.url, '_blank', 'noopener,noreferrer');
      });
    }
  });
}

/* Citation Tooltips (Spec 3.1) */
let activeCitationTooltip = null;

function showCitationTooltip(e, src) {
  hideCitationTooltip();
  const tip = document.createElement('div');
  tip.className = 'citation-tooltip';
  tip.innerHTML = `
    <div class="citation-tooltip-domain">${escapeHtml(src.domain)}</div>
    <div class="citation-tooltip-title">${escapeHtml(src.title)}</div>
    <div style="font-size: 0.68rem; color: var(--text-secondary); line-height: 1.3;">${escapeHtml(src.snippet || '')}</div>
  `;
  document.body.appendChild(tip);
  const rect = e.target.getBoundingClientRect();
  tip.style.top = `${rect.top - tip.offsetHeight - 8 + window.scrollY}px`;
  tip.style.left = `${Math.max(10, rect.left - 100)}px`;
  activeCitationTooltip = tip;
}

function hideCitationTooltip() {
  if (activeCitationTooltip) {
    activeCitationTooltip.remove();
    activeCitationTooltip = null;
  }
}

/* ──────────────────────────────────────────────
   Model Icons (SVGs)
   ────────────────────────────────────────────── */
const MODEL_ICONS = {
  'deep-thinking': `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>`,
  'zen-ultra': `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
  'zen-flash': `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
};

function modelColor(type) {
  return { purple: '#bf8eff', blue: '#93c5fd', green: '#6ee7b7' }[type] || '#fff';
}

/* ──────────────────────────────────────────────
   Spec 2.1 — Model Selection
   ────────────────────────────────────────────── */
async function loadModels() {
  try {
    const [modelsRes, prefsRes] = await Promise.all([
      fetch(API.models),
      fetch(API.preferences),
    ]);
    const { models } = await modelsRes.json();
    const prefs = await prefsRes.json();

    state.models = models;

    const savedModelId = localStorage.getItem('zen_last_model') || prefs.default_model;
    const initialModel = models.find(m => m.id === savedModelId) || models[0];
    setActiveModel(initialModel, false);

    renderModelDropdown();
  } catch (err) {
    console.error('Failed to load models:', err);
  }
}

function renderModelDropdown() {
  dom.modelDropdown.innerHTML = state.models.map(m => `
    <div
      class="model-option ${m.id === state.currentModel?.id ? 'active' : ''}"
      role="option"
      aria-selected="${m.id === state.currentModel?.id}"
      data-model-id="${m.id}"
    >
      <span class="model-opt-icon" style="color: ${modelColor(m.badgeType)}">
        ${MODEL_ICONS[m.id] || MODEL_ICONS['deep-thinking']}
      </span>
      <div class="model-opt-body">
        <div class="model-opt-header">
          <span class="model-opt-name">${m.name}</span>
          <span class="model-cap-badge badge-${m.badgeType}">${m.badge} · ${m.tag}</span>
        </div>
        <div class="model-opt-desc">${m.desc}</div>
      </div>
      <svg class="model-opt-check" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    </div>
  `).join('');

  dom.modelDropdown.querySelectorAll('.model-option').forEach(opt => {
    opt.addEventListener('click', () => {
      const model = state.models.find(m => m.id === opt.dataset.modelId);
      if (model) selectModel(model);
    });
  });
}

function setActiveModel(model, persistToServer = true) {
  state.currentModel = model;

  dom.modelSelectorIcon.innerHTML = MODEL_ICONS[model.id] || MODEL_ICONS['deep-thinking'];
  dom.modelSelectorIcon.style.color = modelColor(model.badgeType);
  dom.modelSelectorName.textContent = model.name;
  dom.modelSelectorTag.textContent  = model.tag;

  dom.capsuleModelLabel.textContent = model.name;
  dom.btnCapsuleModel.className = `pill-btn model-quick-pill ${model.badgeType === 'purple' ? 'active' : ''}`;

  localStorage.setItem('zen_last_model', model.id);

  if (persistToServer) {
    fetch(API.preferences, {
      method : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ default_model: model.id }),
    }).catch(() => {});
  }
}

async function selectModel(model) {
  setActiveModel(model);
  closeModelDropdown();
  renderModelDropdown();

  if (state.currentConvId) {
    try {
      await fetch(API.switchModel(state.currentConvId), {
        method : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ model: model.id }),
      });
      showToast(`Switched to ${model.name}`, 'success');
    } catch (_) {}
  }
}

function openModelDropdown() {
  dom.modelDropdown.classList.remove('hidden');
  dom.btnModelSelector.setAttribute('aria-expanded', 'true');
}

function closeModelDropdown() {
  dom.modelDropdown.classList.add('hidden');
  dom.btnModelSelector.setAttribute('aria-expanded', 'false');
}

function toggleModelDropdown() {
  if (dom.modelDropdown.classList.contains('hidden')) openModelDropdown();
  else closeModelDropdown();
}

/* ──────────────────────────────────────────────
   Spec 3.1 — Web Search Toggle State
   ────────────────────────────────────────────── */
function setWebSearch(enabled) {
  state.webSearchEnabled = enabled;
  if (enabled) {
    dom.btnTopWebSearch.classList.add('active');
    dom.btnCapsuleWebSearch.classList.add('active');
    dom.webSearchBanner.classList.remove('hidden');
    showToast('Live Web Search enabled', 'success');
  } else {
    dom.btnTopWebSearch.classList.remove('active');
    dom.btnCapsuleWebSearch.classList.remove('active');
    dom.webSearchBanner.classList.add('hidden');
  }
}

function toggleWebSearch() {
  setWebSearch(!state.webSearchEnabled);
}

/* ──────────────────────────────────────────────
   Spec 3.2 & 3.3 — File & Image Ingestion
   ────────────────────────────────────────────── */
async function uploadFiles(files) {
  if (!files || files.length === 0) return;

  const formData = new FormData();
  for (let i = 0; i < files.length; i++) {
    formData.append('files', files[i]);
  }

  showToast(`Uploading ${files.length} file(s)...`);

  try {
    const res = await fetch(API.upload, {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (data.files) {
      state.pendingAttachments.push(...data.files);
      renderAttachmentTray();
      showToast(`Attached ${data.files.length} file(s)`, 'success');
    }
  } catch (err) {
    showToast('Failed to upload files', 'error');
  }
}

function renderAttachmentTray() {
  if (state.pendingAttachments.length === 0) {
    dom.attachmentTray.classList.add('hidden');
    dom.attachmentTray.innerHTML = '';
    return;
  }

  dom.attachmentTray.classList.remove('hidden');
  dom.attachmentTray.innerHTML = state.pendingAttachments.map((att, idx) => {
    const badgeType = att.isImage ? 'img' : (att.originalname.endsWith('.pdf') ? 'pdf' : (att.originalname.endsWith('.csv') ? 'csv' : 'code'));
    const badgeLabel = att.isImage ? 'IMG' : (att.originalname.endsWith('.pdf') ? 'PDF' : (att.originalname.endsWith('.csv') ? 'CSV' : 'FILE'));

    return `
      <div class="attachment-chip" data-idx="${idx}">
        <span class="chip-badge chip-badge-${badgeType}">${badgeLabel}</span>
        <span style="max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(att.originalname)}</span>
        <button class="chip-remove" data-idx="${idx}" title="Remove file">&times;</button>
      </div>
    `;
  }).join('');

  dom.attachmentTray.querySelectorAll('.chip-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.idx);
      state.pendingAttachments.splice(idx, 1);
      renderAttachmentTray();
    });
  });
}

function openLightbox(imgUrl, caption) {
  dom.lightboxImg.src = imgUrl;
  dom.lightboxCaption.textContent = caption || '';
  dom.imageLightbox.classList.remove('hidden');
}

function closeLightbox() {
  dom.imageLightbox.classList.add('hidden');
  dom.lightboxImg.src = '';
}

/* ──────────────────────────────────────────────
   Tree-based Message Organization
   ────────────────────────────────────────────── */
function buildMessageTree(messages) {
  state.allMessages = messages;
  state.messagesById.clear();
  state.childrenByParentId.clear();

  messages.forEach(m => {
    state.messagesById.set(m.id, m);
    const parentKey = m.parent_id || 'root';
    if (!state.childrenByParentId.has(parentKey)) {
      state.childrenByParentId.set(parentKey, []);
    }
    state.childrenByParentId.get(parentKey).push(m.id);
  });

  state.childrenByParentId.forEach((childIds, parentKey) => {
    if (!state.selectedBranch.has(parentKey) || !childIds.includes(state.selectedBranch.get(parentKey))) {
      state.selectedBranch.set(parentKey, childIds[childIds.length - 1]);
    }
  });
}

function getActivePathMessages() {
  const path = [];
  let currParent = 'root';

  while (state.childrenByParentId.has(currParent) && state.childrenByParentId.get(currParent).length > 0) {
    const selectedChildId = state.selectedBranch.get(currParent);
    const msg = state.messagesById.get(selectedChildId);
    if (!msg) break;
    path.push(msg);
    currParent = msg.id;
  }
  return path;
}

function getSiblingInfo(msg) {
  const parentKey = msg.parent_id || 'root';
  const siblings = state.childrenByParentId.get(parentKey) || [msg.id];
  const index = siblings.indexOf(msg.id);
  return {
    siblings,
    index,
    count: siblings.length,
    hasPrev: index > 0,
    hasNext: index < siblings.length - 1,
    prevId: index > 0 ? siblings[index - 1] : null,
    nextId: index < siblings.length - 1 ? siblings[index + 1] : null,
  };
}

function switchBranch(parentKey, newChildId) {
  state.selectedBranch.set(parentKey, newChildId);
  renderActiveThread();
}

/* ──────────────────────────────────────────────
   Thread Rendering (Spec 2.2 – 3.3)
   ────────────────────────────────────────────── */
function renderActiveThread() {
  const activeMsgs = getActivePathMessages();

  if (activeMsgs.length === 0) {
    showZeroState();
    return;
  }

  hideZeroState();
  dom.messages.innerHTML = '';
  activeMsgs.forEach(msg => renderMessageNode(msg));
  scrollToBottom();
}

function renderMessageNode(msg) {
  const siblingInfo = getSiblingInfo(msg);
  const parentKey = msg.parent_id || 'root';

  const item = document.createElement('div');
  item.className = `msg-item msg-${msg.role}`;
  item.dataset.id = msg.id;

  // ── USER MESSAGE ──
  if (msg.role === 'user') {
    let attachmentsHtml = '';
    if (msg.attachments && msg.attachments.length > 0) {
      attachmentsHtml = `<div class="user-msg-attachments">` + msg.attachments.map(att => {
        if (att.isImage) {
          return `<img src="${att.url}" class="msg-image-thumb" alt="${escapeHtml(att.originalname)}" data-url="${att.url}" data-cap="${escapeHtml(att.originalname)}">`;
        }
        const badgeLabel = att.originalname.endsWith('.pdf') ? 'PDF' : (att.originalname.endsWith('.csv') ? 'CSV' : 'FILE');
        return `<div class="attachment-chip"><span class="chip-badge chip-badge-code">${badgeLabel}</span><span>${escapeHtml(att.originalname)}</span></div>`;
      }).join('') + `</div>`;
    }

    item.innerHTML = `
      ${attachmentsHtml}
      <div class="msg-user-row">
        <div class="msg-user-bubble">${escapeHtml(msg.content).replace(/\n/g, '<br>')}</div>
        <button class="btn-edit-user-msg" title="Edit message (Fork branch)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
          </svg>
        </button>
      </div>
      ${siblingInfo.count > 1 ? `
        <div class="branch-pagination">
          <button class="branch-nav-btn prev-branch-btn" ${!siblingInfo.hasPrev ? 'disabled' : ''} title="Previous version">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span class="branch-count-text">${siblingInfo.index + 1} / ${siblingInfo.count}</span>
          <button class="branch-nav-btn next-branch-btn" ${!siblingInfo.hasNext ? 'disabled' : ''} title="Next version">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      ` : ''}
    `;

    // Branch navigation buttons
    if (siblingInfo.hasPrev) item.querySelector('.prev-branch-btn').addEventListener('click', () => switchBranch(parentKey, siblingInfo.prevId));
    if (siblingInfo.hasNext) item.querySelector('.next-branch-btn').addEventListener('click', () => switchBranch(parentKey, siblingInfo.nextId));

    // Edit button -> open inline edit form
    item.querySelector('.btn-edit-user-msg').addEventListener('click', () => openEditBox(item, msg));

    // Vision Lightbox click handlers
    item.querySelectorAll('.msg-image-thumb').forEach(img => {
      img.addEventListener('click', () => openLightbox(img.dataset.url, img.dataset.cap));
    });

    dom.messages.appendChild(item);
    return;
  }

  // ── ASSISTANT MESSAGE ──
  const modelObj = state.models.find(m => m.id === msg.model) || state.currentModel;
  const sources = msg.sources || [];

  item.innerHTML = `
    <div class="asst-avatar" aria-hidden="true"></div>
    <div class="asst-body">
      <div class="asst-header-meta">
        <span class="asst-model-badge">${modelObj?.name || 'Zen'}</span>
        ${siblingInfo.count > 1 ? `
          <div class="branch-pagination">
            <button class="branch-nav-btn prev-branch-btn" ${!siblingInfo.hasPrev ? 'disabled' : ''} title="Previous response">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span class="branch-count-text">${siblingInfo.index + 1} / ${siblingInfo.count}</span>
            <button class="branch-nav-btn next-branch-btn" ${!siblingInfo.hasNext ? 'disabled' : ''} title="Next response">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        ` : ''}
      </div>
      <div class="asst-content"></div>
      
      <!-- Collapsible Sources Drawer (Spec 3.1) -->
      ${sources.length > 0 ? `
        <div class="sources-drawer">
          <div class="sources-drawer-header">
            <span>Sources (${sources.length})</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-9"/></svg>
          </div>
          <div class="sources-cards-grid">
            ${sources.map(s => `
              <a href="${s.url}" target="_blank" rel="noopener noreferrer" class="source-card">
                <div class="source-card-domain">${escapeHtml(s.domain)}</div>
                <div class="source-card-title">${escapeHtml(s.title)}</div>
                <div class="source-card-snippet">${escapeHtml(s.snippet || '')}</div>
              </a>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <div class="asst-actions-bar">
        <button class="asst-act-btn btn-copy-msg" title="Copy message">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          Copy
        </button>
        <button class="asst-act-btn btn-thumbs-up" title="Good response (Thumbs up)">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
          </svg>
        </button>
        <button class="asst-act-btn btn-thumbs-down" title="Poor response (Thumbs down)">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"/>
          </svg>
        </button>
        <button class="asst-act-btn btn-reroll" title="Regenerate response (Re-roll)">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          Regenerate
        </button>
        <button class="asst-act-btn btn-compare" title="Regenerate and compare with another model">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          Compare ▾
        </button>
      </div>
    </div>
  `;

  if (siblingInfo.hasPrev) item.querySelector('.prev-branch-btn').addEventListener('click', () => switchBranch(parentKey, siblingInfo.prevId));
  if (siblingInfo.hasNext) item.querySelector('.next-branch-btn').addEventListener('click', () => switchBranch(parentKey, siblingInfo.nextId));

  // Copy button
  item.querySelector('.btn-copy-msg').addEventListener('click', (e) => {
    navigator.clipboard.writeText(msg.content).then(() => {
      e.currentTarget.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
      setTimeout(() => {
        e.currentTarget.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
      }, 2000);
    });
  });

  // Thumbs Up / Down
  const btnThumbsUp = item.querySelector('.btn-thumbs-up');
  const btnThumbsDown = item.querySelector('.btn-thumbs-down');

  btnThumbsUp.addEventListener('click', async () => {
    btnThumbsUp.classList.toggle('active');
    btnThumbsDown.classList.remove('active');
    if (btnThumbsUp.classList.contains('active')) {
      try {
        await fetch(`/api/messages/${msg.id}/feedback`, {
          method : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body   : JSON.stringify({ rating: 'positive' }),
        });
        showToast('Feedback submitted. Thank you!', 'success');
      } catch (_) {}
    }
  });

  btnThumbsDown.addEventListener('click', () => {
    openFeedbackModal(msg.id, () => {
      btnThumbsDown.classList.add('active');
      btnThumbsUp.classList.remove('active');
    });
  });

  // Re-roll & Compare
  item.querySelector('.btn-reroll').addEventListener('click', () => {
    if (state.isStreaming) return;
    regenerateResponse(msg.parent_id, msg.model || state.currentModel?.id);
  });

  item.querySelector('.btn-compare').addEventListener('click', (e) => {
    e.stopPropagation();
    openComparePopover(item.querySelector('.asst-actions-bar'), msg.parent_id);
  });

  const contentEl = item.querySelector('.asst-content');
  renderContent(msg.content, contentEl, sources);

  dom.messages.appendChild(item);
}

/* ──────────────────────────────────────────────
   Inline Message Editing (Spec 2.3)
   ────────────────────────────────────────────── */
function openEditBox(msgItemEl, msg) {
  const originalHtml = msgItemEl.innerHTML;
  
  msgItemEl.innerHTML = `
    <div class="msg-edit-box">
      <textarea class="edit-textarea">${escapeHtml(msg.content)}</textarea>
      <div class="edit-actions-row">
        <button class="btn-cancel-edit">Cancel</button>
        <button class="btn-save-edit">Save & Submit</button>
      </div>
    </div>
  `;

  const textarea = msgItemEl.querySelector('.edit-textarea');
  textarea.focus();
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);

  msgItemEl.querySelector('.btn-cancel-edit').addEventListener('click', () => {
    msgItemEl.innerHTML = originalHtml;
    msgItemEl.querySelector('.btn-edit-user-msg')?.addEventListener('click', () => openEditBox(msgItemEl, msg));
  });

  msgItemEl.querySelector('.btn-save-edit').addEventListener('click', async () => {
    const newText = textarea.value.trim();
    if (!newText || newText === msg.content) {
      msgItemEl.innerHTML = originalHtml;
      msgItemEl.querySelector('.btn-edit-user-msg')?.addEventListener('click', () => openEditBox(msgItemEl, msg));
      return;
    }
    await submitEditedMessage(msg.id, newText);
  });
}

async function submitEditedMessage(origMsgId, newContent) {
  if (state.isStreaming) return;
  setStreamingState(true);

  const controller = new AbortController();
  state.streamController = controller;

  const tempUser = document.createElement('div');
  tempUser.className = 'msg-item msg-user';
  tempUser.innerHTML = `<div class="msg-user-bubble">${escapeHtml(newContent).replace(/\n/g, '<br>')}</div>`;
  dom.messages.appendChild(tempUser);

  const asstContainer = document.createElement('div');
  asstContainer.className = 'msg-item msg-assistant';
  asstContainer.innerHTML = `
    <div class="asst-avatar"></div>
    <div class="asst-body">
      <div class="asst-header-meta"><span class="asst-model-badge">${state.currentModel?.name || 'Zen'}</span></div>
      <div class="asst-content"></div>
    </div>
  `;
  dom.messages.appendChild(asstContainer);
  const contentEl = asstContainer.querySelector('.asst-content');
  const cursor = document.createElement('span');
  cursor.className = 'streaming-cursor';
  contentEl.appendChild(cursor);

  let fullText = '';

  try {
    const res = await fetch(API.edit(state.currentConvId), {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({
        message_id: origMsgId,
        content: newContent,
        model: state.currentModel?.id,
      }),
      signal : controller.signal,
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        try {
          const event = JSON.parse(trimmed.slice(6));
          if (event.type === 'chunk') {
            fullText += event.text;
            cursor.remove();
            renderContent(fullText, contentEl);
            contentEl.appendChild(cursor);
            scrollToBottom();
          }
          if (event.type === 'done') {
            cursor.remove();
            break;
          }
        } catch (_) {}
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      cursor.remove();
      renderContent(fullText || 'Generation stopped.', contentEl);
    }
  } finally {
    setStreamingState(false);
    state.streamController = null;
    await reloadConversationTree();
  }
}

/* ──────────────────────────────────────────────
   Response Regeneration (Spec 2.4)
   ────────────────────────────────────────────── */
async function regenerateResponse(userParentId, modelId) {
  if (state.isStreaming || !userParentId) return;
  setStreamingState(true);

  const chosenModel = state.models.find(m => m.id === modelId) || state.currentModel;

  const asstContainer = document.createElement('div');
  asstContainer.className = 'msg-item msg-assistant';
  asstContainer.innerHTML = `
    <div class="asst-avatar"></div>
    <div class="asst-body">
      <div class="asst-header-meta"><span class="asst-model-badge">${chosenModel?.name || 'Zen'}</span></div>
      <div class="asst-content"></div>
    </div>
  `;
  dom.messages.appendChild(asstContainer);
  const contentEl = asstContainer.querySelector('.asst-content');
  const cursor = document.createElement('span');
  cursor.className = 'streaming-cursor';
  contentEl.appendChild(cursor);

  const controller = new AbortController();
  state.streamController = controller;
  let fullText = '';

  try {
    const res = await fetch(API.regenerate(state.currentConvId), {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({
        user_message_id: userParentId,
        model: modelId,
      }),
      signal : controller.signal,
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        try {
          const event = JSON.parse(trimmed.slice(6));
          if (event.type === 'chunk') {
            fullText += event.text;
            cursor.remove();
            renderContent(fullText, contentEl);
            contentEl.appendChild(cursor);
            scrollToBottom();
          }
          if (event.type === 'done') {
            cursor.remove();
            break;
          }
        } catch (_) {}
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      cursor.remove();
      renderContent(fullText || 'Generation stopped.', contentEl);
    }
  } finally {
    setStreamingState(false);
    state.streamController = null;
    await reloadConversationTree();
  }
}

function openComparePopover(parentActionsEl, userParentId) {
  document.querySelectorAll('.compare-popover').forEach(el => el.remove());

  const popover = document.createElement('div');
  popover.className = 'compare-popover';
  popover.innerHTML = `
    <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-muted); padding: 4px 8px;">COMPARE WITH MODEL</div>
    ${state.models.map(m => `
      <div class="compare-opt" data-model-id="${m.id}">
        <span style="color: ${modelColor(m.badgeType)};">${MODEL_ICONS[m.id]}</span>
        <span>${m.name} (${m.tag})</span>
      </div>
    `).join('')}
  `;

  popover.querySelectorAll('.compare-opt').forEach(opt => {
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      popover.remove();
      regenerateResponse(userParentId, opt.dataset.modelId);
    });
  });

  parentActionsEl.appendChild(popover);

  const closeHandler = () => {
    popover.remove();
    document.removeEventListener('click', closeHandler);
  };
  setTimeout(() => document.addEventListener('click', closeHandler), 10);
}

/* ──────────────────────────────────────────────
   Granular Negative Feedback Modal (Spec 2.6)
   ────────────────────────────────────────────── */
function openFeedbackModal(messageId, onSubmitted) {
  document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());

  const modalBackdrop = document.createElement('div');
  modalBackdrop.className = 'modal-backdrop';
  modalBackdrop.innerHTML = `
    <div class="feedback-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="fb-title">
      <div class="modal-header-row">
        <h3 id="fb-title" class="modal-heading">Provide Detailed Feedback</h3>
        <button class="btn-close-modal" aria-label="Close modal">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <p class="modal-subtext">What issues did you notice with this response? (Select all that apply)</p>
      
      <div class="feedback-options-list">
        <label class="feedback-check-label">
          <input type="checkbox" value="Factually incorrect or misleading">
          <span>Factually incorrect or misleading</span>
        </label>
        <label class="feedback-check-label">
          <input type="checkbox" value="Did not follow instructions or prompt constraints">
          <span>Did not follow instructions or prompt constraints</span>
        </label>
        <label class="feedback-check-label">
          <input type="checkbox" value="Code had errors or failed to compile">
          <span>Code had errors or failed to compile</span>
        </label>
        <label class="feedback-check-label">
          <input type="checkbox" value="Too verbose or repetitive">
          <span>Too verbose or repetitive</span>
        </label>
        <label class="feedback-check-label">
          <input type="checkbox" value="Harmful, offensive, or unsafe">
          <span>Harmful, offensive, or unsafe</span>
        </label>
      </div>

      <textarea class="feedback-comment-textarea" placeholder="What was expected? Provide details (optional)..."></textarea>

      <div class="modal-actions-row">
        <button class="btn-modal-cancel">Cancel</button>
        <button class="btn-modal-submit">Submit Feedback</button>
      </div>
    </div>
  `;

  document.body.appendChild(modalBackdrop);

  const closeModal = () => modalBackdrop.remove();

  modalBackdrop.querySelector('.btn-close-modal').addEventListener('click', closeModal);
  modalBackdrop.querySelector('.btn-modal-cancel').addEventListener('click', closeModal);
  modalBackdrop.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) closeModal();
  });

  modalBackdrop.querySelector('.btn-modal-submit').addEventListener('click', async () => {
    const selectedReasons = Array.from(modalBackdrop.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
    const commentText = modalBackdrop.querySelector('.feedback-comment-textarea').value.trim();

    try {
      await fetch(`/api/messages/${messageId}/feedback`, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({
          rating  : 'negative',
          reasons : selectedReasons,
          comment : commentText,
        }),
      });
      showToast('Feedback submitted. Thank you for helping Zen improve.', 'success');
      if (onSubmitted) onSubmitted();
    } catch (_) {
      showToast('Could not submit feedback', 'error');
    }
    closeModal();
  });
}

/* ──────────────────────────────────────────────
   Conversation Management
   ────────────────────────────────────────────── */
async function loadConversations() {
  try {
    const res = await fetch(API.conversations);
    const data = await res.json();
    state.conversations = data.conversations;
    renderSidebar();
  } catch (_) {}
}

function renderSidebar() {
  const search = dom.sidebarSearch.value.toLowerCase().trim();
  const convs = search
    ? state.conversations.filter(c => c.title.toLowerCase().includes(search))
    : state.conversations;

  if (convs.length === 0) {
    dom.conversationsList.innerHTML = `<div style="padding: 12px 8px; font-size: 0.8rem; color: var(--text-muted);">No conversations yet.</div>`;
    return;
  }

  const now = Date.now();
  const groups = { Today: [], Yesterday: [], 'Past 7 Days': [], Older: [] };

  convs.forEach(c => {
    const age = now - new Date(c.updated_at + 'Z').getTime();
    const day = 86400000;
    if      (age < day)     groups['Today'].push(c);
    else if (age < 2 * day) groups['Yesterday'].push(c);
    else if (age < 7 * day) groups['Past 7 Days'].push(c);
    else                    groups['Older'].push(c);
  });

  let html = '';
  Object.entries(groups).forEach(([label, items]) => {
    if (!items.length) return;
    html += `<div class="conv-group-label">${label}</div>`;
    items.forEach(c => {
      html += `
        <div class="conv-item ${c.id === state.currentConvId ? 'active' : ''}" data-id="${c.id}">
          <span class="conv-item-title">${escapeHtml(c.title)}</span>
        </div>`;
    });
  });
  dom.conversationsList.innerHTML = html;

  dom.conversationsList.querySelectorAll('.conv-item').forEach(el => {
    el.addEventListener('click', () => openConversation(el.dataset.id));
  });
}

async function createNewConversation() {
  try {
    const res = await fetch(API.conversations, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ model: state.currentModel?.id }),
    });
    const data = await res.json();
    state.currentConvId = data.id;
    state.allMessages = [];
    state.messagesById.clear();
    state.childrenByParentId.clear();
    state.selectedBranch.clear();
    state.pendingAttachments = [];
    renderAttachmentTray();
    await loadConversations();
    showZeroState();
  } catch (err) {
    showToast('Failed to create conversation', 'error');
  }
}

async function openConversation(id) {
  state.currentConvId = id;
  state.pendingAttachments = [];
  renderAttachmentTray();
  renderSidebar();
  await reloadConversationTree();
}

async function reloadConversationTree() {
  if (!state.currentConvId) return;
  try {
    const res = await fetch(API.messages(state.currentConvId));
    const data = await res.json();

    const convModel = state.models.find(m => m.id === data.conversation.model);
    if (convModel) setActiveModel(convModel, false);

    buildMessageTree(data.messages);
    renderActiveThread();
  } catch (_) {
    showToast('Could not load conversation', 'error');
  }
}

/* ──────────────────────────────────────────────
   Spec 2.2, 3.1, 3.2, 3.3 — Streaming Send
   ────────────────────────────────────────────── */
async function sendMessage() {
  const text = dom.promptInput.value.trim();
  const attachments = [...state.pendingAttachments];

  if (!text && attachments.length === 0) return;
  if (state.isStreaming) return;

  if (!state.currentConvId) {
    await createNewConversation();
  }

  const activeMsgs = getActivePathMessages();
  const lastActiveMsg = activeMsgs.length > 0 ? activeMsgs[activeMsgs.length - 1] : null;
  const parentId = lastActiveMsg ? lastActiveMsg.id : null;

  dom.promptInput.value = '';
  autoResizeTextarea();
  state.pendingAttachments = [];
  renderAttachmentTray();

  hideZeroState();
  dom.messages.classList.remove('hidden');
  setStreamingState(true);

  // Temporary user bubble in UI
  let tempAttachmentsHtml = '';
  if (attachments.length > 0) {
    tempAttachmentsHtml = `<div class="user-msg-attachments">` + attachments.map(att => {
      if (att.isImage) {
        return `<img src="${att.url}" class="msg-image-thumb" alt="${escapeHtml(att.originalname)}">`;
      }
      return `<div class="attachment-chip"><span class="chip-badge chip-badge-code">FILE</span><span>${escapeHtml(att.originalname)}</span></div>`;
    }).join('') + `</div>`;
  }

  const tempUser = document.createElement('div');
  tempUser.className = 'msg-item msg-user';
  tempUser.innerHTML = `
    ${tempAttachmentsHtml}
    <div class="msg-user-bubble">${escapeHtml(text || `[Attached ${attachments.length} file(s)]`).replace(/\n/g, '<br>')}</div>
  `;
  dom.messages.appendChild(tempUser);

  // Assistant stream bubble
  const asstContainer = document.createElement('div');
  asstContainer.className = 'msg-item msg-assistant';
  asstContainer.innerHTML = `
    <div class="asst-avatar"></div>
    <div class="asst-body">
      <div class="asst-header-meta"><span class="asst-model-badge">${state.currentModel?.name || 'Zen'}</span></div>
      <div class="asst-content"></div>
    </div>
  `;
  dom.messages.appendChild(asstContainer);
  const contentEl = asstContainer.querySelector('.asst-content');
  const cursor = document.createElement('span');
  cursor.className = 'streaming-cursor';
  contentEl.appendChild(cursor);

  const controller = new AbortController();
  state.streamController = controller;
  let fullText = '';
  let responseSources = [];

  try {
    const res = await fetch(API.stream(state.currentConvId), {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({
        content      : text,
        parent_id    : parentId,
        model        : state.currentModel?.id,
        attachments  : attachments,
        web_search   : state.webSearchEnabled,
      }),
      signal : controller.signal,
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        try {
          const event = JSON.parse(trimmed.slice(6));
          if (event.type === 'start') {
            responseSources = event.sources || [];
          }
          if (event.type === 'chunk') {
            fullText += event.text;
            cursor.remove();
            renderContent(fullText, contentEl, responseSources);
            contentEl.appendChild(cursor);
            scrollToBottom();
          }
          if (event.type === 'done') {
            cursor.remove();
            responseSources = event.sources || responseSources;
            renderContent(event.fullText || fullText, contentEl, responseSources);
            await loadConversations();
            break;
          }
        } catch (_) {}
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      cursor.remove();
      renderContent(fullText || 'Generation stopped.', contentEl, responseSources);
    }
  } finally {
    setStreamingState(false);
    state.streamController = null;
    await reloadConversationTree();
  }
}

function stopStreaming() {
  if (state.streamController) state.streamController.abort();
}

function setStreamingState(streaming) {
  state.isStreaming = streaming;
  if (streaming) {
    dom.btnSend.classList.add('is-streaming');
    dom.iconSend.classList.add('hidden');
    dom.iconStop.classList.remove('hidden');
    dom.streamingIndicator.classList.remove('hidden');
    dom.promptInput.setAttribute('disabled', 'true');
  } else {
    dom.btnSend.classList.remove('is-streaming');
    dom.iconSend.classList.remove('hidden');
    dom.iconStop.classList.add('hidden');
    dom.streamingIndicator.classList.add('hidden');
    dom.promptInput.removeAttribute('disabled');
    dom.promptInput.focus();
  }
}

/* ──────────────────────────────────────────────
   UI Helpers
   ────────────────────────────────────────────── */
function showZeroState() {
  dom.zeroState.classList.remove('hidden');
  dom.messages.classList.add('hidden');
  dom.messages.innerHTML = '';
}

function hideZeroState() {
  dom.zeroState.classList.add('hidden');
  dom.messages.classList.remove('hidden');
}

function scrollToBottom() {
  const container = document.querySelector('.thread-container');
  container.scrollTop = container.scrollHeight;
}

function autoResizeTextarea() {
  dom.promptInput.style.height = 'auto';
  dom.promptInput.style.height = Math.min(dom.promptInput.scrollHeight, 220) + 'px';
}

function showToast(message, type = '') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  dom.toastContainer.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

/* ──────────────────────────────────────────────
   Event Listeners
   ────────────────────────────────────────────── */

// Send / Stop
dom.btnSend.addEventListener('click', () => {
  if (state.isStreaming) stopStreaming();
  else sendMessage();
});

dom.promptInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!state.isStreaming) sendMessage();
  }
});

dom.promptInput.addEventListener('input', autoResizeTextarea);

// Model dropdown toggles
dom.btnModelSelector.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleModelDropdown();
});

dom.btnCapsuleModel.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleModelDropdown();
});

document.addEventListener('click', (e) => {
  if (!$('model-dropdown-wrapper').contains(e.target)) {
    closeModelDropdown();
  }
});

// Web Search Toggles (Spec 3.1)
dom.btnTopWebSearch.addEventListener('click', toggleWebSearch);
dom.btnCapsuleWebSearch.addEventListener('click', toggleWebSearch);
dom.btnCloseSearchBanner.addEventListener('click', () => setWebSearch(false));

// File Attachments (Spec 3.2 & 3.3)
dom.btnAttach.addEventListener('click', () => dom.fileUploadInput.click());
dom.fileUploadInput.addEventListener('change', (e) => {
  uploadFiles(e.target.files);
  dom.fileUploadInput.value = '';
});

// Drag and Drop (Spec 3.2)
let dragCounter = 0;
window.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragCounter++;
  dom.dragDropOverlay.classList.remove('hidden');
});
window.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dragCounter--;
  if (dragCounter <= 0) {
    dragCounter = 0;
    dom.dragDropOverlay.classList.add('hidden');
  }
});
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragCounter = 0;
  dom.dragDropOverlay.classList.add('hidden');
  if (e.dataTransfer && e.dataTransfer.files.length > 0) {
    uploadFiles(e.dataTransfer.files);
  }
});

// Clipboard Image Paste (Spec 3.3)
dom.promptInput.addEventListener('paste', (e) => {
  const items = e.clipboardData?.items;
  if (!items) return;
  const imageFiles = [];
  for (let i = 0; i < items.length; i++) {
    if (items[i].type.startsWith('image/')) {
      const blob = items[i].getAsFile();
      if (blob) imageFiles.push(blob);
    }
  }
  if (imageFiles.length > 0) {
    uploadFiles(imageFiles);
  }
});

// Lightbox Close (Spec 3.3)
dom.btnCloseLightbox.addEventListener('click', closeLightbox);
dom.imageLightbox.addEventListener('click', (e) => {
  if (e.target === dom.imageLightbox) closeLightbox();
});

// Sidebar navigation
dom.btnToggleSidebar.addEventListener('click', () => {
  dom.sidebar.classList.toggle('collapsed');
});

dom.btnNewChat.addEventListener('click', () => {
  createNewConversation();
});

document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    dom.promptInput.value = chip.dataset.prompt;
    autoResizeTextarea();
    dom.promptInput.focus();
  });
});

dom.sidebarSearch.addEventListener('input', () => renderSidebar());

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'O') {
    e.preventDefault();
    createNewConversation();
  }
  if (e.key === 'Escape') {
    closeLightbox();
  }
});

/* ──────────────────────────────────────────────
   Boot
   ────────────────────────────────────────────── */
async function init() {
  await loadModels();
  await loadConversations();
  await createNewConversation();
  dom.promptInput.focus();
}

init();
