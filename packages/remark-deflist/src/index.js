/**
 * Remark DefinitionList plugin.
 */

import visit from "unist-util-visit";
import toString from "mdast-util-to-string";
import fromMarkdown from "mdast-util-from-markdown";
import toMarkdown from "mdast-util-to-markdown";
import mdxUtil from "mdast-util-mdx";
import syntax from "micromark-extension-mdxjs";

// Test if deflist is contained in a single paragraph.
const isSingleDeflist = (node) =>
  // i > 0 &&
  /^[^:].+\n:\s/.test(toString(node)) && node.type === "paragraph";

// Test if deflist is split between two paragraphs.
const isSplitDeflist = (node, i, parent) =>
  i > 0 &&
  /^:\s/.test(toString(node)) &&
  !/^:\s/.test(toString(parent.children[i - 1])) &&
  node.type === "paragraph" &&
  parent.children[i - 1].type === "paragraph";

const isdeflist = (node, i, parent) =>
  isSingleDeflist(node) || isSplitDeflist(node, i, parent);

export default function deflist(
  options = { toMarkdownOptions: {}, fromMarkdownOptions: {} }
) {
  return (tree, file) => {
    visit(tree, ["paragraph"], (node, i, parent) => {
      const isdef = isdeflist(node, i, parent);
      if (!isdef) {
        return;
      }

      let dd = undefined;
      let dt = undefined;
      let count = 0;
      let start = 0;

      if (isSingleDeflist(node)) {
        const [title, ...children] = toMarkdown(
          node,
          options.toMarkdownOptions
        ).split(/\n:\s+/);

        dt = fromMarkdown(title, options.fromMarkdownOptions).children.flatMap(
          ({ children }) => children
        );
        dd = children
          .map((node) => fromMarkdown(node, options.fromMarkdownOptions))
          .flatMap(({ children }) => children)
          .map(({ children }) => ({
            type: "descriptiondetails",
            data: {
              hName: "dd",
            },
            children,
          }));
        start = i;
        count = 1;
      } else {
        dt = parent.children[i - 1].children;
        dd = toMarkdown(node, options.toMarkdownOptions)
          .replace(/^:\s+/, "")
          .split(/\n:\s+/)
          .map((node) => fromMarkdown(node, options.fromMarkdownOptions))
          .flatMap(({ children }) => children)
          .map(({ children }) => ({
            type: "descriptiondetails",
            data: {
              hName: "dd",
            },
            children,
          }));
        start = i - 1;
        count = 2;
      }

      const child = {
        type: "descriptionlist",
        data: {
          hName: "dl",
        },
        children: [
          {
            type: "descriptionterm",
            data: {
              hName: "dt",
            },
            children: dt,
          },
          ...dd,
        ],
      };

      parent.children.splice(start, count, child);
    });

    // Merge subsequent definition lists into a single list (#10)
    visit(tree, ["descriptionlist"], (node, i, parent) => {
      const start = i;
      let count = 1;
      let children = node.children;

      for (let j = i + 1; j < parent.children.length; j++) {
        const next = parent.children[j];
        if (next.type === "descriptionlist") {
          count++;
          children = children.concat(next.children);
        } else {
          break;
        }
      }

      if (count === 1) {
        return;
      }

      node.children = children;

      parent.children.splice(start, count, node);
    });
  };
}
