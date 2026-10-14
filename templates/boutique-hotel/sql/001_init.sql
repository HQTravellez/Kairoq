CREATE TABLE rooms (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL,
  description TEXT NOT NULL,
  price INTEGER NOT NULL CHECK (price > 0),
  max_guests INTEGER NOT NULL CHECK (max_guests > 0),
  size_m2 INTEGER NOT NULL,
  image TEXT NOT NULL,
  amenities TEXT NOT NULL
);

CREATE TABLE bookings (
  id INTEGER PRIMARY KEY,
  room_id INTEGER NOT NULL REFERENCES rooms(id),
  user_id TEXT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  check_in TEXT NOT NULL,
  check_out TEXT NOT NULL,
  guests INTEGER NOT NULL,
  nights INTEGER NOT NULL,
  total INTEGER NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (check_out > check_in)
);
CREATE INDEX bookings_room_dates ON bookings (room_id, check_in, check_out);
CREATE INDEX bookings_user ON bookings (user_id);

INSERT INTO rooms (slug, name, tagline, description, price, max_guests, size_m2, image, amenities) VALUES
 ('garden', 'Garden Room', 'Quiet, green and cool on summer afternoons',
  'Opens onto our lemon-tree courtyard. Handmade azulejo tiles, a walk-in rain shower and linen sheets from a family mill in Guimarães.',
  140, 2, 22, 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=1200&q=80', 'Courtyard access|Rain shower|Air conditioning|Coffee corner'),
 ('terrace', 'Terrace Room', 'Your own terrace above the Alfama rooftops',
  'A bright corner room with a private 12 m² terrace looking over terracotta roofs to the river. Breakfast up here is the reason guests come back.',
  190, 2, 26, 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&q=80', 'Private terrace|River glimpses|Bathtub|Nespresso'),
 ('suite', 'Tagus Suite', 'The whole top floor, with river views',
  'Our top-floor suite: a separate living room, a deep soaking tub by the window and sunset views over the Tagus. Room for a small family.',
  260, 4, 48, 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200&q=80', 'River view|Living room|Soaking tub|Sofa bed for 2');
