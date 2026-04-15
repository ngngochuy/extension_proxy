let STATE = {
  enabled: false,
  raw: "",
  ip: "",
  port: 0,
  user: "",
  pass: "",
  whitelist: "",
  whitelistEnabled: true,
  webrtcShield: true,
  spoofingEnabled: true,
  proxyTimezone: "",
  proxyLocale: "",
  proxyLat: "",
  proxyLon: "",
  proxyAlt: "",
};

const DEFAULTS = {
  enabled: true,
  proxy: "",
  whitelist: "",
  whitelistEnabled: true,
  webrtcShield: true,
  spoofingEnabled: true,
  spoofGpsEnabled: true,
  spoofAltEnabled: false,
  proxyTimezone: "",
  proxyLocale: "",
  proxyLat: "",
  proxyLon: "",
  proxyAlt: "",
};

function parseProxy(raw) {
  raw = (raw || "").trim();
  if (!raw) return null;

  const parts = raw.split(":");
  if (parts.length < 2) return null;

  const ip = parts[0].trim();
  const port = parseInt(parts[1], 10);
  if (!ip || !port || isNaN(port)) return null;

  let user = "";
  let pass = "";
  if (parts.length >= 4) {
    user = parts[2];
    pass = parts.slice(3).join(":"); // pass có thể chứa :
  }
  return { raw, ip, port, user, pass };
}

async function loadState() {
  const d = await chrome.storage.local.get(DEFAULTS);
  const p = parseProxy(d.proxy);

  STATE.enabled = !!d.enabled;
  STATE.raw = d.proxy || "";
  STATE.whitelist = d.whitelist || "";
  STATE.whitelistEnabled =
    d.whitelistEnabled !== undefined ? !!d.whitelistEnabled : true;
  STATE.webrtcShield = d.webrtcShield !== undefined ? !!d.webrtcShield : true;
  STATE.spoofingEnabled =
    d.spoofingEnabled !== undefined ? !!d.spoofingEnabled : true;
  STATE.spoofGpsEnabled =
    d.spoofGpsEnabled !== undefined ? !!d.spoofGpsEnabled : true;
  STATE.spoofAltEnabled = !!d.spoofAltEnabled;
  STATE.proxyTimezone = d.proxyTimezone || "";
  STATE.proxyLocale = d.proxyLocale || "";
  STATE.proxyLat = d.proxyLat || "";
  STATE.proxyLon = d.proxyLon || "";
  STATE.proxyAlt = d.proxyAlt || "";
  STATE.ip = p ? p.ip : "";
  STATE.port = p ? p.port : 0;
  STATE.user = p ? p.user : "";
  STATE.pass = p ? p.pass : "";
}

async function applyState() {
  if (!STATE.enabled) {
    await chrome.proxy.settings.set({
      value: { mode: "direct" },
      scope: "regular",
    });

    // Trả WebRTC về mặc định
    if (chrome.privacy && chrome.privacy.network) {
      chrome.privacy.network.webRTCIPHandlingPolicy.clear({});
    }

    // Tắt DNR Rules và Storage cho Spoofing
    if (chrome.declarativeNetRequest) {
      chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [1] });
    }
    await chrome.storage.local.set({
      proxyTimezone: "",
      proxyLocale: "",
      proxyLat: "",
      proxyLon: "",
      proxyAlt: "",
    });

    // reset cache (đỡ nhầm auth)
    STATE.ip = "";
    STATE.port = 0;
    STATE.user = "";
    STATE.pass = "";
    STATE.proxyTimezone = "";
    STATE.proxyLocale = "";
    STATE.proxyLat = "";
    STATE.proxyLon = "";
    STATE.proxyAlt = "";

    return { ok: true, enabled: false };
  }

  const p = parseProxy(STATE.raw);
  if (!p) {
    return {
      ok: false,
      err: "Proxy không hợp lệ. Nhập ip:port hoặc ip:port:user:pass",
    };
  }

  let config;
  const wlist = STATE.whitelistEnabled
    ? STATE.whitelist
        .split(/[\n,;]+/)
        .map((x) => x.trim())
        .filter(Boolean)
    : [];

  if (wlist.length > 0) {
    // Ép các tên miền kiểm tra trạng thái của UI đi qua Proxy
    // Để trên giao diện luôn hiện đúng cờ và ping của Proxy đang dùng
    wlist.push("get.geojs.io", "www.gstatic.com");

    // PAC Mode (Tính năng Tách Luồng: Custom Domain Whitelist)
    const conditions = wlist.map((d) => {
      return `shExpMatch(host, "${d}") || shExpMatch(host, "*.${d}")`;
    });

    const pacData = `
                  function FindProxyForURL(url, host) {
                    if (${conditions.join(" || ")}) {
                      return "PROXY ${p.ip}:${p.port}";
                    }
                    return "DIRECT";
                  }
                `;

    config = {
      mode: "pac_script",
      pacScript: { data: pacData },
    };
  } else {
    // Fixed Server Mode (Proxy toàn diện)
    config = {
      mode: "fixed_servers",
      rules: {
        singleProxy: { scheme: "http", host: p.ip, port: p.port },
        bypassList: ["localhost", "127.0.0.1", "<-loopback>"],
      },
    };
  }

  await chrome.proxy.settings.set({ value: config, scope: "regular" });

  // Xử lý chống dò rỉ mạng qua WebRTC (WebRTC Shield)
  if (chrome.privacy && chrome.privacy.network) {
    if (STATE.webrtcShield) {
      chrome.privacy.network.webRTCIPHandlingPolicy.set({
        value: "disable_non_proxied_udp",
      });
    } else {
      chrome.privacy.network.webRTCIPHandlingPolicy.clear({});
    }
  }

  // update cache để auth sync ăn chắc
  STATE.ip = p.ip;
  STATE.port = p.port;
  STATE.user = p.user || "";
  STATE.pass = p.pass || "";

  // Xử lý Antidetect Spoofing (Asynchronous)
  if (STATE.spoofingEnabled) {
    // Đợi một chút để proxy kích hoạt thật sự mới gọi lấy IP
    setTimeout(async () => {
      try {
        const res = await fetch("https://get.geojs.io/v1/ip/geo.json", {
          cache: "no-store",
        });
        const data = await res.json();
        if (data.timezone && data.country_code) {
          const locale =
            data.country_code.toLowerCase() +
            "-" +
            data.country_code.toUpperCase(); // vd: us-US, vi-VN
          STATE.proxyTimezone = data.timezone;
          STATE.proxyLocale = locale;
          STATE.proxyLat = data.latitude || "";
          STATE.proxyLon = data.longitude || "";
          // geojs.io provider may not return altitude, mock alt normally
          STATE.proxyAlt = "5"; // default small altitude to look real

          await chrome.storage.local.set({
            proxyTimezone: data.timezone,
            proxyLocale: locale,
            proxyLat: STATE.proxyLat,
            proxyLon: STATE.proxyLon,
            proxyAlt: STATE.proxyAlt,
          });

          if (chrome.declarativeNetRequest) {
            chrome.declarativeNetRequest.updateDynamicRules({
              addRules: [
                {
                  id: 1,
                  priority: 1,
                  action: {
                    type: "modifyHeaders",
                    requestHeaders: [
                      {
                        header: "Accept-Language",
                        operation: "set",
                        value: locale + ",en;q=0.9",
                      },
                    ],
                  },
                  condition: {
                    resourceTypes: [
                      "main_frame",
                      "sub_frame",
                      "xmlhttprequest",
                      "ping",
                      "script",
                      "image",
                      "stylesheet",
                    ],
                  },
                },
              ],
              removeRuleIds: [1],
            });
          }
        }
      } catch (e) {
        // Bỏ qua nếu lỗi mạng
        console.log("Không thể fetch geo timezone", e);
      }
    }, 1500);
  } else {
    if (chrome.declarativeNetRequest) {
      chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [1] });
    }
    STATE.proxyTimezone = "";
    STATE.proxyLocale = "";
    STATE.proxyLat = "";
    STATE.proxyLon = "";
    STATE.proxyAlt = "";
    await chrome.storage.local.set({
      proxyTimezone: "",
      proxyLocale: "",
      proxyLat: "",
      proxyLon: "",
      proxyAlt: "",
    });
  }

  return { ok: true, enabled: true, proxy: p.raw };
}

// ✅ Auth handler phải sync, KHÔNG await storage ở đây
chrome.webRequest.onAuthRequired.addListener(
  (details) => {
    if (!STATE.enabled) return;
    if (!details.isProxy) return; // Chỉ xử lý khi Require Auth là của Proxy, bỏ qua nếu là của Website

    if (STATE.user) {
      return {
        authCredentials: {
          username: STATE.user,
          password: STATE.pass || "",
        },
      };
    }
  },
  { urls: ["<all_urls>"] },
  ["blocking"],
);

// Popup <-> Background
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (msg?.type === "REQ_SPOOF") {
        if (STATE.spoofingEnabled && STATE.proxyTimezone && STATE.proxyLocale) {
          chrome.scripting
            .executeScript({
              target: { tabId: sender.tab.id, frameIds: [sender.frameId] },
              world: "MAIN",
              injectImmediately: true,
              func: function (tz, locale, lat, lon, alt, mapEnabled, altEnabled) {
                try {
                  const hooks = [];
                  const nativeToString = Function.prototype.toString;
                  const proxyToString = new Proxy(nativeToString, {
                    apply: function (target, thisArg, args) {
                      if (thisArg === proxyToString)
                        return "function toString() { [native code] }";
                      for (let i = 0; i < hooks.length; i++) {
                        if (thisArg === hooks[i].proxy) return hooks[i].src;
                      }
                      return Reflect.apply(target, thisArg, args);
                    },
                  });
                  Function.prototype.toString = proxyToString;

                  const origDTF = Intl.DateTimeFormat;
                  const proxyDTF = new Proxy(origDTF, {
                    construct(target, args) {
                      if (!args[1]) args[1] = {};
                      if (!args[1].timeZone) args[1].timeZone = tz;
                      if (!args[0]) args[0] = locale;
                      return new target(...args);
                    },
                    apply(target, thisArg, args) {
                      if (!args[1]) args[1] = {};
                      if (!args[1].timeZone) args[1].timeZone = tz;
                      if (!args[0]) args[0] = locale;
                      return Reflect.apply(target, thisArg, args);
                    },
                  });
                  Intl.DateTimeFormat = proxyDTF;
                  hooks.push({
                    proxy: proxyDTF,
                    src: "function DateTimeFormat() { [native code] }",
                  });

                  const nLangDesc = Object.getOwnPropertyDescriptor(
                    Navigator.prototype,
                    "language",
                  );
                  if (nLangDesc) {
                    const proxyLang = new Proxy(nLangDesc.get, {
                      apply: () => locale,
                    });
                    Object.defineProperty(Navigator.prototype, "language", {
                      get: proxyLang,
                    });
                    hooks.push({
                      proxy: proxyLang,
                      src: "function get language() { [native code] }",
                    });
                  }

                  const nLangsDesc = Object.getOwnPropertyDescriptor(
                    Navigator.prototype,
                    "languages",
                  );
                  if (nLangsDesc) {
                    const proxyLangs = new Proxy(nLangsDesc.get, {
                      apply: () => [locale, "en"],
                    });
                    Object.defineProperty(Navigator.prototype, "languages", {
                      get: proxyLangs,
                    });
                    hooks.push({
                      proxy: proxyLangs,
                      src: "function get languages() { [native code] }",
                    });
                  }

                  const format = new origDTF("en-US", {
                    timeZone: tz,
                    timeZoneName: "longOffset",
                  });
                  const parts = format.formatToParts(new window.Date());
                  const gmtOffset = parts.find(
                    (p) => p.type === "timeZoneName",
                  );
                  let offsetMins = 0;
                  if (
                    gmtOffset &&
                    gmtOffset.value &&
                    gmtOffset.value.startsWith("GMT")
                  ) {
                    const time = gmtOffset.value.replace("GMT", "");
                    if (time) {
                      const sign = time[0] === "+" ? -1 : 1;
                      const p = time.substring(1).split(":").map(Number);
                      offsetMins = sign * (p[0] * 60 + (p[1] || 0));
                    }
                  }
                  const OrigDate = window.Date;
                  const proxyGetTimezoneOffset = new Proxy(
                    OrigDate.prototype.getTimezoneOffset,
                    {
                      apply: function () {
                        return offsetMins;
                      },
                    },
                  );
                  Object.defineProperty(
                    OrigDate.prototype,
                    "getTimezoneOffset",
                    { value: proxyGetTimezoneOffset },
                  );
                  hooks.push({
                    proxy: proxyGetTimezoneOffset,
                    src: "function getTimezoneOffset() { [native code] }",
                  });

                  // Spoof Geolocation
                  if (
                    lat &&
                    lon &&
                    navigator.geolocation &&
                    mapEnabled === true
                  ) {
                    const proxyGeo = new Proxy(
                      navigator.geolocation.getCurrentPosition,
                      {
                        apply: function (target, thisArg, args) {
                          const successCb = args[0];
                          if (successCb && typeof successCb === "function") {
                            setTimeout(() => {
                              successCb({
                                coords: {
                                  latitude: parseFloat(lat),
                                  longitude: parseFloat(lon),
                                  altitude: (altEnabled && alt) ? parseFloat(alt) : null,
                                  accuracy: 10 + Math.random() * 20, // random accuracy
                                  altitudeAccuracy: (altEnabled && alt)
                                    ? 5 + Math.random() * 10
                                    : null,
                                  heading: null,
                                  speed: null,
                                },
                                timestamp: window.Date.now(),
                              });
                            }, 50); // delay fake
                          }
                        },
                      },
                    );
                    Object.defineProperty(
                      navigator.geolocation,
                      "getCurrentPosition",
                      { value: proxyGeo },
                    );
                    hooks.push({
                      proxy: proxyGeo,
                      src: "function getCurrentPosition() { [native code] }",
                    });

                    const proxyGeoWatch = new Proxy(
                      navigator.geolocation.watchPosition,
                      {
                        apply: function (target, thisArg, args) {
                          const successCb = args[0];
                          if (successCb && typeof successCb === "function") {
                            setTimeout(() => {
                              successCb({
                                coords: {
                                  latitude: parseFloat(lat),
                                  longitude: parseFloat(lon),
                                  altitude: (altEnabled && alt) ? parseFloat(alt) : null,
                                  accuracy: 10 + Math.random() * 20,
                                  altitudeAccuracy: (altEnabled && alt)
                                    ? 5 + Math.random() * 10
                                    : null,
                                  heading: null,
                                  speed: null,
                                },
                                timestamp: window.Date.now(),
                              });
                            }, 50);
                          }
                          return 1; // watch id
                        },
                      },
                    );
                    Object.defineProperty(
                      navigator.geolocation,
                      "watchPosition",
                      { value: proxyGeoWatch },
                    );
                    hooks.push({
                      proxy: proxyGeoWatch,
                      src: "function watchPosition() { [native code] }",
                    });
                  }
                } catch (e) {}
              },
              args: [
                STATE.proxyTimezone,
                STATE.proxyLocale,
                STATE.proxyLat,
                STATE.proxyLon,
                STATE.proxyAlt,
                STATE.spoofGpsEnabled,
                STATE.spoofAltEnabled,
              ],
            })
            .catch((err) => console.log("Spoof exe error:", err));
        }
        return;
      }

      if (msg?.type === "GET_CFG") {
        await loadState();
        sendResponse({
          ok: true,
          cfg: {
            enabled: STATE.enabled,
            proxy: STATE.raw,
            whitelist: STATE.whitelist,
            whitelistEnabled: STATE.whitelistEnabled,
            webrtcShield: STATE.webrtcShield,
            spoofingEnabled: STATE.spoofingEnabled,
            spoofGpsEnabled: STATE.spoofGpsEnabled,
            spoofAltEnabled: STATE.spoofAltEnabled,
          },
        });
        return;
      }

      if (msg?.type === "SET_CFG") {
        const enabled = !!msg.enabled;
        const proxy = (msg.proxy || "").trim();
        const whitelist = (msg.whitelist || "").trim();
        const whitelistEnabled =
          msg.whitelistEnabled !== undefined ? !!msg.whitelistEnabled : true;
        const webrtcShield =
          msg.webrtcShield !== undefined ? !!msg.webrtcShield : true;
        const spoofingEnabled =
          msg.spoofingEnabled !== undefined ? !!msg.spoofingEnabled : true;
        const spoofGpsEnabled = !!msg.spoofGpsEnabled;
        const spoofAltEnabled = !!msg.spoofAltEnabled;

        await chrome.storage.local.set({
          enabled,
          proxy,
          whitelist,
          whitelistEnabled,
          webrtcShield,
          spoofingEnabled,
          spoofGpsEnabled,
          spoofAltEnabled,
        });
        await loadState();
        const r = await applyState();
        if (!r.ok) {
          sendResponse(r);
          return;
        }

        sendResponse({
          ok: true,
          cfg: {
            enabled: STATE.enabled,
            proxy: STATE.raw,
            whitelist: STATE.whitelist,
            whitelistEnabled: STATE.whitelistEnabled,
            webrtcShield: STATE.webrtcShield,
            spoofingEnabled: STATE.spoofingEnabled,
            spoofGpsEnabled: STATE.spoofGpsEnabled,
            spoofAltEnabled: STATE.spoofAltEnabled,
          },
        });
        return;
      }

      if (msg?.type === "APPLY") {
        await loadState();
        const r = await applyState();
        if (!r.ok) {
          sendResponse(r);
          return;
        }

        sendResponse({
          ok: true,
          cfg: {
            enabled: STATE.enabled,
            proxy: STATE.raw,
            whitelist: STATE.whitelist,
            whitelistEnabled: STATE.whitelistEnabled,
            webrtcShield: STATE.webrtcShield,
            spoofingEnabled: STATE.spoofingEnabled,
            spoofGpsEnabled: STATE.spoofGpsEnabled,
            spoofAltEnabled: STATE.spoofAltEnabled,
          },
        });
        return;
      }

      sendResponse({ ok: false, err: "Unknown message" });
    } catch (e) {
      sendResponse({ ok: false, err: e && e.message ? e.message : String(e) });
    }
  })();
  return true;
});

async function init() {
  // đảm bảo defaults có mặt
  const cur = await chrome.storage.local.get(DEFAULTS);
  await chrome.storage.local.set(Object.assign({}, DEFAULTS, cur));

  await loadState();
  await applyState(); // ✅ mở lên là apply ngay nếu có defaultProxy
}

chrome.runtime.onInstalled.addListener(init);
init();
