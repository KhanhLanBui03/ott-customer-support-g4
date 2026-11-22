import { useWindowDimensions } from 'react-native';

/**
 * Centralized responsive layout hook reacting dynamically to orientation changes
 * (portrait <-> landscape) and larger screens (Tablet / iPad).
 */
export const useResponsive = () => {
  const { width, height, fontScale } = useWindowDimensions();

  const isLandscape = width > height;
  const isTablet = width >= 768;
  const isLargeTablet = width >= 1024;
  const isCompactLandscape = isLandscape && height < 520;
  const isWideLayout = isTablet || (isLandscape && width >= 680);

  const horizontalPadding = isLargeTablet ? 36 : isTablet ? 28 : isLandscape ? 24 : 16;
  const contentMaxWidth = isLargeTablet ? 960 : isTablet ? 760 : width;
  const formMaxWidth = isTablet ? 480 : isLandscape ? 460 : width;
  const modalMaxWidth = isTablet ? 520 : isLandscape ? 480 : width - 32;

  // Responsive grid columns for media/photo galleries
  const mediaColumns = isLargeTablet ? 6 : isTablet ? 5 : isLandscape ? 5 : 3;

  // Floating bottom tab bar width capped neatly on Tablet / Landscape
  const tabBarWidth = Math.min(width - 32, isTablet ? 540 : isLandscape ? 500 : width - 32);

  return {
    width,
    height,
    fontScale,
    isLandscape,
    isTablet,
    isLargeTablet,
    isCompactLandscape,
    isWideLayout,
    horizontalPadding,
    contentMaxWidth,
    formMaxWidth,
    modalMaxWidth,
    mediaColumns,
    tabBarWidth,
  };
};

export default useResponsive;
