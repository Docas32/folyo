export function isAdminEmail(
  email: string | null | undefined,
  allowed = process.env.ADMIN_EMAILS ?? '',
) {
  return Boolean(
    email &&
    allowed
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
      .includes(email.toLowerCase()),
  );
}
