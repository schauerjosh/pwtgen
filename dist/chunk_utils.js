// Utility: Split HTML by tags/components for smarter chunking
export function smartChunkHtml(text, maxChars = 6000) {
    const chunks = [];
    let buffer = '';
    let tagCount = 0;
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
        buffer += line + '\n';
        if (/<[a-zA-Z0-9\-]+/.test(line))
            tagCount++;
        if (buffer.length >= maxChars || tagCount >= 20) {
            chunks.push(buffer);
            buffer = '';
            tagCount = 0;
        }
    }
    if (buffer.trim())
        chunks.push(buffer);
    return chunks;
}
//# sourceMappingURL=chunk_utils.js.map