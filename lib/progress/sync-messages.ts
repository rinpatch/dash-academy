import type { SyncFailure } from "@/lib/progress/sync";

/**
 * One wording per failure, shared by the header control, the save dialog, and the toasts.
 * A learner who sees the same failure in two places should read the same sentence twice.
 */
export function messageFor(failure: SyncFailure | null): string | null {
  switch (failure) {
    case "cancelled":
      return "Cancelled. Try again when you're ready.";
    case "credential-exists":
      return "That authenticator already has a Dash Academy passkey. Sign in with it, or create one using a different authenticator.";
    case "misconfigured":
      return "This site address doesn't match the server's passkey configuration.";
    case "no-record":
      return "This passkey exists, but its Dash Academy profile is missing. Create a new passkey to save the progress on this device.";
    case "passkey-failed":
      return "Your authenticator couldn't complete the passkey request. Your progress is still on this device; try again.";
    case "rejected":
      return "That passkey couldn't be verified. Try again.";
    case "unavailable":
      return "Progress sync isn't configured on this server.";
    case "unsupported-authenticator":
      return "That authenticator can't create the passkey Dash Academy needs. Try another device or authenticator.";
    case "unauthenticated":
      return "Your passkey session expired. Sign in again to save your progress.";
    case "failed":
      return "Dash Platform couldn't save your progress. Your progress is still on this device; try again.";
    case null:
      return null;
    default:
      return "Couldn't save progress. Your progress is still on this device; try again.";
  }
}
