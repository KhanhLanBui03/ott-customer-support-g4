import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';

export default function ShopExpertAIScreen() {
  const router = useRouter();
  const user = useSelector((state) => state.auth.user);

  useEffect(() => {
    const currentUserId = user?.userId || user?.id;
    if (currentUserId) {
      const participants = [String(currentUserId), 'shop-expert-ai-bot'].sort();
      const aiConvId = `SINGLE#${participants[0]}#${participants[1]}`;
      router.replace({
        pathname: `/chat/${encodeURIComponent(aiConvId)}`,
        params: {
          name: 'ShopExpert AI',
          type: 'SINGLE'
        }
      });
    } else {
      router.replace('/(main)');
    }
  }, [user]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111827' }}>
      <ActivityIndicator size="large" color="#6366f1" />
    </View>
  );
}
