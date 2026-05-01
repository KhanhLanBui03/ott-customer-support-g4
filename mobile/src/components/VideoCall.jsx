import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, SafeAreaView, Platform } from 'react-native';
import { RtcSurfaceView } from 'react-native-agora';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

// Một Component đơn giản cho Avatar hoặc initial
const Avatar = ({ nameInitial, style }) => (
    <View style={[styles.avatarContainer, style]}>
        <Text style={styles.avatarText}>{nameInitial || '?'}</Text>
    </View>
);

const RemoteVideoPlayer = ({ uid, name, isAudioCall, fullscreen = false }) => {
    return (
        <View style={[styles.remoteVideoContainer, fullscreen && styles.fullscreenVideo]}>
            {isAudioCall ? (
                <View style={styles.audioOnlyContainer}>
                    <Avatar nameInitial={name?.[0]?.toUpperCase()} />
                </View>
            ) : (
                <RtcSurfaceView canvas={{ uid }} style={styles.surfaceView} />
            )}
            <View style={styles.nameTag}>
                <Text style={styles.nameTagText} numberOfLines={1}>{name || 'Người dùng'}</Text>
            </View>
        </View>
    );
};

export default function VideoCall({ 
    callStatus, 
    callType, 
    callerName, 
    duration, 
    formatDuration,
    camOn, 
    micOn, 
    remoteUsers, 
    onAccept, 
    onHangup, 
    onToggleMic, 
    onToggleCamera,
    remoteInfo 
}) {
    if (callStatus === 'idle') return null;

    const isOutgoing = callStatus === 'outgoing';
    const isIncoming = callStatus === 'incoming';
    const isConnected = callStatus === 'connected' || callStatus === 'ended';

    const displayName = isIncoming ? callerName : remoteInfo?.name || 'Người dùng';
    const initial = displayName?.[0]?.toUpperCase() || '?';

    return (
        <SafeAreaView style={styles.container}>
            {/* INCOMING */}
            {isIncoming && (
                <View style={styles.content}>
                    <View style={styles.headerInfo}>
                        <Text style={styles.callTypeTitle}>
                            {callType === 'audio' ? 'CUỘC GỌI THOẠI ĐẾN...' : 'CUỘC GỌI VIDEO ĐẾN...'}
                        </Text>
                        <Avatar nameInitial={initial} style={styles.largeAvatar} />
                        <Text style={styles.displayName}>{displayName}</Text>
                        <Text style={styles.subText}>Đang gọi cho bạn</Text>
                    </View>

                    <View style={styles.actionButtons}>
                        <TouchableOpacity style={[styles.btn, styles.btnReject]} onPress={onHangup}>
                            <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.btn, styles.btnAccept]} onPress={onAccept}>
                            <Ionicons name="call" size={28} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* OUTGOING */}
            {isOutgoing && (
                <View style={styles.content}>
                    <View style={styles.headerInfo}>
                        <Text style={styles.callTypeTitle}>ĐANG GỌI...</Text>
                        <Avatar nameInitial={initial} style={styles.largeAvatar} />
                        <Text style={styles.displayName}>{displayName}</Text>
                        <Text style={styles.subText}>Đang chờ phản hồi...</Text>
                    </View>

                    <View style={[styles.actionButtons, { justifyContent: 'center' }]}>
                        <TouchableOpacity style={[styles.btn, styles.btnReject]} onPress={onHangup}>
                            <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* CONNECTED */}
            {isConnected && (
                <View style={styles.connectedContainer}>
                    {/* Remote Streams */}
                    {remoteUsers.length > 1 ? (
                        <View style={styles.gridContainer}>
                            {remoteUsers.map(user => (
                                <RemoteVideoPlayer key={user.uid} uid={user.uid} name={user.name} isAudioCall={callType === 'audio'} />
                            ))}
                        </View>
                    ) : (
                        <View style={styles.singleContainer}>
                            {remoteUsers.length === 1 ? (
                                <RemoteVideoPlayer uid={remoteUsers[0].uid} name={remoteUsers[0].name} isAudioCall={callType === 'audio'} fullscreen />
                            ) : (
                                <View style={styles.audioOnlyContainer}>
                                    <Avatar nameInitial={initial} style={styles.largeAvatar} />
                                    <Text style={styles.displayName}>{displayName}</Text>
                                    <Text style={styles.subText}>Đang kết nối...</Text>
                                </View>
                            )}
                        </View>
                    )}

                    {/* Local Preview (PiP) */}
                    {callType === 'video' && remoteUsers.length > 0 && (
                        <View style={styles.pipContainer}>
                            {camOn ? (
                                <RtcSurfaceView canvas={{ uid: 0 }} style={styles.surfaceView} />
                            ) : (
                                <View style={styles.audioOnlyContainer}>
                                    <Ionicons name="videocam-off" size={24} color="rgba(255,255,255,0.3)" />
                                </View>
                            )}
                        </View>
                    )}

                    {/* Top Header */}
                    <View style={styles.topHeader}>
                        <Avatar nameInitial={initial} style={styles.smallAvatar} />
                        <View>
                            <Text style={styles.headerName}>{displayName}</Text>
                            <Text style={styles.headerTime}>{formatDuration()}</Text>
                        </View>
                    </View>

                    {/* Bottom Controls */}
                    <View style={styles.controlsContainer}>
                        <TouchableOpacity style={[styles.controlBtn, !micOn && styles.controlBtnOff]} onPress={onToggleMic}>
                            <Ionicons name={micOn ? "mic" : "mic-off"} size={24} color="#fff" />
                        </TouchableOpacity>
                        
                        {callType === 'video' && (
                            <TouchableOpacity style={[styles.controlBtn, !camOn && styles.controlBtnOff]} onPress={onToggleCamera}>
                                <Ionicons name={camOn ? "videocam" : "videocam-off"} size={24} color="#fff" />
                            </TouchableOpacity>
                        )}
                        
                        <TouchableOpacity style={[styles.controlBtn, styles.btnReject]} onPress={onHangup}>
                            <Ionicons name="call" size={24} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#1a1a2e',
        zIndex: 9999,
        elevation: 9999, // Cho Android
    },
    content: {
        flex: 1,
        justifyContent: 'space-between',
        paddingVertical: 60,
    },
    headerInfo: {
        alignItems: 'center',
        marginTop: 40,
    },
    callTypeTitle: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12,
        fontWeight: 'bold',
        letterSpacing: 2,
        marginBottom: 20,
    },
    avatarContainer: {
        backgroundColor: '#4c1d95',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 999,
        overflow: 'hidden',
    },
    avatarText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 24,
    },
    largeAvatar: {
        width: 120,
        height: 120,
        borderRadius: 60,
        marginBottom: 20,
    },
    smallAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    displayName: {
        color: '#fff',
        fontSize: 28,
        fontWeight: 'bold',
    },
    subText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 14,
        marginTop: 5,
    },
    actionButtons: {
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    btn: {
        width: 72,
        height: 72,
        borderRadius: 36,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 8,
    },
    btnAccept: {
        backgroundColor: '#10b981',
    },
    btnReject: {
        backgroundColor: '#ef4444',
    },
    connectedContainer: {
        flex: 1,
        position: 'relative',
    },
    gridContainer: {
        flex: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    singleContainer: {
        flex: 1,
    },
    remoteVideoContainer: {
        flexBasis: '50%', // 2 columns by default for grid
        height: '50%',
        position: 'relative',
        backgroundColor: '#000',
        borderWidth: 1,
        borderColor: '#333',
    },
    fullscreenVideo: {
        flexBasis: '100%',
        height: '100%',
        borderWidth: 0,
    },
    surfaceView: {
        flex: 1,
    },
    audioOnlyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1a1a2e',
    },
    nameTag: {
        position: 'absolute',
        bottom: 10,
        left: 10,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    nameTagText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '500',
    },
    pipContainer: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 50 : 30,
        right: 20,
        width: 100,
        height: 150,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#000',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        zIndex: 10,
    },
    topHeader: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 50 : 30,
        left: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        zIndex: 10,
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: 8,
        borderRadius: 30,
    },
    headerName: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    headerTime: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
    },
    controlsContainer: {
        position: 'absolute',
        bottom: 40,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 20,
        zIndex: 10,
    },
    controlBtn: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        backdropFilter: 'blur(10px)',
    },
    controlBtnOff: {
        backgroundColor: 'rgba(255,255,255,0.5)',
    }
});
