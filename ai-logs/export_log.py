"""Render a Claude Code session transcript (.jsonl) as readable Markdown.

Usage: python3 -I export_log.py <session.jsonl> <out.md> [--since 2026-10-24T09:00:00Z]
Keeps user messages, assistant text and tool calls (with trimmed results);
drops hidden reasoning, system/hook payloads and API metadata.
"""
import json
import re
import sys

EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+")
TOKEN = re.compile(r"ct1\.[\w.-]+")
MAX_RESULT = 1500


def clean(text: str) -> str:
    text = re.sub(r"<system-reminder>.*?</system-reminder>", "", text, flags=re.S)
    text = re.sub(r"<pasted_content[^>]*>", "\n> **[pasted]**\n", text)
    text = re.sub(r"</pasted_content[^>]*>", "", text)
    text = TOKEN.sub("[token redacted]", text)
    return EMAIL.sub("[email redacted]", text).strip()


def fence(text: str) -> str:
    if len(text) > MAX_RESULT:
        text = text[:MAX_RESULT] + "\n… (truncated)"
    return "```\n" + text.replace("```", "ˋˋˋ") + "\n```"


def tool_call(block: dict) -> str:
    inp = block.get("input", {})
    name = block.get("name")
    if name == "Bash":
        body = inp.get("command", "")
        head = inp.get("description", "")
    elif name in ("Write", "Edit", "Read"):
        head = inp.get("file_path", "")
        body = inp.get("content") or (
            f"- {inp.get('old_string', '')}\n+ {inp.get('new_string', '')}" if name == "Edit" else ""
        )
    else:
        head, body = "", json.dumps(inp, ensure_ascii=False, indent=1)
    out = f"**Tool: {name}** {clean(head)}"
    return out + ("\n\n" + fence(clean(body)) if body else "")


def result_text(block: dict) -> str:
    content = block.get("content")
    if isinstance(content, list):
        content = "\n".join(c.get("text", "") for c in content if isinstance(c, dict))
    return clean(str(content or ""))


def main(src: str, dst: str, since: str = "") -> None:
    lines = ["# AI session log", ""]
    seen = set()
    turn = 0
    for raw in open(src, encoding="utf-8"):
        rec = json.loads(raw)
        if rec.get("type") not in ("user", "assistant") or rec.get("isMeta"):
            continue
        if since and rec.get("timestamp", "") < since:
            continue
        uid = rec.get("uuid")
        if uid in seen:
            continue
        seen.add(uid)
        msg = rec.get("message", {})
        content = msg.get("content")
        blocks = [{"type": "text", "text": content}] if isinstance(content, str) else content or []
        for b in blocks:
            kind = b.get("type")
            if kind == "text" and clean(b["text"]):
                who = "User" if rec["type"] == "user" else "Claude"
                turn += 1
                lines += [f"## #{turn} · {who}", "", clean(b["text"]), ""]
            elif kind == "tool_use":
                lines += [tool_call(b), ""]
            elif kind == "tool_result":
                lines += ["<details><summary>result</summary>", "", fence(result_text(b)), "", "</details>", ""]
    open(dst, "w", encoding="utf-8").write("\n".join(lines))


if __name__ == "__main__":
    args = sys.argv[1:]
    since = ""
    if "--since" in args:
        i = args.index("--since")
        since = args[i + 1].replace("Z", "")
        del args[i : i + 2]
    main(args[0], args[1], since)
