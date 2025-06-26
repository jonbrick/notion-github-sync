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

// Function to get week boundaries for a specific date
function getWeekBoundariesForDate(date) {
  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.

  // Calculate Sunday (start of week)
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - dayOfWeek);
  weekStart.setHours(0, 0, 0, 0);

  // Calculate Saturday (end of week)
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return { weekStart, weekEnd };
}

async function main() {
  console.log("🗓️ Calendar Event Creator 2025\n");

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
  console.log("📊 Database: Workout Data\n");

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

  // Get workouts from Notion
  const workouts = await notion.getWorkoutsForWeek(weekStart, weekEnd);

  if (workouts.length === 0) {
    console.log("📭 No workouts found without calendar events for this period");
    console.log(
      "💡 Try running collect-workouts.js first to gather workout data"
    );
    rl.close();
    return;
  }

  if (optionInput === "1") {
    console.log(
      `🔄 Fetching workout sessions from ${
        selectedDate.toISOString().split("T")[0]
      } to ${selectedDate.toISOString().split("T")[0]}`
    );
  }

  console.log(`🗓️ Found ${workouts.length} workout sessions\n`);

  console.log("🗓️ Processing workout sessions:");
  workouts.forEach((workout, index) => {
    if (optionInput === "1") {
      console.log(
        `  ${index + 1}. ${
          workout.activityName
        } - Date ${selectedDate.toDateString()}`
      );
    } else {
      console.log(`  ${index + 1}. ${workout.activityName} - ${workout.date}`);
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

  for (const workout of workouts) {
    try {
      await calendar.createWorkoutEvent(workout);
      await notion.markCalendarCreated(workout.id);
      createdCount++;

      if (optionInput === "1") {
        console.log(
          `✅ Processing Date ${selectedDate.toDateString()} from Notion Date ${
            workout.date
          }`
        );
        console.log(
          `✅ Created calendar event for Date: ${selectedDate.toDateString()} (Notion Date: ${
            workout.date
          })`
        );
        console.log(
          `✅ Created ${selectedDate.toDateString()}: ${
            workout.activityName
          } | ${workout.type} | ${
            workout.distance
              ? (workout.distance / 1000).toFixed(2) + "km"
              : "N/A"
          }`
        );
      } else {
        console.log(`✅ Created: ${workout.activityName}`);
      }
    } catch (error) {
      console.error(
        `❌ Failed to create calendar event for ${workout.activityName}:`,
        error.message
      );
    }
  }

  console.log(`\n✅ Successfully created ${createdCount} calendar events!`);
  console.log("🎯 Check your fitness calendar to see the workouts!");
}

main().catch(console.error);
