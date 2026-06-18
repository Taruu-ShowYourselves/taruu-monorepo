'use client';

import { useEffect } from 'react';

/**
 * Cross-site GA4 auto-instrumentation (the base gtag tag is already in the
 * root layout). Tracks: bot_check (Cloudflare signal), cta_click,
 * support_click, file_download, outbound_click, nav_click, scroll_depth,
 * section_view.
 */
export function AnalyticsEvents() {
  useEffect(() => {
    const w = window as unknown as { gtag?: (...a: unknown[]) => void };
    const track = (name: string, params?: Record<string, unknown>) => {
      try {
        w.gtag?.('event', name, params || {});
      } catch {
        /* noop */
      }
    };

    try {
      const m = document.cookie.match(/(?:^|; )__cfbot=([^;]+)/);
      let score: number | null = null;
      let verified = false;
      if (m) {
        const [s, v] = decodeURIComponent(m[1]).split(':');
        score = parseInt(s, 10);
        verified = v === '1';
      }
      const valid = score != null && !Number.isNaN(score);
      track('bot_check', {
        cf_bot_score: valid ? score : null,
        is_bot: valid ? (score as number) < 30 : null,
        verified_bot: verified,
      });
    } catch {
      /* noop */
    }

    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      const a = t?.closest?.('a,button,[data-ga]') as HTMLElement | null;
      if (!a) return;
      const ga = a.getAttribute('data-ga');
      const href = a.getAttribute('href') || '';
      const text = (a.textContent || '').trim().slice(0, 80);
      if (ga) {
        track('cta_click', { cta_label: ga, location: location.pathname });
        return;
      }
      if (href) {
        if (/patreon|ko-fi|paypal/i.test(href))
          track('support_click', { platform: href.replace(/^https?:\/\//, '').split('/')[0] });
        if (/\.(pdf|zip|csv|tex|gif)$/i.test(href))
          track('file_download', { file_name: href.split('/').pop() });
        const ext = /^https?:\/\//.test(href) && !href.includes(location.host);
        if (ext) track('outbound_click', { link_url: href, link_text: text });
        else if (a.tagName === 'A') track('nav_click', { nav_label: text || href });
      } else if (a.tagName === 'BUTTON') {
        track('cta_click', { cta_label: text, location: location.pathname });
      }
    };

    const hit: Record<number, boolean> = {};
    const onScroll = () => {
      const h = document.documentElement;
      const p = (h.scrollTop / ((h.scrollHeight - h.clientHeight) || 1)) * 100;
      [25, 50, 75, 100].forEach((m) => {
        if (p >= m && !hit[m]) {
          hit[m] = true;
          track('scroll_depth', { percent: m });
        }
      });
    };

    let io: IntersectionObserver | undefined;
    if ('IntersectionObserver' in window) {
      const seen: Record<string, boolean> = {};
      io = new IntersectionObserver(
        (entries) => {
          entries.forEach((en) => {
            if (en.isIntersecting) {
              const id = en.target.id || en.target.getAttribute('data-section');
              if (id && !seen[id]) {
                seen[id] = true;
                track('section_view', { section_id: id });
              }
            }
          });
        },
        { threshold: 0.4 }
      );
      document.querySelectorAll('section[id],[data-section]').forEach((el) => io!.observe(el));
    }

    document.addEventListener('click', onClick, true);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('scroll', onScroll);
      io?.disconnect();
    };
  }, []);

  return null;
}
