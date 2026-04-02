import React from 'react';

interface LogoProps {
    size?: number;
    className?: string;
}

const Logo: React.FC<LogoProps> = ({ size = 40, className = '' }) => {
    return (
        <>
            {/* The pristine, untouched original logo is perfect for light mode because it has a native white background */}
            <img
                src="/logo.png"
                alt="SarkarHamariHai Logo"
                width={size}
                height="auto"
                className={`object-contain rounded-full overflow-hidden light-logo ${className}`}
                style={{ width: size, height: 'auto' }}
            />
            {/* The v11 background-removed logo is optimized exclusively for dark mode */}
            <img
                src="/logo-no-bg.png?v=11"
                alt="SarkarHamariHai Logo"
                width={size}
                height="auto"
                className={`object-contain rounded-full overflow-hidden dark-logo ${className}`}
                style={{ width: size, height: 'auto' }}
            />
        </>
    );
};

export default Logo;
