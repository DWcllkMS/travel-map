import React from 'react';

export interface AppLogoProps {
  size?: number;
  className?: string;
}

export const AppLogo: React.FC<AppLogoProps> = ({ size = 20, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
    style={{ display: 'inline-block', flexShrink: 0 }}
  >
    <path d="M2.5 5.8L8.8 3.5V18.2L2.5 20.5V5.8Z" fill="var(--bg-3)" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M15.2 5.8L21.5 3.5V18.2L15.2 20.5V5.8Z" fill="var(--bg-3)" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M8.8 3.5L15.2 5.8V20.5L8.8 18.2V3.5Z" fill="var(--accent)" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M12 7.6L13.5 12H10.5L12 7.6Z" fill="var(--on-accent)" />
    <path d="M12 16.4L13.5 12H10.5L12 16.4Z" fill="var(--on-accent)" fillOpacity="0.5" />
  </svg>
);
