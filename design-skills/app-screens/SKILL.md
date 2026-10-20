---
name: App screens
description: Rules for the screens people work in every day (dashboards, admin, lists, settings, inboxes, bookings and orders back offices): colour on data not chrome, KPIs as type, flat surfaces, quiet navigation, honest tables and states, a phone layout where the navigation folds away.
---
# App screens

Adapted for Kairoq from the app-screen chapter of taste-skill by Leonxlnx (MIT), distilled from measurements of 23 real product screens. A generated dashboard is the average of every template: a tinted sidebar with a coloured active pill, "Welcome back" with a waving hand, four KPI cards each with an icon in a tinted circle and a green "+12.5%", a gradient area chart, a zebra table under uppercase headers. Nothing in it is wrong and none of it was decided. Do this instead.

## What separates real screens from generated ones
1. **Colour goes on data, not chrome.** Most real screens have under 5% coloured pixels. The primary action can be near-black; the brand hue marks the main data element (today's series, the current period) and one control at most.
2. **KPIs are type, not tiles.** A label over a number, 24-30px at weight 400-600 in the text colour. No icon in a coloured circle, no sparkline on a KPI. Several KPIs share one container split by hairlines.
3. **Surfaces are flat.** A 1px border or one tone step separates; a border or a shadow, never both. Shadows only on what floats (menus, popovers, dialogs).
4. **No hero header.** The page title is a noun at 18-32px (usually 24px). No greeting banner, no emoji.
5. **Charts carry almost no chrome.** A 2px straight line, no fill or a faint one, no dots on points, 3-5 faint gridlines, no legend for a single series, one hue per chart, four hues at most on a screen.
6. **Navigation recedes.** The sidebar sits on the page background; the active item is a neutral grey pill or brighter text, not a coloured row with a left bar.
7. **Tables are rules and alignment.** 12px grey sentence-case headers, 1px row rules, no zebra, no header band; numbers right-aligned with `tabular-nums`, fixed decimals, units in grey; one status mark and one action per row where needed.
8. **Data states are honest.** Zero prints as 0, missing as a grey dash; status colour only on real changes (grey for zero); an empty section keeps its frame with one sentence and the action that fills it; loading shows a skeleton of the real layout.

## The first screen
- Every block the screen exists for shows its header and first rows on a 1440×900 screen; the most frequent job is one click away (a real button, not hidden in a menu).
- The shell names the product and the scope (business name, location or account), so the screen could only belong to this business.
- Give it a face: a background tone from the business's world (stone for a bakery, sage for a garden centre, blue-grey for a ledger) instead of #f8f8f8, the brand hue on the main data, and one element only this business has.
- Short lists end in "View all" and the total, not pagination.

## Sample data
Believable data computed from the rows: real-looking names for this kind of business, small numbers at their real size, totals that add up. Never lorem ipsum, Acme, John Doe, "User 1" or vanity figures.

## The phone
The sidebar folds into a menu button or a bottom bar of 3-5 items; KPIs become a 2-column grid or a horizontal scroll; tables become stacked rows (the main field large, two details small, the value right); every control at least 40px tall; nothing scrolls sideways except a labelled table region.

## Allowed here, with limits
1px borders on cards, panels and controls; row rules in tables; small 12-14px labels above values; rows of identical cards only for peer metrics or objects (3-6 across, equal widths, no orphan); monospace only for IDs and codes; pills only inside rows (pale tint, dark text of the same hue); icons 14-20px outline in one grey set.

## Still banned
Gradients on backgrounds, buttons, cards or text; glows and glass; icons in coloured circles on every card; rainbow charts; sparklines on KPIs; emoji; a dark or saturated sidebar on a light screen; the brand colour on every button, tab and link; uppercase tracked table headers; left-aligned numbers; a landing-page title over 32px or figures at 48px or more.
