const tz = "America/New_York";
const locale = "en-US";

const hooks = [];
const nativeToString = Function.prototype.toString;
const proxyToString = new Proxy(nativeToString, {
  apply: function(target, thisArg, args) {
    if (thisArg === proxyToString) return "function toString() { [native code] }";
    for (let i=0; i<hooks.length; i++) {
       if (thisArg === hooks[i].proxy) return hooks[i].src;
    }
    return Reflect.apply(target, thisArg, args);
  }
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
  }
});
Intl.DateTimeFormat = proxyDTF;
hooks.push({ proxy: proxyDTF, src: "function DateTimeFormat() { [native code] }" });

const OrigDate = Date;
const proxyGetTimezoneOffset = new Proxy(OrigDate.prototype.getTimezoneOffset, {
   apply: function() { return 300; } // dummy offset
});
Object.defineProperty(OrigDate.prototype, 'getTimezoneOffset', { value: proxyGetTimezoneOffset });
hooks.push({ proxy: proxyGetTimezoneOffset, src: "function getTimezoneOffset() { [native code] }" });

const proxyLang = new Proxy(Object.getOwnPropertyDescriptor(Navigator.prototype, 'language').get, {
  apply: () => locale
});
Object.defineProperty(Navigator.prototype, 'language', { get: proxyLang });
hooks.push({ proxy: proxyLang, src: "function get language() { [native code] }" });

const proxyLangs = new Proxy(Object.getOwnPropertyDescriptor(Navigator.prototype, 'languages').get, {
  apply: () => [locale, 'en']
});
Object.defineProperty(Navigator.prototype, 'languages', { get: proxyLangs });
hooks.push({ proxy: proxyLangs, src: "function get languages() { [native code] }" });
