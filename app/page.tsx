import HomeExperience from './components/site/HomeExperience';
import { projectProfileForClient } from './components/site/profile-projection';
import { projectPublicCaseStudies } from './components/work/work-public';
import { caseStudies, siteContent } from './lib/content.ts';
import { isContactAvailable } from './lib/contact-availability.ts';
import { getContactRuntimeEnv } from './lib/contact-runtime.ts';
import { isPublicBuild } from './seo-config.ts';

export default async function HomePage() {
  const publicBuild = isPublicBuild();
  const contactEnv = await getContactRuntimeEnv();
  const contactAvailable = isContactAvailable(contactEnv, Boolean(contactEnv.DB), siteContent);
  const profile = projectProfileForClient(siteContent.profile);
  const workCases = projectPublicCaseStudies(caseStudies, publicBuild);
  return (
    <HomeExperience
      publicBuild={publicBuild}
      contactAvailable={contactAvailable}
      turnstileSiteKey={contactAvailable ? contactEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY! : null}
      profile={profile}
      workCases={workCases}
      footerYear={new Date().getFullYear()}
    />
  );
}
