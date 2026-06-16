const FREE_EMAIL_DOMAINS = new Set<string>([
  // 'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'gmx.com',
  'mail.com',
  'yandex.com',
]);

export interface EmailPolicyConfig {
  allowedDomains: Set<string>;
  blockedDomains: Set<string>;
  allowSubdomains: boolean;
}

export interface EmailValidationOptions {
  requireOrganizational?: boolean;
  config: EmailPolicyConfig;
}

export interface EmailValidationResult {
  isValid: boolean;
  normalizedEmail: string;
  domain?: string;
  reason?: string;
}

function parseCsvToSet(value?: string): Set<string> {
  if (!value) {
    return new Set<string>();
  }

  return new Set(
    value
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter((item) => item.length > 0),
  );
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function isEmailFormatValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function extractDomain(email: string): string | null {
  const atIndex = email.lastIndexOf('@');
  if (atIndex < 0 || atIndex === email.length - 1) {
    return null;
  }
  return email.slice(atIndex + 1).toLowerCase();
}

function domainMatches(
  domain: string,
  candidate: string,
  allowSubdomains: boolean,
): boolean {
  if (domain === candidate) {
    return true;
  }

  return allowSubdomains && domain.endsWith(`.${candidate}`);
}

function matchesSet(
  domain: string,
  domains: Set<string>,
  allowSubdomains: boolean,
): boolean {
  for (const candidate of domains) {
    if (domainMatches(domain, candidate, allowSubdomains)) {
      return true;
    }
  }
  return false;
}

export function getEmailPolicyConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): EmailPolicyConfig {
  return {
    allowedDomains: parseCsvToSet(env.EMAIL_ALLOWED_DOMAINS),
    blockedDomains: parseCsvToSet(env.EMAIL_BLOCKED_DOMAINS),
    allowSubdomains: parseBoolean(env.EMAIL_ALLOW_SUBDOMAINS, true),
  };
}

export function validateEmailWithPolicy(
  rawEmail: string,
  options: EmailValidationOptions,
): EmailValidationResult {
  const normalizedEmail = String(rawEmail ?? '')
    .trim()
    .toLowerCase();
  if (!normalizedEmail) {
    return {
      isValid: false,
      normalizedEmail,
      reason: 'Email is required.',
    };
  }

  if (!isEmailFormatValid(normalizedEmail)) {
    return {
      isValid: false,
      normalizedEmail,
      reason: 'Email format is invalid.',
    };
  }

  const domain = extractDomain(normalizedEmail);
  if (!domain) {
    return {
      isValid: false,
      normalizedEmail,
      reason: 'Email domain is invalid.',
    };
  }

  const { config, requireOrganizational } = options;
  const isExplicitlyAllowed = matchesSet(
    domain,
    config.allowedDomains,
    config.allowSubdomains,
  );

  if (
    config.blockedDomains.size > 0 &&
    matchesSet(domain, config.blockedDomains, config.allowSubdomains) &&
    !isExplicitlyAllowed
  ) {
    return {
      isValid: false,
      normalizedEmail,
      domain,
      reason: 'This email domain is blocked.',
    };
  }

  if (
    config.allowedDomains.size > 0 &&
    !isExplicitlyAllowed &&
    !matchesSet(domain, config.allowedDomains, config.allowSubdomains)
  ) {
    return {
      isValid: false,
      normalizedEmail,
      domain,
      reason: 'This email domain is not allowed.',
    };
  }

  if (
    requireOrganizational &&
    FREE_EMAIL_DOMAINS.has(domain) &&
    !isExplicitlyAllowed
  ) {
    return {
      isValid: false,
      normalizedEmail,
      domain,
      reason:
        'Please use an organizational email address. Personal/free email domains are not allowed.',
    };
  }

  return {
    isValid: true,
    normalizedEmail,
    domain,
  };
}
