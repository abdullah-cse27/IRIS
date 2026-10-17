
import { useState } from 'react'
import {
  Activity,
  ArrowDown,
  ArrowUp,
  BookOpen,
  ChevronDown,
  FileText,
  Files,
  FolderOpen,
  History,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'
import './App.css'

function IrisLogo() {
  return (
    <svg viewBox="0 0 64 64" className="iris-logo" fill="none" aria-label="IRIS logo">
      <defs>
        <linearGradient id="iris-gradient" x1="8" y1="8" x2="56" y2="56">
          <stop stopColor="#C4B5FD" />
          <stop offset="1" stopColor="#818CF8" />
        </linearGradient>
      </defs>
      <path
        d="M5 32Q32 5 59 32Q32 59 5 32Z"
        stroke="url(#iris-gradient)"
        strokeWidth="2.5"
      />
      <circle cx="32" cy="32" r="14" stroke="#A78BFA" strokeWidth="2" />
      <circle cx="32" cy="32" r="8" fill="url(#iris-gradient)" />
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

function App() {
  const [message, setMessage] = useState('')
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [activeView, setActiveView] = useState('chat')

  const chooseSuggestion = (prompt: string) => {
    setMessage(prompt)
    setActiveView('chat')
  }

  const openUpload = () => {
    setActiveView('documents')
    setMobileSidebarOpen(false)
  }

  return (
    <main className="iris-app">
      {mobileSidebarOpen && (
        <button
          className="mobile-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      <aside className={`sidebar ${mobileSidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark" title="Intelligent Retrieval & Insight System">
            <IrisLogo />
          </div>
          <div className="brand-copy">
            <span className="brand-name">IRIS</span>
            <span className="brand-full-name">
              Intelligent Retrieval &amp; Insight System
            </span>
            <span className="brand-caption">YOUR KNOWLEDGE, CONNECTED</span>
          </div>
          <button
            className="icon-button sidebar-close"
            aria-label="Close sidebar"
            onClick={() => setMobileSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <button
          className="new-chat-button"
          onClick={() => {
            setActiveView('chat')
            setMessage('')
            setMobileSidebarOpen(false)
          }}
        >
          <Plus size={18} />
          <span>New chat</span>
          <span className="shortcut">↵</span>
        </button>

        <div className="sidebar-nav">
          <button
            className={`nav-item ${activeView === 'chat' ? 'nav-active' : ''}`}
            onClick={() => {
              setActiveView('chat')
              setMobileSidebarOpen(false)
            }}
          >
            <MessageSquare size={17} />
            <span>Chat workspace</span>
          </button>
          <button
            className={`nav-item ${activeView === 'documents' ? 'nav-active' : ''}`}
            onClick={openUpload}
          >
            <Files size={17} />
            <span>Documents</span>
            <span className="nav-count">0</span>
          </button>
        </div>

        <div className="sidebar-section">
          <div className="section-heading">
            <span>YOUR WORKSPACE</span>
            <button className="tiny-icon-button" aria-label="Workspace options">
              <MoreHorizontal size={17} />
            </button>
          </div>
          <div className="workspace-card">
            <div className="workspace-icon">
              <FolderOpen size={17} />
            </div>
            <div className="workspace-info">
              <span>My documents</span>
              <span className="muted-small">Your personal library</span>
            </div>
            <ChevronDown size={15} className="subtle-icon" />
          </div>
        </div>

        <div className="sidebar-section recent-section">
          <div className="section-heading">
            <span>RECENT CHATS</span>
            <History size={15} />
          </div>
          <div className="empty-recent">
            <div className="empty-recent-icon">
              <MessageSquare size={16} />
            </div>
            <span>Your conversations will appear here.</span>
          </div>
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
            <div className="avatar">I</div>
            <div className="profile-info">
              <span>My Workspace</span>
              <span className="muted-small">Personal assistant</span>
            </div>
            <button className="tiny-icon-button" aria-label="Settings">
              <Settings2 size={17} />
            </button>
          </div>
        </div>
      </aside>

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
              <span>Workspace</span>
              <span className="breadcrumb-separator">/</span>
              <strong>
                {activeView === 'chat' ? 'New conversation' : 'Documents'}
              </strong>
            </div>
          </div>
          <div className="topbar-status">
            <span className="status-dot" />
            <span>Workspace ready</span>
            <button className="icon-button topbar-settings" aria-label="Settings">
              <Settings2 size={18} />
            </button>
          </div>
        </header>

        {activeView === 'chat' ? (
          <div className="welcome-layout">
            <div className="welcome-content">
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
                  <span className="suggestions-title">What would you like to explore?</span>
                  <span className="suggestions-subtitle">
                    Start with an idea, your documents will provide the context.
                  </span>
                </div>
                <Sparkles size={17} className="suggestions-sparkle" />
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
                      <span className="suggestion-card-title">{item.title}</span>
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
                <button className="secondary-button" onClick={openUpload}>
                  Add documents <ArrowDown size={15} />
                </button>
              </div>

              <div className="trust-row">
                <span><ShieldCheck size={14} /> Answers grounded in your files</span>
                <span className="trust-divider" />
                <span><FileText size={14} /> Page-level citations</span>
                <span className="trust-divider" />
                <span><Activity size={14} /> Built for your workflow</span>
              </div>
            </div>

            <div className="chat-composer-wrap">
              <form
                className="chat-composer"
                onSubmit={(event) => {
                  event.preventDefault()
                  if (message.trim()) {
                    window.alert(
                      'The chat backend will be connected in a later step. Your message is ready: ' +
                        message.trim(),
                    )
                  }
                }}
              >
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
                  placeholder="Ask anything about your documents..."
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
                    <span className="composer-hint">Shift + Enter for a new line</span>
                  </div>
                  <button
                    type="submit"
                    className="send-button"
                    aria-label="Send message"
                    disabled={!message.trim()}
                  >
                    <ArrowUp size={19} />
                  </button>
                </div>
              </form>
              <p className="composer-disclaimer">
                IRIS answers from your documents. Verify important information
                against the cited sources.
              </p>
            </div>
          </div>
        ) : (
          <div className="documents-view">
            <div className="documents-header">
              <div>
                <span className="welcome-eyebrow">YOUR KNOWLEDGE LIBRARY</span>
                <h1>Documents</h1>
                <p>One home for the files you want to understand.</p>
              </div>
              <div className="documents-count">
                <Files size={18} />
                <span>0 files</span>
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
                Choose documents
                <input
                  type="file"
                  accept=".pdf,.docx,.txt"
                  multiple
                  hidden
                  onChange={() =>
                    window.alert(
                      'The upload backend will be connected in the document-processing step.',
                    )
                  }
                />
              </label>
              <span className="supported-formats">
                PDF <i /> DOCX <i /> TXT <i /> Multiple files supported
              </span>
            </div>

            <div className="library-placeholder">
              <div className="library-placeholder-title">
                <div>
                  <h2>Your library</h2>
                  <p>Uploaded documents and their processing status.</p>
                </div>
                <button className="icon-button" aria-label="Search documents">
                  <Search size={18} />
                </button>
              </div>
              <div className="library-empty">
                <FolderOpen size={24} />
                <span>No documents yet</span>
                <p>Files you add will appear here.</p>
              </div>
            </div>
          </div>
        )}

        <footer className="app-footer">
          <span>IRIS <span className="footer-dot">·</span> Intelligent Retrieval & Insight System</span>
          <span className="footer-right"><span className="status-dot" /> Private workspace</span>
        </footer>
      </section>
    </main>
  )
}

export default App
