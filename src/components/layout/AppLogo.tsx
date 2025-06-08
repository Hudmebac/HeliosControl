
import type { SVGProps } from 'react';

export function AppLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      stroke="currentColor"
      {...props}
    >
      <title>Helios Control Logo</title>
      <path
        d="M12 17.6401C15.1086 17.6401 17.64 15.1087 17.64 12.0001C17.64 8.89146 15.1086 6.36011 12 6.36011C8.89137 6.36011 6.36002 8.89146 6.36002 12.0001C6.36002 15.1087 8.89137 17.6401 12 17.6401Z"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 2.40002V3.60002" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 20.4V21.6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.24265 4.24268L5.08107 5.08109" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18.919 18.919L19.7574 19.7574" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.40002 12H3.60002" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20.4 12H21.6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.24265 19.7574L5.08107 18.919" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18.919 5.08109L19.7574 4.24268" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
