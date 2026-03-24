import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges Tailwind CSS classes intelligently.
 * Use this everywhere instead of plain string concatenation.
 * Example: cn('px-4 py-2', isActive && 'bg-blue-500', className)
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
