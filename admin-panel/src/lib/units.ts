export interface UnitOption {
  value: string;
  label: string;
  group: string;
}

// Units for school sustainability challenges
export const allUnits: UnitOption[] = [
  // Count - for recycling, activities
  { value: "items", label: "Items", group: "Count" },
  { value: "pieces", label: "Pieces", group: "Count" },
  { value: "bottles", label: "Bottles", group: "Count" },
  { value: "cans", label: "Cans", group: "Count" },
  { value: "bags", label: "Bags", group: "Count" },
  { value: "boxes", label: "Boxes", group: "Count" },
  { value: "pages", label: "Pages", group: "Count" },

  // Nature & Gardening
  { value: "trees", label: "Trees", group: "Nature" },
  { value: "plants", label: "Plants", group: "Nature" },
  { value: "seeds", label: "Seeds", group: "Nature" },

  // Food & Nutrition
  { value: "meals", label: "Meals", group: "Food" },
  { value: "servings", label: "Servings", group: "Food" },
  { value: "snacks", label: "Snacks", group: "Food" },

  // Activities & Actions
  { value: "activities", label: "Activities", group: "Actions" },
  { value: "trips", label: "Trips", group: "Actions" },
  { value: "actions", label: "Actions", group: "Actions" },
  { value: "tasks", label: "Tasks", group: "Actions" },

  // Weight - for recycling
  { value: "kg", label: "Kilograms (kg)", group: "Weight" },
  { value: "g", label: "Grams (g)", group: "Weight" },
  { value: "lb", label: "Pounds (lb)", group: "Weight" },

  // Volume - for water conservation
  { value: "liters", label: "Liters", group: "Volume" },
  { value: "ml", label: "Milliliters (ml)", group: "Volume" },
  { value: "gallons", label: "Gallons", group: "Volume" },

  // Distance - for eco transport
  { value: "km", label: "Kilometers (km)", group: "Distance" },
  { value: "m", label: "Meters (m)", group: "Distance" },
  { value: "miles", label: "Miles", group: "Distance" },
  { value: "steps", label: "Steps", group: "Distance" },

  // Time
  { value: "minutes", label: "Minutes", group: "Time" },
  { value: "hours", label: "Hours", group: "Time" },
  { value: "days", label: "Days", group: "Time" },
  { value: "weeks", label: "Weeks", group: "Time" },

  // Energy
  { value: "kWh", label: "Kilowatt-hours (kWh)", group: "Energy" },
  { value: "watts", label: "Watts", group: "Energy" },

  // Area - for gardening
  { value: "sqm", label: "Square Meters", group: "Area" },
  { value: "sqft", label: "Square Feet", group: "Area" },

  // Percentage
  { value: "percent", label: "Percent (%)", group: "Other" },
  { value: "points", label: "Points", group: "Other" },
];

// Get unit label by value
export function getUnitLabel(unitValue: string): string {
  const unit = allUnits.find((u) => u.value === unitValue);
  return unit?.label || unitValue;
}

// Get all units
export function getAllUnitsWithCustom(): UnitOption[] {
  return allUnits;
}
