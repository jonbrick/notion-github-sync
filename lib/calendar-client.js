const { google } = require("googleapis");
require("dotenv").config();

class CalendarClient {
  constructor() {
    this.auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    this.auth.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    });

    this.calendar = google.calendar({ version: "v3", auth: this.auth });
    this.calendarId = process.env.FITNESS_CALENDAR_ID;
  }

  async testConnection() {
    try {
      const calendars = await this.calendar.calendarList.list();
      console.log("✅ Google Calendar connection successful!");
      console.log(`📅 Found ${calendars.data.items.length} calendars`);
      return true;
    } catch (error) {
      console.error("❌ Calendar connection failed:", error.message);
      return false;
    }
  }

  async createWorkoutEvent(workout) {
    try {
      // Parse the UTC time but treat it as if it were local time
      // This preserves the actual workout time from Strava
      const startTime = new Date(workout.startTime.replace("Z", ""));
      const endTime = new Date(
        startTime.getTime() + workout.duration * 60 * 1000
      );

      const title = this.formatEventTitle(workout);
      const description = this.formatEventDescription(workout);

      const event = {
        summary: title,
        description: description,
        start: { dateTime: startTime.toISOString() },
        end: { dateTime: endTime.toISOString() },
      };

      const response = await this.calendar.events.insert({
        calendarId: this.calendarId,
        resource: event,
      });

      console.log(`✅ Created calendar event: ${title}`);
      return response;
    } catch (error) {
      console.error("❌ Error creating calendar event:", error.message);
      throw error;
    }
  }

  formatEventTitle(workout) {
    if (workout.distance > 0) {
      return `${workout.activityType} - ${workout.distance} miles`;
    } else {
      return `${workout.activityName}`;
    }
  }

  formatEventDescription(workout) {
    let description = `🏃‍♂️ ${workout.activityName}\n`;
    description += `⏱️ Duration: ${workout.duration} minutes\n`;

    if (workout.distance > 0) {
      description += `📏 Distance: ${workout.distance} miles\n`;
    }

    description += `📊 Activity Type: ${workout.activityType}\n`;
    description += `🔗 Activity ID: ${workout.activityId}`;

    return description;
  }
}

module.exports = CalendarClient;
