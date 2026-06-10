// popup.js

// ── i18n ──────────────────────────────────────────────────────

const isCN = navigator.language.startsWith('zh');

const i18n = {
  // buttons & labels
  clear:              isCN ? '清空'              : 'Clear',
  save:               isCN ? '保存'              : 'Save',
  settings:           isCN ? '设置'              : 'Settings',
  back:               isCN ? '返回'              : 'Back',
  login:              isCN ? '登录'              : 'Sign in',
  register:           isCN ? '注册'              : 'Sign up',
  logout:             isCN ? '退出'              : 'Sign out',
  add:                isCN ? '添加'              : 'Add',
  addCurrentSite:     isCN ? '+ 添加当前网站'    : '+ Add current site',
  upgradeBanner:      isCN ? '升级会员'          : 'Upgrade',
  upgradeBtn:         isCN ? '立即升级会员'       : 'Upgrade to Pro',
  delete:             isCN ? '删除'              : 'Delete',
  remove:             isCN ? '移除'              : 'Remove',
  planTitle:          isCN ? '选择订阅计划'       : 'Choose Plan',
  planMonthly:        isCN ? '月付 $1.99/月'     : 'Monthly $1.99/mo',
  planYearly:         isCN ? '年付 $14.99/年'    : 'Yearly $14.99/yr',
  planYearlyBadge:    isCN ? '省38%'             : 'Save 38%',
  cancel:             isCN ? '取消'              : 'Cancel',
  resize:             isCN ? '拖拽调整大小'       : 'Drag to resize',

  // placeholders
  searchPlaceholder:  isCN ? '搜索或输入新内容…'  : 'Search or type new content…',
  emailPlaceholder:   isCN ? '邮箱'              : 'Email',
  passwordPlaceholder:isCN ? '密码（至少 6 位）'  : 'Password (min 6 chars)',
  domainPlaceholder:  isCN ? '输入域名，如 example.com' : 'Domain, e.g. example.com',

  // tips & messages
  emptyTip:           isCN ? '暂无记录，选中任意文字即可保存' : 'No records yet. Select any text to save.',
  shortcutTip:        isCN ? '在输入框内按 {key} 快速调出'   : 'Press {key} inside any input to open',
  countTip:           isCN ? '共 {n} 条'         : '{n} records',
  labelAccount:       isCN ? '账号'              : 'Account',
  labelSites:         isCN ? '生效网站'           : 'Active Sites',
  labelModeAll:       isCN ? '全部网站'           : 'All websites',
  labelModeAllowlist: isCN ? '仅限指定网站'       : 'Selected websites only',
  siteEmptyTip:       isCN ? '尚未添加任何网站'   : 'No sites added yet.',
  badgeProLabel:      isCN ? '会员'              : 'Pro',
  badgeFreeLabel:     isCN ? '免费版'             : 'Free',
  upgradeHint:        isCN ? '免费版最多保存 <strong>10 条</strong>记录，升级会员后无限保存。'
                           : 'Free plan saves up to <strong>10</strong> records. Upgrade for unlimited.',
  upgradeComingSoon:  isCN ? '支付功能即将上线，敬请期待' : 'Payment coming soon, stay tuned!',

  // toasts
  filled:             isCN ? '已填充'             : 'Filled',
  clickInputFirst:    isCN ? '请先点击目标输入框'  : 'Click a target input first',
  saved:              isCN ? '已保存'             : 'Saved',
  minLength:          isCN ? '内容至少 2 个字符'   : 'At least 2 characters',
  clearConfirm:       isCN ? '确定要清空所有历史记录吗？' : 'Clear all history records?',
  loginSuccess:       isCN ? '登录成功'           : 'Signed in',
  registerSuccess:    isCN ? '注册成功'           : 'Account created',
  fillEmail:          isCN ? '请填写邮箱和密码'    : 'Please enter email and password',
  networkError:       isCN ? '请求失败，请检查网络' : 'Request failed, check your network',
  loginRequired:      isCN ? '请先登录后再升级'    : 'Please sign in before upgrading',
  checkoutLoading:    isCN ? '正在打开支付页面…'   : 'Opening checkout…',
  limitFull:          isCN ? '已达免费上限，请升级会员' : 'Free limit reached, please upgrade',
  limitRemaining:     isCN ? '免费版剩余 {n} 条额度' : 'Free plan: {n} records remaining',
  limitReached:       isCN ? '已达免费上限（10 条），升级后无限保存' : 'Free limit reached (10 records). Upgrade for unlimited.',
  domainInvalid:      isCN ? '域名格式有误'        : 'Invalid domain format',
  domainAdded:        isCN ? '已添加 {domain}'    : 'Added {domain}',
  cannotGetSite:      isCN ? '无法获取当前网站'    : 'Cannot get current site',
  cannotParseSite:    isCN ? '无法解析当前网站'    : 'Cannot parse current site',
};

function t(key, vars = {}) {
  let s = i18n[key] || key;
  for (const [k, v] of Object.entries(vars)) {
    s = s.replace(`{${k}}`, v);
  }
  return s;
}

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
  const resizeHandle  = document.getElementById('resizeHandle');

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
  const SIZE_KEY = 'qf_popup_size';
  const POPUP_SIZE = {
    minWidth: 320,
    minHeight: 320,
    maxWidth: 780,
    maxHeight: 600,
  };

  function sendMsg(type, data) {
    return new Promise(resolve => chrome.runtime.sendMessage({ type, ...data }, resolve));
  }

  // ── 弹窗尺寸调整 ──────────────────────────────────────────

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function applyPopupSize(size) {
    const width = clamp(size.width, POPUP_SIZE.minWidth, POPUP_SIZE.maxWidth);
    const height = clamp(size.height, POPUP_SIZE.minHeight, POPUP_SIZE.maxHeight);
    document.body.style.setProperty('--popup-width', `${width}px`);
    document.body.style.setProperty('--popup-height', `${height}px`);
  }

  function loadPopupSize() {
    try {
      const raw = localStorage.getItem(SIZE_KEY);
      if (!raw) return;
      const size = JSON.parse(raw);
      if (Number.isFinite(size.width) && Number.isFinite(size.height)) {
        applyPopupSize(size);
      }
    } catch {
      localStorage.removeItem(SIZE_KEY);
    }
  }

  function savePopupSize(size) {
    localStorage.setItem(SIZE_KEY, JSON.stringify(size));
  }

  loadPopupSize();

  resizeHandle.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = document.body.offsetWidth;
    const startHeight = document.body.offsetHeight;
    document.body.classList.add('is-resizing');

    function onMouseMove(moveEvent) {
      const width = clamp(startWidth + moveEvent.clientX - startX, POPUP_SIZE.minWidth, POPUP_SIZE.maxWidth);
      const height = clamp(startHeight + moveEvent.clientY - startY, POPUP_SIZE.minHeight, POPUP_SIZE.maxHeight);
      applyPopupSize({ width, height });
    }

    function onMouseUp() {
      document.body.classList.remove('is-resizing');
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      savePopupSize({
        width: document.body.offsetWidth,
        height: document.body.offsetHeight,
      });
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });

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
      limitBannerText.textContent = t('limitReached');
      limitBanner.style.display = 'flex';
      limitBanner.classList.add('limit-banner--full');
    } else if (remaining <= 3) {
      limitBannerText.textContent = t('limitRemaining', { n: remaining });
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
    countTip.textContent = t('countTip', { n: items.length });

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
          showToast(res && res.ok ? t('filled') : t('clickInputFirst'));
        } catch {
          showToast(t('clickInputFirst'));
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
    btnAuth.textContent = mode === 'login' ? t('login') : t('register');
    authError.textContent = '';
  }

  tabLogin.addEventListener('click', () => switchAuthTab('login'));
  tabRegister.addEventListener('click', () => switchAuthTab('register'));

  btnAuth.addEventListener('click', async () => {
    const email = authEmail.value.trim();
    const password = authPassword.value;
    authError.textContent = '';
    if (!email || !password) { authError.textContent = t('fillEmail'); return; }

    btnAuth.disabled = true;
    const type = authMode === 'login' ? 'LOGIN' : 'REGISTER';
    const res = await sendMsg(type, { email, password });
    btnAuth.disabled = false;

    if (!res || !res.ok) {
      authError.textContent = (res && res.error) || t('networkError');
      return;
    }
    renderUserInfo(res.email, res.isPro);
    showToast(authMode === 'login' ? t('loginSuccess') : t('registerSuccess'));
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
      userBadge.textContent = t('badgeProLabel');
      userBadge.className = 'user-badge user-badge--pro';
      upgradeSection.style.display = 'none';
    } else {
      userBadge.textContent = t('badgeFreeLabel');
      userBadge.className = 'user-badge user-badge--free';
      upgradeSection.style.display = '';
    }
    updateLimitBanner(allItems.length, isPro);
  }

  const btnUpgradeSettings = document.getElementById('btnUpgradeSettings');

  btnUpgradeSettings.addEventListener('click', async () => {
    const state = await sendMsg('GET_AUTH_STATE', {});
    if (!state || !state.token) {
      showToast(t('loginRequired'));
      authForm.style.display = '';
      userInfo.style.display = 'none';
      return;
    }

    const plan = await askPlan();
    if (!plan) return;

    btnUpgradeSettings.disabled = true;
    showToast(t('checkoutLoading'));
    const res = await sendMsg('CHECKOUT', { plan });
    btnUpgradeSettings.disabled = false;
    if (!res || !res.ok) {
      showToast(res?.error || t('networkError'));
      return;
    }
    chrome.tabs.create({ url: res.url });
  });

  async function askPlan() {
    return new Promise(resolve => {
      let isResolved = false;
      const overlay = document.createElement('div');
      overlay.className = 'plan-modal';

      const dialog = document.createElement('div');
      dialog.className = 'plan-dialog';

      const title = document.createElement('div');
      title.className = 'plan-title';
      title.textContent = t('planTitle');

      const monthly = document.createElement('button');
      monthly.className = 'plan-option';
      monthly.type = 'button';
      monthly.textContent = t('planMonthly');

      const yearly = document.createElement('button');
      yearly.className = 'plan-option plan-option--primary';
      yearly.type = 'button';
      yearly.textContent = t('planYearly');

      const yearlyBadge = document.createElement('span');
      yearlyBadge.className = 'plan-badge';
      yearlyBadge.textContent = t('planYearlyBadge');
      yearly.appendChild(yearlyBadge);

      const cancel = document.createElement('button');
      cancel.className = 'plan-cancel';
      cancel.type = 'button';
      cancel.textContent = t('cancel');

      function close(plan) {
        if (isResolved) return;
        isResolved = true;
        document.removeEventListener('keydown', onKeydown);
        overlay.remove();
        resolve(plan);
      }

      function onKeydown(e) {
        if (e.key === 'Escape') close(null);
      }

      yearly.addEventListener('click', () => close('yearly'));
      monthly.addEventListener('click', () => close('monthly'));
      cancel.addEventListener('click', () => close(null));
      overlay.addEventListener('click', e => {
        if (e.target === overlay) close(null);
      });
      document.addEventListener('keydown', onKeydown);

      dialog.appendChild(title);
      dialog.appendChild(yearly);
      dialog.appendChild(monthly);
      dialog.appendChild(cancel);
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);
    });
  }

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
      delBtn.title = t('remove');
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
      showToast(t('domainInvalid'));
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
    if (!tab || !tab.url) { showToast(t('cannotGetSite')); return; }
    try {
      const hostname = new URL(tab.url).hostname.replace(/^www\./, '');
      await sendMsg('ADD_ALLOWLIST_DOMAIN', { domain: hostname });
      await loadSiteFilter();
      showToast(t('domainAdded', { domain: hostname }));
    } catch {
      showToast(t('cannotParseSite'));
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

  // ── 填充静态文案 ──────────────────────────────────────────
  btnClear.textContent                                  = t('clear');
  btnSaveInput.textContent                              = t('save');
  btnSettings.title                                     = t('settings');
  btnBack.title                                         = t('back');
  btnUpgradeMain.textContent                            = t('upgradeBanner');
  resizeHandle.title                                    = t('resize');
  searchInput.placeholder                               = t('searchPlaceholder');
  document.getElementById('emptyTip').textContent       = t('emptyTip');
  document.getElementById('shortcutTip').innerHTML      = t('shortcutTip', { key: '<kbd>Ctrl</kbd>+<kbd>M</kbd>' });
  document.getElementById('settingsTitle').textContent  = t('settings');
  document.getElementById('labelAccount').textContent   = t('labelAccount');
  document.getElementById('labelSites').textContent     = t('labelSites');
  document.getElementById('labelModeAll').textContent   = t('labelModeAll');
  document.getElementById('labelModeAllowlist').textContent = t('labelModeAllowlist');
  document.getElementById('siteEmptyTip').textContent   = t('siteEmptyTip');
  document.getElementById('upgradeHint').innerHTML      = t('upgradeHint');
  document.getElementById('btnUpgradeSettings').textContent = t('upgradeBtn');
  tabLogin.textContent                                  = t('login');
  tabRegister.textContent                               = t('register');
  btnAuth.textContent                                   = t('login');
  btnLogout.textContent                                 = t('logout');
  btnAddSite.textContent                                = t('add');
  btnAddCurrent.textContent                             = t('addCurrentSite');
  authEmail.placeholder                                 = t('emailPlaceholder');
  authPassword.placeholder                              = t('passwordPlaceholder');
  siteInput.placeholder                                 = t('domainPlaceholder');

  searchInput.focus();

  // ── 历史面板事件 ──────────────────────────────────────────

  searchInput.addEventListener('input', () => renderList(getFiltered()));

  btnSaveInput.addEventListener('click', async () => {
    const val = searchInput.value.trim();
    if (!val || val.length < 2) { showToast(t('minLength')); return; }
    const res = await sendMsg('SAVE_HISTORY', { text: val });
    if (res && res.reason === 'limit_reached') {
      showToast(t('limitFull'));
      return;
    }
    searchInput.value = '';
    showToast(t('saved'));
    await reload();
  });

  searchInput.addEventListener('keydown', async e => {
    if (e.key === 'Enter') {
      const val = searchInput.value.trim();
      if (val.length >= 2) {
        const res = await sendMsg('SAVE_HISTORY', { text: val });
        if (res && res.reason === 'limit_reached') {
          showToast(t('limitFull'));
          return;
        }
        searchInput.value = '';
        showToast(t('saved'));
        await reload();
      }
    }
  });

  btnClear.addEventListener('click', async () => {
    if (!allItems.length) return;
    if (!confirm(t('clearConfirm'))) return;
    await sendMsg('CLEAR_ALL', {});
    allItems = [];
    renderList([]);
    updateLimitBanner(0, (await sendMsg('GET_AUTH_STATE', {})).isPro);
  });
})();
