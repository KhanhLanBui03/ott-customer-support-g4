import { createSlice } from '@reduxjs/toolkit';
import { clearAuthValues, getAuthValue, getAuthPersist, setAuthValues } from '../utils/storage';

const initialState = {
  user: JSON.parse(getAuthValue('user') || 'null'),
  token: getAuthValue('token') || null,
  refreshToken: getAuthValue('refreshToken') || null,
  sessionId: getAuthValue('sessionId') || null,
  isAuthenticated: !!getAuthValue('token'),
  rememberMe: getAuthPersist(),
  loading: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.refreshToken = action.payload.refreshToken || null;
      state.sessionId = action.payload.sessionId || null;
      state.isAuthenticated = true;
      state.rememberMe = action.payload.rememberMe ?? state.rememberMe;

      setAuthValues(
        {
          token: action.payload.token,
          refreshToken: action.payload.refreshToken || null,
          sessionId: action.payload.sessionId || null,
          user: JSON.stringify(action.payload.user),
        },
        state.rememberMe,
      );
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.refreshToken = null;
      state.sessionId = null;
      state.isAuthenticated = false;
      clearAuthValues();
    },
    updateUser: (state, action) => {
      state.user = { ...state.user, ...action.payload };
      setAuthValues(
        {
          token: state.token,
          refreshToken: state.refreshToken,
          sessionId: state.sessionId,
          user: JSON.stringify(state.user),
        },
        state.rememberMe,
      );
    },
  },
});

export const { setCredentials, logout, updateUser } = authSlice.actions;
export default authSlice.reducer;
