import { useEffect, useState } from 'react';
import { fetchCategories, createCategory, updateCategory, deleteCategory } from '../services/categories';
import { getCategoryTheme } from '../utils/categoryTheme';

function formatError(err) {
  const message = err?.response?.data?.message || err?.message || 'Unknown error';
  return message;
}

export default function CategoryManager({ type = 'expense', open = false, onClose, onChange }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const typeLabel = type === 'income' ? 'Income' : 'Expense';

  useEffect(() => {
    if (!open) return;
    loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, type]);

  const loadCategories = async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await fetchCategories(type);
      const list = Array.isArray(rows) ? rows : [];
      setCategories(list);
      onChange?.(list);
    } catch (err) {
      setError(formatError(err));
      setCategories([]);
      onChange?.([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    const name = window.prompt(`Enter new ${typeLabel.toLowerCase()} category name`);
    if (!name || !name.trim()) return;
    try {
      setLoading(true);
      setError('');
      await createCategory({ name: name.trim(), type });
      await loadCategories();
    } catch (err) {
      const status = err?.response?.status;
      if (status === 409) {
        window.alert('Category already exists.');
      } else {
        window.alert(`Failed to create category: ${formatError(err)}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRename = async (category) => {
    const name = window.prompt('Rename category', category.name);
    if (!name) return;
    if (!name.trim()) {
      window.alert('Name cannot be empty.');
      return;
    }
    try {
      setLoading(true);
      setError('');
      await updateCategory(category.id, { name: name.trim() });
      await loadCategories();
    } catch (err) {
      const status = err?.response?.status;
      if (status === 409) {
        window.alert('Another category already uses this name.');
      } else if (status === 404) {
        window.alert('Category not found.');
      } else {
        window.alert(`Failed to rename category: ${formatError(err)}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (category) => {
    if (!window.confirm(`Delete category "${category.name}"?`)) return;
    try {
      setLoading(true);
      setError('');
      await deleteCategory(category.id);
      await loadCategories();
    } catch (err) {
      const status = err?.response?.status;
      if (status === 409) {
        const count = err?.response?.data?.message;
        window.alert(count || 'Category is used by transactions and cannot be deleted.');
      } else if (status === 404) {
        window.alert('Category not found.');
      } else {
        window.alert(`Failed to delete category: ${formatError(err)}`);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 px-4 py-10">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Manage {typeLabel} Categories</h2>
            <p className="mt-1 text-xs text-slate-500">Create, rename, or delete categories used in forms.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="max-h-[340px] overflow-y-auto px-6 py-4">
          {loading && (
            <div className="py-6 text-center text-sm text-slate-500">Loading...</div>
          )}
          {!loading && error && (
            <div className="py-3 text-center text-xs text-rose-600">{error}</div>
          )}
          {!loading && !error && categories.length === 0 && (
            <div className="py-6 text-center text-sm text-slate-500">No categories yet.</div>
          )}
          {!loading && !error && categories.length > 0 && (
            <ul className="space-y-3">
              {categories.map((cat) => {
                const theme = getCategoryTheme(cat.name);
                return (
                  <li key={cat.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${theme.bg} ${theme.fg}`}>
                        <span className="text-lg">{theme.icon}</span>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{cat.name}</div>
                        <div className="text-xs uppercase text-slate-400">{cat.type}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleRename(cat)}
                        className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(cat)}
                        className="rounded-lg border border-rose-200 px-3 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={handleCreate}
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white shadow hover:bg-blue-700"
          >
            + New Category
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
