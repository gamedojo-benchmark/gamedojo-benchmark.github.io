/* Translate canvas HUD labels before the encounter caches or draws them. */
(() => {
  let installed = false;
  window.GD_installEnglishHud = ({ table, scale, width }) => {
    if (installed) return;
    installed = true;

    const cjk = /[⺀-鿿豈-﫿！-～　-〿]/;
    const han = /[⺀-鿿豈-﫿]/;
    const hairSpace = '\u200a';
    const placeholders = /(#|\{\})/;
    const exact = new Map();
    const templates = [];
    const cache = new Map();
    const widthLimits = width.map(([pattern, pixels]) => [new RegExp(pattern), pixels]);

    for (const [source, english] of Object.entries(table)) {
      if (!placeholders.test(source)) {
        exact.set(source, english);
        continue;
      }
      const pattern = source.split(placeholders).map(part => {
        if (part === '#') return '(-?[\\d.,]+)';
        if (part === '{}') return '(.+?)';
        return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }).join('');
      templates.push([new RegExp('^' + pattern + '$'), english]);
    }

    function resolveLabel(text, depth) {
      if (!cjk.test(text)) return text;
      if (exact.has(text)) return exact.get(text);
      if (depth > 6) return undefined;
      for (const [pattern, english] of templates) {
        const match = pattern.exec(text);
        if (!match) continue;
        const parts = match.slice(1).map(part => resolveLabel(part, depth + 1));
        if (parts.includes(undefined)) continue;
        let i = 0;
        return english.replace(/#|\{\}/g, () => parts[i++]);
      }
      for (const separator of ['  ·  ', ' · ']) {
        if (!text.includes(separator)) continue;
        const parts = text.split(separator).map(part => resolveLabel(part, depth + 1));
        if (!parts.includes(undefined)) return parts.join(separator);
      }
      if (text.endsWith('…') && text.length > 1) {
        const prefix = text.slice(0, -1);
        for (const [key, english] of exact) {
          if (key.startsWith(prefix) && cjk.test(key)) return english;
        }
      }
      const trimmed = text.trim();
      if (trimmed !== text) {
        const english = resolveLabel(trimmed, depth + 1);
        if (english !== undefined) return text.replace(trimmed, () => english);
      }
      return undefined;
    }

    function translate(text) {
      if (!cjk.test(text)) return text;
      if (exact.has(text)) return exact.get(text);
      if (cache.has(text)) return cache.get(text);
      const compact = text.split(hairSpace).join('');
      let english = resolveLabel(compact, 0);
      if (english === undefined || han.test(english)) {
        english = text;
      } else if (compact !== text) {
        english = english.split('').join(hairSpace);
      }
      // Clocks and health counters can produce new strings throughout a long session.
      if (cache.size >= 512) cache.delete(cache.keys().next().value);
      cache.set(text, english);
      return english;
    }

    for (const context of [window.CanvasRenderingContext2D, window.OffscreenCanvasRenderingContext2D]) {
      if (!context) continue;
      for (const method of ['fillText', 'strokeText', 'measureText']) {
        const native = context.prototype[method];
        context.prototype[method] = function (value, ...args) {
          const text = String(value);
          if (this.canvas.width === 64 && this.canvas.height === 32 && text.length > 12) {
            return native.call(this, '', ...args);
          }
          const english = translate(text);
          if (english === text) return native.call(this, text, ...args);
          const factor = scale[text];
          const originalFont = this.font;
          if (factor) {
            this.font = originalFont.replace(/([\d.]+)px/, (_, size) => size * factor + 'px');
          }
          try {
            const limit = widthLimits.find(([pattern]) => pattern.test(english));
            if (limit && method !== 'measureText') {
              const maxWidth = args.length > 2 ? Math.min(args[2], limit[1]) : limit[1];
              return native.call(this, english, args[0], args[1], maxWidth);
            }
            return native.call(this, english, ...args);
          } finally {
            if (factor) this.font = originalFont;
          }
        };
      }
    }
  };
})();
