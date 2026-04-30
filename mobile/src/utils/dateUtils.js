/**
 * Formats the last seen time relative to now, similar to the web version.
 * @param {string} status - 'ONLINE' or other
 * @param {number|string|Date} lastSeenAt - The timestamp of last activity
 * @returns {string} - Formatted status string
 */
export const formatLastSeen = (status, lastSeenAt) => {
  if (String(status).toUpperCase() === 'ONLINE') return 'Đang hoạt động';
  
  if (!lastSeenAt) return 'Ngoại tuyến';
  
  try {
    const lastSeenDate = new Date(lastSeenAt);
    const lastSeenTime = lastSeenDate.getTime();
    
    if (isNaN(lastSeenTime)) return 'Ngoại tuyến';
    
    const now = Date.now();
    const diff = Math.floor((now - lastSeenTime) / 1000); // seconds
    
    if (diff < 60) return 'Vừa mới truy cập';
    
    if (diff < 3600) {
      const mins = Math.floor(diff / 60);
      return `Hoạt động ${mins} phút trước`;
    }
    
    if (diff < 86400) {
      const hours = Math.floor(diff / 3600);
      return `Hoạt động ${hours} giờ trước`;
    }
    
    const days = Math.floor(diff / 86400);
    if (days < 7) {
      return `Hoạt động ${days} ngày trước`;
    }
    
    // For more than a week, show the date
    return `Hoạt động từ ${lastSeenDate.toLocaleDateString()}`;
  } catch (e) {
    return 'Ngoại tuyến';
  }
};
