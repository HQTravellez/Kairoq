---
name: Online shop
description: Shops and product catalogues: collection pages, product pages with variants, cart drawer and checkout. Use for any app that sells physical or digital products.
---
# Online shop

A good shop gets out of the way: big honest product photos, the price and the button always in reach, and a checkout with no surprises.

## Structure
- **Home:** one hero for the current collection or best seller (real product photo, not a mood board), then a curated product row, a short brand story, and categories. No carousel of five hero banners.
- **Collection page:** a filter bar (category, size, colour, price) that stays visible, a sort menu ("Featured", "Newest", "Price: low to high"), a product count ("24 products"), and a grid of 2 columns on phones, 3-4 on desktop. Filters on phones open in a bottom sheet with an "Show 24 results" button.
- **Product card:** square or 4:5 image on a neutral background, second image on hover (desktop only), name, price, colour swatches (max 4 then "+2"). A "New" or "Low stock" badge only when true. Never fake discounts.
- **Product page:** gallery left (thumbnails, swipe on phones, zoom on click), details right and sticky on desktop: name, price, rating only if real reviews exist, variant pickers (size as buttons with sold-out sizes crossed out, colour as swatches with the name shown), quantity, a full-width "Add to cart" button, delivery and returns in one line each ("Free delivery over $75 · 30-day returns"). Below: description, materials and care, size guide in a dialog, reviews, "You might also like".
- **Cart:** a drawer that slides in after "Add to cart" (do not navigate away), line items with image, variant, quantity stepper and remove, subtotal, the free-delivery progress ("$18 away from free delivery"), and "Checkout". Also a full /cart page.
- **Checkout:** one column, few fields, in this order: contact email, delivery address, delivery method with prices, payment. Order summary on the right (collapsed at the top on phones). Show the total including tax and delivery before the pay button. Guest checkout allowed.
- **Order confirmation:** order number, what was bought, delivery estimate, and "We sent a receipt to ana@example.com".

## Kairoq specifics
- Products, variants (size, colour, stock) and orders live in SQL tables; stock is decremented in a server function inside the same transaction that creates the order, so two buyers cannot buy the last item.
- Payments: use `payments.checkout(productKey)` (Stripe Checkout) and show the order as paid only after the purchase is recorded; never mark an order paid from the browser.
- Keep the cart in localStorage for guests and merge it into the account after sign-in.
- Prices are integers in cents in the database; format with Intl.NumberFormat.

## Look and feel
- Photography carries the shop: one consistent background and light. Use openly licensed or generated product images when none are supplied, and say they are placeholders.
- Typography is quiet so products stand out; one brand colour for the buy button and sale price.
- Micro-feedback: the cart icon count bumps when an item is added; "Added to cart" in the drawer header.

## Avoid
- Countdown timers, "17 people are looking at this", fake scarcity or fake reviews.
- Pop-ups before the visitor has seen a product.
- Hidden costs that appear only at the last step.
