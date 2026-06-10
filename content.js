// content.js - 选中文字保存 + 历史回填

(function () {
  'use strict';

  if (window.__qfInjected) return;
  window.__qfInjected = true;

  const isCN = navigator.language.startsWith('zh');
  const ct = (zh, en) => isCN ? zh : en;
  let bubble = null;       // 选中保存气泡
  let dropdown = null;     // 历史记录面板
  let activeInput = null;
  let activeIndex = -1;
  let currentItems = [];
  let isDragging = false;
  let isResizing = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let resizeStartX = 0;
  let resizeStartY = 0;
  let resizeStartWidth = 0;
  let resizeStartHeight = 0;
  let savedPos = null; // 用户拖拽后记住的位置
  let savedSize = null; // 用户拉伸后记住的尺寸
  let layoutLoaded = false;
  let layoutLoadPromise = null;
  const DROPDOWN_LAYOUT_KEY = 'qf_dropdown_layout';

  function sendMsg(type, data) {
    return new Promise(resolve => chrome.runtime.sendMessage({ type, ...data }, resolve));
  }

  function storageGet(keys) {
    return new Promise(resolve => {
      try {
        chrome.storage.local.get(keys, resolve);
      } catch {
        resolve({});
      }
    });
  }

  function storageSet(data) {
    try {
      chrome.storage.local.set(data);
    } catch {}
  }

  function isFiniteNumber(n) {
    return typeof n === 'number' && Number.isFinite(n);
  }

  function clampNumber(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  async function loadDropdownLayout() {
    if (layoutLoaded) return;
    if (!layoutLoadPromise) {
      layoutLoadPromise = storageGet(DROPDOWN_LAYOUT_KEY).then(res => {
        const layout = res[DROPDOWN_LAYOUT_KEY];
        if (layout && layout.pos && isFiniteNumber(layout.pos.x) && isFiniteNumber(layout.pos.y)) {
          savedPos = { x: layout.pos.x, y: layout.pos.y };
        }
        if (layout && layout.size && isFiniteNumber(layout.size.width) && isFiniteNumber(layout.size.height)) {
          savedSize = {
            width: clampNumber(layout.size.width, 200, Math.max(200, window.innerWidth - 6)),
            height: clampNumber(layout.size.height, 96, Math.max(96, window.innerHeight - 6)),
          };
        }
        layoutLoaded = true;
      });
    }
    await layoutLoadPromise;
  }

  function saveDropdownLayout() {
    storageSet({
      [DROPDOWN_LAYOUT_KEY]: {
        pos: savedPos,
        size: savedSize,
      },
    });
  }

  function keepDropdownInViewport() {
    if (!dropdown) return;
    const maxLeft = Math.max(0, window.innerWidth - dropdown.offsetWidth);
    const maxTop = Math.max(0, window.innerHeight - dropdown.offsetHeight);
    const left = clampNumber(parseFloat(dropdown.style.left) || 0, 0, maxLeft);
    const top = clampNumber(parseFloat(dropdown.style.top) || 0, 0, maxTop);
    dropdown.style.left = `${left}px`;
    dropdown.style.top = `${top}px`;
  }

  // ─── 选中文字保存气泡 ─────────────────────────────────────

  function removeBubble() {
    if (bubble) { bubble.remove(); bubble = null; }
  }

  function showBubble(text, x, y) {
    removeBubble();
    bubble = document.createElement('div');
    bubble.className = 'qf-bubble';
    bubble.textContent = ct('保存到 Quick Fill', 'Save to Quick Fill');
    bubble.style.left = `${x}px`;
    bubble.style.top = `${y - 36}px`;

    bubble.addEventListener('mousedown', async e => {
      e.preventDefault();
      e.stopPropagation();
      const val = text.trim();
      if (val.length >= 2) {
        await sendMsg('SAVE_HISTORY', { text: val });
        bubble.textContent = ct('✓ 已存入', '✓ Saved');
        bubble.classList.add('qf-bubble--saved');
      }
      setTimeout(removeBubble, 800);
    });

    document.body.appendChild(bubble);
  }

  document.addEventListener('mouseup', e => {
    // 点的是气泡自身，不处理
    if (bubble && bubble.contains(e.target)) return;

    setTimeout(() => {
      const sel = window.getSelection();
      const text = sel ? sel.toString().trim() : '';
      if (text.length >= 2) {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const x = rect.left + window.scrollX + rect.width / 2 - 36;
        const y = rect.top + window.scrollY;
        showBubble(text, x, y);
      } else {
        removeBubble();
      }
    }, 10);
  });

  // 点击其他地方关闭气泡
  document.addEventListener('mousedown', e => {
    if (bubble && !bubble.contains(e.target)) removeBubble();
  });

  // ─── 历史记录面板 ─────────────────────────────────────────

  const SKIP_TYPES = new Set([
    'password',
    'hidden',
    'file',
    'checkbox',
    'radio',
    'submit',
    'button',
    'reset',
    'image',
    'color',
    'range',
    'date',
    'datetime-local',
    'month',
    'time',
    'week',
  ]);

  const DATE_PICKER_SELECTOR = [
    '.ant-picker',
    '.ant-calendar-picker',
    '.el-date-editor',
    '.ivu-date-picker',
    '.mx-datepicker',
    '.flatpickr-input',
    '.layui-laydate',
    '.date-picker',
    '.datepicker',
    '[class*="date-picker"]',
    '[class*="datepicker"]',
  ].join(',');
  const DATE_HINT_RE = /(^|[-_\s])(date|datetime|time|calendar|month|year)([-_\s]|$)|日期|时间|日历|年月/;

  function normalizeHintText(text) {
    return String(text || '')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .toLowerCase();
  }

  function hasDatePickerHints(el) {
    if (el.closest(DATE_PICKER_SELECTOR)) return true;
    const hintText = [
      el.id,
      el.name,
      el.className,
      el.placeholder,
      el.title,
      el.getAttribute('aria-label'),
      el.getAttribute('autocomplete'),
      el.getAttribute('data-testid'),
    ].map(normalizeHintText).join(' ');
    return DATE_HINT_RE.test(hintText);
  }

  function isInput(el) {
    if (el.tagName === 'TEXTAREA') return true;
    if (el.tagName === 'INPUT') {
      if (SKIP_TYPES.has((el.type || 'text').toLowerCase())) return false;
      if (hasDatePickerHints(el)) return false;
      if (el.readOnly) return false; // 日期选择器等只读展示框
      const role = (el.getAttribute('role') || '').toLowerCase();
      if (role === 'combobox' || role === 'listbox' || role === 'spinbutton') return false;
      return true;
    }
    return false;
  }

  function fillInput(el, text) {
    el.focus();
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.set) desc.set.call(el, text);
    else el.value = text;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function closeDropdown() {
    if (dropdown) { dropdown.remove(); dropdown = null; }
    activeIndex = -1;
    currentItems = [];
    isDragging = false;
    isResizing = false;
  }

  async function renderDropdown(items, inputEl) {
    await loadDropdownLayout();
    closeDropdown();
    currentItems = items;
    activeIndex = -1;

    const rect = inputEl.getBoundingClientRect();
    dropdown = document.createElement('div');
    dropdown.className = 'qf-dropdown';
    dropdown.style.position = 'fixed';
    if (savedPos) {
      dropdown.style.top = `${savedPos.y}px`;
      dropdown.style.left = `${savedPos.x}px`;
    } else {
      dropdown.style.top = `${rect.bottom + 4}px`;
      dropdown.style.left = `${rect.left}px`;
    }
    dropdown.style.width = `${savedSize ? savedSize.width : Math.max(rect.width, 260)}px`;
    if (savedSize) dropdown.style.height = `${savedSize.height}px`;

    // 标题栏（可拖拽）
    const handle = document.createElement('div');
    handle.className = 'qf-drag-handle';
    handle.innerHTML = `<span>${ct('历史记录', 'History')}</span><span class="qf-drag-icon">⠿</span>`;
    dropdown.appendChild(handle);

    // 列表
    const list = document.createElement('div');
    list.className = 'qf-list';

    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'qf-empty';
      empty.textContent = ct('暂无记录，选中文字可保存', 'No records yet. Select text to save.');
      list.appendChild(empty);
    } else {
      items.forEach((item, idx) => {
        const row = document.createElement('div');
        row.className = 'qf-item';
        row.dataset.idx = idx;

        const text = document.createElement('span');
        text.className = 'qf-item-text';
        text.textContent = item.text;
        text.title = item.text;

        const count = document.createElement('span');
        count.className = 'qf-item-count';
        count.textContent = `×${item.count}`;

        row.appendChild(text);
        row.appendChild(count);
        row.addEventListener('mousedown', e => {
          e.preventDefault();
          fillInput(inputEl, item.text);
          sendMsg('SAVE_HISTORY', { text: item.text });
          closeDropdown();
        });
        list.appendChild(row);
      });
    }

    dropdown.appendChild(list);

    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'qf-resize-handle';
    resizeHandle.title = ct('拖拽调整大小', 'Drag to resize');
    dropdown.appendChild(resizeHandle);

    document.body.appendChild(dropdown);
    keepDropdownInViewport();

    // 拖拽
    handle.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      e.preventDefault();
      isDragging = true;
      const r = dropdown.getBoundingClientRect();
      dragOffsetX = e.clientX - r.left;
      dragOffsetY = e.clientY - r.top;
      dropdown.classList.add('qf-dragging');
    });

    resizeHandle.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      isResizing = true;
      resizeStartX = e.clientX;
      resizeStartY = e.clientY;
      resizeStartWidth = dropdown.offsetWidth;
      resizeStartHeight = dropdown.offsetHeight;
      dropdown.classList.add('qf-dragging');
    });
  }

  function highlightItem(idx) {
    if (!dropdown) return;
    const items = dropdown.querySelectorAll('.qf-item');
    items.forEach((el, i) => el.classList.toggle('qf-item--active', i === idx));
    if (items[idx]) items[idx].scrollIntoView({ block: 'nearest' });
  }

  // 拖拽移动
  document.addEventListener('mousemove', e => {
    if (!dropdown) return;
    if (isDragging) {
      dropdown.style.left = `${Math.max(0, Math.min(e.clientX - dragOffsetX, window.innerWidth - dropdown.offsetWidth))}px`;
      dropdown.style.top = `${Math.max(0, Math.min(e.clientY - dragOffsetY, window.innerHeight - dropdown.offsetHeight))}px`;
    } else if (isResizing) {
      const left = dropdown.getBoundingClientRect().left;
      const top = dropdown.getBoundingClientRect().top;
      const width = Math.max(200, Math.min(resizeStartWidth + e.clientX - resizeStartX, window.innerWidth - left - 6));
      const height = Math.max(96, Math.min(resizeStartHeight + e.clientY - resizeStartY, window.innerHeight - top - 6));
      dropdown.style.width = `${width}px`;
      dropdown.style.height = `${height}px`;
    }
  });
  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      if (dropdown) {
        dropdown.classList.remove('qf-dragging');
        savedPos = {
          x: parseFloat(dropdown.style.left),
          y: parseFloat(dropdown.style.top),
        };
        saveDropdownLayout();
      }
    }
    if (isResizing) {
      isResizing = false;
      if (dropdown) {
        dropdown.classList.remove('qf-dragging');
        savedSize = {
          width: dropdown.offsetWidth,
          height: dropdown.offsetHeight,
        };
        keepDropdownInViewport();
        savedPos = {
          x: parseFloat(dropdown.style.left),
          y: parseFloat(dropdown.style.top),
        };
        saveDropdownLayout();
      }
    }
  });

  // 聚焦输入框弹出历史面板
  document.addEventListener('focus', async e => {
    const el = e.target;
    if (!isInput(el)) return;
    if (dropdown && activeInput === el) return;
    activeInput = el;
    const res = await sendMsg('GET_HISTORY', { query: '' });
    await renderDropdown(res.list || [], el);
  }, true);

  // Ctrl+M 切换面板
  document.addEventListener('keydown', async e => {
    const el = e.target;
    if (e.ctrlKey && e.code === 'KeyM' && isInput(el)) {
      e.preventDefault();
      if (dropdown) { closeDropdown(); return; }
      activeInput = el;
      const res = await sendMsg('GET_HISTORY', { query: '' });
      await renderDropdown(res.list || [], el);
      return;
    }
    if (!dropdown) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, currentItems.length - 1);
      highlightItem(activeIndex);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      highlightItem(activeIndex);
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      fillInput(activeInput || el, currentItems[activeIndex].text);
      sendMsg('SAVE_HISTORY', { text: currentItems[activeIndex].text });
      closeDropdown();
    } else if (e.key === 'Escape') {
      closeDropdown();
    }
  }, true);

  // 点击外部关闭面板
  document.addEventListener('mousedown', e => {
    if (!dropdown) return;
    if (dropdown.contains(e.target)) return;
    if (e.target === activeInput) return;
    closeDropdown();
  }, true);

  window.addEventListener('resize', closeDropdown, { passive: true });

  // 接收 Popup 填充指令
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'FILL_ACTIVE') {
      const focused = document.activeElement;
      if (focused && isInput(focused)) {
        fillInput(focused, message.text);
        sendMsg('SAVE_HISTORY', { text: message.text });
        sendResponse({ ok: true });
      } else {
        sendResponse({ ok: false });
      }
    }
  });
})();
