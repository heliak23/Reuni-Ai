// Default modern SVG avatars (100% offline, zero network dependencies)

export const REUNI_BOT_AVATAR = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120' width='120' height='120'%3E%3Cdefs%3E%3ClinearGradient id='bgGrad' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%235865F2'/%3E%3Cstop offset='100%25' stop-color='%233b48c8'/%3E%3C/linearGradient%3E%3ClinearGradient id='glowGrad' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%2357F287'/%3E%3Cstop offset='100%25' stop-color='%2323a55a'/%3E%3C/linearGradient%3E%3C/defs%3E%3Ccircle cx='60' cy='60' r='60' fill='url(%23bgGrad)'/%3E%3Crect x='57' y='18' width='6' height='16' rx='3' fill='%23ffffff' opacity='0.9'/%3E%3Ccircle cx='60' cy='18' r='7' fill='url(%23glowGrad)'/%3E%3Crect x='20' y='52' width='10' height='24' rx='5' fill='%23ebedef'/%3E%3Crect x='90' y='52' width='10' height='24' rx='5' fill='%23ebedef'/%3E%3Crect x='26' y='32' width='68' height='54' rx='18' fill='%23ffffff'/%3E%3Crect x='34' y='40' width='52' height='38' rx='10' fill='%2323272A'/%3E%3Ccircle cx='48' cy='56' r='6' fill='%235865F2'/%3E%3Ccircle cx='46.5' cy='54.5' r='2' fill='%23ffffff'/%3E%3Ccircle cx='72' cy='56' r='6' fill='%235865F2'/%3E%3Ccircle cx='70.5' cy='54.5' r='2' fill='%23ffffff'/%3E%3Cpath d='M52 68 Q60 74 68 68' stroke='%2357F287' stroke-width='3' stroke-linecap='round' fill='none'/%3E%3C/svg%3E`;

export const DEFAULT_USER_AVATAR = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' width='100' height='100'%3E%3Cdefs%3E%3ClinearGradient id='userGrad' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%235865F2'/%3E%3Cstop offset='100%25' stop-color='%234752C4'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='100' height='100' rx='50' fill='url(%23userGrad)'/%3E%3Ccircle cx='50' cy='40' r='18' fill='%23ffffff'/%3E%3Cpath d='M22 84c0-15.5 12.5-28 28-28s28 12.5 28 28' fill='%23ffffff'/%3E%3C/svg%3E`;

/**
 * Fallback handler for img onError to ensure broken images never appear in the UI
 */
export const handleAvatarError = (
  e: React.SyntheticEvent<HTMLImageElement, Event>,
  isBot = false
) => {
  const fallback = isBot ? REUNI_BOT_AVATAR : DEFAULT_USER_AVATAR;
  if (e.currentTarget.src !== fallback) {
    e.currentTarget.src = fallback;
  }
};
