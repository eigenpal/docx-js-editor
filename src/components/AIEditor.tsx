/**
 * AI Editor Component
 *
 * Extends the Editor with AI context menu integration:
 * - Right-click context menu with AI actions
 * - Response preview before applying changes
 * - Full flow: select -> menu -> AI -> preview -> apply
 */

import React, {
  useRef,
  useCallback,
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from 'react';
import type { Document } from '../types/document';
import type {
  AIAction,
  AIActionRequest,
  AgentResponse,
  SelectionContext,
  Position,
  Range as DocumentRange,
} from '../types/agentApi';

import { Editor, type EditorRef, type EditorProps } from './Editor';
import { ContextMenu, useContextMenu } from './ContextMenu';
import { ResponsePreview, useResponsePreview } from './ResponsePreview';
import { buildSelectionContext } from '../agent/selectionContext';
import { executeCommand } from '../agent/executor';

// ============================================================================
// TYPES
// ============================================================================

/**
 * AI request handler function type
 */
export type AIRequestHandler = (request: AIActionRequest) => Promise<AgentResponse>;

/**
 * AI Editor props - extends Editor props with AI capabilities
 */
export interface AIEditorProps extends Omit<EditorProps, 'onChange'> {
  /** Callback when document changes (through editing or AI) */
  onChange?: (document: Document) => void;
  /** Handler for AI requests */
  onAgentRequest?: AIRequestHandler;
  /** Available AI actions (defaults to standard set) */
  availableActions?: AIAction[];
  /** Show custom prompt option in context menu */
  showCustomPrompt?: boolean;
  /** Callback when AI action starts */
  onAIActionStart?: (action: AIAction, context: SelectionContext) => void;
  /** Callback when AI action completes */
  onAIActionComplete?: (action: AIAction, response: AgentResponse) => void;
  /** Callback when AI action fails */
  onAIActionError?: (action: AIAction, error: Error) => void;
}

/**
 * AI Editor ref interface
 */
export interface AIEditorRef extends EditorRef {
  /** Trigger an AI action programmatically */
  triggerAIAction: (action: AIAction, customPrompt?: string) => Promise<void>;
  /** Get current selection context */
  getSelectionContext: () => SelectionContext | null;
}

/**
 * Selection state
 */
interface SelectionState {
  text: string;
  range: DocumentRange;
  context: SelectionContext;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get selected text from DOM selection
 */
function getSelectedText(): string {
  if (typeof window === 'undefined') return '';
  const selection = window.getSelection();
  return selection?.toString() || '';
}

/**
 * Convert DOM selection to document range
 */
function getSelectionRange(
  containerRef: React.RefObject<HTMLElement>,
  _document: Document
): DocumentRange | null {
  if (typeof window === 'undefined') return null;

  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return null;

  const anchorNode = selection.anchorNode;
  const focusNode = selection.focusNode;

  if (!anchorNode || !focusNode) return null;
  if (!containerRef.current?.contains(anchorNode)) return null;

  // Find paragraph indices by traversing up to elements with data-paragraph-index
  const findParagraphInfo = (node: Node): { index: number; element: Element } | null => {
    let current: Node | null = node;
    while (current && current !== containerRef.current) {
      if (current instanceof Element) {
        const indexAttr = current.getAttribute('data-paragraph-index');
        if (indexAttr !== null) {
          return { index: parseInt(indexAttr, 10), element: current };
        }
      }
      current = current.parentNode;
    }
    return null;
  };

  const anchorInfo = findParagraphInfo(anchorNode);
  const focusInfo = findParagraphInfo(focusNode);

  if (!anchorInfo || !focusInfo) return null;

  // Calculate offsets within paragraphs
  const calculateOffset = (paraElement: Element, node: Node, offset: number): number => {
    // If the node is an Element (not a Text node), the offset refers to child indices
    // We need to convert this to a character offset
    let targetNode = node;
    let targetOffset = offset;

    if (node.nodeType === Node.ELEMENT_NODE) {
      // The offset is a child index, convert to text position
      const element = node as Element;
      const childNodes = element.childNodes;

      if (offset === 0) {
        // At the start of the element - find the first text node
        const walker = window.document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
        const firstText = walker.nextNode();
        if (firstText) {
          targetNode = firstText;
          targetOffset = 0;
        } else {
          return 0; // No text in element
        }
      } else if (offset >= childNodes.length) {
        // At the end of the element - find the last text node
        const walker = window.document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
        let lastText: Node | null = null;
        let node: Node | null;
        while ((node = walker.nextNode())) {
          lastText = node;
        }
        if (lastText) {
          targetNode = lastText;
          targetOffset = (lastText as Text).length;
        } else {
          return 0; // No text in element
        }
      } else {
        // Point to a specific child - find text position up to that child
        let charCount = 0;
        for (let i = 0; i < offset; i++) {
          const child = childNodes[i];
          charCount += child.textContent?.length || 0;
        }
        return charCount;
      }
    }

    const treeWalker = window.document.createTreeWalker(paraElement, NodeFilter.SHOW_TEXT, null);

    let charOffset = 0;
    let currentNode = treeWalker.nextNode();

    while (currentNode) {
      if (currentNode === targetNode) {
        return charOffset + targetOffset;
      }
      charOffset += (currentNode as Text).length;
      currentNode = treeWalker.nextNode();
    }

    // Node not found - return total length + offset (shouldn't happen normally)
    return charOffset;
  };

  const anchorOffset = calculateOffset(anchorInfo.element, anchorNode, selection.anchorOffset);
  const focusOffset = calculateOffset(focusInfo.element, focusNode, selection.focusOffset);

  // Determine start and end based on document order
  let start: Position;
  let end: Position;

  if (
    anchorInfo.index < focusInfo.index ||
    (anchorInfo.index === focusInfo.index && anchorOffset < focusOffset)
  ) {
    start = { paragraphIndex: anchorInfo.index, offset: anchorOffset };
    end = { paragraphIndex: focusInfo.index, offset: focusOffset };
  } else {
    start = { paragraphIndex: focusInfo.index, offset: focusOffset };
    end = { paragraphIndex: anchorInfo.index, offset: anchorOffset };
  }

  return { start, end };
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * AI Editor - Editor with integrated AI context menu
 */
export const AIEditor = forwardRef<AIEditorRef, AIEditorProps>(function AIEditor(
  {
    document: initialDocument,
    onChange,
    onAgentRequest,
    availableActions,
    showCustomPrompt = true,
    onAIActionStart,
    onAIActionComplete,
    onAIActionError,
    ...editorProps
  },
  ref
) {
  // State
  const [currentDocument, setCurrentDocument] = useState<Document>(initialDocument);
  const [selectionState, setSelectionState] = useState<SelectionState | null>(null);

  // Refs
  const editorRef = useRef<EditorRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Context menu and preview hooks
  const contextMenu = useContextMenu();
  const responsePreview = useResponsePreview();

  // Sync document state
  useEffect(() => {
    setCurrentDocument(initialDocument);
  }, [initialDocument]);

  // Handle document changes
  const handleDocumentChange = useCallback(
    (newDocument: Document) => {
      setCurrentDocument(newDocument);
      onChange?.(newDocument);
    },
    [onChange]
  );

  // Get current selection context
  const getSelectionContext = useCallback((): SelectionContext | null => {
    const range = getSelectionRange(containerRef, currentDocument);
    if (!range) return null;

    try {
      return buildSelectionContext(currentDocument, range);
    } catch (e) {
      console.error('Failed to build selection context:', e);
      return null;
    }
  }, [currentDocument]);

  // Handle right-click
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      const selectedText = getSelectedText();
      if (!selectedText) return;

      const range = getSelectionRange(containerRef, currentDocument);
      if (!range) return;

      try {
        const context = buildSelectionContext(currentDocument, range);
        setSelectionState({ text: selectedText, range, context });
        contextMenu.openMenu(e, selectedText, context);
      } catch (error) {
        console.error('Failed to open context menu:', error);
      }
    },
    [currentDocument, contextMenu]
  );

  // Handle AI action
  const handleAIAction = useCallback(
    async (action: AIAction, customPrompt?: string) => {
      if (!selectionState || !onAgentRequest) return;

      const { text, context } = selectionState;

      // Build request
      const request: AIActionRequest = {
        action,
        context,
        customPrompt,
      };

      // Notify start
      onAIActionStart?.(action, context);

      // Show loading preview
      responsePreview.showPreview(text, action, contextMenu.position);
      contextMenu.closeMenu();

      try {
        // Execute AI request
        const response = await onAgentRequest(request);

        // Handle response
        if (response.success && response.newText) {
          responsePreview.setResponse(response);
          onAIActionComplete?.(action, response);
        } else {
          const error = response.error || 'AI request failed';
          responsePreview.setError(error);
          onAIActionError?.(action, new Error(error));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        responsePreview.setError(message);
        onAIActionError?.(action, error instanceof Error ? error : new Error(message));
      }
    },
    [
      selectionState,
      onAgentRequest,
      onAIActionStart,
      onAIActionComplete,
      onAIActionError,
      contextMenu,
      responsePreview,
    ]
  );

  // Handle accept response
  const handleAcceptResponse = useCallback(
    (newText: string) => {
      if (!selectionState) return;

      const { range } = selectionState;

      // Apply the replacement using command executor
      const newDoc = executeCommand(currentDocument, {
        type: 'replaceText',
        range,
        text: newText,
      });

      handleDocumentChange(newDoc);
      responsePreview.hidePreview();
      setSelectionState(null);
    },
    [selectionState, currentDocument, handleDocumentChange, responsePreview]
  );

  // Handle reject response
  const handleRejectResponse = useCallback(() => {
    responsePreview.hidePreview();
    setSelectionState(null);
  }, [responsePreview]);

  // Handle retry
  const handleRetry = useCallback(() => {
    if (selectionState) {
      handleAIAction(responsePreview.state.action);
    }
  }, [selectionState, responsePreview.state.action, handleAIAction]);

  // Trigger AI action programmatically
  const triggerAIAction = useCallback(
    async (action: AIAction, customPrompt?: string) => {
      const selectedText = getSelectedText();
      if (!selectedText) return;

      const range = getSelectionRange(containerRef, currentDocument);
      if (!range) return;

      try {
        const context = buildSelectionContext(currentDocument, range);
        setSelectionState({ text: selectedText, range, context });
        await handleAIAction(action, customPrompt);
      } catch (error) {
        console.error('Failed to trigger AI action:', error);
      }
    },
    [currentDocument, handleAIAction]
  );

  // Expose ref methods
  useImperativeHandle(
    ref,
    () => ({
      ...editorRef.current!,
      triggerAIAction,
      getSelectionContext,
    }),
    [triggerAIAction, getSelectionContext]
  );

  return (
    <div
      ref={containerRef}
      className="docx-ai-editor"
      onContextMenu={handleContextMenu}
      style={{ position: 'relative' }}
    >
      <Editor
        ref={editorRef}
        document={currentDocument}
        onChange={handleDocumentChange}
        {...editorProps}
      />

      {/* Context menu */}
      {contextMenu.isOpen && onAgentRequest && (
        <ContextMenu
          isOpen={contextMenu.isOpen}
          position={contextMenu.position}
          selectedText={contextMenu.selectedText}
          selectionContext={contextMenu.selectionContext}
          onAction={handleAIAction}
          onClose={contextMenu.closeMenu}
          actions={availableActions}
          showCustomPrompt={showCustomPrompt}
        />
      )}

      {/* Response preview */}
      {responsePreview.state.isVisible && (
        <ResponsePreview
          originalText={responsePreview.state.originalText}
          response={responsePreview.state.response}
          action={responsePreview.state.action}
          isLoading={responsePreview.state.isLoading}
          error={responsePreview.state.error}
          onAccept={handleAcceptResponse}
          onReject={handleRejectResponse}
          onRetry={handleRetry}
          position={responsePreview.state.position}
        />
      )}
    </div>
  );
});

// ============================================================================
// MOCK AI HANDLER FOR TESTING
// ============================================================================

/**
 * Create a mock AI handler for testing
 */
export function createMockAIHandler(delay = 1000): AIRequestHandler {
  return async (request: AIActionRequest): Promise<AgentResponse> => {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, delay));

    const { action, context, customPrompt } = request;
    const { selectedText } = context;

    // Generate mock responses based on action
    let newText = selectedText;

    switch (action) {
      case 'rewrite':
        newText = `[Rewritten] ${selectedText}`;
        break;
      case 'expand':
        newText = `${selectedText}. Additionally, this text has been expanded with more detail and context to provide a more comprehensive explanation of the original content.`;
        break;
      case 'summarize':
        newText = selectedText.split(' ').slice(0, 5).join(' ') + '...';
        break;
      case 'translate':
        newText = `[Translated] ${selectedText}`;
        break;
      case 'explain':
        newText = `This text means: "${selectedText}" - which explains the concept in simple terms.`;
        break;
      case 'fixGrammar':
        // Simple mock grammar fix
        newText = selectedText.replace(/\s+/g, ' ').trim();
        if (!newText.endsWith('.') && !newText.endsWith('!') && !newText.endsWith('?')) {
          newText += '.';
        }
        newText = newText.charAt(0).toUpperCase() + newText.slice(1);
        break;
      case 'makeFormal':
        newText = `[Formal] ${selectedText.replace(/don't/g, 'do not').replace(/can't/g, 'cannot')}`;
        break;
      case 'makeCasual':
        newText = `Hey! ${selectedText}`;
        break;
      case 'custom':
        newText = `[Custom: ${customPrompt}] ${selectedText}`;
        break;
      default:
        break;
    }

    return {
      success: true,
      newText,
    };
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default AIEditor;
