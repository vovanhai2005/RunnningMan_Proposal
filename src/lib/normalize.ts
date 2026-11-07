/**
 * Chuẩn hóa đáp án trước khi so sánh (mục 6.4 của kế hoạch):
 * chữ thường, bỏ dấu tiếng Việt, bỏ dấu câu, gộp khoảng trắng thừa.
 * "Hồ Gươm", "ho guom" và "  HO   GUOM! " đều thành "ho guom".
 */
export function normalizeAnswer(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // dấu thanh, dấu mũ, dấu móc
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ") // dấu câu thành khoảng trắng
    .replace(/\s+/g, " ")
    .trim();
}

/** Đúng nếu khớp một trong các cách viết được chấp nhận. */
export function isCorrectAnswer(input: string, accepted: string[]): boolean {
  const given = normalizeAnswer(input);
  if (!given) return false;
  return accepted.some((a) => normalizeAnswer(a) === given);
}

/** Mã chữ in dưới QR: không phân biệt hoa thường, bỏ khoảng trắng và gạch nối. */
export function normalizeCode(input: string): string {
  return normalizeAnswer(input).replace(/[\s-]/g, "");
}
