import type { Metadata } from 'next';
import Home from '@/modules/Landing_Page/Landing_Page';
import { getSiteUrl, siteConfig } from '@/lib/seo';

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  title: siteConfig.title,
  description: siteConfig.description,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    url: '/',
    title: siteConfig.title,
    description: siteConfig.description,
  },
};

export default function Landing_Page() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${siteUrl.origin}/#website`,
        url: siteUrl.origin,
        name: siteConfig.name,
        description: siteConfig.description,
        inLanguage: 'en-PH',
      },
      {
        '@type': 'ElementarySchool',
        '@id': `${siteUrl.origin}/#organization`,
        name: siteConfig.schoolName,
        url: siteUrl.origin,
        description: siteConfig.description,
        address: {
          '@type': 'PostalAddress',
          streetAddress: siteConfig.address,
          addressLocality: 'Quezon City',
          addressCountry: 'PH',
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <Home />
    </>
  );
}
