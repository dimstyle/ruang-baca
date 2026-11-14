// Small formatters exposed to every EJS view (ui-specs.md: avatar inisial, book tile).
const PALETTE = [
  '#1A73E8',
  '#188038',
  '#E37400',
  '#D93025',
  '#9334E6',
  '#007B83',
  '#C5221F',
  '#5F6368',
];

export const helpers = {
  initials(name?: string | null) {
    const parts = String(name ?? '?')
      .trim()
      .split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
  },
  color(key?: string | number | null) {
    let h = 0;
    for (const c of String(key ?? '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return PALETTE[h % PALETTE.length];
  },
  date(d?: string | Date | null) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  },
  ymd(d?: string | Date | null) {
    return d ? new Date(d).toISOString().slice(0, 10) : '';
  },
  rupiah(n?: number | string | null) {
    return 'Rp' + Number(n ?? 0).toLocaleString('id-ID');
  },
  daysLeft(d?: string | Date | null) {
    if (!d) return null;
    return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000);
  },
};
