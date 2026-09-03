/**
 * UK Timezone-Aware Thursday 11:59 PM Billing & Tuesday Delivery Schedule Calculator
 */
class BillingScheduleService {
  /**
   * Get the next upcoming Friday at 06:00 AM UK time (immediately after Thursday 11:59 PM cutoff).
   * Enforces the 5-day minimum buffer rule so late signups (Wed/Thu) are pushed to the following week.
   * 
   * @param {Date} [fromDate=new Date()]
   * @param {number} [minBufferDays=5] - Minimum buffer days (default 5 days = 120 hours)
   * @returns {Date} Target Date object in UTC corresponding to Friday 06:00 London time
   */
  getNextFridayMorning(fromDate = new Date(), minBufferDays = 5) {
    const now = new Date(fromDate);
    const isBST = this.isBritishSummerTime(now);
    const ukUtcOffsetHours = isBST ? 1 : 0;

    // Target 06:00 AM London time
    const targetUtcHour = 6 - ukUtcOffsetHours;

    // Friday is day 5 in JS (0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat)
    const currentDay = now.getUTCDay();
    let daysUntilFriday = (5 - currentDay + 7) % 7;

    // Create candidate Friday date in UTC at 06:00 AM London time
    const candidate = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + daysUntilFriday,
      targetUtcHour,
      0,
      0,
      0
    ));

    // Minimum buffer hours (5 days = 120 hours)
    const minBufferHours = minBufferDays * 24;
    const hoursDifference = (candidate.getTime() - now.getTime()) / (1000 * 60 * 60);

    // If candidate Friday is within 5 days of signup, push to following week's Friday (+7 days)
    if (hoursDifference < minBufferHours) {
      candidate.setUTCDate(candidate.getUTCDate() + 7);
    }

    return candidate;
  }

  /**
   * Get the next upcoming Thursday at 23:59 (11:59 PM) UK time (Cut-Off deadline).
   * 
   * @param {Date} [fromDate=new Date()]
   * @param {number} [minBufferDays=5] - Minimum buffer days
   * @returns {Date} Target Date object in UTC corresponding to Thursday 23:59 London time
   */
  getNextThursday1159PM(fromDate = new Date(), minBufferDays = 5) {
    // Current time in UTC
    const now = new Date(fromDate);

    // Determine whether London is in British Summer Time (BST)
    const isBST = this.isBritishSummerTime(now);
    const ukUtcOffsetHours = isBST ? 1 : 0; // BST is UTC+1, GMT is UTC+0

    // Target hour in UTC: 23:59 UK time = (23 - ukUtcOffsetHours) in UTC
    const targetUtcHour = 23 - ukUtcOffsetHours;

    // Calculate days until next Thursday (Thursday = day 4 in JS)
    const currentDay = now.getUTCDay();
    let daysUntilThursday = (4 - currentDay + 7) % 7;

    // Create candidate Thursday date in UTC at 23:59
    const candidate = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + daysUntilThursday,
      targetUtcHour,
      59,
      0,
      0
    ));

    // Minimum buffer hours (e.g. 5 days = 120 hours)
    const minBufferHours = minBufferDays * 24;
    const hoursDifference = (candidate.getTime() - now.getTime()) / (1000 * 60 * 60);

    // If candidate Thursday is within buffer, push to following week's Thursday
    if (hoursDifference < minBufferHours) {
      candidate.setUTCDate(candidate.getUTCDate() + 7);
    }

    return candidate;
  }

  // Alias for Friday early morning billing
  getNextBillingDate(fromDate = new Date(), minBufferDays = 5) {
    return this.getNextFridayMorning(fromDate, minBufferDays);
  }

  // Backward compatibility alias
  getNextThursday7PM(fromDate = new Date(), minBufferDays = 5) {
    return this.getNextFridayMorning(fromDate, minBufferDays);
  }

  /**
   * Get the delivery date associated with a given Thursday cutoff.
   * Delivery is the following Tuesday (5 days after Thursday cutoff).
   * 
   * @param {Date} [thursdayCutoffDate]
   * @returns {Date} Delivery Date object
   */
  getAssociatedDeliveryTuesday(thursdayCutoffDate = null) {
    const thursday = thursdayCutoffDate ? new Date(thursdayCutoffDate) : this.getNextThursday1159PM();
    const deliveryTuesday = new Date(thursday);
    // Tuesday is 5 days after Thursday
    deliveryTuesday.setUTCDate(deliveryTuesday.getUTCDate() + 5);
    return deliveryTuesday;
  }

  /**
   * Format Delivery Date cleanly (e.g. "Tuesday 8th Sept" or "Tue 8 Sept")
   */
  formatDeliveryDate(deliveryDate) {
    const d = new Date(deliveryDate);
    const day = d.getDate();
    const suffix = (day === 1 || day === 21 || day === 31) ? 'st' :
                   (day === 2 || day === 22) ? 'nd' :
                   (day === 3 || day === 23) ? 'rd' : 'th';
    
    const weekday = d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'Europe/London' });
    const month = d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'Europe/London' });
    
    return `${weekday} ${day}${suffix} ${month}`;
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
