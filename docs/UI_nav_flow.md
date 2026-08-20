# KOJ UI Navigation Flow

This document describes how users move through the current KOJ web UI. It is a route and interaction reference for the implemented UI milestone. Data, authentication outcomes, registration, judging, and administration actions are partly mocked unless noted otherwise.

## Navigation Model

KOJ has two entry states:

- **Signed out:** The primary entry point is `/`. Public users can also open the problem archive, contests, rankings, and submission status directly.
- **Signed in:** The primary Home link resolves to `/dashboard`. The landing page's main action also becomes **Enter App**, which opens the dashboard.

The shared `Navigation` component appears on the landing page, dashboard, problem details, contest details, contest arena, and submission status screens. The archive, contest list, rankings, and admin pages use their own page header or layout treatment while preserving the same route model.

## Global Navigation

### Desktop

The fixed top navigation contains:

| Label | Signed-in destination | Signed-out destination | Purpose |
|---|---|---|---|
| Home | `/dashboard` | `/` | Open the product landing or contestant dashboard |
| Problems | `/problems` | `/problems` | Browse the public problem archive |
| Contests | `/contests` | `/contests` | Browse contest schedules and statuses |
| Rankings | `/rankings` | `/rankings` | View contest leaderboards |
| Submissions | `/submissions/1042` | `/submissions/1042` | Open the current submission-status example |

The active link is highlighted for its route and nested routes. Authentication controls appear on the right:

- Signed out: **Sign In** and **Get Started** open Clerk modal flows.
- Signed in: the Clerk `UserButton` provides account controls and sign-out.

### Mobile

At mobile widths, the desktop links are replaced by a hamburger control. Opening it reveals the same links and authentication controls in a vertical slide-down panel. Selecting a route closes the panel automatically.

## Route Map

```text
                                  +------------------+
                                  |       HOME       |
                                  | / or /dashboard  |
                                  +--------+---------+
                                           |
             +-----------------------------+-----------------------------+
             |                             |                             |
             v                             v                             v
      +-------------+              +--------------+              +---------------+
      |  PROBLEMS   |              |   CONTESTS   |              |   RANKINGS    |
      |  /problems  |              |  /contests   |              |   /rankings   |
      +------+------+              +------+-------+              +---------------+
             |                            |
             v                            v
      +-------------+              +--------------+
      | PROBLEM     |              | CONTEST      |
      | DETAIL      |              | DETAIL       |
      | /problems/id|              | /contests/id |
      +------+------+              +------+-------+
             |                            |
             v                            +------------------+
      +-------------+                                       |
      | SUBMISSION  |                                       v
      | STATUS      |                              +----------------+
      | /submissions|                              | CONTEST ARENA  |
      | /id         |                              | /contests/id/  |
      +-------------+                              | arena          |
                                                   +----------------+

      ADMIN (protected route)
      /admin -> problem, contest, and user management sections
```

## Primary User Flows

### 1. Discover KOJ and start using the platform

```text
/ -> Get Started -> Clerk sign-up modal -> /dashboard
                 -> Sign In     -> Clerk sign-in modal -> /dashboard
                 -> Browse problems -> /problems
                 -> View contests   -> /contests
```

For a signed-in user, the landing page replaces the sign-in/sign-up actions with **Enter App** and the user avatar:

```text
/ -> Enter App -> /dashboard
```

### 2. Practice a problem and submit code

```text
/problems
  -> search by title/category or filter by difficulty
  -> select a problem
/problems/[id]
  -> read statement, input/output, constraints, samples, and limits
  -> choose language
  -> edit solution
  -> Run Sample -> inline confirmation
  -> Submit -> queued notice -> /submissions/1042
/submissions/[id]
  -> watch Pending -> Running -> Accepted mock progression
  -> Return to problem -> /problems/1
```

The problem detail page also provides a **view all** recent-verdict link to the submission status route.

### 3. Find and enter a contest

```text
/contests
  -> choose All, Registration Open, Active, Upcoming, or Finished
  -> select a contest card
/contests/[id]
  -> inspect status, countdown, duration, participants, and problem queue
  -> select a problem -> /problems/[id]
  -> register, when available
  -> enter active contest -> /contests/[id]/arena
```

From the contest detail screen, the user can return to `/contests`, open a listed problem, or follow the leaderboard link to `/rankings`. The arena provides the active problem queue, contest timer, scoring summary, and a leaderboard link back to rankings.

### 4. Review rankings

```text
/rankings
  -> choose a contest from the selector
  -> inspect rank, username, per-problem verdicts, solved count, and penalty
```

The **LIVE** indicator communicates the intended realtime experience. The current milestone uses static mock leaderboard data and does not open a realtime connection.

### 5. Manage KOJ as an administrator

```text
/admin
  -> inspect platform statistics
  -> Problem management: View -> /problems/[id]
  -> Problem management: Edit/Create -> local mock confirmation
  -> Contest management: Manage/Create -> local mock confirmation
  -> User management: change role -> Save Role -> local mock confirmation
```

`/admin` is protected by the Clerk route proxy because it is not listed as a public route. The current page labels its role as a mock admin role; a separate role/permission check is not represented in the current UI flow.

## Authentication and Access

The route proxy currently exposes these route groups publicly:

- `/`
- `/sign-in/*`
- `/sign-up/*`
- `/problems/*`
- `/contests/*`
- `/rankings/*`
- `/submissions/*`
- `/api/*`

Other application routes, including `/dashboard` and `/admin`, require authentication through Clerk. Authentication entry points use the catch-all routes `/sign-in/[[...sign-in]]` and `/sign-up/[[...sign-up]]`, while the shared navigation uses modal versions of those flows.

## Back Navigation Rules

| Current screen | Back action | Destination |
|---|---|---|
| Problem detail | `Back to archive` | `/problems` |
| Submission status | `Return to problem` | `/problems/1` |
| Contest detail | `All contests` | `/contests` |
| Contest arena | `Contest details` | `/contests/weekly-42` |
| Admin item | `VIEW` | `/problems/[id]` |

The current submission and arena examples use fixed mock IDs in their back links. Production navigation should replace these with the originating problem or contest identifier.

## Current UI Constraints

- Problem search and difficulty filters are client-side state only.
- Contest registration and countdown state are local UI state and are not persisted.
- Submission status is persisted as `Pending`, `Running`, then a final judge verdict; the background worker is implemented, while full contest dispatch remains in progress.
- Rankings display mock data and a mock live indicator rather than realtime updates.
- Admin create, edit, manage, and role-save actions show local confirmation messages.
- The landing-page footer links are placeholders (`#`) and are not part of the application navigation flow.

## Route Inventory

| Route | Screen | Main entry points |
|---|---|---|
| `/` | Public landing page | Logo, signed-out Home, direct visit |
| `/dashboard` | Signed-in dashboard | Signed-in Home, Enter App |
| `/problems` | Problem archive | Global Problems, landing CTA, dashboard CTA |
| `/problems/[id]` | Problem statement and editor | Archive row, featured problem, contest problem, admin View |
| `/submissions/[id]` | Submission monitor | Submit action, recent verdicts, global Submissions |
| `/contests` | Contest listing | Global Contests, landing CTA, dashboard contest cards |
| `/contests/[id]` | Contest details | Contest card, featured contest, dashboard arena CTA |
| `/contests/[id]/arena` | Active contest workspace | Contest detail Enter Arena action |
| `/rankings` | Leaderboard | Global Rankings, arena leaderboard link |
| `/admin` | Admin dashboard | Direct route for authenticated administrators |
| `/sign-in/[[...sign-in]]` | Sign-in flow | Clerk sign-in route/fallback |
| `/sign-up/[[...sign-up]]` | Sign-up flow | Clerk sign-up route/fallback |
