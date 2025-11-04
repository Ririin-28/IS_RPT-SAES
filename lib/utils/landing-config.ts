const LANDING_CONFIG_STORAGE_KEY = "rptLandingConfig";

export type ThemeSettings = {
  systemName: string;
  welcomeMessage: string;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  logoUrl: string;
  logoFileName?: string | null;
};

export type ContactDetails = {
  address: string;
  phone: string;
  email: string;
  facebook: string;
};

export type CarouselImage = {
  id: string;
  url: string;
  name: string;
  uploadedAt: string;
};

export type LandingConfig = {
  theme: ThemeSettings;
  contact: ContactDetails;
  carouselImages: CarouselImage[];
  privacyPolicyName: string;
};

const defaultConfig: LandingConfig = {
  theme: {
    systemName: "San Agustin Elementary School",
    welcomeMessage: "Welcome to RPT-SAES",
    primaryColor: "#013300",
    accentColor: "#0f766e",
    backgroundColor: "#f6fbf9",
    logoUrl: "/SAES/SAESLogo.png",
    logoFileName: "SAESLogo.png",
  },
  contact: {
    address: "Heavenly Drive St., San Agustin, Novaliches, Quezon City",
    phone: "(02) 7001 7058",
    email: "sanagustinelem@gmail.com",
    facebook: "https://bit.ly/136538_saesfb",
  },
  carouselImages: [
    {
      id: "carousel-1",
      url: "/SAES/Carousel-1.jpg",
      name: "Carousel-1.jpg",
      uploadedAt: "Jun 05, 2025",
    },
    {
      id: "carousel-2",
      url: "/SAES/Carousel-2.jpg",
      name: "Carousel-2.jpg",
      uploadedAt: "Jun 18, 2025",
    },
    {
      id: "carousel-3",
      url: "/SAES/Carousel-3.jpg",
      name: "Carousel-3.jpg",
      uploadedAt: "Jul 03, 2025",
    },
    {
      id: "carousel-4",
      url: "/SAES/Carousel-4.jpg",
      name: "Carousel-4.jpg",
      uploadedAt: "Jul 24, 2025",
    },
    {
      id: "carousel-5",
      url: "/SAES/Carousel-5.jpg",
      name: "Carousel-5.jpg",
      uploadedAt: "Aug 08, 2025",
    },
    {
      id: "carousel-6",
      url: "/SAES/Carousel-6.jpg",
      name: "Carousel-6.jpg",
      uploadedAt: "Aug 23, 2025",
    },
    {
      id: "carousel-7",
      url: "/SAES/Carousel-7.jpg",
      name: "Carousel-7.jpg",
      uploadedAt: "Sep 10, 2025",
    },
  ],
  privacyPolicyName: "RPT-SAES_Privacy-Policy.docx",
};

const cloneConfig = (config: LandingConfig): LandingConfig => ({
  theme: { ...config.theme },
  contact: { ...config.contact },
  carouselImages: config.carouselImages.map((image) => ({ ...image })),
  privacyPolicyName: config.privacyPolicyName,
});

export const getDefaultLandingConfig = (): LandingConfig => cloneConfig(defaultConfig);

export const getStoredLandingConfig = (): LandingConfig | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LANDING_CONFIG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LandingConfig>;
    return mergeWithDefaults(parsed);
  } catch (error) {
    console.warn("Unable to read landing configuration", error);
    return null;
  }
};

export const saveLandingConfig = (config: LandingConfig) => {
  if (typeof window === "undefined") return;
  try {
    const payload = JSON.stringify({
      theme: { ...config.theme },
      contact: { ...config.contact },
      carouselImages: config.carouselImages.map((image) => ({ ...image })),
      privacyPolicyName: config.privacyPolicyName,
    });
    window.localStorage.setItem(LANDING_CONFIG_STORAGE_KEY, payload);
  } catch (error) {
    console.warn("Unable to persist landing configuration", error);
  }
};

const mergeWithDefaults = (partial: Partial<LandingConfig>): LandingConfig => {
  const defaults = getDefaultLandingConfig();
  const theme = {
    ...defaults.theme,
    ...(partial.theme ?? {}),
  };
  const contact = {
    ...defaults.contact,
    ...(partial.contact ?? {}),
  };
  const carouselImages = (partial.carouselImages ?? defaults.carouselImages).map((image, index) => ({
    id: image.id ?? defaults.carouselImages[index]?.id ?? `carousel-${index + 1}`,
    url: image.url ?? defaults.carouselImages[index]?.url ?? "",
    name: image.name ?? defaults.carouselImages[index]?.name ?? `Slide-${index + 1}.jpg`,
    uploadedAt: image.uploadedAt ?? defaults.carouselImages[index]?.uploadedAt ?? "",
  }));
  const privacyPolicyName = partial.privacyPolicyName ?? defaults.privacyPolicyName;
  return {
    theme,
    contact,
    carouselImages,
    privacyPolicyName,
  };
};

export { LANDING_CONFIG_STORAGE_KEY };
