export default function Tag({
  children,
  color = 'gray',
  size = 'sm',
  icon = null,
  className = '',
}) {
  const base = 'inline-flex items-center gap-1 rounded-full ring-1 font-medium';
  const sizes = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-2.5 py-1.5 text-sm',
  };
  const colors = {
    gray: 'bg-gray-50 text-gray-700 ring-gray-200',
    blue: 'bg-blue-50 text-blue-700 ring-blue-200',
    indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200',
    rose: 'bg-rose-50 text-rose-700 ring-rose-200',
  };
  const cls = `${base} ${sizes[size] ?? sizes.sm} ${colors[color] ?? colors.gray} ${className}`;
  return (
    <span className={cls}>
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      {children}
    </span>
  );
}

