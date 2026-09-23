// src/app/classroom/masterclass/MasterclassLogo.jsx
"use client";

import { useState } from "react";

/**
 * Masterclass header logo.
 *
 * The box keeps its size whether or not the asset loads, so a missing or moved
 * file leaves the header exactly where it was - no broken-image icon, no crash,
 * no layout jump.
 */
export default function MasterclassLogo({ size = 90 }) {
  const [failed, setFailed] = useState(false);

  return (
    <div
      className="flex items-center justify-center"
      style={{ width: size, height: size }}
      aria-hidden={failed ? "true" : undefined}
    >
      {!failed && (
        <img
          src="/masterclass-img/masterclass-logo.png"
          alt="9Expert Masterclass"
          width={size}
          height={size}
          className="h-full w-full object-contain"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
