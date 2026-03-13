import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// Expenses
export const getExpenses   = (params) => api.get('/expenses', { params });
export const createExpense = (data)   => api.post('/expenses', data);
export const updateExpense = (id, data) => api.patch(`/expenses/${id}`, data);
export const updateGroup   = (gid, data) => api.patch(`/expenses/group/${gid}`, data);
export const deleteExpense = (id)     => api.delete(`/expenses/${id}`);
export const deleteGroup   = (gid)    => api.delete(`/expenses/group/${gid}`);

// Dashboard
export const getDashboard  = (month)  => api.get('/dashboard', { params: { month } });

// Invoices
export const getInvoices   = () => api.get('/invoices');
export const getInvoice    = (method, month) => api.get(`/invoices/${encodeURIComponent(method)}/${month}`);

// Reports
export const getReportByCategory      = (params) => api.get('/reports/by-category', { params });
export const getReportByMonth         = (params) => api.get('/reports/by-month', { params });
export const getReportByPaymentMethod = (params) => api.get('/reports/by-payment-method', { params });
export const getReportDetail          = (params) => api.get('/reports/detail', { params });

// Payment methods
export const getPaymentMethods  = ()      => api.get('/payment-methods');
export const createPaymentMethod= (data)  => api.post('/payment-methods', data);
export const deletePaymentMethod= (id)    => api.delete(`/payment-methods/${id}`);

// Categories
export const getCategories      = ()      => api.get('/categories');
export const createCategory     = (data)  => api.post('/categories', data);
export const deleteCategory     = (id)    => api.delete(`/categories/${id}`);

// Subcategories
export const getSubcategories   = (categoryId) => api.get('/subcategories', { params: { category_id: categoryId } });
export const getAllSubcategories = ()           => api.get('/subcategories');
export const createSubcategory  = (data)       => api.post('/subcategories', data);
export const deleteSubcategory  = (id)         => api.delete(`/subcategories/${id}`);

// Cutoff dates
export const getCutoffDates     = (pmId)  => api.get('/cutoff-dates', { params: { payment_method_id: pmId } });
export const saveCutoffDate     = (data)  => api.post('/cutoff-dates', data);
export const deleteCutoffDate   = (id)    => api.delete(`/cutoff-dates/${id}`);

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
