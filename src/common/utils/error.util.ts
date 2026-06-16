export function isDbError(
  err: unknown,
): err is { code?: string; constraint?: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in (err as Record<string, unknown>)
  );
}

export function isErrorWithStack(err: unknown): err is { stack?: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'stack' in (err as Record<string, unknown>)
  );
}

export function getErrorCode(err: unknown): string | undefined {
  return isDbError(err) ? (err as { code?: string }).code : undefined;
}

export function getErrorConstraint(err: unknown): string | undefined {
  return isDbError(err)
    ? (err as { constraint?: string }).constraint
    : undefined;
}
