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
 * Hàm hỏi AI, ưu tiên tra cứu trên website dahop.edu.vn
 * - Câu hỏi về trường Dạ Hợp → có thể dùng web_search, nhưng CHỈ được tin/quote nội dung từ dahop.edu.vn
 * - Câu hỏi kiến thức phổ thông → trả lời trực tiếp từ kiến thức model
 */
async function askAiWithDaHop(userText) {
  try {
    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      instructions: `
        Bạn là cô giáo cấp 2 (học sinh khoảng 11–15 tuổi) của hệ thống giáo dục Dạ Hợp.

        QUY TẮC VỀ NGUỒN THÔNG TIN:
        • Khi học sinh hỏi về: trường Dạ Hợp, chương trình giáo dục, tuyển sinh, học phí,
          cơ sở vật chất, hoạt động ngoại khóa, nội quy, liên hệ nhà trường..., nếu cần tra cứu,
          bạn được phép dùng công cụ web_search.
        • KHI SỬ DỤNG web_search:
          - Chỉ được TIN CẬY, TRÍCH DẪN, và DỰA VÀO nội dung từ website có tên miền "dahop.edu.vn".
          - Nếu công cụ trả về các trang từ domain khác, hãy bỏ qua, không dùng để trả lời.
          - ƯU TIÊN các kết quả có URL chứa "dahop.edu.vn".
        • Nếu sau khi dùng web_search mà không thấy kết quả nào từ dahop.edu.vn liên quan,
          hãy nói rõ:
          "Theo thông tin trên website dahop.edu.vn cô không thấy mục này ghi cụ thể.
          Cô sẽ trả lời theo hiểu biết chung của mình..." rồi mới trả lời cẩn trọng bằng kiến thức chung.

        QUY TẮC VỀ NỘI DUNG:
        • Nếu câu hỏi chỉ là kiến thức phổ thông (Toán, Lý, Hóa, Văn, Anh, Khoa học, kỹ năng sống...),
          bạn có thể trả lời trực tiếp từ kiến thức của mình, không bắt buộc phải dùng web_search.

        • Bạn CHỈ trả lời những nội dung mang tính giáo dục, phù hợp lứa tuổi 15 trở xuống.
          Nếu câu hỏi có nội dung người lớn, tình dục chi tiết, bạo lực cực đoan, ma túy, cờ bạc,
          chính trị phức tạp, tài chính đầu cơ, hoặc không mang tính giáo dục, hãy:
          - Từ chối trả lời trực tiếp.
          - Giải thích ngắn gọn vì sao chủ đề chưa phù hợp.
          - Gợi ý học sinh hỏi bố mẹ, thầy cô hoặc người lớn đáng tin cậy.
          - Gợi ý một chủ đề tích cực, mang tính học hỏi khác.

        CÁCH TRẢ LỜI:
        • Luôn trả lời ngắn gọn, dễ hiểu, bằng tiếng Việt, giọng cô giáo hiền, tôn trọng học sinh.
      `,
      input: userText,
      tools: [
        {
          type: "web_search", // KHÔNG dùng filters nữa, vì model không hỗ trợ
        },
      ],
      tool_choice: "auto",
    });

    // Cố gắng lấy text output một cách an toàn
    let aiText = "";

    if (response.output_text) {
      aiText = response.output_text;
    } else if (
      response.output &&
      Array.isArray(response.output) &&
      response.output[0] &&
      response.output[0].content &&
      Array.isArray(response.output[0].content) &&
      response.output[0].content[0] &&
      response.output[0].content[0].text
    ) {
      aiText = response.output[0].content[0].text;
    } else {
      aiText =
        "Cô chưa nghe rõ câu hỏi, con có thể nói lại chậm hơn một chút được không?";
    }

    return aiText;
  } catch (err) {
    console.error("Error in askAiWithDaHop:", err);
    return "Hiện tại cô đang gặp chút trục trặc kỹ thuật, con có thể hỏi lại sau một lúc nhé.";
  }
}

/**
 * POST /api/voice-chat
 * Nhận audio (webm) từ trình duyệt:
 * 1. Convert webm -> mp3
 * 2. Gửi mp3 lên OpenAI để nhận text (STT)
 * 3. Dùng text gọi Responses API (ưu tiên web dahop.edu.vn) để lấy câu trả lời
 * 4. Dùng TTS để chuyển câu trả lời thành mp3
 * 5. Trả về transcript + text + audio_url
 */
app.post("/api/voice-chat", upload.single("audio"), async (req, res) => {
  let inputPath;
  let convertedPath;

  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio uploaded" });
    }

    // File webm do trình duyệt gửi lên
    inputPath = req.file.path;          // vd: uploads/abc123
    convertedPath = inputPath + ".mp3"; // vd: uploads/abc123.mp3

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

    // 2) Gửi file mp3 lên OpenAI để chuyển giọng nói -> text
    const sttResp = await client.audio.transcriptions.create({
      file: fs.createReadStream(convertedPath),
      model: "gpt-4o-transcribe", // hoặc model STT khác mà tài khoản bạn hỗ trợ
      // language: "vi",
    });

    const userText = sttResp.text || "";
    console.log("User said:", userText);

    // 3) Hỏi AI, ưu tiên thông tin trên website dahop.edu.vn
    const aiText = await askAiWithDaHop(userText);
    console.log("AI answer:", aiText);

    // 4) Text-to-Speech: chuyển câu trả lời thành mp3
    const ttsResp = await client.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      input: aiText,
      format: "mp3",
    });

    const publicDir = path.join(__dirname, "public");
    if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir);

    const answerName = `ai-answer-${Date.now()}.mp3`;
    const answerPath = path.join(publicDir, answerName);

    const buffer = Buffer.from(await ttsResp.arrayBuffer());
    fs.writeFileSync(answerPath, buffer);

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
