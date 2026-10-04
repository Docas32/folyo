import { Button } from './ui/button';
import { signOut } from '../auth';
export function Logout({ label }: { label: string }) {
  return (
    <form
      action={async () => {
        'use server';
        await signOut({ redirectTo: '/' });
      }}
    >
      <Button type="submit" variant="ghost">
        {label}
      </Button>
    </form>
  );
}
