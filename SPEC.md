# Club events

<!-- Exercise 2. Write the non-goals first. Every acceptance criterion must be checkable in under a minute.
     Keep these headings exactly as they are: the self-checks look for them by name.
     The full target is on the course site under Resources → The course project. -->

## Project option
Club events

## Goals
- A member signs in, sees upcoming events and signs up for one that has free places.
- An organizer creates an event with a limit on places and sees who signed up for it.

## Non-goals
- No payments: every event is free.
- No outbound notifications for events (email/push); members check the site directly.
- No mobile app: one web UI that also works on a phone screen.

## Constraints
- Node with Express, PostgreSQL, plain HTML and JavaScript in the UI.
- Passwords are stored only as a hash, never as readable text.

## The model feature
- Model: gemini-2.5-flash
- Input: Event title and raw description provided by organizer
- Output: AI-generated polished event summary and category tags
- When it fails: Displays an "AI service temporarily unavailable" message and loads a deterministic text fallback.

## Auth
- Local: Email and bcrypt-hashed password
- Provider: Google OAuth (`google`)
- Linking: When logging in via OAuth, the system checks for an existing email and prompts for one-time password verification to link accounts.

## MCP tools
| Tool | What it does | Who may call it |
| --- | --- | --- |
| `list_events` | Use this tool when the user asks to see upcoming club events and their free places. | Member or Organizer |
| `create_event` | Use this tool when an organizer requests to publish a new club event with a capacity limit. | Organizer |
| `signup_event` | Use this tool when a member wants to register for an available club event. | Member |

## UI
- Stack: Node.js, Express, PostgreSQL, Vanilla CSS, and server-rendered HTML/JavaScript.
- Screens:
  1. Login / Register screen
  2. Upcoming Events list screen
  3. Event Details & Registration screen
  4. Organizer Event Management screen

## Architecture
A request for signing up for an event (`POST /events/:id/signup`) flows through the layers as follows:

**Forward Request Path:**
1. **Route Handler:** `src/routes/events.js` (receives the HTTP POST request, validates session authentication, and invokes `eventService.signupForEvent`).
2. **Service Layer:** `src/services/eventService.js` (executes business rules, capacity checks, and eligibility checks).
3. **Data Access (Repository):** `src/db/eventRepo.js` (executes SQL queries against the database).
4. **Database:** PostgreSQL database (`events` and `registrations` tables).

**Backward Response / Client Rendering Path:**
1. **Server Rendered HTML View:** `src/views/events.html` (receives updated event data and renders success/error message banners and action buttons).
2. **Browser State & DOM:** Browser form submit state and document reload showing updated free places count and cancellation button.
3. **Client REST / Form Action:** Form submission triggering the POST request to `/events/:id/signup`.

**Layering Discrepancy:**
`src/routes/events.js` directly performs HTML template string reading via `fs.readFileSync(eventsHtmlPath, 'utf8')` and string replacement rather than utilizing a separate view rendering engine. This was left as-is for simplicity in a lightweight server-rendered Vanilla JS application without adding external template dependency overhead.

## Acceptance criteria
<!-- Every criterion carries an id. A test proves it by naming that id in its title, for example
     test('AC-3 a booking that overlaps another is refused with 409', ...).
     Say who acts, what they see, and what must be true in the database. -->
- [AC-1] A member who signs up for an event with no free places sees "This event is full", and no new row appears in `registrations`.
- [AC-2] An organizer who creates an event with valid title, date and capacity sees the new event listed on the events page and stored in the database.
- [AC-3] A member who clicks "Cancel registration" on an event they registered for sees a success message and the registration row is deleted from `registrations`.
- [AC-4] A user who enters incorrect credentials on the login page sees "Invalid email or password" and remains on the login page.
- [AC-5] An organizer who attempts to edit an event they do not own sees a "Forbidden" error and no changes occur in the database.
- [AC-6] A visitor who registers with an email already present in the database sees "Email already registered" and no new user row is created.
- [AC-7] An organizer who deletes an event sees it removed from the events list and its associated registrations deleted from the database.
- [AC-8] A member who views a fully booked event sees a disabled signup button with the text "Event Full".

### Slice 1: sign-in and the upcoming events list
- [AC-9] A visitor who opens `/events` without signing in lands on `/login` instead.
- [AC-10] After signing in with a seeded account, `/events` shows the three seeded events, each with its title, date and number of free places.
- [AC-11] Deleting one event row in the database and reloading `/events` reduces the displayed event count by one.

### Slice 2: organizer updates an event
- [AC-12] An organizer who attempts to update an event capacity to a number lower than its current registrations is refused with `400`, and neither the capacity nor the registrations in the database are changed.
- [AC-13] An organizer who attempts to set an event date to a past date sees an error message stating the date has already passed, the request is refused with `400`, and the event date remains unchanged in the database.
- [AC-14] An organizer who attempts to edit an event they do not own is refused with `403` and no changes occur in the database.

## Traceability
<!-- Filled in from Exercise 3 onward: each AC id, and the test that names it. -->
| Criterion | Test |
| --- | --- |
| AC-1 |  |

## Spec vs result
<!-- After the agent builds the slice: which criteria passed, which it missed or reinterpreted, and what you changed in this spec because of it. -->
- Initial specification completed and structured for Slice 1.
