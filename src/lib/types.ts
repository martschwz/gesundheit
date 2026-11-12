export type Sex = "m" | "w";
export type Slot = "fruehstueck" | "mittag" | "abend" | "snack";
export type Source = "foto" | "text" | "favorit" | "hand";

export type Settings = {
  owner: string;
  sex: Sex;
  birth_year: number;
  height_cm: number;
  start_weight: number;
  start_day: string;
  target_weight: number;
  activity: number;
  pace: number; // kg pro Woche
  kcal_override: number | null;
  protein_override: number | null;
  updated_at?: string;
};

export type Weight = { owner: string; day: string; kg: number; updated_at?: string };

export type Nutrients = { kcal: number; protein: number; carbs: number; fat: number };
export type FoodItem = Nutrients & { name: string; amount: string };

export type Meal = Nutrients & {
  id: string;
  owner: string;
  day: string;
  slot: Slot;
  title: string;
  items: FoodItem[];
  source: Source;
  created_at: string;
  updated_at?: string;
};

export type Favorite = Nutrients & {
  id: string;
  owner: string;
  title: string;
  slot: Slot | null;
  items: FoodItem[];
  uses: number;
  created_at: string;
  updated_at?: string;
};

export type Tables = { settings: Settings; weights: Weight; meals: Meal; favorites: Favorite };
export type TableName = keyof Tables;
