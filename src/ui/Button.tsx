import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router';
import type { LinkProps } from 'react-router';
import type { LucideIcon } from 'lucide-react';

import { buttonClass } from './buttonClass';
import type { ButtonVariant } from './buttonClass';

interface CommonProps {
  variant?: ButtonVariant;
  /** Leading icon (lucide). */
  icon?: LucideIcon;
  /** Icon-only button: `children` becomes the accessible name (visually hidden). */
  iconOnly?: boolean;
  children: ReactNode;
}

export type ButtonProps = CommonProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>;
export type LinkButtonProps = CommonProps & Omit<LinkProps, 'children'>;

function Inner({ icon: Icon, iconOnly, children }: Pick<CommonProps, 'icon' | 'iconOnly' | 'children'>) {
  return (
    <>
      {Icon && <Icon size={18} aria-hidden="true" className="shrink-0" />}
      {iconOnly ? <span className="sr-only">{children}</span> : children}
    </>
  );
}

/** Button with ≥ 44 px target (56 px in glove mode). */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', icon, iconOnly = false, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={buttonClass(variant, iconOnly, className)} {...rest}>
      <Inner icon={icon} iconOnly={iconOnly}>
        {children}
      </Inner>
    </button>
  );
});

/** Router link styled as a button. */
export function LinkButton({
  variant = 'secondary',
  icon,
  iconOnly = false,
  className,
  children,
  ...rest
}: LinkButtonProps) {
  return (
    <Link
      className={buttonClass(variant, iconOnly, typeof className === 'string' ? className : undefined)}
      {...rest}
    >
      <Inner icon={icon} iconOnly={iconOnly}>
        {children}
      </Inner>
    </Link>
  );
}
