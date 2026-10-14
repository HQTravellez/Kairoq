CREATE TABLE foods (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  serving TEXT NOT NULL,
  kcal REAL NOT NULL,
  protein REAL NOT NULL,
  carbs REAL NOT NULL,
  fat REAL NOT NULL,
  category TEXT NOT NULL
);
CREATE INDEX foods_name ON foods (name);

CREATE TABLE profiles (
  user_id TEXT PRIMARY KEY,
  sex TEXT NOT NULL CHECK (sex IN ('female', 'male')),
  age INTEGER NOT NULL,
  height_cm REAL NOT NULL,
  weight_kg REAL NOT NULL,
  activity TEXT NOT NULL,
  goal TEXT NOT NULL CHECK (goal IN ('lose', 'maintain', 'gain')),
  kcal_target INTEGER NOT NULL,
  protein_g INTEGER NOT NULL,
  carbs_g INTEGER NOT NULL,
  fat_g INTEGER NOT NULL,
  water_ml INTEGER NOT NULL DEFAULT 2000,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE entries (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL,
  day TEXT NOT NULL,
  meal TEXT NOT NULL CHECK (meal IN ('breakfast', 'lunch', 'dinner', 'snacks')),
  food_id INTEGER REFERENCES foods(id),
  name TEXT NOT NULL,
  servings REAL NOT NULL DEFAULT 1,
  kcal REAL NOT NULL,
  protein REAL NOT NULL DEFAULT 0,
  carbs REAL NOT NULL DEFAULT 0,
  fat REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX entries_user_day ON entries (user_id, day);

CREATE TABLE workouts (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL,
  day TEXT NOT NULL,
  type TEXT NOT NULL,
  minutes INTEGER NOT NULL CHECK (minutes > 0),
  kcal INTEGER NOT NULL
);
CREATE INDEX workouts_user_day ON workouts (user_id, day);

CREATE TABLE water (user_id TEXT NOT NULL, day TEXT NOT NULL, ml INTEGER NOT NULL, PRIMARY KEY (user_id, day));
CREATE TABLE weights (user_id TEXT NOT NULL, day TEXT NOT NULL, kg REAL NOT NULL, PRIMARY KEY (user_id, day));

INSERT INTO foods (name, serving, kcal, protein, carbs, fat, category) VALUES
 ('Oatmeal, cooked', '1 bowl (240 g)', 158, 6, 27, 3.2, 'Breakfast'),
 ('Greek yogurt, plain 2%', '1 pot (170 g)', 146, 20, 8, 3.8, 'Dairy'),
 ('Scrambled eggs', '2 eggs', 182, 12, 2, 14, 'Breakfast'),
 ('Boiled egg', '1 large egg', 78, 6.3, 0.6, 5.3, 'Breakfast'),
 ('Wholegrain toast', '1 slice', 81, 4, 14, 1.1, 'Bakery'),
 ('Avocado toast', '1 slice with ½ avocado', 236, 6, 22, 15, 'Breakfast'),
 ('Banana', '1 medium', 105, 1.3, 27, 0.4, 'Fruit'),
 ('Apple', '1 medium', 95, 0.5, 25, 0.3, 'Fruit'),
 ('Blueberries', '1 cup (148 g)', 84, 1.1, 21, 0.5, 'Fruit'),
 ('Orange', '1 medium', 62, 1.2, 15, 0.2, 'Fruit'),
 ('Strawberries', '1 cup (150 g)', 48, 1, 11.5, 0.5, 'Fruit'),
 ('Granola', '½ cup (60 g)', 270, 6, 36, 12, 'Breakfast'),
 ('Protein shake', '1 scoop with water', 120, 24, 3, 1.5, 'Drinks'),
 ('Cappuccino', '1 cup (whole milk)', 110, 6, 9, 6, 'Drinks'),
 ('Orange juice', '1 glass (250 ml)', 112, 1.7, 26, 0.5, 'Drinks'),
 ('Grilled chicken breast', '150 g', 248, 46, 0, 5.4, 'Protein'),
 ('Salmon fillet, baked', '150 g', 312, 34, 0, 19, 'Protein'),
 ('Tuna, canned in water', '1 can (120 g)', 128, 28, 0, 1, 'Protein'),
 ('Lean beef mince, cooked', '150 g', 330, 39, 0, 19, 'Protein'),
 ('Tofu, firm', '150 g', 216, 24, 4, 13, 'Protein'),
 ('Lentils, cooked', '1 cup (198 g)', 230, 18, 40, 0.8, 'Protein'),
 ('Chickpeas, cooked', '1 cup (164 g)', 269, 14.5, 45, 4.2, 'Protein'),
 ('White rice, cooked', '1 cup (158 g)', 205, 4.3, 45, 0.4, 'Grains'),
 ('Brown rice, cooked', '1 cup (195 g)', 216, 5, 45, 1.8, 'Grains'),
 ('Pasta, cooked', '1 cup (140 g)', 221, 8, 43, 1.3, 'Grains'),
 ('Quinoa, cooked', '1 cup (185 g)', 222, 8, 39, 3.6, 'Grains'),
 ('Sweet potato, baked', '1 medium (150 g)', 135, 3, 31, 0.2, 'Vegetables'),
 ('Potatoes, boiled', '200 g', 174, 4, 40, 0.2, 'Vegetables'),
 ('Broccoli, steamed', '1 cup (156 g)', 55, 3.7, 11, 0.6, 'Vegetables'),
 ('Mixed salad', '1 large bowl', 35, 2, 7, 0.4, 'Vegetables'),
 ('Olive oil', '1 tbsp', 119, 0, 0, 13.5, 'Fats'),
 ('Almonds', '1 handful (28 g)', 164, 6, 6, 14, 'Snacks'),
 ('Peanut butter', '1 tbsp', 94, 4, 3, 8, 'Snacks'),
 ('Dark chocolate 70%', '2 squares (20 g)', 120, 1.6, 9, 8.5, 'Snacks'),
 ('Hummus', '3 tbsp', 105, 3, 9, 6, 'Snacks'),
 ('Rice cakes', '2 cakes', 70, 1.4, 15, 0.6, 'Snacks'),
 ('Cheddar cheese', '30 g', 121, 7, 0.4, 10, 'Dairy'),
 ('Milk, semi-skimmed', '1 glass (250 ml)', 122, 8.5, 12, 4.6, 'Dairy'),
 ('Cottage cheese', '½ cup (113 g)', 92, 12, 4, 2.6, 'Dairy'),
 ('Margherita pizza', '2 slices', 500, 21, 64, 18, 'Meals'),
 ('Chicken burrito bowl', '1 bowl', 650, 42, 70, 20, 'Meals'),
 ('Caesar salad with chicken', '1 bowl', 470, 36, 14, 30, 'Meals'),
 ('Sushi, salmon maki', '8 pieces', 300, 12, 52, 5, 'Meals'),
 ('Pad thai with shrimp', '1 plate', 590, 25, 75, 21, 'Meals'),
 ('Spaghetti bolognese', '1 plate', 620, 32, 75, 20, 'Meals'),
 ('Cheeseburger', '1 burger', 535, 30, 40, 28, 'Meals'),
 ('French fries', 'medium portion', 365, 4, 48, 17, 'Meals'),
 ('Vegetable curry with rice', '1 plate', 560, 13, 85, 18, 'Meals'),
 ('Poke bowl, tuna', '1 bowl', 540, 34, 62, 16, 'Meals'),
 ('Croissant', '1 croissant', 231, 4.7, 26, 12, 'Bakery'),
 ('Pastel de nata', '1 tart', 210, 3.5, 25, 11, 'Bakery'),
 ('Bagel with cream cheese', '1 bagel', 360, 12, 56, 10, 'Bakery'),
 ('Cola', '1 can (330 ml)', 139, 0, 35, 0, 'Drinks'),
 ('Beer', '1 bottle (330 ml)', 142, 1.5, 11, 0, 'Drinks'),
 ('Red wine', '1 glass (150 ml)', 125, 0.1, 3.8, 0, 'Drinks'),
 ('Protein bar', '1 bar (60 g)', 210, 20, 22, 7, 'Snacks'),
 ('Popcorn, air-popped', '3 cups', 93, 3, 19, 1.1, 'Snacks'),
 ('Ice cream, vanilla', '1 scoop (66 g)', 137, 2.3, 16, 7.3, 'Snacks');
