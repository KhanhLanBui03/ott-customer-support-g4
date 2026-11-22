import React from 'react';
import { Button as TamaguiButton, Spinner, Text } from 'tamagui';

const VARIANT_STYLES = {
  primary: {
    backgroundColor: '#6366f1',
    color: '#ffffff',
    borderColor: 'transparent',
    pressBg: '#4f46e5',
  },
  secondary: {
    backgroundColor: '$surface200',
    color: '$color',
    borderColor: '$borderColor',
    pressBg: '$surface300',
  },
  danger: {
    backgroundColor: '#ef4444',
    color: '#ffffff',
    borderColor: 'transparent',
    pressBg: '#dc2626',
  },
  ghost: {
    backgroundColor: 'transparent',
    color: '#6366f1',
    borderColor: 'transparent',
    pressBg: 'rgba(99, 102, 241, 0.1)',
  },
};

const SIZE_STYLES = {
  sm: { height: 40, paddingHorizontal: 14, fontSize: 13, borderRadius: 12 },
  md: { height: 50, paddingHorizontal: 18, fontSize: 15, borderRadius: 16 },
  lg: { height: 56, paddingHorizontal: 22, fontSize: 16, borderRadius: 18 },
};

const Button = ({
  title,
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  fullWidth = false,
  style,
  textStyle,
  ...rest
}) => {
  const palette = VARIANT_STYLES[variant] || VARIANT_STYLES.primary;
  const metrics = SIZE_STYLES[size] || SIZE_STYLES.md;
  const isDisabled = disabled || loading;

  return (
    <TamaguiButton
      onPress={onPress}
      disabled={isDisabled}
      height={metrics.height}
      paddingHorizontal={metrics.paddingHorizontal}
      borderRadius={metrics.borderRadius}
      backgroundColor={palette.backgroundColor}
      borderWidth={palette.borderColor === 'transparent' ? 0 : 1}
      borderColor={palette.borderColor}
      width={fullWidth ? '100%' : undefined}
      opacity={isDisabled ? 0.65 : 1}
      press={{ scale: 0.98, backgroundColor: palette.pressBg }}
      alignItems="center"
      justifyContent="center"
      flexDirection="row"
      gap={8}
      style={style}
      {...rest}
    >
      {loading ? (
        <Spinner size="small" color={palette.color} />
      ) : (
        <>
          {icon}
          {children || (
            <Text
              color={palette.color}
              fontSize={metrics.fontSize}
              fontWeight="700"
              style={textStyle}
            >
              {title}
            </Text>
          )}
        </>
      )}
    </TamaguiButton>
  );
};

export default Button;
