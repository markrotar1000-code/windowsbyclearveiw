// Keep font shaping proportional to distinct words, rather than re-shaping an
// increasingly long line for every word. Cache is per document/font, never global.
export function createPdfTextWrapper() {
  const fonts = new WeakMap();
  return function wrap(text, font, size, maxWidth) {
    let cache = fonts.get(font);
    if (!cache) { cache = new Map(); fonts.set(font, cache); }
    const width = value => {
      if (!cache.has(value)) cache.set(value, font.widthOfTextAtSize(value, 1));
      return cache.get(value) * size;
    };
    const rows = [], space = width(' ');
    let row = '', rowWidth = 0;
    const flush = () => { rows.push(row); row = ''; rowWidth = 0; };
    for (const word of text.split(/\s+/)) {
      let part = word, partWidth = width(part);
      if (row && rowWidth + space + partWidth > maxWidth) flush();
      while (partWidth > maxWidth) {
        if (row) flush();
        const points = Array.from(part);
        let low = 1, high = points.length;
        while (low < high) {
          const mid = Math.ceil((low + high) / 2);
          if (width(points.slice(0, mid).join('')) <= maxWidth) low = mid;
          else high = mid - 1;
        }
        const chunk = points.slice(0, low).join('');
        if (width(chunk) > maxWidth) throw new Error('A PDF character exceeds the available text width.');
        rows.push(chunk);
        part = points.slice(low).join('');
        partWidth = width(part);
      }
      rowWidth += (row && part ? space : 0) + partWidth;
      row += (row && part ? ' ' : '') + part;
    }
    rows.push(row);
    return rows;
  };
}
