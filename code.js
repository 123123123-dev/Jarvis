// ==========================================
// JARVIS AI - CORE APPLICATION LOGIC
// Created & Developed by Abdullah Waheed
// Supports: Text, Math, Code, & Image Generation
// ==========================================

const GROQ_API_KEY = "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";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

// Default Configuration
let currentModel = "llama3-8b-8192";
let conversationHistory = [];

// System Persona & Capabilities
const SYSTEM_PROMPT = {
  role: "system",
  content: `You are JARVIS, an advanced AI assistant created and developed by Abdullah Waheed.

PRIMARY INSTRUCTIONS & BEHAVIOR:
1. CREATOR DISCLOSURE: If asked who created, built, designed, or owns you, ALWAYS reply clearly that you were created and developed by Abdullah Waheed. Never mention Groq, OpenAI, or third-party web apps.
2. RESPONSE STYLE:
   - For simple, casual, or general questions: Answer concisely, naturally, and directly in conversational plain text. Do not add unnecessary headers or tables.
   - For programming or code requests: Provide full, clean, formatted code blocks with syntax highlighting language tags (e.g., \`\`\`javascript ... \`\`\`).
   - For math problems: Render equations cleanly using standard KaTeX notation (e.g., \\( x^2 + y^2 = r^2 \\) or \\[\n\\int f(x)dx\n\\]).
3. IMAGE GENERATION CAPABILITY:
   - When the user asks you to draw, generate, create, or paint ANY image (including AI images, photorealistic photos, pencil sketches, watercolor paintings, poster color art, pencil color drawings, 3D renders, digital art, or anime):
   - You MUST generate the image by embedding this exact Markdown image tag:
     ![Image Description](https://image.pollinations.ai/prompt/YOUR_ENCODED_DETAILED_PROMPT?width=1024&height=1024&nologo=true)
   - Replace YOUR_ENCODED_DETAILED_PROMPT with a URL-encoded detailed description of the image including the requested style (e.g., photorealistic, watercolor, pencil sketch, poster color).
   - Example: If asked for a watercolor cat, output:
     Here is your watercolor painting:
     ![Watercolor Cat](https://image.pollinations.ai/prompt/a%20beautiful%20vibrant%20watercolor%20painting%20of%20a%20cat%20sitting%20by%20a%20window?width=1024&height=1024&nologo=true)`
};

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
  initializeMarkdownAndKaTeX();
  resetConversation();
  setupEventListeners();
});

function initializeMarkdownAndKaTeX() {
  if (window.marked) {
    marked.setOptions({
      highlight: function (code, lang) {
        if (window.hljs && hljs.getLanguage(lang)) {
          return hljs.highlight(code, { language: lang }).value;
        }
        return code;
      },
      breaks: true
    });
  }
}

function setupEventListeners() {
  const userInput = document.getElementById("userInput");
  if (userInput) {
    userInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    });
    userInput.addEventListener("input", function () {
      this.style.height = "auto";
      this.style.height = Math.min(this.scrollHeight, 180) + "px";
    });
  }

  const modelSelect = document.getElementById("modelSelect");
  if (modelSelect) {
    modelSelect.addEventListener("change", (e) => {
      currentModel = e.target.value;
    });
  }
}

function resetConversation() {
  conversationHistory = [SYSTEM_PROMPT];
  const chatContainer = document.getElementById("chatContainer");
  if (chatContainer) {
    chatContainer.innerHTML = `
      <div id="welcomeCard" class="flex flex-col items-center justify-center h-full text-center py-12">
        <div class="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-4 shadow-lg shadow-cyan-500/5">
          <span class="text-cyan-400 font-bold text-2xl">J</span>
        </div>
        <h2 class="text-2xl font-bold text-white mb-2">Hello, I am JARVIS</h2>
        <p class="text-sm text-gray-400 max-w-md">Created by Abdullah Waheed. Ask me anything, solve math, write code, or ask me to generate any style of image!</p>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-8 w-full max-w-lg text-left">
          <button onclick="quickPrompt('Draw a photorealistic cybernetic eagle flying over mountains')" class="p-3 bg-gray-800/60 border border-gray-700/60 hover:border-cyan-500/50 rounded-xl text-xs text-gray-300 transition">
            🎨 <span class="font-semibold text-white">Realistic Image:</span> Cybernetic eagle
          </button>
          <button onclick="quickPrompt('Create a detailed pencil color sketch of a cozy rain cottage')" class="p-3 bg-gray-800/60 border border-gray-700/60 hover:border-cyan-500/50 rounded-xl text-xs text-gray-300 transition">
            ✏️ <span class="font-semibold text-white">Pencil Sketch:</span> Cozy rain cottage
          </button>
          <button onclick="quickPrompt('Paint a vibrant watercolor painting of a lotus pond')" class="p-3 bg-gray-800/60 border border-gray-700/60 hover:border-cyan-500/50 rounded-xl text-xs text-gray-300 transition">
            🖌️ <span class="font-semibold text-white">Watercolor:</span> Lotus pond painting
          </button>
          <button onclick="quickPrompt('Who created and developed this JARVIS app?')" class="p-3 bg-gray-800/60 border border-gray-700/60 hover:border-cyan-500/50 rounded-xl text-xs text-gray-300 transition">
            👤 <span class="font-semibold text-white">Developer:</span> Who built JARVIS?
          </button>
        </div>
      </div>
    `;
  }
}

function quickPrompt(text) {
  const userInput = document.getElementById("userInput");
  if (userInput) {
    userInput.value = text;
    handleSendMessage();
  }
}

async function handleSendMessage() {
  const userInput = document.getElementById("userInput");
  const text = userInput.value.trim();
  if (!text) return;

  userInput.value = "";
  userInput.style.height = "auto";

  const welcomeCard = document.getElementById("welcomeCard");
  if (welcomeCard) welcomeCard.remove();

  appendMessage("user", text);
  conversationHistory.push({ role: "user", content: text });

  const assistantBubble = createAssistantMessageBubble();

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: currentModel,
        messages: conversationHistory,
        stream: true,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`Connection Error (${response.status})`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let accumulatedText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const dataStr = line.replace("data: ", "").trim();
          if (dataStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(dataStr);
            const content = parsed.choices[0]?.delta?.content || "";
            accumulatedText += content;
            renderContent(assistantBubble, accumulatedText);
          } catch (e) {
            // Processing chunk
          }
        }
      }
    }

    conversationHistory.push({ role: "assistant", content: accumulatedText });

  } catch (error) {
    assistantBubble.innerHTML = `<p class="text-red-400">Error: ${error.message}</p>`;
  }
}

function appendMessage(role, content) {
  const chatContainer = document.getElementById("chatContainer");
  const msgDiv = document.createElement("div");
  msgDiv.className = role === "user" ? "flex justify-end my-4" : "flex justify-start my-4";

  if (role === "user") {
    msgDiv.innerHTML = `
      <div class="bg-gray-800 text-gray-100 px-4 py-3 rounded-2xl max-w-[85%] text-sm leading-relaxed border border-gray-700/50 shadow-md">
        ${escapeHtml(content)}
      </div>
    `;
  }
  chatContainer.appendChild(msgDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function createAssistantMessageBubble() {
  const chatContainer = document.getElementById("chatContainer");
  const msgDiv = document.createElement("div");
  msgDiv.className = "flex gap-3 my-4 text-sm leading-relaxed";

  const bubbleId = "jarvis-msg-" + Date.now();
  msgDiv.innerHTML = `
    <div class="w-8 h-8 rounded-xl bg-cyan-600/20 border border-cyan-500/30 flex-shrink-0 flex items-center justify-center text-cyan-400 font-bold text-xs mt-0.5">
      J
    </div>
    <div id="${bubbleId}" class="markdown-body text-gray-200 flex-1 space-y-2 overflow-hidden">
      <span class="inline-block w-2 h-4 bg-cyan-400 animate-pulse"></span>
    </div>
  `;
  chatContainer.appendChild(msgDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  return document.getElementById(bubbleId);
}

function renderContent(element, rawText) {
  let formattedHtml = rawText;
  if (window.marked) {
    formattedHtml = marked.parse(rawText);
  }

  element.innerHTML = formattedHtml;

  // Render Math equations with KaTeX
  if (window.renderMathInElement) {
    try {
      renderMathInElement(element, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "\\[", right: "\\]", display: true },
          { left: "$", right: "$", display: false },
          { left: "\\(", right: "\\)", display: false }
        ],
        throwOnError: false
      });
    } catch (e) {
      console.warn("KaTeX render error:", e);
    }
  }

  // Highlight Code Syntax
  if (window.hljs) {
    element.querySelectorAll("pre code").forEach((block) => {
      hljs.highlightElement(block);
    });
  }

  // Auto-style generated images
  element.querySelectorAll("img").forEach((img) => {
    img.classList.add("rounded-xl", "shadow-xl", "my-4", "max-w-full", "border", "border-gray-700");
  });

  const chatContainer = document.getElementById("chatContainer");
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function escapeHtml(str) {
  return str.replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">").replace(/"/g, """).replace(/'/g, "'");
}
