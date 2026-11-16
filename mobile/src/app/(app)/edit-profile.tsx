import { useAuth } from '@/features/auth/AuthProvider';
import { Screen } from '@/components/layout/Screen';
import { ProfileForm } from '@/features/profile/ProfileForm';
import { goHome } from '@/navigation/afterSave';

export default function EditProfile() {
  const { user, updateProfile } = useAuth();
  if (!user) return null;
  return (
    <Screen header>
      <ProfileForm
        profile={user.profile}
        onSubmit={async (update) => {
          await updateProfile(update);
          goHome();
        }}
      />
    </Screen>
  );
}
