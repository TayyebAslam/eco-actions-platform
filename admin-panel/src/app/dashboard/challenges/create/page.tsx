import { Metadata } from 'next';
  import { ChallengeFormView } from "@/components/views/dashboard/challenges/form/ChallengeFormView";

export const metadata: Metadata = {
  title: 'Create Challenge - Eco Actions',
  description: 'Create a new sustainability challenge',
};

export default function ChallengesCreatePage() {
  return <ChallengeFormView />;
}
