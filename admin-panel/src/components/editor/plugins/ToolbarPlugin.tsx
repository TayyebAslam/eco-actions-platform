"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  FORMAT_TEXT_COMMAND,
  FORMAT_ELEMENT_COMMAND,
  $getSelection,
  $isRangeSelection,
  $isNodeSelection,
  $createParagraphNode,
  $getNodeByKey,
} from "lexical";
import { $isLinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
  $isListNode,
  ListNode,
} from "@lexical/list";
import { $isHeadingNode, $createHeadingNode } from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import { $findMatchingParent, mergeRegister } from "@lexical/utils";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Link,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Undo,
  Redo,
  Image as ImageIcon,
  Table,
  Heading1,
  Heading2,
  Heading3,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { INSERT_IMAGE_COMMAND } from "@/components/editor/plugins/ImagePlugin";
import { $isImageNode, ImageNode } from "@/components/editor/nodes/ImageNode";

const LowPriority = 1;

interface ToolbarPluginProps {
  onImageUpload: (file: File) => Promise<string>;
}

export default function ToolbarPlugin({ onImageUpload }: ToolbarPluginProps) {
  const [editor] = useLexicalComposerContext();
  const toolbarRef = useRef(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [blockType, setBlockType] = useState("paragraph");
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [isCode, setIsCode] = useState(false);
  const [isLink, setIsLink] = useState(false);
  const [selectedImageKey, setSelectedImageKey] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    
    // Check if an image is selected
    if ($isNodeSelection(selection)) {
      const nodes = selection.getNodes();
      if (nodes.length === 1 && $isImageNode(nodes[0])) {
        setSelectedImageKey(nodes[0].getKey());
        return;
      }
    }
    setSelectedImageKey(null);
    
    if ($isRangeSelection(selection)) {
      const anchorNode = selection.anchor.getNode();
      const element =
        anchorNode.getKey() === "root"
          ? anchorNode
          : anchorNode.getTopLevelElementOrThrow();
      const elementKey = element.getKey();
      const elementDOM = editor.getElementByKey(elementKey);

      if (elementDOM !== null) {
        if ($isListNode(element)) {
          const parentList = $findMatchingParent(element, $isListNode);
          const type = parentList ? parentList.getTag() : element.getTag();
          setBlockType(type);
        } else {
          const type = $isHeadingNode(element) ? element.getTag() : element.getType();
          setBlockType(type);
        }
      }

      setIsBold(selection.hasFormat("bold"));
      setIsItalic(selection.hasFormat("italic"));
      setIsUnderline(selection.hasFormat("underline"));
      setIsStrikethrough(selection.hasFormat("strikethrough"));
      setIsCode(selection.hasFormat("code"));

      const node = selection.anchor.getNode();
      const parent = node.getParent();
      if ($isLinkNode(parent) || $isLinkNode(node)) {
        setIsLink(true);
      } else {
        setIsLink(false);
      }
    }
  }, [editor]);

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          updateToolbar();
        });
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        (_payload, newEditor) => {
          updateToolbar();
          return false;
        },
        LowPriority
      ),
      editor.registerCommand(
        CAN_UNDO_COMMAND,
        (payload) => {
          setCanUndo(payload);
          return false;
        },
        LowPriority
      ),
      editor.registerCommand(
        CAN_REDO_COMMAND,
        (payload) => {
          setCanRedo(payload);
          return false;
        },
        LowPriority
      )
    );
  }, [editor, updateToolbar]);

  const formatParagraph = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createParagraphNode());
      }
    });
  };

  const formatHeading = (headingSize: "h1" | "h2" | "h3") => {
    if (blockType !== headingSize) {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createHeadingNode(headingSize));
        }
      });
    }
  };

  const formatBulletList = () => {
    if (blockType !== "ul") {
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
    } else {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
    }
  };

  const formatNumberedList = () => {
    if (blockType !== "ol") {
      editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
    } else {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
    }
  };

  const insertLink = useCallback(() => {
    if (!isLink) {
      const url = prompt("Enter URL:");
      if (url) {
        // Validate URL to prevent XSS attacks
        const trimmedUrl = url.trim();
        if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
          alert('Invalid URL. Only http:// and https:// URLs are allowed.');
          return;
        }
        editor.dispatchCommand(TOGGLE_LINK_COMMAND, trimmedUrl);
      }
    } else {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
    }
  }, [editor, isLink]);


  const setImagePosition = (position: 'left' | 'right' | 'center' | 'full') => {
    if (!selectedImageKey) return;
    
    editor.update(() => {
      const node = $getNodeByKey(selectedImageKey);
      if ($isImageNode(node)) {
        node.setPosition(position);
      }
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    try {
      toast.loading("Uploading image...");
      const url = await onImageUpload(file);
      editor.dispatchCommand(INSERT_IMAGE_COMMAND, {
        altText: file.name,
        src: url,
      });
      toast.dismiss();
      toast.success("Image inserted successfully");
    } catch (error) {
      toast.dismiss();
      toast.error("Failed to upload image");
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-muted/50" ref={toolbarRef}>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        disabled={!canUndo}
        onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
        className="h-8 w-8"
        title="Undo"
      >
        <Undo className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        disabled={!canRedo}
        onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
        className="h-8 w-8"
        title="Redo"
      >
        <Redo className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <Select value={blockType} onValueChange={(value) => {
        if (value === "paragraph") formatParagraph();
        else if (value === "h1") formatHeading("h1");
        else if (value === "h2") formatHeading("h2");
        else if (value === "h3") formatHeading("h3");
      }}>
        <SelectTrigger className="h-8 w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="paragraph">
            <div className="flex items-center gap-2">
              <Type className="h-4 w-4" />
              <span>Paragraph</span>
            </div>
          </SelectItem>
          <SelectItem value="h1">
            <div className="flex items-center gap-2">
              <Heading1 className="h-4 w-4" />
              <span>Heading 1</span>
            </div>
          </SelectItem>
          <SelectItem value="h2">
            <div className="flex items-center gap-2">
              <Heading2 className="h-4 w-4" />
              <span>Heading 2</span>
            </div>
          </SelectItem>
          <SelectItem value="h3">
            <div className="flex items-center gap-2">
              <Heading3 className="h-4 w-4" />
              <span>Heading 3</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <Button
        type="button"
        size="icon"
        variant={isBold ? "secondary" : "ghost"}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")}
        className="h-8 w-8"
        title="Bold"
      >
        <Bold className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant={isItalic ? "secondary" : "ghost"}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")}
        className="h-8 w-8"
        title="Italic"
      >
        <Italic className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant={isUnderline ? "secondary" : "ghost"}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline")}
        className="h-8 w-8"
        title="Underline"
      >
        <Underline className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant={isStrikethrough ? "secondary" : "ghost"}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough")}
        className="h-8 w-8"
        title="Strikethrough"
      >
        <Strikethrough className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant={isCode ? "secondary" : "ghost"}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "code")}
        className="h-8 w-8"
        title="Code"
      >
        <Code className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {selectedImageKey ? (
        <>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => setImagePosition('left')}
            className="h-8 w-8"
            title="Float Left"
          >
            <AlignLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => setImagePosition('center')}
            className="h-8 w-8"
            title="Center"
          >
            <AlignCenter className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => setImagePosition('right')}
            className="h-8 w-8"
            title="Float Right"
          >
            <AlignRight className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => setImagePosition('full')}
            className="h-8 w-8"
            title="Full Width"
          >
            <AlignJustify className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "left")}
            className="h-8 w-8"
            title="Align Left"
          >
            <AlignLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "center")}
            className="h-8 w-8"
            title="Align Center"
          >
            <AlignCenter className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "right")}
            className="h-8 w-8"
            title="Align Right"
          >
            <AlignRight className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "justify")}
            className="h-8 w-8"
            title="Justify"
          >
            <AlignJustify className="h-4 w-4" />
          </Button>
        </>
      )}

      <Separator orientation="vertical" className="mx-1 h-6" />

      <Button
        type="button"
        size="icon"
        variant={blockType === "ul" ? "secondary" : "ghost"}
        onClick={formatBulletList}
        className="h-8 w-8"
        title="Bullet List"
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant={blockType === "ol" ? "secondary" : "ghost"}
        onClick={formatNumberedList}
        className="h-8 w-8"
        title="Numbered List"
      >
        <ListOrdered className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <Button
        type="button"
        size="icon"
        variant={isLink ? "secondary" : "ghost"}
        onClick={insertLink}
        className="h-8 w-8"
        title="Insert Link"
      >
        <Link className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={() => fileInputRef.current?.click()}
        className="h-8 w-8"
        title="Insert Image"
      >
        <ImageIcon className="h-4 w-4" />
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />
    </div>
  );
}
