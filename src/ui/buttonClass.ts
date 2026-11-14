// Button class builder, shared by <Button>, <LinkButton> and button-like controls (menu items, chips).
import { cx } from './tone';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-brand-fg hover:brightness-110 border border-transparent',
  secondary: 'bg-surface-2 text-text border border-border-strong hover:border-text-3',
  ghost: 'bg-transparent text-text-2 border border-transparent hover:bg-surface-2 hover:text-text',
  danger: 'bg-act-bg text-act-fg border border-act-border hover:bg-act/20',
};

/** Shared class string so other controls (menu items, chips) can look like buttons. */
export function buttonClass(variant: ButtonVariant = 'secondary', iconOnly = false, extra?: string): string {
  return cx(
    'inline-flex min-h-target items-center justify-center gap-2 rounded-control text-sm font-medium select-none',
    'transition-[background-color,border-color,color,filter] duration-200 ease-out',
    'disabled:cursor-not-allowed disabled:opacity-50',
    iconOnly ? 'min-w-target px-0' : 'min-w-target px-4',
    VARIANT[variant],
    extra,
  );
}
