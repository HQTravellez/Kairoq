---
name: Social media dashboard
description: Dashboards that track social media performance across channels, with followers, engagement, top posts, growth charts and posting insights.
group: Page types
---
# Social media dashboard

Small businesses post on several channels but rarely know what works. This dashboard answers: are we growing, which posts land, when should we post, and what do people say. Keep it calm and decision-oriented.

## Purpose
- Read metrics from the app's data (imported or connected): per channel followers, reach, impressions, engagement (likes, comments, shares, saves), clicks to the website or booking page, and posts with date, format, caption, thumbnail and stats.
- Compute derived values in one place: engagement rate, growth versus previous period, best day and hour, top posts by engagement rate (not raw likes).
- Channel names are user data; show them with generic icons (lucide `Camera`, `Video`, `MessageCircle`, `Briefcase`, `Globe`) or uploaded icons, not hard-coded brand assets.

## Layout
- Header: title, date range picker (7, 30, 90 days, custom), channel switcher as a segmented control with "All channels" first, and an export button.
- KPI row: followers (total and net change), reach, engagement rate, website clicks. Each card has a big number, change badge and sparkline.
- Main chart: follower growth over time as a line or area per channel (max four series, brand colour for the main one, muted tones for others) with a legend that toggles series.
- Engagement chart: stacked bars by week (likes, comments, shares, saves) or a single bar for engagement rate.
- Top posts: a grid of 3-6 post cards with thumbnail (aspect-square, rounded), short caption (2-line clamp), date, format badge (Photo, Video, Carousel) and key stats in a row of small icons. Click opens a detail drawer.
- Best time to post: a heatmap of day by hour (7 x 24 cells, opacity scale of the brand colour) with a tooltip.
- Side column: trending topics or hashtags as chips with counts, recent comments with sentiment tags (positive, question, complaint) and a reply link, upcoming scheduled posts.

## Palette and type
- Neutral dashboard base (light or dark), brand colour for the main series and actions, up to three extra muted chart colours. Status colours only for change badges.
- Inter or Manrope; tabular figures for every number.

## Details
- Numbers abbreviated sensibly (12.4k) with exact values in tooltips.
- Empty and loading states for channels that are not connected: a card explaining how to connect or import a CSV.
- Comparisons always state the baseline ("vs previous 30 days").
- Responsive: KPI cards 2 per row on phones, charts full width, side column moves below.

## Avoid
- Vanity metrics without rates, more than four chart colours, pie charts of channels, real platform logos, auto-refreshing animations, hard-coded sample numbers in production code, and tiny 11 px labels.
