import axiosClient from './axiosClient';

export const myCloudApi = {
  uploadFile: (file, fileName, metadata = {}) => {
    const formData = new FormData();
    if (fileName) {
      formData.append('file', file, fileName);
    } else {
      formData.append('file', file);
    }
    Object.entries(metadata).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        formData.append(key, value);
      }
    });
    return axiosClient.post('/my-cloud/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getFile: (fileId) => axiosClient.get(`/my-cloud/${fileId}`),
  listFiles: (params) => axiosClient.get('/my-cloud', { params }),
  deleteFile: (fileId) => axiosClient.delete(`/my-cloud/${fileId}`),
};
