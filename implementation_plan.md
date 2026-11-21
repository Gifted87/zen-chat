# Product Specification Document: Zen Web Application

**Product Name:** Zen  
**Document Type:** Functional Product Specification  
**Target Platform:** Web Browser (Desktop & Mobile Web)  
**Scope:** Core Chat, Multimodal Capabilities, Canvas Workspace, and Chat History & Organization  

---

## 1. Overview & Objectives
**Zen** is an intelligent conversational AI platform. This document defines the functional behavior, user interactions, and operational rules for Zen’s core conversation engine, multimodal tooling, interactive artifact workspace (Canvas), and conversation management system.

---

## 2. Core Chat & Model Controls

### 2.1 Model Selection & Switching
* **Functionality:** Users can select which underlying AI model powers their session via a selector at the top of the chat view.
* **Behavior:**
  * **Mid-Thread Switching:** Users may switch models at any point in an ongoing conversation. Subsequent messages will use the newly selected model while retaining the preceding message history as context.
  * **Default Selection:** The application remembers the user's last-used model preference across browser sessions.
  * **Model Capability Indicators:** The selector displays clear capability tags next to each model (e.g., *Fast*, *Complex Reasoning*, *Vision-Enabled*).

### 2.2 Message Streaming & Output Rendering
* **Functionality:** Assistant responses stream into the interface in real time (character/token by token) rather than waiting for full generation.
* **Behavior:**
  * **Rich Text Rendering:** Supports Markdown parsing, including headers, bold/italics, bulleted/numbered lists, blockquotes, and tables.
  * **Code Blocks:** Automatically detects programming languages, applies syntax highlighting, displays line numbers, and includes a persistent **"Copy Code"** button.
  * **Math & Formulas:** Renders LaTeX equations inline (`$...$`) and as standalone display blocks (`$$...$$`).
  * **Stop Generation:** While streaming, the input button changes to a **"Stop"** button. Clicking it immediately halts model output, retaining whatever text was generated up to that point.

### 2.3 Message Editing & Conversation Branching
* **Functionality:** Users can edit any previously sent user message in a chat.
* **Behavior:**
  * **Forking:** Editing a past message does not overwrite the original history. Instead, it creates a new branch (e.g., `Branch 2 of 2`).
  * **Branch Navigation:** Pagination controls (`< 1/2 >`) appear on the edited message and all subsequent assistant responses, allowing the user to flip back and forth between conversation paths at any time.
  * **Re-triggering:** Saving an edited prompt automatically triggers a fresh response generation for that branch.

### 2.4 Response Regeneration & Comparison
* **Functionality:** Users can regenerate the assistant's latest response.
* **Behavior:**
  * **Re-roll:** Triggers a new attempt using the current model without modifying the user prompt.
  * **Switch & Compare:** Users can choose to regenerate using a *different* model to directly compare outputs side-by-side or sequentially via branch navigation controls.

### 2.5 Audio Playback (Read Aloud)
* **Functionality:** Users can listen to any generated text response via text-to-speech (TTS).
* **Behavior:**
  * Clicking **"Read Aloud"** begins speech playback.
  * Provides Play, Pause, Scrub bar, and Playback Speed controls (1x, 1.25x, 1.5x, 2x).
  * Automatically skips or simplifies verbose code blocks or raw data dumps during audio playback to maintain natural listening flow.

### 2.6 Feedback & Interaction Actions
* **Functionality:** Quick-action utility controls attached to every assistant response.
* **Behavior:**
  * **Copy Message:** Copies the raw markdown or plain text to the clipboard.
  * **Thumbs Up / Thumbs Down:** Allows users to rate response quality. Clicking "Thumbs Down" opens an optional modal to collect granular feedback (e.g., *Factually incorrect*, *Did not follow instructions*, *Harmful/Offensive*).

---

## 3. Multimodal Tools & Capabilities

### 3.1 Real-Time Web Search & Source Citations
* **Functionality:** Automatically detects when real-time or post-cutoff information is required (or when explicitly toggled by the user) to browse the live web.
* **Behavior:**
  * **Inline Citations:** Facts retrieved from the web display numerical pill badges (e.g., `[1]`, `[2]`).
  * **Source Tray:** Hovering over a badge displays a preview card with the source title, domain, and snippet. Clicking opens the source in a new browser tab.
  * **Source List:** A collapsible drawer or footer list at the bottom of the message compiles all referenced URLs.

### 3.2 Document & File Ingestion
* **Functionality:** Users can attach documents (PDF, DOCX, CSV, TXT, JSON, etc.) to a chat via drag-and-drop or file picker.
* **Behavior:**
  * **Extraction & Indexing:** Zen parses and indexes the text content for question answering, summarization, or comparison.
  * **Multi-File Context:** Multiple files can be attached in a single message.
  * **Progress States:** Clear visual indicators for upload progress, parsing status, and file errors (e.g., file size limits, password-protected PDFs).

### 3.3 Vision & Image Understanding
* **Functionality:** Users can upload images (PNG, JPG, WEBP) for visual analysis.
* **Behavior:**
  * Supports tasks such as OCR (reading text from screenshots), diagram interpretation, error diagnosis from UI screenshots, and general visual querying.
  * Users can upload multiple images simultaneously to ask for visual comparisons or sequential analysis.

### 3.4 In-Chat Image Generation & Iteration
* **Functionality:** Users can generate images directly from natural language prompts.
* **Behavior:**
  * **Generation:** Model generates high-resolution images inline within the chat stream.
  * **Iterative Modification:** Users can request modifications to a previously generated image (e.g., *"Make the background sunny"*, *"Change the jacket to red"*), and the system maintains visual consistency across iterations.
  * **Image Actions:** Options to download full-resolution assets, zoom/expand in a lightbox view, or copy to clipboard.

### 3.5 Sandboxed Code Execution & Data Analysis
* **Functionality:** The system can write and execute code (e.g., Python) in an isolated sandbox environment to process data and solve computational tasks.
* **Behavior:**
  * **Automated Invocation:** Triggers automatically for data manipulation, mathematical computation, and file transformation tasks.
  * **Visual Code View:** Users can toggle open a "View Code" drawer to inspect the exact script that ran and its standard output/error stream.
  * **Data Visualizations:** Interactive charts, graphs, and modified output files (e.g., edited CSVs) are rendered inline and made available for direct download.

### 3.6 Voice Input (Speech-to-Text)
* **Functionality:** Allows dictating prompts using the device's microphone.
* **Behavior:**
  * Real-time audio streaming converts speech into text in the input box.
  * Supports automatic punctuation and multilingual speech detection.
  * Users can review and edit transcribed text before submitting the message.

---

## 4. Canvas & Interactive Workspace

### 4.1 Activation & Dual-Pane Layout
* **Functionality:** A side-by-side workspace that opens for complex writing, editing, and coding tasks.
* **Behavior:**
  * **Triggering:** Opens automatically when generating long-form documents/code, or manually via a prompt command / UI toggle.
  * **Layout:** The left pane houses the standard conversational chat; the right pane displays the active Canvas document.
  * **Independent Scrolling:** Both panes scroll independently without disrupting the user's viewport.

### 4.2 Document & Text Editing Mode
* **Functionality:** A rich text editor for drafting essays, reports, emails, and documentation.
* **Behavior:**
  * **Direct User Editing:** Users can type, delete, reformat, and edit the Canvas document directly like a word processor.
  * **AI Co-Writing:** The user can ask the AI in the chat pane to rewrite or expand specific sections of the Canvas document.

### 4.3 Code Editing Mode
* **Functionality:** A specialized editor for programming and scripts.
* **Behavior:**
  * Full syntax highlighting, indentation support, and language autodetection.
  * Users can edit code manually or instruct Zen to modify specific functions or logic blocks.

### 4.4 In-line AI Targeting & Selection Prompts
* **Functionality:** Targeted manipulation of specific text or code within the Canvas.
* **Behavior:**
  * When a user highlights a phrase, paragraph, or code snippet in the Canvas, a floating action menu appears.
  * **Ask Zen:** Allows typing a targeted instruction (e.g., *"Make this sound more persuasive"* or *"Refactor this into an async function"*).
  * Only the selected portion is modified by the AI; the rest of the document remains untouched.

### 4.5 Quick-Action Toolbars
* **Functionality:** One-click automated transformations tailored to the active Canvas content type.
* **Behavior:**
  * **Writing Quick Actions:**
    * *Adjust Reading Level:* Slider/presets (e.g., Elementary, High School, Executive, Academic).
    * *Adjust Length:* Make shorter / Expand.
    * *Add Polish:* Improve grammar, flow, and tone consistency.
    * *Add Emojis:* Embellish text with relevant emojis.
  * **Coding Quick Actions:**
    * *Add Comments / Documentation:* Inserts docstrings and line-level explanations.
    * *Add Logs:* Injects debug logging statements throughout the code.
    * *Fix Bugs:* Automatically scans the snippet for errors and proposes fixes.
    * *Port Language:* Port/translate code into another chosen target language (e.g., Python to TypeScript).

### 4.6 Version History & Diff Viewer
* **Functionality:** Tracks all iterative changes made to the Canvas document by both the user and the AI.
* **Behavior:**
  * **Reversion:** Users can step backward and forward through document versions using history arrows (`< Step Back`, `Step Forward >`).
  * **Diff Highlighting:** Shows visual additions (green highlights) and deletions (red strikethroughs) so the user can easily audit what changed between turns.

---

## 5. Chat History & Organization

### 5.1 Persistent History Sidebar & Full-Text Search
* **Functionality:** A left-hand navigation sidebar cataloging past conversations.
* **Behavior:**
  * **Grouping:** Automatically categorizes threads by time (e.g., *Today*, *Yesterday*, *Previous 7 Days*, *Previous 30 Days*, *Older*).
  * **Auto-Titling:** Generates a concise, context-aware title after the first 1–2 message exchanges.
  * **Full-Text Search:** A search bar at the top of the sidebar queries both chat titles and message body contents, filtering results in real time with keyword highlighting.

### 5.2 Thread Lifecycle & Management
* **Functionality:** Complete control over individual conversation threads.
* **Behavior:**
  * **Pinning:** Users can pin critical threads to the top of the sidebar in a dedicated "Pinned" section.
  * **Renaming:** Users can override the automatic title with a custom name.
  * **Archiving:** Moves inactive threads out of the primary sidebar into an "Archived Chats" view without permanently deleting them.
  * **Deletion:** Allows permanent deletion of a single thread or bulk deletion of multiple selected threads, accompanied by a confirmation prompt.

### 5.3 Temporary (Ephemeral) Chat Mode
* **Functionality:** A privacy-centric chat mode that leaves no trace in the user’s account.
* **Behavior:**
  * Does not appear in the sidebar history.
  * Does not use or update persistent cross-chat memory.
  * Automatically purges conversation data once the browser tab/session is closed.

### 5.4 Projects & Workspaces
* **Functionality:** Folder-based workspaces to organize related chats, custom instructions, and assets.
* **Behavior:**
  * **Folder Grouping:** Users can create custom Projects (e.g., *"Q3 Marketing Campaign"*, *"Python Backend Refactor"*).
  * **Project Knowledge & Files:** Files uploaded to a Project workspace are automatically accessible to all chats created inside that Project folder.
  * **Project System Instructions:** Users can define custom instructions that apply exclusively to conversations held within that specific Project.

### 5.5 Shareable Thread Links
* **Functionality:** Allows users to generate public or unlisted read-only links to conversations.
* **Behavior:**
  * **Snapshot Generation:** Creating a share link takes a static snapshot of the chat up to that point. Subsequent private messages added by the owner are not exposed unless explicitly updated.
  * **Recipient Experience:** Viewers can read the formatted thread and click a **"Continue this chat"** button to fork the conversation into their own Zen account.
  * **Link Revocation:** Owners can view all active shared links in their settings and delete/revoke access at any time.

### 5.6 Data Export & Portability
* **Functionality:** Allows users to download their entire conversation history.
* **Behavior:**
  * Users can request a full data export package.
  * The export delivers a structured archive containing conversation transcripts (in JSON and human-readable HTML/Markdown formats) along with all generated media and uploaded assets.
