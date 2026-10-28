Bookmark — Long-term Vision

What Bookmark could become with serious backing and effort. This is an aspiration, not a commitment. The spec (docs/BOOKMARK_SPEC.md) is the source of truth for what gets built; ideas move from here into the spec only when they are ready.

Written 14 October 2026.

In one line

The private home for everything you read — books, fanfic, podfic and web serials — that fandom recommends because it never exposes readers, never monetises their fandom, and makes reading easier.

Why there is room
The audience is large. AO3 alone lists more than 83,150 fandoms, 11,890,000 users and 18,680,000 works on its home page (October 2026).
The big trackers don't serve it. Goodreads, StoryGraph, Hardcover, Fable and Bookly focus on published books; none offers fanfic support (comparison published May 2026).
Fic readers patch things together today: AO3 bookmarks with notes, browser favourites, spreadsheets, Notion, phone notes and Kindle folders. Readers find manual logging tedious, and logging fic publicly on Goodreads or StoryGraph is seen as poor etiquette because authors sometimes delete works after public listings.
The gap: a tracker that is built for fanfic, private and trusted. Bookmark's principles already point there.
What the market leader looks like
1. Tracking that does itself
AO3 reading view: opens AO3 pages live, like a browser, storing nothing. Records chapter and scroll position automatically, so progress never needs typing and reading resumes mid-paragraph on any device. The OTW describes third-party apps as "specialized web browsers"; this stays within that model.
E-reader bridges: progress from the reader's own Kobo or KOReader device and from Calibre libraries, for people who read downloaded EPUBs.
Podfic and audiobooks tracked by time alongside books and fic.
2. Update alerts without surveillance
Partnership goal: AO3 publishes a lightweight public "recently updated works" feed. Each device downloads it and matches it against its own library locally: instant new-chapter alerts, nobody learns what anyone reads, and less load on AO3 than per-work checks.
Build it as a contribution: AO3's code is open source, so Bookmark could contribute the feed rather than ask for it.
Follow authors and series: "The WIP you gave up on two years ago just updated."
3. Finding the next read without surveillance
On-device recommendations from the reader's own library and tags, always showing the reason, with no data leaving the device.
Rec lists, which fandom runs on: import public rec lists and AO3 collections; share private lists with friends using end-to-end encryption. Never public scores.
Mood and trope search across the to-read list: "fluffy, complete, under 20k, no major character death".
4. Giving back to authors
After finishing a fic: a gentle "Leave kudos or a comment on AO3?" that opens the work there.
A yearly Authors who made your year, with links to thank them on AO3.
Feedback always goes where it belongs (AO3), never into in-app reviews.
Authors' choices are honoured: deleted or orphaned works are recorded as "no longer available", with no archived text.
5. Everywhere, synced, private
Native iOS, Android, web and desktop apps; home-screen widgets; a lock-screen "continue reading".
Optional end-to-end-encrypted sync: the server only ever holds data it cannot read; open source and self-hostable. File sync remains.
6. Safety and wellbeing as headline features
Personal content filters everywhere (warnings, tags, personal triggers), discreet mode, app lock, quick-hide.
No streaks, goals or pressure.
Accessibility in the reading view: dyslexia-friendly fonts, reflowed text, system text-to-speech.
7. Beyond AO3, with permission only
Other archives and web-serial platforms only through official APIs, partnerships or user-driven capture.
Books through open data (Open Library) and independent bookshops.
8. An open ecosystem
Open-source core and open data format.
Importers for Goodreads, StoryGraph and spreadsheets.
A pledge that the reader's data outlives the project: full export, and anyone can run the sync server.
Funding at scale without breaking trust
A foundation model, in the spirit of the OTW itself or Signal: donations, open-source and digital-commons grants, supporter memberships that unlock nothing.
Bookshop.org links scale with the user base.
Never ads, data sales or paid features. Refusing them is the advantage competitors can't easily copy.
The main cost is people, not servers; encrypted sync and a static website are cheap to run.
What it would take

Team: 3–6 core people (mobile; web, sync and security; design; a community lead who works with fandom and the OTW), plus volunteers and a fandom advisory group.

Stages (reader numbers are illustrative):

Stage	What exists	Readers
1. Trusted indie tool	The current spec (v4.x)	1,000–10,000, by fandom word of mouth
2. Fandom default	Native iOS, reading view, encrypted sync, rec lists, a foundation, a working relationship with the OTW	100,000+
3. Platform	AO3 updates feed, e-reader bridges, other archives with permission, desktop	~1,000,000 (under a tenth of AO3's users)

Measuring success without tracking: opt-in surveys and on-device numbers the reader chooses to share. Never telemetry.

Where today's principles would have to stretch
Stretch	Condition
A server appears (encrypted sync, an updates-feed mirror)	Zero-knowledge, open source, self-hostable and optional
Social features (shared rec lists, read-alongs)	Private and invite-only; discussion points to AO3 comments
An AO3 reading view	Live display only, never cached text; ideally with the OTW's blessing
Scale multiplies load on AO3	Build the updates feed with the OTW instead of fetching pages
Biggest risks
The OTW relationship. At scale Bookmark is either AO3's partner or its problem. Contributing code and staying non-commercial earns the first.
Fandom trust is fragile. Paid and ad-supported AO3 apps drew strong backlash in 2020.
A large player adds fanfic. Public-review cultures clash with fic etiquette; privacy and fic-first design are the defence.
Copyright and app-store issues if anything looks like redistributing works.
Funding and burnout, the usual end of community projects.
Already pulled into the spec
Kudos and comment prompt after finishing a fic (spec v4.3, §7.14, §12.13).
Authors who made your year in Stats (spec v4.3, §7.10, §12.9).
Rec-list import with the capture tool (spec v4.3, §10.5).
Sources
AO3 home page, figures as shown on 14 October 2026: https://archiveofourown.org/
Reading-tracker comparison (Unstar, 29 May 2026): https://unstar.app/blog/goodreads-storygraph-fable-hardcover-bookly-reading-tracker-apps-ranked-2026
How fic readers track their reading (reader discussion, mirrored): https://reddit.birdcat.cafe/r/drarry/comments/1jgdu7s/how_to_track_fics
OTW, "Why AO3 Doesn't Have an Official App": https://www.transformativeworks.org/why-ao3-doesnt-have-an-official-app/
AO3 App Wars (Fanlore): https://fanlore.org/wiki/AO3_App_Wars