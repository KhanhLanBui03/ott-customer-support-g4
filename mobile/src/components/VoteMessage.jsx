import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { MaterialIcons, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const VoteMessage = ({ 
  message, 
  currentUserId, 
  onVote, 
  onCloseVote, 
  onViewDetails,
  isAdmin,
  isMe 
}) => {
  const vote = message.vote;
  if (!vote) return null;

  const totalVotes = vote.options.reduce((sum, opt) => sum + (opt.voterIds?.length || 0), 0);
  const mySelection = vote.options
    .filter(opt => opt.voterIds?.includes(currentUserId))
    .map(opt => opt.optionId);

  const handleVotePress = (optionId) => {
    if (vote.isClosed) return;
    onVote(message.messageId, optionId, vote.allowMultiple, mySelection);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.iconBg}>
            <MaterialCommunityIcons name="poll" size={16} color="#6366f1" />
          </View>
          <Text style={styles.headerLabel}>BIỂU QUYẾT</Text>
        </View>
        <Text style={styles.question}>{vote.question}</Text>
      </View>

      <View style={styles.optionsList}>
        {vote.options.map((option) => {
          const voterCount = option.voterIds?.length || 0;
          const percent = totalVotes > 0 ? (voterCount / totalVotes) * 100 : 0;
          const isSelected = option.voterIds?.includes(currentUserId);

          return (
            <TouchableOpacity
              key={option.optionId}
              style={[
                styles.optionButton,
                isSelected && styles.optionButtonSelected
              ]}
              onPress={() => handleVotePress(option.optionId)}
              disabled={vote.isClosed}
              activeOpacity={0.7}
            >
              <View style={[styles.progressBg, { width: `${percent}%` }]} />
              <View style={styles.optionContent}>
                <View style={styles.optionLeft}>
                  <View style={[
                    styles.selectionIndicator,
                    vote.allowMultiple ? styles.checkbox : styles.radio,
                    isSelected && styles.selectionIndicatorSelected
                  ]}>
                    {isSelected && <MaterialIcons name="check" size={12} color="#fff" />}
                  </View>
                  <Text style={styles.optionText}>{option.text}</Text>
                </View>
                <Text style={styles.voteCount}>{voterCount}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.detailsBtn}
          onPress={() => onViewDetails(vote)}
        >
          <Text style={styles.detailsBtnText}>Xem chi tiết</Text>
          <MaterialIcons name="chevron-right" size={18} color="#6366f1" />
        </TouchableOpacity>

        {(isMe && !vote.isClosed) ? (
          <TouchableOpacity 
            style={styles.closeBtn}
            onPress={() => onCloseVote(message.messageId)}
          >
            <Text style={styles.closeBtnText}>KẾT THÚC</Text>
          </TouchableOpacity>
        ) : vote.isClosed ? (
          <View style={styles.closedBadge}>
            <Text style={styles.closedText}>ĐÃ ĐÓNG</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: width * 0.75,
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginVertical: 4,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#f8fafc',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  iconBg: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6366f1',
    letterSpacing: 1,
  },
  question: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    lineHeight: 22,
  },
  optionsList: {
    padding: 12,
    gap: 10,
  },
  optionButton: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  optionButtonSelected: {
    borderColor: '#6366f1',
    backgroundColor: '#f5f3ff',
  },
  progressBg: {
    position: 'absolute',
    height: '100%',
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    zIndex: 1,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  selectionIndicator: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radio: {
    borderRadius: 10,
  },
  checkbox: {
    borderRadius: 4,
  },
  selectionIndicatorSelected: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#334155',
    flex: 1,
  },
  voteCount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailsBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6366f1',
  },
  closeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  closeBtnText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#ef4444',
  },
  closedBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  closedText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#94a3b8',
  },
});

export default VoteMessage;
