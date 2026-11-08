/** "850 m", "12,4 km", "128 km" */
export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.max(0, Math.round(m / 10) * 10)} m`;
  const km = m / 1000;
  if (km < 100) return `${km.toFixed(1).replace(".", ",")} km`;
  return `${Math.round(km)} km`;
}

/** "khoảng 1 giờ 20 phút", "khoảng 15 phút", "dưới 1 phút" */
export function formatEta(seconds: number): string {
  if (!isFinite(seconds) || seconds < 60) return "dưới 1 phút";
  const totalMin = Math.round(seconds / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `khoảng ${m} phút`;
  if (m === 0) return `khoảng ${h} giờ`;
  return `khoảng ${h} giờ ${m} phút`;
}
