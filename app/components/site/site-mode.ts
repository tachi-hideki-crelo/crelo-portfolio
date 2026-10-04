export type SiteModeCopy = {
  headerStatus: string;
  profileMarker: string;
  contactSecurity: string;
  footerStatus: string;
};

export function getContactPolicyCopy(available: boolean): string {
  return available ? 'CONTACT / ACCEPTING INQUIRIES' : 'CONTACT / PREPARING';
}

export function getSiteModeCopy(publicBuild: boolean): SiteModeCopy {
  if (publicBuild) {
    return {
      headerStatus: 'FIELD SYSTEM / PUBLIC',
      profileMarker: 'PROFILE / PUBLIC IDENTITY',
      contactSecurity: 'SECURE FORM / TURNSTILE',
      footerStatus: 'PUBLIC BUILD',
    };
  }

  return {
    headerStatus: 'FIELD SYSTEM / PREVIEW',
    profileMarker: 'PROFILE / IDENTITY PENDING',
    contactSecurity: 'PREVIEW / SECURE FORM',
    footerStatus: 'PREVIEW BUILD',
  };
}
