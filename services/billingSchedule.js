/**
 * UK Timezone-Aware Thursday 7:00 PM Billing Schedule Calculator
 */
class BillingScheduleService {
  /**
   * Get the next upcoming Thursday at 19:00 (7:00 PM) UK time.
   * Handles London GMT (UTC+0) and BST (UTC+1) daylight saving automatically.
   * 
   * @param {Date} [fromDate=new Date()]
   * @param {number} [cutoffHours=24] - Minimum buffer hours after initial checkout before a renewal can trigger
   * @returns {Date} Target Date object in UTC corresponding to Thursday 19:00 London time
   */
  getNextThursday7PM(fromDate = new Date(), cutoffHours = 24) {
    // Current time in UTC
    const now = new Date(fromDate);

    // Determine whether London is in British Summer Time (BST)
    const isBST = this.isBritishSummerTime(now);
    const ukUtcOffsetHours = isBST ? 1 : 0; // BST is UTC+1, GMT is UTC+0

    // Target hour in UTC: 19:00 UK time = (19 - ukUtcOffsetHours) in UTC
    const targetUtcHour = 19 - ukUtcOffsetHours;

    // Calculate days until next Thursday (Thursday = day 4 in JS: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat)
    const currentDay = now.getUTCDay();
    let daysUntilThursday = (4 - currentDay + 7) % 7;

    // Create candidate Thursday date in UTC
    const candidate = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + daysUntilThursday,
      targetUtcHour,
      0,
      0,
      0
    ));

    // If candidate is within the cutoff window from checkout (e.g. less than 24 hours away or in the past), push to following Thursday
    const hoursDifference = (candidate.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (hoursDifference < cutoffHours) {
      candidate.setUTCDate(candidate.getUTCDate() + 7);
    }

    return candidate;
  }

  /**
   * Check if a given date falls within British Summer Time (BST)
   * BST starts last Sunday in March, ends last Sunday in October
   */
  isBritishSummerTime(date) {
    const year = date.getUTCFullYear();
    
    // Last Sunday in March
    const marchLastSunday = new Date(Date.UTC(year, 2, 31));
    marchLastSunday.setUTCDate(31 - marchLastSunday.getUTCDay());
    marchLastSunday.setUTCHours(1, 0, 0, 0);

    // Last Sunday in October
    const octLastSunday = new Date(Date.UTC(year, 9, 31));
    octLastSunday.setUTCDate(31 - octLastSunday.getUTCDay());
    octLastSunday.setUTCHours(1, 0, 0, 0);

    return date >= marchLastSunday && date < octLastSunday;
  }

  /**
   * Format the next billing date for display
   */
  formatUKBillingDate(date) {
    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/London'
    }) + ' UK Time';
  }
}

module.exports = new BillingScheduleService();
