const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");
const ffmpeg = require("fluent-ffmpeg");
const pdfParse = require("pdf-parse");

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

// ========= 📄 LOAD TÀI LIỆU PDF NỘI BỘ =========
let schoolDocText = "";
const pdfPath = path.join(__dirname, "public", "school-doc.pdf"); // ĐỔI TÊN FILE Ở ĐÂY nếu bạn đặt khác

(async () => {
  try {
    if (fs.existsSync(pdfPath)) {
      const dataBuffer = fs.readFileSync(pdfPath);
      const data = await pdfParse(dataBuffer);
      schoolDocText = (data.text || "").trim();
      console.log(
        "✅ Đã load PDF nội bộ. Độ dài text:",
        schoolDocText.length,
        "ký tự"
      );
    } else {
      console.warn(
        "⚠️ Không tìm thấy file PDF tại:",
        pdfPath,
        "-> AI sẽ chỉ trả lời bằng kiến thức chung."
      );
    }
  } catch (err) {
    console.error("❌ Lỗi khi đọc/parse PDF:", err);
  }
})();

/**
 * Hỏi AI, ưu tiên tra cứu trong tài liệu PDF nội bộ
 */
async function askAiWithPdf(userText) {
  try {
    const MAX_DOC_CHARS = 20000; // cắt bớt để tránh quá nhiều token
    const docSnippet =
      schoolDocText.length > MAX_DOC_CHARS
        ? schoolDocText.slice(0, MAX_DOC_CHARS)
        : schoolDocText;

    const hasDoc = docSnippet && docSnippet.length > 0;

    const systemContent = hasDoc
      ? `
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

4. Trả lời ngắn gọn chỉ trong 150 từ tiếng Việt, dễ hiểu, bằng tiếng Việt, xưng hô mình và bạn, tôn trọng học sinh.

--------------- BẮT ĐẦU TÀI LIỆU NỘI BỘ ---------------
//${docSnippet}
--------------- KẾT THÚC TÀI LIỆU NỘI BỘ ---------------
`
      : `
Bạn là tư vấn của một trường học.
Bạn CHỈ trả lời những nội dung mang tính giáo dục, phù hợp lứa tuổi 15 trở xuống.
Nếu câu hỏi có nội dung người lớn, bạo lực cực đoan, ma túy, cờ bạc, chính trị phức tạp,
tài chính đầu cơ, hoặc không mang tính giáo dục, hãy từ chối trả lời trực tiếp, giải thích ngắn gọn
và gợi ý chủ đề tích cực hơn.

Nếu học sinh hỏi về thông tin nhà trường nhưng không có tài liệu nội bộ, hãy trả lời chung chung
và nói rõ: "Mình không có tài liệu chính thức của trường, mình sẽ trả lời theo hiểu biết chung...".

Trả lời ngắn gọn chỉ trong 150 từ tiếng Việt, dễ hiểu, bằng tiếng Việt, xưng hô mình và bạn, tôn trọng học sinh.
`;

    const chatResp = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: systemContent,
        },
        {
          role: "user",
          content: userText || "Xin chào cô ơi!",
        },
      ],
    });

    const aiText =
      chatResp.choices?.[0]?.message?.content ||
      "Cô chưa nghe rõ câu hỏi, con có thể nói lại được không?";

    return aiText;
  } catch (err) {
    console.error("❌ Error in askAiWithPdf:", err);
    return "Hiện tại cô đang gặp chút trục trặc kỹ thuật, con có thể hỏi lại sau một lúc nhé.";
  }
}

/**
 * POST /api/voice-chat
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
          console.log("🎧 Converted to mp3:", convertedPath);
          resolve();
        })
        .on("error", (err) => {
          console.error("❌ FFmpeg error:", err);
          reject(err);
        })
        .save(convertedPath);
    });

    // 2) STT
    const sttResp = await client.audio.transcriptions.create({
      file: fs.createReadStream(convertedPath),
      model: "gpt-4o-transcribe",
      language: "vi",
    });

    const userText = sttResp.text || "";
    console.log("🗣 User said:", userText);

    // 3) Hỏi AI dựa trên PDF nội bộ
    const aiText = await askAiWithPdf(userText);
    console.log("🤖 AI answer:", aiText);

    // 4) TTS – giới hạn độ dài để tránh quá nặng
    const MAX_TTS_CHARS = 800;
    const ttsInput =
      aiText.length > MAX_TTS_CHARS
        ? aiText.slice(0, MAX_TTS_CHARS) + "..."
        : aiText;

    console.log("🔊 Generating TTS, length:", ttsInput.length);

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
      console.error("❌ TTS error:", ttsErr);
      // Nếu TTS lỗi, vẫn trả text cho frontend (không audio)
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
    console.log("💾 Saved TTS file:", answerPath);

    // 5) Trả kết quả cho frontend
    return res.json({
      transcript: userText,
      ai_text: aiText,
      audio_url: `/${answerName}`,
    });
  } catch (err) {
    console.error("❌ Error in /api/voice-chat:", err);
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
      console.error("⚠️ Error cleaning temp files:", cleanupErr);
    }
  }
});

// Khởi động server
const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log("Server running on port " + port);
});
