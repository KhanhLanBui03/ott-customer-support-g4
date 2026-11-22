import React, { useState } from 'react';
import { Input as TamaguiInput, Text, XStack, YStack } from 'tamagui';

const Input = ({
  label,
  error,
  leftIcon,
  rightElement,
  containerStyle,
  inputStyle,
  onFocus,
  onBlur,
  darkSurface = false,
  ...rest
}) => {
  const [focused, setFocused] = useState(false);

  const bgColor = darkSurface ? 'rgba(255, 255, 255, 0.04)' : '$inputBg';
  const borderColor = error
    ? '#ef4444'
    : focused
      ? '#6366f1'
      : darkSurface
        ? 'rgba(255, 255, 255, 0.1)'
        : '$borderColor';
  const textColor = darkSurface ? '#ffffff' : '$color';

  return (
    <YStack gap={6} width="100%" style={containerStyle}>
      {label ? (
        <Text
          fontSize={12}
          fontWeight="700"
          color={darkSurface ? '#cbd5e1' : '$textMuted'}
          letterSpacing={0.5}
          marginLeft={4}
        >
          {label}
        </Text>
      ) : null}

      <XStack
        alignItems="center"
        backgroundColor={bgColor}
        borderWidth={1.5}
        borderColor={borderColor}
        borderRadius={16}
        paddingHorizontal={14}
        minHeight={52}
        gap={10}
      >
        {leftIcon}
        <TamaguiInput
          flex={1}
          borderWidth={0}
          backgroundColor="transparent"
          paddingHorizontal={0}
          height={48}
          color={textColor}
          placeholderTextColor={darkSurface ? '#64748b' : '$placeholderColor'}
          fontSize={15}
          focus={{ borderWidth: 0 }}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={inputStyle}
          {...rest}
        />
        {rightElement}
      </XStack>

      {error ? (
        <Text fontSize={12} color="#ef4444" marginLeft={4}>
          {error}
        </Text>
      ) : null}
    </YStack>
  );
};

export default Input;
