"use client";

import { useEffect } from 'react';

import { CANONICAL_APP_URL } from '@/app/lib/site';

export default function CanonicalRedirect() {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const currentOrigin = window.location.origin.replace(/\/$/, '');
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (isLocalhost || currentOrigin === CANONICAL_APP_URL) {
      return;
    }

    const nextUrl = `${CANONICAL_APP_URL}${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.replace(nextUrl);
  }, []);

  return null;
}
