/**
 * Utility to dynamically translate notification messages and titles stored in Vietnamese format in the database
 * to the user's active locale.
 */
export const translateNotificationMessage = (message, t) => {
  if (!message) return '';

  const str = String(message).trim();

  // 1. [Name] đã gửi lời mời kết bạn.
  if (str.endsWith(' đã gửi lời mời kết bạn.')) {
    const name = str.substring(0, str.length - ' đã gửi lời mời kết bạn.'.length);
    return t('notifications.friend_request_msg', { name });
  }

  // 2. [Name] đã chấp nhận lời mời kết bạn.
  if (str.endsWith(' đã chấp nhận lời mời kết bạn.')) {
    const name = str.substring(0, str.length - ' đã chấp nhận lời mời kết bạn.'.length);
    return t('notifications.friend_accepted_msg', { name });
  }

  // 3. [Name] đã từ chối lời mời kết bạn.
  if (str.endsWith(' đã từ chối lời mời kết bạn.')) {
    const name = str.substring(0, str.length - ' đã từ chối lời mời kết bạn.'.length);
    return t('notifications.friend_rejected_msg', { name });
  }

  // 4. Bạn đã trở thành bạn bè của [Name] / Bạn đã trở thành bạn bè với [Name]
  if (str.startsWith('Bạn đã trở thành bạn bè của ')) {
    const name = str.substring('Bạn đã trở thành bạn bè của '.length);
    return t('friends.accepted_notif', { name });
  }
  if (str.startsWith('Bạn đã trở thành bạn bè với ')) {
    const name = str.substring('Bạn đã trở thành bạn bè với '.length);
    return t('friends.accepted_notif', { name });
  }

  // 5. Bạn đã bị từ chối vô nhóm [GroupName] / Bạn đã bị từ chối vào nhóm [GroupName]
  if (str.startsWith('Bạn đã bị từ chối vô nhóm ')) {
    const groupName = str.substring('Bạn đã bị từ chối vô nhóm '.length);
    return t('notifications.group_join_rejected', { groupName });
  }
  if (str.startsWith('Bạn đã bị từ chối vào nhóm ')) {
    const groupName = str.substring('Bạn đã bị từ chối vào nhóm '.length);
    return t('notifications.group_join_rejected', { groupName });
  }

  return message;
};

export const translateNotificationTitle = (title, t) => {
  if (!title) return '';

  const str = String(title).trim();

  if (str === 'Chấp nhận kết bạn') {
    return t('notifications.title_friend_accept');
  }
  if (str === 'Lời mời kết bạn') {
    return t('notifications.title_friend_request');
  }
  if (str === 'Lời mời vào nhóm') {
    return t('notifications.title_group_invite');
  }
  if (str === 'Từ chối kết bạn') {
    return t('notifications.title_friend_decline');
  }

  return title;
};
