import { directionsUrl, placeUrl } from "@/lib/maps";
import type { PublicPlace } from "@/lib/types";

/**
 * Thẻ điểm đến: tên, địa chỉ và nút mở Google Maps.
 * `mode="go"`: chỉ đường tới đó (điểm đến đang chơi); `"view"`: chỉ ghim địa điểm (đã qua).
 */
export function PlaceCard({
  place,
  label,
  mode = "go",
}: {
  place: PublicPlace;
  label: string;
  mode?: "go" | "view";
}) {
  return (
    <figure className="lvl-place w-full text-left">
      <figcaption className="lvl-clue-label">{label}</figcaption>
      <div className="flex items-start gap-3">
        <PinIcon />
        <div className="min-w-0">
          <p className="display-title text-[21px] leading-tight">{place.title}</p>
          {place.address && (
            <p className="mt-1 text-[15px] leading-snug text-muted">{place.address}</p>
          )}
        </div>
      </div>
      <a
        className="btn btn-ghost btn-sm mt-3 w-full"
        href={mode === "go" ? directionsUrl(place) : placeUrl(place)}
        target="_blank"
        rel="noopener noreferrer"
      >
        {mode === "go" ? "Chỉ đường bằng Google Maps" : "Xem trên Google Maps"}
      </a>
    </figure>
  );
}

function PinIcon() {
  return (
    <svg className="mt-0.5 shrink-0" width="34" height="42" viewBox="0 0 34 42" aria-hidden="true">
      <path
        d="M17 40s14-13.4 14-24.5A14 14 0 0 0 3 15.5C3 26.6 17 40 17 40z"
        fill="var(--accent)"
        stroke="var(--grape)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <circle cx="17" cy="15.5" r="5.5" fill="#fff" stroke="var(--grape)" strokeWidth="2.5" />
      <path d="M9 10.5a9 9 0 0 1 5-4" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity="0.6" fill="none" />
    </svg>
  );
}
