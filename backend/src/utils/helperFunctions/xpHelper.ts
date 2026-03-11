
export const calculateXpFromPoints = (points: number): number => {
  const safePoints = Number.isFinite(points) ? Math.max(0, Math.floor(points)) : 0;
  return Math.floor(safePoints / 10);
};

