#!/usr/bin/env python3
"""Extract Skillio lesson HTML into Markdown Content and Exercise files.

Usage:
  python scripts/skillio_html_extract.py --html lesson.html --source-selector "#lesson" --boundary-selector "#exercise" --content-output Content.md --exercise-output Exercise.md

Selector support:
  - tag names: div, section, article, h2
  - ids: #lesson
  - classes: .lesson-body
  - combined simple selectors: div.lesson-body#lesson
  - descendant combinators with spaces

The source selector is mandatory and must select exactly one element.
The boundary selector is mandatory and must select exactly one element within the source.
If the boundary is missing, duplicated, or outside the source, extraction fails.
"""

from __future__ import annotations

import argparse
import html
from html.parser import HTMLParser
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Node:
    tag: str
    attrs: dict[str, str]
    children: list["Node | str"] = field(default_factory=list)


class TreeBuilder(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=False)
        self.root = Node("document", {})
        self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        node = Node(tag.lower(), {k.lower(): v for k, v in attrs})
        self.stack[-1].children.append(node)
        self.stack.append(node)

    def handle_endtag(self, tag):
        tag = tag.lower()
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                self.stack = self.stack[:i]
                return

    def handle_data(self, data):
        if data:
            self.stack[-1].children.append(data)


def matches(node: Node, selector: str) -> bool:
    tag = None
    ident = None
    cls = None
    rest = selector
    if "#" in rest:
        rest, ident = rest.split("#", 1)
    if "." in rest:
        rest, cls = rest.split(".", 1)
    if rest:
        tag = rest.lower()
    if tag and node.tag != tag:
        return False
    if ident and node.attrs.get("id") != ident:
        return False
    if cls and cls not in node.attrs.get("class", "").split():
        return False
    return True


def find_all(node: Node, selector: str) -> list[Node]:
    tokens = selector.split()
    current = [node]
    for token in tokens:
        next_nodes: list[Node] = []
        for base in current:
            if matches(base, token):
                next_nodes.append(base)
            stack = list(base.children)
            while stack:
                child = stack.pop(0)
                if isinstance(child, Node):
                    if matches(child, token):
                        next_nodes.append(child)
                    stack = list(child.children) + stack
        current = next_nodes
    return current


def serialize_children(node: Node) -> str:
    return "".join(serialize_node(child) if isinstance(child, Node) else html.unescape(child) for child in node.children)


def text_content(node: Node) -> str:
    out = []
    for child in node.children:
        if isinstance(child, Node):
            out.append(text_content(child))
        else:
            out.append(html.unescape(child))
    return "".join(out)


def walk(node: Node):
    for child in node.children:
        yield child
        if isinstance(child, Node):
            yield from walk(child)


def serialize_node(node: Node) -> str:
    if node.tag in {"script", "style"}:
        return ""
    if node.tag in {"p", "div", "section", "article"}:
        rendered = serialize_children(node).strip()
        return rendered + "\n\n" if rendered else ""
    if node.tag in {"strong", "b"}:
        return f"**{serialize_children(node).strip()}**"
    if node.tag in {"em", "i"}:
        return f"*{serialize_children(node).strip()}*"
    if node.tag == "code":
        return f"`{text_content(node).strip()}`"
    if node.tag == "a":
        href = node.attrs.get("href", "")
        label = serialize_children(node).strip() or href
        return f"[{label}]({href})" if href else label
    if node.tag in {"ul", "ol"}:
        items = []
        for child in node.children:
            if isinstance(child, Node) and child.tag == "li":
                items.append(f"- {serialize_children(child).strip()}")
        return "\n".join(items) + "\n\n"
    if node.tag == "li":
        return serialize_children(node).strip()
    if node.tag in {"h1", "h2", "h3", "h4", "h5", "h6"}:
        level = int(node.tag[1])
        return f"{'#' * level} {text_content(node).strip()}\n\n"
    if node.tag == "table":
        rows = []
        for tr in find_all(node, "tr"):
            cells = []
            for child in tr.children:
                if isinstance(child, Node) and child.tag in {"th", "td"}:
                    cells.append(text_content(child).strip())
            rows.append("| " + " | ".join(cells) + " |")
        return "\n".join(rows) + "\n\n"
    return serialize_children(node)


def subtree_to_markdown(node: Node) -> str:
    return serialize_children(node).strip() + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--html", required=True, help="Input HTML file.")
    parser.add_argument("--source-selector", required=True, help="CSS selector for the source block.")
    parser.add_argument("--boundary-selector", required=True, help="CSS selector for the exercise boundary.")
    parser.add_argument("--content-output", required=True, help="Markdown file for Content.")
    parser.add_argument("--exercise-output", required=True, help="Markdown file for Exercise.")
    args = parser.parse_args()

    html_text = Path(args.html).read_text(encoding="utf-8")
    builder = TreeBuilder()
    builder.feed(html_text)
    source_matches = find_all(builder.root, args.source_selector)
    if len(source_matches) != 1:
        raise SystemExit(f"Source selector must match exactly one element; found {len(source_matches)}.")
    source = source_matches[0]
    boundary_matches = find_all(source, args.boundary_selector)
    if len(boundary_matches) != 1:
        raise SystemExit(f"Boundary selector must match exactly one element within source; found {len(boundary_matches)}.")
    boundary = boundary_matches[0]

    content_nodes = []
    exercise_nodes = []
    seen = False
    for child in source.children:
        if child is boundary:
            seen = True
            exercise_nodes.append(child)
            continue
        if not seen:
            content_nodes.append(child)
        else:
            exercise_nodes.append(child)
    if not seen:
        raise SystemExit("Boundary selector must identify a direct child split point within the source block.")

    content_md = "".join(serialize_node(c) if isinstance(c, Node) else html.unescape(c) for c in content_nodes).strip() + "\n"
    exercise_md = "".join(serialize_node(c) if isinstance(c, Node) else html.unescape(c) for c in exercise_nodes).strip() + "\n"

    content_path = Path(args.content_output)
    exercise_path = Path(args.exercise_output)
    content_path.parent.mkdir(parents=True, exist_ok=True)
    exercise_path.parent.mkdir(parents=True, exist_ok=True)
    content_path.write_text(content_md, encoding="utf-8")
    exercise_path.write_text(exercise_md, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
