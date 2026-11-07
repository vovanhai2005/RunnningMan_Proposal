"use client";
import { Component, type ReactNode } from "react";

/** Bản đồ gặp lỗi bất kỳ thì chuyển sang bản dự phòng thay vì làm sập cả trang. */
export class MapErrorBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error("[map] chuyển sang bản đồ dự phòng:", error);
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
