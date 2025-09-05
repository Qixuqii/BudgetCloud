import http from './http.js';

export const fetchTransactions = (params = {}) =>
  http.get('/transactions', { params }).then(res => res.data);

export const addTransaction = (payload) =>
  http.post('/transactions', payload).then(res => res.data);

export const fetchTransaction = (id) =>
  http.get(`/transactions/${id}`).then(res => res.data);

export const updateTransaction = (id, payload) =>
  http.put(`/transactions/${id}`, payload).then(res => res.data);

export const deleteTransaction = (id) =>
  http.delete(`/transactions/${id}`).then(res => res.data);
