export function getTodayIso(): string {
  const now = new Date();
  const offsetMinutes = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offsetMinutes * 60_000);
  return local.toISOString().slice(0, 10);
}
