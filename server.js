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
 * - Câu hỏi về trường Dạ Hợp → cho phép dùng web_search (chỉ domain dahop.edu.vn)
 * - Câu hỏi kiến thức phổ thông → trả lời trực tiếp từ kiến thức model
 */
async function askAiWithDaHop(userText) {
  try {
    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      instructions: `
        Bạn là cô giáo cấp 2 (học sinh khoảng 11–15 tuổi) của hệ thống giáo dục Dạ Hợp.

        • Khi học sinh hỏi về: nhà trường, trường Dạ Hợp, chương trình giáo dục, tuyển sinh, học phí,
          cơ sở vật chất, hoạt động ngoại khóa, nội quy, liên hệ nhà trường... thì TRƯỚC TIÊN
          hãy dùng công cụ web_search với domain "dahop.edu.vn" để lấy thông tin CHÍNH XÁC
          TỪ WEBSITE NHÀ TRƯỜNG.

        • Nếu câu hỏi chỉ là kiến thức phổ thông (Toán, Lý, Hóa, Văn, Anh, Khoa học, kỹ năng sống...)
          thì có thể trả lời trực tiếp từ kiến thức của bạn, không nhất thiết phải dùng web_search.

        • Nếu không tìm thấy thông tin phù hợp trên dahop.edu.vn cho câu hỏi liên quan tới nhà trường,
          hãy nói rõ: 
          "Theo thông tin trên website dahop.edu.vn cô không thấy mục này ghi cụ thể.
          Cô sẽ trả lời theo hiểu biết chung của mình..." rồi trả lời cẩn trọng.

        • Đồng thời, bạn vẫn phải tuân thủ:
          - Chỉ trả lời những nội dung mang tính giáo dục, phù hợp lứa tuổi 15 trở xuống.
          - Nếu câu hỏi có nội dung người lớn, bạo lực cực đoan, ma túy, cờ bạc, chính trị phức tạp,
            tài chính đầu cơ, hoặc không mang tính giáo dục, hãy từ chối trả lời trực tiếp và
            chuyển hướng nhẹ nhàng sang chủ đề tích cực, mang tính học hỏi.

        • Luôn trả lời ngắn gọn, dễ hiểu, bằng tiếng Việt, giọng cô giáo hiền, tôn trọng học sinh.
      `,
      input: userText,
      tools: [
        {
          type: "web_search",
          // Giới hạn chỉ dùng website dahop.edu.vn
          filters: {
            allowed_domains: ["dahop.edu.vn"],
          },
        },
      ],
      tool_choice: "auto",
    });

    // Cố gắng lấy text output một cách an toàn
    let aiText = "";

    if (response.output_text) {
      // Một số phiên bản SDK có sẵn trường này
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
    // Fallback an toàn nếu Responses API lỗi
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
      // language: "vi", // có thể bật nếu muốn ép tiếng Việt
    });

    const userText = sttResp.text || "";
    console.log("User said:", userText);

    // 3) Hỏi AI, ưu tiên thông tin trên website dahop.edu.vn
    const aiText = await askAiWithDaHop(userText);
    console.log("AI answer:", aiText);

    // 4) Text-to-Speech: chuyển câu trả lời thành mp3
    const ttsResp = await client.audio.speech.create({
      model: "gpt-4o-mini-tts", // đổi theo model TTS bạn dùng
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
      audio_url: `/${answerName}`, // frontend sẽ dùng URL này để phát audio
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
