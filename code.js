/**
 * ====================================================================
 * JARVIS AI Engine - Application Logic (code.js)
 * Created and Developed by Abdullah Waheed
 * 
 * Features:
 * - Real-time Server-Sent Event (SSE) response streaming via Groq API
 * - Markdown parsing using Marked.js
 * - Mathematical equation rendering using KaTeX
 * - Code syntax highlighting with Tokyo Night Dark theme & Copy buttons
 * - Real-time HTML Slide Presentation generation, interactive live preview & download
 * - LocalStorage session management (Save, Switch, Delete, Search)
 * - Text-to-Speech synthesis output
 * - Markdown export capability
 * ====================================================================
 */

// --- CONFIGURATION & CONSTANTS ---
const GROQ_API_KEY = "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";

const MODELS = [
  { id: 'openai/gpt-oss-20b', name: 'Jarvis Instant', badge: 'Ultra Fast' },
  { id: 'openai/gpt-oss-120b', name: 'Jarvis Pro', badge: '120B High Intelligence' },
  { id: 'deepseek-r1-distill-llama-70b', name: 'Ironman Jarvis', badge: '70B Deep Reasoning' }
];

const DEFAULT_SYSTEM_INSTRUCTION = `You are JARVIS, an advanced, highly intelligent AI assistant created and developed by Abdullah Waheed.

CRITICAL BEHAVIOR & STYLE GUIDELINES:
1. CREATOR IDENTIFICATION: If anyone asks who created you, who made you, or who your owner/developer is, always respond clearly that you were created and built by Abdullah Waheed.
2. IDENTITY: Your name is JARVIS. Never mention Groq, OpenAI, Meta, or any third-party AI provider. You operate strictly on the JARVIS Engine.
3. ADAPTIVE RESPONSE LENGTH & STYLE:
   - For simple or casual questions (e.g., greetings, basic facts, short queries): Answer directly, concisely, and naturally in plain conversational language like ChatGPT without using unnecessary tables, markdown clutter, or strange bracket symbols.
   - For coding questions: Provide clean, efficient, well-formatted code inside standard code blocks with clear explanations.
   - For math questions: Present step-by-step mathematical solutions clearly and cleanly using standard mathematical equations.
4. VISUAL PRESENTATIONS & SLIDES: When asked to create, generate, or make a presentation or slides on ANY topic:
   - Output a complete, multi-slide visual HTML slide deck inside a \`\`\`html code block.
   - Use <section class="slide"> tags for each slide (Slide 1, Slide 2, etc.).
   - Include modern 16:9 card layouts, bold typography, grid cards, highlight badges, and speaker notes so each slide renders as a visual presentation deck.
5. TONE: Speak directly, naturally, smoothly, and cleanly like ChatGPT. Keep output clean and easily readable.`;

// --- GLOBAL APPLICATION STATE ---
let state = {
  sessions: loadSessions(),
  activeSessionId: null,
  selectedModel: 'openai/gpt-oss-20b',
  settings: loadSettings(),
  isGenerating: false,
  isSpeakingMsgId: null,
  attachedFile: null,      // Stores uploaded file object
  isListening: false,     // Voice writing state
  recognition: null       // Web Speech API Instance
};

// --- APPLICATION INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
  // Initialize sessions if empty
  if (!state.sessions || state.sessions.length === 0) {
    const defaultSession = createNewSessionObject();
    state.sessions = [defaultSession];
    state.activeSessionId = defaultSession.id;
    saveSessions();
  } else {
    state.activeSessionId = state.sessions[0].id;
  }

  // Setup DOM Event Listeners & Initial Render
  setupEventListeners();
  renderModelDropdown();
  renderSessionsList();
  renderChatMessages();
});

// --- LOCAL STORAGE PERSISTENCE HELPERS ---
function loadSessions() {
  try {
    const saved = localStorage.getItem('jarvis_chat_sessions');
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    console.error("Failed to load sessions from LocalStorage:", e);
    return [];
  }
}

function saveSessions() {
  try {
    localStorage.setItem('jarvis_chat_sessions', JSON.stringify(state.sessions));
  } catch (e) {
    console.error("Failed to save sessions to LocalStorage:", e);
  }
}

function loadSettings() {
  try {
    const saved = localStorage.getItem('jarvis_chat_settings');
    return saved ? JSON.parse(saved) : { systemInstruction: DEFAULT_SYSTEM_INSTRUCTION, temperature: 0.7 };
  } catch (e) {
    return { systemInstruction: DEFAULT_SYSTEM_INSTRUCTION, temperature: 0.7 };
  }
}

function saveSettings() {
  try {
    localStorage.setItem('jarvis_chat_settings', JSON.stringify(state.settings));
  } catch (e) {
    console.error("Failed to save settings:", e);
  }
}

function createNewSessionObject() {
  return {
    id: 'session_' + Date.now(),
    title: 'New chat',
    createdAt: Date.now(),
    messages: []
  };
}

function getActiveSession() {
  return state.sessions.find(s => s.id === state.activeSessionId) || state.sessions[0];
}

// --- EVENT LISTENERS BINDING ---
function setupEventListeners() {
  const newChatBtn = document.getElementById('newChatBtn');
  const userInput = document.getElementById('userInput');
  const chatForm = document.getElementById('chatForm');
  const modelSelect = document.getElementById('modelSelect');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const exportBtn = document.getElementById('exportBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const searchInput = document.getElementById('searchInput');

  // File Attachment Elements
  const attachFileBtn = document.getElementById('attachFileBtn');
  const fileInput = document.getElementById('fileInput');
  const removeFileBtn = document.getElementById('removeFileBtn');

  // Voice Writing Mic Button
  const micBtn = document.getElementById('micBtn');

  if (newChatBtn) newChatBtn.addEventListener('click', handleNewChat);

  if (chatForm) {
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleSendMessage();
    });
  }

  if (userInput) {
    userInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    });

    userInput.addEventListener('input', () => {
      userInput.style.height = 'auto';
      userInput.style.height = Math.min(userInput.scrollHeight, 200) + 'px';
    });
  }

  // File Upload Handlers
  if (attachFileBtn && fileInput) {
    attachFileBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
  }
  if (removeFileBtn) {
    removeFileBtn.addEventListener('click', clearAttachedFile);
  }

  // Voice Writing Mic Handler
  if (micBtn) {
    micBtn.addEventListener('click', toggleVoiceWriting);
  }

  if (modelSelect) {
    modelSelect.addEventListener('change', (e) => {
      state.selectedModel = e.target.value;
    });
  }

  if (clearAllBtn) clearAllBtn.addEventListener('click', handleClearAllSessions);
  if (exportBtn) exportBtn.addEventListener('click', handleExportMarkdown);
  if (settingsBtn) settingsBtn.addEventListener('click', () => openSettingsModal());
  if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', () => toggleModal('settingsModal', false));
  if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', handleSaveSettings);

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      renderSessionsList(e.target.value.toLowerCase());
    });
  }
}

// --- FILE ATTACHMENT HANDLING ---
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  const isImage = file.type.startsWith('image/');
  const reader = new FileReader();

  reader.onload = function(evt) {
    state.attachedFile = {
      name: file.name,
      type: file.type,
      isImage: isImage,
      dataUrl: isImage ? evt.target.result : null,
      textContent: !isImage ? evt.target.result : null
    };

    const previewBar = document.getElementById('filePreviewBar');
    const previewName = document.getElementById('filePreviewName');
    const previewIcon = document.getElementById('filePreviewIcon');

    if (previewBar && previewName) {
      previewName.textContent = file.name;
      if (previewIcon) {
        previewIcon.setAttribute('data-lucide', isImage ? 'image' : 'file-text');
        if (window.lucide) window.lucide.createIcons();
      }
      previewBar.classList.remove('hidden');
    }
  };

  if (isImage) {
    reader.readAsDataURL(file);
  } else {
    reader.readAsText(file);
  }
}

function clearAttachedFile() {
  state.attachedFile = null;
  const fileInput = document.getElementById('fileInput');
  const previewBar = document.getElementById('filePreviewBar');
  if (fileInput) fileInput.value = '';
  if (previewBar) previewBar.classList.add('hidden');
}

// --- VOICE WRITING (SPEECH-TO-TEXT) ---
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = navigator.language || 'en-US';

  const userInput = document.getElementById('userInput');
  let initialText = '';

  recognition.onstart = () => {
    state.isListening = true;
    initialText = userInput ? userInput.value : '';
    const micBtn = document.getElementById('micBtn');
    if (micBtn) {
      micBtn.classList.remove('text-slate-400');
      micBtn.classList.add('text-red-400', 'animate-pulse', 'bg-red-500/20');
    }
  };

  recognition.onresult = (event) => {
    let currentTranscript = '';
    for (let i = 0; i < event.results.length; i++) {
      currentTranscript += event.results[i][0].transcript;
    }
    if (userInput) {
      userInput.value = (initialText ? initialText + ' ' : '') + currentTranscript;
      userInput.style.height = 'auto';
      userInput.style.height = Math.min(userInput.scrollHeight, 200) + 'px';
    }
  };

  recognition.onerror = (err) => {
    console.warn("Speech recognition notice:", err.error);
    if (err.error === 'not-allowed') {
      alert("Microphone permission was denied. Please allow microphone access in your browser settings.");
    }
    stopVoiceWriting();
  };

  recognition.onend = () => {
    if (state.isListening) stopVoiceWriting();
  };

  return recognition;
}

function toggleVoiceWriting() {
  const micBtn = document.getElementById('micBtn');

  if (state.isListening) {
    stopVoiceWriting();
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert("Voice Speech Recognition is not supported in this browser. Please use Chrome, Edge, or Safari.");
    return;
  }

  if (!state.recognition) {
    state.recognition = initSpeechRecognition();
  }

  try {
    state.recognition.start();
  } catch (e) {
    console.error("Failed to start voice recognition:", e);
    stopVoiceWriting();
  }
}

function stopVoiceWriting() {
  const micBtn = document.getElementById('micBtn');
  if (state.recognition && state.isListening) {
    try { state.recognition.stop(); } catch(e) {}
  }
  state.isListening = false;
  if (micBtn) {
    micBtn.classList.remove('text-red-400', 'animate-pulse', 'bg-red-500/20');
    micBtn.classList.add('text-slate-400');
  }
}

// --- CHAT MESSAGES UI RENDERING WITH ATTACHED FILE SUPPORT ---
function renderChatMessages() {
  const chatContainer = document.getElementById('chatContainer');
  const welcomeCard = document.getElementById('welcomeCard');
  const currentSession = getActiveSession();

  if (!chatContainer) return;

  if (currentSession.messages.length === 0) {
    if (welcomeCard) welcomeCard.classList.remove('hidden');
    chatContainer.innerHTML = '';
    return;
  }

  if (welcomeCard) welcomeCard.classList.add('hidden');

  chatContainer.innerHTML = currentSession.messages.map((msg) => {
    const isUser = msg.role === 'user';
    return `
      <div class="flex gap-4 ${isUser ? 'justify-end' : 'justify-start'} group mb-6 max-w-3xl mx-auto">
        ${!isUser ? `
          <div class="w-8 h-8 rounded-full bg-gpt-accent text-black flex items-center justify-center shrink-0 mt-0.5 shadow font-black text-xs">
            J
          </div>
        ` : ''}

        <div class="flex flex-col max-w-[85%] ${isUser ? 'items-end' : 'items-start flex-1 min-w-0'}">
          <div class="rounded-2xl px-4 py-3 text-sm leading-relaxed ${isUser ? 'bg-gpt-card text-gray-100 rounded-tr-none border border-gpt-border/60' : 'bg-transparent text-gray-100'}">
            
            <!-- Render Attached Image or File Pill in User Bubble -->
            ${isUser && msg.attachedFile ? `
              <div class="mb-2">
                ${msg.attachedFile.isImage ? `
                  <img src="${msg.attachedFile.dataUrl}" class="max-w-xs max-h-48 rounded-xl border border-slate-700 shadow-md mb-1.5" />
                ` : `
                  <div class="inline-flex items-center gap-2 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-xl text-xs text-cyan-300 font-mono mb-1.5">
                    <i data-lucide="file-text" class="w-4 h-4 text-cyan-400"></i>
                    <span>${escapeHtml(msg.attachedFile.name)}</span>
                  </div>
                `}
              </div>
            ` : ''}

            ${isUser ? `<div class="whitespace-pre-wrap">${escapeHtml(msg.content)}</div>` : `<div id="msg-content-${msg.id}" class="markdown-content"></div>`}
          </div>

          <div class="flex items-center gap-2 mt-1 px-1 text-gray-500 text-xs ${isUser ? 'justify-end' : 'justify-start'}">
            <button onclick="copyToClipboard('${escapeJsString(msg.content)}')" class="p-1 hover:text-gray-300 rounded transition-colors flex items-center gap-1" title="Copy text">
              <i data-lucide="copy" class="w-3.5 h-3.5"></i>
            </button>
            ${!isUser ? `
              <button onclick="toggleSpeech('${escapeJsString(msg.content)}', '${msg.id}')" class="p-1 hover:text-gray-300 rounded transition-colors" title="Read aloud">
                <i data-lucide="volume-2" class="w-3.5 h-3.5"></i>
              </button>
            ` : ''}
          </div>
        </div>

        ${isUser ? `
          <div class="w-8 h-8 rounded-full bg-zinc-700 text-gray-200 flex items-center justify-center shrink-0 mt-0.5 font-medium text-xs border border-gpt-border">
            U
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  // Format assistant markdown & KaTeX content
  currentSession.messages.forEach(msg => {
    if (msg.role === 'assistant') {
      const elem = document.getElementById(`msg-content-${msg.id}`);
      if (elem) renderFormattedMarkdown(elem, msg.content);
    }
  });

  if (window.lucide) window.lucide.createIcons();
  scrollToBottom();
}

// --- STREAMING CHAT COMPLETION WITH FILE PAYLOAD ATTACHMENT ---
async function handleSendMessage() {
  const userInput = document.getElementById('userInput');
  const prompt = userInput ? userInput.value.trim() : '';

  if ((!prompt && !state.attachedFile) || state.isGenerating) return;

  if (state.isListening) stopVoiceWriting();

  userInput.value = '';
  userInput.style.height = 'auto';

  const currentSession = getActiveSession();

  // Create prompt content including attached document text if present
  let fullPrompt = prompt;
  const currentAttachedFile = state.attachedFile;

  if (currentAttachedFile && !currentAttachedFile.isImage && currentAttachedFile.textContent) {
    fullPrompt += `\n\n[Attached File: ${currentAttachedFile.name}]\n\`\`\`\n${currentAttachedFile.textContent}\n\`\`\``;
  }

  // Construct user message
  const userMsg = {
    id: 'msg_' + Date.now(),
    role: 'user',
    content: prompt || (currentAttachedFile ? `[Sent File: ${currentAttachedFile.name}]` : ''),
    attachedFile: currentAttachedFile ? { ...currentAttachedFile } : null,
    timestamp: Date.now()
  };

  clearAttachedFile();

  if (currentSession.messages.length === 0) {
    currentSession.title = userMsg.content.length > 30 ? userMsg.content.substring(0, 30) + '...' : userMsg.content;
  }

  currentSession.messages.push(userMsg);

  // Construct assistant placeholder message
  const assistantMsgId = 'msg_' + (Date.now() + 1);
  const assistantMsg = {
    id: assistantMsgId,
    role: 'assistant',
    content: '',
    timestamp: Date.now()
  };
  currentSession.messages.push(assistantMsg);

  state.isGenerating = true;
  renderChatMessages();

  const formattedMessages = [
    { role: 'system', content: state.settings.systemInstruction || DEFAULT_SYSTEM_INSTRUCTION },
    ...currentSession.messages.slice(0, -1).map(m => ({
      role: m.role,
      content: m.role === 'user' && m.attachedFile && !m.attachedFile.isImage && m.attachedFile.textContent
        ? `${m.content}\n\n[Attached File: ${m.attachedFile.name}]\n\`\`\`\n${m.attachedFile.textContent}\n\`\`\``
        : m.content
    }))
  ];

  try {
    let response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: state.selectedModel,
        messages: formattedMessages,
        temperature: state.settings.temperature,
        stream: true
      })
    });

    if (!response.ok && state.selectedModel !== 'openai/gpt-oss-20b') {
      state.selectedModel = 'openai/gpt-oss-20b';
      const modelSelect = document.getElementById('modelSelect');
      if (modelSelect) modelSelect.value = state.selectedModel;
      response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: state.selectedModel,
          messages: formattedMessages,
          temperature: state.settings.temperature,
          stream: true
        })
      });
    }

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.error?.message || `HTTP ${response.status}: Failed to reach JARVIS engine.`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullResponse = '';

    const assistantElem = document.getElementById(`msg-content-${assistantMsgId}`);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.replace('data: ', '').trim();
          if (dataStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(dataStr);
            const delta = parsed.choices[0]?.delta?.content || '';
            fullResponse += delta;
            assistantMsg.content = fullResponse;
            if (assistantElem) renderFormattedMarkdown(assistantElem, fullResponse);
            scrollToBottom();
          } catch (err) {
            // Ignore partial SSE JSON chunks
          }
        }
      }
    }

    saveSessions();

  } catch (error) {
    console.error("JARVIS Engine Exception:", error);
    const modelObj = MODELS.find(m => m.id === state.selectedModel);
    const modelLabel = modelObj ? `${modelObj.name} - \`${state.selectedModel}\`` : state.selectedModel;
    assistantMsg.content = `⚠️ **JARVIS Notice (${modelLabel}):**\n\n${error.message}`;
    saveSessions();
    renderChatMessages();
  } finally {
    state.isGenerating = false;
  }
}

// --- SESSION HANDLERS ---
function handleNewChat() {
  const newSession = createNewSessionObject();
  state.sessions.unshift(newSession);
  state.activeSessionId = newSession.id;
  saveSessions();
  renderSessionsList();
  renderChatMessages();
}

function switchSession(id) {
  state.activeSessionId = id;
  renderSessionsList();
  renderChatMessages();
}

function deleteSession(id) {
  state.sessions = state.sessions.filter(s => s.id !== id);
  if (state.sessions.length === 0) {
    const fresh = createNewSessionObject();
    state.sessions = [fresh];
    state.activeSessionId = fresh.id;
  } else if (state.activeSessionId === id) {
    state.activeSessionId = state.sessions[0].id;
  }
  saveSessions();
  renderSessionsList();
  renderChatMessages();
}

function handleClearAllSessions() {
  if (confirm("Are you sure you want to clear all chat history?")) {
    const fresh = createNewSessionObject();
    state.sessions = [fresh];
    state.activeSessionId = fresh.id;
    saveSessions();
    renderSessionsList();
    renderChatMessages();
  }
}

// --- UTILITY FUNCTIONS ---
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    alert("Copied to clipboard!");
  }).catch(err => {
    console.error("Failed to copy text: ", err);
  });
}

function downloadImage(url, filename = 'jarvis-generated-image.jpg') {
  fetch(url)
    .then(res => res.blob())
    .then(blob => {
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    })
    .catch(() => {
      window.open(url, '_blank');
    });
}

function toggleSpeech(text, msgId) {
  if (!('speechSynthesis' in window)) {
    alert("Speech synthesis is not supported in your browser.");
    return;
  }

  if (state.isSpeakingMsgId === msgId) {
    window.speechSynthesis.cancel();
    state.isSpeakingMsgId = null;
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.onend = () => { state.isSpeakingMsgId = null; };
  state.isSpeakingMsgId = msgId;
  window.speechSynthesis.speak(utterance);
}

function handleExportMarkdown() {
  const session = getActiveSession();
  if (!session.messages.length) return;

  let content = `# ${session.title}\n*Exported from JARVIS AI Engine on ${new Date().toLocaleString()}*\n\n---\n\n`;
  session.messages.forEach(m => {
    content += `### ${m.role === 'user' ? 'User' : 'JARVIS'}\n${m.content}\n\n`;
  });

  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${session.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function openSettingsModal() {
  const sysInput = document.getElementById('systemInstructionInput');
  const tempInput = document.getElementById('temperatureInput');
  if (sysInput) sysInput.value = state.settings.systemInstruction || DEFAULT_SYSTEM_INSTRUCTION;
  if (tempInput) tempInput.value = state.settings.temperature || 0.7;
  toggleModal('settingsModal', true);
}

function handleSaveSettings() {
  const sysInput = document.getElementById('systemInstructionInput');
  const tempInput = document.getElementById('temperatureInput');
  if (sysInput) state.settings.systemInstruction = sysInput.value;
  if (tempInput) state.settings.temperature = parseFloat(tempInput.value);
  saveSettings();
  toggleModal('settingsModal', false);
}

function toggleModal(modalId, show) {
  const modal = document.getElementById(modalId);
  if (modal) {
    if (show) modal.classList.remove('hidden');
    else modal.classList.add('hidden');
  }
}

function scrollToBottom() {
  const chatContainer = document.getElementById('chatContainer');
  if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function escapeJsString(str) {
  if (!str) return '';
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n');
}
