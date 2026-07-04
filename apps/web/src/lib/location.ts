export const QUICK_GEOLOCATION_TIMEOUT_MS = 1500;
export const GEOLOCATION_TIMEOUT_MS = 12000;
export const LOCATION_CACHE_MAX_AGE_MS = 5 * 60 * 1000;
export const VERIFY_REQUEST_TIMEOUT_MS = 60000;

export async function canUseGeolocationSilently(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!("geolocation" in navigator)) return false;
  if (!("permissions" in navigator)) return false;

  try {
    const permission = await navigator.permissions.query({
      name: "geolocation" as PermissionName,
    });

    return permission.state === "granted";
  } catch {
    return false;
  }
}

export async function getReliableBrowserPosition(): Promise<GeolocationPosition> {
  try {
    return await getPosition(
      {
        enableHighAccuracy: false,
        maximumAge: LOCATION_CACHE_MAX_AGE_MS,
        timeout: QUICK_GEOLOCATION_TIMEOUT_MS,
      },
      QUICK_GEOLOCATION_TIMEOUT_MS + 500,
    );
  } catch (error) {
    if (
      isGeolocationPositionError(error) &&
      error.code === error.PERMISSION_DENIED
    ) {
      throw error;
    }

    return getPosition(
      {
        enableHighAccuracy: false,
        maximumAge: 0,
        timeout: GEOLOCATION_TIMEOUT_MS,
      },
      GEOLOCATION_TIMEOUT_MS + 1000,
    );
  }
}

export function getPosition(
  options: PositionOptions,
  timeoutMs: number,
): Promise<GeolocationPosition> {
  return withTimeout(
    new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    }),
    timeoutMs,
    "Your browser could not resolve location.",
  );
}

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new LocationVerificationError(message));
    }, timeoutMs);

    promise.then(
      (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

export function isGeolocationPositionError(
  error: unknown,
): error is GeolocationPositionError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "number"
  );
}

export class LocationVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LocationVerificationError";
  }
}
