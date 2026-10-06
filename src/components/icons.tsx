type IconProps = { className?: string };

const base = "shrink-0";

export function IconDashboard({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`${base} ${className ?? ""}`}>
      <rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13" y="3" width="8" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13" y="10" width="8" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

export function IconSpool({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`${base} ${className ?? ""}`}>
      <ellipse cx="12" cy="5" rx="7" ry="2.5" stroke="currentColor" strokeWidth="1.7" />
      <ellipse cx="12" cy="19" rx="7" ry="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5 5v14M19 5v14" stroke="currentColor" strokeWidth="1.7" />
      <ellipse cx="12" cy="12" rx="3.2" ry="1.4" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function IconPrinter({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`${base} ${className ?? ""}`}>
      <path d="M6 8V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v4" stroke="currentColor" strokeWidth="1.7" />
      <rect x="3" y="8" width="18" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      <rect x="6" y="14" width="12" height="7" rx="1" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="17.5" cy="11.2" r="0.9" fill="currentColor" />
    </svg>
  );
}

export function IconPackage({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`${base} ${className ?? ""}`}>
      <path
        d="M12 3 3.5 7.5v9L12 21l8.5-4.5v-9L12 3Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

export function IconUsers({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`${base} ${className ?? ""}`}>
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="17" cy="9" r="2.3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M15.5 14.2c2.5.4 4.5 2.5 4.5 5.8" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function IconCalculator({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`${base} ${className ?? ""}`}>
      <rect x="5" y="3" width="14" height="18" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 7h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="8.3" cy="12" r="0.9" fill="currentColor" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" />
      <circle cx="15.7" cy="12" r="0.9" fill="currentColor" />
      <circle cx="8.3" cy="15.5" r="0.9" fill="currentColor" />
      <circle cx="12" cy="15.5" r="0.9" fill="currentColor" />
      <circle cx="15.7" cy="15.5" r="0.9" fill="currentColor" />
    </svg>
  );
}

export function IconShoppingBag({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`${base} ${className ?? ""}`}>
      <path
        d="M6 8h12l1 12.5a1 1 0 0 1-1 1.5H6a1 1 0 0 1-1-1.5L6 8Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M8.5 8V6a3.5 3.5 0 0 1 7 0v2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function IconMenu({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`${base} ${className ?? ""}`}>
      <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconClose({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`${base} ${className ?? ""}`}>
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconEdit({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`${base} ${className ?? ""}`}>
      <path
        d="M4 20h4l10.5-10.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 16v4Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M13.5 6.5 17.5 10.5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

export function IconCheck({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`${base} ${className ?? ""}`}>
      <path d="M5 12.5 9.5 17 19 7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconGrid({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`${base} ${className ?? ""}`}>
      <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.3" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13" y="3.5" width="7.5" height="7.5" rx="1.3" stroke="currentColor" strokeWidth="1.7" />
      <rect x="3.5" y="13" width="7.5" height="7.5" rx="1.3" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13" y="13" width="7.5" height="7.5" rx="1.3" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

export function IconChevronLeft({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`${base} ${className ?? ""}`}>
      <path d="M15 5 8 12l7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconChevronRight({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`${base} ${className ?? ""}`}>
      <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconTrash({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`${base} ${className ?? ""}`}>
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

