const fetch = require("node-fetch");
require("dotenv").config();

class GitHubClient {
  constructor() {
    this.token = process.env.GITHUB_TOKEN;
    this.username = process.env.GITHUB_USERNAME;
    this.baseUrl = "https://api.github.com";
  }

  async makeRequest(url, options = {}) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(
          `GitHub API error: ${response.status} ${response.statusText}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error("❌ GitHub API request failed:", error.message);
      throw error;
    }
  }

  async testConnection() {
    try {
      const user = await this.makeRequest(`${this.baseUrl}/user`);
      console.log("✅ GitHub connection successful!");
      console.log(`👤 User: ${user.name} (@${user.login})`);
      return true;
    } catch (error) {
      console.error("❌ GitHub connection failed:", error.message);
      return false;
    }
  }

  async getUserEvents(startDate, endDate) {
    try {
      console.log(
        `🔄 Fetching GitHub events from ${startDate.toDateString()} to ${endDate.toDateString()}`
      );

      // Get user events (your activity)
      const events = await this.makeRequest(
        `${this.baseUrl}/users/${this.username}/events?per_page=100`
      );

      // Filter events by date range and event types we care about
      const filteredEvents = events.filter((event) => {
        const eventDate = new Date(event.created_at);
        return (
          eventDate >= startDate &&
          eventDate <= endDate &&
          ["PushEvent", "PullRequestEvent"].includes(event.type)
        );
      });

      console.log(`📊 Found ${filteredEvents.length} relevant events`);
      return filteredEvents;
    } catch (error) {
      console.error("❌ Error fetching GitHub events:", error.message);
      return [];
    }
  }

  async getCommitDetails(repoFullName, sha) {
    try {
      const commit = await this.makeRequest(
        `${this.baseUrl}/repos/${repoFullName}/commits/${sha}`
      );
      return {
        sha: commit.sha,
        message: commit.commit.message,
        date: commit.commit.author.date,
        stats: commit.stats,
        files: commit.files || [],
        author: commit.commit.author,
      };
    } catch (error) {
      console.error(`❌ Error fetching commit ${sha}:`, error.message);
      return null;
    }
  }

  async getActivities(startDate, endDate) {
    try {
      // Get GitHub events (replaces Strava activities)
      const events = await this.getUserEvents(startDate, endDate);

      // Process events into daily activities grouped by repository
      const activities = await this.processEventsIntoActivities(
        events,
        startDate,
        endDate
      );

      console.log(`🔨 Found ${activities.length} repositories with activity`);
      return activities;
    } catch (error) {
      console.error("❌ Error getting GitHub activities:", error.message);
      return [];
    }
  }

  async processEventsIntoActivities(events, startDate, endDate) {
    const repoGroups = {};

    for (const event of events) {
      const eventDate = new Date(event.created_at);
      const dateKey = eventDate.toISOString().split("T")[0]; // YYYY-MM-DD
      const repoName = event.repo.name;
      const groupKey = `${repoName}-${dateKey}`;

      if (!repoGroups[groupKey]) {
        repoGroups[groupKey] = {
          repository: repoName,
          date: dateKey,
          commits: [],
          pullRequests: [],
          eventDate: eventDate,
        };
      }

      if (event.type === "PushEvent") {
        // Get detailed commit information
        for (const commit of event.payload.commits || []) {
          if (commit.distinct) {
            // Only count distinct commits
            const commitDetails = await this.getCommitDetails(
              repoName,
              commit.sha
            );
            if (commitDetails) {
              repoGroups[groupKey].commits.push(commitDetails);
            }
          }
        }
      } else if (event.type === "PullRequestEvent") {
        repoGroups[groupKey].pullRequests.push({
          action: event.payload.action,
          number: event.payload.number,
          title: event.payload.pull_request.title,
          date: event.created_at,
        });
      }
    }

    // Convert groups to activities format (matching Strava pattern)
    return Object.values(repoGroups)
      .filter(
        (group) => group.commits.length > 0 || group.pullRequests.length > 0
      )
      .map((group) => this.convertToActivity(group));
  }

  convertToActivity(repoGroup) {
    // Calculate aggregated stats
    const totalStats = repoGroup.commits.reduce(
      (acc, commit) => ({
        additions: acc.additions + (commit.stats?.additions || 0),
        deletions: acc.deletions + (commit.stats?.deletions || 0),
        total: acc.total + (commit.stats?.total || 0),
      }),
      { additions: 0, deletions: 0, total: 0 }
    );

    // Get unique files
    const allFiles = repoGroup.commits.flatMap((commit) =>
      (commit.files || []).map((file) => file.filename)
    );
    const uniqueFiles = [...new Set(allFiles)];

    // Format commit messages (CSV style)
    const commitMessages = repoGroup.commits
      .map((commit) => {
        const time = new Date(commit.date)
          .toISOString()
          .split("T")[1]
          .split(".")[0];
        return `${commit.message.split("\n")[0]} (${time})`;
      })
      .join(", ");

    // Get time range
    const commitTimes = repoGroup.commits.map((c) => new Date(c.date));
    const startTime =
      commitTimes.length > 0
        ? new Date(Math.min(...commitTimes))
        : repoGroup.eventDate;
    const endTime =
      commitTimes.length > 0
        ? new Date(Math.max(...commitTimes))
        : repoGroup.eventDate;

    // Convert to activity format (matching Strava structure)
    return {
      name: repoGroup.repository,
      type: "Development",
      start_date: startTime.toISOString(),
      start_date_local: startTime.toISOString(),
      id: `${repoGroup.repository}-${repoGroup.date}`.replace(
        /[^a-zA-Z0-9-]/g,
        "-"
      ),

      // GitHub-specific data
      repository: repoGroup.repository,
      date: repoGroup.date,
      commitsCount: repoGroup.commits.length,
      commitMessages: commitMessages,
      pullRequestsCount: repoGroup.pullRequests.length,
      filesChanged: uniqueFiles.length,
      filesChangedList: uniqueFiles.join(", "),
      totalLinesAdded: totalStats.additions,
      totalLinesDeleted: totalStats.deletions,
      totalChanges: totalStats.total,

      // Times for calendar
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration: Math.max(1, Math.round((endTime - startTime) / (1000 * 60))), // minutes, minimum 1
    };
  }
}

module.exports = GitHubClient;
