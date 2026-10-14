// Everything a signed-in user reads and writes: profile and targets, food diary, water,
// workouts, weight and stats. Every query is scoped to the signed-in user.
const MEALS = ['breakfast', 'lunch', 'dinner', 'snacks'];
const MET = { walking: 3.5, running: 9.8, cycling: 7.5, swimming: 8, strength: 5, yoga: 3, hiit: 8.5, dancing: 5.5 };

export default async function (request, { db, user, ai }) {
  if (!user) return { status: 401, json: { error: 'Please sign in.' } };
  const b = request.body || {};
  const day = isDay(b.day) ? b.day : new Date().toISOString().slice(0, 10);
  const me = user.id;
  const bad = (m) => ({ status: 400, json: { error: m } });
  const num = (v, lo, hi) => { const n = Number(v); return Number.isFinite(n) && n >= lo && n <= hi ? n : null; };

  switch (b.action) {
    case 'profile': {
      const [p] = await db.sql`SELECT * FROM profiles WHERE user_id = ${me}`;
      return { json: { profile: p || null } };
    }
    case 'profile.save': {
      const p = b.profile || {};
      const age = num(p.age, 13, 100), height = num(p.height_cm, 120, 230), weight = num(p.weight_kg, 30, 300);
      const kcal = num(p.kcal_target, 1000, 6000), pr = num(p.protein_g, 20, 400), ca = num(p.carbs_g, 20, 800), fa = num(p.fat_g, 15, 300), water = num(p.water_ml, 500, 6000);
      if (!['female', 'male'].includes(p.sex) || !['lose', 'maintain', 'gain'].includes(p.goal) || !p.activity) return bad('Please complete your profile.');
      if ([age, height, weight, kcal, pr, ca, fa, water].some((v) => v === null)) return bad('Some numbers look off. Please check them.');
      await db.sql`
        INSERT INTO profiles (user_id, sex, age, height_cm, weight_kg, activity, goal, kcal_target, protein_g, carbs_g, fat_g, water_ml, updated_at)
        VALUES (${me}, ${p.sex}, ${age}, ${height}, ${weight}, ${String(p.activity)}, ${p.goal}, ${Math.round(kcal)}, ${Math.round(pr)}, ${Math.round(ca)}, ${Math.round(fa)}, ${Math.round(water)}, datetime('now'))
        ON CONFLICT (user_id) DO UPDATE SET sex = excluded.sex, age = excluded.age, height_cm = excluded.height_cm, weight_kg = excluded.weight_kg,
          activity = excluded.activity, goal = excluded.goal, kcal_target = excluded.kcal_target, protein_g = excluded.protein_g,
          carbs_g = excluded.carbs_g, fat_g = excluded.fat_g, water_ml = excluded.water_ml, updated_at = excluded.updated_at`;
      await db.sql`INSERT INTO weights (user_id, day, kg) VALUES (${me}, ${day}, ${weight}) ON CONFLICT (user_id, day) DO UPDATE SET kg = excluded.kg`;
      return { json: { ok: true } };
    }
    case 'day': {
      const entries = await db.sql`SELECT id, meal, name, servings, kcal, protein, carbs, fat FROM entries WHERE user_id = ${me} AND day = ${day} ORDER BY id`;
      const workouts = await db.sql`SELECT id, type, minutes, kcal FROM workouts WHERE user_id = ${me} AND day = ${day} ORDER BY id`;
      const [w] = await db.sql`SELECT ml FROM water WHERE user_id = ${me} AND day = ${day}`;
      return { json: { day, entries, workouts, water_ml: w ? w.ml : 0 } };
    }
    case 'foods': {
      const q = String(b.q || '').trim().slice(0, 60);
      const like = '%' + q.replace(/[%_]/g, '') + '%';
      const foods = q
        ? await db.sql`SELECT * FROM foods WHERE name LIKE ${like} ORDER BY (name LIKE ${q.replace(/[%_]/g, '') + '%'}) DESC, name LIMIT 30`
        : await db.sql`SELECT * FROM foods ORDER BY category, name LIMIT 80`;
      return { json: { foods } };
    }
    case 'food.add': {
      if (!MEALS.includes(b.meal)) return bad('Pick a meal.');
      const servings = num(b.servings ?? 1, 0.25, 20);
      if (servings === null) return bad('Servings must be between ¼ and 20.');
      if (b.food_id) {
        const [f] = await db.sql`SELECT * FROM foods WHERE id = ${Number(b.food_id)}`;
        if (!f) return bad('That food no longer exists.');
        await db.sql`INSERT INTO entries (user_id, day, meal, food_id, name, servings, kcal, protein, carbs, fat)
          VALUES (${me}, ${day}, ${b.meal}, ${f.id}, ${f.name}, ${servings}, ${f.kcal * servings}, ${f.protein * servings}, ${f.carbs * servings}, ${f.fat * servings})`;
      } else {
        const name = String(b.name || '').trim().slice(0, 80);
        const kcal = num(b.kcal, 0, 5000);
        if (!name || kcal === null) return bad('Add a name and calories.');
        await db.sql`INSERT INTO entries (user_id, day, meal, name, servings, kcal, protein, carbs, fat)
          VALUES (${me}, ${day}, ${b.meal}, ${name}, 1, ${kcal}, ${num(b.protein, 0, 500) || 0}, ${num(b.carbs, 0, 1000) || 0}, ${num(b.fat, 0, 500) || 0})`;
      }
      return { status: 201, json: { ok: true } };
    }
    case 'food.remove': {
      await db.sql`DELETE FROM entries WHERE id = ${Number(b.id)} AND user_id = ${me}`;
      return { json: { ok: true } };
    }
    case 'water': {
      const ml = num(b.ml, 0, 8000);
      if (ml === null) return bad('That is a lot of water.');
      await db.sql`INSERT INTO water (user_id, day, ml) VALUES (${me}, ${day}, ${ml}) ON CONFLICT (user_id, day) DO UPDATE SET ml = excluded.ml`;
      return { json: { water_ml: ml } };
    }
    case 'workout.add': {
      const minutes = num(b.minutes, 1, 600);
      if (!MET[b.type] || minutes === null) return bad('Pick an activity and minutes.');
      const [p] = await db.sql`SELECT weight_kg FROM profiles WHERE user_id = ${me}`;
      const kcal = Math.round(MET[b.type] * (p ? p.weight_kg : 70) * (minutes / 60));
      await db.sql`INSERT INTO workouts (user_id, day, type, minutes, kcal) VALUES (${me}, ${day}, ${b.type}, ${minutes}, ${kcal})`;
      return { status: 201, json: { kcal } };
    }
    case 'workout.remove': {
      await db.sql`DELETE FROM workouts WHERE id = ${Number(b.id)} AND user_id = ${me}`;
      return { json: { ok: true } };
    }
    case 'weight': {
      const kg = num(b.kg, 30, 300);
      if (kg === null) return bad('Enter your weight in kg.');
      await db.batch([
        ['INSERT INTO weights (user_id, day, kg) VALUES (?, ?, ?) ON CONFLICT (user_id, day) DO UPDATE SET kg = excluded.kg', [me, day, kg]],
        ['UPDATE profiles SET weight_kg = ? WHERE user_id = ?', [kg, me]]
      ]);
      return { json: { ok: true } };
    }
    case 'stats': {
      const from = new Date(Date.parse(day) - 29 * 86400000).toISOString().slice(0, 10);
      const eaten = await db.sql`SELECT day, ROUND(SUM(kcal)) AS kcal, ROUND(SUM(protein)) AS protein FROM entries WHERE user_id = ${me} AND day BETWEEN ${from} AND ${day} GROUP BY day`;
      const burned = await db.sql`SELECT day, SUM(kcal) AS kcal FROM workouts WHERE user_id = ${me} AND day BETWEEN ${from} AND ${day} GROUP BY day`;
      const weights = await db.sql`SELECT day, kg FROM weights WHERE user_id = ${me} ORDER BY day DESC LIMIT 60`;
      const days = await db.sql`SELECT DISTINCT day FROM entries WHERE user_id = ${me} AND day <= ${day} ORDER BY day DESC LIMIT 400`;
      let streak = 0, cursor = Date.parse(day);
      for (const d of days) { if (d.day === new Date(cursor).toISOString().slice(0, 10)) { streak++; cursor -= 86400000; } else break; }
      return { json: { eaten, burned, weights: weights.reverse(), streak } };
    }
    case 'estimate': {
      const text = String(b.text || '').trim().slice(0, 400);
      if (!text) return bad('Describe what you ate.');
      const { text: answer } = await ai.chat({
        system: 'You estimate nutrition. Reply with ONLY JSON: {"items":[{"name":"...","kcal":0,"protein":0,"carbs":0,"fat":0}]} using realistic portion sizes. Grams for macros, whole numbers.',
        messages: [{ role: 'user', content: text }]
      });
      const match = String(answer).match(/\{[\s\S]*\}/);
      let items = [];
      try { items = JSON.parse(match ? match[0] : answer).items || []; } catch { return bad('Could not estimate that. Try describing it differently.'); }
      return { json: { items: items.slice(0, 8).map((i) => ({ name: String(i.name || 'Food').slice(0, 80), kcal: Math.max(0, Math.round(Number(i.kcal) || 0)), protein: Math.round(Number(i.protein) || 0), carbs: Math.round(Number(i.carbs) || 0), fat: Math.round(Number(i.fat) || 0) })) } };
    }
    default:
      return bad('Unknown action');
  }
}

function isDay(v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')); }
