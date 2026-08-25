export type SiteModeCopy = {
  headerStatus: string;
  profileMarker: string;
  contactPolicy: string;
  contactSecurity: string;
  footerStatus: string;
};

export function getSiteModeCopy(publicBuild: boolean): SiteModeCopy {
  if (publicBuild) {
    return {
      headerStatus: 'FIELD SYSTEM / PUBLIC',
      profileMarker: 'PROFILE / PUBLIC IDENTITY',
      contactPolicy: 'RESPONSE POLICY / CONTACT DIRECT',
      contactSecurity: 'SECURE FORM / TURNSTILE',
      footerStatus: 'PUBLIC BUILD',
    };
  }

  return {
    headerStatus: 'FIELD SYSTEM / PREVIEW',
    profileMarker: 'PROFILE / IDENTITY PENDING',
    contactPolicy: 'RESPONSE POLICY / TO BE CONFIRMED',
    contactSecurity: 'PREVIEW / SECURE FORM',
    footerStatus: 'PREVIEW BUILD',
  };
}
