const themes = [
  { match: ['food', '餐', 'meal', 'dining'], icon: '🍽️', bg: 'bg-emerald-100', fg: 'text-emerald-700' },
  { match: ['entertainment', 'movie', 'fun', '娱乐'], icon: '🎬', bg: 'bg-amber-100', fg: 'text-amber-700' },
  { match: ['housing', 'rent', 'mortgage', 'house', '住宿'], icon: '🏠', bg: 'bg-orange-100', fg: 'text-orange-700' },
  { match: ['education', 'study', 'school', '学'], icon: '🎓', bg: 'bg-sky-100', fg: 'text-sky-700' },
  { match: ['transport', 'travel', 'commute', '交通'], icon: '🚌', bg: 'bg-indigo-100', fg: 'text-indigo-700' },
  { match: ['health', 'medical', 'care', '健康'], icon: '🩺', bg: 'bg-rose-100', fg: 'text-rose-700' },
  { match: ['shopping', 'retail', '购物'], icon: '🛍️', bg: 'bg-purple-100', fg: 'text-purple-700' },
  { match: ['salary', 'income', '工资'], icon: '💰', bg: 'bg-yellow-100', fg: 'text-yellow-700' },
  { match: ['investment', '投资'], icon: '📈', bg: 'bg-lime-100', fg: 'text-lime-700' },
  { match: ['utilities', 'water', '电', 'gas'], icon: '💡', bg: 'bg-cyan-100', fg: 'text-cyan-700' },
];

const defaultTheme = { icon: '🧾', bg: 'bg-slate-100', fg: 'text-slate-600' };

export function getCategoryTheme(name = '') {
  const lower = String(name || '').toLowerCase();
  for (const theme of themes) {
    if (theme.match.some((key) => lower.includes(key))) return theme;
  }
  return defaultTheme;
}

export default getCategoryTheme;
