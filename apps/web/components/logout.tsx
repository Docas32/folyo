import { signOut } from '../auth';
export function Logout({ label }: { label: string }) {
  return (
    <form
      action={async () => {
        'use server';
        await signOut({ redirectTo: '/' });
      }}
    >
      <button>{label}</button>
    </form>
  );
}
