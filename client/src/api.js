import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// Injeta o token em todas as requisições
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    console.warn('[api] requisição sem token:', config.method?.toUpperCase(), config.url);
  }
  return config;
});

// Se receber 401, limpa sessão e vai para login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      console.error('[api] 401 recebido em', err.config?.url, '— limpando sessão');
      localStorage.removeItem('token');
      localStorage.removeItem('username');
      localStorage.removeItem('is_admin');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Auth
export const login         = (data) => api.post('/auth/login', data);
export const getMe         = ()     => api.get('/auth/me');
export const updateProfile = (data) => api.put('/auth/profile', data);

// User management (admin only)
export const getUsers    = ()     => api.get('/users');
export const createUser  = (data) => api.post('/users', data);
export const deleteUser  = (id)   => api.delete(`/users/${id}`);

// Expenses
export const getExpenses   = (params) => api.get('/expenses', { params });
export const getDateRange  = ()       => api.get('/expenses/date-range');
export const createExpense = (data)   => api.post('/expenses', data);
export const updateExpense = (id, data) => api.patch(`/expenses/${id}`, data);
export const updateGroup   = (gid, data) => api.patch(`/expenses/group/${gid}`, data);
export const deleteExpense = (id)     => api.delete(`/expenses/${id}`);
export const deleteGroup   = (gid)    => api.delete(`/expenses/group/${gid}`);
export const checkExpense  = (id, checked)    => api.patch(`/expenses/${id}/check`, { is_checked: checked ? 1 : 0 });
export const setRecorrente = (id, recorrente) => api.patch(`/expenses/${id}/recorrente`, { recorrente });

// Dashboard — aceita { month } para mês único ou { start, end } para período
export const getDashboard  = (params) => api.get('/dashboard', { params });

// Invoices
export const getInvoices   = () => api.get('/invoices');
export const getInvoice    = (method, month) => api.get(`/invoices/${encodeURIComponent(method)}/${month}`);

// Reports
export const getReportByCategory      = (params) => api.get('/reports/by-category', { params });
export const getReportByMonth         = (params) => api.get('/reports/by-month', { params });
export const getReportByPaymentMethod = (params) => api.get('/reports/by-payment-method', { params });
export const getReportDetail          = (params) => api.get('/reports/detail', { params });

// Payment methods
export const getPaymentMethods   = ()     => api.get('/payment-methods');
export const createPaymentMethod = (data) => api.post('/payment-methods', data);
export const deletePaymentMethod = (id)   => api.delete(`/payment-methods/${id}`);

// Categories
export const getCategories   = ()     => api.get('/categories');
export const createCategory  = (data) => api.post('/categories', data);
export const deleteCategory  = (id)   => api.delete(`/categories/${id}`);

// Subcategories
export const getSubcategories   = (categoryId) => api.get('/subcategories', { params: { category_id: categoryId } });
export const getAllSubcategories = ()           => api.get('/subcategories');
export const createSubcategory  = (data)       => api.post('/subcategories', data);
export const deleteSubcategory  = (id)         => api.delete(`/subcategories/${id}`);

// WhatsApp linking
export const getWhatsappStatus        = ()       => api.get('/users/whatsapp/status');
export const generateLinkCode         = ()       => api.post('/users/whatsapp/link-code');
export const unlinkWhatsapp           = ()       => api.delete('/users/whatsapp/unlink');
export const getWhatsappDefaultMethod = ()       => api.get('/users/whatsapp/default-method');
export const setWhatsappDefaultMethod = (method) => api.put('/users/whatsapp/default-method', { method });

// Cutoff dates
export const getCutoffDates    = (pmId) => api.get('/cutoff-dates', { params: { payment_method_id: pmId } });
export const getAllCutoffDates = ()     => api.get('/cutoff-dates');
export const saveCutoffDate    = (data) => api.post('/cutoff-dates', data);
export const deleteCutoffDate  = (id)   => api.delete(`/cutoff-dates/${id}`);
export const updateCutoffDate  = (id, data) => api.patch(`/cutoff-dates/${id}`, data);

// Formatters
export const fmtCurrency = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0);

export const fmtDate = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
};

export const MONTH_NAMES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

export default api;
