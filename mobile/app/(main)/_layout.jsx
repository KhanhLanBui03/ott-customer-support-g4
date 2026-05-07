import React, { useEffect, useRef } from 'react';
import { Tabs } from 'expo-router';
import { View, Text, Platform, Animated, Dimensions, TouchableOpacity } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { initializeSocket, disconnectSocket } from '../../src/utils/socket';
import { addMessage, setCurrentUserId, fetchConversations } from '../../src/store/chatSlice';
import { addNotification } from '../../src/store/notificationSlice';
import { useAgoraCall } from '../../src/hooks/useAgoraCall';
import VideoCall from '../../src/components/VideoCall';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TAB_BAR_WIDTH = SCREEN_WIDTH - 32;
const TAB_WIDTH = TAB_BAR_WIDTH / 4;

export default function MainLayout() {
  const { accessToken, user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const { unreadCount } = useSelector((state) => state.notifications);
  const badgeValue = unreadCount > 0 ? (unreadCount > 5 ? '5+' : unreadCount) : null;

  useEffect(() => {
    if (accessToken && (user?.userId || user?.id)) {
      const myId = user.userId || user.id;
      dispatch(setCurrentUserId(String(myId)));
      initializeSocket(accessToken, myId, (event) => {
        const { eventType, conversationId, payload } = event;
        if (eventType === 'MESSAGE_SEND') {
          dispatch(addMessage({ conversationId, message: payload, myId }));
        } else if (eventType === 'CONVERSATION_UPDATE') {
          dispatch(fetchConversations());
        } else if (eventType === 'NOTIFICATION' || eventType === 'FRIEND_REQUEST' || eventType === 'FRIEND_ACCEPT' || eventType === 'GROUP_INVITE') {
          let finalPayload = payload;
          if (eventType === 'FRIEND_REQUEST') {
            finalPayload = { id: `fr_${Date.now()}`, title: 'Lời mời kết bạn', message: payload.fullName || 'Ai đó', subMessage: 'muốn kết bạn với bạn', type: 'FRIEND_REQUEST', senderId: payload.userId, avatarUrl: payload.avatarUrl, fullName: payload.fullName, createdAt: new Date().toISOString(), isRead: false };
          } else if (eventType === 'FRIEND_ACCEPT') {
            finalPayload = { id: `fa_${Date.now()}`, title: 'Chấp nhận kết bạn', message: payload.fullName || 'Ai đó', subMessage: 'đã chấp nhận lời mời kết bạn', type: 'FRIEND_ACCEPT', senderId: payload.userId, avatarUrl: payload.avatarUrl, fullName: payload.fullName, createdAt: new Date().toISOString(), isRead: false };
          } else if (eventType === 'GROUP_INVITE') {
            finalPayload = { id: `gi_${Date.now()}`, title: 'Lời mời vào nhóm', message: payload.groupName || 'Nhóm mới', subMessage: `được mời bởi ${payload.inviterName || 'ai đó'}`, type: 'GROUP_INVITE', invitationId: payload.invitationId, conversationId: payload.conversationId, senderId: payload.inviterId, avatarUrl: payload.groupAvatar, fullName: payload.groupName, createdAt: new Date().toISOString(), isRead: false };
          }
          dispatch(addNotification(finalPayload));
        }
      });
    }
    return () => disconnectSocket();
  }, [accessToken, user?.userId, user?.id]);

  // Global Call Integration
  const {
    callStatus, callType, callerName, callerInfo, incomingSignal, duration, formatDuration,
    camOn, micOn, remoteUsers, setRemoteUsers, acceptCall, endCall, connect: connectCall,
    toggleMic, toggleCamera, agoraConfig
  } = useAgoraCall(null, null);

  useEffect(() => {
    if (accessToken) {
      const disconnect = connectCall();
      return () => disconnect?.();
    }
  }, [accessToken, connectCall]);

  const handleAcceptCall = () => acceptCall(incomingSignal);
  const handleHangup = () => {
    let reason = 'ENDED';
    if (callStatus === 'incoming') reason = 'REJECTED';
    else if (callStatus === 'outgoing') reason = 'MISSED';
    endCall(true, reason);
  };

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        tabBar={(props) => <CustomTabBar {...props} badge={badgeValue} />}
        screenOptions={{ headerShown: false }}
      >
      <Tabs.Screen name="index" options={{ title: 'Tin nhắn', icon: 'chatbubble' }} />
      <Tabs.Screen name="contacts" options={{ title: 'Danh bạ', icon: 'people' }} />
      <Tabs.Screen name="notifications" options={{ title: 'Thông báo', icon: 'notifications' }} />
      <Tabs.Screen name="profile" options={{ title: 'Cá nhân', icon: 'person' }} />

      <Tabs.Screen name="edit-profile" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="change-password" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="chat/[id]" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="chat-info/[id]" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="shared-media/[id]" options={{ href: null, tabBarStyle: { display: 'none' } }} />
        <Tabs.Screen name="shared-files/[id]" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      </Tabs>

      <VideoCall
        callStatus={callStatus}
        callType={callType}
        callerName={callerName}
        duration={duration}
        formatDuration={formatDuration}
        camOn={camOn}
        micOn={micOn}
        remoteUsers={remoteUsers}
        setRemoteUsers={setRemoteUsers}
        onAccept={handleAcceptCall}
        onHangup={handleHangup}
        onToggleMic={toggleMic}
        onToggleCamera={toggleCamera}
        callerInfo={callerInfo}
        agoraConfig={agoraConfig}
      />
    </View>
  );
}

const CustomTabBar = ({ state, descriptors, navigation, badge }) => {
  const focusedOptions = descriptors[state.routes[state.index].key].options;

  if (focusedOptions.tabBarStyle?.display === 'none') {
    return null;
  }

  const translateX = useRef(new Animated.Value(0)).current;

  // Danh sách các Tab được phép hiển thị (Whitelist)
  const allowedTabs = ['index', 'contacts', 'notifications', 'profile'];

  // Ánh xạ các màn hình phụ về Tab chính để giữ trạng thái Active
  const routeMap = {
    'edit-profile': 'profile',
    'change-password': 'profile',
    // Thêm các ánh xạ khác nếu cần
  };

  // Lọc lấy các route nằm trong danh sách cho phép
  const visibleRoutes = state.routes.filter(route => allowedTabs.includes(route.name));

  // Tìm tên Tab chính dựa trên route hiện tại
  const currentRouteName = state.routes[state.index].name;
  const activeTabName = routeMap[currentRouteName] || currentRouteName;

  // Tìm index thực tế trong danh sách 4 Tab hiển thị
  const activeIndex = visibleRoutes.findIndex(route => route.name === activeTabName);

  const actualTabWidth = TAB_BAR_WIDTH / visibleRoutes.length;

  useEffect(() => {
    if (activeIndex >= 0) {
      Animated.spring(translateX, {
        toValue: activeIndex * actualTabWidth,
        useNativeDriver: true,
        friction: 8,
        tension: 40,
      }).start();
    }
  }, [activeIndex]);

  const pathData = `M 0 0 
    L ${actualTabWidth / 2 - 35} 0 
    C ${actualTabWidth / 2 - 20} 0 ${actualTabWidth / 2 - 15} 30 ${actualTabWidth / 2} 30 
    C ${actualTabWidth / 2 + 15} 30 ${actualTabWidth / 2 + 20} 0 ${actualTabWidth / 2 + 35} 0 
    L ${actualTabWidth} 0 
    L ${actualTabWidth} 70 
    L 0 70 
    Z`;

  return (
    <View style={styles.tabBarContainer}>
      <View style={styles.tabBarInner}>
        {/* Dải nền liên tục màu Tối sâu (Dark Slate) */}
        <Animated.View style={[styles.slidingBackground, { transform: [{ translateX }] }]}>
          <View style={styles.leftFill} />
          <Svg width={actualTabWidth} height={70} viewBox={`0 0 ${actualTabWidth} 70`}>
            <Path d={pathData} fill="#111827" />
          </Svg>
          <View style={styles.rightFill} />
        </Animated.View>
      </View>

      <View style={styles.itemsContainer}>
        {visibleRoutes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = activeIndex === index;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={styles.tabItem}
              activeOpacity={1}
            >
              <TabIcon
                name={options.icon}
                focused={isFocused}
                title={options.title}
                badge={route.name === 'notifications' ? badge : null}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const TabIcon = ({ name, focused, title, badge }) => {
  const translateY = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: focused ? -28 : 0,
        useNativeDriver: true,
        friction: 8,
      }),
      Animated.spring(iconScale, {
        toValue: focused ? 1.15 : 1,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: focused ? 1 : 0,
        duration: 250,
        useNativeDriver: true,
      })
    ]).start();
  }, [focused]);

  return (
    <View style={styles.iconWrapper}>
      <Animated.View style={[
        styles.circle,
        {
          transform: [{
            translateY: translateY.interpolate({
              inputRange: [-28, 0],
              outputRange: [-32, 0]
            })
          }],
          opacity: opacity,
          backgroundColor: '#6366f1' // Vòng tròn màu Indigo từ web
        }
      ]} />
      <Animated.View style={{ transform: [{ translateY }, { scale: iconScale }], alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons
          name={focused ? `${name}` : `${name}-outline`}
          size={24}
          color={focused ? '#ffffff' : '#94a3b8'} // Trắng khi chọn, Xám khi không
        />
        {badge && (
          <View style={styles.tabBadge}>
            <Text style={styles.tabBadgeText}>{badge}</Text>
          </View>
        )}
      </Animated.View>
      <Animated.Text style={[styles.tabTitle, {
        opacity,
        transform: [{
          translateY: opacity.interpolate({
            inputRange: [0, 1],
            outputRange: [10, 0]
          })
        }]
      }]}>
        {title}
      </Animated.Text>
    </View>
  );
};

const styles = {
  tabBarContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 34 : 20,
    left: 16,
    right: 16,
    height: 70,
    backgroundColor: 'transparent',
  },
  tabBarInner: {
    position: 'absolute',
    bottom: 0,
    height: 70,
    width: TAB_BAR_WIDTH,
    borderRadius: 35,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  slidingBackground: {
    flexDirection: 'row',
    position: 'absolute',
    left: -TAB_BAR_WIDTH,
    width: TAB_BAR_WIDTH * 3,
    height: 70,
  },
  leftFill: {
    width: TAB_BAR_WIDTH,
    height: 70,
    backgroundColor: '#111827',
  },
  rightFill: {
    width: TAB_BAR_WIDTH * 2,
    height: 70,
    backgroundColor: '#111827',
  },
  itemsContainer: {
    flexDirection: 'row',
    height: 70,
    width: TAB_BAR_WIDTH,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 70,
    width: TAB_WIDTH,
  },
  circle: {
    position: 'absolute',
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#6366f1',
    top: 10,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  tabTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
    position: 'absolute',
    bottom: 8,
  },
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#ef4444',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
    zIndex: 10,
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: 'bold',
  }
};
