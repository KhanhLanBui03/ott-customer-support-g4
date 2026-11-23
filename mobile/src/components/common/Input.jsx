import React, { useState } from 'react';
import { TextInput } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';

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

  const bgColor = darkSurface ? '#101013' : '$inputBg';
  const borderColor = error
    ? '#FB565B'
    : focused
      ? '#3B82F6'
      : darkSurface
        ? '#2E2C2E'
        : '$borderColor';
  const textColor = darkSurface ? '#F2F2F2' : '#0F172A';
  const placeholderColor = darkSurface ? '#64748b' : '#64748B';

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
        <TextInput
          style={[
            {
              flex: 1,
              height: 48,
              color: textColor,
              fontSize: 15,
              paddingHorizontal: 0,
            },
            inputStyle,
          ]}
          placeholderTextColor={placeholderColor}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {rightElement}
      </XStack>

      {error ? (
        <Text fontSize={12} color="#FB565B" marginLeft={4}>
          {error}
        </Text>
      ) : null}
    </YStack>
  );
};

export default Input;
