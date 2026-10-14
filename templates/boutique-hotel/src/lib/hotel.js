export const HOTEL = {
  name: 'Casa Azul',
  place: 'Alfama, Lisbon',
  address: 'Rua dos Remédios 42, 1100-441 Lisboa',
  email: 'stay@casaazul.pt',
  phone: '+351 21 000 4242',
  checkIn: '15:00',
  checkOut: '11:00'
};

export const ROOMS = [
  { slug: 'garden', name: 'Garden Room', price: 140, guests: 2, size: 22, tagline: 'Quiet, green and cool on summer afternoons', image: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=1200&q=80' },
  { slug: 'terrace', name: 'Terrace Room', price: 190, guests: 2, size: 26, tagline: 'Your own terrace above the Alfama rooftops', image: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&q=80' },
  { slug: 'suite', name: 'Tagus Suite', price: 260, guests: 4, size: 48, tagline: 'The whole top floor, with river views', image: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200&q=80' }
];

export const GALLERY = [
  { src: 'https://images.unsplash.com/photo-1585208798174-6cedd86e019a?w=900&q=80', alt: 'Tram 28 climbing through Alfama' },
  { src: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=900&q=80', alt: 'Lisbon rooftops at sunset' },
  { src: 'https://images.unsplash.com/photo-1513735492246-483525079686?w=900&q=80', alt: 'Breakfast on the terrace' },
  { src: 'https://images.unsplash.com/photo-1536663815808-535e2280d2c2?w=900&q=80', alt: 'Hand-painted azulejo tiles' }
];

export const NEARBY = [
  { name: 'Miradouro de Santa Luzia', walk: '4 min', note: 'The view on our postcards' },
  { name: 'São Jorge Castle', walk: '9 min', note: 'Go at opening time to skip the queue' },
  { name: 'Feira da Ladra flea market', walk: '8 min', note: 'Tuesdays and Saturdays' },
  { name: 'Tram 28 stop', walk: '3 min', note: 'Board at Largo das Portas do Sol' },
  { name: 'Clube de Fado', walk: '6 min', note: 'Ask us to book a table' }
];

export const euro = (n) => new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
export const isoDay = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
export const niceDate = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
