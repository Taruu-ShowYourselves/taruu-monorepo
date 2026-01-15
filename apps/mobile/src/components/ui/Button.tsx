import React from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  PressableProps,
} from 'react-native';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<PressableProps, 'children'> {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  isFullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, { container: string; text: string; pressedBg: string }> = {
  primary: {
    container: 'bg-primary-600',
    text: 'text-white',
    pressedBg: 'bg-primary-700',
  },
  secondary: {
    container: 'bg-secondary-600',
    text: 'text-white',
    pressedBg: 'bg-secondary-700',
  },
  outline: {
    container: 'bg-transparent border-2 border-primary-600',
    text: 'text-primary-600',
    pressedBg: 'bg-primary-50',
  },
  ghost: {
    container: 'bg-transparent',
    text: 'text-neutral-700',
    pressedBg: 'bg-neutral-100',
  },
  danger: {
    container: 'bg-red-600',
    text: 'text-white',
    pressedBg: 'bg-red-700',
  },
};

const sizeStyles: Record<ButtonSize, { container: string; text: string }> = {
  sm: {
    container: 'px-3 py-2 rounded-lg',
    text: 'text-sm',
  },
  md: {
    container: 'px-4 py-3 rounded-xl',
    text: 'text-base',
  },
  lg: {
    container: 'px-6 py-4 rounded-xl',
    text: 'text-lg',
  },
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  isFullWidth = false,
  leftIcon,
  rightIcon,
  disabled,
  className,
  ...props
}: ButtonProps & { className?: string }) {
  const isDisabled = disabled || isLoading;
  const variantStyle = variantStyles[variant];
  const sizeStyle = sizeStyles[size];

  return (
    <Pressable
      disabled={isDisabled}
      className={`
        flex-row-reverse items-center justify-center
        ${sizeStyle.container}
        ${variantStyle.container}
        ${isFullWidth ? 'w-full' : ''}
        ${isDisabled ? 'opacity-50' : ''}
        ${className || ''}
      `}
      style={({ pressed }) => [
        pressed && !isDisabled && { opacity: 0.8 },
      ]}
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'outline' || variant === 'ghost' ? '#2563EB' : 'white'}
        />
      ) : (
        <>
          {rightIcon && <Text className="ml-2">{rightIcon}</Text>}
          <Text
            className={`font-heebo font-semibold ${sizeStyle.text} ${variantStyle.text}`}
          >
            {children}
          </Text>
          {leftIcon && <Text className="mr-2">{leftIcon}</Text>}
        </>
      )}
    </Pressable>
  );
}

// Loading button variant for forms
export function LoadingButton({
  children,
  isLoading,
  loadingText = 'טוען...',
  ...props
}: ButtonProps & { loadingText?: string }) {
  return (
    <Button isLoading={isLoading} {...props}>
      {isLoading ? loadingText : children}
    </Button>
  );
}
