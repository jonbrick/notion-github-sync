const fetch = require("node-fetch");
require("dotenv").config();

// Work repository classification
function getProjectType(repoName) {
  return repoName.startsWith("cortexapps/") ? "Work" : "Personal";
}

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
      const startDateStr = startDate.toISOString().split("T")[0];
      const endDateStr = endDate.toISOString().split("T")[0];

      console.log(
        `🔄 Searching for commits authored by ${
          this.username
        } from ${startDate.toDateString()} to ${endDate.toDateString()}`
      );

      // Search for commits you authored in the date range
      const searchQuery = `author:${this.username} committer-date:${startDateStr}..${endDateStr}`;
      console.log(`🔍 Debug: Search query: ${searchQuery}`);
      const searchResults = await this.makeRequest(
        `${this.baseUrl}/search/commits?q=${encodeURIComponent(
          searchQuery
        )}&per_page=100&sort=committer-date&order=desc`
      );

      // Debug: Log what we found
      console.log(
        `🔍 Debug: Total authored commits found: ${searchResults.total_count}`
      );
      console.log(
        `🔍 Debug: Commits returned: ${searchResults.items?.length || 0}`
      );

      // Show repositories found
      const repoNames = [
        ...new Set(
          (searchResults.items || []).map((item) => item.repository.full_name)
        ),
      ];
      console.log(
        `🔍 Debug: Repositories with your commits: ${repoNames.join(", ")}`
      );

      console.log(
        `📊 Found ${searchResults.items?.length || 0} commits you authored`
      );
      return searchResults.items || [];
    } catch (error) {
      console.error("❌ Error searching for authored commits:", error.message);
      return [];
    }
  }

  async getCommitDetails(repoFullName, sha) {
    try {
      const commit = await this.makeRequest(
        `${this.baseUrl}/repos/${repoFullName}/commits/${sha}`
      );

      // Get PR information for this commit
      const prs = await this.getCommitPRs(repoFullName, sha);
      const prTitles =
        prs.length > 0
          ? prs.map((pr) => `${pr.title} (#${pr.number})`).join(", ")
          : "";

      return {
        sha: commit.sha,
        message: commit.commit.message,
        date: commit.commit.author.date,
        stats: commit.stats,
        files: commit.files || [],
        author: commit.commit.author,
        prs: prs,
        prTitles: prTitles,
      };
    } catch (error) {
      console.error(`❌ Error fetching commit ${sha}:`, error.message);
      return null;
    }
  }

  async getCommitPRs(repoFullName, sha) {
    try {
      // Get PRs associated with this commit
      const prs = await this.makeRequest(
        `${this.baseUrl}/repos/${repoFullName}/commits/${sha}/pulls`
      );
      return prs.map((pr) => ({
        number: pr.number,
        title: pr.title,
        state: pr.state,
        url: pr.html_url,
      }));
    } catch (error) {
      console.error(`❌ Error fetching PRs for commit ${sha}:`, error.message);
      return [];
    }
  }

  async getActivities(startDate, endDate) {
    try {
      // Get GitHub events (replaces Strava activities)
      const commits = await this.getUserEvents(startDate, endDate);

      // Process events into daily activities grouped by repository
      const activities = await this.processEventsIntoActivities(
        commits,
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

  async processEventsIntoActivities(commits, startDate, endDate) {
    const repoGroups = {};

    for (const commitItem of commits) {
      const commit = commitItem.commit;
      const commitDate = new Date(commit.committer.date);
      const dateKey = commitDate.toISOString().split("T")[0]; // YYYY-MM-DD
      const repoName = commitItem.repository.full_name;
      const groupKey = `${repoName}-${dateKey}`;

      if (!repoGroups[groupKey]) {
        repoGroups[groupKey] = {
          repository: repoName,
          date: dateKey,
          commits: [],
          eventDate: commitDate,
        };
      }

      // Get detailed commit information
      const commitDetails = await this.getCommitDetails(
        repoName,
        commitItem.sha
      );
      if (commitDetails) {
        repoGroups[groupKey].commits.push(commitDetails);
      }
    }

    // Convert groups to activities format (matching previous pattern)
    return Object.values(repoGroups)
      .filter((group) => group.commits.length > 0)
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

    // Format PR titles (CSV style)
    const prTitles = repoGroup.commits
      .filter((commit) => commit.prTitles)
      .map((commit) => commit.prTitles)
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
      projectType: getProjectType(repoGroup.repository),
      date: repoGroup.date,
      commitsCount: repoGroup.commits.length,
      commitMessages: commitMessages,
      prTitles: prTitles,
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
