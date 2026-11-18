export function ratingColor(value: number | null): string {
  if (value === null) return '#e8e6e1';
  const colors = ['#c75146', '#cf6748', '#d77d4a', '#df944c', '#dba84e', '#bdad50', '#98ad54', '#72a95c', '#50a36a', '#319875'];
  return colors[value - 1] ?? '#e8e6e1';
}

export function ratingTextColor(value: number | null): string {
  return value !== null && value >= 5 ? '#173d32' : '#54251f';
}
