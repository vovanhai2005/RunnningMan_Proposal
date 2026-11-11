/** Link Google Maps theo tọa độ (chính xác hơn tìm theo tên). Trên iPhone mở thẳng app Google Maps nếu có. */
type Coord = { lat: number; lng: number };

/** Chỉ đường từ vị trí hiện tại tới điểm đến */
export function directionsUrl(p: Coord) {
  return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
}

/** Ghim điểm trên bản đồ (xem lại địa điểm đã qua) */
export function placeUrl(p: Coord) {
  return `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
}
