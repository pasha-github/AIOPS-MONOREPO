import React from "react";

interface RoyalCyberLogoProps {
  className?: string;
}

export const RoyalCyberLogo: React.FC<RoyalCyberLogoProps> = ({ className = "h-8" }) => {
  return (
    <img
      src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTHarNWZdNivVLkqa9ihJX07IT9F5AMyrp8Hg&s"
      alt="Royal Cyber Logo"
      className={`${className} object-contain`}
      referrerPolicy="no-referrer"
    />
  );
};
