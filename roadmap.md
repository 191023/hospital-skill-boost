# Training room visualization
- [x] Add a colorful animated 3D roster with round selection and attendee details.
- [x] Connect read-only enrollment and attendance data with automatic refresh and staff access.
- [x] Link from round management and verify populated desktop and mobile flows.

## Room realism and simulated check-ins
- [x] Add physical seating, session room/date signage and profession emoji labels.
- [x] Add clearly marked simulated check-ins for existing demo registrations in every round, preserving real records.
- [x] Verify room selection, attendee details and populated session reports.
## Room interactive features
- [x] Kiosk display mode with auto-orbit and self refresh.
- [x] Camera fly-to on roster click, division filter highlighting, new check-in pulse effect.
- [x] Floating in-room stats board, PNG room capture and walk-around controls.
## Seated attendees and arrivals
- [x] Replace floating emoji labels with seated CC0 human figures and selection details.
- [x] Animate first-time check-ins once with a chair ring/bounce and aisle walk-to-sit, respecting reduced motion.
- [x] Verify populated rooms, arrival animation, selection, kiosk and top view; check reduced-motion mobile layout and attendance detection tests.
## Natural characters and furnished room
- [x] Align seated hips and feet with chairs, color shirts by division, and show first-name-only floating labels.
- [x] Replace blocky figures with rounded cartoon people, simple faces and smooth arrival motion.
- [x] Furnish a cutaway room with walls, windows, desks and realistic chairs.
- [x] Verify populated room, selection, arrival animation and small-screen layout.
## Rounded isometric attendees
- [x] Replace the old face with a rounded, friendly cartoon head without facial hair, preserving seated and walking poses.
- [x] Use an isometric room view and verify populated seating and close-up faces.
## Adult learners and modern conference room
- [x] Refine head proportions, facial details and walking/sitting transitions without changing attendance rules.
- [x] Add contemporary wall panels, glazing, carpet and stage finishes; preserve room signage and selection.
- [x] Verify populated room, close-up selection, moving arrival with a read-only attendance response, and mobile framing; training-room tests pass.

## Manual room check-in
- [x] Add a permission-checked action to record attendance for a selected registered learner, without changing QR behavior.
- [x] Add the check-in button with pending/success states and refresh the room animation and counts.
- [x] Verify a real check-in persists after reload and repeated clicks do not duplicate attendance; unauthorized learners are rejected, matching QR rules.

## System review fixes
- [x] Restrict course files to staff and learners of that course; warn when a restricted course has no groups.
- [x] Remove unused character files and update outdated server function calls.
- [x] Compute report totals on the server and export all rows.
- [x] Add tests for grading, check-in, file access and report rules.

## Unobstructed rotating room
- [x] Fade camera-facing walls, glazing and attached decorations together and restore them automatically.
- [x] Verify populated room rotation, restored walls and overhead view without changing attendance.

## Fixed board and medical trainers
- [x] Fix session signage onto the stage board with physical depth and shared wall fading.
- [x] Add illustrative doctor and nurse presenters standing on stage using the registered adult character.
- [x] Verify populated room, rotated views and trainer appearance without changing attendance.

## Picker, full screen, dancing trainers
- [x] Random no-repeat draw of real checked-in attendees per round, full-screen view, trainers dance on draw.
