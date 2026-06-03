import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Camera, CameraView } from 'expo-camera';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../src/context/ThemeContext';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useSelector } from 'react-redux';
import CONFIG from '../../src/config';

export default function QrScannerScreen() {
  const { t } = useTranslation();
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const token = useSelector((state) => state.auth.accessToken);

  const [showConfirm, setShowConfirm] = useState(false);
  const [scannedData, setScannedData] = useState(null);
  const [scanTime, setScanTime] = useState('');
  const [scannedUserAgent, setScannedUserAgent] = useState('Chrome - Windows');

  useFocusEffect(
    useCallback(() => {
      // Reset all scanner and confirm screen states when this tab becomes active/focused
      setScanned(false);
      setShowConfirm(false);
      setScannedData(null);
      setScanTime('');
      setScannedUserAgent('Chrome - Windows');
    }, [])
  );
  
  useEffect(() => {
    const getCameraPermissions = async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    };

    getCameraPermissions();
  }, []);

  const handleBarCodeScanned = async ({ type, data }) => {
    setScanned(true);
    
    if (data && data.startsWith('GROUP_JOIN:')) {
      const conversationId = data.replace('GROUP_JOIN:', '');
      router.push({
        pathname: '/(main)/group-preview',
        params: { conversationId }
      });
      return;
    }
    
    // Check if the data is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (!uuidRegex.test(data)) {
      Alert.alert(t('common.error'), t('chat.invalid_qr'), [
        { text: t('chat.scan_again'), onPress: () => setScanned(false) }
      ]);
      return;
    }
    
    try {
      // Step 1: Scan the QR token on backend
      const response = await axios.post(`${CONFIG.API_URL}/auth/qr/scan/${data}`, {}, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.data.success) {
        const { data: resData } = response.data;
        // Format current date & time
        const now = new Date();
        const formatTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} - ${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
        
        setScanTime(formatTime);
        setScannedUserAgent(resData.userAgent || 'Chrome - Windows');
        setScannedData(data);
        setShowConfirm(true);
      }
    } catch (err) {
      console.log('Error scanning QR:', err);
      Alert.alert(t('common.error'), t('auth.errors.session_expired'), [
        { text: 'OK', onPress: () => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(main)');
          }
        }}
      ]);
    }
  };

  const handleConfirmLogin = async () => {
    try {
      const response = await axios.post(`${CONFIG.API_URL}/auth/qr/confirm/${scannedData}`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.data.success) {
        Alert.alert(t('common.success'), t('auth.qr_login_success'), [
          { text: 'OK', onPress: () => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(main)');
            }
          }}
        ]);
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || t('auth.errors.generic_error');
      Alert.alert(t('common.error'), errorMsg, [
        { text: 'OK', onPress: () => {
          setShowConfirm(false);
          setScanned(false);
        } }
      ]);
    }
  };

  const handleCancelLogin = async () => {
    try {
      await axios.post(`${CONFIG.API_URL}/auth/qr/cancel/${scannedData}`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (err) {
      console.log('Error canceling login:', err);
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(main)');
    }
  };

  if (hasPermission === null) {
    return <View style={[styles.container, { backgroundColor: colors.background }]} />;
  }
  if (hasPermission === false) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.foreground }}>{t('chat.no_camera_permission')}</Text>
        <TouchableOpacity style={styles.button} onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(main)');
          }
        }}>
          <Text style={styles.buttonText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (showConfirm) {
    return (
      <View style={[styles.confirmContainer, { backgroundColor: isDark ? '#121212' : '#fff' }]}>
        <View style={styles.confirmContent}>
          {/* Monitor Graphic */}
          <View style={styles.monitorWrapper}>
            <View style={[styles.monitorBox, { backgroundColor: isDark ? '#1e1e1e' : '#f5f5f5' }]}>
              <MaterialCommunityIcons name="monitor" size={80} color={isDark ? '#40a9ff' : '#007bff'} />
              <View style={styles.alertBadge}>
                <MaterialCommunityIcons name="alert" size={14} color="#fff" />
              </View>
            </View>
          </View>

          {/* Title */}
          <Text style={[styles.confirmTitle, { color: colors.foreground }]}>
            {t('auth.qr_confirm_title')}
          </Text>

          {/* Warning banner */}
          <View style={[styles.warningBox, { 
            backgroundColor: isDark ? '#2a1215' : '#fff2f0',
            borderColor: isDark ? '#5c1d24' : '#ffccc7'
          }]}>
            <Text style={[styles.warningText, { color: isDark ? '#ff7875' : '#ff4d4f' }]}>
              <Text style={{ fontWeight: 'bold' }}>{t('common.warning')}: </Text>
              {t('auth.qr_warning_desc')} <Text style={{ fontWeight: 'bold' }}>{t('chat.stranger_bar.decline')}</Text> {t('auth.qr_warning_hint')}
            </Text>
          </View>

          {/* Details */}
          <View style={styles.detailsList}>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: isDark ? '#aaa' : '#666' }]}>{t('common.browser')}:</Text>
              <Text style={[styles.detailValue, { color: colors.foreground }]}>{scannedUserAgent}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: isDark ? '#aaa' : '#666' }]}>{t('common.time')}:</Text>
              <Text style={[styles.detailValue, { color: colors.foreground }]}>{scanTime}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: isDark ? '#aaa' : '#666' }]}>{t('common.location')}:</Text>
              <Text style={[styles.detailValue, { color: colors.foreground }]}>Hồ Chí Minh, Việt Nam</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.confirmActions}>
          <TouchableOpacity 
            style={[styles.primaryButton, { backgroundColor: '#007AFF' }]} 
            onPress={handleConfirmLogin}
          >
            <Text style={styles.primaryButtonText}>{t('auth.login')}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.secondaryButton, { backgroundColor: isDark ? '#333' : '#f3f4f6' }]} 
            onPress={handleCancelLogin}
          >
            <Text style={[styles.secondaryButtonText, { color: isDark ? '#fff' : '#1f2937' }]}>{t('chat.stranger_bar.decline')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
        style={StyleSheet.absoluteFillObject}
      />
      
      <View style={styles.overlay}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(main)');
              }
            }}
            style={styles.backButton}
          >
            <MaterialCommunityIcons name="arrow-left" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>{t('chat.scan_qr')}</Text>
          <View style={{ width: 28 }} />
        </View>
        
        <View style={styles.scanArea}>
          <View style={styles.scanTarget}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
          <Text style={styles.instructions}>{t('chat.scan_instructions')}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  backButton: {
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  scanArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanTarget: {
    width: 250,
    height: 250,
    backgroundColor: 'transparent',
    position: 'relative',
    marginBottom: 40,
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#4ade80',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 10,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 10,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 10,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 10,
  },
  instructions: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  button: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  confirmContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  confirmContent: {
    alignItems: 'center',
    gap: 24,
  },
  monitorWrapper: {
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monitorBox: {
    width: 140,
    height: 140,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  alertBadge: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ff4d4f',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingHorizontal: 10,
    lineHeight: 28,
  },
  warningBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 8,
  },
  warningText: {
    fontSize: 14,
    lineHeight: 20,
  },
  detailsList: {
    width: '100%',
    paddingHorizontal: 8,
    gap: 16,
    marginTop: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  detailLabel: {
    fontSize: 15,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  confirmActions: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
