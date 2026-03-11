"use client";

import { $getRoot } from "lexical";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { TableCellNode, TableNode, TableRowNode } from "@lexical/table";
import { ListItemNode, ListNode } from "@lexical/list";
import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { TablePlugin } from "@lexical/react/LexicalTablePlugin";
import { TRANSFORMERS } from "@lexical/markdown";
import { useEffect, useState, useRef } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $generateHtmlFromNodes, $generateNodesFromDOM } from "@lexical/html";
import { useDebounce } from "@/hooks/useDebounce";
import ToolbarPlugin from "@/components/editor/plugins/ToolbarPlugin";
import ImagePlugin from "@/components/editor/plugins/ImagePlugin";
import { ImageNode } from "@/components/editor/nodes/ImageNode";

function Placeholder() {
  return <div className="absolute top-4 left-4 text-muted-foreground pointer-events-none">Enter article content...</div>;
}

interface LexicalEditorProps {
  value?: string;
  onChange: (html: string) => void;
  onImageUpload: (file: File) => Promise<string>;
}

function OnChangePlugin({ onChange }: { onChange: (html: string) => void }) {
  const [editor] = useLexicalComposerContext();
  const [html, setHtml] = useState<string>("");
  const debouncedHtml = useDebounce(html, 300);
  const onChangeRef = useRef(onChange);
  
  // Update the ref whenever onChange changes
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const htmlString = $generateHtmlFromNodes(editor, null);
        setHtml(htmlString);
      });
    });
  }, [editor]); // Removed onChange from dependencies

  useEffect(() => {
    onChangeRef.current(debouncedHtml);
  }, [debouncedHtml]);

  return null;
}

function InitialContentPlugin({ value }: { value?: string }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (value && value.trim()) {
      editor.update(() => {
        const parser = new DOMParser();
        const dom = parser.parseFromString(value, "text/html");
        const nodes = $generateNodesFromDOM(editor, dom);
        const root = $getRoot();
        root.clear();
        root.append(...nodes);
      });
    } else {
      // Clear content if value is empty or undefined
      editor.update(() => {
        const root = $getRoot();
        root.clear();
      });
    }
  }, [editor, value]); // Added value to dependencies

  return null;
}

export default function LexicalEditor({ value, onChange, onImageUpload }: LexicalEditorProps) {
  const initialConfig = {
    namespace: "ArticleEditor",
    theme: {
      paragraph: "mb-2",
      quote: "border-l-4 border-gray-300 pl-4 italic my-4",
      heading: {
        h1: "text-4xl font-bold mb-4",
        h2: "text-3xl font-bold mb-3",
        h3: "text-2xl font-bold mb-2",
        h4: "text-xl font-bold mb-2",
        h5: "text-lg font-bold mb-1",
      },
      list: {
        nested: {
          listitem: "list-none",
        },
        ol: "list-decimal ml-6 my-2",
        ul: "list-disc ml-6 my-2",
        listitem: "mb-1",
      },
      image: "max-w-full h-auto my-4 rounded-lg",
      link: "text-blue-600 hover:text-blue-800 underline cursor-pointer",
      text: {
        bold: "font-bold",
        italic: "italic",
        underline: "underline",
        strikethrough: "line-through",
        code: "bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded font-mono text-sm",
      },
      code: "bg-gray-100 dark:bg-gray-900 font-mono block p-4 rounded-lg my-4 overflow-x-auto",
      table: "border-collapse table-auto w-full my-4",
      tableCell: "border border-gray-300 px-4 py-2",
      tableCellHeader: "border border-gray-300 px-4 py-2 font-bold bg-gray-100 dark:bg-gray-800",
    },
    onError(error: Error) {
      console.error(error);
    },
    nodes: [
      HeadingNode,
      ListNode,
      ListItemNode,
      QuoteNode,
      CodeNode,
      CodeHighlightNode,
      TableNode,
      TableCellNode,
      TableRowNode,
      AutoLinkNode,
      LinkNode,
      ImageNode,
    ],
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="relative border rounded-lg bg-background">
        <ToolbarPlugin onImageUpload={onImageUpload} />
        <div className="relative">
          <RichTextPlugin
            contentEditable={
              <ContentEditable className="min-h-[400px] max-h-[600px] overflow-y-auto scrollbar-thin p-4 outline-none prose prose-sm max-w-none dark:prose-invert" />
            }
            placeholder={<Placeholder />}
            ErrorBoundary={LexicalErrorBoundary}
          />
          <HistoryPlugin />
          <AutoFocusPlugin />
          <ListPlugin />
          <LinkPlugin />
          <TablePlugin />
          <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
          <ImagePlugin onImageUpload={onImageUpload} />
          <OnChangePlugin onChange={onChange} />
          <InitialContentPlugin value={value} />
        </div>
      </div>
    </LexicalComposer>
  );
}
