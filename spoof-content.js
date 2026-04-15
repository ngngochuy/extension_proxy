// Gửi yêu cầu lên background để yêu cầu tiêm mã Spoofing bằng chrome.scripting.executeScript
// Cách này Bypass được hoàn toàn Content Security Policy (CSP) của các trang web khó tính
chrome.runtime.sendMessage({ type: "REQ_SPOOF" }).catch(e => {});
