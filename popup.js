const $ = (id) => document.getElementById(id);

const statusCard = $("statusCard");
const statusValue = $("statusValue");
const statusProxy = $("statusProxy");
const msgToast = $("msgToast");
const msgIcon = $("msgIcon");
const msgText = $("msgText");
const proxyListEl = $("proxyList");
const proxyCountEl = $("proxyCount");
const btnApply = $("btnApply");
const txtAdd = $("txtAddProxy");
const txtWhitelist = $("txtWhitelist");
const chkWhitelist = $("chkWhitelist");
const chkWebRTC = $("chkWebRTC");
const chkSpoofing = $("chkSpoofing");
const chkGps = $("chkGps");
const chkAlt = $("chkAlt");
const btnImportRule = $("btnImportRule");
const ipSpinner = $("ipSpinner");
const netContent = $("netContent");
const ipValueEl = $("ipValue");
const netFlag = $("netFlag");
const ipCountry = $("ipCountry");
const netPing = $("netPing");
const pingValue = $("pingValue");

/* ── State ── */
let proxyList = []; // ['1.2.3.4:8080:user:pass', ...]
let selectedIdx = -1; // index đang chọn
let activeProxy = ""; // proxy đang chạy
let isEnabled = false;

/* ── SVG Templates ── */
const ICON = {
  check:
    '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>',
  error:
    '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>',
  del: '<path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>',
};

/* ── Helpers ── */
function maskProxy(raw) {
  const parts = raw.split(":");
  if (parts.length >= 2) {
    return parts[0] + ":" + parts[1];
  }
  return raw;
}

function hasAuth(raw) {
  return raw.split(":").length >= 4;
}

/* ── Chrome messaging ── */
async function send(msg) {
  return await chrome.runtime.sendMessage(msg);
}

/* ── Fetch current public IP & Realtime Ping ── */
let pingInterval = null;
let ipInterval = null;
let lastIp = null;

async function checkPing() {
  const start = performance.now();
  try {
    await fetch("https://www.gstatic.com/generate_204", {
      cache: "no-store",
      mode: "no-cors",
    });
    const pingMs = Math.round(performance.now() - start);

    pingValue.textContent = pingMs + " ms";
    if (pingMs < 150) netPing.className = "net-ping ping-good";
    else if (pingMs < 400) netPing.className = "net-ping ping-fair";
    else netPing.className = "net-ping ping-poor";
    netPing.style.display = "flex";
  } catch {
    pingValue.textContent = "Err";
    netPing.className = "net-ping ping-poor";
    netPing.style.display = "flex";
  }
}

async function fetchCurrentIP() {
  if (!lastIp) {
    ipSpinner.style.display = "block";
    netContent.style.display = "none";
    netPing.style.display = "none";
  }

  try {
    const res = await fetch("https://get.geojs.io/v1/ip/geo.json", {
      cache: "no-store",
    });
    const data = await res.json();

    if (data.ip !== lastIp) {
      lastIp = data.ip;
      ipValueEl.textContent = data.ip || "—";
      ipValueEl.className = "ip-value";

      if (data.country_code) {
        netFlag.src = `https://flagcdn.com/w40/${data.country_code.toLowerCase()}.png`;
        netFlag.style.display = "block";
      } else {
        netFlag.style.display = "none";
      }
      ipCountry.textContent = data.country || "Unknown Location";
    }
  } catch {
    lastIp = null;
    ipValueEl.textContent = "Mất kết nối...";
    ipValueEl.className = "ip-value error";
    ipCountry.textContent = "";
    netFlag.style.display = "none";
  }

  ipSpinner.style.display = "none";
  netContent.style.display = "flex";
}

function startNetworkMonitor() {
  if (pingInterval) clearInterval(pingInterval);
  if (ipInterval) clearInterval(ipInterval);

  lastIp = null;

  checkPing();
  pingInterval = setInterval(checkPing, 1000);

  fetchCurrentIP();
  ipInterval = setInterval(fetchCurrentIP, 5000);
}

/* ── Storage: proxy list ── */
async function saveList() {
  await chrome.storage.local.set({ proxyList, selectedIdx });
}

async function loadList() {
  const d = await chrome.storage.local.get({ proxyList: [], selectedIdx: -1 });
  proxyList = d.proxyList || [];
  selectedIdx = d.selectedIdx;
  if (selectedIdx >= proxyList.length) selectedIdx = -1;
}

/* ── Render proxy list ── */
function renderList() {
  proxyCountEl.textContent = proxyList.length;

  if (proxyList.length === 0) {
    proxyListEl.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
        <p>Chưa có proxy nào</p>
      </div>`;
    return;
  }

  proxyListEl.innerHTML = proxyList
    .map((p, i) => {
      const isSel = i === selectedIdx;
      const isLive = isSel && isEnabled && activeProxy === p;
      const cls = `proxy-item${isSel ? " selected" : ""}${isLive ? " running" : ""}`;

      return `
      <div class="${cls}" data-idx="${i}">
        <div class="proxy-radio"></div>
        <span class="proxy-addr">${maskProxy(p)}</span>
        ${hasAuth(p) ? '<span class="proxy-badge auth">AUTH</span>' : ""}
        ${isLive ? '<span class="proxy-badge live">LIVE</span>' : ""}
        <button class="btn-del" data-del="${i}" title="Xóa">
          <svg viewBox="0 0 24 24">${ICON.del}</svg>
        </button>
      </div>`;
    })
    .join("");

  updateButtons();
}

/* ── Button states ── */
function updateButtons() {
  const btnDisable = $("btnDisable");
  if (!btnDisable) return;

  if (isEnabled && activeProxy) {
    if (selectedIdx >= 0 && proxyList[selectedIdx] !== activeProxy) {
      btnApply.disabled = false;
      btnApply.classList.remove("dimmed");
      btnDisable.disabled = false;
      btnDisable.classList.remove("dimmed");
    } else {
      btnApply.disabled = true;
      btnApply.classList.add("dimmed");
      btnDisable.disabled = false;
      btnDisable.classList.remove("dimmed");
    }
  } else {
    btnApply.disabled = selectedIdx < 0;
    if (selectedIdx < 0) btnApply.classList.add("dimmed");
    else btnApply.classList.remove("dimmed");

    btnDisable.disabled = true;
    btnDisable.classList.add("dimmed");
  }
}

/* ── Status display ── */
function setProxyStatus(enabled, proxy) {
  isEnabled = enabled;
  activeProxy = proxy || "";

  statusCard.className = "status-card " + (enabled ? "active" : "inactive");
  statusValue.textContent = enabled
    ? "Proxy đang hoạt động"
    : "Kết nối trực tiếp";

  if (enabled && proxy) {
    statusProxy.textContent = maskProxy(proxy);
    statusProxy.style.display = "block";
  } else {
    statusProxy.style.display = "none";
  }

  // Khóa UI Whitelist không cho can thiệp khi đang bật
  txtWhitelist.readOnly = enabled;
  txtWhitelist.style.cursor = enabled ? "not-allowed" : "text";

  renderList(); // cập nhật badge LIVE
}

/* ── Toast ── */
let toastTimer = null;

function showToast(text, ok) {
  clearTimeout(toastTimer);
  msgToast.className = "message-toast " + (ok ? "success" : "error");
  msgIcon.innerHTML = ok ? ICON.check : ICON.error;
  msgText.textContent = text;

  requestAnimationFrame(() => msgToast.classList.add("visible"));

  toastTimer = setTimeout(() => {
    msgToast.classList.remove("visible");
  }, 3500);
}

/* ── Validate proxy format ── */
function validateProxy(val) {
  if (!val) return false;
  // Chặn sớm rủi ro Self-XSS / phá vỡ giao diện do inject thẻ HTML
  if (val.includes("<") || val.includes(">")) return false;
  const parts = val.split(":");
  return parts.length >= 2 && parts[0] && !isNaN(parseInt(parts[1], 10));
}

/* ── Add single proxy ── */
function addProxy() {
  const val = txtAdd.value.trim();
  if (!val) {
    showToast("Nhập proxy trước", false);
    return;
  }

  if (!validateProxy(val)) {
    showToast("Sai format. Dùng ip:port hoặc ip:port:user:pass", false);
    return;
  }

  if (proxyList.includes(val)) {
    showToast("Proxy đã có trong danh sách", false);
    return;
  }

  proxyList.push(val);
  selectedIdx = proxyList.length - 1;
  txtAdd.value = "";
  saveList();
  renderList();
  showToast("Đã thêm proxy ✓", true);
}

/* ── Add multiple proxies (from paste) ── */
function addMultipleProxies(text) {
  // Split by newline, semicolon, or comma — covers all common list formats
  const lines = text
    .split(/[\n\r;,]+/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length <= 1) return false; // not a multi-line paste, let addProxy handle

  let added = 0,
    skipped = 0,
    duped = 0;

  for (const line of lines) {
    if (!validateProxy(line)) {
      skipped++;
      continue;
    }
    if (proxyList.includes(line)) {
      duped++;
      continue;
    }
    proxyList.push(line);
    added++;
  }

  if (added > 0) {
    selectedIdx = proxyList.length - 1;
    saveList();
    renderList();
  }

  // Build summary message
  const msgs = [];
  if (added) msgs.push(`+${added} proxy`);
  if (duped) msgs.push(`${duped} trùng`);
  if (skipped) msgs.push(`${skipped} lỗi format`);

  showToast(msgs.join(" · "), added > 0);
  txtAdd.value = "";
  return true;
}

/* ── Events ── */
$("btnAdd").addEventListener("click", addProxy);

txtAdd.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addProxy();
});

chkWhitelist.addEventListener("click", (e) => {
  if (isEnabled) {
    e.preventDefault();
    showToast("Bạn phải tắt proxy để sửa", false);
    return;
  }
  txtWhitelist.disabled = !chkWhitelist.checked;
  btnImportRule.disabled = !chkWhitelist.checked;
  btnImportRule.style.opacity = chkWhitelist.checked ? "1" : "0.3";
});

chkWebRTC.addEventListener("click", (e) => {
  if (isEnabled) {
    e.preventDefault();
    showToast("Bạn phải tắt proxy để cấu hình", false);
  }
});

chkSpoofing.addEventListener("click", (e) => {
  if (isEnabled) {
    e.preventDefault();
    showToast("Bạn phải tắt proxy để cấu hình", false);
  }
});

chkGps.addEventListener("click", (e) => {
  if (isEnabled) {
    e.preventDefault();
    showToast("Bạn phải tắt proxy để cấu hình", false);
  }
});

chkAlt.addEventListener("click", (e) => {
  if (isEnabled) {
    e.preventDefault();
    showToast("Bạn phải tắt proxy để cấu hình", false);
  }
});

txtWhitelist.addEventListener("mousedown", (e) => {
  if (isEnabled) {
    e.preventDefault();
    showToast("Bạn phải tắt proxy để cấu hình", false);
  }
});

btnImportRule.addEventListener("click", async () => {
  if (isEnabled) {
    showToast("Bạn phải tắt proxy để sửa", false);
    return;
  }
  const url = prompt(
    "Nhập link cấu hình (.conf / .txt):",
    "https://raw.githubusercontent.com/vnrom/FaceBookRule/main/default.conf",
  );
  if (!url) return;

  btnImportRule.textContent = "...";
  try {
    const res = await fetch(url);
    const text = await res.text();
    const lines = text.split("\n");

    let newDomains = [];
    lines.forEach((l) => {
      l = l.trim();
      if (!l || l.startsWith("#")) return;

      if (l.startsWith("DOMAIN-SUFFIX,") && l.includes("PROXY")) {
        newDomains.push(l.split(",")[1].trim());
      } else if (l.startsWith("DOMAIN-KEYWORD,") && l.includes("PROXY")) {
        newDomains.push("*" + l.split(",")[1].trim() + "*");
      }
    });

    if (newDomains.length > 0) {
      const cur = txtWhitelist.value.trim();
      // Loại bỏ trùng lặp nếu có
      let unique = [...new Set(newDomains)];
      txtWhitelist.value = cur
        ? cur + "\n" + unique.join("\n")
        : unique.join("\n");
      showToast("Đã nhập " + unique.length + " rules!", true);
    } else {
      showToast("Không tìm thấy rule DOMAIN", false);
    }
  } catch (e) {
    showToast("Lỗi tải link rule", false);
  }
  btnImportRule.textContent = "Tải Rule URL";
});

/* ── Paste handler: intercept multi-line paste ── */
txtAdd.addEventListener("paste", (e) => {
  const text = (e.clipboardData || window.clipboardData).getData("text");
  if (!text) return;

  // Check if pasted text has multiple proxies
  const hasMultiple = /[\n\r;,]/.test(text.trim());
  if (hasMultiple) {
    e.preventDefault(); // block default paste into input
    addMultipleProxies(text);
  }
  // single proxy paste → let browser paste normally, user clicks + or Enter
});

/* ── Custom Context Menu ── */
const ctxMenu = $("ctxMenu");
let ctxIdx = -1;

function hideCtx() {
  ctxMenu.classList.remove("show");
  ctxIdx = -1;
}

// Show menu on right-click
proxyListEl.addEventListener("contextmenu", (e) => {
  const item = e.target.closest(".proxy-item");
  if (!item) return;

  e.preventDefault();
  ctxIdx = parseInt(item.dataset.idx, 10);

  // Position menu at cursor
  const x = Math.min(e.clientX, document.body.clientWidth - 180);
  const y = Math.min(e.clientY, document.body.clientHeight - 120);
  ctxMenu.style.left = x + "px";
  ctxMenu.style.top = y + "px";
  ctxMenu.classList.add("show");
});

// Handle menu actions
ctxMenu.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn || ctxIdx < 0) return;

  const action = btn.dataset.action;
  const fullProxy = proxyList[ctxIdx];

  if (action === "copy" && fullProxy) {
    navigator.clipboard.writeText(fullProxy);
    showToast("Đã copy: " + fullProxy, true);
  }

  if (action === "copyip" && fullProxy) {
    const ipPort = fullProxy.split(":").slice(0, 2).join(":");
    navigator.clipboard.writeText(ipPort);
    showToast("Đã copy: " + ipPort, true);
  }

  if (action === "delete") {
    if (isEnabled) {
      showToast("Vui lòng tắt proxy để xóa", false);
      hideCtx();
      return;
    }
    proxyList.splice(ctxIdx, 1);
    if (selectedIdx === ctxIdx) selectedIdx = -1;
    else if (selectedIdx > ctxIdx) selectedIdx--;
    saveList();
    renderList();
    showToast("Đã xóa proxy", true);
  }

  hideCtx();
});

// Close menu on click outside
document.addEventListener("click", hideCtx);
document.addEventListener("contextmenu", (e) => {
  if (!e.target.closest(".proxy-item") && !e.target.closest(".ctx-menu")) {
    hideCtx();
  }
});

/* ── Events: Select & Delete in list ── */
proxyListEl.addEventListener("click", (e) => {
  // Delete
  const delBtn = e.target.closest("[data-del]");
  if (delBtn) {
    e.stopPropagation();
    if (isEnabled) {
      showToast("Vui lòng tắt proxy để xóa", false);
      return;
    }
    const idx = parseInt(delBtn.dataset.del, 10);
    const removed = proxyList.splice(idx, 1)[0];

    // adjust selectedIdx
    if (selectedIdx === idx) selectedIdx = -1;
    else if (selectedIdx > idx) selectedIdx--;

    saveList();
    renderList();
    showToast("Đã xóa proxy", true);
    return;
  }

  // Select
  const item = e.target.closest(".proxy-item");
  if (item) {
    if (isEnabled) {
      showToast("Vui lòng tắt proxy để đổi mạng", false);
      return;
    }
    const idx = parseInt(item.dataset.idx, 10);
    selectedIdx = idx;
    saveList();
    renderList();
  }
});

/* ── Events: Enable/Disable ── */
btnApply.addEventListener("click", async () => {
  if (selectedIdx < 0 || !proxyList[selectedIdx]) {
    showToast("Chọn 1 proxy trước", false);
    return;
  }

  const proxy = proxyList[selectedIdx];
  const whitelist = txtWhitelist.value.trim();
  const whitelistEnabled = chkWhitelist.checked;
  const webrtcShield = chkWebRTC.checked;
  const spoofingEnabled = chkSpoofing.checked;
  const spoofGpsEnabled = chkGps.checked;
  const spoofAltEnabled = chkAlt.checked;
  const r = await send({
    type: "SET_CFG",
    proxy,
    enabled: true,
    whitelist,
    whitelistEnabled,
    webrtcShield,
    spoofingEnabled,
    spoofGpsEnabled,
    spoofAltEnabled,
  });
  if (!r || !r.ok) {
    showToast(r && r.err ? r.err : "Apply thất bại", false);
    return;
  }
  setProxyStatus(true, proxy);
  showToast("Proxy đã kích hoạt ✓", true);
  startNetworkMonitor();
});

$("btnDisable").addEventListener("click", async () => {
  const proxy =
    selectedIdx >= 0 && proxyList[selectedIdx] ? proxyList[selectedIdx] : "";
  const whitelist = txtWhitelist.value.trim();
  const whitelistEnabled = chkWhitelist.checked;
  const webrtcShield = chkWebRTC.checked;
  const spoofingEnabled = chkSpoofing.checked;
  const spoofGpsEnabled = chkGps.checked;
  const spoofAltEnabled = chkAlt.checked;
  const r = await send({
    type: "SET_CFG",
    proxy,
    enabled: false,
    whitelist,
    whitelistEnabled,
    webrtcShield,
    spoofingEnabled,
    spoofGpsEnabled,
    spoofAltEnabled,
  });
  if (!r || !r.ok) {
    showToast(r && r.err ? r.err : "Tắt thất bại", false);
    return;
  }
  setProxyStatus(false, "");
  showToast("Đã chuyển về Direct", true);
  startNetworkMonitor();
});

/* ── Init ── */
async function init() {
  await loadList();

  const r = await send({ type: "GET_CFG" });
  if (!r || !r.ok) {
    setProxyStatus(false, "");
    showToast(r && r.err ? r.err : "Không đọc được config", false);
    renderList();
    return;
  }

  if (r.cfg.whitelist !== undefined) {
    txtWhitelist.value = r.cfg.whitelist;
  }
  if (r.cfg.whitelistEnabled !== undefined) {
    chkWhitelist.checked = !!r.cfg.whitelistEnabled;
    chkWhitelist.dispatchEvent(new Event("change"));
  }
  if (r.cfg.webrtcShield !== undefined) {
    chkWebRTC.checked = !!r.cfg.webrtcShield;
  }
  if (r.cfg.spoofingEnabled !== undefined) {
    chkSpoofing.checked = !!r.cfg.spoofingEnabled;
  }
  if (r.cfg.spoofGpsEnabled !== undefined) {
    chkGps.checked = !!r.cfg.spoofGpsEnabled;
  }
  if (r.cfg.spoofAltEnabled !== undefined) {
    chkAlt.checked = !!r.cfg.spoofAltEnabled;
  }

  // Sync: nếu proxy đang chạy trùng 1 trong list → select nó
  if (r.cfg.enabled && r.cfg.proxy) {
    const idx = proxyList.indexOf(r.cfg.proxy);
    if (idx >= 0) selectedIdx = idx;
  }

  setProxyStatus(r.cfg.enabled, r.cfg.proxy);
  renderList();
  startNetworkMonitor();
}

init();
