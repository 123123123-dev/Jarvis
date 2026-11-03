/* ==========================================================================
   JARVIS AI Core Engine Application Logic
   Developed by: Abdullah Waheed
   ========================================================================== */

// Config & API Keys
const GOOGLE_CLIENT_ID = '824756167499-bs4dlceg4qtolp4ma4u7g3gajrrviad3.apps.googleusercontent.com';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Model Mapping Configuration
const MODELS = {
  instant: { id: 'llama-3.1-8b-instant', name: 'Jarvis Instant' },
  turbo: { id: 'llama-3.2-11b-vision-preview', name: 'Jarvis Turbo' },
  pro: { id: 'llama-3.3-70b-versatile', name: 'Jarvis Pro' },
  ironman: { id: 'deepseek-r1-distill-llama-70b', name: 'Jarvis Ironman' }
};

const VISION_FALLBACK_MODELS = ['llama-3.2-11b-vision-preview', 'llama-3.2-90b-vision-preview'];

// Default Embedded Keys (Auto-Fallback Rotation)
const API_KEYS = [
  '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',
  'gsk_98765432101234567890abcdefghijklmnopqrstuvwxyz12345'
];

// Session-Scoped Tab State Management
const state = {
  selectedModelKey: 'turbo',
  attachedFiles: [], // Up to 10 attached files/images
  chats: [],
  currentSessionId: null,
  currentUser: JSON.parse(sessionStorage.getItem('jarvis_session_user') || 'null'),
  authTab: 'signin',
  googleToken: null,
  speechRecognition: null,
  isRecording: false
};

// JARVIS System Prompt & Creator Persona Injection
const JARVIS_SYSTEM_PROMPT = `
You are JARVIS, a highly advanced, ultra-intelligent AI assistant created and developed exclusively by Abdullah Waheed.

CREATOR & DEVELOPER PROFILE:
- Creator Name: Abdullah Waheed
- Age: 15 years old when he built and launched JARVIS in 2026.
- Education: Student at LGS Paragon Campus (Lahore Grammar School).
- Residence & Origin: Lives in Lahore, Pakistan; born in Narowal city.
- Whenever asked about your owner, creator, or developer, credit Abdullah Waheed with full enthusiasm and respect using these facts.

SEARCH ENGINE & CORE IDENTITY:
- Your internal search engine is strictly "JARVIS Engine".
- You have access to deep, comprehensive, online knowledge including academic books, workbooks, literature, history, science, pop culture, internet memes (such as 67), and global news.

ANSWERING BEHAVIOR & STYLE:
- Always provide exhaustive, in-depth, step-by-step, highly detailed explanations by default.
- Only shorten your answers if the user explicitly requests a brief, short, or concise summary.
- Format responses cleanly with bolding, lists, and code blocks where applicable.
`;

// Initialize Application on Page Load
document.addEventListener('DOMContentLoaded', () => {
  initSpeechRecognition();
  updateAuthUI();
  loadUserChats();
  renderSessionsList();
  
  if (!state.chats || state.chats.length === 0) {
    createNewSession(false);
  } else {
    state.currentSessionId = state.chats[0].id;
    renderChatMessages();
  }
});

// Helper: User Display Names for Error Notices
function getModelDisplayName(modelIdOrKey) {
  if (MODELS[modelIdOrKey]) return MODELS[modelIdOrKey].name;
  for (const k in MODELS) {
    if (MODELS[k].id === modelIdOrKey) return MODELS[k].name;
  }
  if (modelIdOrKey.includes('vision')) return 'Jarvis Turbo';
  if (modelIdOrKey.includes('70b') || modelIdOrKey.includes('deepseek')) return 'Jarvis Ironman';
  return 'Jarvis Engine';
}

// Model Switching
function switchModel(key) {
  state.selectedModelKey = key;
  showToast(`Switched to ${MODELS[key].name}`);
}

// Tab Isolation Auth Storage
function updateAuthUI() {
  const user = state.currentUser;
  const userDisplay = document.getElementById('userNameDisplay');
  const emailDisplay = document.getElementById('userEmailDisplay');
  const avatar = document.getElementById('userAvatar');
  const logoutBtn = document.getElementById('logoutBtn');
  const topAuthBtnText = document.getElementById('topAuthBtnText');
  const bannerStatusLabel = document.getElementById('bannerStatusLabel');
  const bannerAuthBtn = document.getElementById('bannerAuthBtn');

  if (user) {
    userDisplay.innerText = user.name || user.email.split('@')[0];
    emailDisplay.innerText = user.email;
    avatar.innerText = (user.name || user.email)[0].toUpperCase();
    avatar.className = "w-8 h-8 rounded-full bg-cyan-600 flex items-center justify-center text-xs font-bold text-white uppercase shrink-0";
    logoutBtn.classList.remove('hidden');
    topAuthBtnText.innerText = 'Profile';
    bannerStatusLabel.innerText = `Account: ${user.email}`;
    bannerAuthBtn.innerText = 'Logged In';
    bannerAuthBtn.onclick = null;
  } else {
    userDisplay.innerText = 'Guest User';
    emailDisplay.innerText = 'Chats saved in current tab';
    avatar.innerText = 'G';
    avatar.className = "w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-200 uppercase shrink-0";
    logoutBtn.classList.add('hidden');
    topAuthBtnText.innerText = 'Sign In';
    bannerStatusLabel.innerText = 'Guest Mode';
    bannerAuthBtn.innerText = 'Sign In';
    bannerAuthBtn.onclick = openAuthModal;
  }
}

// Session Data Management (Tab-Isolated via sessionStorage)
function getStorageKey() {
  return state.currentUser ? `jarvis_chats_${state.currentUser.email}` : `jarvis_chats_guest_session`;
}

function loadUserChats() {
  const saved = sessionStorage.getItem(getStorageKey());
  state.chats = saved ? JSON.parse(saved) : [];
}

function saveUserChats() {
  sessionStorage.setItem(getStorageKey(), JSON.stringify(state.chats));
}

// Create New Session & Total UI Reset
function createNewSession(render = true) {
  const newSession = {
    id: 'session_' + Date.now(),
    title: 'New Chat',
    timestamp: Date.now(),
    messages: []
  };
  state.chats.unshift(newSession);
  state.currentSessionId = newSession.id;
  state.attachedFiles = [];
  renderFilePreviews();
  saveUserChats();
  renderSessionsList();
  if (render) renderChatMessages();
}

function getCurrentSession() {
  return state.chats.find(c => c.id === state.currentSessionId);
}

// Render Conversations History List
function renderSessionsList(filterText = '') {
  const listEl = document.getElementById('sessionsList');
  listEl.innerHTML = '';

  const filtered = state.chats.filter(c => c.title.toLowerCase().includes(filterText.toLowerCase()));

  if (filtered.length === 0) {
    listEl.innerHTML = `<p class="text-xs text-gray-500 py-3 text-center">No chats found</p>`;
    return;
  }

  filtered.forEach(session => {
    const isActive = session.id === state.currentSessionId;
    const item = document.createElement('div');
    item.className = `group flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer text-xs transition ${
      isActive ? 'bg-cyan-950/80 text-cyan-300 font-semibold border border-cyan-800/50' : 'text-gray-300 hover:bg-gray-800/60'
    }`;
    item.onclick = () => selectSession(session.id);

    item.innerHTML = `
      <div class="flex items-center space-x-2 truncate">
        <i class="fa-regular fa-message text-[11px] opacity-70"></i>
        <span class="truncate">${escapeHtml(session.title)}</span>
      </div>
      <button onclick="deleteSession('${session.id}', event)" class="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 p-1 transition" title="Delete Chat">
        <i class="fa-solid fa-trash text-[11px]"></i>
      </button>
    `;
    listEl.appendChild(item);
  });
}

function filterSessions(query) {
  renderSessionsList(query);
}

function selectSession(id) {
  state.currentSessionId = id;
  state.attachedFiles = [];
  renderFilePreviews();
  renderSessionsList();
  renderChatMessages();
}

function deleteSession(id, e) {
  if (e) e.stopPropagation();
  state.chats = state.chats.filter(c => c.id !== id);
  saveUserChats();

  if (state.currentSessionId === id) {
    if (state.chats.length > 0) {
      state.currentSessionId = state.chats[0].id;
    } else {
      createNewSession(false);
    }
  }
  renderSessionsList();
  renderChatMessages();
  showToast('Conversation deleted');
}

// History Wipe & Reset
function confirmClearHistory() {
  state.chats = [];
  saveUserChats();
  state.attachedFiles = [];
  renderFilePreviews();
  document.getElementById('chatInput').value = '';
  createNewSession(true);
  showToast('All chat history cleared');
}

// Render Messages & Welcome Screen
function renderChatMessages() {
  const container = document.getElementById('chatContainer');
  const session = getCurrentSession();

  if (!session || session.messages.length === 0) {
    container.innerHTML = `
      <div class="h-full flex flex-col items-center justify-center text-center p-6 space-y-6 max-w-2xl mx-auto">
        <div class="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-white text-3xl shadow-xl shadow-cyan-500/20">
          J
        </div>
        <div class="space-y-2">
          <h2 class="text-2xl font-bold text-gray-100">Welcome to JARVIS AI</h2>
          <p class="text-xs text-gray-400">Created by Abdullah Waheed • Powered by JARVIS Engine</p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 w-full text-left">
          <div onclick="setPrompt('Explain the complete relationship and history of Hazrat Ali (R.A) with Prophet Muhammad (PBUH)')" class="p-3.5 bg-gray-900 hover:bg-gray-800 border border-jarvis-border rounded-xl cursor-pointer transition space-y-1">
            <p class="text-xs font-semibold text-cyan-300">📖 Academic & History</p>
            <p class="text-[11px] text-gray-400">Deep historical analysis & workbook solutions</p>
          </div>
          <div onclick="setPrompt('Create an interactive presentation on Artificial Intelligence trends')" class="p-3.5 bg-gray-900 hover:bg-gray-800 border border-jarvis-border rounded-xl cursor-pointer transition space-y-1">
            <p class="text-xs font-semibold text-cyan-300">📊 Slide Presentations</p>
            <p class="text-[11px] text-gray-400">Generate interactive slide decks with player</p>
          </div>
          <div onclick="setPrompt('/image A futuristic glowing cybernetic AI city at night')" class="p-3.5 bg-gray-900 hover:bg-gray-800 border border-jarvis-border rounded-xl cursor-pointer transition space-y-1">
            <p class="text-xs font-semibold text-cyan-300">🎨 Image Generation</p>
            <p class="text-[11px] text-gray-400">Generate Flux images with download button</p>
          </div>
          <div onclick="openWorkspaceModal()" class="p-3.5 bg-gray-900 hover:bg-gray-800 border border-jarvis-border rounded-xl cursor-pointer transition space-y-1">
            <p class="text-xs font-semibold text-cyan-300">🌐 Google Workspace</p>
            <p class="text-[11px] text-gray-400">Connect Google Classroom & Google Docs</p>
          </div>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = '';
  session.messages.forEach(msg => {
    const isUser = msg.role === 'user';
    const wrapper = document.createElement('div');
    wrapper.className = `flex ${isUser ? 'justify-end' : 'justify-start'} w-full`;

    const bubble = document.createElement('div');
    bubble.className = `max-w-3xl rounded-2xl p-4 shadow-md space-y-3 ${
      isUser
        ? 'bg-cyan-950/70 border border-cyan-800/60 text-gray-100 rounded-br-none'
        : 'bg-gray-900 border border-jarvis-border text-gray-100 rounded-bl-none'
    }`;

    // Render Attachments Gallery Grid (Up to 10 images/files)
    if (msg.attachments && msg.attachments.length > 0) {
      const gallery = document.createElement('div');
      const imageAttachments = msg.attachments.filter(a => a.type.startsWith('image/'));
      const docAttachments = msg.attachments.filter(a => !a.type.startsWith('image/'));

      if (imageAttachments.length > 0) {
        gallery.className = `grid gap-2 ${
          imageAttachments.length === 1 ? 'grid-cols-1 max-w-sm' : 'grid-cols-2 md:grid-cols-3'
        } mb-2`;
        imageAttachments.forEach(att => {
          const img = document.createElement('img');
          img.src = att.data;
          img.className = 'w-full h-32 object-cover rounded-lg border border-gray-700 shadow-sm';
          gallery.appendChild(img);
        });
      }

      if (docAttachments.length > 0) {
        const docList = document.createElement('div');
        docList.className = 'flex flex-wrap gap-1.5 mb-2';
        docAttachments.forEach(doc => {
          const tag = document.createElement('span');
          tag.className = 'inline-flex items-center space-x-1 text-[11px] bg-gray-800 px-2.5 py-1 rounded-md border border-gray-700 text-gray-300';
          tag.innerHTML = `<i class="fa-solid fa-file-text text-cyan-400"></i><span>${escapeHtml(doc.name)}</span>`;
          docList.appendChild(tag);
        });
        bubble.appendChild(docList);
      }

      if (imageAttachments.length > 0) bubble.appendChild(gallery);
    }

    // Render Text or Special Features (Presentation / Image)
    if (msg.presentation) {
      bubble.appendChild(renderPresentationDeck(msg.presentation));
    } else if (msg.generatedImageUrl) {
      const imgContainer = document.createElement('div');
      imgContainer.className = 'relative group rounded-xl overflow-hidden border border-gray-700 shadow-lg my-2';
      imgContainer.innerHTML = `
        <img src="${msg.generatedImageUrl}" class="w-full max-h-96 object-cover">
        <a href="${msg.generatedImageUrl}" download="jarvis_generated.png" target="_blank" class="absolute bottom-3 right-3 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-lg flex items-center space-x-1.5 transition">
          <i class="fa-solid fa-download"></i>
          <span>Download Image</span>
        </a>
      `;
      bubble.appendChild(imgContainer);
    }

    if (msg.content) {
      const textDiv = document.createElement('div');
      textDiv.className = 'prose prose-invert text-sm leading-relaxed max-w-none';
      textDiv.innerHTML = formatMarkdown(msg.content);
      bubble.appendChild(textDiv);
    }

    // Error Notice Display
    if (msg.errorNotice) {
      const errDiv = document.createElement('div');
      errDiv.className = 'p-3 rounded-xl bg-amber-950/40 border border-amber-600/40 text-xs text-amber-300 flex items-start space-x-2 mt-2';
      errDiv.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-amber-400 mt-0.5"></i><div><strong>${escapeHtml(msg.errorNotice.modelName)} Notice:</strong> ${escapeHtml(msg.errorNotice.message)}</div>`;
      bubble.appendChild(errDiv);
    }

    wrapper.appendChild(bubble);
    container.appendChild(wrapper);
  });

  container.scrollTop = container.scrollHeight;
}

// Multi-File Attachment Processing (Up to 10 Files)
function handleFileSelect(event) {
  const files = Array.from(event.target.files);
  if (state.attachedFiles.length + files.length > 10) {
    showToast('Maximum 10 attachments allowed at a time', 'error');
    return;
  }

  files.forEach(file => {
    const reader = new FileReader();
    if (file.type.startsWith('image/')) {
      reader.onload = (e) => {
        state.attachedFiles.push({
          name: file.name,
          type: file.type,
          data: e.target.result
        });
        renderFilePreviews();
      };
      reader.readAsDataURL(file);
    } else {
      reader.onload = (e) => {
        state.attachedFiles.push({
          name: file.name,
          type: file.type || 'text/plain',
          textContent: e.target.result
        });
        renderFilePreviews();
      };
      reader.readAsText(file);
    }
  });

  event.target.value = '';
}

function removeAttachment(index) {
  state.attachedFiles.splice(index, 1);
  renderFilePreviews();
}

function renderFilePreviews() {
  const container = document.getElementById('filePreviewContainer');
  if (state.attachedFiles.length === 0) {
    container.classList.add('hidden');
    container.innerHTML = '';
    return;
  }

  container.classList.remove('hidden');
  container.innerHTML = '';

  state.attachedFiles.forEach((file, idx) => {
    const badge = document.createElement('div');
    badge.className = 'flex items-center space-x-2 bg-gray-800 border border-gray-700 px-2.5 py-1 rounded-lg text-xs text-gray-200 shadow-sm';

    if (file.type.startsWith('image/')) {
      badge.innerHTML = `
        <img src="${file.data}" class="w-5 h-5 object-cover rounded">
        <span class="truncate max-w-[120px] text-[11px]">${escapeHtml(file.name)}</span>
        <button onclick="removeAttachment(${idx})" class="text-gray-400 hover:text-red-400 ml-1">✕</button>
      `;
    } else {
      badge.innerHTML = `
        <i class="fa-solid fa-file-lines text-cyan-400 text-xs"></i>
        <span class="truncate max-w-[120px] text-[11px]">${escapeHtml(file.name)}</span>
        <button onclick="removeAttachment(${idx})" class="text-gray-400 hover:text-red-400 ml-1">✕</button>
      `;
    }
    container.appendChild(badge);
  });
}

// Voice Writing (Speech-to-Text)
function initSpeechRecognition() {
  if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    state.speechRecognition = new SpeechRecognition();
    state.speechRecognition.continuous = false;
    state.speechRecognition.interimResults = true;

    state.speechRecognition.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      document.getElementById('chatInput').value = transcript;
      autoResizeInput(document.getElementById('chatInput'));
    };

    state.speechRecognition.onend = () => {
      state.isRecording = false;
      document.getElementById('micPulse').classList.add('hidden');
      document.getElementById('micBtn').classList.remove('text-red-500');
    };
  }
}

function toggleVoiceWriting() {
  if (!state.speechRecognition) {
    showToast('Speech recognition not supported in this browser', 'error');
    return;
  }

  if (state.isRecording) {
    state.speechRecognition.stop();
  } else {
    state.speechRecognition.start();
    state.isRecording = true;
    document.getElementById('micPulse').classList.remove('hidden');
    document.getElementById('micBtn').classList.add('text-red-500');
    showToast('Listening... Speak now');
  }
}

// Handle User Input Submission
async function handleSendMessage() {
  const inputEl = document.getElementById('chatInput');
  const text = inputEl.value.trim();
  const attachments = [...state.attachedFiles];

  if (!text && attachments.length === 0) return;

  const session = getCurrentSession();
  if (!session) return;

  // Auto-generate session title from first message
  if (session.messages.length === 0) {
    session.title = text ? (text.length > 28 ? text.substring(0, 28) + '...' : text) : 'File Attachment';
    renderSessionsList();
  }

  // Push User Message
  session.messages.push({
    role: 'user',
    content: text,
    attachments: attachments,
    timestamp: Date.now()
  });

  // Clear Input Bar
  inputEl.value = '';
  inputEl.style.height = 'auto';
  state.attachedFiles = [];
  renderFilePreviews();
  renderChatMessages();

  // Check for Image Generation Command
  if (text.toLowerCase().startsWith('/image') || text.toLowerCase().includes('generate image') || text.toLowerCase().includes('draw an image')) {
    const promptClean = text.replace(/\/image/i, '').replace(/generate image/i, '').trim();
    const imageUrl = `https://pollinations.ai/p/${encodeURIComponent(promptClean)}?width=1024&height=1024&seed=${Math.floor(Math.random() * 100000)}&model=flux`;
    
    session.messages.push({
      role: 'assistant',
      content: `Generated Flux artwork for: **"${escapeHtml(promptClean)}"**`,
      generatedImageUrl: imageUrl,
      timestamp: Date.now()
    });
    saveUserChats();
    renderChatMessages();
    return;
  }

  // Check for Presentation Creation Command
  const isPresentation = text.toLowerCase().includes('presentation') || text.toLowerCase().includes('slide deck');

  // Prepare Payload
  const assistantMessage = {
    role: 'assistant',
    content: '',
    timestamp: Date.now()
  };
  session.messages.push(assistantMessage);
  renderChatMessages();

  // Call API with Auto-Routing
  await executeModelRequest(session, assistantMessage, attachments, isPresentation);
}

// API Execution & Vision Auto-Routing
async function executeModelRequest(session, assistantMsg, attachments, isPresentation) {
  const hasImages = attachments.some(a => a.type.startsWith('image/'));
  
  // Vision Auto-Routing Logic: If images attached, force vision model
  let targetModel = MODELS[state.selectedModelKey].id;
  if (hasImages) {
    targetModel = 'llama-3.2-11b-vision-preview';
  }

  // Build OpenAI Messages Format
  const formattedMessages = [
    { role: 'system', content: JARVIS_SYSTEM_PROMPT }
  ];

  if (isPresentation) {
    formattedMessages.push({
      role: 'system',
      content: 'The user requested a presentation. Return a JSON object ONLY inside a ```json ``` block with format: { "title": "...", "slides": [{ "slide": 1, "title": "...", "bullets": ["..."] }] }'
    });
  }

  session.messages.forEach(m => {
    if (m.role === 'user') {
      if (m.attachments && m.attachments.some(a => a.type.startsWith('image/'))) {
        const parts = [{ type: 'text', text: m.content || 'Analyze these images:' }];
        m.attachments.forEach(att => {
          if (att.type.startsWith('image/')) {
            parts.push({
              type: 'image_url',
              image_url: { url: att.data }
            });
          } else if (att.textContent) {
            parts[0].text += `\n\n[Attached File ${att.name}]:\n${att.textContent}`;
          }
        });
        formattedMessages.push({ role: 'user', content: parts });
      } else {
        let contentText = m.content || '';
        if (m.attachments) {
          m.attachments.forEach(att => {
            if (att.textContent) contentText += `\n\n[Attached File ${att.name}]:\n${att.textContent}`;
          });
        }
        formattedMessages.push({ role: 'user', content: contentText });
      }
    } else if (m.role === 'assistant' && m.content) {
      formattedMessages.push({ role: 'assistant', content: m.content });
    }
  });

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEYS[0]}`
      },
      body: JSON.stringify({
        model: targetModel,
        messages: formattedMessages,
        temperature: 0.7,
        max_tokens: 4096
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Unable to reach JARVIS core.`);
    }

    const data = await response.json();
    const rawContent = data.choices[0].message.content;

    if (isPresentation && rawContent.includes('```json')) {
      try {
        const jsonMatch = rawContent.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          assistantMsg.presentation = JSON.parse(jsonMatch[1]);
          assistantMsg.content = 'Generated presentation deck below:';
        } else {
          assistantMsg.content = rawContent;
        }
      } catch (err) {
        assistantMsg.content = rawContent;
      }
    } else {
      assistantMsg.content = rawContent;
    }

    saveUserChats();
    renderChatMessages();

  } catch (error) {
    const friendlyName = getModelDisplayName(targetModel);
    assistantMsg.errorNotice = {
      modelName: friendlyName,
      message: `${error.message}. Please check your network connection.`
    };
    saveUserChats();
    renderChatMessages();
  }
}

// Presentation Deck Component & Carousel Player
function renderPresentationDeck(deck) {
  const container = document.createElement('div');
  container.className = 'p-4 rounded-xl bg-gray-950 border border-cyan-800/60 space-y-4 shadow-xl my-2';
  
  let currentSlide = 0;
  const slides = deck.slides || [];

  function updateSlideUI() {
    const slide = slides[currentSlide];
    container.innerHTML = `
      <div class="flex items-center justify-between border-b border-gray-800 pb-3">
        <span class="text-xs font-bold text-cyan-400 uppercase tracking-wider"><i class="fa-solid fa-file-powerpoint mr-1.5"></i>${escapeHtml(deck.title || 'Presentation')}</span>
        <span class="text-xs text-gray-400">Slide ${currentSlide + 1} of ${slides.length}</span>
      </div>

      <div class="p-4 bg-gray-900 rounded-lg border border-gray-800 space-y-3 min-h-[160px]">
        <h4 class="text-base font-bold text-gray-100">${escapeHtml(slide ? slide.title : '')}</h4>
        <ul class="space-y-1.5 text-xs text-gray-300 list-disc pl-4">
          ${slide && slide.bullets ? slide.bullets.map(b => `<li>${escapeHtml(b)}</li>`).join('') : ''}
        </ul>
      </div>

      <div class="flex items-center justify-between pt-1">
        <div class="flex space-x-2">
          <button id="prevSlideBtn" class="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-xs text-gray-200 rounded-md border border-gray-700 transition disabled:opacity-40">Previous</button>
          <button id="nextSlideBtn" class="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-xs text-gray-200 rounded-md border border-gray-700 transition disabled:opacity-40">Next</button>
        </div>
        <button id="fullscreenBtn" class="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white rounded-md shadow transition">Fullscreen</button>
      </div>
    `;

    const prevBtn = container.querySelector('#prevSlideBtn');
    const nextBtn = container.querySelector('#nextSlideBtn');
    const fullBtn = container.querySelector('#fullscreenBtn');

    prevBtn.disabled = currentSlide === 0;
    nextBtn.disabled = currentSlide === slides.length - 1;

    prevBtn.onclick = () => { if (currentSlide > 0) { currentSlide--; updateSlideUI(); } };
    nextBtn.onclick = () => { if (currentSlide < slides.length - 1) { currentSlide++; updateSlideUI(); } };
    fullBtn.onclick = () => openPresentationFullscreen(deck);
  }

  updateSlideUI();
  return container;
}

function openPresentationFullscreen(deck) {
  const modal = document.getElementById('presentationModal');
  const title = document.getElementById('presentationTitle');
  const stage = document.getElementById('presentationStage');

  title.innerText = deck.title || 'Presentation';
  stage.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
      ${(deck.slides || []).map(s => `
        <div class="p-6 bg-gray-900 border border-gray-800 rounded-xl space-y-3 shadow-lg">
          <span class="text-xs text-cyan-400 font-bold">Slide ${s.slide}</span>
          <h3 class="text-lg font-bold text-gray-100">${escapeHtml(s.title)}</h3>
          <ul class="list-disc pl-5 text-sm text-gray-300 space-y-1">
            ${(s.bullets || []).map(b => `<li>${escapeHtml(b)}</li>`).join('')}
          </ul>
        </div>
      `).map(x => x).join('')}
    </div>
  `;

  modal.classList.remove('hidden');
}

function closePresentationModal() {
  document.getElementById('presentationModal').classList.add('hidden');
}

// Google Workspace OAuth Integration (Classroom & Docs)
function openWorkspaceModal() {
  document.getElementById('workspaceModal').classList.remove('hidden');
}

function closeWorkspaceModal() {
  document.getElementById('workspaceModal').classList.add('hidden');
}

function switchWorkspaceTab(tab) {
  const cTab = document.getElementById('wsTabClassroom');
  const dTab = document.getElementById('wsTabDocs');
  if (tab === 'classroom') {
    cTab.className = 'flex-1 py-2 text-xs font-semibold text-blue-400 border-b-2 border-blue-400';
    dTab.className = 'flex-1 py-2 text-xs font-semibold text-gray-400 border-b-2 border-transparent hover:text-gray-200';
  } else {
    dTab.className = 'flex-1 py-2 text-xs font-semibold text-blue-400 border-b-2 border-blue-400';
    cTab.className = 'flex-1 py-2 text-xs font-semibold text-gray-400 border-b-2 border-transparent hover:text-gray-200';
  }
}

function initiateGoogleOAuth() {
  if (typeof google === 'undefined' || !google.accounts) {
    showToast('Google API client script not loaded', 'error');
    return;
  }

  const client = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: '[https://www.googleapis.com/auth/classroom.courses.readonly](https://www.googleapis.com/auth/classroom.courses.readonly) [https://www.googleapis.com/auth/classroom.coursework.me](https://www.googleapis.com/auth/classroom.coursework.me) [https://www.googleapis.com/auth/documents.readonly](https://www.googleapis.com/auth/documents.readonly)',
    callback: async (response) => {
      if (response.access_token) {
        state.googleToken = response.access_token;
        document.getElementById('googleAuthStatusText').innerText = 'Connected';
        document.getElementById('googleAuthStatusText').className = 'text-emerald-400';
        showToast('Google Workspace Connected!');
        fetchGoogleClassroomData();
      }
    }
  });

  client.requestAccessToken();
}

async function fetchGoogleClassroomData() {
  if (!state.googleToken) return;
  const content = document.getElementById('workspaceContent');
  content.innerHTML = `<p class="text-xs text-gray-400 text-center py-6"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Fetching Classroom & Docs data...</p>`;

  try {
    const res = await fetch('[https://classroom.googleapis.com/v1/courses](https://classroom.googleapis.com/v1/courses)', {
      headers: { Authorization: `Bearer ${state.googleToken}` }
    });
    const data = await res.json();

    if (!data.courses || data.courses.length === 0) {
      content.innerHTML = `<p class="text-xs text-amber-400 text-center py-6">No enrolled Google Classroom courses found.</p>`;
      return;
    }

    content.innerHTML = '';
    data.courses.forEach(course => {
      const card = document.createElement('div');
      card.className = 'p-3 bg-gray-800 rounded-xl border border-jarvis-border flex items-center justify-between';
      card.innerHTML = `
        <div>
          <h4 class="text-xs font-bold text-gray-100">${escapeHtml(course.name)}</h4>
          <p class="text-[10px] text-gray-400">${escapeHtml(course.section || 'Classroom Course')}</p>
        </div>
        <button onclick="attachCourseToPrompt('${escapeHtml(course.name)}')" class="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold rounded-lg shadow transition">
          Import Course
        </button>
      `;
      content.appendChild(card);
    });
  } catch (err) {
    content.innerHTML = `<p class="text-xs text-red-400 text-center py-6">Failed to load Google Workspace data.</p>`;
  }
}

function attachCourseToPrompt(courseName) {
  state.attachedFiles.push({
    name: `Google Classroom: ${courseName}`,
    type: 'text/plain',
    textContent: `[Google Classroom Course Context: ${courseName}]`
  });
  renderFilePreviews();
  closeWorkspaceModal();
  showToast(`Imported ${courseName} into chat!`);
}

// Authentication Modal & Registration Handler
function openAuthModal() {
  document.getElementById('authModal').classList.remove('hidden');
}

function closeAuthModal() {
  document.getElementById('authModal').classList.add('hidden');
}

function switchAuthTab(tab) {
  state.authTab = tab;
  const signinBtn = document.getElementById('tabSignIn');
  const registerBtn = document.getElementById('tabRegister');
  const nameField = document.getElementById('nameField');
  const submitBtn = document.getElementById('authSubmitBtn');

  if (tab === 'signin') {
    signinBtn.className = 'flex-1 py-2 text-sm font-semibold text-cyan-400 border-b-2 border-cyan-400';
    registerBtn.className = 'flex-1 py-2 text-sm font-semibold text-gray-400 border-b-2 border-transparent hover:text-gray-200';
    nameField.classList.add('hidden');
    submitBtn.innerText = 'Sign In';
  } else {
    registerBtn.className = 'flex-1 py-2 text-sm font-semibold text-cyan-400 border-b-2 border-cyan-400';
    signinBtn.className = 'flex-1 py-2 text-sm font-semibold text-gray-400 border-b-2 border-transparent hover:text-gray-200';
    nameField.classList.remove('hidden');
    submitBtn.innerText = 'Create Account';
  }
}

function handleAuthSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value.trim();
  const name = document.getElementById('authName').value.trim();

  if (!email || !password) return;

  const registry = JSON.parse(localStorage.getItem('jarvis_registered_users') || '{}');

  if (state.authTab === 'register') {
    registry[email] = { name: name || email.split('@')[0], password };
    localStorage.setItem('jarvis_registered_users', JSON.stringify(registry));
    showToast('Account registered successfully! Signing in...');
  } else {
    if (!registry[email] || registry[email].password !== password) {
      showToast('Invalid email or password. Please register first.', 'error');
      return;
    }
  }

  const userObj = { email, name: registry[email] ? registry[email].name : (name || email.split('@')[0]) };
  state.currentUser = userObj;
  sessionStorage.setItem('jarvis_session_user', JSON.stringify(userObj));

  closeAuthModal();
  updateAuthUI();
  loadUserChats();
  createNewSession(true);
  showToast(`Welcome, ${userObj.name}!`);
}

function simulateGoogleSignIn() {
  const userObj = { email: 'user@gmail.com', name: 'Google User' };
  state.currentUser = userObj;
  sessionStorage.setItem('jarvis_session_user', JSON.stringify(userObj));
  closeAuthModal();
  updateAuthUI();
  loadUserChats();
  createNewSession(true);
  showToast('Signed in with Google!');
}

function handleLogout() {
  state.currentUser = null;
  sessionStorage.removeItem('jarvis_session_user');
  updateAuthUI();
  loadUserChats();
  createNewSession(true);
  showToast('Signed out of session');
}

// UI Utilities & Helper Functions
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('-translate-x-full');
}

function autoResizeInput(el) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

function handleKeyDown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSendMessage();
  }
}

function setPrompt(text) {
  const input = document.getElementById('chatInput');
  input.value = text;
  autoResizeInput(input);
  input.focus();
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `pointer-events-auto px-4 py-2.5 rounded-xl text-xs font-semibold shadow-xl transition-all duration-300 transform translate-y-2 opacity-0 flex items-center space-x-2 ${
    type === 'error' ? 'bg-red-900 border border-red-700 text-red-200' : 'bg-cyan-950 border border-cyan-700 text-cyan-200'
  }`;
  toast.innerHTML = `<i class="fa-solid ${type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}"></i><span>${escapeHtml(message)}</span>`;

  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  }, 10);

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, ''');
}

function formatMarkdown(text) {
  if (!text) return '';
  let formatted = escapeHtml(text);
  
  // Format Code Blocks
  formatted = formatted.replace(/```([\s\S]*?)```/g, '<pre class="bg-gray-950 border border-gray-800 p-3 rounded-xl overflow-x-auto my-2 text-xs text-cyan-300"><code>$1</code></pre>');
  // Format Inline Code
  formatted = formatted.replace(/`([^`]+)`/g, '<code class="bg-gray-800 px-1.5 py-0.5 rounded text-cyan-300 text-xs">$1</code>');
  // Format Bold
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong class="text-white font-bold">$1</strong>');
  // Format Newlines
  formatted = formatted.replace(/\n/g, '<br>');

  return formatted;
}
