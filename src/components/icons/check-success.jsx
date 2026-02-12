"use client";

import { useId } from "react";

export default function AnimatedCheck({ size = 180, className = "" }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, ""); // ทำให้ปลอดภัยกับ url(#id)
  const clipId = `clip_${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 300 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes growAndShrink {
              0% { transform: scale(0.8); }
              50% { transform: scale(1); }
              100% { transform: scale(0.8); }
            }

            .pulseCircle {
              transform-box: fill-box;
              transform-origin: center;
              animation: growAndShrink 2s cubic-bezier(.4, 0, .2, 1) infinite;
            }
            .pulseCircle.delay { animation-delay: .15s; }
          `,
        }}
      />

      <circle className="pulseCircle" opacity="0.1" cx="150" cy="150" r="150" fill="#7DDE7A" />
      <circle className="pulseCircle delay" opacity="0.3" cx="150" cy="150" r="75" fill="#7DDE7A" />

      <g clipPath={`url(#${clipId})`}>
        <path
          d="M150 187.5C140.054 187.5 130.516 183.549 123.483 176.517C116.451 169.484 112.5 159.946 112.5 150C112.5 140.054 116.451 130.516 123.483 123.483C130.516 116.451 140.054 112.5 150 112.5C159.946 112.5 169.484 116.451 176.517 123.483C183.549 130.516 187.5 140.054 187.5 150C187.5 159.946 183.549 169.484 176.517 176.517C169.484 183.549 159.946 187.5 150 187.5ZM142.5 168.75L176.25 136.875L170.625 131.25L142.5 157.5L129.375 144.375L123.75 150L142.5 168.75Z"
          fill="#32AC2E"
        />
      </g>

      <defs>
        <clipPath id={clipId}>
          <rect width="75" height="75" fill="white" transform="translate(112.5 112.5)" />
        </clipPath>
      </defs>
    </svg>
  );
}
