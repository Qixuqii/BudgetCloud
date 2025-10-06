import axios from 'axios';

const http = axios.create({
    baseURL: import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE || '/api',
    withCredentials: true,
    timeout: 10000
});

// 添加请求拦截器
http.interceptors.request.use(function (config) {
    // 在发送请求之前做些什么
    const token = localStorage.getItem('token');
    if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  }, function (error) {
    // 对请求错误做些什么
    return Promise.reject(error);
  });

// 添加响应拦截器
http.interceptors.response.use(function (response) {
    // 2xx 范围内的状态码都会触发该函数。
    // 对响应数据做点什么
    return response;
  }, function (error) {
    // 超出 2xx 范围的状态码都会触发该函数。
    // 对响应错误做点什么
    const status = error.response ? error.response.status : null;
    // Only force re-login on 401 (unauthenticated). 403 can be a valid
    // authorization failure (e.g., not owner) and should not log user out.
    if (status === 401) {
      try { localStorage.removeItem('token'); } catch {}
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default http;
