import React, { useState, useEffect } from 'react';
import { resolveAvatarUrl, getInitials, getAvatarGradient } from '../../utils/avatar.ts';

interface UserAvatarProps {
  src?: string | null;
  name?: string | null;
  email?: string | null;
  alt?: string;
  className?: string;
  imageClassName?: string;
  textClassName?: string;
  shape?: 'circle' | 'rounded' | 'rounded-lg' | 'rounded-xl' | 'rounded-2xl' | 'rounded-3xl' | 'square';
}

const shapeClasses: Record<string, string> = {
  circle: 'rounded-full',
  rounded: 'rounded-md',
  'rounded-lg': 'rounded-lg',
  'rounded-xl': 'rounded-xl',
  'rounded-2xl': 'rounded-2xl',
  'rounded-3xl': 'rounded-3xl',
  square: 'rounded-none',
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  src,
  name,
  email,
  alt = 'User Avatar',
  className = 'w-10 h-10',
  imageClassName = '',
  textClassName = '',
  shape = 'circle',
}) => {
  const [hasError, setHasError] = useState(false);
  const resolved = resolveAvatarUrl(src);

  // Reset error state if image source changes
  useEffect(() => {
    setHasError(false);
  }, [src]);

  const shapeClass = shapeClasses[shape] || 'rounded-full';
  const initials = getInitials(name, email);
  const gradient = getAvatarGradient(name || email || 'user');

  return (
    <div
      className={`relative overflow-hidden shrink-0 flex items-center justify-center select-none ${shapeClass} ${className}`}
    >
      {resolved && !hasError ? (
        <img
          src={resolved}
          alt={alt}
          referrerPolicy="no-referrer"
          onError={() => setHasError(true)}
          className={`w-full h-full object-cover ${shapeClass} ${imageClassName}`}
        />
      ) : (
        <div
          className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center font-black text-white uppercase tracking-wider ${shapeClass}`}
        >
          <span className={`text-xs ${textClassName}`}>{initials}</span>
        </div>
      )}
    </div>
  );
};
