/**
 * Utility to dynamically translate system messages stored in Vietnamese format in the database
 * to the user's active locale.
 */
export const translateSystemMessage = (content, t) => {
  if (!content) return '';

  // Ensure content is a string
  const strContent = String(content).trim();

  // 1. Tạo nhóm (Group Creation)
  if (strContent.endsWith(' đã tạo nhóm.')) {
    const name = strContent.substring(0, strContent.length - ' đã tạo nhóm.'.length);
    return t('system_msg.created_group', { name });
  }

  // 2. Tham gia nhóm (Member Joined)
  if (strContent.endsWith(' vừa tham gia nhóm.')) {
    const name = strContent.substring(0, strContent.length - ' vừa tham gia nhóm.'.length);
    return t('system_msg.joined_group', { name });
  }

  // 3. Thay đổi ảnh đại diện nhóm (Avatar Changed)
  if (strContent.endsWith(' đã thay đổi ảnh đại diện nhóm.')) {
    const name = strContent.substring(0, strContent.length - ' đã thay đổi ảnh đại diện nhóm.'.length);
    return t('system_msg.changed_avatar', { name });
  }

  // 4. Đổi tên nhóm (Group Renamed)
  const renameMatch = strContent.match(/^(.+) đã đổi tên nhóm thành "(.+)"\.$/);
  if (renameMatch) {
    return t('system_msg.renamed_group', { name: renameMatch[1], groupName: renameMatch[2] });
  }

  // 5. Nhường quyền trưởng nhóm (Ownership Transferred)
  if (strContent.startsWith('Trưởng nhóm đã nhường quyền cho ') && strContent.endsWith('.')) {
    const name = strContent.substring('Trưởng nhóm đã nhường quyền cho '.length, strContent.length - 1);
    return t('system_msg.transfer_owner', { name });
  }

  // 6. Rời nhóm (Member Left)
  if (strContent.endsWith(' đã rời nhóm.')) {
    const name = strContent.substring(0, strContent.length - ' đã rời nhóm.'.length);
    return t('system_msg.left_group', { name });
  }

  // 7. Xóa thành viên (Member Removed)
  const removeMatch = strContent.match(/^(.+) đã xóa (.+) khỏi nhóm\.$/);
  if (removeMatch) {
    return t('system_msg.removed_member', { admin: removeMatch[1], member: removeMatch[2] });
  }

  // 8. Bổ nhiệm / giáng cấp (Role Promoted / Demoted)
  const promoteMatch = strContent.match(/^(.+) đã bổ nhiệm (.+) làm phó nhóm\.$/);
  if (promoteMatch) {
    return t('system_msg.promoted_admin', { admin: promoteMatch[1], member: promoteMatch[2] });
  }
  const demoteMatch = strContent.match(/^(.+) đã giáng cấp (.+) làm thành viên\.$/);
  if (demoteMatch) {
    return t('system_msg.demoted_member', { admin: demoteMatch[1], member: demoteMatch[2] });
  }

  // 9. Giới hạn chat (Chat restrictions toggle)
  if (strContent.endsWith(' đã bật chế độ giới hạn người có thể chat.')) {
    const name = strContent.substring(0, strContent.length - ' đã bật chế độ giới hạn người có thể chat.'.length);
    return t('system_msg.chat_restriction_enabled', { name });
  }
  if (strContent.endsWith(' đã tắt chế độ giới hạn người có thể chat.')) {
    const name = strContent.substring(0, strContent.length - ' đã tắt chế độ giới hạn người có thể chat.'.length);
    return t('system_msg.chat_restriction_disabled', { name });
  }

  // 11. Kiểm duyệt thành viên (Member approval toggle)
  if (strContent.endsWith(' đã bật chế độ kiểm duyệt thành viên mới.')) {
    const name = strContent.substring(0, strContent.length - ' đã bật chế độ kiểm duyệt thành viên mới.'.length);
    return t('system_msg.member_approval_enabled', { name });
  }
  if (strContent.endsWith(' đã tắt chế độ kiểm duyệt thành viên mới.')) {
    const name = strContent.substring(0, strContent.length - ' đã tắt chế độ kiểm duyệt thành viên mới.'.length);
    return t('system_msg.member_approval_disabled', { name });
  }

  // 11. Khóa cuộc bình chọn (Close vote)
  const closeVoteMatch = strContent.match(/^(.+) đã khóa cuộc bình chọn: (.+)$/);
  if (closeVoteMatch) {
    return t('system_msg.closed_vote', { name: closeVoteMatch[1], question: closeVoteMatch[2] });
  }

  return content;
};
