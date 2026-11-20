import "server-only";
import { site } from "@/data/site";
import { CLOSED_STATUSES, type Booking } from "./sheets";
import { nowInCafeTimeZone } from "./validation";

/** Whether the guest can still change or cancel this booking online, and why not. */
export function manageState(b: Booking, now = nowInCafeTimeZone()): { canCancel: boolean; canChange: boolean; reason?: string } {
  if (CLOSED_STATUSES.includes(b.status)) {
    return {
      canCancel: false,
      canChange: false,
      reason: `This booking is ${b.status.toLowerCase()}, so it can no longer be changed online.`,
    };
  }
  if (b.date < now.date || (b.date === now.date && b.time <= now.time)) {
    return { canCancel: false, canChange: false, reason: "This booking time has passed, so it can no longer be changed online." };
  }
  if (b.event) {
    return {
      canCancel: true,
      canChange: false,
      reason: `Event bookings can be cancelled here; to change the number of guests, please call us on ${site.contact.phoneDisplay}.`,
    };
  }
  return { canCancel: true, canChange: true };
}
