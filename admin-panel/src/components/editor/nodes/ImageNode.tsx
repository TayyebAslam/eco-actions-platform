import type {
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  EditorConfig,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from "lexical";
import { $applyNodeReplacement, DecoratorNode, $getNodeByKey, $getSelection, $isNodeSelection, CLICK_COMMAND, COMMAND_PRIORITY_LOW, KEY_DELETE_COMMAND, KEY_BACKSPACE_COMMAND } from "lexical";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalNodeSelection } from "@lexical/react/useLexicalNodeSelection";
import { mergeRegister } from "@lexical/utils";

export interface ImagePayload {
  altText: string;
  height?: number;
  key?: NodeKey;
  position?: 'left' | 'right' | 'center' | 'full';
  src: string;
  width?: number;
}

function getImagePositionFromElement(
  element: HTMLImageElement
): 'left' | 'right' | 'center' | 'full' {
  const dataPosition = element.getAttribute("data-position");
  if (
    dataPosition === "left" ||
    dataPosition === "right" ||
    dataPosition === "center" ||
    dataPosition === "full"
  ) {
    return dataPosition;
  }

  const align = element.getAttribute("align");
  if (align === "left" || align === "right" || align === "center") {
    return align;
  }

  const inlineStyle = (element.getAttribute("style") || "").toLowerCase();
  if (inlineStyle.includes("float:right")) {
    return "right";
  }
  if (inlineStyle.includes("float:left")) {
    return "left";
  }
  if (inlineStyle.includes("width:100%")) {
    return "full";
  }

  return "center";
}

function convertImageElement(domNode: Node): null | DOMConversionOutput {
  if (domNode instanceof HTMLImageElement) {
    const { alt: altText, src, width, height } = domNode;
    const position = getImagePositionFromElement(domNode);
    const node = $createImageNode({ altText, height, src, width, position });
    return { node };
  }
  return null;
}

interface ImageComponentProps {
  src: string;
  altText: string;
  width: "inherit" | number;
  height: "inherit" | number;
  position: 'left' | 'right' | 'center' | 'full';
  nodeKey: NodeKey;
}

function ImageComponent({
  src,
  altText,
  width,
  height,
  position,
  nodeKey,
}: ImageComponentProps): React.ReactElement {
  const [editor] = useLexicalComposerContext();
  const imageRef = useRef<HTMLImageElement>(null);
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);
  const [isResizing, setIsResizing] = useState(false);

  const onDelete = useCallback(
    (event: KeyboardEvent) => {
      if (isSelected && $isNodeSelection($getSelection())) {
        event.preventDefault();
        const node = $getNodeByKey(nodeKey);
        if (node) {
          node.remove();
        }
      }
      return false;
    },
    [isSelected, nodeKey]
  );

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        CLICK_COMMAND,
        (event: MouseEvent) => {
          if (event.target === imageRef.current) {
            if (!event.shiftKey) {
              clearSelection();
            }
            setSelected(!isSelected);
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(
        KEY_DELETE_COMMAND,
        onDelete,
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(
        KEY_BACKSPACE_COMMAND,
        onDelete,
        COMMAND_PRIORITY_LOW
      )
    );
  }, [clearSelection, editor, isSelected, nodeKey, onDelete, setSelected]);

  const handleResizeStart = useCallback(
    (event: React.MouseEvent, direction: string) => {
      event.preventDefault();
      event.stopPropagation();

      const img = imageRef.current;
      if (!img) return;

      const rect = img.getBoundingClientRect();
      const initialSize = { width: rect.width, height: rect.height };
      const initialPosition = { x: event.clientX, y: event.clientY };
      const aspectRatio = initialSize.height > 0 ? initialSize.width / initialSize.height : 1;
      setIsResizing(true);

      const handleMouseMove = (e: MouseEvent) => {
        const deltaX = e.clientX - initialPosition.x;
        const deltaY = e.clientY - initialPosition.y;

        let newWidth = initialSize.width;
        let newHeight = initialSize.height;

        // Calculate dimensions based on direction
        if (direction === "e" || direction === "w") {
          // Horizontal resize - adjust width, calculate height
          if (direction === "e") {
            newWidth = initialSize.width + deltaX;
          } else {
            newWidth = initialSize.width - deltaX;
          }
          newHeight = newWidth / aspectRatio;
        } else if (direction === "n" || direction === "s") {
          // Vertical resize - adjust height, calculate width
          if (direction === "s") {
            newHeight = initialSize.height + deltaY;
          } else {
            newHeight = initialSize.height - deltaY;
          }
          newWidth = newHeight * aspectRatio;
        } else {
          // Corner resize - use the larger delta to maintain aspect ratio
          let widthChange = 0;
          let heightChange = 0;

          if (direction.includes("e")) {
            widthChange = deltaX;
          } else if (direction.includes("w")) {
            widthChange = -deltaX;
          }

          if (direction.includes("s")) {
            heightChange = deltaY;
          } else if (direction.includes("n")) {
            heightChange = -deltaY;
          }

          // Use the larger change to maintain aspect ratio
          const widthBasedChange = Math.abs(widthChange);
          const heightBasedChange = Math.abs(heightChange) * aspectRatio;

          if (widthBasedChange > heightBasedChange) {
            newWidth = initialSize.width + widthChange;
            newHeight = newWidth / aspectRatio;
          } else {
            newHeight = initialSize.height + heightChange;
            newWidth = newHeight * aspectRatio;
          }
        }

        // Minimum and maximum constraints
        newWidth = Math.max(50, Math.min(newWidth, 1200));
        newHeight = Math.max(50, Math.min(newHeight, 1200));

        // Recalculate to maintain aspect ratio with constraints
        if (newWidth / newHeight !== aspectRatio) {
          if (newWidth < newHeight * aspectRatio) {
            newHeight = newWidth / aspectRatio;
          } else {
            newWidth = newHeight * aspectRatio;
          }
        }

        editor.update(() => {
          const node = $getNodeByKey(nodeKey);
          if ($isImageNode(node)) {
            node.setWidthAndHeight(Math.round(newWidth), Math.round(newHeight));
          }
        });
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [editor, nodeKey]
  );

  const getPositionStyles = (): React.CSSProperties => {
    const baseStyles: React.CSSProperties = {
      outline: isSelected ? "2px solid #3b82f6" : "none",
      userSelect: "none",
      position: "relative",
      display: "block",
      width:"fit-content",
      maxWidth: "100%",
    };

    switch (position) {
      case 'left':
        return {
          ...baseStyles,
          float: 'left',
          marginRight: '1rem',
          marginBottom: '0.5rem',
        };
      case 'right':
        return {
          ...baseStyles,
          float: 'right',
          marginLeft: '1rem',
          marginBottom: '0.5rem',
        };
      case 'full':
        return {
          ...baseStyles,
          display: 'block',
          width: '100%',
        };
      case 'center':
      default:
        return {
          ...baseStyles,
          display: 'block',
          marginLeft: 'auto',
          marginRight: 'auto',
        };
    }
  };

  const getImageStyles = (): React.CSSProperties => {
    const baseImageStyles: React.CSSProperties = {
      display: "block",
      cursor: isSelected ? "default" : "pointer",
      opacity: isSelected ? 1 : undefined,
    };

    if (position === 'full') {
      return {
        ...baseImageStyles,
        width: '100%',
        height: 'auto',
      };
    }

    return {
      ...baseImageStyles,
      width: width === "inherit" ? "auto" : width,
      height: height === "inherit" ? "auto" : height,
      maxWidth: "100%",
    };
  };

  return (
    <div
      className={`image-wrapper ${isResizing ? 'resizing' : ''}`}
      style={getPositionStyles()}
    >
      <img
        ref={imageRef}
        src={src}
        alt={altText}
        draggable={false}
        className="transition-opacity"
        style={getImageStyles()}
      />
      {isSelected && !isResizing && position !== 'full' && (
        <>
          {/* Corner handles */}
          <div
            className="absolute top-0 left-0 w-4 h-4 bg-blue-500 border-2 border-white cursor-nw-resize rounded-full shadow-md hover:scale-110 transition-transform"
            style={{ transform: "translate(-50%, -50%)", zIndex: 10 }}
            onMouseDown={(e) => handleResizeStart(e, "nw")}
          />
          <div
            className="absolute top-0 right-0 w-4 h-4 bg-blue-500 border-2 border-white cursor-ne-resize rounded-full shadow-md hover:scale-110 transition-transform"
            style={{ transform: "translate(50%, -50%)", zIndex: 10 }}
            onMouseDown={(e) => handleResizeStart(e, "ne")}
          />
          <div
            className="absolute bottom-0 left-0 w-4 h-4 bg-blue-500 border-2 border-white cursor-sw-resize rounded-full shadow-md hover:scale-110 transition-transform"
            style={{ transform: "translate(-50%, 50%)", zIndex: 10 }}
            onMouseDown={(e) => handleResizeStart(e, "sw")}
          />
          <div
            className="absolute bottom-0 right-0 w-4 h-4 bg-blue-500 border-2 border-white cursor-se-resize rounded-full shadow-md hover:scale-110 transition-transform"
            style={{ transform: "translate(50%, 50%)", zIndex: 10 }}
            onMouseDown={(e) => handleResizeStart(e, "se")}
          />
          {/* Edge handles */}
          <div
            className="absolute top-0 left-1/2 w-4 h-4 bg-blue-500 border-2 border-white cursor-n-resize rounded-full shadow-md hover:scale-110 transition-transform"
            style={{ transform: "translate(-50%, -50%)", zIndex: 10 }}
            onMouseDown={(e) => handleResizeStart(e, "n")}
          />
          <div
            className="absolute bottom-0 left-1/2 w-4 h-4 bg-blue-500 border-2 border-white cursor-s-resize rounded-full shadow-md hover:scale-110 transition-transform"
            style={{ transform: "translate(-50%, 50%)", zIndex: 10 }}
            onMouseDown={(e) => handleResizeStart(e, "s")}
          />
          <div
            className="absolute top-1/2 left-0 w-4 h-4 bg-blue-500 border-2 border-white cursor-w-resize rounded-full shadow-md hover:scale-110 transition-transform"
            style={{ transform: "translate(-50%, -50%)", zIndex: 10 }}
            onMouseDown={(e) => handleResizeStart(e, "w")}
          />
          <div
            className="absolute top-1/2 right-0 w-4 h-4 bg-blue-500 border-2 border-white cursor-e-resize rounded-full shadow-md hover:scale-110 transition-transform"
            style={{ transform: "translate(50%, -50%)", zIndex: 10 }}
            onMouseDown={(e) => handleResizeStart(e, "e")}
          />
        </>
      )}
    </div>
  );
}

export type SerializedImageNode = Spread<
  {
    altText: string;
    height?: number;
    position: 'left' | 'right' | 'center' | 'full';
    src: string;
    width?: number;
  },
  SerializedLexicalNode
>;

export class ImageNode extends DecoratorNode<React.ReactElement> {
  __src: string;
  __altText: string;
  __width: "inherit" | number;
  __height: "inherit" | number;
  __position: 'left' | 'right' | 'center' | 'full';

  static getType(): string {
    return "image";
  }

  static clone(node: ImageNode): ImageNode {
    return new ImageNode(
      node.__src,
      node.__altText,
      node.__width,
      node.__height,
      node.__position,
      node.__key
    );
  }

  static importJSON(serializedNode: SerializedImageNode): ImageNode {
    const { altText, height, width, src, position } = serializedNode;
    const node = $createImageNode({
      altText,
      height,
      src,
      width,
      position,
    });
    return node;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("img");
    element.setAttribute("src", this.__src);
    element.setAttribute("alt", this.__altText);
    element.setAttribute("data-position", this.__position);

    if (this.__position === "left") {
      element.style.float = "left";
      element.style.marginRight = "1rem";
      element.style.marginBottom = "0.5rem";
      element.style.display = "block";
    } else if (this.__position === "right") {
      element.style.float = "right";
      element.style.marginLeft = "1rem";
      element.style.marginBottom = "0.5rem";
      element.style.display = "block";
    } else if (this.__position === "full") {
      element.style.display = "block";
      element.style.width = "100%";
      element.style.height = "auto";
    } else {
      element.style.display = "block";
      element.style.marginLeft = "auto";
      element.style.marginRight = "auto";
    }

    if (this.__width !== "inherit") {
      element.setAttribute("width", this.__width.toString());
    }
    if (this.__height !== "inherit") {
      element.setAttribute("height", this.__height.toString());
    }
    return { element };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      img: (node: Node) => ({
        conversion: convertImageElement,
        priority: 0,
      }),
    };
  }

  constructor(
    src: string,
    altText: string,
    width?: "inherit" | number,
    height?: "inherit" | number,
    position?: 'left' | 'right' | 'center' | 'full',
    key?: NodeKey
  ) {
    super(key);
    this.__src = src;
    this.__altText = altText;
    this.__width = width || "inherit";
    this.__height = height || "inherit";
    this.__position = position || 'center';
  }

  exportJSON(): SerializedImageNode {
    return {
      altText: this.getAltText(),
      height: this.__height === "inherit" ? 0 : this.__height,
      position: this.__position,
      src: this.getSrc(),
      type: "image",
      version: 1,
      width: this.__width === "inherit" ? 0 : this.__width,
    };
  }

  setWidthAndHeight(width: "inherit" | number, height: "inherit" | number): void {
    const writable = this.getWritable();
    writable.__width = width;
    writable.__height = height;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const span = document.createElement("span");
    const theme = config.theme;
    const className = theme.image;
    if (className !== undefined) {
      span.className = className;
    }
    return span;
  }

  updateDOM(): false {
    return false;
  }

  getSrc(): string {
    return this.__src;
  }

  getAltText(): string {
    return this.__altText;
  }

  getPosition(): 'left' | 'right' | 'center' | 'full' {
    return this.getLatest().__position;
  }

  setPosition(position: 'left' | 'right' | 'center' | 'full'): void {
    const writable = this.getWritable();
    writable.__position = position;
  }

  decorate(): React.ReactElement {
    return (
      <ImageComponent
        src={this.__src}
        altText={this.__altText}
        width={this.__width}
        height={this.__height}
        position={this.__position}
        nodeKey={this.__key}
      />
    );
  }
}

export function $createImageNode({
  altText,
  height,
  src,
  width,
  position,
  key,
}: ImagePayload): ImageNode {
  return $applyNodeReplacement(
    new ImageNode(src, altText, width, height, position, key)
  );
}

export function $isImageNode(node: LexicalNode | null | undefined): node is ImageNode {
  return node instanceof ImageNode;
}
