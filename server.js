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
 * POST /api/voice-chat
 * Nhận audio (webm) từ trình duyệt:
 * 1. Convert webm -> mp3
 * 2. Gửi mp3 lên OpenAI để nhận text (STT)
 * 3. Dùng text gọi chat model để lấy câu trả lời
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

    // 3) Chat: AI tạo câu trả lời text
    const chatResp = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content:
            "Bạn là cô giáo thân thiện, hỗ trợ học sinh, giải thích ngắn gọn, dễ hiểu, dùng tiếng Việt.",
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
