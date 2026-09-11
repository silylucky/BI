import Color from "@tiptap/extension-color";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import StarterKit from "@tiptap/starter-kit";
import { Extension } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (fontSize: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
    fontFamily: {
      setFontFamily: (fontFamily: string) => ReturnType;
      unsetFontFamily: () => ReturnType;
    };
    highlightColor: {
      setHighlightColor: (color: string) => ReturnType;
      unsetHighlightColor: () => ReturnType;
    };
  }
}

export const RichTextTextStyle = Extension.create({
  name: "richTextTextStyle",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) =>
              attributes.fontSize
                ? {
                    style: `font-size: ${attributes.fontSize}; line-height: 1.4`,
                  }
                : {},
          },
          fontFamily: {
            default: null,
            parseHTML: (element) => element.style.fontFamily?.replace(/['"]+/g, "") || null,
            renderHTML: (attributes) =>
              attributes.fontFamily ? { style: `font-family: ${attributes.fontFamily}` } : {},
          },
          backgroundColor: {
            default: null,
            parseHTML: (element) => element.style.backgroundColor || null,
            renderHTML: (attributes) =>
              attributes.backgroundColor
                ? { style: `background-color: ${attributes.backgroundColor}` }
                : {},
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (fontSize) =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run(),
      setFontFamily:
        (fontFamily) =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontFamily }).run(),
      unsetFontFamily:
        () =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontFamily: null }).removeEmptyTextStyle().run(),
      setHighlightColor:
        (backgroundColor) =>
        ({ chain }) =>
          chain().setMark("textStyle", { backgroundColor }).run(),
      unsetHighlightColor:
        () =>
        ({ chain }) =>
          chain().setMark("textStyle", { backgroundColor: null }).removeEmptyTextStyle().run(),
    };
  },
});

/** @deprecated use RichTextTextStyle */
export const FontSize = RichTextTextStyle;

export const richTextExtensions = [
  StarterKit.configure({
    link: false,
    underline: false,
    trailingNode: false,
  }),
  Underline,
  TextStyle,
  Color,
  RichTextTextStyle,
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  Link.configure({
    openOnClick: false,
    autolink: true,
    HTMLAttributes: { rel: "noopener noreferrer" },
  }),
];
