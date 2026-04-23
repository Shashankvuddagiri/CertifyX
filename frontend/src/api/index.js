import axios from 'axios';

const api = axios.create({
  baseURL: 'http://127.0.0.1:5000/api',
});

export const uploadData = (data) => api.post('/upload', { data });

export const generateCertificates = (templateName, ids = []) => api.post('/generate', { templateName, ids });

export const sendEmails = (ids = [], emailSubject, emailBody, cc = '') => api.post('/send', { ids, emailSubject, emailBody, cc });

export const getTemplateHtml = (templateName) => api.get(`/template/${templateName}`);

export const getTemplateSettings = (templateName) => api.get(`/template/${templateName}/settings`);

export const saveTemplateSettings = (templateName, settings) => api.post(`/template/${templateName}/settings`, settings);

export const getStats = () => api.get('/stats');

// Template Management
export const getTemplates = () => api.get('/templates');
export const deleteTemplate = (name) => api.delete(`/template/${name}`);
export const saveCampaign = (name, template) => api.post('/campaigns/archive', { name, template });
export const getCampaigns = () => api.get('/campaigns');
export const uploadTemplate = (file) => {
  const formData = new FormData();
  formData.append('template', file);
  return api.post('/templates', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

export const uploadDesign = (file) => {
  const formData = new FormData();
  formData.append('design', file);
  return api.post('/templates/design', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

export const getSmtpSettings = () => api.get('/settings/smtp');
export const saveSmtpSettings = (settings) => api.post('/settings/smtp', settings);

export const getParticipants = () => api.get('/participants');

export default api;
