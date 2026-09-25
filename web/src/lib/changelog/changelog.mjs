// Zero-dependency ES module. Node >= 18. See README.md for the API and how to vendor this.
//
// parseChangelog(markdown) -> entries from a Keep a Changelog 1.1.0 file.
// readTags({ cwd }) -> git tags shaped like vX.Y.Z, best-effort, never throws.
// loadChangelog({ file, cwd }) -> parseChangelog(file) merged with readTags(cwd).
// renderChangelogHTML(entries, opts) -> a semantic HTML string.

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const SECTION_TYPES = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security'];

/** Escape a plain string for safe HTML text content. */
function escapeHTML(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Convert one changelog line of inline Markdown to safe HTML: `code`, **bold**
 * and [text](url) become their HTML equivalents; everything else is escaped.
 * Processes tokens left to right so nothing already-escaped is re-escaped.
 */
function inlineMarkdownToHTML(text) {
  let out = '';
  let i = 0;
  const n = text.length;
  while (i < n) {
    const ch = text[i];
    if (ch === '`') {
      const end = text.indexOf('`', i + 1);
      if (end !== -1) {
        out += `<code>${escapeHTML(text.slice(i + 1, end))}</code>`;
        i = end + 1;
        continue;
      }
    }
    if (ch === '*' && text[i + 1] === '*') {
      const end = text.indexOf('**', i + 2);
      if (end !== -1) {
        out += `<strong>${inlineMarkdownToHTML(text.slice(i + 2, end))}</strong>`;
        i = end + 2;
        continue;
      }
    }
    if (ch === '[') {
      const closeBracket = text.indexOf(']', i + 1);
      if (closeBracket !== -1 && text[closeBracket + 1] === '(') {
        const closeParen = text.indexOf(')', closeBracket + 2);
        if (closeParen !== -1) {
          const label = text.slice(i + 1, closeBracket);
          const url = text.slice(closeBracket + 2, closeParen);
          if (/^(https?:)?\/\//.test(url) || url.startsWith('/') || url.startsWith('#')) {
            out += `<a href="${escapeHTML(url)}" rel="noopener">${inlineMarkdownToHTML(label)}</a>`;
            i = closeParen + 1;
            continue;
          }
        }
      }
    }
    out += escapeHTML(ch);
    i += 1;
  }
  return out;
}

/**
 * Parse a Keep a Changelog 1.1.0 markdown file.
 * Returns [{ version, date, sections: [{ type, items: [html] }], notes }],
 * newest first (file order), `version` is 'Unreleased' for that heading.
 */
export function parseChangelog(markdown) {
  const lines = String(markdown ?? '').split(/\r?\n/);
  const entries = [];
  let current = null;
  let currentSection = null;
  let notesBuf = [];

  const flushNotes = () => {
    if (current && notesBuf.length) {
      const text = notesBuf.join('\n').trim();
      if (text) current.notes = (current.notes ? current.notes + '\n' : '') + text;
    }
    notesBuf = [];
  };

  for (const rawLine of lines) {
    const line = rawLine;

    // ## [1.2.3] - 2026-09-24   or   ## [Unreleased]
    const versionMatch = /^##\s+\[([^\]]+)\](?:\s*-\s*(\d{4}-\d{2}-\d{2}))?/.exec(line);
    if (versionMatch) {
      flushNotes();
      current = { version: versionMatch[1], date: versionMatch[2] ?? null, sections: [], notes: '' };
      currentSection = null;
      entries.push(current);
      continue;
    }

    // ### Added / Changed / Fixed / Removed / Deprecated / Security
    const sectionMatch = /^###\s+(\w+)/.exec(line);
    if (sectionMatch && current && SECTION_TYPES.includes(sectionMatch[1])) {
      flushNotes();
      currentSection = { type: sectionMatch[1], items: [] };
      current.sections.push(currentSection);
      continue;
    }

    // - item
    const itemMatch = /^[-*]\s+(.*)$/.exec(line);
    if (itemMatch && current && currentSection) {
      currentSection.items.push(inlineMarkdownToHTML(itemMatch[1].trim()));
      continue;
    }

    // Anything else under a version but outside a section/item is a free-text note
    // (skip the top-level title line and blank separators before the first version).
    if (current && !/^#\s/.test(line)) {
      notesBuf.push(line);
    }
  }
  flushNotes();

  // Trim leading/trailing blank lines left in notes.
  for (const e of entries) e.notes = e.notes.replace(/^\n+|\n+$/g, '');

  return entries;
}

/**
 * Read this repo's semver-ish git tags (vX.Y.Z), best-effort. Returns []
 * (never throws) when git is missing, the directory isn't a repo, or there
 * are no tags — a shallow clone on CI or Hostinger has none of this.
 */
export function readTags({ cwd = process.cwd() } = {}) {
  const FIELD_SEP = '\u0001';
  const format = [
    '%(refname:short)',
    '%(if)%(*objectname)%(then)%(*objectname)%(else)%(objectname)%(end)',
    '%(if)%(*creatordate:short)%(then)%(*creatordate:short)%(else)%(creatordate:short)%(end)',
    '%(if)%(*subject)%(then)%(*subject)%(else)%(subject)%(end)',
  ].join(FIELD_SEP);

  let out;
  try {
    out = execFileSync(
      'git',
      ['for-each-ref', 'refs/tags', `--format=${format}`],
      { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
  } catch {
    return [];
  }

  const tags = [];
  for (const line of out.split(/\r?\n/)) {
    if (!line) continue;
    const [tag, commit, date, subject] = line.split(FIELD_SEP);
    const versionMatch = /^v?(\d+\.\d+\.\d+)$/.exec(tag ?? '');
    if (!versionMatch) continue;
    tags.push({ tag, version: versionMatch[1], date: date || null, commit: commit || null, subject: subject || '' });
  }
  return tags;
}

/**
 * Merge the changelog file with git tags: each version gets `tag`/`commit`
 * when a matching `v<version>` tag exists. Dates from the file win; the
 * tag's date is the fallback when the file has none.
 * @param {{ file: string, cwd?: string }} options
 */
export function loadChangelog({ file, cwd = process.cwd() }) {
  const markdown = readFileSync(file, 'utf8');
  const entries = parseChangelog(markdown);
  const tags = readTags({ cwd });
  const byVersion = new Map(tags.map((t) => [t.version, t]));

  return entries.map((entry) => {
    const tag = byVersion.get(entry.version);
    if (!tag) return entry;
    return { ...entry, tag: tag.tag, commit: tag.commit, date: entry.date ?? tag.date };
  });
}

/**
 * Render entries as semantic HTML: one <article id="vX.Y.Z"> per version,
 * with a heading, a <time>, a <h3> per section and a <ul> of items.
 * Works outside Astro too — any Node build script can call this directly.
 * @param {ReturnType<typeof parseChangelog>} entries
 * @param {{ labels?: Record<string, string>, repoUrl?: string }} [options]
 */
export function renderChangelogHTML(entries, { labels = {}, repoUrl } = {}) {
  const L = {
    unreleased: 'Unreleased',
    viewCommit: 'View commit',
    viewTag: 'View tag',
    ...labels,
  };

  const articles = entries.map((entry) => {
    const isUnreleased = entry.version === 'Unreleased';
    const id = isUnreleased ? 'unreleased' : `v${entry.version}`;
    const heading = isUnreleased ? L.unreleased : `${entry.version}`;
    const time = entry.date
      ? `<time datetime="${escapeHTML(entry.date)}">${escapeHTML(entry.date)}</time>`
      : '';
    const link =
      repoUrl && entry.tag
        ? `<a class="changelog-ref" href="${escapeHTML(repoUrl)}/releases/tag/${escapeHTML(entry.tag)}">${escapeHTML(L.viewTag)}</a>`
        : repoUrl && entry.commit
          ? `<a class="changelog-ref" href="${escapeHTML(repoUrl)}/commit/${escapeHTML(entry.commit)}">${escapeHTML(L.viewCommit)}</a>`
          : '';

    const sections = entry.sections
      .map((section) => {
        const items = section.items.map((item) => `<li>${item}</li>`).join('');
        return `<h3>${escapeHTML(section.type)}</h3><ul>${items}</ul>`;
      })
      .join('');

    const notes = entry.notes ? `<p class="changelog-notes">${escapeHTML(entry.notes)}</p>` : '';

    return (
      `<article id="${id}" class="changelog-entry">` +
      `<h2>${escapeHTML(heading)}</h2>` +
      `<p class="changelog-meta">${time}${link}</p>` +
      notes +
      sections +
      `</article>`
    );
  });

  return articles.join('\n');
}
