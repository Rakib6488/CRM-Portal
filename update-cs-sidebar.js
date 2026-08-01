const fs = require('fs');

const path = 'E:\\Rakib\\Live Chat\\CS Sidebar\\content.js';
let source = fs.readFileSync(path, 'utf8');

const uiStart = source.indexOf('    // 🎨 ৩. UI ডিজাইন (CSS)');
const uiEnd = source.indexOf('    // ⌨️ ৭. স্মার্ট ফিল এন্ড পেস্ট এবং সাবমিট লজিক');

if (uiStart === -1 || uiEnd === -1 || uiEnd <= uiStart) {
  throw new Error('Could not find the UI block markers in content.js');
}

const uiBlock = String.raw`
    // 🎨 ৩. UI ডিজাইন (CSS)
    const style = document.createElement('style');
    style.textContent = `
      #csr-custom-sidebar {
        position: fixed; left: 20px; bottom: 18px; width: 376px; max-width: calc(100vw - 40px); height: min(680px, calc(100vh - 36px));
        background: #ffffff; color: #071437; z-index: 9999999; display: flex; flex-direction: column;
        font-family: Inter, Segoe UI, Noto Sans Bengali, system-ui, -apple-system, sans-serif;
        border: 1px solid #dfe3ec; border-radius: 8px; box-shadow: 0 18px 52px rgba(15, 23, 42, 0.18);
        overflow: hidden; transition: width 0.1s ease, transform 0.18s ease, opacity 0.18s ease;
      }
      #csr-custom-sidebar * { box-sizing: border-box; }
      .csr-header { min-height: 56px; padding: 10px 12px; background: #f7f8fb; border-bottom: 1px solid #e6e9f0; display: flex; align-items: center; gap: 10px; }
      .csr-logo { width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; color: #5f00c8; background: #efe8ff; font-size: 18px; font-weight: 800; box-shadow: inset 0 0 0 1px rgba(95,0,200,0.14); }
      .csr-title-block { flex: 1; min-width: 0; }
      .csr-header h3 { margin: 0; font-size: 14px; color: #071437; font-weight: 700; line-height: 1.2; }
      .csr-subtitle { margin-top: 2px; color: #64748b; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .csr-meta-info { text-align: right; display: flex; flex-direction: column; gap: 2px; }
      #csr-status { font-size: 10px; color: #5f00c8; font-weight: 700; transition: color 0.2s ease; }
      #csr-credit { font-size: 9px; color: #8a93a3; font-weight: 600; }
      .csr-channel-tabs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; padding: 10px 12px 8px; background: #ffffff; border-bottom: 1px solid #edf0f5; }
      .csr-channel-tabs button, .csr-tabs button { min-height: 32px; border: 1px solid #dfe3ec; background: #ffffff; color: #26324d; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 5px; transition: all 0.16s ease; }
      .csr-channel-tabs button:hover, .csr-tabs button:hover { border-color: #b9c0ce; background: #f8fafc; }
      .csr-channel-tabs button.active, .csr-tabs button.active { background: #5f00c8 !important; border-color: #5f00c8 !important; color: #ffffff !important; box-shadow: 0 6px 14px rgba(95, 0, 200, 0.18); }
      .csr-search-wrapper { padding: 10px 12px 8px; background: #ffffff; }
      #csr-search-input { width: 100%; height: 36px; padding: 8px 11px; font-size: 12px; border: 1px solid #cfd5df; border-radius: 6px; outline: none; background: #fbfcfe; color: #0f172a; transition: all 0.2s ease; }
      #csr-search-input:focus { border-color: #5f00c8; background: #ffffff; box-shadow: 0 0 0 3px rgba(95, 0, 200, 0.12); }
      .csr-tabs { display: flex; padding: 0 12px 10px; gap: 7px; background: #ffffff; border-bottom: 1px solid #edf0f5; }
      .csr-layout { flex: 1; min-height: 0; display: grid; grid-template-columns: 112px minmax(0, 1fr); background: #f3f5f8; }
      .csr-category-sidebar { overflow-y: auto; padding: 8px; border-right: 1px solid #e3e7ef; background: #ffffff; }
      .csr-category-btn { width: 100%; min-height: 34px; border: 1px solid transparent; border-radius: 6px; background: transparent; color: #334155; display: flex; align-items: center; gap: 7px; padding: 7px 8px; margin-bottom: 4px; cursor: pointer; text-align: left; font-size: 11px; font-weight: 700; }
      .csr-category-btn:hover { background: #f6f7fb; border-color: #e6e9f0; }
      .csr-category-btn.active { color: #5f00c8; background: #f3edff; border-color: #ddceff; }
      .csr-category-icon { width: 17px; text-align: center; flex: 0 0 17px; }
      .csr-category-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .csr-list-panel { min-width: 0; display: flex; flex-direction: column; }
      .csr-list-heading { padding: 9px 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px; background: #f8fafc; border-bottom: 1px solid #e5e9f1; }
      #csr-active-category-title { font-size: 12px; color: #071437; font-weight: 800; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
      #csr-template-count { color: #6b7280; font-size: 10px; font-weight: 700; white-space: nowrap; }
      .csr-scrollable { flex: 1; min-height: 0; overflow-y: auto; padding: 9px 10px 12px; background: #f3f5f8; }
      .csr-scrollable::-webkit-scrollbar, .csr-category-sidebar::-webkit-scrollbar { width: 6px; }
      .csr-scrollable::-webkit-scrollbar-thumb, .csr-category-sidebar::-webkit-scrollbar-thumb { background: rgba(119, 128, 145, 0.55); border-radius: 10px; }
      .csr-item-wrapper { display: flex; align-items: center; background: #ffffff; border: 1px solid #dfe3ec; border-radius: 6px; margin-bottom: 7px; padding-right: 4px; transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease; }
      .csr-item-wrapper:hover { border-color: #b9c0ce; transform: translateY(-1px); box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08); }
      .csr-msg-btn { flex: 1; min-width: 0; background: transparent !important; border: none !important; text-align: left !important; padding: 9px 6px 9px 10px !important; font-size: 12px !important; line-height: 1.25 !important; cursor: pointer; color: #1f2937; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .csr-action-btn { width: 28px; height: 28px; background: transparent; border: none; border-radius: 5px; cursor: pointer; font-size: 12px; color: #9aa3b2; transition: transform 0.2s ease, color 0.2s ease, background 0.2s ease; }
      .csr-action-btn:hover { transform: scale(1.08); color: #374151; background: #f3f4f6; }
      .csr-star-btn.starred { color: #f59e0b !important; }
      .csr-divider-title { font-size: 10px; color: #697386; text-transform: uppercase; font-weight: 800; margin: 11px 2px 7px; letter-spacing: 0.5px; }
      .csr-empty-state { text-align: center; color: #64748b; font-size: 12px; padding: 24px 10px; }
      .csr-add-btn-wrapper { padding: 9px 12px; border-top: 1px solid #e2e8f0; background: #ffffff; }
      #csr-add-template-btn { width: 100%; min-height: 34px; font-size: 12px; font-weight: 800; background: #5f00c8; color: white; border: none; border-radius: 6px; cursor: pointer; transition: background 0.2s ease; }
      #csr-add-template-btn:hover { background: #4b00a0; }
      #csr-resize-handle { position: absolute; top: 0; right: 0; width: 7px; height: 100%; cursor: ew-resize; background: transparent; z-index: 10; }
      #csr-resize-handle:hover { background: rgba(95, 0, 200, 0.18); }
      #csr-toggle-btn { position: fixed; left: 20px; bottom: 18px; z-index: 9999999; width: 54px; height: 54px; border-radius: 50%; background: #5f00c8; color: white; border: none; cursor: pointer; font-weight: 900; font-size: 20px; box-shadow: 0 14px 34px rgba(15, 23, 42, 0.26); transition: transform 0.18s ease, background 0.18s ease; }
      #csr-toggle-btn:hover { transform: translateY(-2px); background: #4b00a0; }
      #csr-edit-modal { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15, 23, 42, 0.4); backdrop-filter: blur(4px); z-index: 99999999; display: flex; justify-content: center; align-items: center; }
      .csr-modal-content { background: #ffffff; width: 90%; max-width: 440px; padding: 22px; border-radius: 8px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.15); font-family: system-ui, -apple-system, sans-serif; }
      .csr-modal-content h4 { margin: 0 0 16px 0; font-size: 16px; color: #071437; }
      .csr-modal-content label { display: block; font-size: 12px; font-weight: 700; color: #64748b; margin-bottom: 5px; }
      .csr-modal-content input, .csr-modal-content textarea, .csr-modal-content select { width: 100%; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; font-size: 12.5px; outline: none; margin-bottom: 14px; }
      .csr-modal-actions { display: flex; justify-content: flex-end; gap: 8px; }
      .csr-modal-actions button { padding: 8px 16px; font-size: 12.5px; font-weight: 700; border-radius: 6px; cursor: pointer; border: 1px solid #e2e8f0; }
      .csr-btn-cancel { background: #ffffff; color: #64748b; }
      .csr-btn-save { background: #5f00c8; color: #ffffff; border-color: #5f00c8 !important; }
      @media (max-width: 520px) { #csr-custom-sidebar { left: 10px; bottom: 10px; width: calc(100vw - 20px); height: min(76vh, 660px); } .csr-layout { grid-template-columns: 96px minmax(0, 1fr); } #csr-toggle-btn { left: 14px; bottom: 14px; } }
    `;
    document.head.appendChild(style);

    const CHANNELS = [
      { id: 'all', label: 'All', icon: '◎' },
      { id: 'telegram', label: 'Telegram', icon: '✈' },
      { id: 'whatsapp', label: 'WhatsApp', icon: '☎' },
      { id: 'facebook', label: 'Facebook', icon: 'f' }
    ];
    const CATEGORIES = [
      { id: 'all', label: 'All Scripts', icon: '☰', test: () => true },
      { id: 'bookmarked', label: 'Saved', icon: '★', test: item => starredItems.includes(item.id) },
      { id: 'general', label: 'General', icon: '●', test: item => /_(g|p|e|c)\d+|greeting|details|hold|waiting|misbehavior|query|sorry/i.test(item.id + ' ' + item.title) },
      { id: 'app', label: 'App/Login', icon: '▣', test: item => /_(a|l|w)\d+|app|login|otp|pin|watermark|repayment/i.test(item.id + ' ' + item.title) },
      { id: 'payment', label: 'Payment', icon: '৳', test: item => /payment|bkash|nagad|loan|emi|installment|repay|cash/i.test(item.title + ' ' + item.msg) },
      { id: 'screenshot', label: 'Media', icon: '▧', test: item => /whatsapp|screenshot|photo|image|inbox/i.test(item.title + ' ' + item.msg) },
      { id: 'hotline', label: 'Hotline', icon: '☎', test: item => /_(h|f)\d+|hotline|callback|customer support|phone/i.test(item.id + ' ' + item.title) },
      { id: 'smartbuy', label: 'Smart Buy', icon: '◆', test: item => /_(b|m)\d+|smart buy|showroom|merchant|purchase|offer/i.test(item.id + ' ' + item.title) },
      { id: 'policy', label: 'Policy', icon: '§', test: item => /_(d|st)\d+|policy|factory|uninstall|developer|stolen|death|reset|flashed/i.test(item.id + ' ' + item.title) },
      { id: 'refund', label: 'Refund', icon: '↩', test: item => /_(r)\d+|refund|bank payment/i.test(item.id + ' ' + item.title) },
      { id: 'custom', label: 'Custom', icon: '+', test: item => /custom/i.test(item.id) }
    ];
    let currentChannel = localStorage.getItem('csr_active_channel') || 'all';
    let currentCategory = localStorage.getItem('csr_active_category') || 'all';

    // 📌 ৪. সাইডবার ইন্টারনাল HTML লেআউট
    sidebar.innerHTML = `
      <div class="csr-header">
        <div class="csr-logo">S</div>
        <div class="csr-title-block">
          <h3>Live Chat Assistant</h3>
          <div class="csr-subtitle">Telegram, WhatsApp, Facebook scripts</div>
        </div>
        <div class="csr-meta-info">
          <span id="csr-status">Ready</span>
          <span id="csr-credit">Made by Rakib</span>
        </div>
      </div>
      <div class="csr-channel-tabs" id="csr-channel-tabs">
        ${CHANNELS.map(channel => `<button type="button" data-channel="${channel.id}" class="${channel.id === currentChannel ? 'active' : ''}"><span>${channel.icon}</span>${channel.label}</button>`).join('')}
      </div>
      <div class="csr-search-wrapper">
        <input type="text" id="csr-search-input" placeholder="Search saved script...">
      </div>
      <div class="csr-tabs">
        <button id="tab-bn" class="active" type="button">Bangla</button>
        <button id="tab-en" type="button">English</button>
      </div>
      <div class="csr-layout">
        <div id="csr-category-list" class="csr-category-sidebar"></div>
        <div class="csr-list-panel">
          <div class="csr-list-heading">
            <span id="csr-active-category-title">All Scripts</span>
            <span id="csr-template-count">0 saved</span>
          </div>
          <div id="csr-btn-container" class="csr-scrollable"></div>
        </div>
      </div>
      <div class="csr-add-btn-wrapper">
        <button id="csr-add-template-btn" type="button">+ Add New Script</button>
      </div>
      <div id="csr-resize-handle"></div>
    `;

    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'csr-toggle-btn';
    toggleBtn.type = 'button';
    toggleBtn.innerText = 'S';

    function setStatus(text, color = '#5f00c8') {
      const statusEl = document.getElementById('csr-status');
      if (statusEl) { statusEl.innerText = text; statusEl.style.color = color; }
    }

    function channelMatches(item) {
      if (currentChannel === 'all') return true;
      const text = `${item.title} ${item.msg}`.toLowerCase();
      if (currentChannel === 'whatsapp') return /whatsapp|screenshot|inbox|photo|image/.test(text);
      if (currentChannel === 'facebook') return /facebook|messenger|fb\b/.test(text) || !/telegram|whatsapp/.test(text);
      if (currentChannel === 'telegram') return /telegram|tg\b/.test(text) || !/facebook|messenger|whatsapp/.test(text);
      return true;
    }

    function getActiveCategory() {
      return CATEGORIES.find(category => category.id === currentCategory) || CATEGORIES[0];
    }

    function getVisibleTemplates(lang, filterText = '') {
      const query = filterText.trim().toLowerCase();
      const category = getActiveCategory();
      return (templates[lang] || []).filter(item => {
        const searchable = `${item.title} ${item.msg}`.toLowerCase();
        return channelMatches(item) && category.test(item) && (!query || searchable.includes(query));
      });
    }

    function renderCategories() {
      const list = sidebar.querySelector('#csr-category-list');
      if (!list) return;
      list.innerHTML = '';
      CATEGORIES.forEach(category => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `csr-category-btn ${category.id === currentCategory ? 'active' : ''}`;
        btn.innerHTML = `<span class="csr-category-icon">${category.icon}</span><span class="csr-category-label">${category.label}</span>`;
        btn.addEventListener('click', () => {
          currentCategory = category.id;
          localStorage.setItem('csr_active_category', currentCategory);
          renderCategories();
          renderButtons(currentLanguage, sidebar.querySelector('#csr-search-input').value);
        });
        list.appendChild(btn);
      });
    }

    function setChannel(channelId) {
      currentChannel = channelId;
      localStorage.setItem('csr_active_channel', currentChannel);
      sidebar.querySelectorAll('[data-channel]').forEach(btn => btn.classList.toggle('active', btn.dataset.channel === currentChannel));
      renderButtons(currentLanguage, sidebar.querySelector('#csr-search-input').value);
    }

    function detectCurrentChannel() {
      const pageText = document.body ? document.body.innerText.toLowerCase() : '';
      if (/telegram/.test(pageText)) return 'telegram';
      if (/whatsapp/.test(pageText)) return 'whatsapp';
      if (/facebook|messenger/.test(pageText)) return 'facebook';
      return null;
    }

    // 🛠️ ৫. সাইডবার উইন্ডো রিসাইজার (Drag to Resize)
    const resizeHandle = sidebar.querySelector('#csr-resize-handle');
    let isResizing = false;
    resizeHandle.addEventListener('mousedown', () => { isResizing = true; document.body.style.cursor = 'ew-resize'; });
    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      let newWidth = e.clientX - sidebar.getBoundingClientRect().left;
      if (newWidth < 320) newWidth = 320; if (newWidth > 620) newWidth = 620;
      sidebar.style.width = `${newWidth}px`;
    });
    document.addEventListener('mouseup', () => { isResizing = false; document.body.style.cursor = 'default'; });

    // ⏳ ৬. ল্যাঙ্গুয়েজ ট্যাব কন্ট্রোলার
    const tabBn = sidebar.querySelector('#tab-bn');
    const tabEn = sidebar.querySelector('#tab-en');
    tabBn.addEventListener('click', () => { currentLanguage = 'bangla'; tabBn.classList.add('active'); tabEn.classList.remove('active'); renderButtons('bangla', sidebar.querySelector('#csr-search-input').value); });
    tabEn.addEventListener('click', () => { currentLanguage = 'english'; tabEn.classList.add('active'); tabBn.classList.remove('active'); renderButtons('english', sidebar.querySelector('#csr-search-input').value); });
    sidebar.querySelectorAll('[data-channel]').forEach(btn => btn.addEventListener('click', () => setChannel(btn.dataset.channel)));
`;

source = source.slice(0, uiStart) + uiBlock + source.slice(uiEnd);

source = source.replace(
  /const statusEl = document\.getElementById\('csr-status'\);\n\s+if \(statusEl\) \{\n\s+statusEl\.innerText = "📋 Copied & Filled!"; statusEl\.style\.color = "#10b981"; \n\s+autoPasteToChatInput\(item\.msg, false\);\n\s+setTimeout\(\(\) => \{ statusEl\.innerText = "Click to Copy & Paste!"; statusEl\.style\.color = "#4f46e5"; \}, 1200\);\n\s+\}/,
  "setStatus('Copied & Filled', '#10b981');\n          autoPasteToChatInput(item.msg, false);\n          setTimeout(() => setStatus('Ready', '#5f00c8'), 1200);"
);

source = source.replace(
  /function renderButtons\(lang, filterText = ""\) \{[\s\S]*?\n    function createTemplateRow/,
  `function renderButtons(lang, filterText = "") {
      const container = document.getElementById('csr-btn-container');
      const countEl = document.getElementById('csr-template-count');
      const titleEl = document.getElementById('csr-active-category-title');
      if (!container) return;
      container.innerHTML = '';
      const category = getActiveCategory();
      const filteredList = getVisibleTemplates(lang, filterText);
      if (titleEl) titleEl.innerText = category.label;
      if (countEl) countEl.innerText = \`\${filteredList.length} saved\`;
      if (filteredList.length === 0) {
        container.innerHTML = \`<div class="csr-empty-state">No saved script matched.</div>\`;
        return;
      }
      const starredItemsData = filteredList.filter(item => starredItems.includes(item.id));
      const normalItemsData = filteredList.filter(item => !starredItems.includes(item.id));

      if (starredItemsData.length > 0) {
        const favTitle = document.createElement('div'); favTitle.className = 'csr-divider-title'; favTitle.innerHTML = "Important / Bookmarked"; container.appendChild(favTitle);
        starredItemsData.forEach(item => createTemplateRow(item, container, true, lang));
      }
      if (normalItemsData.length > 0) {
        if (starredItemsData.length > 0) {
          const allTitle = document.createElement('div'); allTitle.className = 'csr-divider-title'; allTitle.innerHTML = "All Scripts"; container.appendChild(allTitle);
        }
        normalItemsData.forEach(item => createTemplateRow(item, container, false, lang));
      }
    }

    function createTemplateRow`
);

source = source.replace(
  /renderButtons\(currentLanguage, sidebar\.querySelector\('#csr-search-input'\)\.value\);/g,
  "renderCategories();\n        renderButtons(currentLanguage, sidebar.querySelector('#csr-search-input').value);"
);

source = source.replace(
  /sidebar\.style\.display = 'none';\n\s+toggleBtn\.style\.left = '0px';/,
  "sidebar.style.display = 'none';"
);

source = source.replace(
  /if \(sidebar\.style\.display === 'none'\) \{\n\s+sidebar\.style\.display = 'flex'; \n\s+toggleBtn\.style\.left = `\$\{sidebar\.offsetWidth \|\| 310\}px`;\n\s+toggleBtn\.style\.background = '#10b981';\n\s+\} else \{\n\s+sidebar\.style\.display = 'none'; \n\s+toggleBtn\.style\.left = '0px';\n\s+toggleBtn\.style\.background = '#4f46e5';\n\s+\}/,
  `if (sidebar.style.display === 'none') {
            sidebar.style.display = 'flex';
            toggleBtn.style.display = 'none';
          } else {
            sidebar.style.display = 'none';
            toggleBtn.style.display = 'block';
          }`
);

source = source.replace(
  /renderButtons\('bangla'\);\n\s+startAutoReplyEngine\(\);/,
  `renderCategories();
        const detectedChannel = detectCurrentChannel();
        if (detectedChannel && currentChannel === 'all') setChannel(detectedChannel);
        renderButtons('bangla');
        startAutoReplyEngine();`
);

fs.writeFileSync(path, source, 'utf8');
