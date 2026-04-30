import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

export const openFile = async (url, fileName) => {
  try {
    const fileUri = FileSystem.cacheDirectory + fileName;
    
    // Kiểm tra xem file đã tồn tại trong cache chưa
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    
    if (!fileInfo.exists) {
      console.log(`[FileUtil] Downloading: ${url} to ${fileUri}`);
      const downloadRes = await FileSystem.downloadAsync(url, fileUri);
      if (downloadRes.status !== 200) {
        throw new Error('Download failed');
      }
    }

    // Mở file bằng menu hệ thống
    const isAvailable = await Sharing.isAvailableAsync();
    // Mở file bằng Sharing (trên iOS sẽ mở Quick Look preview, trên Android sẽ hiện danh sách app có thể mở)
    if (isAvailable) {
      await Sharing.shareAsync(fileUri, {
        mimeType: getMimeType(fileName),
        dialogTitle: `Mở file: ${fileName}`,
        UTI: getUTI(fileName), // Thêm UTI cho iOS để mở preview chuẩn hơn
      });
    } else {
      Alert.alert('Thông báo', 'Thiết bị của bạn không hỗ trợ mở tệp tin này.');
    }
  } catch (error) {
    console.error('[FileUtil] Error:', error);
    Alert.alert('Lỗi', 'Không thể mở tệp tin. Vui lòng thử lại sau.');
  }
};

const getMimeType = (fileName) => {
  const ext = fileName.split('.').pop().toLowerCase();
  switch (ext) {
    case 'pdf': return 'application/pdf';
    case 'doc':
    case 'docx': return 'application/msword';
    case 'xls':
    case 'xlsx': return 'application/vnd.ms-excel';
    case 'zip': return 'application/zip';
    case 'rar': return 'application/x-rar-compressed';
    default: return 'application/octet-stream';
  }
};

const getUTI = (fileName) => {
  const ext = fileName.split('.').pop().toLowerCase();
  switch (ext) {
    case 'pdf': return 'com.adobe.pdf';
    case 'docx': return 'org.openxmlformats.wordprocessingml.document';
    case 'xlsx': return 'org.openxmlformats.spreadsheetml.sheet';
    default: return undefined;
  }
};
