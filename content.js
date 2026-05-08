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
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let savedPos = null; // 用户拖拽后记住的位置

  function sendMsg(type, data) {
    return new Promise(resolve => chrome.runtime.sendMessage({ type, ...data }, resolve));
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

  const SKIP_TYPES = new Set(['password', 'hidden', 'file', 'checkbox', 'radio', 'submit', 'button', 'reset', 'image', 'color', 'range']);

  function isInput(el) {
    if (el.tagName === 'TEXTAREA') return true;
    if (el.tagName === 'INPUT') {
      if (SKIP_TYPES.has((el.type || 'text').toLowerCase())) return false;
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
  }

  function renderDropdown(items, inputEl) {
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
    dropdown.style.width = `${Math.max(rect.width, 260)}px`;

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
    document.body.appendChild(dropdown);

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
  }

  function highlightItem(idx) {
    if (!dropdown) return;
    const items = dropdown.querySelectorAll('.qf-item');
    items.forEach((el, i) => el.classList.toggle('qf-item--active', i === idx));
    if (items[idx]) items[idx].scrollIntoView({ block: 'nearest' });
  }

  // 拖拽移动
  document.addEventListener('mousemove', e => {
    if (!isDragging || !dropdown) return;
    dropdown.style.left = `${Math.max(0, Math.min(e.clientX - dragOffsetX, window.innerWidth - dropdown.offsetWidth))}px`;
    dropdown.style.top = `${Math.max(0, Math.min(e.clientY - dragOffsetY, window.innerHeight - dropdown.offsetHeight))}px`;
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
    renderDropdown(res.list || [], el);
  }, true);

  // Ctrl+M 切换面板
  document.addEventListener('keydown', async e => {
    const el = e.target;
    if (e.ctrlKey && e.code === 'KeyM' && isInput(el)) {
      e.preventDefault();
      if (dropdown) { closeDropdown(); return; }
      activeInput = el;
      const res = await sendMsg('GET_HISTORY', { query: '' });
      renderDropdown(res.list || [], el);
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
