import AuthPage from './AuthPage'
import ProfilePage from './ProfilePage'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  getDocuments,
  getCurrentUser,
  logout,
  type AuthUser,
  uploadDocument,
  deleteDocument,
  askAssistant,
  type AssistantMode,
  type IrisDocument,
  type AskResponse,
} from './api'
import {
  Activity,
  ArrowDown,
  ArrowUp,
  BookOpen,
  FileText,
  Files,
  FolderOpen,
  History,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  MessageSquare,
  Paperclip,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Upload,
  Trash2,
  X,
} from 'lucide-react'
import './App.css'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

function IrisLogo() {
  return (
    <svg
      viewBox="0 0 64 64"
      className="iris-logo"
      fill="none"
      aria-label="IRIS logo"
    >
      <defs>
        <linearGradient
          id="iris-gradient"
          x1="8"
          y1="8"
          x2="56"
          y2="56"
        >
          <stop stopColor="#C4B5FD" />
          <stop offset="1" stopColor="#818CF8" />
        </linearGradient>
      </defs>

      <path
        d="M5 32Q32 5 59 32Q32 59 5 32Z"
        stroke="url(#iris-gradient)"
        strokeWidth="2.5"
      />

      <circle
        cx="32"
        cy="32"
        r="14"
        stroke="#A78BFA"
        strokeWidth="2"
      />

      <circle
        cx="32"
        cy="32"
        r="8"
        fill="url(#iris-gradient)"
      />

      <circle cx="35" cy="29" r="3" fill="white" />

      <path
        d="M32 3V9M32 55V61M3 32H9M55 32H61"
        stroke="#818CF8"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

const suggestions = [
  {
    icon: FileText,
    title: 'Understand a document',
    description: 'Summarize key ideas, chapters, and findings.',
    prompt: 'Help me understand my uploaded documents.',
  },
  {
    icon: Search,
    title: 'Find specific information',
    description: 'Locate facts and supporting page citations.',
    prompt: 'Find specific information in my documents.',
  },
  {
    icon: BookOpen,
    title: 'Learn something new',
    description: 'Explore concepts using your own material.',
    prompt: 'Help me learn a concept from my documents.',
  },
  {
    icon: Sparkles,
    title: 'Discover insights',
    description: 'Connect related ideas across your files.',
    prompt: 'Find important insights across my documents.',
  },
]


type WebSource = {
  title: string
  url: string
  content?: string
}

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: AskResponse['sources']
  web_sources?: WebSource[]
}


type ChatSession = {
  id: string
  title: string
  updatedAt: number
  messages: ChatMessage[]
}

const CHAT_STORAGE_KEY = 'iris_chat_history_v1'

function readSavedChats(): ChatSession[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(CHAT_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is ChatSession =>
      Boolean(item) &&
      typeof item.id === 'string' &&
      typeof item.title === 'string' &&
      typeof item.updatedAt === 'number' &&
      Array.isArray(item.messages),
    )
  } catch {
    return []
  }
}

function makeChatTitle(messages: ChatMessage[]): string {
  const firstQuestion = messages.find((item) => item.role === 'user')?.content
  if (!firstQuestion) return 'New conversation'
  return firstQuestion.length > 32  ? `${firstQuestion.slice(0, 32).trim()}\u2026` : firstQuestion
}


function App() {
  // First visit par hi cinematic eye intro play hoga.
  const [showIntro, setShowIntro] = useState(() => {
  if (typeof window === 'undefined') return false

  return !window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches
})

  const [message, setMessage] = useState('')
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [activeView, setActiveView] = useState('chat')
  const [playChatAnimation, setPlayChatAnimation] = useState(false)
  const [authChecking, setAuthChecking] = useState(true)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [documents, setDocuments] = useState<IrisDocument[]>([])
  const [documentsLoading, setDocumentsLoading] = useState(true)
  const [documentsError, setDocumentsError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadMessage, setUploadMessage] = useState('')
  const [deletingDocumentId, setDeletingDocumentId] = useState<number | null>(null)
  const [documentDeleteError, setDocumentDeleteError] = useState('')
  const [asking, setAsking] = useState(false)
  const [initialChatState] = useState(() => {
    const savedChats = readSavedChats().sort(
      (a, b) => b.updatedAt - a.updatedAt
    )
    const firstChat = savedChats[0]

    return {
      chats: savedChats,
      activeChatId: firstChat?.id ?? null,
      messages: firstChat?.messages ?? [],
      chatStarted: (firstChat?.messages.length ?? 0) > 0,
      welcomeVisible: (firstChat?.messages.length ?? 0) === 0,
    }
  })

  const [chatStarted, setChatStarted] = useState(initialChatState.chatStarted)
  const [welcomeVisible, setWelcomeVisible] = useState(initialChatState.welcomeVisible)
  const [welcomeExiting, setWelcomeExiting] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>(initialChatState.messages)
  const [savedChats, setSavedChats] = useState<ChatSession[]>(initialChatState.chats)
  const [activeChatId, setActiveChatId] = useState<string | null>(initialChatState.activeChatId)
  const [selectedDocumentId, setSelectedDocumentId] = useState('all')
  const [assistantMode, setAssistantMode] = useState<AssistantMode>('smart')
  const [webSearchEnabled, setWebSearchEnabled] = useState(false)
  const [chatError, setChatError] = useState('')
  const conversationEndRef = useRef<HTMLDivElement>(null)

  // Keep the active conversation in the sidebar list.
  const chats = useMemo(() => {
    if (!activeChatId || messages.length === 0) {
      return savedChats
    }

    const nextChat: ChatSession = {
      id: activeChatId,
      title: makeChatTitle(messages),
      updatedAt: savedChats.find((chat) => chat.id === activeChatId)?.updatedAt ?? 0,
      messages,
    }

    return [
      nextChat,
      ...savedChats.filter((chat) => chat.id !== activeChatId),
    ]
  }, [savedChats, activeChatId, messages])

  // Persist chat history whenever it changes.
  useEffect(() => {
    try {
      window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chats))
    } catch {
      // Keep the current conversation usable if browser storage is unavailable.
    }
  }, [chats])

  // Restore the signed-in session before loading any private workspace data.
  useEffect(() => {
    let cancelled = false

    getCurrentUser()
      .then((user) => {
        if (!cancelled) {
          setCurrentUser(user)
          setDocumentsLoading(Boolean(user))
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCurrentUser(null)
          setDocumentsLoading(false)
        }
      })
      .finally(() => {
        if (!cancelled) setAuthChecking(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  // Only request documents after the backend confirms an authenticated session.
  useEffect(() => {
    if (!currentUser) return

    let cancelled = false
    getDocuments()
      .then((data) => {
        if (cancelled) return
        setDocuments(data.documents)
        setDocumentsError('')
      })
      .catch((error: Error) => {
        if (cancelled) return
        setDocumentsError(error.message)
      })
      .finally(() => {
        if (!cancelled) setDocumentsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [currentUser])

  const handleAuthenticated = async () => {
    try {
      const user = await getCurrentUser()

      setShowIntro(
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      )

      setDocumentsLoading(true)
      setCurrentUser(user)
      setActiveView('chat')
      setDocumentsError('')
    } catch {
      setCurrentUser(null)
    }
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    setProfileError('')
    try {
      await logout()
      setCurrentUser(null)
      setActiveView('chat')
      setDocuments([])
      setDocumentsLoading(false)
      setMessages([])
      setSavedChats([])
      setActiveChatId(null)
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Logout failed. Please try again.')
    } finally {
      setLoggingOut(false)
    }
  }

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, asking])

  // First-visit intro ko complete hone ke liye enough time do.
    useEffect(() => {
    if (!showIntro) return

    const introTimer = window.setTimeout(() => {
      setShowIntro(false)
    }, 5500)

    return () => window.clearTimeout(introTimer)
  }, [showIntro])

  // New Chat ki separate animation automatically stop ho jayegi.
  useEffect(() => {
    if (!playChatAnimation) return

    const chatTimer = window.setTimeout(() => {
      setPlayChatAnimation(false)
    }, 1600)

    return () => window.clearTimeout(chatTimer)
  }, [playChatAnimation])

  // New Chat button ka handler.
  const startNewChat = () => {
    setActiveView('chat')
    setMessage('')
    setMessages([])
    setActiveChatId(null)
    setChatStarted(false)
    setWelcomeVisible(true)
    setWelcomeExiting(false)
    setChatError('')
    setMobileSidebarOpen(false)
    setSelectedDocumentId('all')
    setPlayChatAnimation(false)
    window.setTimeout(() => setPlayChatAnimation(true), 30)
  }

  const openSavedChat = (chat: ChatSession) => {
    setActiveChatId(chat.id)
    setMessages(chat.messages)
    setMessage('')
    setActiveView('chat')
    setChatStarted(chat.messages.length > 0)
    setWelcomeVisible(chat.messages.length === 0)
    setWelcomeExiting(false)
    setChatError('')
    setMobileSidebarOpen(false)
  }

  const deleteSavedChat = (chatId: string) => {
    setSavedChats((current) => current.filter((chat) => chat.id !== chatId))
    if (activeChatId === chatId) {
      setActiveChatId(null)
      setMessages([])
      setMessage('')
      setChatStarted(false)
      setWelcomeVisible(true)
      setWelcomeExiting(false)
    }
  }

  const chooseSuggestion = (prompt: string) => {
    setMessage(prompt)
    setActiveView('chat')
  }

  const openUpload = () => {
    setActiveView('documents')
    setMobileSidebarOpen(false)
  }
  const handleDeleteDocument = async (document: IrisDocument) => {
    const confirmed = window.confirm(
      `Delete "${document.filename}"? This will also remove its indexed chunks from IRIS.`,
    )
    if (!confirmed) return

    setDeletingDocumentId(document.id)
    setDocumentDeleteError('')
    try {
      await deleteDocument(document.id)
      setDocuments((current) => current.filter((item) => item.id !== document.id))
      if (selectedDocumentId === String(document.id)) {
        setSelectedDocumentId('all')
      }
    } catch (error) {
      setDocumentDeleteError(
        error instanceof Error ? error.message : 'Could not delete this document.',
      )
    } finally {
      setDeletingDocumentId(null)
    }
  }

  const handleUpload = async (files: FileList | null) => {
  if (!files || files.length === 0) return
    const maxFileSize = 50 * 1024 * 1024

  const oversizedFiles = Array.from(files).filter(
    (file) => file.size > maxFileSize,
  )

  if (oversizedFiles.length > 0) {
    setUploadError(
      `Each file must be 50 MB or smaller:\n${oversizedFiles
        .map((file) => file.name)
        .join('\n')}`,
    )
    setUploadMessage('')
    return
  }

  setUploading(true)
  setUploadError('')
  setUploadMessage('')

  const failedFiles: string[] = []
  let uploadedCount = 0

  try {
    for (const file of Array.from(files)) {
      try {
        await uploadDocument(file)
        uploadedCount++
      } catch (error) {
        failedFiles.push(
          `${file.name}: ${
            error instanceof Error ? error.message : 'Upload failed'
          }`,
        )
      }
    }

    const data = await getDocuments()
    setDocuments(data.documents)

    if (failedFiles.length > 0) {
      setUploadError(failedFiles.join('\n'))
    }

    if (uploadedCount > 0) {
      setUploadMessage(
        `${uploadedCount} file(s) uploaded successfully.`,
      )
    }
  } catch (error) {
    setUploadError(
      error instanceof Error
        ? error.message
        : 'Could not refresh the document list.',
    )
  } finally {
    setUploading(false)
  }
}
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const question = message.trim()
    if (!question || asking) return

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      content: question,
    }
    const chatId = activeChatId ?? `chat-${Date.now()}`
    if (!activeChatId) setActiveChatId(chatId)
    setMessages((current) => [...current, userMessage])
    setMessage('')
    setActiveView('chat')
    if (!chatStarted) {
      setChatStarted(true)
      setWelcomeExiting(true)
      window.setTimeout(() => setWelcomeVisible(false), 300)
    }



    setAsking(true)
    setChatError('')
    
      try {
        const history = messages.slice(-12).map((item) => ({
          role: item.role,
          content: item.content,
        }))

        const result = await askAssistant({
          question,
          history,
          mode: assistantMode,
          web_search_enabled:
            assistantMode === 'smart' && webSearchEnabled,
          document_id:
            selectedDocumentId === 'all'
              ? null
              : Number(selectedDocumentId),
        })
        console.log('Web sources:', result.web_sources)
        console.log('Assistant answer:', result.answer)
        setMessages((current) => [
          ...current,
          {
            id: `${Date.now()}-assistant`,
            role: 'assistant',
            content: result.answer,
            sources: result.sources,
            web_sources: result.web_sources,
          },
        ])
      } catch (error) {

      const errorMessage = error instanceof Error
        ? error.message
        : 'Something went wrong. Please try again.'
      setChatError(errorMessage)
      setMessages((current) => [...current, {
        id: `${Date.now()}-assistant-error`,
        role: 'assistant',
        content: errorMessage,
      }])
    } finally {
      setAsking(false)
    }
  }

  if (authChecking) {
    return (
      <main className="iris-app" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <p role="status" style={{ color: '#c4b5fd' }}>Checking your IRIS session...</p>
      </main>
    )
  }

  if (!currentUser) {
    return <AuthPage onAuthenticated={handleAuthenticated} />
  }

  if (activeView === 'profile') {
    return (
      <ProfilePage
        user={currentUser}
        onBack={() => setActiveView('chat')}
        onUserUpdated={(user) => setCurrentUser(user)}
        onLogout={() => void handleLogout()}
        loggingOut={loggingOut}
        error={profileError}
      />
    )
  }

  return (
    <main
      className={[
        'iris-app',
        showIntro ? 'intro-is-playing' : '',
        playChatAnimation ? 'chat-is-opening' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* First-visit cinematic eye intro */}
      {showIntro && (
        <div
          className="iris-intro"
          role="presentation"
          aria-hidden="true"
        >
          <div className="intro-aura intro-aura-one" />
          <div className="intro-aura intro-aura-two" />
          <div className="intro-grid" />

          <div className="intro-center">
            <div className="intro-orbit intro-orbit-one" />
            <div className="intro-orbit intro-orbit-two" />

            <div className="intro-logo-shell">
              <IrisLogo />
            </div>

            <span className="intro-scan-line" />

            <div className="intro-wordmark">
              <span className="intro-wordmark-name">IRIS</span>

              <span className="intro-wordmark-full">
                INTELLIGENT RETRIEVAL &amp; INSIGHT SYSTEM
              </span>

              <span className="intro-wordmark-status">
                <i />
                INITIALIZING KNOWLEDGE SPACE
              </span>
            </div>
          </div>

          <div className="intro-bottom-line">
            <span />
          </div>
        </div>
      )}

      {/* Mobile sidebar backdrop */}
      {mobileSidebarOpen && (
        <button
          className="mobile-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`sidebar ${mobileSidebarOpen ? 'sidebar-open' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}
      >
        <div className="brand">
          <div
            className="brand-mark"
            title="Intelligent Retrieval & Insight System"
          >
            <IrisLogo />
          </div>

          <div className="brand-copy">
            <span className="brand-name">IRIS</span>

            <span className="brand-full-name">
              Intelligent Retrieval &amp; Insight System
            </span>

            <span className="brand-caption">
              YOUR KNOWLEDGE, CONNECTED
            </span>
          </div>

          <button
            className="icon-button sidebar-close"
            aria-label="Close sidebar"
            onClick={() => setMobileSidebarOpen(false)}
          >
            <X size={18} />
          </button>

          <button
            type="button"
            className="sidebar-toggle"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        </div>

        <button
          className="new-chat-button"
          onClick={startNewChat}
        >
          <Plus size={18} />
          <span>New chat</span>
          <span className="shortcut">&#8629;</span>
        </button>

        <div className="sidebar-nav">
          <button
            className={`nav-item ${
              activeView === 'chat' ? 'nav-active' : ''
            }`}
            onClick={() => {
              setActiveView('chat')
              setMobileSidebarOpen(false)
            }}
          >
            <MessageSquare size={17} />
            <span>Chat workspace</span>
          </button>

          <button
            className={`nav-item ${
              activeView === 'documents' ? 'nav-active' : ''
            }`}
            onClick={openUpload}
          >
            <Files size={17} />
            <span>Documents</span>
            <span className="nav-count">{documents.length}</span>
          </button>
        </div>

        <div className="sidebar-section recent-section">
          <div className="section-heading">
            <span>RECENT CHATS</span>
            <History size={15} />
          </div>

          {chats.length === 0 ? (
            <div className="empty-recent">
              <div className="empty-recent-icon">
                <MessageSquare size={16} />
              </div>
              <span>Your conversations will appear here.</span>
            </div>
          ) : (
            <div className="chat-history-list">
              {chats.map((chat) => (
                <div className={`chat-history-row ${activeChatId === chat.id ? 'chat-history-row-active' : ''}`} key={chat.id}>
                  <button className="chat-history-item" onClick={() => openSavedChat(chat)} title={chat.title}>
                    <MessageSquare size={15} />
                    <span>{chat.title}</span>
                  </button>
                  <button className="chat-history-delete" aria-label={`Delete ${chat.title}`} title="Delete chat" onClick={() => deleteSavedChat(chat.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="sidebar-bottom">
          <div className="security-note">
            <ShieldCheck size={16} />

            <div>
              <span>Privacy comes first</span>
              <p>Your files stay in your workspace.</p>
            </div>
          </div>

          <div className="profile-row">
            <button
              type="button"
              className="avatar"
              aria-label="Open personal information"
              title="Personal information"
              onClick={() => { setProfileError(''); setActiveView('profile'); setMobileSidebarOpen(false) }}
            >
              {(currentUser?.name?.trim()?.[0] || currentUser?.email?.[0] || 'U').toUpperCase()}
            </button>

            <button
              type="button"
              className="profile-info"
              onClick={() => { setProfileError(''); setActiveView('profile'); setMobileSidebarOpen(false) }}
              style={{ textAlign: 'left', background: 'transparent', border: 0, cursor: 'pointer', minWidth: 0 }}
            >
              <span>{currentUser?.name || 'My Workspace'}</span>
              <span className="muted-small">{currentUser?.email || 'Personal assistant'}</span>
            </button>

            <button
              type="button"
              className="tiny-icon-button"
              aria-label="Personal information and logout"
              title="Personal information and logout"
              onClick={() => { setProfileError(''); setActiveView('profile'); setMobileSidebarOpen(false) }}
            >
              <Settings2 size={17} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main panel */}
      <section className="main-panel">
        
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobileSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>

            <div className="breadcrumb">
              <strong>
                {activeView === 'chat'
                  ? (chatStarted ? 'Conversation' : 'New conversation')
                  : 'Documents'}
              </strong>
            </div>
          </div>

          <div className="topbar-status">
            <button
              className="icon-button topbar-settings"
              aria-label="Settings"
            >
              <Settings2 size={18} />
            </button>
          </div>
        </header>


        {activeView === 'chat' ? (
          <div className={`welcome-layout ${chatStarted ? 'chat-started' : 'chat-welcome'}`}>
            {welcomeVisible && (
              <div className={`welcome-content ${welcomeExiting ? 'welcome-content-exit' : 'welcome-content-enter'}`}>
              <div className="welcome-eyebrow">
                <span className="eyebrow-sparkle">
                  <Sparkles size={13} />
                </span>

                YOUR PERSONAL KNOWLEDGE SPACE
              </div>

              <div className="hero-heading">
                <div className="hero-logo-wrap">
                  <IrisLogo />
                  <span className="orbit orbit-one" />
                  <span className="orbit orbit-two" />
                </div>

                <h1>
                  Welcome to <span>IRIS</span>
                </h1>

                <p className="hero-subtitle">
                  Your Knowledge, Connected.
                </p>

                <p className="hero-description">
                  Your documents hold the answers. Let's find them together.
                  Ask questions, uncover insights, and get answers backed by
                  your own sources.
                </p>
              </div>

              <div className="suggestions-heading">
                <div>
                  <span className="suggestions-title">
                    What would you like to explore?
                  </span>

                  <span className="suggestions-subtitle">
                    Start with an idea, your documents will provide the context.
                  </span>
                </div>

                <Sparkles
                  size={17}
                  className="suggestions-sparkle"
                />
              </div>

              <div className="suggestion-grid">
                {suggestions.map((item) => {
                  const Icon = item.icon

                  return (
                    <button
                      className="suggestion-card"
                      key={item.title}
                      onClick={() => chooseSuggestion(item.prompt)}
                    >
                      <span className="suggestion-icon">
                        <Icon size={19} />
                      </span>

                      <span className="suggestion-card-title">
                        {item.title}
                      </span>

                      <span className="suggestion-card-description">
                        {item.description}
                      </span>

                      <span className="suggestion-arrow">
                        <ArrowUp size={15} />
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="upload-banner">
                <div className="upload-banner-icon">
                  <Upload size={21} />
                </div>

                <div className="upload-banner-copy">
                  <strong>Bring your knowledge into IRIS</strong>

                  <span>
                    Upload PDFs, Word documents, or text files to get started.
                  </span>
                </div>

                <button
                  className="secondary-button"
                  onClick={openUpload}
                >
                  Add documents <ArrowDown size={15} />
                </button>
              </div>

              <div className="trust-row">
                <span>
                  <ShieldCheck size={14} />
                  Answers grounded in your files
                </span>

                <span className="trust-divider" />

                <span>
                  <FileText size={14} />
                  Page-level citations
                </span>

                <span className="trust-divider" />

                <span>
                  <Activity size={14} />
                  Built for your workflow
                </span>
              </div>
              </div>
            )}

            {chatStarted && (
              
                      <div
                        className="conversation-view"
                        role="log"
                        aria-live="polite"
                        aria-label="Conversation messages"
                      >
                        {messages.map((chatMessage) => (
                          <article
                            className={`chat-message chat-message-${chatMessage.role}`}
                            key={chatMessage.id}
                          >
                            <div className="chat-message-role">
                              {chatMessage.role === 'user' ? 'You' : 'IRIS'}
                            </div>

                            <div className="chat-message-content">
                              {chatMessage.role === 'assistant' ? (
                                <TypewriterMarkdown
                                  key={chatMessage.id}
                                  text={chatMessage.content.replace(/\\(?=\s*$)/gm, '')}
                                />
                              ) : (
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm]}
                                  components={{
                                    a: ({ href, children, ...props }) => (
                                      <a href={href} target="_blank" rel="noopener noreferrer"{...props}>
                                        {children}</a>),}}>
                                  {chatMessage.content.replace(/\\(?=\s*$)/gm, '')}
                                </ReactMarkdown>
                              )}
                            </div>
                            
                              {chatMessage.sources && chatMessage.sources.length > 0 && (
                                <div className="chat-message-sources chat-sources-header-row">
                                  <div className="chat-sources-heading">
                                    <h3>Sources</h3>
                                  </div>

                                  <div className="chat-sources-details">
                                    {Array.from(
                                      new Map(
                                        chatMessage.sources.map((source) => [
                                          `${source.document_id}-${source.page_number ?? source.location ?? 'unknown'}`,
                                          source,
                                        ])
                                      ).values()
                                    ).map((source) => (
                                      <div
                                        className="chat-source-inline"
                                        key={`${source.document_id}-${source.page_number ?? source.location ?? 'unknown'}`}
                                      >
                                        <span className="chat-source-name" title={source.document_name}>
                                          {source.document_name}
                                        </span>
                                        <span className="chat-source-location">
                                        | Page {source.page_number ?? source.location ?? '\u2014'}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {chatMessage.web_sources &&
                                chatMessage.web_sources.length > 0 && (
                                  <div className="chat-message-sources chat-web-sources">
                                    <h3>Web Sources</h3>

                                    {chatMessage.web_sources.map((source, index) => (
                                      <div
                                        className="chat-web-source"
                                        key={`${source.url}-${index}`}
                                      >
                                        <a
                                          href={source.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          title={source.url}
                                        >
                                          {source.title || `Web source ${index + 1}`}
                                        </a>
                                      </div>
                                    ))}
                                  </div>
                                )}

                          </article>
                        ))}

                        {asking && (
                          <div className="chat-thinking" role="status">
                            IRIS is thinking and checking your documents&hellip;
                          </div>
                        )}

                        <div
                          className="conversation-bottom-spacer"
                          ref={conversationEndRef}
                        />
                      </div>

            )}

            {/* Chat composer */}
            <div className="chat-composer-wrap">
              {chatError && <p className="chat-error" role="alert">{chatError}</p>}
              {asking && (
                <p role="status">
                  IRIS is searching your documents...
                </p>
              )}

              <form className="chat-composer" onSubmit={handleSubmit}>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === 'Enter' &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault()
                      event.currentTarget.form?.requestSubmit()
                    }
                  }}
                  placeholder="Message IRIS &mdash; ask anything or ask about your documents..."
                  rows={2}
                  aria-label="Message IRIS"
                />

                <div className="composer-footer">
                  
                  <div className="composer-tools">
                    <button
                      type="button"
                      className="composer-tool"
                      onClick={openUpload}
                    >
                      <Paperclip size={16} />
                      <span>Add files</span>
                    </button>

                    <select
                      className="chat-document-select"
                      aria-label="Choose documents for this question"
                      value={selectedDocumentId}
                      disabled={documentsLoading || documents.length === 0}
                      onChange={(event) => setSelectedDocumentId(event.target.value)}
                      title="Choose which documents IRIS should use"
                    >
                      <option value="all">All documents</option>
                      {documents.map((document) => (
                        <option key={document.id} value={String(document.id)}>
                          {document.filename}
                        </option>
                      ))}
                    </select>

                    <select
                      className="chat-document-select"
                      aria-label="Assistant mode"
                      value={assistantMode}
                      disabled={asking}
                      onChange={(event) =>
                        setAssistantMode(event.target.value as AssistantMode)
                      }
                      title="Choose how IRIS should answer"
                    >
                      <option value="smart">Smart Assistant</option>
                      <option value="documents">Documents Only</option>
                    </select>

                    <label className="web-search-toggle">
                      <input
                        type="checkbox"
                        checked={webSearchEnabled}
                        disabled={asking || assistantMode !== 'smart'}
                        onChange={(event) => setWebSearchEnabled(event.target.checked)}
                      />
                      <Search size={16} />
                      <span>Web Search</span>
                    </label>

                    <span className="composer-hint">
                      Shift + Enter for a new line
                    </span>
                  </div>


                  <button
                    type="submit"
                    className="send-button"
                    aria-label="Send message"
                    disabled={!message.trim() || asking}
                  >
                    <ArrowUp size={19} />
                  </button>
                </div>
              </form>
            </div>

          </div>
        ) : (
          /* Documents view */
          <div className="documents-view">
            <div className="documents-header">
              <div>
                <span className="welcome-eyebrow">
                  YOUR KNOWLEDGE LIBRARY
                </span>

                <h1>Documents</h1>

                <p>
                  One home for the files you want to understand.
                </p>
              </div>

              <div className="documents-count">
                <Files size={18} />
                <span>{documents.length} files</span>
              </div>
            </div>

            <div className="document-dropzone">
              <div className="dropzone-icon">
                <Upload size={25} />
              </div>

              <h2>Your knowledge starts here</h2>

              <p>
                Add the documents you want to ask questions about. Your library
                will keep them organized in one place.
              </p>

              <label className="primary-button upload-placeholder">
                <Plus size={17} />
                {uploading ? 'Uploading...' : 'Choose documents'}

                <input
                  type="file"
                  accept=".pdf,.docx,.txt"
                  multiple
                  hidden
                  onChange={(event) => {
                    void handleUpload(event.target.files)
                    event.target.value = ''
                  }}
                />
              </label>
                 {uploading && (
                    <div className="upload-feedback upload-feedback-loading" role="status">
                      <span className="upload-feedback-title">Uploading documents...</span>
                      <span className="upload-feedback-detail">
                        Please wait while IRIS processes your files.
                      </span>
                    </div>
                  )}

                  {uploadMessage && (
                    <div className="upload-feedback upload-feedback-success" role="status">
                      <span className="upload-feedback-title">Upload successful</span>
                      <span className="upload-feedback-detail">{uploadMessage}</span>
                    </div>
                  )}

                  {uploadError && (
                    <div className="upload-feedback upload-feedback-error" role="alert">
                      <span className="upload-feedback-title">Upload failed</span>
                      <span className="upload-feedback-detail">{uploadError}</span>
                    </div>
                  )}
              <span className="supported-formats">
                PDF <i /> DOCX <i /> TXT <i /> Multiple files supported
              </span>
            </div>

            <div className="library-placeholder">
              <div className="library-placeholder-title">
                <div>
                  <h2>Your library</h2>
                  <p>
                    Uploaded documents and their processing status.
                  </p>
                </div>

                <button
                  className="icon-button"
                  aria-label="Search documents"
                >
                  <Search size={18} />
                </button>
              </div>

              {documentsLoading ? (
                <div className="library-empty">
                  <span>Loading documents...</span>
                </div>
              ) : documentsError ? (
                <div className="library-empty">
                  <FolderOpen size={24} />
                  <span>Documents load nahi ho paaye</span>
                  <p>{documentsError}</p>
                </div>
              ) : documents.length === 0 ? (
                <div className="library-empty">
                  <FolderOpen size={24} />
                  <span>No documents yet</span>
                  <p>Files you add will appear here.</p>
                </div>
              ) : (
                <div className="document-library-list">
                  {documentDeleteError && (
                    <div className="upload-feedback upload-feedback-error" role="alert">
                      {documentDeleteError}
                    </div>
                  )}
                  {documents.map((document) => (
                    <div className="document-library-row" key={document.id}>
                      <FileText size={20} aria-hidden="true" />
                      <div className="document-library-details">
                        <strong title={document.filename}>{document.filename}</strong>
                        <p>{(document.file_size / 1024).toFixed(1)} KB</p>
                      </div>
                      <button
                        type="button"
                        className="delete-document-button"
                        aria-label={`Delete ${document.filename}`}
                        title="Delete document"
                        disabled={deletingDocumentId === document.id}
                        onClick={() => void handleDeleteDocument(document)}
                      >
                        {deletingDocumentId === document.id ? (
                          <span className="delete-document-loading">&hellip;</span>
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <footer className="app-footer">
          <span>
            IRIS <span className="footer-dot">&middot;</span> Intelligent Retrieval
            &amp; Insight System
          </span>

          <span className="footer-right">
            <span className="status-dot" />
            Private workspace
          </span>
        </footer>
      </section>
    </main>
  )
}





function TypewriterMarkdown({ text }: { text: string }) {
  const [displayedText, setDisplayedText] = useState('')

  useEffect(() => {
    let index = 0
    let timer = 0
    let cancelled = false

    const typeNext = () => {
      if (cancelled) return

      // Smooth typing, with faster output for long answers.
      const step = text.length > 1500 ? 5 : 2
      index = Math.min(index + step, text.length)

      setDisplayedText(text.slice(0, index))

      if (index < text.length) {
        timer = window.setTimeout(typeNext, 12)
      }
    }

    typeNext()

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [text])

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children, ...props }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            {...props}
          >
            {children}
          </a>
        ),
      }}
    >
      {displayedText}
    </ReactMarkdown>
  )
}



export default App

