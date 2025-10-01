// English date formatting helpers

export function toYMD(input) {
  try {
    if (!input) return '';
    const d = input instanceof Date ? input : new Date(String(input));
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch {
    return '';
  }
}

export function formatDateEN(input) {
  try {
    if (!input) return '';
    let d;
    if (input instanceof Date) {
      d = input;
    } else {
      const raw = String(input);
      // If it's a full ISO string (contains 'T'), parse directly to preserve timezone offset
      if (raw.includes('T')) {
        d = new Date(raw);
      } else {
        // Normalize separators and prefer YYYY-MM-DD as local date
        const s = raw.slice(0, 10).replace(/\//g, '-');
        d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00`) : new Date(raw);
      }
    }
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const m = months[d.getMonth()];
    const day = String(d.getDate()).padStart(2, '0');
    const y = d.getFullYear();
    return `${m} ${day}, ${y}`;
  } catch {
    return '';
  }
}

export function formatMonthEN(input) {
  try {
    // Accept Date or "YYYY-MM"
    let y, m;
    if (input instanceof Date) {
      y = input.getFullYear();
      m = input.getMonth() + 1;
    } else {
      const s = String(input).slice(0, 7);
      const parts = s.split('-');
      y = Number(parts[0]);
      m = Number(parts[1]);
    }
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    if (!y || !m) return '';
    return `${months[m - 1]} ${y}`;
  } catch {
    return '';
  }
}
