import HomeExperience from './components/site/HomeExperience';
import { projectProfileForClient } from './components/site/profile-projection';
import { projectPublicCaseStudies } from './components/work/work-public';
import { caseStudies, siteContent } from './lib/content.ts';
import { isPublicBuild } from './seo-config.ts';

export default function HomePage() {
  const publicBuild = isPublicBuild();
  const profile = projectProfileForClient(siteContent.profile, publicBuild);
  const workCases = projectPublicCaseStudies(caseStudies, publicBuild);
  return <HomeExperience publicBuild={publicBuild} profile={profile} workCases={workCases} footerYear={new Date().getFullYear()} />;
}
