---
name: Booking and marketplace
description: Search-led apps with listings: stays, rentals, services, events, jobs, classes and two-sided marketplaces. Covers search, filters, map, listing pages, availability and booking.
---
# Booking and marketplace

People come to find one thing that fits their dates, place and budget. The design job is to make comparing easy and booking certain.

## Search
- The search bar is the hero: where, when (a date range picker), who (guests or quantity) and a clear "Search" button. On phones it collapses into one tappable pill that opens a full-screen search.
- Remember the last search. Offer real suggestions as you type (places, categories), not a static list.

## Results
- Layout: a list on the left and a map on the right on desktop (map pins show the price; hovering a card highlights its pin and the other way round). On phones a list with a floating "Map" toggle.
- A filter bar under the search: price range (a histogram slider), type, rating, amenities, instant booking, plus "Filters" for the rest in a dialog with a live "Show 128 results" button. Show active filters as removable chips and a "Clear all".
- Result card: photo carousel (dots, swipe), title, location or distance, the key facts ("2 guests · 1 bed · Wi-Fi"), rating with count only if real, and the price that matters ("$142 night · $426 total"). A heart to save.
- Sort: "Recommended", "Price", "Rating", "Distance". Show the result count. Empty results suggest widening dates or removing a filter.
- Paginate or load more; never an endless list without a footer.

## Listing page
- Photo grid (one large + four small on desktop, "Show all photos" opens a gallery), title, host or provider with a short line about them, key facts, description (clamped with "Read more"), amenities with icons (lucide-react), location map, house rules, cancellation policy in plain words, and real reviews.
- A sticky booking box on desktop (a bottom bar on phones): price per unit, date and guest pickers, the price breakdown (nightly × nights, cleaning, service fee, taxes, total) before the button, and "You won't be charged yet" when true.
- Unavailable dates are disabled in the calendar, never rejected after submitting.

## Booking flow
- Review → details → pay → confirmation with a booking reference, dates, address and how to cancel. Send the user to "My bookings".
- Two-sided apps also need the provider side: a calendar of bookings, accept/decline requests, payouts summary, and listing editor with photo upload.

## Kairoq specifics
- Listings, availability and bookings live in SQL. Check availability and insert the booking in one server function with a unique constraint on (listing, date), so double booking is impossible.
- Use `payments.checkout` for payment; confirm the booking from the recorded purchase, never from the browser.
- Store times in UTC, show them in the listing's time zone, and say which.

## Avoid
- Prices that change between the card and the checkout.
- Fake "Only 1 left" or "Booked 12 times today" messages.
- A map without a list, or filters that reset when the user goes back.
