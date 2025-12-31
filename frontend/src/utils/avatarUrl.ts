/**
 * Constructs the full avatar URL from a picture field.
 * If the picture is a local static file path, prepends the backend URL.
 * Otherwise returns the picture URL as-is (for external URLs like Google).
 */
export function getAvatarUrl(picture?: string | null): string | undefined {
  if (!picture) return undefined;
  
  // If it's a local static file, prepend backend URL
  if (picture.startsWith('/static/')) {
    const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    return `${backendUrl}${picture}`;
  }
  
  // Otherwise return as-is (external URL)
  return picture;
}

/**
 * Returns user initials from full name or email (fallback).
 */
export function getInitials(name?: string | null, email?: string): string {
  if (name) {
    return name
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return email?.slice(0, 2).toUpperCase() || "??";
}
