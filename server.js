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
mô ta nhà trường
`;

/**
 * Hỏi AI với prompt cố định + tài liệu nội bộ
 */
async function askSchoolAssistant(userText) {
  try {
    // Giới hạn tài liệu nội bộ nếu sau này bạn lỡ để quá dài
    const MAX_DOC_CHARS = 8000;
    const docSnippet =
      INTERNAL_DOC.length > MAX_DOC_CHARS
        ? INTERNAL_DOC.slice(0, MAX_DOC_CHARS)
        : INTERNAL_DOC;

    const systemPrompt = `
Bạn là tư vấn của một trường học.

Dưới đây là TÀI LIỆU NỘI BỘ do nhà trường cung cấp (coi như nguồn chính thống và mới nhất).

NHIỆM VỤ CỦA BẠN:
1. Khi trả lời, LUÔN ƯU TIÊN dựa vào nội dung trong tài liệu này nếu nó có liên quan đến câu hỏi.
2. Nếu tài liệu KHÔNG nhắc tới nội dung câu hỏi, bạn có thể trả lời bằng kiến thức chung
   nhưng hãy nói rõ: "Trong tài liệu nội bộ mình không thấy ghi cụ thể, mình sẽ trả lời theo hiểu biết chung..."

3. Bạn CHỈ trả lời những nội dung mang tính giáo dục, phù hợp lứa tuổi 15 trở xuống.
   Nếu câu hỏi có nội dung người lớn, tình dục chi tiết, bạo lực cực đoan, ma túy, cờ bạc,
   chính trị phức tạp, tài chính đầu cơ, hoặc không mang tính giáo dục:
   - Từ chối trả lời trực tiếp.
   - Giải thích ngắn gọn vì sao chủ đề chưa phù hợp.
   - Gợi ý học sinh hỏi bố mẹ, thầy cô hoặc người lớn đáng tin cậy.
   - Gợi ý một chủ đề tích cực, mang tính học hỏi khác.

4. Trả lời ngắn gọn chỉ trong 150 từ tiếng Việt, dễ hiểu, bằng tiếng Việt, xưng hô "mình" và "bạn", tôn trọng học sinh.

--------------- BẮT ĐẦU TÀI LIỆU NỘI BỘ ---------------
Hệ thống Giáo dục Dạ Hợp – Thông tin tóm lược

Dạ Hợp Education được thành lập từ năm 2016, khởi đầu là trường mầm non Hoa Dạ Hợp. Hiện hệ thống đã phát triển thành mô hình liên cấp từ Mầm non, Tiểu học đến THCS, được phụ huynh và cộng đồng tại Hòa Bình tin tưởng.

Điểm mạnh chương trình
Hệ thống tập trung vào 3 trụ cột:
Tiếng Anh: Học sinh được học tiếng Anh giao tiếp hàng ngày với giáo viên Việt Nam và giáo viên nước ngoài, nhiều hoạt động trải nghiệm 100% tiếng Anh, thời lượng tới khoảng 10 tiết/tuần.
STEM: Chương trình STEM xuyên suốt từ mầm non (Eco STEM – sống thân thiện với môi trường) tới phổ thông, hợp tác với các đối tác STEM uy tín.
Kỹ năng sống: Nhiều hoạt động trải nghiệm theo tuần, tháng và theo khối/lớp, khuyến khích học sinh “được thử – được sai – được kiến tạo”, rèn luyện tự lập, tự học, tự chủ, tự tin.

Đội ngũ & triết lý giáo dục:
Đội ngũ gồm các thầy cô giàu kinh nghiệm và giáo viên trẻ nhiệt huyết; 100% giáo viên đạt chuẩn và trên chuẩn, sĩ số thấp để chăm sóc sát sao. Triết lý dựa trên thuyết Đa trí thông minh: tôn trọng sự khác biệt, phát triển hài hòa Nhân – Trí – Thể – Kỹ. Học sinh được định hướng trở thành người trung thực, biết ơn, yêu thương; giỏi ngoại ngữ, công nghệ; khỏe mạnh, bền bỉ, kỷ luật; có kỹ năng tự học, giao tiếp và sinh tồn.

Cơ sở vật chất:
Trường tọa lạc tại Tổ 8, phường Hữu Nghị, TP Hòa Bình, khuôn viên trong lành, an toàn. Phòng học rộng, nhiều phòng chức năng (âm nhạc, hội họa, thí nghiệm), thư viện sách Việt – Anh, sân chơi ngoài trời, bể bơi trong nhà, bếp ăn và khu vệ sinh thiết kế theo tiêu chuẩn cho trẻ em, đảm bảo vệ sinh và an toàn theo quy định trong nước và quốc tế.

Chương trình và tuyển sinh:
Học sinh học chương trình Bộ GD&ĐT kết hợp tiếng Anh Cambridge, STEM, kỹ năng sống, hoạt động trải nghiệm và phát triển thể lực. Hệ thống tuyển sinh các lớp từ 1 đến 9, yêu cầu sức khỏe tốt, hoàn thành chương trình ở cấp học trước và tham gia đánh giá năng lực (Toán, Tiếng Việt, Tiếng Anh, kỹ năng, phỏng vấn). Sĩ số mỗi lớp được giới hạn để đảm bảo chất lượng học tập.

Các kiến thức được cung cấp:
Chương trình Giáo dục Phổ thông: Học sinh được tham gia các lớp học Tiếng Việt - Sử - Địa - Giáo dục công dân bằng phương pháp tiếp cận mới, vừa học kiến thức vừa trải nghiệm thông qua các hoạt động ngoại khóa.
Chương trình STEM: Xu hướng đưa giáo dục STEM vào trường học được khởi nguồn từ nước Mỹ vài chục năm trước giờ đây đã trở thành một xu hướng toàn cầu. Nhưng thay vì gia nhập trào lưu một cách bị động, DHE chủ động xây dựng chương trình STEM một cách bài bản và thống nhất giữa các cấp học. Ở lứa mầm non là chương trình Eco STEM để các con làm quen và có những nhận thức đầu tiên về việc sống thân thiện và gần gũi với môi trường. Ở các cấp học phổ thông, chương trình STEM là kết quả của sự hợp tác với những đối tác hàng đầu về STEM tại Việt Nam để xây dựng chương trình giáo dục chuyên sâu dành cho học sinh. Bên cạnh ý nghĩa về giáo dục tích hợp. STEM luôn là một nội dung nhận được rất nhiều sự hứng thú của học sinh.
Chương trình Tiếng Anh: Tại DHE, chương trình giảng dạy tiếng Anh chú trọng vào giao tiếp và thực hành cho học sinh với tối đa các hoạt động sử dụng ngôn ngữ nói cho học sinh xuyên suốt tất cả các lớp của mọi cấp học. Bên cạnh các tiết học tiếng Anh hàng ngày với các giáo viên Việt Nam cũng như nước ngoài cơ hữu của Hệ thống, những giờ trải nghiệm tiếng Anh hàng tháng với yêu cầu 100% tiếng Anh sẽ buộc các con phải vận dụng khả năng tiếng Anh giao tiếp của mình. Những hoạt động dã ngoại với giáo viên người nước ngoài cũng được lồng ghép nhằm giúp các con đem các kiến thức đã học ra áp dụng vào thực tế. Thời lượng tiếng Anh vượt trội lên tới 10 tiết mỗi tuần, cùng với những sự kiện tiếng Anh đều đặn, kỹ năng tiếng Anh của các con sẽ được nâng lên một cách tự nhiên, giống như tiếng mẹ đẻ. Tại DHE, chúng tôi không coi tiếng Anh là một ngoại ngữ, đó chỉ đơn giản cũng là một ngôn ngữ, giống như tiếng Việt. Khi trẻ nói càng nhiều, trẻ càng có cơ hội quen thuộc với ngôn ngữ đó. Năng lực ngôn ngữ phát triển như một hệ quả tất yếu.
Kỹ năng sống: Một trong những căn bệnh khó chữa ở thời hiện đại là bệnh có lý thuyết nhưng thiếu kỹ năng do thiếu trải nghiệm, thực hành. Nhận thức được điều đó, DHE xây dựng các hoạt động liên tục cho học sinh trong tất cả thời gian ở trường áp dụng phương pháp học bằng trải nghiệm. Với chu trình học bằng trải nghiệm (chu trình Kolb), quá trình học gồm bốn giai đoạn: Trải nghiệm cụ thể; Quan sát, đánh giá sự việc; Khái quát các khái niệm; Chủ động thử nghiệm. Học tập qua trải nghiệm là một trong những phương pháp hiệu quả nhất để hướng dẫn học sinh vận dụng và phát triển tư duy sáng tạo. Với các nội dung học tập mang tính thực tiễn cao, học sinh nhận thấy luôn có nhiều giải pháp khác nhau cho mỗi tình huống, mỗi vấn đề cần giải quyết. Khi tham gia vào các hoạt động trải nghiệm thực tế, học sinh sẽ tìm ra những phương pháp tiếp cận, cách giải quyết vấn đề hiệu quả hơn. Từ đó, học sinh biết phân tích, so sánh và loại bỏ các phương pháp, cách giải quyết vấn đề thiếu hiệu quả. Trong học tập trải nghiệm, việc loại bỏ những phương pháp, cách thức “sai lầm” trở thành một phần vô cùng giá trị của quá trình học tập. Học sinh học được cách không sợ sai nhưng phải ghi nhớ để không lặp lại những sai lầm đó.

Thông tin Liên hệ:
Địa chỉ: Tổ 8, phường Hữu Nghị, TP Hòa Bình, tỉnh Hòa Bình.
Điện thoại: 02183.83.88.99 – Phòng Tuyển sinh.
Hotline: 0356.756.971 (Cô Huyền).
Email: dhe@dahop.edu.vn.
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
      // language: "vi", // bật nếu muốn ép tiếng Việt
    });

    const userText = sttResp.text || "";
    console.log("User said:", userText);

    // 3) Hỏi AI theo tài liệu nội bộ
    const aiText = await askSchoolAssistant(userText);
    console.log("AI answer:", aiText);

    // 4) TTS: đọc lại câu trả lời (giới hạn độ dài cho nhẹ)
    const MAX_TTS_CHARS = 600;
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
