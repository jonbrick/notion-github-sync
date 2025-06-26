# Calendar Workout Sync

Automatically sync your Strava workouts to Google Calendar with comprehensive data stored in Notion. Transform your fitness tracking into visual calendar events with rich workout details. Now with manual GPX file upload capability for complete workout data control.

## What This Does

**Complete Workout Pipeline:** Fetch workouts from Strava → Store detailed data in Notion → Create rich calendar events on Google Calendar

**Flexible Date Selection:** Choose between week-based processing or single date selection for precise workout collection

**Manual GPX Upload:** Upload workout files directly when Strava API sync issues occur

**Rich Calendar Events:** Each workout appears on your calendar with duration, distance, activity type, and detailed descriptions

## How It Works

### Three-Script System

1. **`collect-workouts.js`:** Strava API → Notion database storage
2. **`update-workout-cal.js`:** Notion data → Google Calendar events
3. **`upload-gpx-file.js`:** Manual GPX file → Notion database storage

### Data Flow

```
Strava Workouts → Weekly/Single Date Collection → Notion Database → Calendar Creation → Google Calendar
                    ↓
                GPX Files → Manual Upload → Notion Database → Calendar Creation → Google Calendar
```

### Example Output

**Notion Database Record:**

```
Activity Name: Evening Run
Date: June 18, 2025
Activity Type: Run
Start Time: 2025-06-18T18:42:23Z
Duration: 42 minutes
Distance: 4.3 miles
Activity ID: 14844299502
Calendar Created: ✓
```

**Google Calendar Event:**

```
Title: Run - 4.3 miles
Time: June 18, 2025 6:42 PM - 7:24 PM
Calendar: + 3. 💪 Workout
Description:
🏃‍♂️ Evening Run
⏱️ Duration: 42 minutes
📏 Distance: 4.3 miles
📊 Activity Type: Run
🔗 Activity ID: 14844299502
```

## Prerequisites

- Node.js 18+ installed
- Active Strava account with workout data
- Notion account and workspace
- Google account with Calendar access
- Postman (for API testing)

## Setup

### 1. Strava API Application

1. Go to https://www.strava.com/settings/api
2. Create new application:
   - **Application Name:** "Personal Workout Tracker"
   - **Category:** "Data Importer"
   - **Website:** "http://localhost"
   - **Authorization Callback Domain:** "localhost"
3. Note your **Client ID** and **Client Secret**

### 2. Strava OAuth Authentication

Run the OAuth setup:

```bash
node get-google-tokens.js
```

Follow the prompts to:

- Authorize your application with Strava
- Get access token and refresh token
- Required scopes: `read,activity:read`

### 3. Notion Integration

1. Go to https://www.notion.so/my-integrations
2. Create integration: "Strava Workout Tracker"
3. Copy integration token
4. Create database with this schema:

| Property Name    | Type     | Options                                    |
| ---------------- | -------- | ------------------------------------------ |
| Activity Name    | Title    | -                                          |
| Date             | Date     | -                                          |
| Activity Type    | Select   | Run, Workout, Ride, Swim, Hike, Walk, Yoga |
| Start Time       | Text     | -                                          |
| Duration         | Number   | Minutes                                    |
| Distance         | Number   | Miles/km                                   |
| Activity ID      | Number   | -                                          |
| Calendar Created | Checkbox | Default: false                             |

5. Share database with your integration

### 4. Google Calendar API

1. Go to Google Cloud Console
2. Create project: "Calendar Workout Sync"
3. Enable Google Calendar API
4. Create OAuth 2.0 credentials (Desktop application)
5. Use the OAuth helper script to get refresh token
6. Create a dedicated fitness calendar

### 5. Installation

```bash
# Clone/create project
mkdir calendar-workout-sync
cd calendar-workout-sync

# Install dependencies
npm install @notionhq/client googleapis node-fetch@2.7.0 dotenv inquirer

# Copy environment template
cp .env.example .env
```

### 6. Environment Configuration

Create `.env` file with your credentials:

```env
# Strava Configuration
STRAVA_CLIENT_ID=your_strava_client_id
STRAVA_CLIENT_SECRET=your_strava_client_secret
STRAVA_ACCESS_TOKEN=your_strava_access_token
STRAVA_REFRESH_TOKEN=your_strava_refresh_token

# Notion Configuration
NOTION_TOKEN=your_notion_integration_token
NOTION_DATABASE_ID=your_database_id

# Google Calendar Configuration
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REFRESH_TOKEN=your_google_refresh_token
FITNESS_CALENDAR_ID=your_fitness_calendar_id
```

## Usage

### Collect Workout Data

```bash
node collect-workouts.js
```

**Interactive Process:**

1. Tests Strava and Notion connections
2. **Choose selection method:**
   - **Option 1:** Enter a specific Date (DD-MM-YY format)
   - **Option 2:** Select by week number (1-52 for 2025)
3. **For single date:** Enter date like "24-06-25" for June 24, 2025
4. **For week selection:** Shows available weeks, select week number (e.g., "24" for June 8-14)
5. Fetches all Strava activities for selected period
6. Stores comprehensive data in Notion database

### Create Calendar Events

```bash
node update-workout-cal.js
```

**Interactive Process:**

1. Tests Notion and Google Calendar connections
2. **Choose selection method:**
   - **Option 1:** Enter a specific Date (DD-MM-YY format)
   - **Option 2:** Select by week number (1-52 for 2025)
3. **For single date:** Enter date like "24-06-25" for June 24, 2025
4. **For week selection:** Shows available weeks, select week number
5. Reads workouts from Notion (not yet calendared)
6. Creates detailed calendar events
7. Marks workouts as "Calendar Created" in Notion

### Upload GPX File (Manual Backup)

```bash
node upload-gpx-file.js
```

**Interactive Process:**

1. **Option 1:** Provide GPX file path as argument: `node upload-gpx-file.js /path/to/file.gpx`
2. **Option 2:** Run interactively and enter path when prompted
3. Parses GPX file and extracts workout data
4. Converts UTC time to EST automatically
5. Maps activity types to Strava format (e.g., "running" → "Run")
6. Calculates distance, duration, heart rate, cadence, elevation
7. Stores workout data in Notion database

**GPX File Support:**

- Extracts track points, heart rate, cadence data
- Calculates total distance using Haversine formula
- Converts UTC timestamps to EST timezone
- Maps activity types to consistent format
- Handles elevation gain calculations

### Typical Workflow

```bash
# Option 1: Week-based workflow
node collect-workouts.js
# Choose option 2, enter: 25

node update-workout-cal.js
# Choose option 2, enter: 25

# Option 2: Single date workflow
node collect-workouts.js
# Choose option 1, enter: 24-06-25

node update-workout-cal.js
# Choose option 1, enter: 24-06-25

# Option 3: Manual GPX upload (when API fails)
node upload-gpx-file.js
# Enter: /Users/jonbrick/Downloads/Evening_Run_.gpx
```

## Project Structure

```
calendar-workout-sync/
├── README.md
├── package.json
├── .env.example
├── .gitignore
├── collect-workouts.js         # Script 1: Data collection (week or single date)
├── update-workout-cal.js       # Script 2: Calendar creation (week or single date)
├── upload-gpx-file.js          # Script 3: Manual GPX file upload
├── lib/
│   ├── strava-client.js        # Strava API interface
│   ├── notion-client.js        # Notion database operations
│   ├── calendar-client.js      # Google Calendar operations
│   └── week-utils.js           # Week calculation utilities
└── postman/
    └── strava-api-tests.json   # API testing collection
```

## Dependencies

**Core Dependencies:**

- `@notionhq/client` - Notion API integration
- `googleapis` - Google Calendar API
- `node-fetch@2.7.0` - HTTP requests for Strava API
- `dotenv` - Environment variable management
- `xml2js` - GPX file parsing

**Key Features:**

- Automatic token refresh for Strava API
- Timezone conversion (UTC to EST)
- GPX file parsing with heart rate and cadence data
- Interactive command-line interface
- Comprehensive error handling

## Week Numbering System

- **Week 1:** December 29, 2024 - January 4, 2025 (includes Jan 1)
- **Week 2:** January 5 - January 11, 2025
- **Week 25:** June 15 - June 21, 2025
- **Week 52:** December 21 - December 27, 2025

Weeks run Sunday through Saturday with Week 1 starting on the Sunday before January 1st.

## Testing

### Test Individual Components

```bash
# Test Strava connection
node -e "const StravaClient = require('./lib/strava-client.js'); const client = new StravaClient(); client.testConnection();"

# Test Notion connection
node -e "const NotionClient = require('./lib/notion-client.js'); const client = new NotionClient(); client.testConnection();"

# Test Google Calendar connection
node -e "const CalendarClient = require('./lib/calendar-client.js'); const client = new CalendarClient(); client.testConnection();"

# Test week calculations
node -e "const { getWeekBoundaries } = require('./lib/week-utils.js'); console.log('Week 25:', getWeekBoundaries(2025, 25));"
```

### API Testing with Postman

1. Import `postman/strava-api-tests.json`
2. Set up environment with your Strava tokens
3. Test authentication and data retrieval
4. Verify API rate limits and responses

## Troubleshooting

### Common Issues

**Strava Token Expired:**

- Tokens expire every 6 hours
- Use refresh token to get new access token
- Check token expiration in error messages

**Strava API Missing Workouts:**

- Some workouts may not appear in API due to sync issues
- Use `upload-gpx-file.js` as backup method
- Download GPX file from Strava and upload manually

**Notion Database Access:**

- Verify integration is shared with database
- Check database ID in environment variables
- Ensure property names match exactly

**Google Calendar Permission:**

- Verify calendar ID is correct
- Check OAuth scopes include calendar write access
- Ensure calendar exists and is writable

**Week Selection Issues:**

- Week numbers run 1-52 for 2025
- Check date ranges match expected weeks
- Verify timezone handling for date boundaries

**Single Date Selection:**

- Use DD-MM-YY format (e.g., "24-06-25")
- Date validation prevents future dates
- Past dates are now allowed for historical data

**GPX Upload Issues:**

- Ensure GPX file contains valid track data
- Check file path is correct (use absolute path if needed)
- Verify GPX file has proper metadata and track points
- Timezone conversion automatically handles UTC to EST

### Data Recovery

- **Missing workouts:** Re-run collect-workouts.js for affected weeks/dates
- **API sync issues:** Use upload-gpx-file.js for manual upload
- **Duplicate calendar events:** Script checks for existing events
- **Wrong week data:** Verify week number calculation
- **Timezone issues:** GPX upload automatically converts UTC to EST

## Maintenance

### Weekly Tasks

- Run data collection for previous week or specific dates
- Create calendar events for collected data
- Verify events appear correctly on calendar
- Check for any missing workouts and use GPX upload if needed

### Token Management

- **Strava tokens:** Expire every 6 hours, auto-refresh needed
- **Google tokens:** Long-lived refresh tokens
- **Notion tokens:** No expiration

### Database Management

- **Lock Notion database** to prevent structure changes
- **Export data** monthly for backup
- **Monitor rate limits** for all APIs

## New Features & Improvements

### Enhanced Date Selection

- **Single date selection:** Process specific dates instead of full weeks
- **Flexible input:** DD-MM-YY format for easy date entry
- **Historical data support:** Can now process past dates

### Manual GPX Upload

- **Backup method:** Upload GPX files when API fails
- **Complete data extraction:** Heart rate, cadence, elevation, distance
- **Timezone handling:** Automatic UTC to EST conversion
- **Activity type mapping:** Consistent format across all methods

### Improved User Experience

- **Interactive prompts:** User-friendly command-line interface
- **Consistent language:** Matches other fitness tracking scripts
- **Better error handling:** Clear error messages and recovery options
- **Progress feedback:** Detailed output during processing

### Data Consistency

- **Unified format:** All scripts use same data structure
- **Activity type standardization:** "Run", "Ride", "Swim", etc.
- **Timezone consistency:** EST timezone across all operations

## Rate Limits & Performance

### API Limits

- **Strava:** 100 requests/15min, 1000/day
- **Notion:** 3 requests/second
- **Google Calendar:** 1000 requests/100 seconds

### Optimization

- **Batch processing:** Process full weeks at once
- **Incremental updates:** Only process new workouts
- **Efficient filtering:** Use date ranges and status flags

## Privacy & Data

### Data Storage

- **Workout data:** Stored in personal Notion workspace
- **API tokens:** Stored locally in .env (never committed)
- **Calendar events:** Created in personal Google Calendar

### Data Control

- **Full ownership:** All data remains in your accounts
- **Export capability:** Notion data can be exported anytime
- **Revocable access:** API permissions can be revoked anytime

## Contributing

This is a personal tracking system, but improvements welcome:

- Enhanced error handling and recovery
- Additional Strava metrics integration
- Better timezone handling for travel
- Automated token refresh workflows

## License

MIT License - Use this code for your own personal fitness tracking needs.

---

**Built with:** Strava API, Notion API, Google Calendar API, Node.js  
**Time saved:** Automated workout calendar creation! 🎉
