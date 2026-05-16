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
  activeConversationId: null,
  endCallReason: null,
  isGroup: false,
  countdown: 3,
  showCountdown: false,
};


const callSlice = createSlice({
  name: 'call',
  initialState,
  reducers: {
    setCallStatus: (state, action) => { state.callStatus = action.payload; },
    setCallType: (state, action) => { state.callType = action.payload; },
    setIsGroup: (state, action) => { state.isGroup = action.payload; },
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
    addRemoteUser: (state, action) => {
      const { uid, mediaType } = action.payload;
      const index = state.remoteUsers.findIndex(u => u.uid === uid);
      if (index !== -1) {
        state.remoteUsers[index] = { 
          ...state.remoteUsers[index], 
          hasVideo: mediaType === 'video' || state.remoteUsers[index].hasVideo 
        };
      } else {
        state.remoteUsers = [...state.remoteUsers, { uid, hasVideo: mediaType === 'video' }];
      }
    },

    updateRemoteUserVideo: (state, action) => {
        const { uid, hasVideo } = action.payload;
        state.remoteUsers = state.remoteUsers.map(u => 
          u.uid === uid ? { ...u, hasVideo } : u
        );
    },
    removeRemoteUser: (state, action) => {
      state.remoteUsers = state.remoteUsers.filter(u => u.uid !== action.payload);
    },
    setDuration: (state, action) => { state.duration = action.payload; },

    setCamOn: (state, action) => { state.camOn = action.payload; },
    setMicOn: (state, action) => { state.micOn = action.payload; },
    setActiveConversationId: (state, action) => { state.activeConversationId = action.payload; },
    setEndCallReason: (state, action) => { state.endCallReason = action.payload; },
    setCountdown: (state, action) => { state.countdown = action.payload; },
    setShowCountdown: (state, action) => { state.showCountdown = action.payload; },
    resetCall: (state) => { return { ...initialState }; },

  },
});

export const {
  setCallStatus, setCallType, setIsGroup, setCallerInfo, setIncomingSignal,
  setAgoraConfig, setRemoteUsers, addRemoteUser, removeRemoteUser, updateRemoteUserVideo,
  setDuration, setCamOn, setMicOn, setActiveConversationId, setEndCallReason, 
  setCountdown, setShowCountdown, resetCall
} = callSlice.actions;



export default callSlice.reducer;
