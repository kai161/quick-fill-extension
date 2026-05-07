// popup.js

(async function () {
  // ── DOM 引用 ──────────────────────────────────────────────
  const searchInput   = document.getElementById('searchInput');
  const listWrap      = document.getElementById('listWrap');
  const emptyTip      = document.getElementById('emptyTip');
  const btnClear      = document.getElementById('btnClear');
  const btnSaveInput  = document.getElementById('btnSaveInput');
  const countTip      = document.getElementById('countTip');
  const btnSettings   = document.getElementById('btnSettings');
  const btnBack       = document.getElementById('btnBack');
  const panelMain     = document.getElementById('panelMain');
  const panelSettings = document.getElementById('panelSettings');
  const limitBanner   = document.getElementById('limitBanner');
  const limitBannerText = document.getElementById('limitBannerText');
  const btnUpgradeMain = document.getElementById('btnUpgradeMain');

  // 账号
  const authForm      = document.getElementById('authForm');
  const userInfo      = document.getElementById('userInfo');
  const tabLogin      = document.getElementById('tabLogin');
  const tabRegister   = document.getElementById('tabRegister');
  const authEmail     = document.getElementById('authEmail');
  const authPassword  = document.getElementById('authPassword');
  const authError     = document.getElementById('authError');
  const btnAuth       = document.getElementById('btnAuth');
  const userEmail     = document.getElementById('userEmail');
  const userBadge     = document.getElementById('userBadge');
  const btnLogout     = document.getElementById('btnLogout');
  const upgradeSection = document.getElementById('upgradeSection');

  // 网站白名单
  const modeAllEl        = document.getElementById('modeAll');
  const modeAllowlistEl  = document.getElementById('modeAllowlist');
  const siteInput        = document.getElementById('siteInput');
  const btnAddSite       = document.getElementById('btnAddSite');
  const btnAddCurrent    = document.getElementById('btnAddCurrent');
  const siteListWrap     = document.getElementById('siteListWrap');
  const siteEmptyTip     = document.getElementById('siteEmptyTip');
  const allowlistSection = document.getElementById('allowlistSection');

  let allItems = [];
  let authMode = 'login'; // 'login' | 'register'

  const FREE_LIMIT = 10;

  function sendMsg(type, data) {
    return new Promise(resolve => chrome.runtime.sendMessage({ type, ...data }, resolve));
  }

  // ── 面板切换 ──────────────────────────────────────────────

  btnSettings.addEventListener('click', () => {
    panelMain.style.display = 'none';
    panelSettings.style.display = '';
    loadSettings();
  });

  btnBack.addEventListener('click', () => {
    panelSettings.style.display = 'none';
    panelMain.style.display = '';
    searchInput.focus();
  });

  // ── 免费限额 Banner ───────────────────────────────────────

  function updateLimitBanner(count, isPro) {
    if (isPro) {
      limitBanner.style.display = 'none';
      return;
    }
    const remaining = Math.max(0, FREE_LIMIT - count);
    if (remaining === 0) {
      limitBannerText.textContent = '已达免费上限（10 条），升级后无限保存';
      limitBanner.style.display = 'flex';
      limitBanner.classList.add('limit-banner--full');
    } else if (remaining <= 3) {
      limitBannerText.textContent = `免费版剩余 ${remaining} 条额度`;
      limitBanner.style.display = 'flex';
      limitBanner.classList.remove('limit-banner--full');
    } else {
      limitBanner.style.display = 'none';
    }
  }

  btnUpgradeMain.addEventListener('click', () => {
    panelMain.style.display = 'none';
    panelSettings.style.display = '';
    loadSettings();
  });

  // ── 渲染历史列表 ──────────────────────────────────────────

  function renderList(items) {
    listWrap.querySelectorAll('.record-item').forEach(el => el.remove());
    if (!items.length) {
      emptyTip.style.display = 'block';
      countTip.textContent = '';
      return;
    }
    emptyTip.style.display = 'none';
    countTip.textContent = `共 ${items.length} 条`;

    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'record-item';

      const text = document.createElement('span');
      text.className = 'record-text';
      text.textContent = item.text;
      text.title = item.text;

      const count = document.createElement('span');
      count.className = 'record-count';
      count.textContent = `×${item.count}`;

      const delBtn = document.createElement('button');
      delBtn.className = 'btn-del';
      delBtn.textContent = '×';
      delBtn.title = '删除';
      delBtn.addEventListener('click', async e => {
        e.stopPropagation();
        await sendMsg('DELETE_RECORD', { text: item.text });
        allItems = allItems.filter(i => i.text !== item.text);
        renderList(getFiltered());
      });

      row.addEventListener('click', async () => {
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!tab) return;
          const res = await chrome.tabs.sendMessage(tab.id, { type: 'FILL_ACTIVE', text: item.text });
          showToast(res && res.ok ? '已填充' : '请先点击目标输入框');
        } catch {
          showToast('请先点击目标输入框');
        }
      });

      row.appendChild(text);
      row.appendChild(count);
      row.appendChild(delBtn);
      listWrap.appendChild(row);
    });
  }

  function getFiltered() {
    const q = searchInput.value.trim().toLowerCase();
    return q ? allItems.filter(i => i.text.toLowerCase().includes(q)) : allItems;
  }

  // ── 账号 UI ───────────────────────────────────────────────

  function switchAuthTab(mode) {
    authMode = mode;
    tabLogin.classList.toggle('auth-tab--active', mode === 'login');
    tabRegister.classList.toggle('auth-tab--active', mode === 'register');
    btnAuth.textContent = mode === 'login' ? '登录' : '注册';
    authError.textContent = '';
  }

  tabLogin.addEventListener('click', () => switchAuthTab('login'));
  tabRegister.addEventListener('click', () => switchAuthTab('register'));

  btnAuth.addEventListener('click', async () => {
    const email = authEmail.value.trim();
    const password = authPassword.value;
    authError.textContent = '';
    if (!email || !password) { authError.textContent = '请填写邮箱和密码'; return; }

    btnAuth.disabled = true;
    const type = authMode === 'login' ? 'LOGIN' : 'REGISTER';
    const res = await sendMsg(type, { email, password });
    btnAuth.disabled = false;

    if (!res || !res.ok) {
      authError.textContent = (res && res.error) || '请求失败，请检查网络';
      return;
    }
    renderUserInfo(res.email, res.isPro);
    showToast(authMode === 'login' ? '登录成功' : '注册成功');
  });

  btnLogout.addEventListener('click', async () => {
    await sendMsg('LOGOUT', {});
    authForm.style.display = '';
    userInfo.style.display = 'none';
    authEmail.value = '';
    authPassword.value = '';
    // 刷新主面板限额 banner
    const { isPro } = await sendMsg('GET_AUTH_STATE', {});
    updateLimitBanner(allItems.length, isPro);
  });

  function renderUserInfo(email, isPro) {
    authForm.style.display = 'none';
    userInfo.style.display = '';
    userEmail.textContent = email;
    if (isPro) {
      userBadge.textContent = '会员';
      userBadge.className = 'user-badge user-badge--pro';
      upgradeSection.style.display = 'none';
    } else {
      userBadge.textContent = '免费版';
      userBadge.className = 'user-badge user-badge--free';
      upgradeSection.style.display = '';
    }
    updateLimitBanner(allItems.length, isPro);
  }

  // 升级按钮（暂时展示提示，后续接支付）
  document.getElementById('btnUpgradeSettings').addEventListener('click', () => {
    showToast('支付功能即将上线，敬请期待');
  });

  // ── 设置面板加载 ──────────────────────────────────────────

  async function loadSettings() {
    // 账号状态
    const state = await sendMsg('REFRESH_PRO', {});
    if (state && state.email) {
      renderUserInfo(state.email, state.isPro);
    } else {
      authForm.style.display = '';
      userInfo.style.display = 'none';
    }
    // 网站白名单
    await loadSiteFilter();
  }

  // ── 网站白名单 ────────────────────────────────────────────

  async function loadSiteFilter() {
    const { mode, allowlist } = await sendMsg('GET_SITE_FILTER', {});
    modeAllEl.checked = mode === 'all';
    modeAllowlistEl.checked = mode === 'allowlist';
    allowlistSection.style.display = mode === 'allowlist' ? '' : 'none';
    renderSiteList(allowlist);
  }

  function renderSiteList(list) {
    siteListWrap.querySelectorAll('.site-item').forEach(el => el.remove());
    siteEmptyTip.style.display = list.length ? 'none' : 'block';
    list.forEach(domain => {
      const row = document.createElement('div');
      row.className = 'site-item record-item';

      const text = document.createElement('span');
      text.className = 'record-text';
      text.textContent = domain;
      text.title = domain;

      const delBtn = document.createElement('button');
      delBtn.className = 'btn-del';
      delBtn.style.opacity = '1';
      delBtn.textContent = '×';
      delBtn.title = '移除';
      delBtn.addEventListener('click', async () => {
        await sendMsg('REMOVE_ALLOWLIST_DOMAIN', { domain });
        await loadSiteFilter();
      });

      row.appendChild(text);
      row.appendChild(delBtn);
      siteListWrap.appendChild(row);
    });
  }

  modeAllEl.addEventListener('change', async () => {
    if (modeAllEl.checked) {
      await sendMsg('SET_SITE_FILTER_MODE', { mode: 'all' });
      allowlistSection.style.display = 'none';
    }
  });

  modeAllowlistEl.addEventListener('change', async () => {
    if (modeAllowlistEl.checked) {
      await sendMsg('SET_SITE_FILTER_MODE', { mode: 'allowlist' });
      allowlistSection.style.display = '';
    }
  });

  async function addDomain(raw) {
    if (!raw) return;
    const res = await sendMsg('ADD_ALLOWLIST_DOMAIN', { domain: raw });
    if (res && res.ok === false) {
      showToast('域名格式有误');
      return;
    }
    siteInput.value = '';
    await loadSiteFilter();
  }

  btnAddSite.addEventListener('click', () => addDomain(siteInput.value.trim()));
  siteInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') addDomain(siteInput.value.trim());
  });

  btnAddCurrent.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) { showToast('无法获取当前网站'); return; }
    try {
      const hostname = new URL(tab.url).hostname.replace(/^www\./, '');
      await sendMsg('ADD_ALLOWLIST_DOMAIN', { domain: hostname });
      await loadSiteFilter();
      showToast(`已添加 ${hostname}`);
    } catch {
      showToast('无法解析当前网站');
    }
  });

  // ── Toast ─────────────────────────────────────────────────

  function showToast(msg) {
    let toast = document.querySelector('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 1800);
  }

  // ── 初始化 ────────────────────────────────────────────────

  async function reload() {
    const res = await sendMsg('GET_HISTORY', { query: '' });
    allItems = res.list || [];
    const state = await sendMsg('GET_AUTH_STATE', {});
    updateLimitBanner(allItems.length, state.isPro);
    renderList(getFiltered());
  }

  await reload();
  searchInput.focus();

  // ── 历史面板事件 ──────────────────────────────────────────

  searchInput.addEventListener('input', () => renderList(getFiltered()));

  btnSaveInput.addEventListener('click', async () => {
    const val = searchInput.value.trim();
    if (!val || val.length < 2) { showToast('内容至少 2 个字符'); return; }
    const res = await sendMsg('SAVE_HISTORY', { text: val });
    if (res && res.reason === 'limit_reached') {
      showToast('已达免费上限，请升级会员');
      return;
    }
    searchInput.value = '';
    showToast('已保存');
    await reload();
  });

  searchInput.addEventListener('keydown', async e => {
    if (e.key === 'Enter') {
      const val = searchInput.value.trim();
      if (val.length >= 2) {
        const res = await sendMsg('SAVE_HISTORY', { text: val });
        if (res && res.reason === 'limit_reached') {
          showToast('已达免费上限，请升级会员');
          return;
        }
        searchInput.value = '';
        showToast('已保存');
        await reload();
      }
    }
  });

  btnClear.addEventListener('click', async () => {
    if (!allItems.length) return;
    if (!confirm('确定要清空所有历史记录吗？')) return;
    await sendMsg('CLEAR_ALL', {});
    allItems = [];
    renderList([]);
    updateLimitBanner(0, (await sendMsg('GET_AUTH_STATE', {})).isPro);
  });
})();
