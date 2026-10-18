---
name: Loyalty and rewards
description: Customer loyalty and rewards experiences with points, tiers, streaks, badges, challenges and a rewards catalogue, built for phones first.
group: Page types
---
# Loyalty and rewards

Loyalty features turn one-off visitors into regulars: a coffee shop stamp card, a hotel members club, a studio class streak, a shop points programme. Make progress visible and rewards tangible, with a sense of play but no tricks.

## Purpose
- Member data from the app: points balance, tier, points to next tier, streak (consecutive weeks or visits), badges earned and locked, active challenges (goal, progress, reward, end date), rewards catalogue (name, image, points cost, availability) and activity history.
- Points values, costs and tier thresholds always come from the programme settings in data; never hard-code them in components.
- Redeeming a reward is a confirmed action that writes to the database and shows a code or QR for staff to scan.

## Layout (mobile-first)
- Member card at the top: a card-shaped panel (`aspect-[1.6/1] rounded-2xl`) with the business logo, member name, tier name and a tier-coloured gradient, plus a QR or member number for scanning at the counter.
- Progress: points balance large (`text-5xl font-bold tabular-nums`), a progress bar to the next tier with "{n} points to Gold", and the current streak with a flame or calendar icon and the last 7 periods as small dots.
- Challenges: a horizontal list of tiles ("Try 3 new dishes", "Book 2 classes this month") with progress rings and the reward.
- Badges: a grid of circular badges; earned ones in colour with a subtle shine, locked ones greyed with a lock icon and a hint on how to earn.
- Rewards catalogue: cards with image, name, cost in points and a Redeem button; disabled with "Need {n} more" when unaffordable.
- Activity: a timeline of points earned and spent.
- Bottom tab bar on phones: Home, Rewards, Activity, Profile.
- For a marketing view, show the app on three phone frames on a dark stage: cover, today's progress, reward detail.

## Palette and type
- Brand base with tier colours (for example bronze, silver, gold or the brand's own names), bright accent for progress and celebrations. Rounded friendly sans (Nunito, Figtree, Poppins) with bold numbers.
- Larger radii (rounded-2xl), soft shadows and gradient tiles for challenges.

## Interaction
- Earning points animates the counter (count up) and the bar fill; unlocking a badge shows a small modal with a burst animation (framer-motion), respecting reduced motion.
- Level up moment gets a full-screen celebration once, never repeated.
- Staff view: search a member, add points for a visit or purchase, and redeem rewards.

## Avoid
- Manipulative countdowns, hidden expiry rules, confusing point values, hard-coded rewards or prices, leaderboards that shame customers, and celebrations that block the screen for long.
