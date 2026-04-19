import { useDispatch, useSelector } from 'react-redux';
import { setCredentials, logout as logoutAction } from '../store/authSlice';
import { authApi } from '../api/authApi';

export const useAuth = () => {
  const dispatch = useDispatch();
  const { user, token, isAuthenticated, loading } = useSelector((state) => state.auth);

  const login = async (credentials) => {
    const response = await authApi.login(credentials);
    const data = response.data || response;
    
    // The backend returns a flattened LoginResponse with accessToken and user info
    const authData = {
      token: data.accessToken,
      user: {
        id: data.userId,
        phoneNumber: data.phoneNumber,
        firstName: data.firstName,
        lastName: data.lastName,
        fullName: data.fullName || (data.firstName || data.lastName ? `${data.lastName} ${data.firstName}`.trim() : data.phoneNumber),
        avatar: data.avatarUrl || data.avatar,
        bio: data.bio,
        email: data.email
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
        firstName: data.firstName,
        lastName: data.lastName,
        fullName: data.fullName || (data.firstName || data.lastName ? `${data.lastName} ${data.firstName}`.trim() : data.phoneNumber),
        avatar: data.avatarUrl || data.avatar,
        bio: data.bio,
        email: data.email
      }
    };
    
    dispatch(setCredentials(authData));
    return authData;
  };

  const logout = () => {
    dispatch(logoutAction());
  };

  return { user, token, isAuthenticated, loading, login, register, logout };
};
