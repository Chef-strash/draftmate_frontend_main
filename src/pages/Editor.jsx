import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
    Save, Wand2, Download, ChevronLeft, ChevronRight, Send,
    Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
    Subscript, Superscript, List, ListOrdered, Undo, Redo,
    FileDown, FileText, ZoomIn, ZoomOut, Maximize, Trash2, RotateCcw
} from 'lucide-react';
import html2pdf from 'html2pdf.js';
import './Editor.css';

const Editor = () => {
    const location = useLocation();
    const [prompt, setPrompt] = useState(location.state?.prompt || '');
    const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
    const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [activeTab, setActiveTab] = useState('ai');
    const [notes, setNotes] = useState('');
    const [zoomLevel, setZoomLevel] = useState(100);
    const [variablesBold, setVariablesBold] = useState(true);

    const documentRef = useRef(null);
    const mainContainerRef = useRef(null);

    const [placeholders, setPlaceholders] = useState([
        { key: 'client_name', label: 'Client Name', value: '' },
        { key: 'date', label: 'Date', value: new Date().toISOString().split('T')[0] },
        { key: 'court_name', label: 'Court Name', value: '' },
        { key: 'case_number', label: 'Case Number', value: '' },
    ]);
    const [deletedPlaceholders, setDeletedPlaceholders] = useState([]);

    const [chatMessages, setChatMessages] = useState([
        { role: 'ai', content: 'Hello! I am your AI legal assistant. I can help you research case laws, draft clauses, or answer legal queries based on Indian Law.' }
    ]);
    const [chatInput, setChatInput] = useState('');
    const [documentTitle, setDocumentTitle] = useState('Untitled Draft');

    const [debugInfo, setDebugInfo] = useState('');

    // Handle uploaded content and details - enhanced variable detection
    useEffect(() => {
        if (location.state?.htmlContent) {
            let content = location.state.htmlContent;
            const detectedPlaceholders = [];

            // Helper to add placeholder if not exists
            const addPlaceholder = (key, label) => {
                // Use last few words for the key if label is long
                let keyBase = key;
                const words = key.split(/\s+/);
                if (words.length > 5) {
                    keyBase = words.slice(-5).join(' ');
                }

                const cleanKey = keyBase.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

                if (cleanKey && cleanKey.length > 1 && !detectedPlaceholders.find(p => p.key === cleanKey)) {
                    detectedPlaceholders.push({
                        key: cleanKey,
                        label: label.trim(), // Keep full label for the sidebar
                        value: ''
                    });
                }
                return cleanKey;
            };

            // Broad Pattern: Text followed by dots/underscores, ignoring HTML tags and entities
            const broadPattern = /([A-Za-z][A-Za-z0-9\s\/\-\(\):]*?)(?:<[^>]+>|&nbsp;|\s)*([._\u2026]{3,})/g;

            content = content.replace(broadPattern, (match, label, dots) => {
                // Clean up label for key generation
                const cleanLabel = label.replace(/<[^>]+>|&nbsp;/g, ' ').trim().replace(/[:\s]+$/, '');

                if (cleanLabel.length < 2 || cleanLabel.toLowerCase() === 'sign') return match;

                const key = addPlaceholder(cleanLabel, cleanLabel);

                // Replace ONLY the dots with the variable span, keeping the original label part of the match
                // We reconstruct the match but replace the dots part
                // ADDED SPACE HERE
                return match.replace(dots, ` <span class="variable" data-key="${key}" data-original-dots="${dots}" contenteditable="false" style="font-weight: ${variablesBold ? 'bold' : 'normal'}">{${key}}</span>`);
            });

            // Update document content
            setTimeout(() => {
                if (documentRef.current) {
                    documentRef.current.innerHTML = content;
                }
            }, 100);

            // Update placeholders - replace defaults with detected ones
            if (detectedPlaceholders.length > 0) {
                setPlaceholders(detectedPlaceholders);
            }
        } else if (location.state?.isEmpty) {
            setPlaceholders([]);
        }

        if (location.state?.uploadDetails) {
            setNotes(prev => prev + (prev ? '\n\n' : '') + `Upload Details:\n${location.state.uploadDetails}`);
            setActiveTab('notes');
        }
    }, [location.state]);

    // Update variable styles when settings change
    useEffect(() => {
        if (!documentRef.current) return;
        const variables = documentRef.current.querySelectorAll('.variable');
        variables.forEach(v => {
            v.style.fontWeight = variablesBold ? 'bold' : 'normal';
        });
    }, [variablesBold]);

    // Update DOM when placeholders change
    React.useEffect(() => {
        if (!documentRef.current) return;

        placeholders.forEach(p => {
            const elements = documentRef.current.querySelectorAll(`.variable[data-key="${p.key}"]`);
            elements.forEach(el => {
                el.innerText = p.value || `{${p.key}}`;
            });
        });
    }, [placeholders]);

    const handlePlaceholderChange = (key, newValue) => {
        setPlaceholders(prev => prev.map(p => p.key === key ? { ...p, value: newValue } : p));
    };

    const handleRemovePlaceholder = (key) => {
        const placeholder = placeholders.find(p => p.key === key);
        if (!placeholder) return;

        // Move to deleted
        setDeletedPlaceholders(prev => [...prev, placeholder]);
        setPlaceholders(prev => prev.filter(p => p.key !== key));

        // Update DOM - change to "deleted" state
        if (documentRef.current) {
            const elements = documentRef.current.querySelectorAll(`.variable[data-key="${key}"]`);
            elements.forEach(el => {
                el.classList.remove('variable');
                el.classList.add('variable-deleted');
                el.innerText = el.dataset.originalDots || '.........';
                el.style.fontWeight = 'normal';
                el.style.backgroundColor = 'transparent';
                el.style.color = 'inherit';
                el.contentEditable = 'true';
            });
        }
    };

    const handleRestorePlaceholder = (key) => {
        const placeholder = deletedPlaceholders.find(p => p.key === key);
        if (!placeholder) return;

        // Move back to active
        setPlaceholders(prev => [...prev, placeholder]);
        setDeletedPlaceholders(prev => prev.filter(p => p.key !== key));

        // Update DOM - restore "variable" state
        if (documentRef.current) {
            const elements = documentRef.current.querySelectorAll(`.variable-deleted[data-key="${key}"]`);
            elements.forEach(el => {
                el.classList.remove('variable-deleted');
                el.classList.add('variable');
                el.innerText = placeholder.value || `{${key}}`;
                el.style.fontWeight = variablesBold ? 'bold' : 'normal';
                el.contentEditable = 'false';
                el.style.backgroundColor = '';
                el.style.color = '';
            });
        }
    };

    const handleSendMessage = () => {
        if (!chatInput.trim()) return;
        setChatMessages([...chatMessages, { role: 'user', content: chatInput }]);
        setChatInput('');
        setTimeout(() => {
            setChatMessages(prev => [...prev, { role: 'ai', content: 'I am processing your request. This is a demo response.' }]);
        }, 1000);
    };

    const execCommand = (command, value = null) => {
        document.execCommand(command, false, value);
    };

    const handleExportPDF = () => {
        const element = documentRef.current;
        // Clone the element to remove contentEditable and ensure clean styles
        const clone = element.cloneNode(true);
        clone.removeAttribute('contentEditable');
        clone.style.boxShadow = 'none';
        clone.style.margin = '0';

        // Clean up variables for export (remove highlights)
        const variables = clone.querySelectorAll('.variable');
        variables.forEach(v => {
            v.style.backgroundColor = 'transparent';
            v.style.color = 'inherit';
            v.style.border = 'none';
            v.style.padding = '0';
            v.style.borderRadius = '0';
            v.removeAttribute('contenteditable');
            v.removeAttribute('data-key');
        });

        const opt = {
            margin: [10, 10, 10, 10], // top, left, bottom, right
            filename: 'legal_draft.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        html2pdf().set(opt).from(clone).save();
        setShowExportMenu(false);
    };

    const handleExportWord = () => {
        // Clone and clean up for Word export
        const clone = documentRef.current.cloneNode(true);
        const variables = clone.querySelectorAll('.variable');
        variables.forEach(v => {
            v.style.backgroundColor = 'transparent';
            v.style.color = 'inherit';
            v.style.border = 'none';
            v.style.padding = '0';
            v.style.borderRadius = '0';
            v.removeAttribute('contenteditable');
            v.removeAttribute('data-key');
        });

        const header = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' 
            xmlns:w='urn:schemas-microsoft-com:office:word' 
            xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>Legal Draft</title>
        <style>
          body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; }
          p { margin-bottom: 1em; }
          h1 { text-align: center; font-size: 16pt; font-weight: bold; text-transform: uppercase; }
        </style>
      </head>
      <body>`;
        const footer = "</body></html>";
        const content = clone.innerHTML;
        const sourceHTML = header + content + footer;

        const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
        const fileDownload = document.createElement("a");
        document.body.appendChild(fileDownload);
        fileDownload.href = source;
        fileDownload.download = 'legal_draft.doc';
        fileDownload.click();
        document.body.removeChild(fileDownload);
        setShowExportMenu(false);
    };

    const handleZoomIn = () => {
        setZoomLevel(prev => Math.min(prev + 10, 200));
    };

    const handleZoomOut = () => {
        setZoomLevel(prev => Math.max(prev - 10, 50));
    };

    const handleFitWidth = () => {
        if (mainContainerRef.current) {
            const containerWidth = mainContainerRef.current.clientWidth;
            // A4 width in px (approx) + padding
            const documentWidth = 816 + 100;
            const newZoom = Math.floor((containerWidth / documentWidth) * 100);
            setZoomLevel(Math.min(Math.max(newZoom - 5, 50), 150));
        }
    };

    // Pinch-to-zoom handler (trackpad pinch or Ctrl+scroll) - zoom towards cursor
    useEffect(() => {
        const mainEl = mainContainerRef.current;
        if (!mainEl) return;

        const handleWheel = (e) => {
            if (e.ctrlKey) {
                e.preventDefault();
                e.stopPropagation();

                // 4% zoom step
                const delta = e.deltaY > 0 ? -4 : 4;
                const newZoomLevel = Math.round(Math.min(200, Math.max(50, zoomLevel + delta)));

                if (newZoomLevel !== zoomLevel) {
                    // Get mouse position relative to viewport within container
                    const rect = mainEl.getBoundingClientRect();
                    const mouseXInContainer = e.clientX - rect.left;
                    const mouseYInContainer = e.clientY - rect.top;

                    // Current scroll and zoom
                    const scrollLeft = mainEl.scrollLeft;
                    const scrollTop = mainEl.scrollTop;
                    const oldZoom = zoomLevel / 100;
                    const newZoom = newZoomLevel / 100;

                    // Point in document coordinates (before zoom)
                    const pointX = (scrollLeft + mouseXInContainer) / oldZoom;
                    const pointY = (scrollTop + mouseYInContainer) / oldZoom;

                    // New scroll to keep that point under cursor
                    const newScrollLeft = pointX * newZoom - mouseXInContainer;
                    const newScrollTop = pointY * newZoom - mouseYInContainer;

                    // Update zoom first
                    setZoomLevel(newZoomLevel);

                    // Then adjust scroll in next frame
                    requestAnimationFrame(() => {
                        mainEl.scrollTo({
                            left: Math.max(0, newScrollLeft),
                            top: Math.max(0, newScrollTop),
                            behavior: 'instant'
                        });
                    });
                }
            }
        };

        mainEl.addEventListener('wheel', handleWheel, { passive: false });
        return () => mainEl.removeEventListener('wheel', handleWheel);
    }, [zoomLevel]);

    // Pagination constants (A4 at 96 DPI)
    const PAGE_HEIGHT = 1056;
    const PAGE_PADDING = 72; // Matches CSS padding (3/4 inch)
    const MAX_CONTENT_HEIGHT = PAGE_HEIGHT - PAGE_PADDING * 2; // 912px available content area

    // Ref to track pages container
    const pagesContainerRef = useRef(null);

    // State for page count (for zoom-wrapper sizing)
    const [pageCount, setPageCount] = useState(1);

    // State for document stats
    const [wordCount, setWordCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);

    // Helper: ensure editor-root exists in page
    const initEmptyEditor = (pageEl) => {
        let ed = pageEl.querySelector('.editor-root');
        if (!ed) {
            ed = document.createElement('div');
            ed.setAttribute('contenteditable', 'true');
            ed.className = 'editor-root';
            ed.style.outline = 'none';
            ed.style.whiteSpace = 'normal';
            ed.style.lineHeight = '1.6';
            ed.style.wordBreak = 'break-word';
            ed.style.overflowWrap = 'anywhere';
            ed.style.width = '100%';
            ed.style.maxWidth = '100%';
            pageEl.appendChild(ed);
        }
        return ed;
    };

    // Helper: create or get next page
    const ensureNextPage = (currentPage) => {
        let next = currentPage.nextElementSibling;
        if (!next || !next.classList.contains('document-page')) {
            next = document.createElement('div');
            next.className = 'document-page';
            initEmptyEditor(next);
            currentPage.parentElement?.insertBefore(next, currentPage.nextSibling);
        }
        return next;
    };

    // Pagination function - exactly like DocumentPreview.tsx
    const paginateAll = useCallback(() => {
        const container = pagesContainerRef.current;
        if (!container) return;

        let safety = 0;
        let changed = true;
        let movedToNextPage = null; // Track if content was moved to next page

        while (changed && safety < 20) {
            changed = false;
            safety++;
            const pages = Array.from(container.querySelectorAll('.document-page'));

            // Forward pass: push overflow to next page
            for (let i = 0; i < pages.length; i++) {
                const pageEl = pages[i];
                const editor = initEmptyEditor(pageEl);

                while (editor.scrollHeight > MAX_CONTENT_HEIGHT && editor.lastChild) {
                    const next = ensureNextPage(pageEl);
                    const nextEditor = initEmptyEditor(next);

                    // Check if cursor is in the element being moved
                    const selection = window.getSelection();
                    const movingEl = editor.lastChild;
                    const cursorInMovingEl = selection && selection.rangeCount > 0 &&
                        movingEl.contains(selection.getRangeAt(0).startContainer);

                    nextEditor.insertBefore(movingEl, nextEditor.firstChild);
                    changed = true;

                    // Mark that we need to move cursor to next page
                    if (cursorInMovingEl) {
                        movedToNextPage = nextEditor;
                    }
                }
            }

            // Backward pass: pull content up if there's room
            for (let i = pages.length - 2; i >= 0; i--) {
                const pageEl = pages[i];
                const nextEl = pages[i + 1];
                const editor = initEmptyEditor(pageEl);
                const nextEditor = initEmptyEditor(nextEl);

                while (editor.scrollHeight < MAX_CONTENT_HEIGHT && nextEditor.firstChild) {
                    editor.appendChild(nextEditor.firstChild);
                    changed = true;
                }

                // Remove empty trailing page
                if (i === pages.length - 2 && !nextEditor.firstChild) {
                    nextEl.remove();
                    changed = true;
                }
            }
        }

        // If content was moved to next page, place cursor there
        if (movedToNextPage && movedToNextPage.firstChild) {
            const selection = window.getSelection();
            const range = document.createRange();

            // Place cursor at end of first element in new page
            const firstEl = movedToNextPage.firstChild;
            if (firstEl.nodeType === Node.TEXT_NODE) {
                range.setStart(firstEl, firstEl.textContent.length);
            } else if (firstEl.lastChild) {
                range.setStartAfter(firstEl.lastChild);
            } else {
                range.setStart(firstEl, 0);
            }
            range.collapse(true);

            selection.removeAllRanges();
            selection.addRange(range);

            // Scroll the new page into view
            movedToNextPage.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        // Update page count for zoom-wrapper
        const finalCount = container.querySelectorAll('.document-page').length;
        if (finalCount !== pageCount) {
            setPageCount(finalCount);
        }

        // Update word count
        const allText = container.textContent || '';
        const words = allText.trim().split(/\s+/).filter(w => w.length > 0).length;
        setWordCount(words);

        // Move cursor to next page if content was pushed there
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const cursorNode = range.startContainer;

            // Find which page the cursor is in now
            const pages = Array.from(container.querySelectorAll('.document-page'));
            for (let i = 0; i < pages.length; i++) {
                if (pages[i].contains(cursorNode)) {
                    setCurrentPage(i + 1);
                    break;
                }
            }
        }
    }, [pageCount]);



    // Listen for content changes
    useEffect(() => {
        const container = pagesContainerRef.current;
        if (!container) return;

        const schedule = () => requestAnimationFrame(paginateAll);

        container.addEventListener('input', schedule, true);
        container.addEventListener('paste', schedule, true);
        container.addEventListener('keyup', schedule, true);

        // Initial pagination
        setTimeout(paginateAll, 100);

        return () => {
            container.removeEventListener('input', schedule, true);
            container.removeEventListener('paste', schedule, true);
            container.removeEventListener('keyup', schedule, true);
        };
    }, [paginateAll]);

    // Auto-fit when sidebars change
    useEffect(() => {
        const timer = setTimeout(() => {
            handleFitWidth();
        }, 350);
        return () => clearTimeout(timer);
    }, [leftSidebarOpen, rightSidebarOpen]);

    return (
        <div className="editor-container">
            {/* Toolbar */}
            <div className="editor-toolbar glass-panel">
                <div className="toolbar-group">
                    <select className="font-select" onChange={(e) => execCommand('fontName', e.target.value)}>
                        <option value="Inter">Inter</option>
                        <option value="Times New Roman">Times New Roman</option>
                        <option value="Roboto">Roboto</option>
                        <option value="Open Sans">Open Sans</option>
                        <option value="Lato">Lato</option>
                        <option value="Georgia">Georgia</option>
                    </select>
                    <select className="size-select" onChange={(e) => execCommand('fontSize', e.target.value)}>
                        <option value="3">12px</option>
                        <option value="4">14px</option>
                        <option value="5">18px</option>
                        <option value="6">24px</option>
                        <option value="7">30px</option>
                    </select>
                </div>
                <div className="toolbar-divider"></div>
                <div className="toolbar-group">
                    <button className="tool-btn" onClick={() => execCommand('undo')} title="Undo"><Undo size={18} /></button>
                    <button className="tool-btn" onClick={() => execCommand('redo')} title="Redo"><Redo size={18} /></button>
                </div>
                <div className="toolbar-divider"></div>
                <div className="toolbar-group">
                    <button className="tool-btn" onClick={() => execCommand('bold')} title="Bold"><Bold size={18} /></button>
                    <button className="tool-btn" onClick={() => execCommand('italic')} title="Italic"><Italic size={18} /></button>
                    <button className="tool-btn" onClick={() => execCommand('underline')} title="Underline"><Underline size={18} /></button>
                    <button className="tool-btn" onClick={() => execCommand('subscript')} title="Subscript"><Subscript size={18} /></button>
                    <button className="tool-btn" onClick={() => execCommand('superscript')} title="Superscript"><Superscript size={18} /></button>
                </div>
                <div className="toolbar-divider"></div>
                <div className="toolbar-group">
                    <button className="tool-btn" onClick={() => execCommand('justifyLeft')} title="Align Left"><AlignLeft size={18} /></button>
                    <button className="tool-btn" onClick={() => execCommand('justifyCenter')} title="Align Center"><AlignCenter size={18} /></button>
                    <button className="tool-btn" onClick={() => execCommand('justifyRight')} title="Align Right"><AlignRight size={18} /></button>
                    <button className="tool-btn" onClick={() => execCommand('insertUnorderedList')} title="Bullet List"><List size={18} /></button>
                    <button className="tool-btn" onClick={() => execCommand('insertOrderedList')} title="Numbered List"><ListOrdered size={18} /></button>
                </div>
                <div className="spacer"></div>
                <div className="toolbar-actions">
                    <button className="btn btn-primary btn-sm">
                        <Wand2 size={16} style={{ marginRight: 8 }} />
                        Modify Draft
                    </button>
                    <button className="btn btn-ghost btn-sm">
                        <Save size={16} style={{ marginRight: 8 }} />
                        Save
                    </button>
                    <div style={{ position: 'relative' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setShowExportMenu(!showExportMenu)}>
                            <Download size={16} />
                        </button>
                        {showExportMenu && (
                            <div className="export-menu glass-panel">
                                <button onClick={handleExportPDF}>
                                    <FileDown size={16} /> Export as PDF
                                </button>
                                <button onClick={handleExportWord}>
                                    <FileText size={16} /> Export as Word
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="editor-layout">
                {/* Left Sidebar: Placeholders */}
                <div className={`editor-sidebar left glass-panel ${!leftSidebarOpen ? 'collapsed' : ''}`}>
                    <div className="sidebar-title">
                        {leftSidebarOpen && <h3>Variables</h3>}
                        <button className="toggle-btn" onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}>
                            {leftSidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                        </button>
                    </div>
                    {leftSidebarOpen && (
                        <>
                            <div className="sidebar-header-content">
                                <span
                                    className="badge"
                                    style={{
                                        backgroundColor: placeholders.filter(p => !p.value).length === 0 ? '#10b981' : undefined,
                                        color: placeholders.filter(p => !p.value).length === 0 ? 'white' : undefined
                                    }}
                                >
                                    {placeholders.filter(p => !p.value).length === 0
                                        ? 'All filled'
                                        : `${placeholders.filter(p => !p.value).length} missing`
                                    }
                                </span>
                                <label style={{ display: 'flex', alignItems: 'center', fontSize: '12px', cursor: 'pointer', marginLeft: 'auto', color: '#666' }}>
                                    <input
                                        type="checkbox"
                                        checked={variablesBold}
                                        onChange={(e) => setVariablesBold(e.target.checked)}
                                        style={{ marginRight: '5px' }}
                                    />
                                    Bold Variables
                                </label>
                            </div>
                            <div className="placeholders-list">
                                {placeholders.map(p => (
                                    <div key={p.key} className="placeholder-item">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                            <label style={{ marginBottom: 0 }}>{p.label}</label>
                                            <button
                                                onClick={() => handleRemovePlaceholder(p.key)}
                                                className="btn-ghost"
                                                title="Remove variable"
                                                style={{ padding: '2px', height: 'auto', color: '#999' }}
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                        <input
                                            type="text"
                                            value={p.value}
                                            onChange={(e) => handlePlaceholderChange(p.key, e.target.value)}
                                            placeholder={`Enter ${p.label}`}
                                        />
                                    </div>
                                ))}
                            </div>

                            {deletedPlaceholders.length > 0 && (
                                <div className="deleted-section" style={{ marginTop: '20px', borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: '10px' }}>
                                    <h4 style={{ fontSize: '12px', color: '#999', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Deleted Variables
                                    </h4>
                                    {deletedPlaceholders.map(p => (
                                        <div key={p.key} className="placeholder-item deleted" style={{ opacity: 0.7 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <label style={{ textDecoration: 'line-through', color: '#999', marginBottom: 0 }}>{p.label}</label>
                                                <button
                                                    onClick={() => handleRestorePlaceholder(p.key)}
                                                    className="btn-ghost"
                                                    title="Restore variable"
                                                    style={{ padding: '2px', height: 'auto', color: '#4caf50' }}
                                                >
                                                    <RotateCcw size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Center: Document */}
                <div className="editor-main" ref={mainContainerRef}>
                    <div
                        className="zoom-wrapper"
                        style={{
                            width: `${816 * zoomLevel / 100 + 48}px`,
                            minHeight: `${(PAGE_HEIGHT * pageCount + 24 * (pageCount - 1)) * zoomLevel / 100 + 48}px`,
                        }}
                    >
                        <div
                            className="pages-wrapper"
                            ref={pagesContainerRef}
                            style={{
                                transform: `scale(${zoomLevel / 100})`,
                                transformOrigin: 'top left',
                            }}
                        >
                            {/* First page with content */}
                            <div className="document-page">
                                <div
                                    className="editor-root"
                                    contentEditable
                                    suppressContentEditableWarning
                                    ref={documentRef}
                                >
                                    {!location.state?.htmlContent && !location.state?.isEmpty && (
                                        <>
                                            <p><strong>LEGAL NOTICE</strong></p>
                                            <p><strong>Ref No:</strong> <span className="variable" data-key="case_number" contentEditable="false">{placeholders.find(p => p.key === 'case_number')?.value || '{case_number}'}</span></p>
                                            <p><strong>Date:</strong> <span className="variable" data-key="date" contentEditable="false">{placeholders.find(p => p.key === 'date')?.value || '{date}'}</span></p>
                                            <p></p>
                                            <p><strong>To,</strong></p>
                                            <p>The Hon'ble Judge,</p>
                                            <p><span className="variable" data-key="court_name" contentEditable="false">{placeholders.find(p => p.key === 'court_name')?.value || '{court_name}'}</span></p>
                                            <p></p>
                                            <p><strong>Subject:</strong> Petition regarding {prompt || 'the mentioned matter'}</p>
                                            <p></p>
                                            <p>Sir/Madam,</p>
                                            <p>On behalf of my client, <strong><span className="variable" data-key="client_name" contentEditable="false">{placeholders.find(p => p.key === 'client_name')?.value || '{client_name}'}</span></strong>, I hereby submit the following facts:</p>
                                            <p>1. That the petitioner is a law-abiding citizen of India.</p>
                                            <p>2. That the petitioner is aggrieved by the circumstances detailed herein: {prompt}</p>
                                            <p>3. That the petitioner seeks justice from this Hon'ble Court.</p>
                                            <p></p>
                                            <p>It is therefore prayed that this Hon'ble Court may be pleased to issue appropriate orders.</p>
                                            <p></p>
                                            <p>Sincerely,</p>
                                            <p>Advocate Signature</p>
                                        </>
                                    )}
                                    {location.state?.isEmpty && (
                                        <p><br /></p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Zoom Controls and Stats - Fixed at bottom right */}
                <div className="zoom-controls-container">
                    <div className="document-stats">
                        <span>Page {currentPage} of {pageCount}</span>
                        <span className="divider">|</span>
                        <span>{wordCount} words</span>
                    </div>
                    <div className="zoom-controls glass-panel">
                        <button onClick={handleZoomOut} title="Zoom Out"><ZoomOut size={16} /></button>
                        <span className="zoom-level">{zoomLevel}%</span>
                        <button onClick={handleZoomIn} title="Zoom In"><ZoomIn size={16} /></button>
                        <div className="divider"></div>
                        <button onClick={handleFitWidth} title="Fit to Width"><Maximize size={16} /></button>
                    </div>
                </div>

                {/* Right Sidebar: AI Chat & Notes */}
                <div className={`editor-sidebar right glass-panel ${!rightSidebarOpen ? 'collapsed' : ''}`}>
                    <div className="chat-header">
                        {rightSidebarOpen && (
                            <>
                                <div
                                    className={`tab ${activeTab === 'ai' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('ai')}
                                >
                                    AI Research
                                </div>
                                <div
                                    className={`tab ${activeTab === 'notes' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('notes')}
                                >
                                    Notes
                                </div>
                            </>
                        )}
                        <button className="toggle-btn" onClick={() => setRightSidebarOpen(!rightSidebarOpen)}>
                            {rightSidebarOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                        </button>
                    </div>

                    {rightSidebarOpen && (
                        <>
                            {activeTab === 'ai' ? (
                                <>
                                    <div className="chat-messages">
                                        {chatMessages.map((msg, idx) => (
                                            <div key={idx} className={`message ${msg.role}`}>
                                                <div className="message-bubble">
                                                    {msg.content}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="chat-input-area">
                                        <div className="input-wrapper">
                                            <input
                                                type="text"
                                                placeholder="Ask AI legal assistant..."
                                                value={chatInput}
                                                onChange={(e) => setChatInput(e.target.value)}
                                                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                            />
                                            <button className="send-btn" onClick={handleSendMessage}>
                                                <Send size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="notes-area">
                                    <textarea
                                        placeholder="Type your research notes here..."
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        className="notes-input"
                                    />
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div >
    );
};

export default Editor;
