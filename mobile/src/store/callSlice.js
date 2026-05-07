import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  callStatus: 'idle',
  callType: 'video',
  callerName: '',
  callerId: null,
  callerInfo: { name: '', avatar: null }, // Thêm cái này
  incomingSignal: null,
  agoraConfig: null,
  remoteUsers: [],
  duration: 0,
  camOn: true,
  micOn: true,
};

const callSlice = createSlice({
  name: 'call',
  initialState,
  reducers: {
    setCallStatus: (state, action) => { state.callStatus = action.payload; },
    setCallType: (state, action) => { state.callType = action.payload; },
    setCallerInfo: (state, action) => {
      state.callerName = action.payload.name;
      state.callerId = action.payload.id;
      state.callerInfo = action.payload; // Lưu toàn bộ vào đây
    },
    setIncomingSignal: (state, action) => { 
      state.incomingSignal = action.payload;
      state.callStatus = 'incoming';
    },
    setAgoraConfig: (state, action) => { state.agoraConfig = action.payload; },
    setRemoteUsers: (state, action) => { state.remoteUsers = action.payload; },
    setDuration: (state, action) => { state.duration = action.payload; },
    setCamOn: (state, action) => { state.camOn = action.payload; },
    setMicOn: (state, action) => { state.micOn = action.payload; },
    resetCall: (state) => { return { ...initialState }; },
  },
});

export const {
  setCallStatus, setCallType, setCallerInfo, setIncomingSignal,
  setAgoraConfig, setRemoteUsers, setDuration, setCamOn, setMicOn, resetCall
} = callSlice.actions;
export default callSlice.reducer;
