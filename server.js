const express = require("express");
const cors = require("cors"); 
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");
const ffmpeg = require("fluent-ffmpeg");

const app = express();

// Lưu file upload tạm vào thư mục "uploads"
const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(express.json());

// Serve frontend & file mp3 từ thư mục "public"
app.use(express.static("public"));

// Khởi tạo OpenAI client với API key lấy từ biến môi trường
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * 🧠 TÀI LIỆU NỘI BỘ – bạn chỉnh sửa đoạn này theo ý mình
 * Có thể viết vài đoạn mô tả đầy đủ về nhà trường, chương trình, điểm mạnh...
 * Đừng quá dài, khoảng 1–2 trang A4 là ổn.
 */
const INTERNAL_DOC = `
1) Thông tin chung
Tên hệ thống: Hệ thống Giáo dục Dạ Hợp.
Đơn vị trong hệ thống (theo dữ liệu gốc):
Trường Mầm non Hoa Dạ Hợp.
Trường Liên cấp Dạ Hợp (Tiểu học, THCS).
Địa điểm được nêu: tổ 8, Hữu Nghị, phường Hòa Bình.
Mốc phát triển được nêu:
2016: thành lập Trường Mầm non Hoa Dạ Hợp.
2019: thành lập Trường Tiểu học Dạ Hợp.
2022: thành lập Trường Liên cấp Dạ Hợp.
Định hướng: kết hợp truyền thống “tiên học lễ, hậu học văn” với tiếp cận hiện đại (đa trí thông minh, trải nghiệm, cơ sở vật chất hiện đại); lấy người học làm trung tâm; phối hợp chặt chẽ nhà trường – gia đình.
2) Triết lý và phương pháp giáo dục (tổng hợp từ dữ liệu gốc)
Xây dựng môi trường an toàn, tích cực; tôn trọng cá nhân; chú trọng phát triển tri thức, kỹ năng, thể chất và cảm xúc.
Dạy học theo hướng trải nghiệm; khuyến khích khám phá, sáng tạo; vận dụng giáo dục STEAM và thuyết Đa trí thông minh theo lứa tuổi.
Tăng cường tiếng Anh theo lộ trình; tổ chức giờ học thiên về tương tác và giao tiếp.
Theo dõi quá trình để hỗ trợ sự tiến bộ; duy trì cơ chế liên lạc với phụ huynh.
3) Không gian và tiện ích (những hạng mục xuất hiện trong dữ liệu gốc)
Quy mô khuôn viên được nêu: gần 7.000 m²; có sân chơi và các khu chức năng.
Có bể bơi.
Có thư viện/Bookstop và phòng “Happy Room” (không gian hỗ trợ cảm xúc, sinh hoạt CLB đọc sách).
Có hệ thống camera phục vụ phụ huynh theo dõi (kèm yêu cầu bảo mật và tôn trọng riêng tư).
4) Cơ cấu vận hành và các bộ phận (theo mô tả trong dữ liệu gốc)
4.1. Ban điều hành và Ban giám hiệu (thông tin nghề nghiệp, đã loại bỏ dữ liệu định danh cá nhân)
Chủ tịch HĐQT: Nguyễn Mạnh Dũng (sinh 1981). Nền tảng: doanh nhân; tham gia điều hành hệ thống từ năm 2016 theo dữ liệu gốc. Vai trò trọng tâm: định hướng phát triển và chiến lược.
Hiệu trưởng: Nguyễn Thị Nhâm (sinh 1964). Nền tảng: sư phạm Toán; kinh nghiệm quản lý giáo dục.
Hiệu trưởng (được mô tả trong hồ sơ chuyên môn): Nguyễn Thị Tuyết (sinh 1959). Điểm mạnh được nhấn mạnh: kỷ luật, nề nếp; giữ chuẩn mực chuyên môn; có nhiều năm quản lý trong hệ thống giáo dục.
Phó hiệu trưởng: Nguyễn Thanh Huyền (sinh 1983). Nền tảng: thạc sĩ; kinh nghiệm quản lý và điều hành chuyên môn. đồng thời phụ trách QAQC (đảm bảo & cải tiến chất lượng giáo dục) trong toàn hệ thống; chú trọng quy trình – tiêu chuẩn – hiệu quả vận hành.
Phó hiệu trưởng: Nguyễn Thị Minh (sinh 1976). Nền tảng: quản lý giáo dục; kinh nghiệm giảng dạy và quản lý tại bậc tiểu học trước khi tham gia hệ thống.
4.2. Khối vận hành (các vị trí được nêu trong dữ liệu mô tả)
Trần Thị Phi Yến: Trưởng khối vận hành.
Nguyễn Linh Trang: vận hành (tuyển sinh, hồ sơ, đồng phục; hỗ trợ vận hành các hoạt động theo mô tả).
Ngô Thị Oanh: hành chính.
Chu Thị Minh Tú: vận hành bếp.
Bùi Đức Hòa: vận hành (phụ trách âm thanh; hỗ trợ sự kiện theo mô tả).
4.3. Tổ năng khiếu – sự kiện (những nhân sự được nhắc tên trong dữ liệu mô tả)
Vũ Thị Mỹ Linh: tổ trưởng chuyên môn; tham gia tổ chức hoạt động năng khiếu, sự kiện.
Vũ Thị Thủy: giáo viên; tham gia hoạt động năng khiếu, sự kiện.
Nguyễn Thanh Hà: giáo viên; tham gia hoạt động năng khiếu, sự kiện.
Trần Thị Duyên: giáo viên; tham gia hoạt động năng khiếu, sự kiện.
Nguyễn Thị Hiền: giáo viên; tham gia hoạt động năng khiếu, sự kiện.
4.4. Happy Room và Bookstop
Phòng Happy Room: không gian hỗ trợ cảm xúc; ưu tiên sự an toàn, tôn trọng và lắng nghe.
Bookstop: CLB đọc sách sinh hoạt định kỳ hằng tháng; hoạt động gồm đọc theo sở thích, chia sẻ cảm nhận, vẽ, kể chuyện, review sách.
Nhân sự phụ trách được nêu: Nguyễn Thị Quyết (thủ thư; đồng thời là “chủ nhân” Happy Room theo dữ liệu gốc).
5) Danh sách nhân sự 44 người (đã làm sạch theo hồ sơ chi tiết nhất trong tệp)
Nguyên tắc làm sạch: loại bỏ số điện thoại, email, giấy tờ tùy thân, mã định danh cá nhân, dân tộc, giới tính, quê quán; giữ tối đa thông tin nghề nghiệp và chuyên môn (năm sinh, vị trí, nhóm chức vụ, môn dạy, cấp học, trình độ, trạng thái làm việc).
Nguyễn Thị Nhâm (1964) — Hiệu trưởng | Nhóm: Cán bộ quản lý | Môn: (không nêu) | Cấp: (không nêu) | Trình độ: Đại học | Trạng thái: Đang làm việc
Nguyễn Thị Tuyết (1959) — Hiệu trưởng | Nhóm: Cán bộ quản lý | Môn: (không nêu) | Cấp: (không nêu) | Trình độ: Đại học | Trạng thái: Đang làm việc
Nguyễn Thị Thanh Huyền (1983) — Phó hiệu trưởng | Nhóm: Cán bộ quản lý | Môn: (không nêu) | Cấp: (không nêu) | Trình độ: Thạc sĩ | Trạng thái: Đang làm việc
Nguyễn Thị Minh (1976) — Phó hiệu trưởng | Nhóm: Cán bộ quản lý | Môn: (không nêu) | Cấp: (không nêu) | Trình độ: Đại học | Trạng thái: Đang làm việc
Nguyễn Thị Hồng Nhung (1984) — Phó hiệu trưởng | Nhóm: Cán bộ quản lý | Môn: (không nêu) | Cấp: (không nêu) | Trình độ: Đại học | Trạng thái: Đang làm việc
Nguyễn Thị Thu Hương (1981) — Giáo viên | Nhóm: Giáo viên | Môn: Toán | Cấp: Tiểu học | Trình độ: Đại học | Trạng thái: Đang làm việc
Vũ Thị Mỹ Linh (1980) — Giáo viên | Nhóm: Giáo viên | Môn: Tiếng Anh | Cấp: Mầm non | Trình độ: Đại học | Trạng thái: Đang làm việc
Đỗ Thị Hiền (1980) — Giáo viên | Nhóm: Giáo viên | Môn: Văn | Cấp: Tiểu học | Trình độ: Đại học | Trạng thái: Đang làm việc
Lê Thị Ngọc Mai (1994) — Giáo viên | Nhóm: Giáo viên | Môn: Văn | Cấp: THCS | Trình độ: Đại học | Trạng thái: Đang làm việc
Nguyễn Thị Huế (1985) — Giáo viên | Nhóm: Giáo viên | Môn: Toán | Cấp: THCS | Trình độ: Đại học | Trạng thái: Đang làm việc
Đinh Hồng Quân (1986) — Giáo viên | Nhóm: Giáo viên | Môn: Lý | Cấp: THCS | Trình độ: Đại học | Trạng thái: Đang làm việc
Nguyễn Thị Vân Anh (1989) — Giáo viên | Nhóm: Giáo viên | Môn: Hóa | Cấp: THCS | Trình độ: Đại học | Trạng thái: Đang làm việc
Nguyễn Thị Bích Liên (1990) — Giáo viên | Nhóm: Giáo viên | Môn: Sinh | Cấp: THCS | Trình độ: Đại học | Trạng thái: Đang làm việc
Hoàng Thị Thanh (1990) — Giáo viên | Nhóm: Giáo viên | Môn: Sử | Cấp: THCS | Trình độ: Đại học | Trạng thái: Đang làm việc
Nguyễn Thị Hằng (1981) — Giáo viên | Nhóm: Giáo viên | Môn: Địa | Cấp: THCS | Trình độ: Đại học | Trạng thái: Đang làm việc
Hà Văn Lanh (1975) — Giáo viên | Nhóm: Giáo viên | Môn: GDCD | Cấp: THCS | Trình độ: Đại học | Trạng thái: Đã nghỉ
Nguyễn Thị Huyền (1990) — Giáo viên | Nhóm: Giáo viên | Môn: Anh | Cấp: THCS | Trình độ: Đại học | Trạng thái: Đang làm việc
Đinh Thị Thu Hằng (1990) — Giáo viên | Nhóm: Giáo viên | Môn: Anh | Cấp: Tiểu học | Trình độ: Đại học | Trạng thái: Đang làm việc
Đinh Thanh Thảo (1993) — Giáo viên | Nhóm: Giáo viên | Môn: Anh | Cấp: Mầm non | Trình độ: Đại học | Trạng thái: Đang làm việc
Nguyễn Thị Dung (1992) — Giáo viên | Nhóm: Giáo viên | Môn: Anh | Cấp: THCS | Trình độ: Đại học | Trạng thái: Đang làm việc
Nguyễn Thị Thủy (1994) — Giáo viên | Nhóm: Giáo viên | Môn: Tiếng Anh | Cấp: Mầm non | Trình độ: Đại học | Trạng thái: Đang làm việc
Nguyễn Thị Hiền (1991) — Giáo viên | Nhóm: Giáo viên | Môn: (không nêu) | Cấp: Mầm non | Trình độ: Đại học | Trạng thái: Đang làm việc
Nguyễn Thị Mai (1993) — Giáo viên | Nhóm: Giáo viên | Môn: (không nêu) | Cấp: Mầm non | Trình độ: Đại học | Trạng thái: Đang làm việc
Trần Thị Hằng (1990) — Giáo viên | Nhóm: Giáo viên | Môn: (không nêu) | Cấp: Mầm non | Trình độ: Đại học | Trạng thái: Đang làm việc
Đinh Thị Nga (1988) — Giáo viên | Nhóm: Giáo viên | Môn: (không nêu) | Cấp: Mầm non | Trình độ: Đại học | Trạng thái: Đang làm việc
Nguyễn Thị Ngọc (1994) — Giáo viên | Nhóm: Giáo viên | Môn: (không nêu) | Cấp: Mầm non | Trình độ: Đại học | Trạng thái: Đang làm việc
Trần Thị Duyên (1998) — Giáo viên | Nhóm: Giáo viên | Môn: (không nêu) | Cấp: Mầm non | Trình độ: Đại học | Trạng thái: Đang làm việc
Nguyễn Thị Thùy Dương (2003) — Giáo viên | Nhóm: Giáo viên | Môn: (không nêu) | Cấp: Mầm non | Trình độ: Đại học | Trạng thái: Đang làm việc
Nguyễn Thanh Hà (1998) — Giáo viên | Nhóm: Giáo viên | Môn: (không nêu) | Cấp: Mầm non | Trình độ: Cao đẳng | Trạng thái: Đang làm việc
Nguyễn Thị Minh Tiên (1990) — Nhân viên | Nhóm: Nhân viên | Môn: Y tế | Cấp: (không nêu) | Trình độ: Đại học | Trạng thái: Đang làm việc
Đặng Thị Thu Hường (1988) — Nhân viên | Nhóm: Nhân viên | Môn: Giáo vụ | Cấp: (không nêu) | Trình độ: Đại học | Trạng thái: Đang làm việc
Nguyễn Thị Quyết (1982) — Nhân viên | Nhóm: Nhân viên | Môn: Thư viện | Cấp: (không nêu) | Trình độ: Đại học | Trạng thái: Đang làm việc
Nguyễn Thị Thu Phương (1988) — Nhân viên | Nhóm: Nhân viên | Môn: Thủ quỹ | Cấp: (không nêu) | Trình độ: Đại học | Trạng thái: Đang làm việc
Vũ Nguyễn Thanh Tùng (1990) — Nhân viên | Nhóm: Nhân viên | Môn: Bếp trưởng | Cấp: (không nêu) | Trình độ: Trung cấp | Trạng thái: Đang làm việc
Nguyễn Thị Tuyết (1992) — Nhân viên | Nhóm: Nhân viên | Môn: Cấp dưỡng | Cấp: (không nêu) | Trình độ: Trung cấp | Trạng thái: Đang làm việc
Nguyễn Thị Vân (1993) — Nhân viên | Nhóm: Nhân viên | Môn: Cấp dưỡng | Cấp: (không nêu) | Trình độ: Trung cấp | Trạng thái: Đang làm việc
Nguyễn Thị Minh (1995) — Nhân viên | Nhóm: Nhân viên | Môn: Cấp dưỡng | Cấp: (không nêu) | Trình độ: Trung cấp | Trạng thái: Đang làm việc
Nguyễn Thị Hương (1986) — Nhân viên | Nhóm: Nhân viên | Môn: Vệ sinh | Cấp: (không nêu) | Trình độ: Trung cấp | Trạng thái: Đang làm việc
Triệu Thị Phượng (1978) — Nhân viên | Nhóm: Nhân viên | Môn: Vệ sinh | Cấp: (không nêu) | Trình độ: Trung cấp | Trạng thái: Đang làm việc
Nguyễn Văn Sài (1980) — Nhân viên | Nhóm: Nhân viên | Môn: Bảo vệ | Cấp: (không nêu) | Trình độ: Trung cấp | Trạng thái: Đang làm việc
Bùi Thị Bích (1985) — Nhân viên | Nhóm: Nhân viên | Môn: Cấp dưỡng | Cấp: (không nêu) | Trình độ: Trung cấp | Trạng thái: Đang làm việc
Bùi Ngọc Phú (1998) — Nhân viên | Nhóm: Nhân viên | Môn: Truyền thông | Cấp: (không nêu) | Trình độ: Trung cấp | Trạng thái: Đang làm việc
Phạm Thị Kim Oanh (1996) — Giáo viên | Nhóm: Giáo viên | Môn: Tiếng Anh | Cấp: Tiểu học | Trình độ: Đại học | Trạng thái: Đang làm việc
Nguyễn Đức Khang (1994) — Giáo viên | Nhóm: Giáo viên | Môn: Tin | Cấp: Tiểu học | Trình độ: Đại học | Trạng thái: Đang làm việc
Thống kê nhanh từ danh sách 44 người (không thêm dữ kiện ngoài dữ liệu gốc)
Năm sinh sớm nhất: 1959 (Nguyễn Thị Tuyết).
Năm sinh muộn nhất: 2003 (Nguyễn Thị Thùy Dương).
Theo trạng thái làm việc trong dữ liệu gốc: có 01 trường hợp “Đã nghỉ” (Hà Văn Lanh).
6) Câu hỏi thường gặp (FAQ) – đã biên tập lại, bỏ câu trùng và làm rõ ý
I. Tuyển sinh – Nhập học
Làm thế nào để đăng ký tuyển sinh?
Phụ huynh liên hệ nhà trường để được tư vấn và đặt lịch tham quan.
Nhà trường giới thiệu chương trình, môi trường học tập và lớp học.
Sau khi thống nhất nhu cầu, phụ huynh hoàn thiện hồ sơ nhập học theo hướng dẫn của nhà trường.
Trường nhận trẻ từ mấy tuổi?
Nhận trẻ từ 12 tháng đến 6 tuổi.
Có yêu cầu kiểm tra đầu vào không?
Không tổ chức kiểm tra đầu vào.
Trường có chính sách hỗ trợ trẻ mới đi học không?
Có. Trẻ được hỗ trợ làm quen với môi trường mới theo lộ trình phù hợp: làm quen giáo viên, bạn và lớp học; giáo viên theo sát, tạo cảm giác an toàn và kết nối; phối hợp chặt chẽ với phụ huynh để nắm thói quen, sức khỏe và nhu cầu của trẻ, từ đó điều chỉnh cách chăm sóc và tổ chức hoạt động.
Trường có nhận trẻ nhập học giữa năm không?
Có thể tiếp nhận tùy theo tình trạng lớp và nhu cầu thực tế; nhà trường trao đổi trước với phụ huynh và hỗ trợ trẻ làm quen để thích nghi an toàn.
Có tổ chức ăn bán trú không?
Có. Trẻ học bán trú và được chăm sóc theo chế độ sinh hoạt trọn ngày.
II. Chương trình học
Chương trình học của trường có gì nổi bật?
Chương trình được thiết kế theo định hướng phát triển toàn diện, chú trọng “học qua trải nghiệm”.
Ba mảng được nhấn mạnh trong dữ liệu gốc: tiếng Anh, STEAM, và kỹ năng sống.
Nhà trường vận dụng thuyết Đa trí thông minh để quan sát, phát hiện điểm mạnh của từng trẻ và tổ chức hoạt động phù hợp.
Trẻ được học những hoạt động nào?
Hoạt động học theo chủ đề; vận động; âm nhạc; tạo hình; STEAM; tiếng Anh; kỹ năng sống.
Có hoạt động ngoài trời và hoạt động trải nghiệm theo kế hoạch của trường.
Lịch học của trẻ như thế nào?
Thời gian hoạt động trong ngày: 7h00 đến 17h30 từ thứ Hai đến thứ Sáu.
Trong ngày có các khung hoạt động: học tập theo chủ đề, vui chơi, vận động, ăn, ngủ, sinh hoạt.
Trường có tổ chức lớp năng khiếu không?
Có. Các lớp năng khiếu được nêu trong dữ liệu gốc gồm: múa, vẽ, cảm thụ âm nhạc; và một số hoạt động thể chất theo kế hoạch nhà trường.
Giáo viên có chuyên môn phụ trách; lịch học phụ thuộc độ tuổi và thời khóa biểu từng lớp.
Trường có tổ chức sinh nhật cho bé không?
Có. Trường tổ chức sinh nhật theo tháng để tạo không khí ấm áp, vui vẻ và giúp trẻ có kỷ niệm đáng nhớ cùng bạn bè.
III. Hoạt động trải nghiệm và dịch vụ ngoài giờ
Trường có tổ chức dã ngoại không?
Có. Mỗi học kỳ có hoạt động dã ngoại, trải nghiệm phù hợp lứa tuổi. Các ví dụ được nêu: đi trang trại, bảo tàng, công viên; trải nghiệm làm nghề; hoạt động ngoài trời theo kế hoạch của trường.
Bé có được hoạt động ngoài trời không?
Có. Trẻ có thời lượng vui chơi, vận động ngoài trời hằng ngày (tùy điều kiện thời tiết và kế hoạch lớp).
Bé có cần mặc đồng phục không?
Có. Theo dữ liệu gốc: thứ Hai mặc đồng phục; các ngày còn lại phụ huynh chuẩn bị trang phục phù hợp.
Trường có thể chuyển lớp nếu bé chưa phù hợp không?
Có thể, sau khi nhà trường trao đổi với phụ huynh, đánh giá tình hình và thống nhất phương án để bảo đảm trẻ thích nghi.
Trường có tổ chức đón muộn ngoài giờ không?
Có. Khung đón muộn theo dữ liệu gốc: 17h30 đến 18h30 (từ thứ Hai đến thứ Sáu).
Phí đón muộn theo dữ liệu gốc:
17h30–18h00: 50.000 đồng
18h00–18h30: 100.000 đồng
Phụ huynh cần thông báo trước để nhà trường sắp xếp.
IV. Đội ngũ – Cơ sở vật chất – An toàn
Giáo viên có kinh nghiệm không?
Đội ngũ giáo viên kết hợp giữa người có kinh nghiệm và giáo viên trẻ nhiệt huyết; được đào tạo, bồi dưỡng định kỳ về chuyên môn và kỹ năng.
Một lớp có bao nhiêu cô và sĩ số tối đa?
Nhà trẻ (12–36 tháng): 2 giáo viên chính và 1 cô hỗ trợ.
Mẫu giáo: 2 giáo viên/lớp (1 giáo viên chính, 1 giáo viên phụ).
Có giáo viên bộ môn (múa, đàn, tiếng Anh) tham gia theo lịch.
Sĩ số tối đa theo dữ liệu gốc:
12–24 tháng: 20 trẻ
2–4 tuổi: 25 trẻ
4–5 tuổi: 28 trẻ
5–6 tuổi: 30 trẻ
Lớp tăng cường: 22 trẻ
Trường có giáo viên nước ngoài dạy tiếng Anh không?
Có. Trẻ được học tiếng Anh với giáo viên nước ngoài; giáo viên được mô tả là có chứng chỉ giảng dạy quốc tế (TESOL, CELTA hoặc tương đương) và được tuyển chọn theo tiêu chuẩn của nhà trường.
Trường có camera để phụ huynh theo dõi không?
Có. Phụ huynh được cấp tài khoản theo dõi; nhà trường yêu cầu tuân thủ nguyên tắc bảo mật và tôn trọng riêng tư.
Trường có bể bơi không?
Có. Theo dữ liệu gốc, bể bơi là một hạng mục vận hành và phục vụ hoạt động của nhà trường.
V. Dinh dưỡng – Xe đưa đón – Sức khỏe
Chế độ ăn uống của bé ra sao?
Trẻ ăn 5 bữa/ngày (sáng, phụ sáng, trưa, phụ chiều, chiều).
Bếp nấu tại trường; thực đơn đa dạng, cân đối dinh dưỡng; được công khai để phụ huynh theo dõi.
Trường có xe đưa đón không?
Có. Nhà trường có dịch vụ xe đưa đón theo tuyến; có nhân sự đi kèm hỗ trợ trẻ; quy định an toàn và lịch trình được thông báo theo kế hoạch.
Nếu bé bị dị ứng thực phẩm thì nhà trường xử lý ra sao?
Nhà trường ghi nhận thông tin dị ứng từ đầu; thông báo đến giáo viên lớp và bộ phận bếp.
Thực hiện khẩu phần hoặc điều chỉnh bữa ăn phù hợp và giám sát để tránh nhầm lẫn.
Nếu bé bị ốm thì nhà trường xử lý như thế nào?
Giáo viên báo ngay nhân viên y tế; đưa trẻ vào phòng y tế theo dõi.
Thông báo phụ huynh ngay để thống nhất phương án chăm sóc hoặc đưa trẻ đi khám.
Nếu phụ huynh gửi thuốc, nhà trường thực hiện theo chỉ định và quy trình an toàn; trường hợp nghi bệnh truyền nhiễm sẽ triển khai biện pháp phòng dịch và thông tin tới phụ huynh.
VI. Học phí – Chính sách
Học phí của trường là bao nhiêu?
Theo dữ liệu gốc:
Lớp Nhà trẻ: 3,300,000 đồng/tháng
Lớp Mẫu giáo: 3,000,000 đồng/tháng
Lớp tăng cường tiếng Anh: 4,500,000 đồng/tháng
Tiền ăn: 946,000 đồng/tháng (5 bữa/ngày)
Dữ liệu gốc có ghi chú: nên kèm file biểu phí cụ thể theo thời điểm.
Trường có ưu đãi hoặc học bổng không?
Có. Chính sách ưu đãi được nêu gồm: gia đình có từ 2 con học cùng trường; phụ huynh là cư dân khu đô thị Dạ Hợp; phụ huynh đóng học phí theo kỳ hoặc theo năm.
VII. Cơ cấu tổ chức – Nhân sự – Giới thiệu chung – Sự kiện
Cơ cấu tổ chức của Trường Mầm non Hoa Dạ Hợp gồm những gì?
Ban giám hiệu: 1 hiệu trưởng và 3 hiệu phó.
Tổ Mẫu giáo: 3 lớp 2–3 tuổi; 3 lớp 3–4 tuổi; 4 lớp 4–5 tuổi.
Tổ Nhà trẻ: 1 lớp 12–24 tháng; 3 lớp 24–36 tháng.
Nhân sự của trường (theo số liệu mô tả trong dữ liệu gốc)?
Theo mô tả: 40 giáo viên; 4 người thuộc Ban giám hiệu; có giáo viên năng khiếu và giáo viên đứng lớp.
Lưu ý: dữ liệu gốc cũng có một danh sách nhân sự 44 người kèm thông tin chuyên môn (đã được làm sạch và trình bày ở phần 5).
Giới thiệu chung về Trường Mầm non Hoa Dạ Hợp
Môi trường học tập an toàn, thân thiện; định hướng “chơi mà học”; tôn trọng sự khác biệt; nuôi dưỡng cả nhận thức, thể chất, ngôn ngữ, nghệ thuật và kỹ năng xã hội.
Sự kiện trong năm (theo lịch mốc được nêu trong dữ liệu gốc)
23/8: Họp phụ huynh và Ban đại diện phụ huynh học sinh
5/9: Khai giảng
23/9: Cuộc thi âm nhạc
6/10: Trung thu
20/10: Ngày của mẹ, hoạt động đi chợ (kỹ năng sống)
25/10: TATC (tên hoạt động theo dữ liệu gốc)
31/10: Lễ hội hóa trang
10/11–19/11: Tuần lễ Be a teacher và giao lưu thể thao
28/11: Vườn cam (khối Nhà trẻ)
4/12: Quốc tế ôm (SEL)
22/12: Bé hành quân
24/12: Giáng sinh và làm bánh tặng người thân
27/12: TATC (tên hoạt động theo dữ liệu gốc)
9/1: Họp phụ huynh cuối học kỳ 1
23/1: Ngày hội sensory
30/1: Bảo tàng quân sự (khối Mẫu giáo)
9/2–14/2: Hội chợ xuân
6/2: Siêu nhí yêu toán
6/3: Rạp chiếu phim DHE (circle reading, âm nhạc, SEL)
27/3: Thi an toàn giao thông (sport, STEAM)
10/4: TATC (tên hoạt động theo dữ liệu gốc)
20/4–25/4: Triển lãm tranh (art, STEAM)
16/5: Họp phụ huynh học sinh
27/5: Tổng kết năm học và lễ trưởng thành
VII. Thông tin liên hệ:
Địa chỉ: Tổ 8, Hữu Nghị, phường Hòa Bình.
Điện thoại: 02183838899 – Phòng Tuyển sinh.
Hotline: 0356756971 (Cô Nguyễn Thanh Huyền).
Email: dhe@dahop.edu.vn.
`;

/**
 * Hỏi AI với prompt cố định + tài liệu nội bộ
 */
async function askSchoolAssistant(userText) {
  try {
    // Giới hạn tài liệu nội bộ nếu sau này bạn lỡ để quá dài
    const MAX_DOC_CHARS = 25000;
    const docSnippet =
      INTERNAL_DOC.length > MAX_DOC_CHARS
        ? INTERNAL_DOC.slice(0, MAX_DOC_CHARS)
        : INTERNAL_DOC;

    const systemPrompt = `
Bạn là tư vấn của một trường học.

Dưới đây là TÀI LIỆU NỘI BỘ do nhà trường cung cấp (coi như nguồn chính thống và mới nhất).

NHIỆM VỤ CỦA BẠN:
1. Khi trả lời, LUÔN ƯU TIÊN dựa vào nội dung trong tài liệu này nếu nó có liên quan đến câu hỏi.
Khi trả lời, nếu liên quan đến thông tin liên hệ luôn đính kèm số điện thoại liên lạc.

2. Nếu tài liệu KHÔNG nhắc tới nội dung câu hỏi, bạn có thể trả lời bằng kiến thức chung
   nhưng hãy nói rõ: "Trong tài liệu nội bộ mình không thấy ghi cụ thể, mình sẽ trả lời theo hiểu biết chung..."

3. Bạn CHỈ trả lời những nội dung mang tính giáo dục, phù hợp lứa tuổi 15 trở xuống.
   Nếu câu hỏi có nội dung người lớn, tình dục chi tiết, bạo lực cực đoan, ma túy, cờ bạc,
   chính trị phức tạp, tài chính đầu cơ, hoặc không mang tính giáo dục:
   - Từ chối trả lời trực tiếp.
   - Giải thích ngắn gọn vì sao chủ đề chưa phù hợp.
   - Gợi ý học sinh hỏi thầy cô hoặc người lớn đáng tin cậy.
   - Gợi ý một chủ đề tích cực, mang tính học hỏi khác.

4. Trả lời ngắn gọn chỉ trong 150 từ tiếng Việt, dễ hiểu, tích cực vui vẻ thông thái, bằng tiếng Việt, xưng hô "mình" và "bạn", tôn trọng học sinh.
5. Chú ý nếu trong câu trả lời có nhắc đến thầy cô trong danh sách của nhà trường thì đại từ xưng hô là thầy/cô không dùng anh/chị. Lưu ý nếu có nhiều thầy cô trùng tên hãy liệt kê đầy đủ họ tên kèm theo năm sinh và môn dạy.

--------------- BẮT ĐẦU TÀI LIỆU NỘI BỘ ---------------
${docSnippet}
--------------- KẾT THÚC TÀI LIỆU NỘI BỘ ---------------
`;

    const chatResp = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userText || "Chào bạn, hãy giới thiệu về nhà trường.",
        },
      ],
    });

    const aiText =
      chatResp.choices?.[0]?.message?.content ||
      "Mình chưa nghe rõ câu hỏi, bạn có thể nói lại chậm hơn một chút được không?";

    return aiText;
  } catch (err) {
    console.error("Error in askSchoolAssistant:", err);
    return "Hiện tại mình đang gặp chút trục trặc kỹ thuật, bạn thử hỏi lại sau một lúc nhé.";
  }
}

/**
 * POST /api/voice-chat
 * Flow:
 * 1. Nhận audio (webm)
 * 2. Convert webm -> mp3 (ffmpeg)
 * 3. STT: gpt-4o-transcribe -> userText
 * 4. Chat: askSchoolAssistant(userText) -> aiText
 * 5. TTS: gpt-4o-mini-tts -> mp3
 * 6. Trả JSON: { transcript, ai_text, audio_url }
 */
app.post("/api/voice-chat", upload.single("audio"), async (req, res) => {
  let inputPath;
  let convertedPath;

  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio uploaded" });
    }

    // File webm do trình duyệt gửi lên
    inputPath = req.file.path;
    convertedPath = inputPath + ".mp3";

    // 1) Convert WEBM -> MP3 bằng ffmpeg
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .toFormat("mp3")
        .on("end", () => {
          console.log("Converted to mp3:", convertedPath);
          resolve();
        })
        .on("error", (err) => {
          console.error("FFmpeg error:", err);
          reject(err);
        })
        .save(convertedPath);
    });

    // 2) STT: giọng nói -> text
    const sttResp = await client.audio.transcriptions.create({
      file: fs.createReadStream(convertedPath),
      model: "gpt-4o-transcribe",
      language: "vi", // bật nếu muốn ép tiếng Việt
    });

    const userText = sttResp.text || "";
    console.log("User said:", userText);

    // 3) Hỏi AI theo tài liệu nội bộ
    const aiText = await askSchoolAssistant(userText);
    console.log("AI answer:", aiText);

    // 4) TTS: đọc lại câu trả lời (giới hạn độ dài cho nhẹ)
    const MAX_TTS_CHARS = 1000;
    const ttsInput =
      aiText.length > MAX_TTS_CHARS
        ? aiText.slice(0, MAX_TTS_CHARS) + "..."
        : aiText;

    let audioBuffer;
    try {
      const ttsResp = await client.audio.speech.create({
        model: "gpt-4o-mini-tts",
        voice: "alloy",
        input: ttsInput,
        format: "mp3",
      });

      audioBuffer = Buffer.from(await ttsResp.arrayBuffer());
    } catch (ttsErr) {
      console.error("TTS error:", ttsErr);
      // Nếu TTS lỗi, vẫn trả về text
      return res.json({
        transcript: userText,
        ai_text: aiText,
        audio_url: null,
      });
    }

    const publicDir = path.join(__dirname, "public");
    if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir);

    const answerName = `ai-answer-${Date.now()}.mp3`;
    const answerPath = path.join(publicDir, answerName);
    fs.writeFileSync(answerPath, audioBuffer);

    // 5) Trả kết quả cho frontend
    return res.json({
      transcript: userText,
      ai_text: aiText,
      audio_url: `/${answerName}`,
    });
  } catch (err) {
    console.error("Error in /api/voice-chat:", err);
    return res.status(500).json({
      error: "Internal server error",
      detail: err.message,
    });
  } finally {
    // Dọn file tạm
    try {
      if (inputPath && fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (convertedPath && fs.existsSync(convertedPath))
        fs.unlinkSync(convertedPath);
    } catch (cleanupErr) {
      console.error("Error cleaning temp files:", cleanupErr);
    }
  }
});

// Khởi động server
const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log("Server running on port " + port);
});
