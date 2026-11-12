import { useAuth } from '@/auth/AuthProvider';
import { Screen } from '@/components/Screen';
import { ProfileForm } from '@/features/profile/ProfileForm';

export default function EditProfile() {
  const { user, updateProfile } = useAuth();
  if (!user) return null;
  return (
    <Screen header>
      <ProfileForm profile={user.profile} onSubmit={updateProfile} />
    </Screen>
  );
}
