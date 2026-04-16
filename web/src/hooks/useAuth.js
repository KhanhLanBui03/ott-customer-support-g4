import { useDispatch } from 'react-redux';
import { setCredentials, logout as logoutAction } from '../store/authSlice';
import { authApi } from '../api/authApi';

export const useAuth = () => {
  const dispatch = useDispatch();

  const login = async (credentials) => {
    const response = await authApi.login(credentials);
    const data = response.data || response;
    
    // The backend returns a flattened LoginResponse with accessToken and user info
    const authData = {
      token: data.accessToken,
      user: {
        id: data.userId,
        phoneNumber: data.phoneNumber,
        fullName: data.fullName,
        avatar: data.avatar
      }
    };
    
    dispatch(setCredentials(authData));
    return authData;
  };

  const register = async (userData) => {
    const response = await authApi.register(userData);
    const data = response.data || response;
    
    const authData = {
      token: data.accessToken,
      user: {
        id: data.userId,
        phoneNumber: data.phoneNumber,
        fullName: data.fullName,
        avatar: data.avatar
      }
    };
    
    dispatch(setCredentials(authData));
    return authData;
  };

  const logout = () => {
    dispatch(logoutAction());
  };

  return { login, register, logout };
};
