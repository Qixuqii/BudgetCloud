import http from './http.js';

export const fetchCategories = (type, ledgerId) =>
  http.get('/categories', { params: (() => {
    const p = {};
    if (type) p.type = type;
    if (ledgerId) p.ledger_id = ledgerId;
    return Object.keys(p).length ? p : undefined;
  })() }).then(res => res.data);

export const createCategory = ({ name, type }) =>
  http.post('/categories', { name, type }).then(res => res.data);

export const updateCategory = (id, payload) =>
  http.put(`/categories/${id}`, payload).then(res => res.data);

export const deleteCategory = (id) =>
  http.delete(`/categories/${id}`).then(res => res.data);
