export const TAGS = [
  { key: 'customer', label: 'Khách hàng', color: '#ef4444' }, // Red-500
  { key: 'family', label: 'Gia đình', color: '#10b981' }, // Emerald-500
  { key: 'work', label: 'Công việc', color: '#f97316' }, // Orange-500
  { key: 'friends', label: 'Bạn bè', color: '#a855f7' }, // Purple-500
  { key: 'later', label: 'Trả lời sau', color: '#eab308' }, // Yellow-500
  { key: 'colleague', label: 'Đồng nghiệp', color: '#3b82f6' } // Blue-500
];

export const getTagByKey = (key) => TAGS.find(t => t.key === key);
