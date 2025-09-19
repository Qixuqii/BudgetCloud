import http from './http.js';

export const fetchCategories = (type) =>
  http.get('/categories', { params: type ? { type } : undefined }).then(res => res.data);

export const createCategory = ({ name, type }) =>
  http.post('/categories', { name, type }).then(res => res.data);

export const updateCategory = (id, payload) =>
  http.put(`/categories/${id}`, payload).then(res => res.data);

export const deleteCategory = (id) =>
  http.delete(`/categories/${id}`).then(res => res.data);
