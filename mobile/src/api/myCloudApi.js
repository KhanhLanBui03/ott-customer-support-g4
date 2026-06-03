import axiosClient from './axiosClient';

export const myCloudApi = {
  uploadFile: (formData) => {
    return axiosClient.post('/my-cloud/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getFile: (fileId) => axiosClient.get(`/my-cloud/${fileId}`),
  listFiles: (params) => axiosClient.get('/my-cloud', { params }),
  deleteFile: (fileId) => axiosClient.delete(`/my-cloud/${fileId}`),
};

export default myCloudApi;
