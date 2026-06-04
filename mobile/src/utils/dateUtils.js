import i18n from '../locales/i18n';

/**
 * Formats the last seen time relative to now, similar to the web version.
 * @param {string} status - 'ONLINE' or other
 * @param {number|string|Date} lastSeenAt - The timestamp of last activity
 * @returns {string} - Formatted status string
 */
export const formatLastSeen = (status, lastSeenAt) => {
  if (String(status).toUpperCase() === 'ONLINE') return i18n.t('chat.active_now');
  
  if (!lastSeenAt) return i18n.t('chat.offline');
  
  try {
    const lastSeenDate = new Date(lastSeenAt);
    const lastSeenTime = lastSeenDate.getTime();
    
    if (isNaN(lastSeenTime)) return i18n.t('chat.offline');
    
    const now = Date.now();
    const diff = Math.floor((now - lastSeenTime) / 1000); // seconds
    
    if (diff < 60) return i18n.t('chat.just_now');
    
    if (diff < 3600) {
      const mins = Math.floor(diff / 60);
      return i18n.t('chat.minutes_ago', { count: mins });
    }
    
    if (diff < 86400) {
      const hours = Math.floor(diff / 3600);
      return i18n.t('chat.hours_ago', { count: hours });
    }
    
    const days = Math.floor(diff / 86400);
    if (days < 7) {
      return i18n.t('chat.days_ago', { count: days });
    }
    
    // For more than a week, show the date
    return i18n.t('chat.active_since', { date: lastSeenDate.toLocaleDateString() });
  } catch (e) {
    return i18n.t('chat.offline');
  }
};

/**
 * Formats the date for the message list separators.
 * @param {number|string|Date} timestamp
 * @returns {string} - 'HÔM NAY', 'HÔM QUA', or 'MON DD, YYYY'
 */
export const formatMessageDateSeparator = (timestamp) => {
  if (!timestamp) return '';
  
  try {
    const date = new Date(timestamp);
    const now = new Date();
    
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    if (msgDate.getTime() === today.getTime()) {
      return i18n.t('common.today').toUpperCase();
    } else if (msgDate.getTime() === yesterday.getTime()) {
      return i18n.t('common.yesterday').toUpperCase();
    } else {
      const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
    }
  } catch (e) {
    return '';
  }
};

