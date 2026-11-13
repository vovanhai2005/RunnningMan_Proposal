/**
 * Link Google Maps: theo tọa độ khi có (chính xác hơn), không thì tìm theo địa chỉ.
 * Trên iPhone mở thẳng app Google Maps nếu có.
 */
type Target = { lat: number | null; lng: number | null; address?: string; title?: string };

function where(p: Target) {
  if (p.lat != null && p.lng != null) return `${p.lat},${p.lng}`;
  return encodeURIComponent(p.address || p.title || "");
}

/** Chỉ đường từ vị trí hiện tại tới điểm đến */
export function directionsUrl(p: Target) {
  return `https://www.google.com/maps/dir/?api=1&destination=${where(p)}`;
}

/** Ghim điểm trên bản đồ (xem lại địa điểm đã qua) */
export function placeUrl(p: Target) {
  return `https://www.google.com/maps/search/?api=1&query=${where(p)}`;
}
