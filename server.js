const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(express.json());

// Serve các file tĩnh trong thư mục "public" (frontend)
app.use(express.static("public"));

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // lấy từ biến môi trường trên Render
});

// API nhận audio từ frontend
app.post("/api/voice-chat", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file uploaded" });
    }

    const audioPath = req.file.path;

    // 1. Speech-to-Text: chuyển âm thanh học sinh nói thành văn bản
    const sttResp = await client.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: "gpt-4o-transcribe" // hoặc "whisper-1" tùy bạn cấu hình
      // language: "vi" // có thể bật nếu muốn ép ngôn ngữ tiếng Việt
    });

    const userText = sttResp.text || "";
    console.log("User said:", userText);

    // 2. Chat: AI tạo câu trả lời bằng text
    const chatResp = await client.chat.completions.create({
      model: "gpt-4.1-mini", // model rẻ & đủ dùng cho học sinh
      messages: [
        {
          role: "system",
          content:
            "Bạn là trợ lý thân thiện cho học sinh, trả lời ngắn gọn, dễ hiểu, dùng tiếng Việt, giọng như cô giáo hiền."
        },
        {
          role: "user",
          content: userText || "Xin chào"
        }
      ]
    });

    const aiText =
      chatResp.choices?.[0]?.message?.content ||
      "Cô chưa nghe rõ câu hỏi, con có thể nói lại được không?";

    console.log("AI answer:", aiText);

    // 3. Text-to-Speech: biến câu trả lời text thành file mp3
    const ttsResp = await client.audio.speech.create({
      model: "gpt-4o-mini-tts", // model TTS theo docs Text-to-Speech của OpenAI :contentReference[oaicite:3]{index=3}
      voice: "alloy",
      input: aiText,
      format: "mp3"
    });

    // Đảm bảo thư mục public tồn tại (nơi mình sẽ lưu file mp3)
    const publicDir = path.join(__dirname, "public");
    if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir);

    const fileName = `ai-answer-${Date.now()}.mp3`;
    const outPath = path.join(publicDir, fileName);

    const buffer = Buffer.from(await ttsResp.arrayBuffer());
    fs.writeFileSync(outPath, buffer);

    // Trả kết quả cho frontend
    res.json({
      transcript: userText,
      ai_text: aiText,
      audio_url: `/${fileName}` // vì static folder = public
    });
  } catch (err) {
    console.error("Error in /api/voice-chat:", err);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    // Xoá file upload tạm
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, () => {});
    }
  }
});

// Khởi động server
const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log("Server running on port " + port);
});
