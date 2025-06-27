const NotionClient = require("./lib/notion-client.js");
const CalendarClient = require("./lib/calendar-client.js");
const {
  getWeekBoundaries,
  generateWeekOptions,
} = require("./lib/week-utils.js");
const readline = require("readline");

// Create clients
const notion = new NotionClient();
const calendar = new CalendarClient();

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Function to validate DD-MM-YY date format
function validateDate(dateString) {
  const dateRegex = /^(\d{1,2})-(\d{1,2})-(\d{2})$/;
  const match = dateString.match(dateRegex);

  if (!match) {
    return {
      valid: false,
      error: "Invalid format. Please use DD-MM-YY (e.g., 15-03-25)",
    };
  }

  const [, day, month, year] = match;
  const fullYear = 2000 + parseInt(year);
  const date = new Date(fullYear, parseInt(month) - 1, parseInt(day));

  // Check if the date is valid
  if (
    date.getFullYear() !== fullYear ||
    date.getMonth() !== parseInt(month) - 1 ||
    date.getDate() !== parseInt(day)
  ) {
    return {
      valid: false,
      error: "Invalid date. Please check day, month, and year.",
    };
  }

  return { valid: true, date };
}

async function main() {
  console.log("📅 GitHub Calendar Event Creator 2025\n");

  // Test connections
  console.log("Testing connections...");
  const notionOk = await notion.testConnection();
  const calendarOk = await calendar.testConnection();

  if (!notionOk || !calendarOk) {
    console.log("❌ Connection failed. Please check your .env file.");
    process.exit(1);
  }

  console.log("✅ Notion connection successful!");
  console.log("✅ Calendar connection successful!");
  console.log("📊 Database: GitHub Data\n");

  console.log("📅 Choose your selection method:");
  console.log("  1. Enter a specific Date (DD-MM-YY format)");
  console.log("  2. Select by week number");

  const optionInput = await askQuestion("? Choose option (1 or 2): ");

  let weekStart, weekEnd, dateRangeLabel, selectedDate;

  if (optionInput === "1") {
    // Specific date input
    let validDate = false;

    while (!validDate) {
      const dateInput = await askQuestion(
        "? Enter Date in DD-MM-YY format (e.g., 15-03-25): "
      );

      const validation = validateDate(dateInput);
      if (validation.valid) {
        selectedDate = validation.date;
        validDate = true;
      } else {
        console.log(`❌ ${validation.error}`);
      }
    }

    // Set start and end to the same day
    weekStart = new Date(selectedDate);
    weekStart.setHours(0, 0, 0, 0);

    weekEnd = new Date(selectedDate);
    weekEnd.setHours(23, 59, 59, 999);

    dateRangeLabel = `Date: ${selectedDate.toDateString()}`;
  } else if (optionInput === "2") {
    // Week selection (current behavior)
    console.log("\n📅 Available weeks:");
    const weeks = generateWeekOptions(2025);

    // Show first few weeks as examples
    weeks.slice(0, 5).forEach((week, index) => {
      console.log(`  ${week.value} - ${week.label}`);
    });
    console.log("  ...");
    console.log(`  52 - ${weeks[51].label}\n`);

    const weekInput = await askQuestion(
      "? Which week to create calendar events? (enter week number): "
    );
    const weekNumber = parseInt(weekInput);

    if (weekNumber < 1 || weekNumber > 52) {
      console.log("❌ Invalid week number");
      process.exit(1);
    }

    const weekData = getWeekBoundaries(2025, weekNumber);
    weekStart = weekData.weekStart;
    weekEnd = weekData.weekEnd;
    dateRangeLabel = `Week ${weekNumber}`;
  } else {
    console.log("❌ Invalid option. Please choose 1 or 2.");
    process.exit(1);
  }

  if (optionInput === "1") {
    console.log(
      `\n📊 Creating calendar events for Date ${selectedDate.toDateString()}`
    );
    console.log(`📅 Date: ${selectedDate.toDateString()}`);
    console.log(
      `📱 Calendar Date: ${selectedDate.toDateString()} (${
        selectedDate.toISOString().split("T")[0]
      })\n`
    );

    console.log("📋 Summary:");
    console.log("📊 Single day operation");
    console.log(`📅 Date: ${selectedDate.toDateString()}`);
    console.log(
      `📱 Calendar Date: ${selectedDate.toDateString()} (${
        selectedDate.toISOString().split("T")[0]
      })\n`
    );

    const proceed = await askQuestion(
      "? Proceed with creating calendar events for this period? (y/n): "
    );
    if (proceed.toLowerCase() !== "y") {
      console.log("❌ Operation cancelled");
      process.exit(0);
    }

    console.log(
      `🔄 Fetching Notion dates ${
        selectedDate.toISOString().split("T")[0]
      } to ${
        selectedDate.toISOString().split("T")[0]
      } for Date ${selectedDate.toDateString()} - ${selectedDate.toDateString()}`
    );
  } else {
    console.log(`\n📊 Creating calendar events for ${dateRangeLabel}`);
    console.log(
      `📅 Date range: ${weekStart.toDateString()} - ${weekEnd.toDateString()}\n`
    );
  }

  // Get GitHub activities from Notion (instead of workouts)
  const githubActivities = await notion.getWorkoutsForWeek(weekStart, weekEnd);

  if (githubActivities.length === 0) {
    console.log(
      "📭 No GitHub activities found without calendar events for this period"
    );
    console.log("💡 Try running collect-github.js first to gather GitHub data");
    rl.close();
    return;
  }

  if (optionInput === "1") {
    console.log(
      `🔄 Fetching GitHub activities from ${
        selectedDate.toISOString().split("T")[0]
      } to ${selectedDate.toISOString().split("T")[0]}`
    );
  }

  console.log(`🗓️ Found ${githubActivities.length} GitHub activities\n`);

  console.log("🗓️ Processing GitHub activities:");
  githubActivities.forEach((activity, index) => {
    const projectType = activity.projectType || "Personal"; // Default to Personal if not set
    if (optionInput === "1") {
      console.log(
        `  ${index + 1}. ${
          activity.repository
        } (${projectType}) - Date ${selectedDate.toDateString()}`
      );
    } else {
      console.log(
        `  ${index + 1}. ${activity.repository} (${projectType}) - ${
          activity.date
        }`
      );
    }
  });

  const finalConfirm = await askQuestion(
    "\n? Proceed with creating these calendar events? (y/n): "
  );

  if (finalConfirm.toLowerCase() !== "y") {
    console.log("❌ Operation cancelled");
    rl.close();
    return;
  }

  rl.close();

  console.log("\n🗓️ Creating calendar events:");
  let createdCount = 0;
  let workCount = 0;
  let personalCount = 0;

  for (const activity of githubActivities) {
    try {
      // Transform activity to match expected format for calendar
      const calendarActivity = {
        repository: activity.repository,
        date: activity.date,
        commitsCount: activity.commitsCount,
        commitMessages: activity.commitMessages,
        prTitles: activity.prTitles || "",
        totalLinesAdded: activity.totalLinesAdded,
        totalLinesDeleted: activity.totalLinesDeleted,
        totalChanges: activity.totalLinesAdded + activity.totalLinesDeleted,
        projectType: activity.projectType || "Personal",
      };

      await calendar.createGitHubEvent(calendarActivity);
      await notion.markCalendarCreated(activity.id);
      createdCount++;

      // Count by type
      if (calendarActivity.projectType === "Work") {
        workCount++;
      } else {
        personalCount++;
      }

      if (optionInput === "1") {
        console.log(
          `✅ Processing Date ${selectedDate.toDateString()} from Notion Date ${
            activity.date
          }`
        );
        console.log(
          `✅ Created calendar event for Date: ${selectedDate.toDateString()} (Notion Date: ${
            activity.date
          })`
        );
        console.log(
          `✅ Created ${selectedDate.toDateString()}: ${
            activity.repository
          } | ${activity.commitsCount} commits | ${
            calendarActivity.totalChanges
          } changes`
        );
      } else {
        console.log(
          `✅ Created: ${activity.repository} (${calendarActivity.projectType})`
        );
      }
    } catch (error) {
      console.error(
        `❌ Failed to create calendar event for ${activity.repository}:`,
        error.message
      );
    }
  }

  console.log(`\n✅ Successfully created ${createdCount} calendar events!`);
  if (workCount > 0) {
    console.log(`🏢 Work calendar: ${workCount} events`);
  }
  if (personalCount > 0) {
    console.log(`🏠 Personal calendar: ${personalCount} events`);
  }
  console.log("🎯 Check your calendars to see the GitHub activities!");
}

main().catch(console.error);
