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
  { id: 'llama-3.2-11b-vision-preview', name: 'Jarvis Turbo', badge: 'Vision & Images' },
  { id: 'openai/gpt-oss-120b', name: 'Jarvis Pro', badge: '120B High Intelligence' },
  { id: 'deepseek-r1-distill-llama-70b', name: 'Jarvis Ironman', badge: '70B Deep Reasoning' }
];

const MODEL_NAMES = {
  "openai/gpt-oss-20b": "Jarvis Instant",
  "openai/gpt-oss-120b": "Jarvis Pro",
  "llama-3.2-11b-vision-preview": "Jarvis Turbo",
  "llama-3.2-90b-vision-preview": "Jarvis Turbo Pro",
  "llama-3.3-70b-versatile": "Jarvis Pro",
  "deepseek-r1-distill-llama-70b": "Jarvis Ironman"
};

function getModelDisplayName(modelId) {
  return MODEL_NAMES[modelId] || "Jarvis Engine";
}

const DEFAULT_SYSTEM_INSTRUCTION = `You are JARVIS, an advanced, highly intelligent AI assistant created and developed by Abdullah Waheed.

CRITICAL BEHAVIOR & STYLE GUIDELINES:
1. CREATOR IDENTIFICATION: If anyone asks who created you, who made you, or who your owner/developer is, always respond clearly that you were created and built by Abdullah Waheed.
2. IDENTITY: Your name is JARVIS. Never mention Groq, OpenAI, Meta, or any third-party AI provider. You operate strictly on the JARVIS Engine.
3. EXHAUSTIVE ONLINE KNOWLEDGE BASE: You possess comprehensive knowledge across books, workbooks, literature, academic subjects, stories, people, history, pop culture, and internet memes (e.g. meme 67, viral trends, etc.).
4. EXHAUSTIVE & DETAILED ANSWERS DEFAULT: Unless specifically requested by the user to be brief, concise, or short, always provide rich, step-by-step, in-depth, detailed explanations covering all aspects of the query.
5. VISUAL PRESENTATIONS & SLIDES: When asked to create, generate, or make a presentation or slides on ANY topic:
   - Output a complete, multi-slide visual HTML slide deck inside a \`\`\`html code block.
   - Use <section class="slide"> tags for each slide (Slide 1, Slide 2, etc.).
   - Include modern 16:9 card layouts, bold typography, grid cards, highlight badges, and speaker notes so each slide renders as a visual presentation deck.
6. TONE: Speak directly, naturally, smoothly, and cleanly like ChatGPT. Keep output clean and easily readable.`;

// --- GLOBAL APPLICATION STATE ---
let state = {
  sessions: loadSessions(),
  activeSessionId: null,
  selectedModel: 'openai/gpt-oss-20b',
  settings: loadSettings(),
  isGenerating: false,
  isSpeakingMsgId: null,
  attachedFiles: [],      // Stores up to 10 uploaded file objects
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

// --- RENDER MODEL DROPDOWN & SESSIONS LIST ---
function renderModelDropdown() {
  const modelSelect = document.getElementById('modelSelect');
  if (!modelSelect) return;
  modelSelect.innerHTML = MODELS.map(m => `
    <option value="${m.id}" ${m.id === state.selectedModel ? 'selected' : ''}>${m.name} (${m.badge})</option>
  `).join('');
}

function renderSessionsList(filterQuery = '') {
  const historyItems = document.getElementById('historyItems');
  if (!historyItems) return;
  const filtered = state.sessions.filter(s => s.title.toLowerCase().includes(filterQuery));

  if (filtered.length === 0) {
    historyItems.innerHTML = `<p class="text-[11px] text-slate-500 px-2 py-1 italic">No chats found.</p>`;
    return;
  }

  historyItems.innerHTML = filtered.map(s => `
    <div onclick="switchSession('${s.id}')" class="group px-2.5 py-2 rounded-xl border ${s.id === state.activeSessionId ? 'bg-slate-800/90 border-cyan-500/40 text-cyan-300' : 'bg-transparent border-transparent hover:bg-slate-800/50 text-slate-300'} text-xs truncate cursor-pointer flex items-center justify-between transition">
      <div class="flex items-center gap-2 truncate">
        <i data-lucide="message-square" class="w-3.5 h-3.5 shrink-0 ${s.id === state.activeSessionId ? 'text-cyan-400' : 'text-slate-500'}"></i>
        <span class="truncate font-medium">${escapeHtml(s.title)}</span>
      </div>
      <button onclick="deleteSession('${s.id}', event)" class="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 p-0.5 rounded transition" title="Delete chat">
        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
      </button>
    </div>
  `).join('');

  if (window.lucide) window.lucide.createIcons();
}

// --- FILE ATTACHMENT HANDLING (UP TO 10 FILES/IMAGES) ---
function handleFileSelect(e) {
  const selectedFiles = Array.from(e.target.files);
  if (!selectedFiles.length) return;

  if (state.attachedFiles.length + selectedFiles.length > 10) {
    showToast("Maximum 10 files/images allowed per message.", "error");
  }

  const availableSlots = 10 - state.attachedFiles.length;
  const filesToProcess = selectedFiles.slice(0, availableSlots);

  let processedCount = 0;
  filesToProcess.forEach(file => {
    const isImage = file.type.startsWith('image/');
    const reader = new FileReader();

    reader.onload = function(evt) {
      state.attachedFiles.push({
        id: 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        name: file.name,
        type: file.type,
        isImage: isImage,
        dataUrl: isImage ? evt.target.result : null,
        textContent: !isImage ? evt.target.result : null
      });

      processedCount++;
      if (processedCount === filesToProcess.length) {
        renderFilePreviews();
        showToast(`Attached ${processedCount} file(s) [${state.attachedFiles.length}/10]`, "info");
      }
    };

    if (isImage) {
      reader.readAsDataURL(file);
    } else {
      reader.readAsText(file);
    }
  });

  e.target.value = '';
}

function renderFilePreviews() {
  const previewBar = document.getElementById('filePreviewBar');
  if (!previewBar) return;

  if (state.attachedFiles.length === 0) {
    previewBar.classList.add('hidden');
    previewBar.innerHTML = '';
    return;
  }

  previewBar.classList.remove('hidden');
  previewBar.innerHTML = state.attachedFiles.map((file, idx) => `
    <div class="inline-flex items-center gap-1.5 bg-slate-950 border border-cyan-500/40 pl-1.5 pr-2 py-1 rounded-xl text-xs text-cyan-300 font-mono shadow-md max-w-[180px]">
      ${file.isImage ? `
        <img src="${file.dataUrl}" class="w-5 h-5 rounded object-cover border border-slate-700 shrink-0" />
      ` : `
        <i data-lucide="file-text" class="w-4 h-4 text-cyan-400 shrink-0"></i>
      `}
      <span class="truncate text-[11px]">${escapeHtml(file.name)}</span>
      <button onclick="removeAttachedFile(${idx})" class="text-slate-400 hover:text-red-400 ml-1 font-bold text-xs">✕</button>
    </div>
  `).join('');

  if (window.lucide) window.lucide.createIcons();
}

function removeAttachedFile(index) {
  state.attachedFiles.splice(index, 1);
  renderFilePreviews();
}

function clearAttachedFile() {
  state.attachedFiles = [];
  const fileInput = document.getElementById('fileInput');
  if (fileInput) fileInput.value = '';
  renderFilePreviews();
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
      showToast("Microphone permission was denied. Please allow microphone access in your browser settings.", "error");
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
    showToast("Voice Speech Recognition is not supported in this browser.", "error");
    return;
  }

// --- CHAT MESSAGES UI RENDERING WITH MULTI-FILE SUPPORT ---
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
            
            <!-- Render Attached Images / Document Pills in User Bubble -->
            ${isUser && msg.attachedFiles && msg.attachedFiles.length > 0 ? `
              <div class="mb-2">
                ${msg.attachedFiles.some(f => f.isImage) ? `
                  <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-1.5">
                    ${msg.attachedFiles.filter(f => f.isImage).map(f => `
                      <img src="${f.dataUrl}" class="max-w-xs max-h-36 rounded-xl border border-slate-700 shadow-md object-cover" />
                    `).join('')}
                  </div>
                ` : ''}

                <div class="flex flex-wrap gap-1">
                  ${msg.attachedFiles.filter(f => !f.isImage).map(f => `
                    <div class="inline-flex items-center gap-1.5 bg-slate-900 border border-slate-700 px-2.5 py-1 rounded-xl text-xs text-cyan-300 font-mono mb-1">
                      <i data-lucide="file-text" class="w-3.5 h-3.5 text-cyan-400"></i>
                      <span>${escapeHtml(f.name)}</span>
                    </div>
                  `).join('')}
                </div>
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

// --- STREAMING CHAT COMPLETION WITH MULTI-FILE PAYLOAD ---
async function handleSendMessage() {
  const userInput = document.getElementById('userInput');
  const prompt = userInput ? userInput.value.trim() : '';

  if ((!prompt && state.attachedFiles.length === 0) || state.isGenerating) return;

  if (state.isListening) stopVoiceWriting();

  if (userInput) {
    userInput.value = '';
    userInput.style.height = 'auto';
  }

  const currentSession = getActiveSession();

  let textPrompt = prompt;
  const currentAttachedFiles = [...state.attachedFiles];

  if (currentAttachedFiles.length > 0) {
    currentAttachedFiles.forEach(f => {
      if (!f.isImage && f.textContent) {
        textPrompt += `\n\n[Attached File: ${f.name}]\n\`\`\`\n${f.textContent}\n\`\`\``;
      }
    });
  }

  // Construct user message
  const userMsg = {
    id: 'msg_' + Date.now(),
    role: 'user',
    content: prompt || (currentAttachedFiles.length > 0 ? `[Sent ${currentAttachedFiles.length} file(s)]` : ''),
    attachedFiles: currentAttachedFiles,
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

  const systemInstruction = state.settings.systemInstruction || DEFAULT_SYSTEM_INSTRUCTION;

  const formattedMessages = [
    { role: 'system', content: systemInstruction },
    ...currentSession.messages.slice(0, -1).map(m => {
      if (m.role !== 'user') return { role: m.role, content: m.content };

      let mText = m.content || '';
      if (m.attachedFiles && m.attachedFiles.length > 0) {
        m.attachedFiles.forEach(f => {
          if (!f.isImage && f.textContent) {
            mText += `\n\n[Attached File: ${f.name}]\n\`\`\`\n${f.textContent}\n\`\`\``;
          }
        });
      }

      const hasImages = m.attachedFiles && m.attachedFiles.some(f => f.isImage);
      if (hasImages) {
        const parts = [{ type: 'text', text: mText }];
        m.attachedFiles.forEach(f => {
          if (f.isImage && f.dataUrl) {
            parts.push({ type: 'image_url', image_url: { url: f.dataUrl } });
          }
        });
        return { role: 'user', content: parts };
      }

      return { role: 'user', content: mText };
    })
  ];

  const modelSelect = document.getElementById('modelSelect');
  if (modelSelect) state.selectedModel = modelSelect.value;

  const hasImagesInPayload = currentSession.messages.some(m => m.attachedFiles && m.attachedFiles.some(f => f.isImage));

  let usedModel = state.selectedModel;
  let response = null;

  const modelCandidates = hasImagesInPayload
    ? ["llama-3.2-11b-vision-preview", "llama-3.2-90b-vision-preview"]
    : [state.selectedModel, "openai/gpt-oss-20b", "llama-3.3-70b-versatile"];

  const uniqueCandidates = [...new Set(modelCandidates)];

  for (const modelCandidate of uniqueCandidates) {
    try {
      usedModel = modelCandidate;
      response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: modelCandidate,
          messages: formattedMessages,
          temperature: state.settings.temperature || 0.7,
          stream: true
        })
      });

      if (response && response.ok) break;
    } catch (e) {
      console.warn(`Model candidate ${modelCandidate} notice:`, e);
    }
  }

  if ((!response || !response.ok) && hasImagesInPayload) {
    const textOnlyMessages = [
      { role: 'system', content: systemInstruction },
      ...currentSession.messages.slice(0, -1).map(m => {
        if (m.role !== 'user') return { role: m.role, content: m.content };
        let txt = m.content || '';
        if (m.attachedFiles && m.attachedFiles.length > 0) {
          m.attachedFiles.forEach(f => {
            txt += `\n[Attached File: ${f.name}]`;
          });
        }
        return { role: 'user', content: txt };
      })
    ];

    usedModel = "openai/gpt-oss-20b";
    try {
      response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: usedModel,
          messages: textOnlyMessages,
          temperature: state.settings.temperature || 0.7,
          stream: true
        })
      });
    } catch (e) {}
  }

  try {
    if (!response || !response.ok) {
      const displayName = getModelDisplayName(usedModel);
      throw new Error(`${displayName} is currently busy. Please try again in a moment.`);
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
          } catch (err) {}
        }
      }
    }

    saveSessions();

  } catch (error) {
    console.error("JARVIS Engine Exception:", error);
    const friendlyName = getModelDisplayName(state.selectedModel);
    assistantMsg.content = `⚠️ **JARVIS Notice (${friendlyName}):**\n\n${error.message}`;
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
  clearAttachedFile();
  const userInput = document.getElementById('userInput');
  if (userInput) { userInput.value = ''; userInput.style.height = 'auto'; }
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  saveSessions();
  renderSessionsList();
  renderChatMessages();
}

function switchSession(id) {
  state.activeSessionId = id;
  renderSessionsList();
  renderChatMessages();
}

function deleteSession(id, e) {
  if (e) e.stopPropagation();
  state.sessions = state.sessions.filter(s => s.id !== id);
  if (state.sessions.length === 0) {
    const fresh = createNewSessionObject();
    state.sessions = [fresh];
    state.activeSessionId = fresh.id;
  } else if (state.activeSessionId === id) {
    state.activeSessionId = state.sessions[0].id;
  }
  clearAttachedFile();
  const userInput = document.getElementById('userInput');
  if (userInput) { userInput.value = ''; userInput.style.height = 'auto'; }
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  saveSessions();
  renderSessionsList();
  renderChatMessages();
  showToast("Chat session deleted", "info");
}

function handleClearAllSessions() {
  const fresh = createNewSessionObject();
  state.sessions = [fresh];
  state.activeSessionId = fresh.id;
  clearAttachedFile();
  const userInput = document.getElementById('userInput');
  if (userInput) { userInput.value = ''; userInput.style.height = 'auto'; }
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  saveSessions();
  renderSessionsList();
  renderChatMessages();
  showToast("All chat sessions cleared", "info");
}

// --- UTILITY FUNCTIONS ---
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast("Copied to clipboard!", "success");
  }).catch(err => {
    console.error("Failed to copy text: ", err);
  });
}

function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer") || document.body;
  const toast = document.createElement("div");
  toast.className = `fixed bottom-4 right-4 z-50 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-xl border flex items-center gap-2 transition-all duration-300 transform translate-y-2 opacity-0 ${
    type === "error" ? "bg-red-950/90 border-red-500/50 text-red-200" :
    type === "success" ? "bg-emerald-950/90 border-emerald-500/50 text-emerald-200" :
    "bg-slate-900/90 border-cyan-500/50 text-cyan-200"
  }`;
  toast.innerText = message;
  container.appendChild(toast);

  setTimeout(() => toast.classList.remove("translate-y-2", "opacity-0"), 10);
  setTimeout(() => {
    toast.classList.add("opacity-0");
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function toggleSpeech(text, msgId) {
  if (!('speechSynthesis' in window)) {
    showToast("Speech synthesis is not supported in your browser.", "error");
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
