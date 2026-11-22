import React from 'react';
import { Avatar as TamaguiAvatar, Text, View } from 'tamagui';

const Avatar = ({
  uri,
  name = 'U',
  size = 48,
  online,
  borderColor = '$borderColor',
  borderWidth = 2,
  style,
}) => {
  const initials = String(name || 'U')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'U';

  const dotSize = Math.max(10, Math.round(size * 0.22));

  return (
    <View position="relative" width={size} height={size} style={style}>
      <TamaguiAvatar
        circular
        width={size}
        height={size}
        borderRadius={size / 2}
        borderWidth={borderWidth}
        borderColor={borderColor}
        backgroundColor="$surface200"
      >
        {uri ? <TamaguiAvatar.Image accessibilityLabel={name} src={uri} source={{ uri }} /> : null}
        <TamaguiAvatar.Fallback
          backgroundColor="#6366f1"
          alignItems="center"
          justifyContent="center"
        >
          <Text color="#ffffff" fontWeight="700" fontSize={Math.max(12, Math.round(size * 0.34))}>
            {initials}
          </Text>
        </TamaguiAvatar.Fallback>
      </TamaguiAvatar>

      {typeof online === 'boolean' ? (
        <View
          position="absolute"
          right={0}
          bottom={0}
          width={dotSize}
          height={dotSize}
          borderRadius={dotSize / 2}
          backgroundColor={online ? '#10b981' : '#94a3b8'}
          borderWidth={2}
          borderColor="$card"
        />
      ) : null}
    </View>
  );
};

export default Avatar;
