const GitHubClient = require("./lib/github-client.js");
const NotionClient = require("./lib/notion-client.js");
const {
  testConnections,
  getDateSelection,
  calculateSearchRange,
  closeReadline,
  askQuestion,
} = require("./lib/cli-utils.js");

// Create clients
const github = new GitHubClient();
const notion = new NotionClient();

async function main() {
  console.log("🔨 GitHub Activity Collector 2025\n");

  // Test connections
  await testConnections({ github, notion });

  // Get date selection
  const { weekStart, weekEnd, dateRangeLabel, selectedDate, optionInput } =
    await getDateSelection();

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

  closeReadline();

  // Fetch activities from GitHub
  let activities;
  if (optionInput === "1") {
    // Use UTC boundaries for single date
    const searchRange = calculateSearchRange(selectedDate);
    activities = await github.getActivities(
      searchRange.startUTC,
      searchRange.endUTC
    );
    // Filter to only activities matching the requested EST date
    const requestedEstDateStr = searchRange.estStartOfDay
      .toISOString()
      .split("T")[0];
    activities = activities.filter((a) => a.date === requestedEstDateStr);
    console.log(
      `🔍 Filtered to ${activities.length} activities for EST date ${requestedEstDateStr}`
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
