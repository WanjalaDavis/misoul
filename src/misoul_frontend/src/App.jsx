import React, { useState, useEffect } from "react";
import { misoul_backend } from "../../declarations/misoul_backend";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import "./index.scss";

// Helper: Detect MIME type based on media kind
const getMimeType = (type) => {
  switch (type) {
    case "Image": return "image/jpeg";
    case "Video": return "video/mp4";
    case "Audio": return "audio/mpeg";
    case "File": return "application/octet-stream";
    default: return "application/octet-stream";
  }
};

const moodColors = {
  Happy: "#4CAF50",
  Sad: "#2196F3",
  Angry: "#F44336",
  Excited: "#FFC107",
  Peaceful: "#9C27B0",
  Neutral: "#607D8B",
  Anxious: "#FF5722",
  Loved: "#E91E63",
  Grateful: "#00BCD4",
  Tired: "#795548"
};

export default function App() {
  const [memoryText, setMemoryText] = useState("");
  const [username, setUsername] = useState("");
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [contentType, setContentType] = useState("Text");
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaDescription, setMediaDescription] = useState("");
  const [activeTab, setActiveTab] = useState("memories");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    document.documentElement.setAttribute(
      "data-bs-theme",
      darkMode ? "dark" : "light"
    );
  }, [darkMode]);

  useEffect(() => {
    if (username.trim()) fetchMemories();
  }, [username]);

  useEffect(() => {
    if (mediaFile) {
      const reader = new FileReader();
      reader.onload = (e) => setMediaPreview(e.target.result);
      
      if (contentType === "Image") {
        reader.readAsDataURL(mediaFile);
      } else {
        setMediaPreview(null);
      }
    } else {
      setMediaPreview(null);
    }
  }, [mediaFile, contentType]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) return;
    setLoading(true);
    setStatus("");

    try {
      let res;
      let content;
      let contentTypeValue;

      switch (contentType) {
        case "Text":
          if (!memoryText.trim()) return;
          content = { Text: memoryText };
          contentTypeValue = { Text: null };
          break;
        case "Image":
        case "Video":
        case "Audio":
        case "File":
          if (!mediaFile || !mediaDescription.trim()) return;
          const arrayBuffer = await mediaFile.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          content = { [contentType]: [Array.from(uint8Array), mediaDescription] };
          contentTypeValue = { [contentType]: null };
          break;
        default:
          return;
      }

      if (editingId !== null) {
        res = await misoul_backend.editMemory(
          editingId,
          memoryText,
          contentTypeValue
        );
        if ("ok" in res) {
          setStatus("✅ Memory updated successfully!");
          setEditingId(null);
        } else {
          setStatus("❌ Error: " + res.err);
        }
      } else {
        res = await misoul_backend.saveMemory(
          username,
          content,
          contentTypeValue
        );

        if ("ok" in res) {
          setStatus("✅ Memory saved successfully!");
        } else {
          setStatus("❌ Error: " + res.err);
        }
      }

      setMemoryText("");
      setMediaFile(null);
      setMediaPreview(null);
      setMediaDescription("");
      await fetchMemories();
    } catch (err) {
      console.error("Error saving/editing memory:", err);
      setStatus("❌ An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchMemories = async () => {
    try {
      const data = await misoul_backend.getMemoriesByUser(username);
      setMemories(data.reverse());
    } catch (err) {
      console.error("Error fetching memories:", err);
      setStatus("❌ Failed to load memories. Please try again.");
    }
  };

  const handleEdit = (memory) => {
    if (memory.contentType.Text !== null) {
      setMemoryText(memory.content.Text);
    } else {
      const contentValue = Object.entries(memory.content)[0][1];
      setMemoryText(contentValue[1]);
    }
    setContentType(Object.keys(memory.contentType)[0]);
    setEditingId(memory.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this memory?")) return;
    try {
      const res = await misoul_backend.deleteMemory(id);
      if ("ok" in res) {
        await fetchMemories();
        setStatus("🗑️ Memory deleted successfully.");
      } else {
        setStatus("❌ Error: " + res.err);
      }
    } catch (err) {
      console.error("Error deleting memory:", err);
      setStatus("❌ Failed to delete memory. Please try again.");
    }
  };

  const formatTimestamp = (ts) => {
    const date = new Date(Number(ts) / 1_000_000);
    return date.toLocaleString();
  };

  const groupByDate = (memories) => {
    return memories.reduce((groups, memory) => {
      const date = new Date(Number(memory.timestamp) / 1_000_000).toDateString();
      if (!groups[date]) groups[date] = [];
      groups[date].push(memory);
      return groups;
    }, {});
  };

  const exportToFile = () => {
    const content = memories
      .map((mem, i) => {
        let contentText;
        if ("Text" in mem.content) {
          contentText = mem.content.Text;
        } else {
          const [contentType, [_, description]] = Object.entries(mem.content)[0];
          contentText = `[${contentType}: ${description}]`;
        }
        return `Memory ${i + 1}\n${formatTimestamp(mem.timestamp)}\n${contentText}\nMood: ${mem.mood}\n\n`;
      })
      .join("");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${username}_memories_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
  };

  const shareMemory = async (memory) => {
    try {
      let shareData = {
        title: "My Memory from MindVerse",
        text: ""
      };

      if ("Text" in memory.content) {
        shareData.text = memory.content.Text;
      } else {
        const [contentType, [_, description]] = Object.entries(memory.content)[0];
        shareData.text = `Check out my ${contentType.toLowerCase()} memory: ${description}`;
        
        // For images, we can include the image in the share
        if (contentType === "Image") {
          const blob = new Blob([new Uint8Array(memory.content[contentType][0])], {
            type: getMimeType(contentType)
          });
          const file = new File([blob], 'memory-image.jpg', { type: blob.type });
          shareData.files = [file];
        }
      }

      if (navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        // Fallback for browsers that don't support sharing files
        await navigator.share({
          title: shareData.title,
          text: shareData.text
        });
      }
    } catch (err) {
      console.error('Error sharing:', err);
      alert("Sharing failed or was cancelled. You can copy the content manually.");
    }
  };

  const filteredMemories = memories.filter(memory => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    
    // Search in text content
    if ("Text" in memory.content && memory.content.Text.toLowerCase().includes(searchLower)) {
      return true;
    }
    
    // Search in media descriptions
    if (!("Text" in memory.content)) {
      const description = memory.content[Object.keys(memory.content)[0]][1];
      if (description.toLowerCase().includes(searchLower)) {
        return true;
      }
    }
    
    // Search in mood
    if (memory.mood && memory.mood.toLowerCase().includes(searchLower)) {
      return true;
    }
    
    // Search in summary
    if (memory.summary && memory.summary.toLowerCase().includes(searchLower)) {
      return true;
    }
    
    return false;
  });

  const grouped = groupByDate(filteredMemories);

  const moodCounts = filteredMemories.reduce((acc, mem) => {
    acc[mem.mood] = (acc[mem.mood] || 0) + 1;
    return acc;
  }, {});

  const chartData = Object.entries(moodCounts)
    .map(([mood, count]) => ({
      name: mood,
      value: count,
      color: moodColors[mood] || '#607D8B'
    }))
    .sort((a, b) => b.value - a.value);

  const renderMemoryContent = (memory) => {
    const content = memory.content;
    const type = Object.keys(content)[0];

    if (type === "Text") {
      return (
        <div className="memory-text-content">
          <p>{content.Text}</p>
        </div>
      );
    }

    const [bytes, description] = content[type];
    const blob = new Blob([new Uint8Array(bytes)], {
      type: getMimeType(type)
    });
    const url = URL.createObjectURL(blob);

    switch (type) {
      case "Image":
        return (
          <div className="memory-media-content">
            <div className="media-container">
              <img 
                src={url} 
                alt={description} 
                className="memory-image"
                loading="lazy"
              />
            </div>
            <p className="media-description">{description}</p>
          </div>
        );

      case "Video":
        return (
          <div className="memory-media-content">
            <div className="media-container">
              <video 
                controls 
                className="memory-video"
                poster={url + '#t=0.5'}
              >
                <source src={url} type={getMimeType("Video")} />
                Your browser does not support the video tag.
              </video>
            </div>
            <p className="media-description">{description}</p>
          </div>
        );

      case "Audio":
        return (
          <div className="memory-media-content">
            <div className="media-container audio-container">
              <audio controls className="memory-audio">
                <source src={url} type={getMimeType("Audio")} />
                Your browser does not support the audio element.
              </audio>
            </div>
            <p className="media-description">{description}</p>
          </div>
        );

      case "File":
        return (
          <div className="memory-media-content">
            <div className="media-container file-container">
              <a 
                href={url} 
                download={`memory-file-${memory.id}`}
                className="btn btn-outline-primary file-download"
              >
                <i className="bi bi-file-earmark-arrow-down"></i> Download File
              </a>
            </div>
            <p className="media-description">{description}</p>
          </div>
        );

      default:
        return <p>Unsupported content type</p>;
    }
  };

  return (
    <div className={`app-container ${darkMode ? "dark-mode" : ""}`}>
      <header className="app-header">
        <div className="container">
          <h1 className="app-title">MindVerse Memory Vault</h1>
          <p className="app-subtitle">Preserve your thoughts, moments, and emotions</p>
        </div>
      </header>

      <main className="container main-content">
        <div className="row">
          <div className="col-lg-4">
            <div className={`sidebar ${darkMode ? "dark-sidebar" : ""}`}>
              <div className="user-section mb-4">
                <h5>Your Profile</h5>
                <input
                  type="text"
                  placeholder="Enter your username"
                  className="form-control mb-3"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
                
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <button 
                    className={`btn ${darkMode ? "btn-light" : "btn-dark"}`}
                    onClick={() => setDarkMode(!darkMode)}
                  >
                    {darkMode ? (
                      <>
                        <i className="bi bi-sun-fill"></i> Light Mode
                      </>
                    ) : (
                      <>
                        <i className="bi bi-moon-fill"></i> Dark Mode
                      </>
                    )}
                  </button>
                  
                  {username && (
                    <button 
                      className="btn btn-outline-secondary"
                      onClick={fetchMemories}
                    >
                      <i className="bi bi-arrow-clockwise"></i> Refresh
                    </button>
                  )}
                </div>
              </div>

              {username && (
                <div className="stats-section">
                  <h5>Your Stats</h5>
                  <div className="stats-grid">
                    <div className="stat-card">
                      <div className="stat-value">{memories.length}</div>
                      <div className="stat-label">Total Memories</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">
                        {new Set(memories.map(m => new Date(Number(m.timestamp) / 1_000_000).toDateString())).size}
                      </div>
                      <div className="stat-label">Days Recorded</div>
                    </div>
                  </div>
                  
                  {chartData.length > 0 && (
                    <div className="mood-chart-container">
                      <h6>Mood Distribution</h6>
                      <div className="mood-chart">
                        <ResponsiveContainer width="100%" height={200}>
                          <PieChart>
                            <Pie
                              data={chartData}
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              innerRadius={40}
                              paddingAngle={2}
                              dataKey="value"
                              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            >
                              {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip 
                              formatter={(value, name, props) => [
                                value, 
                                `${name} (${(props.payload.percent * 100).toFixed(1)}%)`
                              ]}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="col-lg-8">
            <div className={`main-panel ${darkMode ? "dark-panel" : ""}`}>
              {username ? (
                <>
                  <nav className="nav-tabs mb-4">
                    <button
                      className={`nav-tab ${activeTab === "memories" ? "active" : ""}`}
                      onClick={() => setActiveTab("memories")}
                    >
                      <i className="bi bi-journal-bookmark"></i> Memories
                    </button>
                    <button
                      className={`nav-tab ${activeTab === "new" ? "active" : ""}`}
                      onClick={() => setActiveTab("new")}
                    >
                      <i className="bi bi-plus-circle"></i> New Memory
                    </button>
                  </nav>

                  {activeTab === "new" && (
                    <div className="memory-form-container">
                      <form onSubmit={handleSubmit} className="memory-form">
                        <div className="form-group mb-3">
                          <label className="form-label">Memory Type</label>
                          <div className="content-type-selector">
                            {["Text", "Image", "Video", "Audio", "File"].map((type) => (
                              <button
                                key={type}
                                type="button"
                                className={`type-option ${contentType === type ? "active" : ""}`}
                                onClick={() => {
                                  setContentType(type);
                                  setMediaFile(null);
                                  setMediaPreview(null);
                                }}
                              >
                                <i className={`bi bi-${
                                  type === "Text" ? "card-text" :
                                  type === "Image" ? "image" :
                                  type === "Video" ? "film" :
                                  type === "Audio" ? "mic" : "file-earmark"
                                }`}></i> {type}
                              </button>
                            ))}
                          </div>
                        </div>

                        {contentType === "Text" ? (
                          <div className="form-group mb-3">
                            <label className="form-label">Your Memory</label>
                            <textarea
                              className="form-control memory-textarea"
                              rows="5"
                              placeholder="Write your thoughts, feelings, or experiences here..."
                              value={memoryText}
                              onChange={(e) => setMemoryText(e.target.value)}
                              required
                            />
                          </div>
                        ) : (
                          <>
                            <div className="form-group mb-3">
                              <label className="form-label">Upload {contentType}</label>
                              <div className="file-upload-area">
                                <input
                                  type="file"
                                  accept={`${contentType.toLowerCase()}/*`}
                                  className="form-control"
                                  onChange={(e) => setMediaFile(e.target.files[0])}
                                  required
                                />
                                {mediaPreview && contentType === "Image" && (
                                  <div className="media-preview">
                                    <img src={mediaPreview} alt="Preview" className="upload-preview" />
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="form-group mb-3">
                              <label className="form-label">Description</label>
                              <input
                                type="text"
                                className="form-control"
                                placeholder={`Describe this ${contentType.toLowerCase()}...`}
                                value={mediaDescription}
                                onChange={(e) => setMediaDescription(e.target.value)}
                                required
                              />
                            </div>
                          </>
                        )}

                        <div className="form-actions">
                          <button 
                            type="submit" 
                            className="btn btn-primary save-button"
                            disabled={loading}
                          >
                            {loading ? (
                              <>
                                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                {editingId !== null ? " Updating..." : " Saving..."}
                              </>
                            ) : editingId !== null ? (
                              <>
                                <i className="bi bi-check-circle"></i> Update Memory
                              </>
                            ) : (
                              <>
                                <i className="bi bi-save"></i> Save Memory
                              </>
                            )}
                          </button>
                          
                          {editingId !== null && (
                            <button
                              type="button"
                              className="btn btn-outline-secondary cancel-button"
                              onClick={() => {
                                setEditingId(null);
                                setMemoryText("");
                                setMediaFile(null);
                                setMediaPreview(null);
                                setMediaDescription("");
                              }}
                            >
                              <i className="bi bi-x-circle"></i> Cancel
                            </button>
                          )}
                        </div>

                        {status && (
                          <div className={`status-message ${status.includes("✅") ? "success" : "error"}`}>
                            {status}
                          </div>
                        )}
                      </form>
                    </div>
                  )}

                  {activeTab === "memories" && (
                    <div className="memories-container">
                      <div className="memories-header">
                        <h3>Your Memories</h3>
                        <div className="memories-controls">
                          <div className="search-box">
                            <i className="bi bi-search"></i>
                            <input
                              type="text"
                              placeholder="Search memories..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                            />
                          </div>
                          <button 
                            className="btn btn-outline-success export-button"
                            onClick={exportToFile}
                          >
                            <i className="bi bi-download"></i> Export
                          </button>
                        </div>
                      </div>

                      {Object.keys(grouped).length === 0 ? (
                        <div className="empty-state">
                          <i className="bi bi-journal-x"></i>
                          <p>No memories found. Start by adding a new memory!</p>
                        </div>
                      ) : (
                        <div className="memory-timeline">
                          {Object.entries(grouped).map(([date, items]) => (
                            <div key={date} className="memory-day-group">
                              <div className="memory-day-header">
                                <h5>{new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</h5>
                              </div>
                              <div className="memory-items">
                                {items.map((mem) => (
                                  <div 
                                    key={mem.id} 
                                    className={`memory-card ${darkMode ? "dark-card" : ""}`}
                                    style={{ borderLeft: `4px solid ${moodColors[mem.mood] || '#607D8B'}`}}
                                  >
                                    <div className="memory-content">
                                      {renderMemoryContent(mem)}
                                    </div>
                                    
                                    <div className="memory-meta">
                                      <div className="memory-mood">
                                        <span className="mood-badge" style={{ backgroundColor: moodColors[mem.mood] || '#607D8B' }}>
                                          {mem.mood || "Neutral"}
                                        </span>
                                      </div>
                                      <div className="memory-time">
                                        <i className="bi bi-clock"></i> {formatTimestamp(mem.timestamp)}
                                      </div>
                                    </div>
                                    
                                    {mem.summary && (
                                      <div className="memory-summary">
                                        <strong>Summary:</strong> {mem.summary}
                                      </div>
                                    )}
                                    
                                    <div className="memory-actions">
                                      <button 
                                        className="btn btn-sm btn-outline-primary action-btn text-dark"
                                        onClick={() => shareMemory(mem)}
                                        title="Share"
                                      >
                                        <i className="bi bi-share"></i>
                                      </button>
                                      <button 
                                        className="btn btn-sm btn-outline-warning action-btn text-dark"
                                        onClick={() => handleEdit(mem)}
                                        title="Edit"
                                      >
                                        <i className="bi bi-pencil"></i>
                                      </button>
                                      <button 
                                        className="btn btn-sm btn-outline-danger action-btn text-dark"
                                        onClick={() => handleDelete(mem.id)}
                                        title="Delete"
                                      >
                                        <i className="bi bi-trash"></i>
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="welcome-screen">
                  <div className="welcome-content">
                    <h2>Welcome to MindVerse</h2>
                    <p>Your personal memory vault to preserve thoughts, moments, and emotions.</p>
                    <div className="features-grid">
                      <div className="feature">
                        <i className="bi bi-journal-text"></i>
                        <h4>Journal Your Thoughts</h4>
                        <p>Record your daily experiences and reflections.</p>
                      </div>
                      <div className="feature">
                        <i className="bi bi-images"></i>
                        <h4>Capture Moments</h4>
                        <p>Save images, videos, and audio to remember special times.</p>
                      </div>
                      <div className="feature">
                        <i className="bi bi-graph-up"></i>
                        <h4>Track Your Mood</h4>
                        <p>Visualize your emotional patterns over time.</p>
                      </div>
                    </div>
                    <div className="welcome-instruction">
                      <p>To get started, enter a username above and begin creating memories!</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

 <footer className="app-footer">
  <div className="container">
    <div className="footer-content">
      <div className="footer-brand">
        <div className="logo-mark">
          <svg viewBox="0 0 24 24" width="32" height="32">
            <path fill="currentColor" d="M12,2C6.48,2,2,6.48,2,12s4.48,10,10,10s10-4.48,10-10S17.52,2,12,2z M12,20c-4.41,0-8-3.59-8-8s3.59-8,8-8s8,3.59,8,8S16.41,20,12,20z M15,13h-2v2h-2v-2H9v-2h2V9h2v2h2V13z"/>
          </svg>
        </div>
        <div className="brand-text">
          <h3>MindVerse Memory Vault</h3>
          <p className="tagline">Global Digital Preservation</p>
        </div>
      </div>
      
      <div className="footer-links">
        <div className="link-group">
          <h4>Product</h4>
          <ul>
            <li><a href="#">Features</a></li>
            <li><a href="#">Pricing</a></li>
            <li><a href="#">API</a></li>
            <li><a href="#">Integrations</a></li>
          </ul>
        </div>
        
        <div className="link-group">
          <h4>Resources</h4>
          <ul>
            <li><a href="#">Documentation</a></li>
            <li><a href="#">Community</a></li>
            <li><a href="#">Tutorials</a></li>
            <li><a href="#">Support</a></li>
          </ul>
        </div>
        
        <div className="link-group">
          <h4>Company</h4>
          <ul>
            <li><a href="#">About</a></li>
            <li><a href="#">Blog</a></li>
            <li><a href="#">Careers</a></li>
            <li><a href="#">Contact</a></li>
          </ul>
        </div>
      </div>
      
      <div className="footer-cta">
        <h4>Join Our Global Community</h4>
        <div className="newsletter-form">
          <input type="email" placeholder="Your email address" />
          <button className="subscribe-btn">
            <span>Subscribe</span>
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M5,13l4,4l10-10l-1.4-1.4L9,14.2L6.4,11.6L5,13z"/>
            </svg>
          </button>
        </div>
        <div className="social-links">
          <a href="#" aria-label="Twitter">
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M22.46,6c-0.77,0.35-1.6,0.58-2.46,0.69c0.88-0.53,1.56-1.37,1.88-2.38c-0.83,0.5-1.75,0.85-2.72,1.05C18.37,4.5,17.26,4,16,4c-2.35,0-4.27,1.92-4.27,4.29c0,0.34,0.04,0.67,0.11,0.98C8.28,9.09,5.11,7.38,3,4.79c-0.37,0.63-0.58,1.37-0.58,2.15c0,1.49,0.75,2.81,1.91,3.56c-0.71,0-1.37-0.2-1.95-0.5v0.03c0,2.08,1.48,3.82,3.44,4.21c-0.36,0.1-0.74,0.15-1.13,0.15c-0.27,0-0.54-0.03-0.8-0.08c0.54,1.69,2.11,2.92,3.97,2.95c-1.45,1.16-3.28,1.84-5.27,1.84c-0.34,0-0.68-0.02-1.02-0.06C3.44,20.29,5.7,21,8.12,21C16,21,20.33,14.46,20.33,8.79c0-0.19,0-0.37-0.01-0.56C21.27,7.69,21.94,6.91,22.46,6z"/>
            </svg>
          </a>
          <a href="#" aria-label="GitHub">
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M12,2A10,10 0 0,0 2,12C2,16.42 4.87,20.17 8.84,21.5C9.34,21.58 9.5,21.27 9.5,21C9.5,20.77 9.5,20.14 9.5,19.31C6.73,19.91 6.14,17.97 6.14,17.97C5.68,16.81 5.03,16.5 5.03,16.5C4.12,15.88 5.1,15.9 5.1,15.9C6.1,15.97 6.63,16.93 6.63,16.93C7.5,18.45 8.97,18 9.54,17.76C9.63,17.11 9.89,16.67 10.17,16.42C7.95,16.17 5.62,15.31 5.62,11.5C5.62,10.39 6,9.5 6.65,8.79C6.55,8.54 6.2,7.5 6.75,6.15C6.75,6.15 7.59,5.88 9.5,7.17C10.29,6.95 11.15,6.84 12,6.84C12.85,6.84 13.71,6.95 14.5,7.17C16.41,5.88 17.25,6.15 17.25,6.15C17.8,7.5 17.45,8.54 17.35,8.79C18,9.5 18.38,10.39 18.38,11.5C18.38,15.32 16.04,16.16 13.81,16.41C14.17,16.72 14.5,17.33 14.5,18.26C14.5,19.6 14.5,20.68 14.5,21C14.5,21.27 14.66,21.59 15.17,21.5C19.14,20.17 22,16.42 22,12A10,10 0 0,0 12,2Z"/>
            </svg>
          </a>
          <a href="#" aria-label="LinkedIn">
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M19,3A2,2 0 0,1 21,5V19A2,2 0 0,1 19,21H5A2,2 0 0,1 3,19V5A2,2 0 0,1 5,3H19M18.5,18.5V13.2A3.26,3.26 0 0,0 15.24,9.94C14.39,9.94 13.4,10.46 12.92,11.24V10.13H10.13V18.5H12.92V13.57C12.92,12.8 13.54,12.17 14.31,12.17A1.4,1.4 0 0,1 15.71,13.57V18.5H18.5M6.88,8.56A1.68,1.68 0 0,0 8.56,6.88C8.56,5.95 7.81,5.19 6.88,5.19A1.69,1.69 0 0,0 5.19,6.88C5.19,7.81 5.95,8.56 6.88,8.56M8.27,18.5V10.13H5.5V18.5H8.27Z"/>
            </svg>
          </a>
          <a href="#" aria-label="Instagram">
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M7.8,2H16.2C19.4,2 22,4.6 22,7.8V16.2A5.8,5.8 0 0,1 16.2,22H7.8C4.6,22 2,19.4 2,16.2V7.8A5.8,5.8 0 0,1 7.8,2M7.6,4A3.6,3.6 0 0,0 4,7.6V16.4C4,18.39 5.61,20 7.6,20H16.4A3.6,3.6 0 0,0 20,16.4V7.6C20,5.61 18.39,4 16.4,4H7.6M17.25,5.5A1.25,1.25 0 0,1 18.5,6.75A1.25,1.25 0 0,1 17.25,8A1.25,1.25 0 0,1 16,6.75A1.25,1.25 0 0,1 17.25,5.5M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9Z"/>
            </svg>
          </a>
        </div>
      </div>
    </div>
    
    <div className="footer-bottom">
      <p>&copy; {new Date().getFullYear()} MindVerse Memory Vault. All rights reserved.</p>
      <div className="legal-links">
        <a href="#">Terms of Service</a>
        <span>•</span>
        <a href="#">Privacy Policy</a>
        <span>•</span>
        <a href="#">Cookie Policy</a>
        <span>•</span>
        <a href="#">GDPR</a>
      </div>
      <p className="tagline">Preserving memories across {Math.floor(Math.random() * 50) + 150} countries worldwide</p>
    </div>
  </div>
</footer>
    </div>
  );
}