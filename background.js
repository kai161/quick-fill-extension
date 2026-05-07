// background.js - Service Worker: 存储管理与消息路由

const STORAGE_KEY = 'qf_history';
const MAX_RECORDS = 200;       // 存储硬上限（性能保护）
const FREE_LIMIT = 10;         // 免费用户可保存条数
const MIN_LENGTH = 3;
const API_BASE = 'https://your-server.com'; // 部署后替换为实际地址

// 计算记录分数，用于排序（高频 + 近期使用优先）
function calcScore(item) {
  const now = Date.now();
  const daysSince = (now - item.lastUsed) / (1000 * 60 * 60 * 24);
  const recencyBonus = daysSince <= 7 ? (7 - daysSince) / 7 : 0;
  return item.count * 0.7 + recencyBonus * 10 * 0.3;
}

async function getHistory() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || [];
}

async function saveHistory(text) {
  if (!text || text.trim().length < MIN_LENGTH) return { ok: false, reason: 'too_short' };
  const trimmed = text.trim();

  const history = await getHistory();

  // 已存在的记录直接更新，不受条数限制
  const existing = history.find(item => item.text === trimmed);
  if (existing) {
    existing.count += 1;
    existing.lastUsed = Date.now();
    history.sort((a, b) => calcScore(b) - calcScore(a));
    await chrome.storage.local.set({ [STORAGE_KEY]: history.slice(0, MAX_RECORDS) });
    return { ok: true };
  }

  // 新记录：检查免费限额
  const { isPro } = await getAuthState();
  if (!isPro && history.length >= FREE_LIMIT) {
    return { ok: false, reason: 'limit_reached' };
  }

  history.push({ text: trimmed, count: 1, lastUsed: Date.now() });
  history.sort((a, b) => calcScore(b) - calcScore(a));
  await chrome.storage.local.set({ [STORAGE_KEY]: history.slice(0, MAX_RECORDS) });
  return { ok: true };
}

async function queryHistory(query) {
  const history = await getHistory();
  if (!query) return history;
  const lower = query.toLowerCase();
  return history.filter(item => item.text.toLowerCase().includes(lower));
}

async function deleteRecord(text) {
  const history = await getHistory();
  const updated = history.filter(item => item.text !== text);
  await chrome.storage.local.set({ [STORAGE_KEY]: updated });
}

async function clearAll() {
  await chrome.storage.local.set({ [STORAGE_KEY]: [] });
}

// ── 账号 & 会员状态 ────────────────────────────────────────

async function getAuthState() {
  const result = await chrome.storage.local.get(['qf_token', 'qf_email', 'qf_is_pro']);
  return {
    token: result['qf_token'] || null,
    email: result['qf_email'] || null,
    isPro: result['qf_is_pro'] || false,
  };
}

async function saveAuthState(token, email, isPro) {
  await chrome.storage.local.set({ qf_token: token, qf_email: email, qf_is_pro: isPro });
}

async function clearAuthState() {
  await chrome.storage.local.remove(['qf_token', 'qf_email', 'qf_is_pro']);
}

async function apiPost(path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '请求失败');
  return data;
}

async function apiGet(path, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '请求失败');
  return data;
}

async function login(email, password) {
  const data = await apiPost('/api/login', { email, password });
  await saveAuthState(data.token, data.email, data.is_pro);
  return { email: data.email, isPro: data.is_pro };
}

async function register(email, password) {
  const data = await apiPost('/api/register', { email, password });
  await saveAuthState(data.token, data.email, data.is_pro);
  return { email: data.email, isPro: data.is_pro };
}

async function logout() {
  await clearAuthState();
}

// 向服务器刷新会员状态（用于 popup 打开时同步）
async function refreshProStatus() {
  const { token, email } = await getAuthState();
  if (!token) return;
  try {
    const data = await apiGet('/api/me', token);
    await saveAuthState(token, email, data.is_pro);
  } catch {
    // token 失效时静默清除
    await clearAuthState();
  }
}

async function getMode() {
  const result = await chrome.storage.local.get('qf_mode');
  return result['qf_mode'] || 'auto';
}

async function setMode(mode) {
  await chrome.storage.local.set({ qf_mode: mode });
}

// 白名单：存储允许激活的域名列表
// filterMode: 'all'（全部网站）或 'allowlist'（仅白名单）
async function getSiteFilter() {
  const result = await chrome.storage.local.get(['qf_filter_mode', 'qf_allowlist']);
  return {
    mode: result['qf_filter_mode'] || 'all',
    allowlist: result['qf_allowlist'] || [],
  };
}

async function setSiteFilterMode(mode) {
  await chrome.storage.local.set({ qf_filter_mode: mode });
}

async function addAllowlistDomain(domain) {
  const normalized = normalizeDomain(domain);
  if (!normalized) return false;
  const { allowlist } = await getSiteFilter();
  if (!allowlist.includes(normalized)) {
    allowlist.push(normalized);
    await chrome.storage.local.set({ qf_allowlist: allowlist });
  }
  return true;
}

async function removeAllowlistDomain(domain) {
  const { allowlist } = await getSiteFilter();
  const updated = allowlist.filter(d => d !== domain);
  await chrome.storage.local.set({ qf_allowlist: updated });
}

function normalizeDomain(input) {
  try {
    const s = input.trim().toLowerCase();
    // 若用户输入了完整 URL，提取 hostname
    const withProto = s.startsWith('http') ? s : `https://${s}`;
    const url = new URL(withProto);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

async function isSiteAllowed(hostname) {
  const { mode, allowlist } = await getSiteFilter();
  if (mode === 'all') return true;
  const normalized = hostname.replace(/^www\./, '');
  return allowlist.some(d => normalized === d || normalized.endsWith(`.${d}`));
}

// 动态注入 content scripts
async function injectIfAllowed(tabId, url) {
  let hostname;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return;
  }
  // 只处理 http/https 页面
  if (!url.startsWith('http')) return;

  const allowed = await isSiteAllowed(hostname);
  if (!allowed) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ['content-main.js'],
      world: 'MAIN',
    });
    await chrome.scripting.insertCSS({
      target: { tabId, allFrames: true },
      files: ['content.css'],
    });
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ['content.js'],
    });
  } catch {
    // 无权限的页面（如 chrome:// 页面）静默忽略
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    injectIfAllowed(tabId, tab.url);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'SAVE_HISTORY':
      saveHistory(message.text).then(result => sendResponse(result));
      return true;

    case 'GET_HISTORY':
      queryHistory(message.query || '').then(list => sendResponse({ list }));
      return true;

    case 'DELETE_RECORD':
      deleteRecord(message.text).then(() => sendResponse({ ok: true }));
      return true;

    case 'CLEAR_ALL':
      clearAll().then(() => sendResponse({ ok: true }));
      return true;

    case 'GET_MODE':
      getMode().then(mode => sendResponse({ mode }));
      return true;

    case 'SET_MODE':
      setMode(message.mode).then(() => sendResponse({ ok: true }));
      return true;

    case 'GET_SITE_FILTER':
      getSiteFilter().then(data => sendResponse(data));
      return true;

    case 'SET_SITE_FILTER_MODE':
      setSiteFilterMode(message.mode).then(() => sendResponse({ ok: true }));
      return true;

    case 'ADD_ALLOWLIST_DOMAIN':
      addAllowlistDomain(message.domain).then(ok => sendResponse({ ok }));
      return true;

    case 'REMOVE_ALLOWLIST_DOMAIN':
      removeAllowlistDomain(message.domain).then(() => sendResponse({ ok: true }));
      return true;

    case 'IS_SITE_ALLOWED':
      isSiteAllowed(message.hostname).then(allowed => sendResponse({ allowed }));
      return true;

    case 'GET_AUTH_STATE':
      getAuthState().then(state => sendResponse(state));
      return true;

    case 'LOGIN':
      login(message.email, message.password)
        .then(data => sendResponse({ ok: true, ...data }))
        .catch(err => sendResponse({ ok: false, error: err.message }));
      return true;

    case 'REGISTER':
      register(message.email, message.password)
        .then(data => sendResponse({ ok: true, ...data }))
        .catch(err => sendResponse({ ok: false, error: err.message }));
      return true;

    case 'LOGOUT':
      logout().then(() => sendResponse({ ok: true }));
      return true;

    case 'REFRESH_PRO':
      refreshProStatus().then(() => getAuthState()).then(state => sendResponse(state));
      return true;
  }
});
