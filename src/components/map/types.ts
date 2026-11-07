import type { LatLng } from "@/lib/geo";
import type { PublicRoute } from "@/lib/types";
import type { RouteProgress } from "@/hooks/useRouteProgress";

export type MapViewProps = {
  /** Đổi mỗi chặng để camera căn lại từ đầu */
  stageKey: number;
  dest: LatLng;
  route: PublicRoute | null;
  avatarPos: LatLng | null;
  /** Hướng mũi tên trên viền avatar (độ), null = ẩn */
  heading: number | null;
  avatarUrl: string | null;
  progress: RouteProgress | null;
  /** Còn dưới 1 km: vòng sóng lan quanh điểm đến */
  near: boolean;
  following: boolean;
  onUserPan: () => void;
  /** Khoảng chừa cho thẻ nhiệm vụ ở đáy (px) */
  bottomInset: number;
};
