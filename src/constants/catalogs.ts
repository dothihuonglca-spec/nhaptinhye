/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// DANH MỤC CÁC NGUỒN THU TỪ HOẠT ĐỘNG TRỒNG TRỌT (Trang 3 Phụ lục II)
export interface CatalogItem {
  id: number;
  name: string;
  category: string;
}

export const CATALOG_TRONG_TROT: CatalogItem[] = [
  // CÂY LƯƠNG THỰC, THỰC PHẨM VÀ CÂY HẰNG NĂM
  { id: 1, name: "Cây lúa", category: "Cây lương thực, thực phẩm và cây hằng năm" },
  { id: 2, name: "Ngô/bắp", category: "Cây lương thực, thực phẩm và cây hằng năm" },
  { id: 3, name: "Khoai lang", category: "Cây lương thực, thực phẩm và cây hằng năm" },
  { id: 4, name: "Sắn/khoai mỳ", category: "Cây lương thực, thực phẩm và cây hằng năm" },
  { id: 5, name: "Cây lương thực khác", category: "Cây lương thực, thực phẩm và cây hằng năm" },
  { id: 6, name: "Khoai tây", category: "Cây lương thực, thực phẩm và cây hằng năm" },
  { id: 7, name: "Rau muống", category: "Cây lương thực, thực phẩm và cây hằng năm" },
  { id: 8, name: "Su hào", category: "Cây lương thực, thực phẩm và cây hằng năm" },
  { id: 9, name: "Bắp cải, súp lơ", category: "Cây lương thực, thực phẩm và cây hằng năm" },
  { id: 10, name: "Rau cải các loại", category: "Cây lương thực, thực phẩm và cây hằng năm" },
  { id: 11, name: "Đậu ăn quả tươi các loại", category: "Cây lương thực, thực phẩm và cây hằng năm" },
  { id: 12, name: "Cà chua", category: "Cây lương thực, thực phẩm và cây hằng năm" },
  { id: 13, name: "Cây gia vị", category: "Cây lương thực, thực phẩm và cây hằng năm" },
  { id: 14, name: "Rau củ quả khác", category: "Cây lương thực, thực phẩm và cây hằng năm" },
  { id: 15, name: "Cây hằng năm khác (đậu xanh, đen, đỏ, hoa, cây cảnh, thức ăn gia súc...)", category: "Cây lương thực, thực phẩm và cây hằng năm" },

  // CÂY CÔNG NGHIỆP HẰNG NĂM VÀ LÂU NĂM
  { id: 16, name: "Đậu tương/ đậu nành", category: "Cây công nghiệp hằng năm và lâu năm" },
  { id: 17, name: "Lạc/ đậu phộng", category: "Cây công nghiệp hằng năm và lâu năm" },
  { id: 18, name: "Vừng/ mè", category: "Cây công nghiệp hằng năm và lâu năm" },
  { id: 19, name: "Mía", category: "Cây công nghiệp hằng năm và lâu năm" },
  { id: 20, name: "Thuốc lá, thuốc lào", category: "Cây công nghiệp hằng năm và lâu năm" },
  { id: 21, name: "Bông", category: "Cây công nghiệp hằng năm và lâu năm" },
  { id: 22, name: "Đay, gai", category: "Cây công nghiệp hằng năm và lâu năm" },
  { id: 23, name: "Cói", category: "Cây công nghiệp hằng năm và lâu năm" },
  { id: 24, name: "Cây CN hằng năm khác", category: "Cây công nghiệp hằng năm và lâu năm" },
  { id: 25, name: "Chè", category: "Cây công nghiệp hằng năm và lâu năm" },
  { id: 26, name: "Cà phê", category: "Cây công nghiệp hằng năm và lâu năm" },
  { id: 27, name: "Cao su", category: "Cây công nghiệp hằng năm và lâu năm" },
  { id: 28, name: "Hồ tiêu", category: "Cây công nghiệp hằng năm và lâu năm" },
  { id: 29, name: "Dừa", category: "Cây công nghiệp hằng năm và lâu năm" },
  { id: 30, name: "Dâu tằm", category: "Cây công nghiệp hằng năm và lâu năm" },
  { id: 31, name: "Điều/ đào lộn hột", category: "Cây công nghiệp hằng năm và lâu năm" },
  { id: 32, name: "Cây CN lâu năm khác", category: "Cây công nghiệp hằng năm và lâu năm" },

  // CÂY ĂN QUẢ
  { id: 33, name: "Cam, chanh, quít, bưởi", category: "Cây ăn quả" },
  { id: 34, name: "Dứa", category: "Cây ăn quả" },
  { id: 35, name: "Chuối", category: "Cây ăn quả" },
  { id: 36, name: "Xoài, muỗm", category: "Cây ăn quả" },
  { id: 37, name: "Táo", category: "Cây ăn quả" },
  { id: 38, name: "Nho", category: "Cây ăn quả" },
  { id: 39, name: "Mận", category: "Cây ăn quả" },
  { id: 40, name: "Đu đủ", category: "Cây ăn quả" },
  { id: 41, name: "Nhãn, vải, chôm chôm", category: "Cây ăn quả" },
  { id: 42, name: "Hồng xiêm/Sa pu chê", category: "Cây ăn quả" },
  { id: 43, name: "Na/mãng cầu", category: "Cây ăn quả" },
  { id: 44, name: "Mít, sầu riêng", category: "Cây ăn quả" },
  { id: 45, name: "Măng cụt", category: "Cây ăn quả" },
  { id: 46, name: "Cây ăn quả khác", category: "Cây ăn quả" },

  // CÂY LÂU NĂM KHÁC & GIỐNG
  { id: 47, name: "Cây lâu năm khác", category: "Cây lâu năm khác & Giống" },
  { id: 48, name: "Cây giống", category: "Cây lâu năm khác & Giống" },

  // SẢN PHẨM PHỤ VÀ SẢN PHẨM THU NHẶT TỪ TRỒNG TRỌT
  { id: 49, name: "Rơm, rạ", category: "Sản phẩm phụ và thu nhặt từ trồng trọt" },
  { id: 50, name: "Lá, thân khoai lang", category: "Sản phẩm phụ và thu nhặt từ trồng trọt" },
  { id: 51, name: "Thân cây ngô, cây sắn", category: "Sản phẩm phụ và thu nhặt từ trồng trọt" },
  { id: 52, name: "Thân cây đậu các loại", category: "Sản phẩm phụ và thu nhặt từ trồng trọt" },
  { id: 53, name: "Ngọn, lá mía", category: "Sản phẩm phụ và thu nhặt từ trồng trọt" },
  { id: 54, name: "Thân cây đay, cây gai", category: "Sản phẩm phụ và thu nhặt từ trồng trọt" },
  { id: 55, name: "Dâu tằm (thân cây)", category: "Sản phẩm phụ và thu nhặt từ trồng trọt" },
  { id: 56, name: "Củi (từ các cây nông nghiệp)", category: "Sản phẩm phụ và thu nhặt từ trồng trọt" },
  { id: 57, name: "Các sản phẩm phụ khác", category: "Sản phẩm phụ và thu nhặt từ trồng trọt" },
  { id: 58, name: "Các sản phẩm thu nhặt, mót", category: "Sản phẩm phụ và thu nhặt từ trồng trọt" },

  // DỊCH VỤ TRỒNG TRỌT
  { id: 59, name: "Cày xới, làm đất", category: "Dịch vụ trồng trọt" },
  { id: 60, name: "Tưới tiêu nước", category: "Dịch vụ trồng trọt" },
  { id: 61, name: "Phòng trừ sâu bệnh", category: "Dịch vụ trồng trọt" },
  { id: 62, name: "Tuốt lúa, sơ chế sản phẩm", category: "Dịch vụ trồng trọt" },
  { id: 63, name: "Dịch vụ trồng trọt khác", category: "Dịch vụ trồng trọt" }
];

// DANH MỤC CÁC NGUỒN THU TỪ HOẠT ĐỘNG CHĂN NUÔI (Trang 6 Phụ lục II)
export const CATALOG_CHAN_NUOI: CatalogItem[] = [
  // GIA SÚC
  { id: 1, name: "Thịt lợn hơi", category: "Gia súc" },
  { id: 2, name: "Thịt trâu, bò hơi", category: "Gia súc" },
  { id: 3, name: "Ngựa", category: "Gia súc" },
  { id: 4, name: "Dê, cừu", category: "Gia súc" },
  { id: 5, name: "Gia súc khác", category: "Gia súc" },

  // GIA CẦM
  { id: 6, name: "Gà", category: "Gia cầm" },
  { id: 7, name: "Vịt, ngan, ngỗng", category: "Gia cầm" },
  { id: 8, name: "Gia cầm khác", category: "Gia cầm" },

  // CHĂN NUÔI KHÁC
  { id: 9, name: "Chó", category: "Chăn nuôi khác" },
  { id: 10, name: "Thỏ", category: "Chăn nuôi khác" },
  { id: 11, name: "Trăn", category: "Chăn nuôi khác" },
  { id: 12, name: "Rắn", category: "Chăn nuôi khác" },
  { id: 13, name: "Chăn nuôi khác", category: "Chăn nuôi khác" },

  // SẢN PHẨM KHÔNG QUA GIẾT MỔ
  { id: 14, name: "Trứng gia cầm (gà, vịt, …)", category: "Sản phẩm không qua giết mổ" },
  { id: 15, name: "Sữa tươi", category: "Sản phẩm không qua giết mổ" },
  { id: 16, name: "Kén tằm", category: "Sản phẩm không qua giết mổ" },
  { id: 17, name: "Mật ong", category: "Sản phẩm không qua giết mổ" },
  { id: 18, name: "Sản phẩm khác (không qua giết mổ)", category: "Sản phẩm không qua giết mổ" },

  // GIỐNG GIA SÚC, GIA CẦM, VẬT NUÔI
  { id: 19, name: "Lợn giống", category: "Giống vật nuôi" },
  { id: 20, name: "Trâu bò giống", category: "Giống vật nuôi" },
  { id: 21, name: "Giống gia súc khác, gia cầm, vật nuôi khác", category: "Giống vật nuôi" },

  // SẢN PHẨM PHỤ CHĂN NUÔI
  { id: 22, name: "Phân trâu, bò, lợn, gia cầm, phân tằm", category: "Sản phẩm phụ chăn nuôi" },
  { id: 23, name: "Sản phẩm chăn nuôi tận thu: lông, sừng, xương, da…", category: "Sản phẩm phụ chăn nuôi" },

  // DỊCH VỤ CHĂN NUÔI
  { id: 24, name: "Thụ tinh nhân tạo", category: "Dịch vụ chăn nuôi" },
  { id: 25, name: "Thiến, hoạn gia súc gia cầm", category: "Dịch vụ chăn nuôi" },
  { id: 26, name: "Dịch vụ chăn nuôi khác (phân loại, lau sạch trứng...)", category: "Dịch vụ chăn nuôi" }
];

// DANH MỤC CÁC NGUỒN THU TỪ HOẠT ĐỘNG LÂM NGHIỆP (Trang 8 Phụ lục II)
export const CATALOG_LAM_NGHIEP: CatalogItem[] = [
  // KHAI THÁC, THU NHẶT LÂM SẢN
  { id: 1, name: "Trẩu, sở", category: "Khai thác, thu nhặt lâm sản" },
  { id: 2, name: "Quế", category: "Khai thác, thu nhặt lâm sản" },
  { id: 3, name: "Hồi", category: "Khai thác, thu nhặt lâm sản" },
  { id: 4, name: "Thông", category: "Khai thác, thu nhặt lâm sản" },
  { id: 5, name: "Cây cánh kiến", category: "Khai thác, thu nhặt lâm sản" },
  { id: 6, name: "Cây lấy gỗ", category: "Khai thác, thu nhặt lâm sản" },
  { id: 7, name: "Tre, luồng, nứa", category: "Khai thác, thu nhặt lâm sản" },
  { id: 8, name: "Cọ", category: "Khai thác, thu nhặt lâm sản" },
  { id: 9, name: "Dừa nước", category: "Khai thác, thu nhặt lâm sản" },
  { id: 10, name: "Cây lâm nghiệp khác", category: "Khai thác, thu nhặt lâm sản" },
  { id: 11, name: "Củi", category: "Khai thác, thu nhặt lâm sản" },

  // DỊCH VỤ LÂM NGHIỆP
  { id: 12, name: "Bảo vệ rừng", category: "Dịch vụ lâm nghiệp" },
  { id: 13, name: "Quản lý lâm nghiệp", category: "Dịch vụ lâm nghiệp" },
  { id: 14, name: "Dịch vụ lâm nghiệp khác (tưới tiêu, sơ chế gỗ trong rừng...)", category: "Dịch vụ lâm nghiệp" }
];

// DANH MỤC THỦY SẢN (Trang 9, 10 Phụ lục II)
export const CATALOG_THUY_SAN: CatalogItem[] = [
  { id: 1, name: "Cá nuôi", category: "Nuôi trồng thủy sản" },
  { id: 2, name: "Tôm nuôi", category: "Nuôi trồng thủy sản" },
  { id: 3, name: "Cua, ghẹ, ốc, thủy sản nuôi khác", category: "Nuôi trồng thủy sản" },
  { id: 4, name: "Cá đánh bắt tự nhiên", category: "Đánh bắt thủy sản" },
  { id: 5, name: "Tôm đánh bắt tự nhiên", category: "Đánh bắt thủy sản" },
  { id: 6, name: "Thủy hải sản đánh bắt khác", category: "Đánh bắt thủy sản" },
  { id: 7, name: "Cá giống các loại", category: "Sản xuất giống thủy sản" },
  { id: 8, name: "Tôm giống các loại", category: "Sản xuất giống thủy sản" },
  { id: 9, name: "Thủy sản giống khác", category: "Sản xuất giống thủy sản" }
];

// DANH MỤC HOẠT ĐỘNG SXKD PHI NÔNG, LÂM, THỦY SẢN (Mục 6 - Trang 11)
export const CATALOG_PHI_NONG_NGHIEP: CatalogItem[] = [
  // CÔNG NGHIỆP, XÂY DỰNG & CHẾ BIẾN (Ngành 2)
  { id: 101, name: "Xay xát lúa gạo, chế biến nông sản", category: "Công nghiệp chế biến, chế tạo" },
  { id: 102, name: "Làm bún, bánh phở, bánh đa, đậu phụ", category: "Công nghiệp chế biến, chế tạo" },
  { id: 103, name: "Nấu rượu, sản xuất đồ uống truyền thống", category: "Công nghiệp chế biến, chế tạo" },
  { id: 104, name: "Chế biến giò chả, thịt hun khói, thủy hải sản khô", category: "Công nghiệp chế biến, chế tạo" },
  { id: 105, name: "Mộc gia dụng, đồ gỗ nội thất, điêu khắc", category: "Sản xuất đồ gỗ, mộc dân dụng" },
  { id: 106, name: "May mặc gia công, rèm cửa, chăn ga gối", category: "Dệt, may mặc gia công" },
  { id: 107, name: "Đan lát mây tre, thủ công mỹ nghệ", category: "Sản xuất thủ công mỹ nghệ" },
  { id: 108, name: "Gò hàn kim loại, nhôm kính, cửa sắt", category: "Cơ khí, sản xuất kim loại" },
  { id: 109, name: "Sản xuất vật liệu xây dựng (gạch, ngói, bê tông)", category: "Sản xuất vật liệu xây dựng" },
  { id: 110, name: "Thợ xây, nhận khoán thi công hoàn thiện nhà", category: "Xây dựng dân dụng" },
  { id: 111, name: "Lắp đặt điện nước công trình", category: "Xây dựng dân dụng" },

  // THƯƠNG MẠI & BÁN LẺ (Ngành 3)
  { id: 201, name: "Bán lẻ bách hóa tổng hợp, tiệm tạp hóa", category: "Thương mại, bán buôn - bán lẻ" },
  { id: 202, name: "Đại lý phân bón, thuốc BVTV, thức ăn gia súc", category: "Thương mại, bán buôn - bán lẻ" },
  { id: 203, name: "Bán lẻ rau củ quả, hoa quả tươi", category: "Thương mại, bán buôn - bán lẻ" },
  { id: 204, name: "Bán buôn, thu gom nông lâm sản", category: "Thương mại, bán buôn - bán lẻ" },
  { id: 205, name: "Cửa hàng quần áo, giày dép, đồ gia dụng", category: "Thương mại, bán buôn - bán lẻ" },
  { id: 206, name: "Cửa hàng thuốc tây, dược phẩm y tế", category: "Thương mại, bán buôn - bán lẻ" },
  { id: 207, name: "Cửa hàng điện máy, điện thoại, thiết bị công nghệ", category: "Thương mại, bán buôn - bán lẻ" },

  // DỊCH VỤ (Ngành 3)
  { id: 301, name: "Quán cơm, bún phở, cháo, điểm tâm", category: "Dịch vụ ăn uống, lưu trú" },
  { id: 302, name: "Quán cà phê, nước giải khát, trà chanh", category: "Dịch vụ ăn uống, lưu trú" },
  { id: 303, name: "Vận tải hàng hóa bằng ô tô tải, xe ba gác", category: "Vận tải, kho bãi" },
  { id: 304, name: "Vận chuyển hành khách bằng ô tô, taxi, xe máy", category: "Vận tải, kho bãi" },
  { id: 305, name: "Sửa chữa xe máy, ô tô, săm lốp", category: "Dịch vụ sửa chữa, bảo dưỡng" },
  { id: 306, name: "Sửa chữa điện tử, điện lạnh, đồ dùng gia đình", category: "Dịch vụ sửa chữa, bảo dưỡng" },
  { id: 307, name: "Cắt tóc, gội đầu, làm móng, spa làm đẹp", category: "Dịch vụ cá nhân khác" },
  { id: 308, name: "Cho thuê rạp cưới, âm thanh ánh sáng, bàn ghế sự kiện", category: "Dịch vụ phục vụ gia đình, sự kiện" },
  { id: 309, name: "Trông giữ trẻ, giúp việc gia đình", category: "Dịch vụ phục vụ gia đình, sự kiện" }
];

// DANH MỤC NGHỀ NGHIỆP / CÔNG VIỆC PHỔ BIẾN (Mục 1 - Lương công)
export const CATALOG_CONG_VIEC: CatalogItem[] = [
  { id: 1, name: "Công nhân khu công nghiệp / nhà máy", category: "Lao động sản xuất công nghiệp" },
  { id: 2, name: "Thợ xây dựng, phụ hồ, thợ cốt pha", category: "Xây dựng" },
  { id: 3, name: "Lái xe tải, xe khách, taxi, xe ôm công nghệ", category: "Vận tải" },
  { id: 4, name: "Thợ mộc, thợ cơ khí hàn xì", category: "Thợ thủ công" },
  { id: 5, name: "Thợ may, thợ thêu đan gia công", category: "May mặc" },
  { id: 6, name: "Làm thuê nông vụ thời vụ (cấy, gặt, hái cà phê...)", category: "Nông nghiệp làm thuê" },
  { id: 7, name: "Cán bộ, công chức, viên chức cấp xã / trường học", category: "Khu vực Nhà nước" },
  { id: 8, name: "Giáo viên mầm non, tiểu học, THCS", category: "Giáo dục" },
  { id: 9, name: "Nhân viên y tế thôn bản, trạm y tế", category: "Y tế" },
  { id: 10, name: "Bảo vệ, tạp vụ, trông coi cơ quan / doanh nghiệp", category: "Dịch vụ bảo vệ, hỗ trợ" },
  { id: 11, name: "Nhân viên bán hàng, thu ngân cửa hàng / đại lý", category: "Bán hàng" },
  { id: 12, name: "Lao động tự do, bốc vác, phụ việc", category: "Lao động phổ thông" }
];

// DANH MỤC NGUỒN THU KHÁC (Mục 7 - Trang 12)
export const CATALOG_THU_KHAC: CatalogItem[] = [
  { id: 1, name: "Tiền kiều hối gửi về từ nước ngoài", category: "Thu chuyển nhượng / biếu tặng" },
  { id: 2, name: "Tiền, quà biếu tặng từ con cái, họ hàng, người thân", category: "Thu chuyển nhượng / biếu tặng" },
  { id: 3, name: "Tiền mừng cưới, hỏi, tân gia, ma chay", category: "Thu chuyển nhượng / biếu tặng" },
  { id: 4, name: "Trợ cấp bảo trợ xã hội (người khuyết tật, người già neo đơn)", category: "Trợ cấp an sinh, chính sách" },
  { id: 5, name: "Trợ cấp ưu đãi người có công, thương binh, liệt sĩ", category: "Trợ cấp an sinh, chính sách" },
  { id: 6, name: "Tiền cứu trợ thiên tai, bão lũ, hỗ trợ khó khăn đột xuất", category: "Trợ cấp an sinh, chính sách" },
  { id: 7, name: "Học bổng, hỗ trợ học tập, y tế cho học sinh / sinh viên", category: "Học bổng, hỗ trợ giáo dục" },
  { id: 8, name: "Tiền cho thuê đất đai, nhà ở, kho bãi, máy móc", category: "Thu từ tài sản, đầu tư" },
  { id: 9, name: "Tiền lãi gửi tiết kiệm ngân hàng, lãi cho vay", category: "Thu từ tài sản, đầu tư" },
  { id: 10, name: "Cổ tức, lợi nhuận chia từ góp vốn đầu tư", category: "Thu từ tài sản, đầu tư" },
  { id: 11, name: "Tiền trúng thưởng xổ số kiến thiết, giải thưởng", category: "Thu nhập vãng lai, may rủi" }
];
