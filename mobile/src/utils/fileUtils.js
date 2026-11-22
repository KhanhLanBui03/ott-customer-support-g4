import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

export const openFile = async (url, fileName) => {
  try {
    const safeName = (fileName || `file_${Date.now()}`).replace(/[\\/]/g, '_');
    const targetFile = new File(Paths.cache, safeName);

    // Kiểm tra xem file đã tồn tại trong cache chưa
    if (!targetFile.exists) {
      console.log(`[FileUtil] Downloading: ${url} to ${targetFile.uri}`);
      await File.downloadFileAsync(url, targetFile, { idempotent: true });
    }

    // Mở file bằng menu hệ thống
    const isAvailable = await Sharing.isAvailableAsync();
    // Mở file bằng Sharing (trên iOS sẽ mở Quick Look preview, trên Android sẽ hiện danh sách app có thể mở)
    if (isAvailable) {
      await Sharing.shareAsync(targetFile.uri, {
        mimeType: getMimeType(safeName),
        dialogTitle: `Mở file: ${safeName}`,
        UTI: getUTI(safeName), // Thêm UTI cho iOS để mở preview chuẩn hơn
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
export const downloadFile = async (url, fileName) => {
  try {
    const safeName = (fileName || `file_${Date.now()}`).replace(/[\\/]/g, '_');
    const targetFile = new File(Paths.cache, safeName);
    
    // Download to cache if not exists
    if (!targetFile.exists) {
      await File.downloadFileAsync(url, targetFile, { idempotent: true });
    }

    // Trigger system sharing to allow "Save to Files"
    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(targetFile.uri);
    } else {
      Alert.alert('Lỗi', 'Thiết bị không hỗ trợ lưu tệp tin.');
    }
  } catch (error) {
    console.error('[FileUtil] Download error:', error);
    Alert.alert('Lỗi', 'Không thể tải tệp tin.');
  }
};
