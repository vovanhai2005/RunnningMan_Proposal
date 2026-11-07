import { describe, expect, it } from "vitest";
import { isCorrectAnswer, normalizeAnswer, normalizeCode } from "./normalize";

describe("normalizeAnswer", () => {
  it("bỏ dấu, chữ thường, khoảng trắng thừa", () => {
    expect(normalizeAnswer("Hồ Gươm")).toBe("ho guom");
    expect(normalizeAnswer("  HO   GUOM ")).toBe("ho guom");
    expect(normalizeAnswer("ho guom")).toBe("ho guom");
  });
  it("xử lý đ/Đ và mọi dấu thanh", () => {
    expect(normalizeAnswer("Đà Lạt")).toBe("da lat");
    expect(normalizeAnswer("Ngã Tư Sở")).toBe("nga tu so");
    expect(normalizeAnswer("Quảng trường Ba Đình")).toBe("quang truong ba dinh");
    expect(normalizeAnswer("ỹ ữ ộ ặ ẳ")).toBe("y u o a a");
  });
  it("bỏ dấu câu", () => {
    expect(normalizeAnswer("Hồ Gươm!")).toBe("ho guom");
    expect(normalizeAnswer("\"Hồ-Gươm\".")).toBe("ho guom");
  });
  it("chuỗi tổ hợp (NFD) từ bàn phím iOS cũng đúng", () => {
    expect(normalizeAnswer("Hồ Gươm".normalize("NFD"))).toBe("ho guom");
  });
});

describe("isCorrectAnswer", () => {
  const accepted = ["Hồ Gươm", "Hồ Hoàn Kiếm"];
  it("chấp nhận các cách viết", () => {
    expect(isCorrectAnswer("ho guom", accepted)).toBe(true);
    expect(isCorrectAnswer(" HO HOAN KIEM ", accepted)).toBe(true);
    expect(isCorrectAnswer("hồ gươm", accepted)).toBe(true);
  });
  it("từ chối đáp án sai hoặc rỗng", () => {
    expect(isCorrectAnswer("ho tay", accepted)).toBe(false);
    expect(isCorrectAnswer("   ", accepted)).toBe(false);
    expect(isCorrectAnswer("ho", accepted)).toBe(false);
  });
});

describe("normalizeCode", () => {
  it("không phân biệt hoa thường, gạch nối, khoảng trắng", () => {
    expect(normalizeCode("rm-4k7q")).toBe(normalizeCode("RM 4K7Q"));
  });
});
