import crypto from 'crypto'

export interface TextSegment {
	title: string | null
	content: string
	position: number
	tokenCount: number
}

/**
 * Split a block of text into ordered, roughly even segments that keep headings together.
 * Intended as a lightweight stand-in for full PDF shingling while we wire up Apryse/Document AI.
 */
export function segmentText(rawText: string, targetSize = 900): TextSegment[] {
	const normalized = rawText.replace(/\r/g, '').trim()
	if (!normalized) return []

	// Break on blank lines first to keep natural paragraphs together.
	const paragraphs = normalized
		.split(/\n{2,}/)
		.map((p) => p.trim())
		.filter((p) => p.length > 0)

	const segments: TextSegment[] = []
	let buffer: string[] = []
	let position = 0

	const flush = () => {
		if (buffer.length === 0) return
		const content = buffer.join('\n\n')
		const tokenCount = content.split(/\s+/).filter(Boolean).length
		segments.push({
			title: deriveHeading(content),
			content,
			position: position++,
			tokenCount,
		})
		buffer = []
	}

	for (const para of paragraphs) {
		const nextSize = buffer.join('\n\n').length + para.length
		if (nextSize > targetSize && buffer.length > 0) {
			flush()
		}
		buffer.push(para)
	}

	flush()
	return segments
}

/**
 * Deterministic fallback embedding so similarity search still works without OpenAI access.
 * Uses a tiny hashing projection to keep runtime predictable.
 */
export function buildLocalEmbedding(text: string, dimensions = 24): number[] {
	const tokens = text.toLowerCase().split(/\W+/).filter(Boolean)
	const vector = new Array(dimensions).fill(0)

	for (const token of tokens) {
		const hash = crypto.createHash('md5').update(token).digest()
		// combine first two bytes to a number
		const bucket = (hash[0] << 8) + hash[1]
		const index = bucket % dimensions
		vector[index] += 1
	}

	const magnitude = Math.sqrt(vector.reduce<number>((sum, v) => sum + v * v, 0)) || 1
	return vector.map((v) => Number((v / magnitude).toFixed(6)))
}

export function cosineSimilarity(a: number[], b: number[]): number {
	if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0
	let dot = 0
	let normA = 0
	let normB = 0
	for (let i = 0; i < a.length; i += 1) {
		dot += a[i] * b[i]
		normA += a[i] * a[i]
		normB += b[i] * b[i]
	}
	const denom = Math.sqrt(normA) * Math.sqrt(normB)
	return denom === 0 ? 0 : Number((dot / denom).toFixed(6))
}

function deriveHeading(content: string): string | null {
	// Use the first line as a heading if it looks like a section label.
	const firstLine = content.split('\n')[0]?.trim() ?? ''
	if (!firstLine) return null
	const isHeading = /^[A-Z0-9 .:-]{6,}$/.test(firstLine) || firstLine.length < 64
	return isHeading ? firstLine.slice(0, 96) : null
}
