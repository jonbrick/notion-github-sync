const GitHubClient = require("./lib/github-client.js");
const NotionClient = require("./lib/notion-client.js");
const {
  getWeekBoundaries,
  generateWeekOptions,
} = require("./lib/week-utils.js");
const readline = require("readline");

// Create clients
const github = new GitHubClient();
const notion = new NotionClient();

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
  // Get day of week (0 = Sunday, 1 = Monday, etc.)
  const dayOfWeek = date.getDay();

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

function calculateSearchRange(selectedDate) {
  // Create EST day boundaries (local time)
  const estStartOfDay = new Date(
    selectedDate.getFullYear(),
    selectedDate.getMonth(),
    selectedDate.getDate(),
    0,
    0,
    0
  );
  const estEndOfDay = new Date(
    selectedDate.getFullYear(),
    selectedDate.getMonth(),
    selectedDate.getDate(),
    23,
    59,
    59
  );

  // Convert EST to UTC (EST is UTC-5, so add 5 hours to get UTC)
  const startUTC = new Date(estStartOfDay.getTime() + 5 * 60 * 60 * 1000);
  const endUTC = new Date(estEndOfDay.getTime() + 5 * 60 * 60 * 1000);

  return {
    estStartOfDay,
    estEndOfDay,
    startUTC,
    endUTC,
  };
}

async function main() {
  console.log("🔨 GitHub Activity Collector 2025\n");

  // Test connections
  console.log("Testing connections...");
  const githubOk = await github.testConnection();
  const notionOk = await notion.testConnection();

  if (!githubOk || !notionOk) {
    console.log("❌ Connection failed. Please check your .env file.");
    process.exit(1);
  }

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
      "? Which week to collect? (enter week number): "
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
      `\n📊 Collecting GitHub activity for Date ${selectedDate.toDateString()} (Eastern)`
    );
    console.log(`📅 Eastern Date: ${selectedDate.toDateString()}`);
    console.log(
      `📱 GitHub Date (UTC): ${selectedDate.toDateString()} (${
        selectedDate.toISOString().split("T")[0]
      })\n`
    );

    console.log("📋 Summary:");
    console.log("📊 Single day operation");
    console.log(`📅 Eastern Date: ${selectedDate.toDateString()}`);
    console.log(
      `📱 GitHub Date (UTC): ${selectedDate.toDateString()} (${
        selectedDate.toISOString().split("T")[0]
      })\n`
    );

    const searchRange = calculateSearchRange(selectedDate);
    console.log("🔍 Search Details:");
    console.log(`   EST date requested: ${selectedDate.toDateString()}`);
    console.log(
      `   EST day boundaries: ${searchRange.estStartOfDay.toLocaleString(
        "en-US",
        { timeZone: "America/New_York" }
      )} to ${searchRange.estEndOfDay.toLocaleString("en-US", {
        timeZone: "America/New_York",
      })}`
    );
    console.log(
      `   UTC search range: ${searchRange.startUTC.toISOString()} to ${searchRange.endUTC.toISOString()}\n`
    );

    const proceed = await askQuestion(
      "? Proceed with collecting GitHub activity for this period? (y/n): "
    );
    if (proceed.toLowerCase() !== "y") {
      console.log("❌ Operation cancelled");
      process.exit(0);
    }

    console.log(
      `🔄 Fetching GitHub dates ${
        selectedDate.toISOString().split("T")[0]
      } to ${
        selectedDate.toISOString().split("T")[0]
      } for Date ${selectedDate.toDateString()} - ${selectedDate.toDateString()}`
    );
  } else {
    console.log(`\n📊 Collecting GitHub activity for ${dateRangeLabel}`);
    console.log(
      `📅 Date range: ${weekStart.toDateString()} - ${weekEnd.toDateString()}\n`
    );
  }

  rl.close();

  // Fetch activities from GitHub
  let activities;
  if (optionInput === "1") {
    // Use UTC boundaries for single date
    const searchRange = calculateSearchRange(selectedDate);
    activities = await github.getActivities(
      searchRange.startUTC,
      searchRange.endUTC
    );
  } else {
    // Use local boundaries for week selection
    activities = await github.getActivities(weekStart, weekEnd);
  }

  if (activities.length === 0) {
    console.log("📭 No GitHub activity found for this period");
    return;
  }

  if (optionInput === "1") {
    console.log(
      `🔄 Fetching GitHub activity from ${
        selectedDate.toISOString().split("T")[0]
      } to ${selectedDate.toISOString().split("T")[0]}`
    );
  }

  console.log(`🔨 Found ${activities.length} repositories with activity\n`);

  console.log("🔨 Processing GitHub activities:");
  let savedCount = 0;

  for (const activity of activities) {
    try {
      console.log(
        `🔄 Processing activity: ${activity.repository} - ${activity.date} - ${activity.commitsCount} commits`
      );
      await notion.createWorkoutRecord(activity);
      savedCount++;

      if (optionInput === "1") {
        console.log(
          `✅ Processing Eastern Date ${selectedDate.toDateString()} from GitHub Date ${
            activity.date
          }`
        );
        console.log(
          `✅ Created GitHub record for Eastern Date: ${selectedDate.toDateString()} (GitHub Date: ${
            activity.date
          })`
        );
        console.log(
          `✅ Saved Eastern ${selectedDate.toDateString()}: ${
            activity.repository
          } | ${activity.commitsCount} commits | ${
            activity.totalChanges
          } changes`
        );
      } else {
        console.log(
          `✅ Saved ${activity.repository}: ${activity.commitsCount} commits | ${activity.totalChanges} changes`
        );
      }
    } catch (error) {
      console.error(`❌ Failed to save ${activity.repository}:`, error.message);
    }
  }

  console.log(
    `\n✅ Successfully saved ${savedCount} GitHub activities to Notion!`
  );
  console.log("🎯 Next: Run update-github-cal.js to add them to your calendar");
}

main().catch(console.error);
