import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/'],
        disallow: [
          '/api/',
          '/auth/',
          '/IT_Admin/',
          '/join',
          '/MasterTeacher/',
          '/PWA',
          '/Parent/',
          '/Principal/',
          '/quiz/',
          '/Super_Admin/',
          '/Teacher/',
        ],
      },
    ],
    sitemap: `${siteUrl.origin}/sitemap.xml`,
    host: siteUrl.origin,
  };
}
